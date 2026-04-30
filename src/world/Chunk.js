import { createDoor } from './objects/Door.js';
import { createFurniture, populateFurniture, OBJECT_SPRITE_INDEX } from './objects/Furniture.js';
import { findMatchingPrefab, orientPrefab, BIOME_DOOR_TYPES } from '../content/BuildingPrefabs.js';
import { ROOM_LOOT_TABLES, OUTDOOR_LOOT, rollLootPool, generateRoomLoot } from '../content/LootTables.js';
import { createNoise2D } from '../utils/noise.js';

// Mulberry32 seeded PRNG — deterministic, fast, 32-bit state
function mulberry32(seed) {
    return function() {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Hash two integers into a seed
function hashCoords(x, y, worldSeed) {
    let h = worldSeed | 0;
    h = Math.imul(h ^ x, 0x9E3779B9);
    h = Math.imul(h ^ y, 0x85EBCA6B);
    h = h ^ (h >>> 13);
    return h;
}

export class Chunk {
    constructor(world, cx, cy) {
        this.world = world;
        this.cx = cx;
        this.cy = cy;
        this.size = world.chunkSize;
        this.tiles = {}; // Now a map of z-levels: { 0: [][], 1: [][], -1: [][] }
        this.buildingDoors = []; // Track door positions for pathway generation
        
        // Deterministic seeded RNG for this chunk
        const seed = hashCoords(cx, cy, world.worldSeed || 12345);
        this.rng = mulberry32(seed);
    }
    
    generate() {
        const biome = this.selectBiome();
        this.biome = biome;
        const district = this.selectDistrict(biome);
        this.district = district;
        
        // Initialize ground level (z=0)
        this.tiles[0] = [];
        
        // Pre-compute neighbor biomes for transition blending
        const neighborBiomes = {
            top:    this.getNeighborBiome(this.cx, this.cy - 1),
            bottom: this.getNeighborBiome(this.cx, this.cy + 1),
            left:   this.getNeighborBiome(this.cx - 1, this.cy),
            right:  this.getNeighborBiome(this.cx + 1, this.cy)
        };
        const blendZone = 16; // tiles from edge where blending occurs
        
        // Generate base terrain with biome transition blending
        for (let y = 0; y < this.size; y++) {
            this.tiles[0][y] = [];
            for (let x = 0; x < this.size; x++) {
                let tileBiome = biome;
                
                // Check if near an edge with a different biome — blend gradually
                const distTop = y;
                const distBottom = this.size - 1 - y;
                const distLeft = x;
                const distRight = this.size - 1 - x;
                
                let altBiome = null;
                let blendStrength = 0;
                
                if (distTop < blendZone && neighborBiomes.top && neighborBiomes.top !== biome) {
                    const s = 1 - distTop / blendZone;
                    if (s > blendStrength) { blendStrength = s; altBiome = neighborBiomes.top; }
                }
                if (distBottom < blendZone && neighborBiomes.bottom && neighborBiomes.bottom !== biome) {
                    const s = 1 - distBottom / blendZone;
                    if (s > blendStrength) { blendStrength = s; altBiome = neighborBiomes.bottom; }
                }
                if (distLeft < blendZone && neighborBiomes.left && neighborBiomes.left !== biome) {
                    const s = 1 - distLeft / blendZone;
                    if (s > blendStrength) { blendStrength = s; altBiome = neighborBiomes.left; }
                }
                if (distRight < blendZone && neighborBiomes.right && neighborBiomes.right !== biome) {
                    const s = 1 - distRight / blendZone;
                    if (s > blendStrength) { blendStrength = s; altBiome = neighborBiomes.right; }
                }
                
                // Probabilistic blend — stronger near edge
                if (altBiome && this.rng() < blendStrength * 0.6) {
                    tileBiome = altBiome;
                }
                
                this.tiles[0][y][x] = this.generateCleanTerrain(x, y, tileBiome);
            }
        }
        
        // Initialize underground level (z=-1) with solid rock
        this.tiles[-1] = [];
        for (let y = 0; y < this.size; y++) {
            this.tiles[-1][y] = [];
            for (let x = 0; x < this.size; x++) {
                this.tiles[-1][y][x] = {
                    glyph: '█',
                    fgColor: '#222222',
                    bgColor: '#000000',
                    blocked: true,
                    name: 'Solid Rock'
                };
            }
        }
        
        // Always initialize roads array (POI generators may need it)
        this.roads = [];
        
        // District-specific generation pipeline
        if (district === 'park') {
            this.generatePark(biome);
        } else if (district === 'lake') {
            this.generateLake(biome);
        } else if (district === 'plaza') {
            this.generatePlaza(biome);
        } else if (district === 'deep_forest') {
            // No roads or buildings — just dense obstacles
            this.addObstaclesAndDebris(biome);
        } else if (district === 'ruins_cluster') {
            this.generateRuinsCluster(biome);
        } else {
            // Standard pipeline: roads > sewers > block fill > street detail > features > obstacles > items
            this.generateRoadNetwork(biome);
            this.generateSewerSystem(biome);
            this.fillBlocks(biome, district);
            this.addStreetDetail(biome, district);
            this.generateDistrictFeatures(biome, district);
            this.addObstaclesAndDebris(biome);
        }
        
        this.spawnItems(biome);
        
        // District-aware NPC spawning
        this.npcSpawnRequests = this.getDistrictNPCSpawns(district);
    }
    
    // Returns array of {type, count} for World.js to instantiate
    getDistrictNPCSpawns(district) {
        switch (district) {
            case 'downtown':
                return [
                    { type: 'scavenger', count: 2 },
                    { type: 'raider', count: 2 },
                    { type: 'armed_raider', count: 1 }
                ];
            case 'shopping':
                return [
                    { type: 'scavenger', count: 3 },
                    { type: 'raider', count: 1 }
                ];
            case 'residential':
                return [
                    { type: 'scavenger', count: 1 },
                    { type: 'raider', count: this.rng() < 0.5 ? 1 : 0 },
                    { type: 'survivor', count: this.rng() < 0.5 ? 1 : 0 }
                ];
            case 'slum':
                return [
                    { type: 'raider', count: 2 },
                    { type: 'armed_raider', count: 1 },
                    { type: 'brute', count: this.rng() < 0.3 ? 1 : 0 },
                    { type: 'survivor', count: 1 }
                ];
            case 'industrial_yard':
            case 'shipping':
                return [
                    { type: 'scavenger', count: 1 },
                    { type: 'raider', count: 1 },
                    { type: 'brute', count: this.rng() < 0.4 ? 1 : 0 }
                ];
            case 'estate':
                return [
                    { type: 'stalker', count: this.rng() < 0.5 ? 1 : 0 },
                    { type: 'armed_raider', count: this.rng() < 0.3 ? 1 : 0 }
                ];
            case 'park':
                return [
                    { type: 'scavenger', count: 2 },
                    { type: 'stalker', count: this.rng() < 0.4 ? 1 : 0 }
                ];
            case 'plaza':
                return [
                    { type: 'scavenger', count: 2 },
                    { type: 'raider', count: 1 }
                ];
            case 'ruins_cluster':
                return [
                    { type: 'raider', count: 2 },
                    { type: 'armed_raider', count: 1 },
                    { type: 'brute', count: 1 }
                ];
            case 'farmstead':
            case 'forest_edge':
                return [
                    { type: 'scavenger', count: this.rng() < 0.5 ? 1 : 0 }
                ];
            case 'forest_clearing':
                return [
                    { type: 'stalker', count: this.rng() < 0.3 ? 1 : 0 }
                ];
            case 'deep_forest':
                return [
                    { type: 'stalker', count: this.rng() < 0.2 ? 1 : 0 }
                ];
            case 'lake':
                return [];
            default:
                return [
                    { type: 'scavenger', count: 1 }
                ];
        }
    }
    
    spawnItems(biome) {
        const content = this.world.game.content;
        
        // Collect floor tiles grouped by roomType
        const roomTiles = {};   // { roomType: [{x, y}, ...] }
        const outdoorTiles = []; // floor tiles with no roomType
        
        const z = 0;
        for (let ly = 0; ly < this.size; ly++) {
            for (let lx = 0; lx < this.size; lx++) {
                const tile = this.getTile(lx, ly, z);
                if (!tile || tile.blocked) continue;
                
                if (tile.roomType && ROOM_LOOT_TABLES[tile.roomType]) {
                    if (!roomTiles[tile.roomType]) roomTiles[tile.roomType] = [];
                    roomTiles[tile.roomType].push({ x: lx, y: ly });
                } else if (tile.name === 'Floor' || tile.name === 'Sidewalk' || tile.name === 'Road') {
                    outdoorTiles.push({ x: lx, y: ly });
                }
            }
        }
        
        // Spawn items in tagged rooms using loot tables
        for (const [roomType, tiles] of Object.entries(roomTiles)) {
            const lootItems = generateRoomLoot(roomType, tiles);
            for (const loot of lootItems) {
                const item = loot.componentId 
                    ? content.createComponent(loot.componentId)
                    : content.createItem(loot.familyId);
                if (item) {
                    item.x = this.cx * this.size + loot.x;
                    item.y = this.cy * this.size + loot.y;
                    item.z = z;
                    this.world.addItem(item);
                }
            }
        }
        
        // Spawn sparse outdoor loot on untagged tiles
        for (const tile of outdoorTiles) {
            if (this.rng() > OUTDOOR_LOOT.spawnChance) continue;
            
            const rolled = rollLootPool(OUTDOOR_LOOT.pools);
            const item = rolled.componentId 
                ? content.createComponent(rolled.componentId)
                : content.createItem(rolled.familyId);
            if (item) {
                item.x = this.cx * this.size + tile.x;
                item.y = this.cy * this.size + tile.y;
                item.z = z;
                this.world.addItem(item);
            }
        }
    }
    
    // Compute biome for arbitrary chunk coordinates (used for transition blending)
    getNeighborBiome(cx, cy) {
        if (this.world.forcedBiome) return this.world.forcedBiome;
        return Chunk.computeBiome(cx, cy, this.world.worldSeed || 12345);
    }
    
    // Static biome computation — shared by selectBiome and getNeighborBiome
    static computeBiome(cx, cy, seed) {
        const biomeNoise = createNoise2D(seed + 1111);
        const varietyNoise = createNoise2D(seed + 2222);

        const dist = Math.sqrt(cx * cx + cy * cy);
        const warp = biomeNoise(cx * 0.18, cy * 0.18) * 1.5;
        const d = dist + warp;
        const v = varietyNoise(cx * 0.25, cy * 0.25);

        if (d < 2) return 'urban_core';
        if (d < 4) {
            if (v < -0.3) return 'industrial';
            if (v < 0.3) return 'urban_core';
            return 'suburbs';
        }
        if (d < 7) {
            if (v < -0.5) return 'industrial';
            if (v < -0.1) return 'ruins';
            if (v < 0.3) return 'suburbs';
            return 'rich_neighborhood';
        }
        if (d < 10) return v < -0.2 ? 'forest' : 'rural';
        return 'forest';
    }
    
    selectBiome() {
        if (this.world.forcedBiome) return this.world.forcedBiome;
        return Chunk.computeBiome(this.cx, this.cy, this.world.worldSeed || 12345);
    }
    
    // District assignment — noise-based clustering so adjacent chunks
    // in the same biome share district types (coherent neighborhoods).
    selectDistrict(biome) {
        const seed = this.world.worldSeed || 12345;
        // Medium-scale noise (~2-3 chunk clusters) for district grouping
        const districtNoise = createNoise2D(seed + 3333);
        const d = districtNoise(this.cx * 0.35, this.cy * 0.35); // [-1, 1]

        // Rare POI roll — parks, plazas, lakes get a small random chance
        // so they don't dominate via noise (they should be occasional landmarks)
        const poiRoll = this.rng();

        switch (biome) {
            case 'urban_core':
                if (poiRoll < 0.08) return 'plaza';
                if (d < -0.2) return 'downtown';
                if (d < 0.3) return 'shopping';
                if (d < 0.6) return 'downtown';
                return 'slum';

            case 'suburbs':
                if (poiRoll < 0.10) return 'park';
                if (d < -0.1) return 'shopping';
                return 'residential';

            case 'industrial':
                if (d < -0.2) return 'shipping';
                if (d < 0.4) return 'industrial_yard';
                return 'downtown';

            case 'rich_neighborhood':
                if (poiRoll < 0.12) return 'park';
                if (d < 0.0) return 'estate';
                return 'residential';

            case 'ruins':
                if (d < -0.2) return 'industrial_yard';
                if (d < 0.3) return 'ruins_cluster';
                return 'downtown';

            case 'rural':
                if (d < -0.2) return 'forest_edge';
                if (d < 0.3) return 'farmstead';
                return 'residential';

            case 'forest':
                if (poiRoll < 0.10) return 'lake';
                if (d < -0.2) return 'forest_clearing';
                return 'deep_forest';

            default:
                return 'residential';
        }
    }
    
    generateCleanTerrain(x, y, biome) {
        // Phase 1: Generate ONLY floor tiles (no obstacles)
        // Obstacles will be added later in addObstaclesAndDebris()
        // Ground spritesheet indices: 0=urban_paved, 4=suburbs, 7=industrial, 10=rich, 13=rural, 16=forest, 17=ruins
        
        switch(biome) {
            case 'urban_core':
                return { glyph: '.', fgColor: '#666666', bgColor: '#0f0f0f', blocked: false, name: 'Paved Ground', spriteData: { sheet: 'ground', index: 0 } };
            case 'suburbs':
                return { glyph: '.', fgColor: '#556b2f', bgColor: '#0a0a0a', blocked: false, name: 'Suburban Ground', spriteData: { sheet: 'ground', index: 4 } };
            case 'industrial':
                return { glyph: '.', fgColor: '#555555', bgColor: '#0a0a0a', blocked: false, name: 'Concrete Floor', spriteData: { sheet: 'ground', index: 7 } };
            case 'rich_neighborhood':
                return { glyph: '.', fgColor: '#6b8e23', bgColor: '#0f0f0a', blocked: false, name: 'Manicured Ground', spriteData: { sheet: 'ground', index: 10 } };
            case 'rural':
                return { glyph: '.', fgColor: '#8b7355', bgColor: '#0a0805', blocked: false, name: 'Dirt Ground', spriteData: { sheet: 'ground', index: 13 } };
            case 'forest':
                return { glyph: ',', fgColor: '#4a6741', bgColor: '#0a0f0a', blocked: false, name: 'Forest Floor', spriteData: { sheet: 'ground', index: 16 } };
            case 'ruins':
                return { glyph: '.', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Cracked Floor', spriteData: { sheet: 'ground', index: 17 } };
            default:
                return { glyph: '.', fgColor: '#3a3a3a', bgColor: '#050505', blocked: false, name: 'Ground' };
        }
    }
    
    addObstaclesAndDebris(biome) {
        // Context-aware obstacle placement — checks adjacency before placing.
        // Trees/bushes in yards near buildings, barriers along roads, debris in alleys.
        
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const tile = this.getTile(x, y, 0);
                
                // Only place on empty ground tiles (not roads, buildings, sidewalks, parking)
                const isEmptyFloor = (
                    tile.name === 'Cracked Floor' ||
                    tile.name === 'Concrete Floor' ||
                    tile.name === 'Paved Ground' ||
                    tile.name === 'Suburban Ground' ||
                    tile.name === 'Manicured Ground' ||
                    tile.name === 'Dirt Ground' ||
                    tile.name === 'Forest Floor'
                );
                if (!isEmptyFloor) continue;
                
                // Deterministic random
                const worldX = this.cx * this.size + x;
                const worldY = this.cy * this.size + y;
                const hash = worldX * 73856093 ^ worldY * 19349663;
                const rand = Math.abs(Math.sin(hash)) * 100;
                
                // Detect adjacency context (check 4 neighbors)
                let nearWall = false, nearRoad = false;
                for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || nx >= this.size || ny < 0 || ny >= this.size) continue;
                    const n = this.getTile(nx, ny, 0);
                    if (n.isWall || n.name === 'Floor') nearWall = true;
                    if (n.isRoad) nearRoad = true;
                }
                
                switch(biome) {
                    case 'urban_core':
                        if (nearRoad && rand < 3) {
                            this.setTile(x, y, { glyph: '♣', fgColor: '#2a5a2a', bgColor: '#0f0f0f', blocked: true, name: 'Street Tree' }, 0);
                        } else if (nearWall && rand < 2) {
                            this.setTile(x, y, { glyph: '~', fgColor: '#663300', bgColor: '#0a0a0a', blocked: false, name: 'Litter' }, 0);
                        }
                        break;
                    
                    case 'suburbs':
                        if (nearWall && rand < 6) {
                            this.setTile(x, y, { glyph: '♣', fgColor: '#4a6741', bgColor: '#0a0a0a', blocked: false, name: 'Bush' }, 0);
                        } else if (!nearWall && !nearRoad && rand < 3) {
                            this.setTile(x, y, { glyph: '♣', fgColor: '#228b22', bgColor: '#0a0a0a', blocked: true, name: 'Yard Tree' }, 0);
                        }
                        break;
                    
                    case 'industrial':
                        if (nearWall && rand < 3) {
                            this.setTile(x, y, { glyph: '=', fgColor: '#666666', bgColor: '#0a0a0a', blocked: false, name: 'Grating' }, 0);
                        } else if (nearRoad && rand < 1.5) {
                            this.setTile(x, y, { glyph: '▓', fgColor: '#ffaa00', bgColor: '#1a1a0a', blocked: true, name: 'Jersey Barrier' }, 0);
                        }
                        break;
                    
                    case 'rich_neighborhood':
                        if (nearWall && rand < 5) {
                            this.setTile(x, y, { glyph: '♠', fgColor: '#6b8e23', bgColor: '#0f0f0a', blocked: false, name: 'Garden' }, 0);
                        } else if (!nearWall && !nearRoad && rand < 2) {
                            this.setTile(x, y, { glyph: '♣', fgColor: '#228b22', bgColor: '#0f0f0a', blocked: true, name: 'Ornamental Tree' }, 0);
                        }
                        break;
                    
                    case 'rural':
                        if (rand < 2) {
                            this.setTile(x, y, { glyph: '●', fgColor: '#696969', bgColor: '#0a0805', blocked: true, name: 'Boulder' }, 0);
                        } else if (rand < 8) {
                            this.setTile(x, y, { glyph: '"', fgColor: '#9acd32', bgColor: '#0a0805', blocked: false, name: 'Tall Grass' }, 0);
                        }
                        break;
                    
                    case 'forest':
                        if (rand < 18) {
                            this.setTile(x, y, { glyph: '♣', fgColor: '#228b22', bgColor: '#0a0f0a', blocked: true, name: 'Tree' }, 0);
                        } else if (rand < 28) {
                            this.setTile(x, y, { glyph: '♠', fgColor: '#4a6741', bgColor: '#0a0f0a', blocked: false, name: 'Bush' }, 0);
                        }
                        break;
                    
                    case 'ruins':
                        if (nearWall && rand < 5) {
                            this.setTile(x, y, { glyph: '~', fgColor: '#663300', bgColor: '#0a0a0a', blocked: false, name: 'Debris' }, 0);
                        } else if (rand < 2) {
                            this.setTile(x, y, { glyph: '#', fgColor: '#555555', bgColor: '#1a1a1a', blocked: true, isWall: true, name: 'Rubble Wall' }, 0);
                        }
                        break;
                }
            }
        }
        
    }
    
    getTile(x, y, z = 0) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: true, name: 'Void' };
        }
        if (!this.tiles[z]) {
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: false, name: 'Empty Air' };
        }
        if (!this.tiles[z][y]) {
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: false, name: 'Empty Air' };
        }
        return this.tiles[z][y][x] || { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: false, name: 'Empty Air' };
    }
    
    setTile(x, y, tile, z = 0) {
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            // Initialize z-level if it doesn't exist
            if (!this.tiles[z]) {
                this.tiles[z] = [];
                for (let i = 0; i < this.size; i++) {
                    this.tiles[z][i] = [];
                }
            }
            this.tiles[z][y][x] = tile;
        }
    }
    
    // Road tile definitions by biome
    getRoadConfig(biome) {
        const configs = {
            urban_core: {
                mainRoadTile: { glyph: '=', fgColor: '#00ffff', bgColor: '#0a2a2a', blocked: false, name: 'City Street', spriteData: { sheet: 'ground', index: 1 } },
                sideStreetTile: { glyph: '-', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Side Street', spriteData: { sheet: 'ground', index: 2 } },
                alleyTile: { glyph: '.', fgColor: '#555555', bgColor: '#0a0a0a', blocked: false, name: 'Alley', spriteData: { sheet: 'ground', index: 2 } },
                sidewalkTile: { glyph: '·', fgColor: '#888888', bgColor: '#1a1a1a', blocked: false, name: 'Sidewalk', spriteData: { sheet: 'ground', index: 3 } },
                mainWidth: 4, sideWidth: 3, alleyWidth: 1
            },
            suburbs: {
                mainRoadTile: { glyph: '=', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Suburban Road', spriteData: { sheet: 'ground', index: 5 } },
                sideStreetTile: { glyph: '-', fgColor: '#008888', bgColor: '#0a0a0a', blocked: false, name: 'Residential Street', spriteData: { sheet: 'ground', index: 6 } },
                alleyTile: { glyph: '.', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Alley', spriteData: { sheet: 'ground', index: 6 } },
                sidewalkTile: { glyph: '·', fgColor: '#777777', bgColor: '#0f0f0f', blocked: false, name: 'Sidewalk', spriteData: { sheet: 'ground', index: 3 } },
                mainWidth: 3, sideWidth: 2, alleyWidth: 1
            },
            industrial: {
                mainRoadTile: { glyph: '=', fgColor: '#00ffff', bgColor: '#0a2a2a', blocked: false, name: 'Paved Road', spriteData: { sheet: 'ground', index: 8 } },
                sideStreetTile: { glyph: '-', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Asphalt Street', spriteData: { sheet: 'ground', index: 9 } },
                alleyTile: { glyph: '.', fgColor: '#555555', bgColor: '#0a0a0a', blocked: false, name: 'Service Road', spriteData: { sheet: 'ground', index: 9 } },
                sidewalkTile: null,
                mainWidth: 3, sideWidth: 2, alleyWidth: 1
            },
            rich_neighborhood: {
                mainRoadTile: { glyph: '=', fgColor: '#d4af37', bgColor: '#1a1a0a', blocked: false, name: 'Pristine Road', spriteData: { sheet: 'ground', index: 11 } },
                sideStreetTile: { glyph: '-', fgColor: '#b8860b', bgColor: '#0f0f0a', blocked: false, name: 'Private Drive', spriteData: { sheet: 'ground', index: 12 } },
                alleyTile: null,
                sidewalkTile: { glyph: '·', fgColor: '#999999', bgColor: '#1a1a0a', blocked: false, name: 'Walkway', spriteData: { sheet: 'ground', index: 3 } },
                mainWidth: 3, sideWidth: 2, alleyWidth: 1
            },
            rural: {
                mainRoadTile: { glyph: '·', fgColor: '#aa6633', bgColor: '#0a0500', blocked: false, name: 'Dirt Road', spriteData: { sheet: 'ground', index: 14 } },
                sideStreetTile: { glyph: ',', fgColor: '#885522', bgColor: '#050200', blocked: false, name: 'Dirt Trail', spriteData: { sheet: 'ground', index: 15 } },
                alleyTile: null,
                sidewalkTile: null,
                mainWidth: 2, sideWidth: 1, alleyWidth: 1
            },
            ruins: {
                mainRoadTile: { glyph: '~', fgColor: '#ff8800', bgColor: '#1a0a00', blocked: false, name: 'Cracked Pavement', spriteData: { sheet: 'ground', index: 18 } },
                sideStreetTile: { glyph: '.', fgColor: '#aa5500', bgColor: '#0a0500', blocked: false, name: 'Broken Path', spriteData: { sheet: 'ground', index: 19 } },
                alleyTile: { glyph: '.', fgColor: '#664400', bgColor: '#0a0500', blocked: false, name: 'Rubble Path', spriteData: { sheet: 'ground', index: 19 } },
                sidewalkTile: null,
                mainWidth: 2, sideWidth: 1, alleyWidth: 1
            }
        };
        return configs[biome] || configs.suburbs;
    }
    
    // === CROSS-CHUNK ROAD GRID ===
    // Road positions are computed from row/column indices only, so ALL chunks
    // in the same row/column produce identical positions → seamless connectivity.
    
    getRowRoads(cy) {
        const S = this.size;
        const roads = [];
        const seed = this.world.worldSeed;
        
        // Arterial every 2 chunk rows at midpoint
        if (cy % 2 === 0) {
            roads.push({ y: Math.floor(S / 2), type: 'arterial' });
        }
        
        // Secondary through-roads seeded by row index only (not cx)
        const rng = mulberry32(hashCoords(0, cy, seed + 7777));
        for (let i = 0; i < 5; i++) {
            const y = 14 + Math.floor(rng() * (S - 28));
            if (roads.every(r => Math.abs(r.y - y) >= 20)) {
                roads.push({ y, type: 'secondary' });
            }
        }
        
        roads.sort((a, b) => a.y - b.y);
        return roads;
    }
    
    getColumnRoads(cx) {
        const S = this.size;
        const roads = [];
        const seed = this.world.worldSeed;
        
        if (cx % 2 === 0) {
            roads.push({ x: Math.floor(S / 2), type: 'arterial' });
        }
        
        const rng = mulberry32(hashCoords(cx, 0, seed + 8888));
        for (let i = 0; i < 5; i++) {
            const x = 14 + Math.floor(rng() * (S - 28));
            if (roads.every(r => Math.abs(r.x - x) >= 20)) {
                roads.push({ x, type: 'secondary' });
            }
        }
        
        roads.sort((a, b) => a.x - b.x);
        return roads;
    }
    
    generateRoadNetwork(biome) {
        
        this.roads = [];
        this.blocks = [];
        
        const rc = this.getRoadConfig(biome);
        const district = this.district;
        const S = this.size;
        
        // Get through-roads from global grid
        const allH = this.getRowRoads(this.cy);
        const allV = this.getColumnRoads(this.cx);
        
        // Filter by biome — forest gets only arterials as trails, rural gets limited roads
        let hToDraw, vToDraw;
        if (biome === 'forest') {
            hToDraw = allH.filter(r => r.type === 'arterial');
            vToDraw = allV.filter(r => r.type === 'arterial');
        } else if (biome === 'rural') {
            hToDraw = [...allH.filter(r => r.type === 'arterial')];
            vToDraw = [...allV.filter(r => r.type === 'arterial')];
            const hSec = allH.filter(r => r.type === 'secondary');
            const vSec = allV.filter(r => r.type === 'secondary');
            if (hSec.length > 0) hToDraw.push(hSec[0]);
            if (vSec.length > 0) vToDraw.push(vSec[0]);
            hToDraw.sort((a, b) => a.y - b.y);
            vToDraw.sort((a, b) => a.x - b.x);
        } else {
            hToDraw = [...allH];
            vToDraw = [...allV];
        }
        
        if (hToDraw.length === 0 && vToDraw.length === 0) {
            return;
        }
        
        // === Draw all through-roads edge-to-edge (seamless cross-chunk connectivity) ===
        for (const hr of hToDraw) {
            const isArt = hr.type === 'arterial';
            const tile = isArt ? rc.mainRoadTile : rc.sideStreetTile;
            const width = isArt ? rc.mainWidth : rc.sideWidth;
            this.createHorizontalRoad(0, S - 1, hr.y, tile, width, isArt ? 'main' : 'side');
        }
        
        for (const vr of vToDraw) {
            const isArt = vr.type === 'arterial';
            const tile = isArt ? rc.mainRoadTile : rc.sideStreetTile;
            const width = isArt ? rc.mainWidth : rc.sideWidth;
            this.createVerticalRoad(0, S - 1, vr.x, tile, width, isArt ? 'main' : 'side');
        }
        
        // === Sidewalks on both sides of through-roads ===
        if (rc.sidewalkTile) {
            this.addSidewalks(hToDraw, vToDraw, rc);
        }
        
        // === District-specific interior roads (don't cross chunk boundaries) ===
        this.addInteriorRoads(biome, district, rc, hToDraw, vToDraw);
        
        // === Detect city blocks (rectangular zones between roads) ===
        this.blocks = this.detectBlocks(hToDraw, vToDraw, rc);
    }
    
    addSidewalks(hRoads, vRoads, rc) {
        const S = this.size;
        const sw = rc.sidewalkTile;
        
        for (const hr of hRoads) {
            const width = hr.type === 'arterial' ? rc.mainWidth : rc.sideWidth;
            const offset = Math.floor(width / 2) + 1;
            for (let x = 0; x < S; x++) {
                const above = hr.y - offset;
                const below = hr.y + offset;
                if (above >= 0) {
                    const t = this.getTile(x, above, 0);
                    if (!t.isRoad) this.setTile(x, above, { ...sw }, 0);
                }
                if (below < S) {
                    const t = this.getTile(x, below, 0);
                    if (!t.isRoad) this.setTile(x, below, { ...sw }, 0);
                }
            }
        }
        
        for (const vr of vRoads) {
            const width = vr.type === 'arterial' ? rc.mainWidth : rc.sideWidth;
            const offset = Math.floor(width / 2) + 1;
            for (let y = 0; y < S; y++) {
                const left = vr.x - offset;
                const right = vr.x + offset;
                if (left >= 0) {
                    const t = this.getTile(left, y, 0);
                    if (!t.isRoad) this.setTile(left, y, { ...sw }, 0);
                }
                if (right < S) {
                    const t = this.getTile(right, y, 0);
                    if (!t.isRoad) this.setTile(right, y, { ...sw }, 0);
                }
            }
        }
    }
    
    addInteriorRoads(biome, district, rc, hThroughRoads, vThroughRoads) {
        const S = this.size;
        const alleyTile = rc.alleyTile || rc.sideStreetTile;
        
        switch (district) {
            case 'downtown': {
                // Alleys bisect each large block
                const sortedH = [...hThroughRoads].sort((a, b) => a.y - b.y);
                const yPos = [0, ...sortedH.map(r => r.y), S - 1];
                for (let i = 0; i < yPos.length - 1; i++) {
                    if (yPos[i + 1] - yPos[i] > 24) {
                        const alleyY = Math.floor((yPos[i] + yPos[i + 1]) / 2);
                        this.createHorizontalRoad(2, S - 3, alleyY, alleyTile, 1, 'alley');
                    }
                }
                const sortedV = [...vThroughRoads].sort((a, b) => a.x - b.x);
                const xPos = [0, ...sortedV.map(r => r.x), S - 1];
                for (let i = 0; i < xPos.length - 1; i++) {
                    if (xPos[i + 1] - xPos[i] > 24) {
                        const alleyX = Math.floor((xPos[i] + xPos[i + 1]) / 2);
                        this.createVerticalRoad(2, S - 3, alleyX, alleyTile, 1, 'alley');
                    }
                }
                break;
            }
            
            case 'slum': {
                const numAlleys = 3 + Math.floor(this.rng() * 3);
                for (let i = 0; i < numAlleys; i++) {
                    const y = 10 + Math.floor(this.rng() * (S - 20));
                    this.createHorizontalRoad(Math.floor(this.rng() * 15), S - 1 - Math.floor(this.rng() * 15), y, alleyTile, 1, 'alley');
                }
                for (let i = 0; i < numAlleys - 1; i++) {
                    const x = 10 + Math.floor(this.rng() * (S - 20));
                    this.createVerticalRoad(Math.floor(this.rng() * 15), S - 1 - Math.floor(this.rng() * 15), x, alleyTile, 1, 'alley');
                }
                break;
            }
            
            case 'residential':
            case 'shopping': {
                // Back alley between adjacent through-road pairs
                const sortedH = [...hThroughRoads].sort((a, b) => a.y - b.y);
                const yPos = [0, ...sortedH.map(r => r.y), S - 1];
                for (let i = 0; i < yPos.length - 1; i++) {
                    if (yPos[i + 1] - yPos[i] > 30 && this.rng() < 0.7) {
                        const alleyY = Math.floor((yPos[i] + yPos[i + 1]) / 2);
                        this.createHorizontalRoad(4, S - 5, alleyY, alleyTile, 1, 'alley');
                    }
                }
                break;
            }
            
            case 'estate': {
                // Private driveways branching off through-roads
                const numDrives = 2 + Math.floor(this.rng() * 3);
                for (let i = 0; i < numDrives; i++) {
                    if (hThroughRoads.length === 0) break;
                    const road = hThroughRoads[Math.floor(this.rng() * hThroughRoads.length)];
                    const driveX = 20 + Math.floor(this.rng() * (S - 40));
                    const driveLen = 15 + Math.floor(this.rng() * 25);
                    const side = this.rng() < 0.5 ? -1 : 1;
                    const roadW = road.type === 'arterial' ? rc.mainWidth : rc.sideWidth;
                    const startY = road.y + side * (Math.floor(roadW / 2) + 2);
                    const endY = startY + side * driveLen;
                    const y1 = Math.max(2, Math.min(startY, endY));
                    const y2 = Math.min(S - 3, Math.max(startY, endY));
                    if (y2 - y1 > 8) {
                        this.createVerticalRoad(y1, y2, driveX, rc.sideStreetTile, rc.sideWidth, 'side');
                    }
                }
                break;
            }
            
            case 'industrial_yard':
            case 'shipping': {
                if (this.rng() < 0.6) {
                    const svcY = Math.floor(S * 0.3) + Math.floor(this.rng() * Math.floor(S * 0.4));
                    this.createHorizontalRoad(4, S - 5, svcY, alleyTile, 2, 'alley');
                }
                break;
            }
            
            default:
                break;
        }
    }
    
    detectBlocks(hRoads, vRoads, rc) {
        const S = this.size;
        const blocks = [];
        
        // Compute Y zones occupied by horizontal roads (road + sidewalk extent)
        const hZones = hRoads.map(hr => {
            const w = hr.type === 'arterial' ? rc.mainWidth : rc.sideWidth;
            const halfW = Math.floor(w / 2);
            const sw = rc.sidewalkTile ? 1 : 0;
            return { top: hr.y - halfW - sw, bottom: hr.y + halfW + sw };
        }).sort((a, b) => a.top - b.top);
        
        // Compute X zones occupied by vertical roads
        const vZones = vRoads.map(vr => {
            const w = vr.type === 'arterial' ? rc.mainWidth : rc.sideWidth;
            const halfW = Math.floor(w / 2);
            const sw = rc.sidewalkTile ? 1 : 0;
            return { left: vr.x - halfW - sw, right: vr.x + halfW + sw };
        }).sort((a, b) => a.left - b.left);
        
        // Y gaps: spaces between horizontal road zones
        const yGaps = [];
        let yAfter = 0;
        for (const zone of hZones) {
            const gapEnd = Math.max(yAfter, zone.top);
            if (gapEnd - yAfter >= 6) {
                yGaps.push({ start: yAfter, end: gapEnd });
            }
            yAfter = zone.bottom + 1;
        }
        if (S - yAfter >= 6) {
            yGaps.push({ start: yAfter, end: S });
        }
        
        // X gaps: spaces between vertical road zones
        const xGaps = [];
        let xAfter = 0;
        for (const zone of vZones) {
            const gapEnd = Math.max(xAfter, zone.left);
            if (gapEnd - xAfter >= 6) {
                xGaps.push({ start: xAfter, end: gapEnd });
            }
            xAfter = zone.right + 1;
        }
        if (S - xAfter >= 6) {
            xGaps.push({ start: xAfter, end: S });
        }
        
        // Cross-product: each Y gap × X gap = one city block
        for (const yg of yGaps) {
            for (const xg of xGaps) {
                blocks.push({
                    x: xg.start,
                    y: yg.start,
                    w: xg.end - xg.start,
                    h: yg.end - yg.start
                });
            }
        }
        
        return blocks;
    }
    
    // === BLOCK FILLERS ===
    // Each detected block gets filled according to its chunk's district.
    
    fillBlocks(biome, district) {
        if (!this.blocks || this.blocks.length === 0) {
            this.generateBuildingsAlongRoads(biome);
            return;
        }
        
        
        for (const block of this.blocks) {
            if (block.w < 8 || block.h < 8) continue;
            
            switch (district) {
                case 'downtown':
                    this.fillDowntownBlock(block, biome);
                    break;
                case 'shopping':
                    this.fillCommercialBlock(block, biome);
                    break;
                case 'residential':
                    this.fillResidentialBlock(block, biome);
                    break;
                case 'slum':
                    this.fillSlumBlock(block, biome);
                    break;
                case 'industrial_yard':
                case 'shipping':
                    this.fillIndustrialBlock(block, biome);
                    break;
                case 'estate':
                    this.fillEstateBlock(block, biome);
                    break;
                case 'farmstead':
                case 'forest_edge':
                case 'forest_clearing':
                    this.fillRuralBlock(block, biome);
                    break;
                case 'ruins_cluster':
                    this.fillRuinsBlock(block, biome);
                    break;
                default:
                    this.fillResidentialBlock(block, biome);
                    break;
            }
        }
    }
    
    // --- Residential: houses in rows facing the street, front yards, fences ---
    fillResidentialBlock(block, biome) {
        const S = this.size;
        const yard = 3;
        const gap = 2;
        const fenceTile = biome === 'rich_neighborhood'
            ? { glyph: '|', fgColor: '#f5f5dc', bgColor: null, blocked: true, isWall: true, name: 'Iron Fence' }
            : { glyph: '|', fgColor: '#8b7355', bgColor: null, blocked: true, isWall: true, name: 'Wood Fence' };
        
        const houseW = 14 + Math.floor(this.rng() * 7);
        const houseH = 10 + Math.floor(this.rng() * 5);
        
        const canFitTwoRows = block.h >= (houseH + yard) * 2 + 2;
        const midY = block.y + Math.floor(block.h / 2);
        
        // Top row: houses facing north (door toward road above block)
        let x = block.x + 1;
        while (x + houseW <= block.x + block.w - 1) {
            const bx = x;
            const by = block.y + yard;
            const maxY = canFitTwoRows ? midY - 1 : block.y + block.h - yard;
            
            if (by >= 0 && by + houseH <= maxY && by + houseH < S &&
                this.canPlaceBuildingAt(bx, by, houseW, houseH)) {
                this.placeBuilding(bx, by, houseW, houseH, biome, 'horizontal', 1);
                
                // Side fence between properties
                if (x > block.x + 1) {
                    for (let fy = by - 1; fy < by + houseH + 1 && fy < S; fy++) {
                        if (fy >= 0 && bx - 1 >= 0) {
                            const t = this.getTile(bx - 1, fy, 0);
                            if (!t.isRoad && !t.isWall && t.name !== 'Floor' && t.name !== 'Door') {
                                this.setTile(bx - 1, fy, { ...fenceTile, bgColor: t.bgColor }, 0);
                            }
                        }
                    }
                }
            }
            x += houseW + gap;
        }
        
        // Bottom row: houses facing south (door toward road below block)
        if (canFitTwoRows) {
            x = block.x + 1;
            while (x + houseW <= block.x + block.w - 1) {
                const bx = x;
                const by = block.y + block.h - yard - houseH;
                
                if (by >= midY + 1 && by >= 0 && by + houseH < S &&
                    this.canPlaceBuildingAt(bx, by, houseW, houseH)) {
                    this.placeBuilding(bx, by, houseW, houseH, biome, 'horizontal', -1);
                    
                    if (x > block.x + 1) {
                        for (let fy = by - 1; fy < by + houseH + 1 && fy < S; fy++) {
                            if (fy >= 0 && bx - 1 >= 0) {
                                const t = this.getTile(bx - 1, fy, 0);
                                if (!t.isRoad && !t.isWall && t.name !== 'Floor' && t.name !== 'Door') {
                                    this.setTile(bx - 1, fy, { ...fenceTile, bgColor: t.bgColor }, 0);
                                }
                            }
                        }
                    }
                }
                x += houseW + gap;
            }
        }
    }
    
    // --- Downtown: wall-to-wall dense buildings, narrow service gaps ---
    fillDowntownBlock(block, biome) {
        const margin = 1;
        const gap = 2;
        const innerX = block.x + margin;
        const innerY = block.y + margin;
        const innerW = block.w - margin * 2;
        const innerH = block.h - margin * 2;
        
        if (innerW < 8 || innerH < 8) return;
        
        // Monolithic building: large single building filling the whole block
        // 40% chance for blocks 20-55 tiles on each side
        const canMonolith = innerW >= 20 && innerH >= 20 && innerW <= 55 && innerH <= 55;
        if (canMonolith && this.rng() < 0.4) {
            if (this.canPlaceBuildingAt(innerX, innerY, innerW, innerH)) {
                this.placeBuilding(innerX, innerY, innerW, innerH, biome, 'horizontal', 1);
                return;
            }
        }
        
        // Split very large blocks into sub-buildings
        const splitH = innerW > 38;
        const splitV = innerH > 38;
        
        if (splitH && splitV) {
            // 4 buildings (quadrants) — each still 18-28 tiles
            const sx = Math.floor(innerW / 2) - 1;
            const sy = Math.floor(innerH / 2) - 1;
            const w1 = sx, w2 = innerW - sx - gap;
            const h1 = sy, h2 = innerH - sy - gap;
            
            const quads = [
                { x: innerX, y: innerY, w: w1, h: h1, rd: 'horizontal', rs: 1 },
                { x: innerX + sx + gap, y: innerY, w: w2, h: h1, rd: 'horizontal', rs: 1 },
                { x: innerX, y: innerY + sy + gap, w: w1, h: h2, rd: 'horizontal', rs: -1 },
                { x: innerX + sx + gap, y: innerY + sy + gap, w: w2, h: h2, rd: 'horizontal', rs: -1 }
            ];
            for (const q of quads) {
                if (q.w >= 8 && q.h >= 8 && this.canPlaceBuildingAt(q.x, q.y, q.w, q.h)) {
                    this.placeBuilding(q.x, q.y, q.w, q.h, biome, q.rd, q.rs);
                }
            }
        } else if (splitH) {
            // 2 buildings side by side
            const sx = Math.floor(innerW / 2) - 1;
            const w1 = sx, w2 = innerW - sx - gap;
            if (w1 >= 8 && this.canPlaceBuildingAt(innerX, innerY, w1, innerH))
                this.placeBuilding(innerX, innerY, w1, innerH, biome, 'vertical', -1);
            if (w2 >= 8 && this.canPlaceBuildingAt(innerX + sx + gap, innerY, w2, innerH))
                this.placeBuilding(innerX + sx + gap, innerY, w2, innerH, biome, 'vertical', 1);
        } else if (splitV) {
            // 2 buildings stacked
            const sy = Math.floor(innerH / 2) - 1;
            const h1 = sy, h2 = innerH - sy - gap;
            if (h1 >= 8 && this.canPlaceBuildingAt(innerX, innerY, innerW, h1))
                this.placeBuilding(innerX, innerY, innerW, h1, biome, 'horizontal', 1);
            if (h2 >= 8 && this.canPlaceBuildingAt(innerX, innerY + sy + gap, innerW, h2))
                this.placeBuilding(innerX, innerY + sy + gap, innerW, h2, biome, 'horizontal', -1);
        } else {
            // Single building filling the block
            if (this.canPlaceBuildingAt(innerX, innerY, innerW, innerH))
                this.placeBuilding(innerX, innerY, innerW, innerH, biome, 'horizontal', 1);
        }
    }
    
    // --- Commercial: shops flush to nearest road, parking lot behind ---
    fillCommercialBlock(block, biome) {
        const S = this.size;
        const shopDepth = 10 + Math.floor(this.rng() * 4);
        const shopMinW = 10 + Math.floor(this.rng() * 4);
        const gap = 1;
        
        // Detect which edge of the block is adjacent to a road
        // Check tiles just outside each edge for road tiles
        const edgeScores = { top: 0, bottom: 0, left: 0, right: 0 };
        for (let px = block.x; px < block.x + block.w && px < S; px++) {
            if (block.y > 0) {
                const t = this.getTile(px, block.y - 1, 0);
                if (t && t.isRoad) edgeScores.top++;
            }
            if (block.y + block.h < S) {
                const t = this.getTile(px, block.y + block.h, 0);
                if (t && t.isRoad) edgeScores.bottom++;
            }
        }
        for (let py = block.y; py < block.y + block.h && py < S; py++) {
            if (block.x > 0) {
                const t = this.getTile(block.x - 1, py, 0);
                if (t && t.isRoad) edgeScores.left++;
            }
            if (block.x + block.w < S) {
                const t = this.getTile(block.x + block.w, py, 0);
                if (t && t.isRoad) edgeScores.right++;
            }
        }
        
        // Pick edge with most road tiles; default to top
        let bestEdge = 'top';
        let bestScore = edgeScores.top;
        for (const [edge, score] of Object.entries(edgeScores)) {
            if (score > bestScore) { bestEdge = edge; bestScore = score; }
        }
        
        // Place shops flush to the road edge, parking behind
        const parkingTile = { glyph: '·', fgColor: '#555555', bgColor: '#0f0f0f', blocked: false, name: 'Parking Lot', spriteData: { sheet: 'ground', index: 22 } };
        
        if (bestEdge === 'top' || bestEdge === 'bottom') {
            // Shops along horizontal edge
            const roadDir = 'horizontal';
            const roadSide = bestEdge === 'top' ? 1 : -1;
            const shopY = bestEdge === 'top' ? block.y + 1 : block.y + block.h - 1 - shopDepth;
            
            let x = block.x + 1;
            while (x + shopMinW <= block.x + block.w - 1) {
                const sw = shopMinW + Math.floor(this.rng() * 4);
                const actualW = Math.min(sw, block.x + block.w - 1 - x);
                if (actualW >= 8 && shopY >= 0 && shopY + shopDepth < S &&
                    this.canPlaceBuildingAt(x, shopY, actualW, shopDepth)) {
                    this.placeBuilding(x, shopY, actualW, shopDepth, biome, roadDir, roadSide);
                }
                x += actualW + gap;
            }
            
            // Parking lot in remaining space behind shops
            const parkStart = bestEdge === 'top' ? shopY + shopDepth + 2 : block.y + 1;
            const parkEnd = bestEdge === 'top' ? block.y + block.h - 1 : shopY - 2;
            if (parkEnd - parkStart >= 3) {
                for (let py = parkStart; py < parkEnd && py < S; py++) {
                    for (let px = block.x + 1; px < block.x + block.w - 1 && px < S; px++) {
                        const t = this.getTile(px, py, 0);
                        if (!t.isRoad && !t.isWall && t.name !== 'Floor' && t.name !== 'Door') {
                            this.setTile(px, py, { ...parkingTile }, 0);
                        }
                    }
                }
            }
        } else {
            // Shops along vertical edge (left or right)
            const roadDir = 'vertical';
            const roadSide = bestEdge === 'left' ? 1 : -1;
            const shopX = bestEdge === 'left' ? block.x + 1 : block.x + block.w - 1 - shopDepth;
            
            let y = block.y + 1;
            while (y + shopMinW <= block.y + block.h - 1) {
                const sh = shopMinW + Math.floor(this.rng() * 4);
                const actualH = Math.min(sh, block.y + block.h - 1 - y);
                if (actualH >= 8 && shopX >= 0 && shopX + shopDepth < S &&
                    this.canPlaceBuildingAt(shopX, y, shopDepth, actualH)) {
                    this.placeBuilding(shopX, y, shopDepth, actualH, biome, roadDir, roadSide);
                }
                y += actualH + gap;
            }
            
            // Parking lot behind shops
            const parkStart = bestEdge === 'left' ? shopX + shopDepth + 2 : block.x + 1;
            const parkEnd = bestEdge === 'left' ? block.x + block.w - 1 : shopX - 2;
            if (parkEnd - parkStart >= 3) {
                for (let py = block.y + 1; py < block.y + block.h - 1 && py < S; py++) {
                    for (let px = parkStart; px < parkEnd && px < S; px++) {
                        const t = this.getTile(px, py, 0);
                        if (!t.isRoad && !t.isWall && t.name !== 'Floor' && t.name !== 'Door') {
                            this.setTile(px, py, { ...parkingTile }, 0);
                        }
                    }
                }
            }
        }
    }
    
    // --- Industrial: large warehouses inside chain-link fenced compound ---
    fillIndustrialBlock(block, biome) {
        const S = this.size;
        const chainFence = { glyph: '#', fgColor: '#888888', bgColor: '#0a0a0a', blocked: true, isWall: true, name: 'Chain Fence' };
        
        // Perimeter fence
        for (let px = block.x; px < block.x + block.w && px < S; px++) {
            if (block.y >= 0 && block.y < S) {
                const t = this.getTile(px, block.y, 0);
                if (!t.isRoad) this.setTile(px, block.y, { ...chainFence }, 0);
            }
            const botY = block.y + block.h - 1;
            if (botY >= 0 && botY < S) {
                const t = this.getTile(px, botY, 0);
                if (!t.isRoad) this.setTile(px, botY, { ...chainFence }, 0);
            }
        }
        for (let py = block.y; py < block.y + block.h && py < S; py++) {
            if (block.x >= 0 && block.x < S) {
                const t = this.getTile(block.x, py, 0);
                if (!t.isRoad) this.setTile(block.x, py, { ...chainFence }, 0);
            }
            const rightX = block.x + block.w - 1;
            if (rightX >= 0 && rightX < S) {
                const t = this.getTile(rightX, py, 0);
                if (!t.isRoad) this.setTile(rightX, py, { ...chainFence }, 0);
            }
        }
        
        // Gate openings on each side
        const gx = block.x + Math.floor(block.w / 2);
        const gy = block.y + Math.floor(block.h / 2);
        if (gx < S && block.y >= 0 && block.y < S) this.setTile(gx, block.y, this.generateCleanTerrain(gx, block.y, biome), 0);
        if (gx < S && block.y + block.h - 1 < S) this.setTile(gx, block.y + block.h - 1, this.generateCleanTerrain(gx, block.y + block.h - 1, biome), 0);
        if (gy < S && block.x >= 0 && block.x < S) this.setTile(block.x, gy, this.generateCleanTerrain(block.x, gy, biome), 0);
        if (gy < S && block.x + block.w - 1 < S) this.setTile(block.x + block.w - 1, gy, this.generateCleanTerrain(block.x + block.w - 1, gy, biome), 0);
        
        // Warehouse(s) inside
        const margin = 3;
        const iX = block.x + margin;
        const iY = block.y + margin;
        const iW = block.w - margin * 2;
        const iH = block.h - margin * 2;
        
        if (iW >= 12 && iH >= 12) {
            if (iW > 30 && this.rng() < 0.6) {
                const w1 = Math.floor(iW / 2) - 1;
                const w2 = iW - w1 - 2;
                if (this.canPlaceBuildingAt(iX, iY, w1, iH))
                    this.placeBuilding(iX, iY, w1, iH, biome, 'horizontal', 1);
                if (this.canPlaceBuildingAt(iX + w1 + 2, iY, w2, iH))
                    this.placeBuilding(iX + w1 + 2, iY, w2, iH, biome, 'horizontal', 1);
            } else {
                if (this.canPlaceBuildingAt(iX, iY, iW, iH))
                    this.placeBuilding(iX, iY, iW, iH, biome, 'horizontal', 1);
            }
        }
    }
    
    // --- Slum: dense small shacks packed tightly ---
    fillSlumBlock(block, biome) {
        const shackSizes = [
            { w: 6, h: 6 }, { w: 7, h: 6 }, { w: 8, h: 7 },
            { w: 6, h: 8 }, { w: 8, h: 8 }
        ];
        
        let placed = 0;
        const maxAttempts = 40;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const size = shackSizes[Math.floor(this.rng() * shackSizes.length)];
            const bx = block.x + 1 + Math.floor(this.rng() * Math.max(1, block.w - size.w - 2));
            const by = block.y + 1 + Math.floor(this.rng() * Math.max(1, block.h - size.h - 2));
            
            if (bx >= 0 && by >= 0 && bx + size.w < this.size && by + size.h < this.size) {
                if (this.canPlaceBuildingAt(bx, by, size.w, size.h)) {
                    // Orient door toward nearest block edge (road)
                    const dTop = by - block.y;
                    const dBot = (block.y + block.h) - (by + size.h);
                    const dLeft = bx - block.x;
                    const dRight = (block.x + block.w) - (bx + size.w);
                    const minD = Math.min(dTop, dBot, dLeft, dRight);
                    let rd, rs;
                    if (minD === dTop) { rd = 'horizontal'; rs = 1; }
                    else if (minD === dBot) { rd = 'horizontal'; rs = -1; }
                    else if (minD === dLeft) { rd = 'vertical'; rs = 1; }
                    else { rd = 'vertical'; rs = -1; }
                    this.placeBuilding(bx, by, size.w, size.h, biome, rd, rs);
                    placed++;
                }
            }
        }
    }
    
    // --- Estate: large mansion centered, perimeter fence, garden ---
    fillEstateBlock(block, biome) {
        const S = this.size;
        const mansionW = Math.min(block.w - 8, 18 + Math.floor(this.rng() * 6));
        const mansionH = Math.min(block.h - 8, 14 + Math.floor(this.rng() * 6));
        
        if (mansionW < 10 || mansionH < 10) return;
        
        const mx = block.x + Math.floor((block.w - mansionW) / 2);
        const my = block.y + Math.floor((block.h - mansionH) / 2);
        
        if (mx >= 0 && my >= 0 && mx + mansionW < S && my + mansionH < S &&
            this.canPlaceBuildingAt(mx, my, mansionW, mansionH)) {
            this.placeBuilding(mx, my, mansionW, mansionH, biome, 'horizontal', 1);
        }
        
        // Ornamental fence around block perimeter
        const fenceTile = { glyph: '|', fgColor: '#f5f5dc', bgColor: null, blocked: true, isWall: true, name: 'Iron Fence' };
        const fx = block.x + 1;
        const fy = block.y + 1;
        const fw = block.w - 2;
        const fh = block.h - 2;
        
        for (let px = fx; px < fx + fw && px < S; px++) {
            if (fy >= 0 && fy < S) {
                const t = this.getTile(px, fy, 0);
                if (!t.isRoad && !t.isWall && t.name !== 'Floor') this.setTile(px, fy, { ...fenceTile, bgColor: t.bgColor }, 0);
            }
            if (fy + fh - 1 >= 0 && fy + fh - 1 < S) {
                const t = this.getTile(px, fy + fh - 1, 0);
                if (!t.isRoad && !t.isWall && t.name !== 'Floor') this.setTile(px, fy + fh - 1, { ...fenceTile, bgColor: t.bgColor }, 0);
            }
        }
        for (let py = fy; py < fy + fh && py < S; py++) {
            if (fx >= 0 && fx < S) {
                const t = this.getTile(fx, py, 0);
                if (!t.isRoad && !t.isWall && t.name !== 'Floor') this.setTile(fx, py, { ...fenceTile, bgColor: t.bgColor }, 0);
            }
            if (fx + fw - 1 >= 0 && fx + fw - 1 < S) {
                const t = this.getTile(fx + fw - 1, py, 0);
                if (!t.isRoad && !t.isWall && t.name !== 'Floor') this.setTile(fx + fw - 1, py, { ...fenceTile, bgColor: t.bgColor }, 0);
            }
        }
        
        // Gate openings
        const gateX = block.x + Math.floor(block.w / 2);
        if (fy >= 0 && fy < S && gateX < S)
            this.setTile(gateX, fy, this.generateCleanTerrain(gateX, fy, biome), 0);
        if (fy + fh - 1 < S && gateX < S)
            this.setTile(gateX, fy + fh - 1, this.generateCleanTerrain(gateX, fy + fh - 1, biome), 0);
        
        // Pool in yard
        if (block.w > 20 && block.h > 20 && this.rng() < 0.6) {
            const poolTile = { glyph: '~', fgColor: '#4488cc', bgColor: '#0a1a2a', blocked: true, name: 'Pool' };
            const poolX = mx + mansionW + 2;
            const poolY = my + 2;
            const poolW = Math.min(5, block.x + block.w - poolX - 3);
            const poolH = Math.min(4, mansionH - 4);
            if (poolW >= 3 && poolH >= 3 && poolX + poolW < S && poolY + poolH < S) {
                for (let py = poolY; py < poolY + poolH; py++) {
                    for (let px = poolX; px < poolX + poolW; px++) {
                        const t = this.getTile(px, py, 0);
                        if (!t.isWall && t.name !== 'Floor')
                            this.setTile(px, py, { ...poolTile }, 0);
                    }
                }
            }
        }
    }
    
    // --- Rural: sparse, maybe one small building ---
    fillRuralBlock(block, biome) {
        if (block.w < 12 || block.h < 12) return;
        if (this.rng() < 0.4) return;
        
        const bw = 8 + Math.floor(this.rng() * 6);
        const bh = 8 + Math.floor(this.rng() * 4);
        const bx = block.x + 2 + Math.floor(this.rng() * Math.max(1, block.w - bw - 4));
        const by = block.y + 2 + Math.floor(this.rng() * Math.max(1, block.h - bh - 4));
        
        if (bx >= 0 && by >= 0 && bx + bw < this.size && by + bh < this.size &&
            this.canPlaceBuildingAt(bx, by, bw, bh)) {
            this.placeBuilding(bx, by, bw, bh, biome, 'horizontal', 1);
        }
    }
    
    // --- Ruins: broken buildings scattered ---
    fillRuinsBlock(block, biome) {
        const wallTile = { glyph: '▓', fgColor: '#888888', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Crumbling Wall' };
        const floorTile = { glyph: '.', fgColor: '#aaaaaa', bgColor: '#2a2a2a', blocked: false, name: 'Floor', spriteData: { sheet: 'ground', index: 20 } };
        
        const numBuildings = 1 + Math.floor(this.rng() * 3);
        for (let i = 0; i < numBuildings; i++) {
            const bw = 8 + Math.floor(this.rng() * 10);
            const bh = 8 + Math.floor(this.rng() * 8);
            const bx = block.x + 2 + Math.floor(this.rng() * Math.max(1, block.w - bw - 4));
            const by = block.y + 2 + Math.floor(this.rng() * Math.max(1, block.h - bh - 4));
            
            if (bx >= 0 && by >= 0 && bx + bw < this.size && by + bh < this.size &&
                this.canPlaceBuildingAt(bx, by, bw, bh)) {
                if (this.rng() < 0.6) {
                    this.placeIrregularBuilding(bx, by, bw, bh, wallTile, floorTile);
                } else {
                    this.placeBuilding(bx, by, bw, bh, biome, 'horizontal', this.rng() < 0.5 ? 1 : -1);
                }
            }
        }
    }
    
    // === STREET DETAIL PASS ===
    // Adds micro-detail that makes urban areas feel alive: street furniture,
    // alley clutter, ground variation. Runs after block filling.
    
    addStreetDetail(biome, district) {
        if (biome === 'forest' || biome === 'rural') return;
        
        const S = this.size;
        const isUrban = (biome === 'urban_core');
        const isSlum = (district === 'slum');
        
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const tile = this.getTile(x, y, 0);
                const worldX = this.cx * S + x;
                const worldY = this.cy * S + y;
                
                // --- SIDEWALK FURNITURE ---
                if (tile.name === 'Sidewalk' || tile.name === 'Walkway') {
                    // Only place on outer edge (side facing block interior, not road)
                    let outerEdge = false;
                    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= S || ny < 0 || ny >= S) continue;
                        const adj = this.getTile(nx, ny, 0);
                        if (adj && !adj.isRoad && adj.name !== 'Sidewalk' && adj.name !== 'Walkway' && !adj.isWall) {
                            outerEdge = true;
                            break;
                        }
                    }
                    if (!outerEdge) continue;
                    
                    const h = Math.abs((worldX * 73856093 ^ worldY * 19349663) | 0) % 1000;
                    
                    if (isUrban) {
                        if (h < 30) {
                            this.setTile(x, y, { glyph: '!', fgColor: '#ffdd44', bgColor: '#1a1a1a', blocked: true, name: 'Streetlight' }, 0);
                        } else if (h < 40) {
                            this.setTile(x, y, { glyph: '▪', fgColor: '#cc2200', bgColor: '#1a1a1a', blocked: true, name: 'Fire Hydrant' }, 0);
                        } else if (h < 60) {
                            this.setTile(x, y, { glyph: '─', fgColor: '#8b7355', bgColor: '#1a1a1a', blocked: false, name: 'Bench' }, 0);
                        } else if (h < 80) {
                            this.setTile(x, y, { glyph: '○', fgColor: '#666666', bgColor: '#1a1a1a', blocked: true, name: 'Trash Can' }, 0);
                        } else if (h < 95 && district === 'downtown') {
                            this.setTile(x, y, { glyph: '♠', fgColor: '#228b22', bgColor: '#1a1a1a', blocked: true, name: 'Street Planter' }, 0);
                        } else if (h < 95 && district === 'shopping') {
                            this.setTile(x, y, { glyph: '▫', fgColor: '#4488ff', bgColor: '#1a1a1a', blocked: true, name: 'Newspaper Box' }, 0);
                        } else if (h < 90 && isSlum) {
                            this.setTile(x, y, { glyph: '%', fgColor: '#664422', bgColor: '#1a1a1a', blocked: false, name: 'Trash Pile' }, 0);
                        }
                    } else if (biome === 'suburbs' || biome === 'rich_neighborhood') {
                        if (h < 20) {
                            this.setTile(x, y, { glyph: '!', fgColor: '#ffdd44', bgColor: tile.bgColor, blocked: true, name: 'Streetlight' }, 0);
                        } else if (h < 28) {
                            this.setTile(x, y, { glyph: '▪', fgColor: '#cc2200', bgColor: tile.bgColor, blocked: true, name: 'Fire Hydrant' }, 0);
                        } else if (h < 38 && biome === 'rich_neighborhood') {
                            this.setTile(x, y, { glyph: '♠', fgColor: '#228b22', bgColor: tile.bgColor, blocked: true, name: 'Street Planter' }, 0);
                        }
                    } else if (biome === 'industrial') {
                        if (h < 15) {
                            this.setTile(x, y, { glyph: '!', fgColor: '#ffaa22', bgColor: '#0a0a0a', blocked: true, name: 'Sodium Light' }, 0);
                        }
                    }
                }
                
                // --- ALLEY CLUTTER ---
                if (tile.name === 'Alley' || tile.name === 'Service Road' || tile.name === 'Rubble Path') {
                    let nearWall = false;
                    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < 0 || nx >= S || ny < 0 || ny >= S) continue;
                        const adj = this.getTile(nx, ny, 0);
                        if (adj && adj.isWall) { nearWall = true; break; }
                    }
                    
                    const h = Math.abs((worldX * 48611 ^ worldY * 96769) | 0) % 1000;
                    const clutterMult = isSlum ? 2.0 : 1.0;
                    
                    if (nearWall) {
                        if (h < 30 * clutterMult) {
                            this.setTile(x, y, { glyph: '■', fgColor: '#336633', bgColor: '#0a0a0a', blocked: true, name: 'Dumpster' }, 0);
                        } else if (h < 55 * clutterMult) {
                            this.setTile(x, y, { glyph: '%', fgColor: '#664422', bgColor: '#0a0a0a', blocked: false, name: 'Trash Pile' }, 0);
                        } else if (h < 65 * clutterMult && isSlum) {
                            this.setTile(x, y, { glyph: '□', fgColor: '#555555', bgColor: '#0a0a0a', blocked: true, name: 'Crate Stack' }, 0);
                        }
                    } else {
                        if (h < 20) {
                            this.setTile(x, y, { glyph: '~', fgColor: '#334455', bgColor: '#060808', blocked: false, name: 'Puddle' }, 0);
                        } else if (h < 30 && isSlum) {
                            this.setTile(x, y, { glyph: '%', fgColor: '#553311', bgColor: '#080604', blocked: false, name: 'Debris' }, 0);
                        }
                    }
                }
                
                // --- GROUND VARIATION (paved surfaces only) ---
                if (tile.name === 'Paved Ground' && isUrban) {
                    const h = Math.abs((worldX * 22769 ^ worldY * 61403) | 0) % 1000;
                    
                    if (h < 5) {
                        this.setTile(x, y, { glyph: 'O', fgColor: '#555555', bgColor: '#0f0f0f', blocked: false, name: 'Manhole Cover' }, 0);
                    } else if (h < 12) {
                        this.setTile(x, y, { glyph: '=', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Drain Grate' }, 0);
                    } else if (h < 25 && isSlum) {
                        this.setTile(x, y, { glyph: '.', fgColor: '#333333', bgColor: '#080808', blocked: false, name: 'Cracked Pavement' }, 0);
                    } else if (h < 18) {
                        this.setTile(x, y, { glyph: '.', fgColor: '#555544', bgColor: '#0e0e0c', blocked: false, name: 'Oil Stain' }, 0);
                    }
                }
            }
        }
    }
    
    // === POI GENERATORS ===
    
    generatePark(biome) {
        const S = this.size;
        const rc = this.getRoadConfig(biome);
        
        // Park boundary roads (paths around the edge)
        const margin = 5;
        const pathTile = rc.sidewalkTile || rc.sideStreetTile;
        
        // Perimeter path
        for (let x = margin; x < S - margin; x++) {
            this.setTile(x, margin, { ...pathTile }, 0);
            this.setTile(x, S - margin - 1, { ...pathTile }, 0);
        }
        for (let y = margin; y < S - margin; y++) {
            this.setTile(margin, y, { ...pathTile }, 0);
            this.setTile(S - margin - 1, y, { ...pathTile }, 0);
        }
        
        // Cross paths through center
        const midX = Math.floor(S / 2);
        const midY = Math.floor(S / 2);
        for (let x = margin; x < S - margin; x++) {
            this.setTile(x, midY, { ...pathTile }, 0);
        }
        for (let y = margin; y < S - margin; y++) {
            this.setTile(midX, y, { ...pathTile }, 0);
        }
        
        // Pond in one quadrant
        const pondCX = Math.floor(S * 0.3) + Math.floor(this.rng() * Math.floor(S * 0.4));
        const pondCY = Math.floor(S * 0.3) + Math.floor(this.rng() * Math.floor(S * 0.4));
        const pondR = 6 + Math.floor(this.rng() * 5);
        const waterTile = { glyph: '~', fgColor: '#4488cc', bgColor: '#0a1a2a', blocked: true, name: 'Pond' };
        const shoreTile = { glyph: ',', fgColor: '#8b7355', bgColor: '#0a0805', blocked: false, name: 'Shore' };
        
        for (let dy = -pondR - 1; dy <= pondR + 1; dy++) {
            for (let dx = -pondR - 1; dx <= pondR + 1; dx++) {
                const px = pondCX + dx;
                const py = pondCY + dy;
                if (px < 2 || px >= S - 2 || py < 2 || py >= S - 2) continue;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= pondR) {
                    this.setTile(px, py, { ...waterTile }, 0);
                } else if (dist <= pondR + 1.5) {
                    this.setTile(px, py, { ...shoreTile }, 0);
                }
            }
        }
        
        // Scattered trees (but not on paths or pond)
        const treeTile = { glyph: '♣', fgColor: '#228b22', bgColor: '#0a0f0a', blocked: true, name: 'Tree' };
        const bushTile = { glyph: '♠', fgColor: '#4a6741', bgColor: '#0a0f0a', blocked: false, name: 'Bush' };
        
        for (let y = margin + 1; y < S - margin - 1; y++) {
            for (let x = margin + 1; x < S - margin - 1; x++) {
                const tile = this.getTile(x, y, 0);
                if (tile.name !== 'Suburban Ground' && tile.name !== 'Manicured Ground' && 
                    tile.name !== 'Paved Ground' && tile.name !== 'Dirt Ground' &&
                    tile.name !== 'Forest Floor' && tile.name !== 'Cracked Floor') continue;
                
                const r = this.rng();
                if (r < 0.08) {
                    this.setTile(x, y, { ...treeTile }, 0);
                } else if (r < 0.12) {
                    this.setTile(x, y, { ...bushTile }, 0);
                }
            }
        }
    }
    
    generateLake(biome) {
        const S = this.size;
        
        const lakeCX = Math.floor(S * 0.35) + Math.floor(this.rng() * Math.floor(S * 0.3));
        const lakeCY = Math.floor(S * 0.35) + Math.floor(this.rng() * Math.floor(S * 0.3));
        const lakeRX = 20 + Math.floor(this.rng() * 15); // Horizontal radius
        const lakeRY = 15 + Math.floor(this.rng() * 12); // Vertical radius (elliptical)
        
        const waterTile = { glyph: '~', fgColor: '#3366aa', bgColor: '#0a1525', blocked: true, name: 'Lake' };
        const shoreTile = { glyph: ',', fgColor: '#8b7355', bgColor: '#0a0805', blocked: false, name: 'Shore' };
        
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const dx = x - lakeCX;
                const dy = y - lakeCY;
                const dist = Math.sqrt((dx * dx) / (lakeRX * lakeRX) + (dy * dy) / (lakeRY * lakeRY));
                if (dist <= 1.0) {
                    this.setTile(x, y, { ...waterTile }, 0);
                } else if (dist <= 1.15) {
                    this.setTile(x, y, { ...shoreTile }, 0);
                }
            }
        }
        
        // Pier extending into lake
        const pierX = lakeCX + Math.floor(this.rng() * 6) - 3;
        const pierStartY = lakeCY + lakeRY - 2;
        const pierTile = { glyph: '=', fgColor: '#8b6914', bgColor: '#2a1a0a', blocked: false, name: 'Wooden Pier' };
        for (let y = pierStartY; y > pierStartY - 10 && y >= lakeCY - lakeRY + 3; y--) {
            if (pierX >= 0 && pierX < S && y >= 0 && y < S) {
                this.setTile(pierX, y, { ...pierTile }, 0);
            }
        }
        
        // Dense trees around shoreline
        const treeTile = { glyph: '♣', fgColor: '#228b22', bgColor: '#0a0f0a', blocked: true, name: 'Tree' };
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const tile = this.getTile(x, y, 0);
                if (tile.blocked || tile.name === 'Shore' || tile.name === 'Wooden Pier') continue;
                if (tile.name.includes('Lake')) continue;
                if (this.rng() < 0.12) {
                    this.setTile(x, y, { ...treeTile }, 0);
                }
            }
        }
    }
    
    generatePlaza(biome) {
        const S = this.size;
        const rc = this.getRoadConfig(biome);
        
        // Step 1: Generate standard road grid first
        this.generateRoadNetwork(biome);
        
        // Step 2: Carve out plaza in center, overlaying roads
        const plazaSize = 20 + Math.floor(this.rng() * 15);
        const plazaX = Math.floor((S - plazaSize) / 2);
        const plazaY = Math.floor((S - plazaSize) / 2);
        
        const plazaTile = { glyph: '·', fgColor: '#999999', bgColor: '#1a1a1a', blocked: false, name: 'Plaza Stone', spriteData: { sheet: 'ground', index: 3 } };
        
        for (let y = plazaY; y < plazaY + plazaSize; y++) {
            for (let x = plazaX; x < plazaX + plazaSize; x++) {
                this.setTile(x, y, { ...plazaTile }, 0);
            }
        }
        
        // Fountain in center
        const fountainX = plazaX + Math.floor(plazaSize / 2);
        const fountainY = plazaY + Math.floor(plazaSize / 2);
        const fountainTile = { glyph: '≈', fgColor: '#4488cc', bgColor: '#1a1a2a', blocked: true, name: 'Fountain' };
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                this.setTile(fountainX + dx, fountainY + dy, { ...fountainTile }, 0);
            }
        }
        
        // Benches around fountain
        const benchTile = { glyph: '=', fgColor: '#8b6914', bgColor: '#1a1a1a', blocked: true, name: 'Bench' };
        for (const [dx, dy] of [[-3,0],[3,0],[0,-3],[0,3]]) {
            this.setTile(fountainX + dx, fountainY + dy, { ...benchTile }, 0);
        }
        
        // Step 3: Filter out blocks that overlap the plaza, fill the rest
        if (this.blocks) {
            this.blocks = this.blocks.filter(block => {
                const bx2 = block.x + block.w;
                const by2 = block.y + block.h;
                const overlapsPlaza = block.x < plazaX + plazaSize && bx2 > plazaX &&
                                     block.y < plazaY + plazaSize && by2 > plazaY;
                return !overlapsPlaza;
            });
            
            // Fill surrounding blocks as downtown/shopping mix
            this.fillBlocks(biome, 'downtown');
        }
        
        this.addStreetDetail(biome, 'plaza');
        this.addObstaclesAndDebris(biome);
    }
    
    generateRuinsCluster(biome) {
        const S = this.size;
        const rc = this.getRoadConfig(biome);
        
        // Broken roads
        if (this.rng() < 0.5) {
            const roadY = Math.floor(S * 0.3) + Math.floor(this.rng() * Math.floor(S * 0.4));
            this.createHorizontalRoad(0, S - 1, roadY, rc.mainRoadTile, rc.mainWidth, 'main');
        }
        
        // Scatter rubble buildings (irregular shapes)
        const wallTile = { glyph: '▓', fgColor: '#888888', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Crumbling Wall' };
        const floorTile = { glyph: '.', fgColor: '#aaaaaa', bgColor: '#2a2a2a', blocked: false, name: 'Floor', spriteData: { sheet: 'ground', index: 20 } };
        
        const numRuins = 4 + Math.floor(this.rng() * 4);
        for (let i = 0; i < numRuins; i++) {
            const rx = 10 + Math.floor(this.rng() * (S - 30));
            const ry = 10 + Math.floor(this.rng() * (S - 30));
            const rw = 8 + Math.floor(this.rng() * 10);
            const rh = 8 + Math.floor(this.rng() * 10);
            
            if (this.canPlaceBuildingAt(rx, ry, rw, rh)) {
                this.placeIrregularBuilding(rx, ry, rw, rh, wallTile, floorTile);
            }
        }
        
        // Heavy debris
        this.addObstaclesAndDebris(biome);
    }
    
    // District-specific feature placement (yards, fences, parking lots, etc.)
    generateDistrictFeatures(biome, district) {
        const S = this.size;
        
        switch (district) {
            case 'downtown': {
                // Burned-out / abandoned vehicles on roads (2-4 per chunk)
                const numVehicles = 2 + Math.floor(this.rng() * 3);
                for (let i = 0; i < numVehicles; i++) {
                    const vx = 8 + Math.floor(this.rng() * (S - 16));
                    const vy = 8 + Math.floor(this.rng() * (S - 16));
                    const t = this.getTile(vx, vy, 0);
                    if (t.isRoad && !t.blocked) {
                        const isHoriz = this.rng() < 0.5;
                        // Place 2x1 or 1x2 vehicle hull
                        this.setTile(vx, vy, { glyph: 'Ω', fgColor: '#886644', bgColor: t.bgColor, blocked: true, name: 'Abandoned Car' }, 0);
                        const vx2 = isHoriz ? vx + 1 : vx;
                        const vy2 = isHoriz ? vy : vy + 1;
                        if (vx2 < S && vy2 < S) {
                            const t2 = this.getTile(vx2, vy2, 0);
                            if (t2.isRoad && !t2.blocked) {
                                this.setTile(vx2, vy2, { glyph: 'Ω', fgColor: '#886644', bgColor: t2.bgColor, blocked: true, name: 'Abandoned Car' }, 0);
                            }
                        }
                    }
                }
                
                // Bollards at intersection corners (where sidewalk meets road corners)
                for (let y = 2; y < S - 2; y++) {
                    for (let x = 2; x < S - 2; x++) {
                        const t = this.getTile(x, y, 0);
                        if (t.name !== 'Sidewalk') continue;
                        // Check if this is a corner (road on two perpendicular sides)
                        const roadN = this.getTile(x, y - 1, 0).isRoad;
                        const roadS = this.getTile(x, y + 1, 0).isRoad;
                        const roadE = this.getTile(x + 1, y, 0).isRoad;
                        const roadW = this.getTile(x - 1, y, 0).isRoad;
                        if ((roadN || roadS) && (roadE || roadW)) {
                            this.setTile(x, y, { glyph: '·', fgColor: '#999999', bgColor: '#1a1a1a', blocked: true, name: 'Bollard' }, 0);
                        }
                    }
                }
                break;
            }
            
            case 'slum': {
                // Burned-out cars on roads (more than downtown)
                const numCars = 3 + Math.floor(this.rng() * 4);
                for (let i = 0; i < numCars; i++) {
                    const vx = 5 + Math.floor(this.rng() * (S - 10));
                    const vy = 5 + Math.floor(this.rng() * (S - 10));
                    const t = this.getTile(vx, vy, 0);
                    if ((t.isRoad || t.name === 'Paved Ground') && !t.blocked) {
                        this.setTile(vx, vy, { glyph: 'Ω', fgColor: '#553322', bgColor: '#0a0a0a', blocked: true, name: 'Burned Car' }, 0);
                    }
                }
                
                // Barrel fires (warmth/light sources, scattered)
                const numBarrels = 2 + Math.floor(this.rng() * 3);
                for (let i = 0; i < numBarrels; i++) {
                    const bx = 10 + Math.floor(this.rng() * (S - 20));
                    const by = 10 + Math.floor(this.rng() * (S - 20));
                    const t = this.getTile(bx, by, 0);
                    if (!t.blocked && !t.isRoad && t.name !== 'Floor') {
                        this.setTile(bx, by, { glyph: '*', fgColor: '#ff6600', bgColor: '#1a0a00', blocked: true, name: 'Barrel Fire', lightSource: true, lightRadius: 4, lightColor: '#ff6600' }, 0);
                    }
                }
                
                // Makeshift barricades across some alleys
                const numBarricades = 1 + Math.floor(this.rng() * 3);
                for (let i = 0; i < numBarricades; i++) {
                    const bx = 10 + Math.floor(this.rng() * (S - 20));
                    const by = 10 + Math.floor(this.rng() * (S - 20));
                    const len = 3 + Math.floor(this.rng() * 4);
                    const horiz = this.rng() < 0.5;
                    for (let j = 0; j < len; j++) {
                        const tx = horiz ? bx + j : bx;
                        const ty = horiz ? by : by + j;
                        if (tx >= S || ty >= S) break;
                        const t = this.getTile(tx, ty, 0);
                        if (!t.blocked && !t.isWall && t.name !== 'Floor') {
                            this.setTile(tx, ty, { glyph: '#', fgColor: '#666655', bgColor: '#0a0a0a', blocked: true, isWall: true, name: 'Makeshift Barricade' }, 0);
                        }
                    }
                }
                break;
            }
            
            case 'residential': {
                // Add extra fences around buildings (supplements block filler fences)
                const fenceTile = biome === 'rich_neighborhood' 
                    ? { glyph: '|', fgColor: '#f5f5dc', bgColor: null, blocked: true, name: 'Iron Fence' }
                    : { glyph: '|', fgColor: '#8b7355', bgColor: null, blocked: true, name: 'Wood Fence' };
                
                for (let y = 2; y < S - 2; y++) {
                    for (let x = 2; x < S - 2; x++) {
                        const tile = this.getTile(x, y, 0);
                        if (tile.blocked || tile.name === 'Floor') continue;
                        if (tile.isRoad || tile.name.includes('Sidewalk')) continue;
                        
                        let nearWall = false;
                        for (let dy = -3; dy <= 3 && !nearWall; dy++) {
                            for (let dx = -3; dx <= 3 && !nearWall; dx++) {
                                const adj = this.getTile(x + dx, y + dy, 0);
                                if (adj && adj.isWall) nearWall = true;
                            }
                        }
                        
                        if (nearWall && this.rng() < 0.04) {
                            this.setTile(x, y, { ...fenceTile, bgColor: tile.bgColor }, 0);
                        }
                    }
                }
                break;
            }
            
            case 'shopping': {
                // Shopping carts scattered in parking lots
                for (let y = 2; y < S - 2; y++) {
                    for (let x = 2; x < S - 2; x++) {
                        const t = this.getTile(x, y, 0);
                        if (t.name === 'Parking Lot' && this.rng() < 0.02) {
                            this.setTile(x, y, { glyph: '¤', fgColor: '#999999', bgColor: t.bgColor, blocked: true, name: 'Shopping Cart' }, 0);
                        }
                    }
                }
                break;
            }
            
            case 'estate': {
                // Gardens around mansion (on open ground inside fence)
                const gardenTile = { glyph: '♠', fgColor: '#6b8e23', bgColor: '#0f0f0a', blocked: false, name: 'Garden' };
                for (let y = 2; y < S - 2; y++) {
                    for (let x = 2; x < S - 2; x++) {
                        const t = this.getTile(x, y, 0);
                        if (t.name === 'Manicured Ground' && this.rng() < 0.08) {
                            this.setTile(x, y, { ...gardenTile }, 0);
                        }
                    }
                }
                break;
            }
            
            default:
                break;
        }
    }
    
    createHorizontalRoad(x1, x2, y, roadTile, width, type) {
        const road = { x1, x2, y, width, type, direction: 'horizontal' };
        this.roads.push(road);
        
        const offset = Math.floor(width / 2);
        
        for (let x = x1; x <= x2; x++) {
            for (let dy = -offset; dy <= offset; dy++) {
                const ty = y + dy;
                if (ty >= 0 && ty < this.size) {
                    this.setTile(x, ty, { ...roadTile, isRoad: true }, 0);
                }
            }
        }
        
    }
    
    createVerticalRoad(y1, y2, x, roadTile, width, type) {
        const road = { y1, y2, x, width, type, direction: 'vertical' };
        this.roads.push(road);
        
        const offset = Math.floor(width / 2);
        
        for (let y = y1; y <= y2; y++) {
            for (let dx = -offset; dx <= offset; dx++) {
                const tx = x + dx;
                if (tx >= 0 && tx < this.size) {
                    this.setTile(tx, y, { ...roadTile, isRoad: true }, 0);
                }
            }
        }
        
    }
    
    generateSewerSystem(biome) {
        if (this.roads.length === 0) return;
        
        // Forest and rural don't have sewers - no underground infrastructure
        if (biome === 'forest' || biome === 'rural') {
            return;
        }
        
        
        // Sewer tile configuration
        const sewerFloorTile = { glyph: '=', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Sewer Floor', spriteData: { sheet: 'ground', index: 21 } };
        const sewerWallTile = { glyph: '#', fgColor: '#333333', bgColor: '#0a0a0a', blocked: true, isWall: true, name: 'Sewer Wall' };
        const manholeTile = { glyph: 'O', fgColor: '#ffff00', bgColor: '#0a2a2a', blocked: false, name: 'Manhole Cover', isManhole: true, canDescend: true };
        const ladderTile = { glyph: 'H', fgColor: '#888888', bgColor: '#0a0a0a', blocked: false, name: 'Ladder', isLadder: true, canAscend: true };
        
        // Create sewers under each road
        for (const road of this.roads) {
            if (road.direction === 'horizontal') {
                this.createHorizontalSewer(road.x1, road.x2, road.y, road.width, sewerFloorTile, sewerWallTile, manholeTile, ladderTile);
            } else {
                this.createVerticalSewer(road.y1, road.y2, road.x, road.width, sewerFloorTile, sewerWallTile, manholeTile, ladderTile);
            }
        }
    }
    
    createHorizontalSewer(x1, x2, y, roadWidth, sewerFloor, sewerWall, manhole, ladder) {
        // Sewer tunnel runs under the road
        const sewerWidth = Math.max(2, roadWidth - 1);
        const offset = Math.floor(sewerWidth / 2);
        
        
        let tilesSet = 0;
        // Create sewer tunnel at z=-1
        for (let x = x1; x <= x2; x++) {
            for (let dy = -offset; dy <= offset; dy++) {
                const ty = y + dy;
                if (ty >= 0 && ty < this.size) {
                    // Sewer walls on edges, floor in middle
                    if (dy === -offset || dy === offset) {
                        this.setTile(x, ty, { ...sewerWall }, -1);
                        tilesSet++;
                    } else {
                        this.setTile(x, ty, { ...sewerFloor }, -1);
                        tilesSet++;
                    }
                }
            }
        }
        
        
        // Add rooms and branches at intervals
        let currentX = x1 + 8;
        while (currentX < x2 - 8) {
            const spacing = 15 + Math.floor(this.rng() * 10); // 15-24 tiles between features
            const featureType = this.rng();
            
            if (featureType < 0.4) {
                // Small room (3x3 or 4x4)
                this.createSewerRoom(currentX, y, sewerFloor, sewerWall);
            } else if (featureType < 0.7) {
                // Single-tile branch passage
                this.createSewerBranch(currentX, y, sewerFloor, sewerWall, 'horizontal');
            }
            
            currentX += spacing;
        }
        
        // Place manholes every 24-32 tiles (sparse placement)
        const manholeSpacing = 24 + Math.floor(this.rng() * 9);
        for (let x = x1; x <= x2; x += manholeSpacing) {
            // Manhole on surface
            this.setTile(x, y, { ...manhole }, 0);
            // Ladder underground
            this.setTile(x, y, { ...ladder }, -1);
        }
    }
    
    createVerticalSewer(y1, y2, x, roadWidth, sewerFloor, sewerWall, manhole, ladder) {
        // Sewer tunnel runs under the road
        const sewerWidth = Math.max(2, roadWidth - 1);
        const offset = Math.floor(sewerWidth / 2);
        
        
        let tilesSet = 0;
        // Create sewer tunnel at z=-1
        for (let y = y1; y <= y2; y++) {
            for (let dx = -offset; dx <= offset; dx++) {
                const tx = x + dx;
                if (tx >= 0 && tx < this.size) {
                    // Sewer walls on edges, floor in middle
                    if (dx === -offset || dx === offset) {
                        this.setTile(tx, y, { ...sewerWall }, -1);
                        tilesSet++;
                    } else {
                        this.setTile(tx, y, { ...sewerFloor }, -1);
                        tilesSet++;
                    }
                }
            }
        }
        
        
        // Add rooms and branches at intervals
        let currentY = y1 + 8;
        while (currentY < y2 - 8) {
            const spacing = 15 + Math.floor(this.rng() * 10); // 15-24 tiles between features
            const featureType = this.rng();
            
            if (featureType < 0.4) {
                // Small room (3x3 or 4x4)
                this.createSewerRoom(x, currentY, sewerFloor, sewerWall);
            } else if (featureType < 0.7) {
                // Single-tile branch passage
                this.createSewerBranch(x, currentY, sewerFloor, sewerWall, 'vertical');
            }
            
            currentY += spacing;
        }
        
        // Place manholes every 24-32 tiles (sparse placement)
        const manholeSpacing = 24 + Math.floor(this.rng() * 9);
        for (let y = y1; y <= y2; y += manholeSpacing) {
            // Manhole on surface
            this.setTile(x, y, { ...manhole }, 0);
            // Ladder underground
            this.setTile(x, y, { ...ladder }, -1);
        }
    }
    
    createSewerRoom(centerX, centerY, sewerFloor, sewerWall) {
        // Create a small 3x3 or 4x4 room branching off the main tunnel
        const roomSize = this.rng() < 0.5 ? 3 : 4;
        const side = this.rng() < 0.5 ? 1 : -1; // Which side of tunnel to branch
        
        // Room extends perpendicular to tunnel
        const startX = centerX - Math.floor(roomSize / 2);
        const startY = centerY + (side * 2); // Offset from tunnel
        
        // Create room with walls around edges
        for (let dy = 0; dy < roomSize; dy++) {
            for (let dx = 0; dx < roomSize; dx++) {
                const x = startX + dx;
                const y = startY + (side * dy);
                
                if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
                    // Walls on edges, floor in middle
                    if (dx === 0 || dx === roomSize - 1 || dy === 0 || dy === roomSize - 1) {
                        this.setTile(x, y, { ...sewerWall }, -1);
                    } else {
                        this.setTile(x, y, { ...sewerFloor }, -1);
                    }
                }
            }
        }
        
        // Create doorway connecting to main tunnel
        this.setTile(centerX, centerY + side, { ...sewerFloor }, -1);
    }
    
    createSewerBranch(x, y, sewerFloor, sewerWall, tunnelDirection) {
        // Create a single-tile wide branch passage extending 2-4 tiles
        const branchLength = 2 + Math.floor(this.rng() * 3);
        const side = this.rng() < 0.5 ? 1 : -1;
        
        if (tunnelDirection === 'horizontal') {
            // Branch extends vertically from horizontal tunnel
            for (let i = 1; i <= branchLength; i++) {
                const ty = y + (side * i);
                if (ty >= 0 && ty < this.size) {
                    this.setTile(x, ty, { ...sewerFloor }, -1);
                    // Walls on sides of branch
                    if (x - 1 >= 0) this.setTile(x - 1, ty, { ...sewerWall }, -1);
                    if (x + 1 < this.size) this.setTile(x + 1, ty, { ...sewerWall }, -1);
                }
            }
        } else {
            // Branch extends horizontally from vertical tunnel
            for (let i = 1; i <= branchLength; i++) {
                const tx = x + (side * i);
                if (tx >= 0 && tx < this.size) {
                    this.setTile(tx, y, { ...sewerFloor }, -1);
                    // Walls on sides of branch
                    if (y - 1 >= 0) this.setTile(tx, y - 1, { ...sewerWall }, -1);
                    if (y + 1 < this.size) this.setTile(tx, y + 1, { ...sewerWall }, -1);
                }
            }
        }
    }
    
    generateBuildingsAlongRoads(biome) {
        if (this.roads.length === 0) {
            return;
        }
        
        
        // Place buildings along each road using spacing rules
        for (const road of this.roads) {
            this.placeBuildingsAlongRoad(road, biome);
        }
    }
    
    placeBuildingsAlongRoad(road, biome) {
        // NEW: Spacing-based placement instead of fixed counts
        const minSpacing = 15;
        const maxSpacing = 25;
        const roadOffset = Math.floor(road.width / 2) + 2;
        
        let placedCount = 0;
        let currentPos = minSpacing; // Start with offset from road start
        let side = 1; // Alternate sides: 1 or -1
        
        const roadLength = road.direction === 'horizontal' ? (road.x2 - road.x1) : (road.y2 - road.y1);
        
        
        while (currentPos < roadLength - minSpacing) {
            // Random building size with variety (small, medium, large)
            const sizeRoll = this.rng();
            let width, height;
            
            if (sizeRoll < 0.4) {
                // 40% small buildings (8-12 tiles)
                width = Math.floor(this.rng() * 5) + 8;
                height = Math.floor(this.rng() * 5) + 8;
            } else if (sizeRoll < 0.75) {
                // 35% medium buildings (14-18 tiles)
                width = Math.floor(this.rng() * 5) + 14;
                height = Math.floor(this.rng() * 5) + 14;
            } else {
                // 25% large buildings (20-24 tiles)
                width = Math.floor(this.rng() * 5) + 20;
                height = Math.floor(this.rng() * 5) + 20;
            }
            
            let x, y;
            
            if (road.direction === 'horizontal') {
                // Position along road
                x = Math.floor(road.x1 + currentPos - width / 2);
                
                // Position perpendicular to road
                if (side === 1) {
                    y = road.y + roadOffset + 1; // Below road
                } else {
                    y = road.y - roadOffset - height; // Above road
                }
            } else {
                // Position along road
                y = Math.floor(road.y1 + currentPos - height / 2);
                
                // Position perpendicular to road
                if (side === 1) {
                    x = road.x + roadOffset + 1; // Right of road
                } else {
                    x = road.x - roadOffset - width; // Left of road
                }
            }
            
            // Clamp to valid bounds
            x = Math.floor(Math.max(2, Math.min(x, this.size - width - 2)));
            y = Math.floor(Math.max(2, Math.min(y, this.size - height - 2)));
            
            // Try to place building
            if (x >= 2 && y >= 2 && x + width <= this.size - 2 && y + height <= this.size - 2) {
                if (this.canPlaceBuildingAt(x, y, width, height)) {
                    const placed = this.placeBuilding(x, y, width, height, biome, road.direction, side);
                    if (placed !== false) {
                        placedCount++;
                        // Move past this building plus spacing
                        const buildingLength = road.direction === 'horizontal' ? width : height;
                        currentPos += buildingLength + Math.floor(this.rng() * (maxSpacing - minSpacing + 1)) + minSpacing;
                        
                        // Alternate sides
                        side *= -1;
                    } else {
                        // Failed validation, skip this spot
                        currentPos += minSpacing;
                    }
                } else {
                    // Collision (shouldn't happen on clean terrain), skip this spot
                    currentPos += minSpacing;
                }
            } else {
                // Out of bounds, skip
                currentPos += minSpacing;
            }
        }
        
    }
    
    canPlaceBuildingAt(x, y, width, height, debug = false) {
        // Simplified collision - only check actual building footprint, not buffer
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const tile = this.getTile(x + dx, y + dy, 0);
                if (!tile) {
                    if (debug) console.log(`      Collision at (${x+dx},${y+dy}): Out of bounds`);
                    return false;
                }
                
                // Check for roads (flag-based + name fallback)
                if (tile.isRoad || (tile.name && (
                    tile.name.includes('Road') || 
                    tile.name.includes('Street') || 
                    tile.name.includes('Path') ||
                    tile.name.includes('Trail') ||
                    tile.name.includes('Pavement') ||
                    tile.name.includes('Asphalt') ||
                    tile.name.includes('Sidewalk') ||
                    tile.name.includes('Alley')
                ))) {
                    if (debug) console.log(`      Collision at (${x+dx},${y+dy}): Road tile '${tile.name}'`);
                    return false;
                }
                
                // Check for other buildings
                if (tile.name === 'Floor') {
                    if (debug) console.log(`      Collision at (${x+dx},${y+dy}): Floor from another building`);
                    return false;
                }
                if (tile.name && tile.name.includes('Wall')) {
                    if (debug) console.log(`      Collision at (${x+dx},${y+dy}): Wall '${tile.name}'`);
                    return false;
                }
                if (tile.name === 'Door') {
                    if (debug) console.log(`      Collision at (${x+dx},${y+dy}): Door`);
                    return false;
                }
            }
        }
        return true;
    }
    
    placeBuilding(x, y, width, height, biome, roadDirection = null, roadSide = null) {
        // Determine wall style based on biome
        let wallTile;
        switch(biome) {
            case 'urban_core':
                wallTile = { glyph: '▓', fgColor: '#cccccc', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Glass & Steel Wall' };
                break;
            case 'suburbs':
                wallTile = { glyph: '▓', fgColor: '#d2b48c', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Brick Wall' };
                break;
            case 'industrial':
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Concrete Wall' };
                break;
            case 'rich_neighborhood':
                wallTile = { glyph: '▓', fgColor: '#f5f5dc', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Marble Wall' };
                break;
            case 'rural':
                wallTile = { glyph: '▓', fgColor: '#8b7355', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Wood Wall' };
                break;
            case 'forest':
                wallTile = { glyph: '▓', fgColor: '#654321', bgColor: '#2a2a2a', blocked: true, isWall: true, name: 'Log Wall' };
                break;
            case 'ruins':
                wallTile = { glyph: '▓', fgColor: '#888888', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Crumbling Wall' };
                break;
            default:
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Wall' };
        }
        
        const floorTile = { glyph: '.', fgColor: '#aaaaaa', bgColor: '#2a2a2a', blocked: false, name: 'Floor', spriteData: { sheet: 'ground', index: 20 } };
        
        // Determine which side the door should face to be accessible from the road
        // Prefab doors are on the bottom row, so we need doorSide=2 (bottom)
        // That means: horizontal road + building above road (side=-1), door faces down toward road
        let doorSide = -1; // -1 means no valid orientation for prefabs
        if (roadDirection === 'horizontal' && roadSide === -1) {
            doorSide = 2; // Building above road, door on bottom faces road
        } else if (roadDirection === 'horizontal' && roadSide === 1) {
            doorSide = 0; // Building below road, door on top faces road
        } else if (roadDirection === 'vertical' && roadSide === -1) {
            doorSide = 1; // Building left of road, door on right faces road
        } else if (roadDirection === 'vertical' && roadSide === 1) {
            doorSide = 3; // Building right of road, door on left faces road
        }
        
        // Try to use a prefab first, fall back to procedural rectangles
        // For rotated prefabs, match against both original and swapped dimensions
        let prefab = findMatchingPrefab(width, height, biome, doorSide, this.rng);
        if (!prefab && (doorSide === 1 || doorSide === 3)) {
            // Try matching with swapped width/height for 90° rotations
            prefab = findMatchingPrefab(height, width, biome, doorSide, this.rng);
        }
        if (prefab) {
            // Orient the prefab so its door faces the road
            const oriented = orientPrefab(prefab, doorSide);
            this.placePrefabBuilding(x, y, oriented, biome, wallTile, floorTile);
            
            // Track door positions from oriented prefab (find + characters)
            for (let py = 0; py < oriented.layout.length; py++) {
                const row = oriented.layout[py];
                for (let px = 0; px < row.length; px++) {
                    if (row[px] === '+') {
                        this.buildingDoors.push({ x: x + px, y: y + py });
                    }
                }
            }
            
            // Handle stairs and upper/lower floors from prefab features
            if (prefab.features.hasUpstairs || prefab.features.hasBasement) {
                const stairX = x + Math.floor(this.rng() * (oriented.width - 2)) + 1;
                const stairY = y + Math.floor(this.rng() * (oriented.height - 2)) + 1;
                
                // Find a valid floor tile for stairs
                let foundStair = false;
                for (let radius = 0; radius <= 3 && !foundStair; radius++) {
                    for (let dy = -radius; dy <= radius && !foundStair; dy++) {
                        for (let dx = -radius; dx <= radius && !foundStair; dx++) {
                            const checkX = stairX + dx;
                            const checkY = stairY + dy;
                            const checkTile = this.getTile(checkX, checkY, 0);
                            if (checkTile && checkTile.name === 'Floor' && !checkTile.blocked) {
                                const stairGlyph = (prefab.features.hasUpstairs && prefab.features.hasBasement) ? '≈' : 
                                                   (prefab.features.hasUpstairs ? '<' : '>');
                                const stairTile = {
                                    glyph: stairGlyph,
                                    fgColor: '#ffff00',
                                    bgColor: '#3a3a3a',
                                    blocked: false,
                                    name: 'Staircase',
                                    isStaircase: true,
                                    canAscend: prefab.features.hasUpstairs,
                                    canDescend: prefab.features.hasBasement
                                };
                                this.setTile(checkX, checkY, stairTile, 0);
                                
                                if (prefab.features.hasUpstairs) {
                                    this.generateFloor(x, y, oriented.width, oriented.height, biome, 1, checkX, checkY, false, true);
                                }
                                if (prefab.features.hasBasement) {
                                    this.generateFloor(x, y, oriented.width, oriented.height, biome, -1, checkX, checkY, true, false);
                                }
                                foundStair = true;
                            }
                        }
                    }
                }
            }
            
            return; // Prefab placed successfully, skip procedural generation below
        }
        
        // Fallback: procedural building with shape variety
        const shapeRoll = this.rng();
        if (width >= 14 && height >= 14 && shapeRoll < 0.15) {
            this.placeCourtyardBuilding(x, y, width, height, wallTile, floorTile);
        } else if (width >= 12 && height >= 10 && shapeRoll < 0.35) {
            this.placeLShapedBuilding(x, y, width, height, wallTile, floorTile);
        } else if (width >= 12 && height >= 12 && shapeRoll < 0.50) {
            this.placeTShapedBuilding(x, y, width, height, wallTile, floorTile);
        } else if (biome === 'ruins' && shapeRoll < 0.70) {
            this.placeIrregularBuilding(x, y, width, height, wallTile, floorTile);
        } else {
            this.placeRectangularBuilding(x, y, width, height, wallTile, floorTile);
        }
        
        // Add door facing the road (or random if no road info)
        let procDoorSide;
        if (roadDirection === 'horizontal' && roadSide === 1) {
            procDoorSide = 0; // Building below road → door on top
        } else if (roadDirection === 'horizontal' && roadSide === -1) {
            procDoorSide = 2; // Building above road → door on bottom
        } else if (roadDirection === 'vertical' && roadSide === 1) {
            procDoorSide = 3; // Building right of road → door on left
        } else if (roadDirection === 'vertical' && roadSide === -1) {
            procDoorSide = 1; // Building left of road → door on right
        } else {
            procDoorSide = Math.floor(this.rng() * 4);
        }
        let doorX, doorY;
        let insideX, insideY; // Tile directly inside the door
        
        if (procDoorSide === 0) { // Top
            doorX = x + Math.floor(width / 2);
            doorY = y;
            insideX = doorX;
            insideY = doorY + 1;
        } else if (procDoorSide === 1) { // Right
            doorX = x + width - 1;
            doorY = y + Math.floor(height / 2);
            insideX = doorX - 1;
            insideY = doorY;
        } else if (procDoorSide === 2) { // Bottom
            doorX = x + Math.floor(width / 2);
            doorY = y + height - 1;
            insideX = doorX;
            insideY = doorY - 1;
        } else { // Left
            doorX = x;
            doorY = y + Math.floor(height / 2);
            insideX = doorX + 1;
            insideY = doorY;
        }
        
        // Verify the tile inside the door is a floor
        const insideTile = this.getTile(insideX, insideY, 0);
        if (!insideTile || insideTile.name !== 'Floor') {
            console.warn(`Building at (${x},${y}): Door placement failed validation - no floor inside`);
            return; // Don't place this building
        }
        
        // Create Door object (50% locked for testing)
        try {
            const worldX = this.cx * this.size + doorX;
            const worldY = this.cy * this.size + doorY;
            const isLocked = this.rng() < 0.5; // 50% locked for testing
            
            const door = createDoor('wood_basic', worldX, worldY, 0, isLocked, false);
            
            // Add to world's object list
            if (this.world && this.world.addWorldObject) {
                this.world.addWorldObject(door);
                // Set the door tile in this chunk
                this.setTile(doorX, doorY, { glyph: door.glyph, fgColor: door.fgColor, bgColor: '#3a3a3a', blocked: door.blocked, blocksVision: door.blocksVision, name: door.name, worldObjectId: door.id, spriteData: { sheet: 'objects', index: OBJECT_SPRITE_INDEX.door_closed } }, 0);
            } else {
                console.warn('World.addWorldObject not available, placing simple door tile instead');
                const doorTile = { glyph: '+', fgColor: '#ff8800', bgColor: '#3a3a3a', blocked: false, name: 'Door' };
                this.setTile(doorX, doorY, doorTile, 0);
            }
        } catch (error) {
            console.error('Error creating door:', error);
            // Fallback to simple door tile
            const doorTile = { glyph: '+', fgColor: '#ff8800', bgColor: '#3a3a3a', blocked: false, name: 'Door' };
            this.setTile(doorX, doorY, doorTile, 0);
        }
        
        // Track door position for pathway generation
        this.buildingDoors.push({ x: doorX, y: doorY });
        
        // Add stairs and generate corresponding floors
        const hasUpstairs = this.rng() < 0.8;
        const hasBasement = this.rng() < 0.6; // Basements coexist with sewers (different locations)
        
        // Pick ONE stair position for all floors (will be placed AFTER rooms)
        const stairX = x + Math.floor(this.rng() * (width - 2)) + 1;
        const stairY = y + Math.floor(this.rng() * (height - 2)) + 1;
        
        // Add rooms for all buildings BEFORE placing staircase
        if (width >= 8 && height >= 8) {
            if (width >= 22 && height >= 22) {
                // Large buildings: central corridor with rooms on both sides
                this.generateLargeBuildingRooms(x, y, width, height, wallTile, floorTile, stairX, stairY, doorX, doorY);
            } else if (width >= 14 && height >= 14) {
                // Medium buildings: hallway with multiple rooms
                this.generateSimpleRooms(x, y, width, height, wallTile, floorTile, stairX, stairY, doorX, doorY);
            } else {
                // Small buildings: simple 2-room layout
                this.generateSmallBuildingRooms(x, y, width, height, wallTile, floorTile, stairX, stairY, doorX, doorY);
            }
        }
        
        // NOW place staircase AFTER rooms are generated
        if (hasUpstairs || hasBasement) {
            const stairTile = { 
                glyph: (hasUpstairs && hasBasement) ? '≈' : (hasUpstairs ? '<' : '>'),
                fgColor: '#ffff00', 
                bgColor: '#3a3a3a', 
                blocked: false, 
                name: 'Staircase',
                isStaircase: true,
                canAscend: hasUpstairs,
                canDescend: hasBasement
            };
            // Verify we're placing on a floor tile AFTER rooms are generated
            const currentTile = this.getTile(stairX, stairY, 0);
            if (currentTile && !currentTile.blocked) {
                this.setTile(stairX, stairY, stairTile, 0);
            } else {
                // Staircase position was blocked by room wall, find nearest floor
                let foundFloor = false;
                for (let radius = 1; radius <= 3 && !foundFloor; radius++) {
                    for (let dy = -radius; dy <= radius && !foundFloor; dy++) {
                        for (let dx = -radius; dx <= radius && !foundFloor; dx++) {
                            const checkX = stairX + dx;
                            const checkY = stairY + dy;
                            const checkTile = this.getTile(checkX, checkY, 0);
                            if (checkTile && !checkTile.blocked && checkTile.name === 'Floor') {
                                this.setTile(checkX, checkY, stairTile, 0);
                                foundFloor = true;
                            }
                        }
                    }
                }
            }
        }
        
        // Generate second floor if building has upstairs
        if (hasUpstairs) {
            // Upper floor can go down, and also down to basement if it exists
            this.generateFloor(x, y, width, height, biome, 1, stairX, stairY, false, true);
        }
        
        // Generate basement if building has basement
        if (hasBasement) {
            // Basement can go up, and also up to second floor if it exists
            this.generateFloor(x, y, width, height, biome, -1, stairX, stairY, true, false);
        }
    }
    
    generateSmallBuildingRooms(x, y, width, height, wallTile, floorTile, stairX, stairY, doorX, doorY) {
        // Simple 2-room layout: one wall from exterior to exterior, dividing the space
        const isVerticalDivider = height > width;
        
        if (isVerticalDivider) {
            // Horizontal wall from left exterior to right exterior
            const dividerY = y + Math.floor(height / 2);
            
            for (let dx = 1; dx < width - 1; dx++) {
                const absX = x + dx;
                if (absX === stairX && dividerY === stairY) continue;
                this.setTile(absX, dividerY, { ...wallTile }, 0);
            }
            
            // Doorway in middle
            const doorwayX = x + Math.floor(width / 2);
            this.setTile(doorwayX, dividerY, { ...floorTile }, 0);
        } else {
            // Vertical wall from top exterior to bottom exterior
            const dividerX = x + Math.floor(width / 2);
            
            for (let dy = 1; dy < height - 1; dy++) {
                const absY = y + dy;
                if (dividerX === stairX && absY === stairY) continue;
                this.setTile(dividerX, absY, { ...wallTile }, 0);
            }
            
            // Doorway in middle
            const doorwayY = y + Math.floor(height / 2);
            this.setTile(dividerX, doorwayY, { ...floorTile }, 0);
        }
    }
    
    generateSimpleRooms(x, y, width, height, wallTile, floorTile, stairX, stairY, doorX, doorY) {
        // Simple approach: 2-4 dividing walls with varied spacing
        const numDividers = Math.floor(Math.min(width, height) / 7) + 1;
        
        // Randomly choose to divide vertically or horizontally (or both for larger buildings)
        const divideVertically = this.rng() < 0.5 || width > height;
        const divideHorizontally = this.rng() < 0.5 || height > width;
        
        if (divideVertically && width >= 14) {
            // Vertical walls from top to bottom
            const numVertical = Math.min(numDividers, Math.floor(width / 8));
            
            for (let i = 0; i < numVertical; i++) {
                // Random position with variation
                const basePos = (width / (numVertical + 1)) * (i + 1);
                const variation = Math.floor(this.rng() * 4) - 2;
                const dividerX = Math.floor(x + basePos + variation);
                
                // Skip if too close to entrance door
                if (Math.abs(dividerX - doorX) <= 3) continue;
                
                // Wall from top to bottom
                for (let dy = 1; dy < height - 1; dy++) {
                    const absY = y + dy;
                    if (dividerX === stairX && absY === stairY) continue;
                    // Skip if near entrance - larger protection zone
                    if (Math.abs(dividerX - doorX) <= 2 && Math.abs(absY - doorY) <= 2) continue;
                    this.setTile(dividerX, absY, { ...wallTile }, 0);
                }
                
                // GUARANTEED doorway at varied position - always place it
                let doorwayY = y + Math.floor(height / 2) + Math.floor(this.rng() * 5) - 2;
                // Clamp to valid range to ensure it's always placed
                doorwayY = Math.max(y + 1, Math.min(doorwayY, y + height - 2));
                this.setTile(dividerX, doorwayY, { ...floorTile }, 0);
            }
        }
        
        if (divideHorizontally && height >= 14) {
            // Horizontal walls from left to right
            const numHorizontal = Math.min(numDividers, Math.floor(height / 8));
            
            for (let i = 0; i < numHorizontal; i++) {
                // Random position with variation
                const basePos = (height / (numHorizontal + 1)) * (i + 1);
                const variation = Math.floor(this.rng() * 4) - 2;
                const dividerY = Math.floor(y + basePos + variation);
                
                // Skip if too close to entrance door
                if (Math.abs(dividerY - doorY) <= 3) continue;
                
                // Wall from left to right
                for (let dx = 1; dx < width - 1; dx++) {
                    const absX = x + dx;
                    if (absX === stairX && dividerY === stairY) continue;
                    // Skip if near entrance - larger protection zone
                    if (Math.abs(absX - doorX) <= 2 && Math.abs(dividerY - doorY) <= 2) continue;
                    this.setTile(absX, dividerY, { ...wallTile }, 0);
                }
                
                // GUARANTEED doorway at varied position - always place it
                let doorwayX = x + Math.floor(width / 2) + Math.floor(this.rng() * 5) - 2;
                // Clamp to valid range to ensure it's always placed
                doorwayX = Math.max(x + 1, Math.min(doorwayX, x + width - 2));
                this.setTile(doorwayX, dividerY, { ...floorTile }, 0);
            }
        }
    }
    
    // Large building interior: central corridor with rooms on both sides, lobby at entrance
    generateLargeBuildingRooms(x, y, w, h, wallTile, floorTile, stairX, stairY, doorX, doorY) {
        const iw = { ...wallTile, name: 'Interior Wall' };
        const corridorW = 2;
        
        // Determine door side and corridor orientation
        const doorOnTop = (doorY === y);
        const doorOnBottom = (doorY === y + h - 1);
        const doorOnLeft = (doorX === x);
        const doorOnRight = (doorX === x + w - 1);
        const vertCorridor = doorOnTop || doorOnBottom;
        
        if (vertCorridor) {
            // === VERTICAL CORRIDOR (door on top or bottom) ===
            const cx1 = x + Math.floor(w / 2) - 1; // left edge of corridor
            const cx2 = cx1 + corridorW - 1;        // right edge of corridor
            const lwX = cx1 - 1; // left corridor wall X
            const rwX = cx2 + 1; // right corridor wall X
            
            // Place corridor walls (skip exterior walls and stair)
            for (let cy = y + 1; cy < y + h - 1; cy++) {
                if (lwX > x && !(lwX === stairX && cy === stairY))
                    this.setTile(lwX, cy, { ...iw }, 0);
                if (rwX < x + w - 1 && !(rwX === stairX && cy === stairY))
                    this.setTile(rwX, cy, { ...iw }, 0);
            }
            
            // Lobby: clear corridor walls near entrance (5 tiles deep)
            const lobbyD = Math.min(5, Math.floor(h / 4));
            if (doorOnBottom) {
                for (let ly = y + h - 2; ly >= y + h - 1 - lobbyD && ly > y; ly--) {
                    if (lwX > x) this.setTile(lwX, ly, { ...floorTile, roomType: 'commercial_office' }, 0);
                    if (rwX < x + w - 1) this.setTile(rwX, ly, { ...floorTile, roomType: 'commercial_office' }, 0);
                }
            } else {
                for (let ly = y + 1; ly <= y + lobbyD && ly < y + h - 1; ly++) {
                    if (lwX > x) this.setTile(lwX, ly, { ...floorTile, roomType: 'commercial_office' }, 0);
                    if (rwX < x + w - 1) this.setTile(rwX, ly, { ...floorTile, roomType: 'commercial_office' }, 0);
                }
            }
            
            // Rooms on left side of corridor
            const leftW = lwX - (x + 1);
            if (leftW >= 4) {
                this.subdivideRoomStrip(x + 1, y + 1, leftW, h - 2, 'vertical', lwX, iw, floorTile, stairX, stairY);
            }
            
            // Rooms on right side of corridor
            const rightX = rwX + 1;
            const rightW = (x + w - 1) - rightX;
            if (rightW >= 4) {
                this.subdivideRoomStrip(rightX, y + 1, rightW, h - 2, 'vertical', rwX, iw, floorTile, stairX, stairY);
            }
        } else {
            // === HORIZONTAL CORRIDOR (door on left or right) ===
            const cy1 = y + Math.floor(h / 2) - 1;
            const cy2 = cy1 + corridorW - 1;
            const twY = cy1 - 1; // top corridor wall Y
            const bwY = cy2 + 1; // bottom corridor wall Y
            
            for (let cx = x + 1; cx < x + w - 1; cx++) {
                if (twY > y && !(cx === stairX && twY === stairY))
                    this.setTile(cx, twY, { ...iw }, 0);
                if (bwY < y + h - 1 && !(cx === stairX && bwY === stairY))
                    this.setTile(cx, bwY, { ...iw }, 0);
            }
            
            // Lobby near entrance
            const lobbyD = Math.min(5, Math.floor(w / 4));
            if (doorOnRight) {
                for (let lx = x + w - 2; lx >= x + w - 1 - lobbyD && lx > x; lx--) {
                    if (twY > y) this.setTile(lx, twY, { ...floorTile, roomType: 'commercial_office' }, 0);
                    if (bwY < y + h - 1) this.setTile(lx, bwY, { ...floorTile, roomType: 'commercial_office' }, 0);
                }
            } else {
                for (let lx = x + 1; lx <= x + lobbyD && lx < x + w - 1; lx++) {
                    if (twY > y) this.setTile(lx, twY, { ...floorTile, roomType: 'commercial_office' }, 0);
                    if (bwY < y + h - 1) this.setTile(lx, bwY, { ...floorTile, roomType: 'commercial_office' }, 0);
                }
            }
            
            // Rooms on top side
            const topH = twY - (y + 1);
            if (topH >= 4) {
                this.subdivideRoomStrip(x + 1, y + 1, w - 2, topH, 'horizontal', twY, iw, floorTile, stairX, stairY);
            }
            
            // Rooms on bottom side
            const botY = bwY + 1;
            const botH = (y + h - 1) - botY;
            if (botH >= 4) {
                this.subdivideRoomStrip(x + 1, botY, w - 2, botH, 'horizontal', bwY, iw, floorTile, stairX, stairY);
            }
        }
    }
    
    // Subdivide a strip of space into rooms along the corridor
    // stripDir: 'vertical' = rooms stacked N-S (corridor is vertical), walls are horizontal
    //           'horizontal' = rooms stacked E-W (corridor is horizontal), walls are vertical
    // corridorWallPos: X or Y of the corridor wall where doors go
    subdivideRoomStrip(sx, sy, sw, sh, stripDir, corridorWallPos, wallTile, floorTile, stairX, stairY) {
        const minRoom = 5;
        const maxRoom = 10;
        const roomTypes = ['commercial_office', 'commercial_office', 'commercial_office', 'commercial_storage', 'residential_bathroom'];
        let roomIdx = 0;
        
        if (stripDir === 'vertical') {
            // Rooms divided by horizontal walls
            let curY = sy;
            while (curY + minRoom <= sy + sh) {
                const remaining = sy + sh - curY;
                let roomH;
                if (remaining < minRoom * 2) {
                    roomH = remaining;
                } else {
                    roomH = minRoom + Math.floor(this.rng() * (maxRoom - minRoom));
                    roomH = Math.min(roomH, remaining - minRoom);
                }
                
                // Horizontal dividing wall at the bottom of this room
                const wallY = curY + roomH;
                if (wallY < sy + sh) {
                    for (let wx = sx; wx < sx + sw; wx++) {
                        if (wx === stairX && wallY === stairY) continue;
                        this.setTile(wx, wallY, { ...wallTile }, 0);
                    }
                }
                
                // Tag room floor tiles with room type
                const rType = roomTypes[roomIdx % roomTypes.length];
                for (let ry = curY; ry < curY + roomH && ry < sy + sh; ry++) {
                    for (let rx = sx; rx < sx + sw; rx++) {
                        const t = this.getTile(rx, ry, 0);
                        if (t && t.name === 'Floor' && !t.blocked) {
                            t.roomType = rType;
                        }
                    }
                }
                
                // Door connecting room to corridor
                const doorY = curY + Math.floor(roomH / 2);
                if (doorY >= sy && doorY < sy + sh) {
                    this.setTile(corridorWallPos, doorY, { ...floorTile }, 0);
                }
                
                roomIdx++;
                curY = wallY + 1;
            }
        } else {
            // Rooms divided by vertical walls
            let curX = sx;
            while (curX + minRoom <= sx + sw) {
                const remaining = sx + sw - curX;
                let roomW;
                if (remaining < minRoom * 2) {
                    roomW = remaining;
                } else {
                    roomW = minRoom + Math.floor(this.rng() * (maxRoom - minRoom));
                    roomW = Math.min(roomW, remaining - minRoom);
                }
                
                // Vertical dividing wall
                const wallX = curX + roomW;
                if (wallX < sx + sw) {
                    for (let wy = sy; wy < sy + sh; wy++) {
                        if (wallX === stairX && wy === stairY) continue;
                        this.setTile(wallX, wy, { ...wallTile }, 0);
                    }
                }
                
                // Tag room floor tiles
                const rType = roomTypes[roomIdx % roomTypes.length];
                for (let ry = sy; ry < sy + sh; ry++) {
                    for (let rx = curX; rx < curX + roomW && rx < sx + sw; rx++) {
                        const t = this.getTile(rx, ry, 0);
                        if (t && t.name === 'Floor' && !t.blocked) {
                            t.roomType = rType;
                        }
                    }
                }
                
                // Door connecting room to corridor
                const doorX = curX + Math.floor(roomW / 2);
                if (doorX >= sx && doorX < sx + sw) {
                    this.setTile(doorX, corridorWallPos, { ...floorTile }, 0);
                }
                
                roomIdx++;
                curX = wallX + 1;
            }
        }
    }
    
    generateFloor(x, y, width, height, biome, z, stairX, stairY, canAscend, canDescend) {
        // Generate walls and floors for this z-level
        let wallTile;
        switch(biome) {
            case 'urban_core':
                wallTile = { glyph: '▓', fgColor: '#cccccc', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Glass & Steel Wall' };
                break;
            case 'suburbs':
                wallTile = { glyph: '▓', fgColor: '#d2b48c', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Brick Wall' };
                break;
            case 'industrial':
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Concrete Wall' };
                break;
            case 'rich_neighborhood':
                wallTile = { glyph: '▓', fgColor: '#f5f5dc', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Marble Wall' };
                break;
            case 'rural':
                wallTile = { glyph: '▓', fgColor: '#8b7355', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Wood Wall' };
                break;
            case 'forest':
                wallTile = { glyph: '▓', fgColor: '#654321', bgColor: '#2a2a2a', blocked: true, isWall: true, name: 'Log Wall' };
                break;
            case 'ruins':
                wallTile = { glyph: '▓', fgColor: '#888888', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Crumbling Wall' };
                break;
            default:
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, isWall: true, name: 'Wall' };
        }
        
        const floorTile = { glyph: '.', fgColor: '#aaaaaa', bgColor: '#2a2a2a', blocked: false, name: 'Floor', spriteData: { sheet: 'ground', index: 20 } };
        
        // Place walls and floors
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1) {
                    this.setTile(x + dx, y + dy, { ...wallTile }, z);
                } else {
                    this.setTile(x + dx, y + dy, { ...floorTile }, z);
                }
            }
        }
        
        // Place bidirectional stairs at the same position
        let glyph;
        if (canAscend && canDescend) {
            glyph = '≈'; // Both directions
        } else if (canAscend) {
            glyph = '<'; // Up only
        } else {
            glyph = '>'; // Down only
        }
        
        const stairTile = {
            glyph: glyph,
            fgColor: '#ffff00',
            bgColor: '#2a2a2a',
            blocked: false,
            name: 'Staircase',
            isStaircase: true,
            canAscend: canAscend,
            canDescend: canDescend
        };
        this.setTile(stairX, stairY, stairTile, z);
    }
    
    placePrefabBuilding(x, y, prefab, biome, wallTile, floorTile) {
        const doorTypes = BIOME_DOOR_TYPES[biome] || BIOME_DOOR_TYPES.suburbs;
        const lockChance = prefab.features.lockChance || 0.5;
        
        // Interior wall uses same style but different name
        const interiorWallTile = { ...wallTile, name: 'Interior Wall' };
        
        for (let py = 0; py < prefab.layout.length; py++) {
            const row = prefab.layout[py];
            for (let px = 0; px < row.length; px++) {
                const char = row[px];
                const tileX = x + px;
                const tileY = y + py;
                
                switch (char) {
                    case '#': // Exterior wall
                        this.setTile(tileX, tileY, { ...wallTile }, 0);
                        break;
                    
                    case '|': // Interior wall (vertical)
                    case '-': // Interior wall (horizontal)
                        this.setTile(tileX, tileY, { ...interiorWallTile }, 0);
                        break;
                    
                    case '.': // Floor
                        this.setTile(tileX, tileY, { ...floorTile }, 0);
                        break;
                    
                    case '_': // Open floor next to door (double-wide entrance)
                        this.setTile(tileX, tileY, { ...floorTile }, 0);
                        break;
                    
                    case '+': { // Exterior door (WorldObject)
                        const worldX = this.cx * this.size + tileX;
                        const worldY = this.cy * this.size + tileY;
                        const isLocked = this.rng() < lockChance;
                        
                        try {
                            const door = createDoor(doorTypes.exterior, worldX, worldY, 0, isLocked, false);
                            if (this.world && this.world.addWorldObject) {
                                this.world.addWorldObject(door);
                                this.setTile(tileX, tileY, { glyph: door.glyph, fgColor: door.fgColor, bgColor: '#3a3a3a', blocked: door.blocked, blocksVision: door.blocksVision, name: door.name, worldObjectId: door.id, spriteData: { sheet: 'objects', index: OBJECT_SPRITE_INDEX.door_closed } }, 0);
                            } else {
                                this.setTile(tileX, tileY, { ...floorTile, name: 'Doorway' }, 0);
                            }
                        } catch (error) {
                            console.error('Error creating prefab exterior door:', error);
                            this.setTile(tileX, tileY, { ...floorTile, name: 'Doorway' }, 0);
                        }
                        break;
                    }
                    
                    case 'd': { // Interior door (WorldObject, always unlocked)
                        const worldX = this.cx * this.size + tileX;
                        const worldY = this.cy * this.size + tileY;
                        
                        try {
                            const door = createDoor(doorTypes.interior, worldX, worldY, 0, false, false);
                            if (this.world && this.world.addWorldObject) {
                                this.world.addWorldObject(door);
                                this.setTile(tileX, tileY, { glyph: door.glyph, fgColor: door.fgColor, bgColor: '#3a3a3a', blocked: door.blocked, blocksVision: door.blocksVision, name: door.name, worldObjectId: door.id, spriteData: { sheet: 'objects', index: OBJECT_SPRITE_INDEX.door_closed } }, 0);
                            } else {
                                this.setTile(tileX, tileY, { ...floorTile, name: 'Doorway' }, 0);
                            }
                        } catch (error) {
                            console.error('Error creating prefab interior door:', error);
                            this.setTile(tileX, tileY, { ...floorTile, name: 'Doorway' }, 0);
                        }
                        break;
                    }
                    
                    case '<': { // Stairs up
                        const stairTile = {
                            glyph: '<',
                            fgColor: '#ffff00',
                            bgColor: '#3a3a3a',
                            blocked: false,
                            name: 'Staircase',
                            isStaircase: true,
                            canAscend: true,
                            canDescend: false
                        };
                        this.setTile(tileX, tileY, stairTile, 0);
                        break;
                    }
                    
                    case '>': { // Stairs down
                        const stairTile = {
                            glyph: '>',
                            fgColor: '#ffff00',
                            bgColor: '#3a3a3a',
                            blocked: false,
                            name: 'Staircase',
                            isStaircase: true,
                            canAscend: false,
                            canDescend: true
                        };
                        this.setTile(tileX, tileY, stairTile, 0);
                        break;
                    }
                    
                    case '~': // Skip - leave terrain as-is
                        break;
                    
                    default:
                        // Unknown character, treat as floor
                        this.setTile(tileX, tileY, { ...floorTile }, 0);
                        break;
                }
            }
        }
        
        // Apply loot zone tags to floor tiles
        if (prefab.lootZones) {
            for (const zone of prefab.lootZones) {
                for (let zy = zone.y; zy < zone.y + zone.h; zy++) {
                    for (let zx = zone.x; zx < zone.x + zone.w; zx++) {
                        const tileX = x + zx;
                        const tileY = y + zy;
                        const tile = this.getTile(tileX, tileY, 0);
                        if (tile && !tile.blocked && tile.name === 'Floor') {
                            tile.roomType = zone.type;
                        }
                    }
                }
            }
        }
        
        // Spawn furniture from prefab data
        if (prefab.furnitureSpawns && this.world && this.world.addWorldObject) {
            let furnitureCount = 0;
            for (const spawn of prefab.furnitureSpawns) {
                const tileX = x + spawn.x;
                const tileY = y + spawn.y;
                const tile = this.getTile(tileX, tileY, 0);
                
                // Only place on floor tiles that don't already have a world object
                if (!tile || tile.worldObjectId) continue;
                if (tile.name !== 'Floor') continue;
                
                const worldX = this.cx * this.size + tileX;
                const worldY = this.cy * this.size + tileY;
                
                try {
                    const furniture = createFurniture(spawn.type, worldX, worldY, 0);
                    
                    // Populate storage furniture with items based on room type
                    if (furniture.isContainer && tile.roomType && this.world.game && this.world.game.content) {
                        populateFurniture(furniture, tile.roomType, this.world.game.content);
                    }
                    
                    this.world.addWorldObject(furniture);
                    const spriteIdx = OBJECT_SPRITE_INDEX[spawn.type];
                    this.setTile(tileX, tileY, {
                        glyph: furniture.glyph,
                        fgColor: furniture.fgColor,
                        bgColor: furniture.bgColor || '#3a3a3a',
                        blocked: furniture.blocked,
                        blocksVision: furniture.blocksVision,
                        name: furniture.name,
                        worldObjectId: furniture.id,
                        roomType: tile.roomType,
                        spriteData: spriteIdx !== undefined ? { sheet: 'objects', index: spriteIdx } : null
                    }, 0);
                    furnitureCount++;
                } catch (error) {
                    console.error(`Error creating furniture ${spawn.type} at ${tileX},${tileY}:`, error);
                }
            }
        }
    }
    
    placeRectangularBuilding(x, y, width, height, wallTile, floorTile) {
        // Simple rectangular building
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1) {
                    this.setTile(x + dx, y + dy, { ...wallTile }, 0);
                } else {
                    this.setTile(x + dx, y + dy, { ...floorTile }, 0);
                }
            }
        }
    }
    
    placeLShapedBuilding(x, y, width, height, wallTile, floorTile) {
        // L-shaped building - main rectangle with smaller wing
        const mainWidth = Math.floor(width * 0.7);
        const wingWidth = width - mainWidth;
        const wingHeight = Math.floor(height * 0.6);
        
        // Main section
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < mainWidth; dx++) {
                if (dx === 0 || dx === mainWidth - 1 || dy === 0 || dy === height - 1) {
                    this.setTile(x + dx, y + dy, { ...wallTile }, 0);
                } else {
                    this.setTile(x + dx, y + dy, { ...floorTile }, 0);
                }
            }
        }
        
        // Wing section
        for (let dy = 0; dy < wingHeight; dy++) {
            for (let dx = 0; dx < wingWidth; dx++) {
                if (dx === wingWidth - 1 || dy === 0 || dy === wingHeight - 1) {
                    this.setTile(x + mainWidth + dx, y + dy, { ...wallTile }, 0);
                } else {
                    this.setTile(x + mainWidth + dx, y + dy, { ...floorTile }, 0);
                }
            }
        }
    }
    
    placeTShapedBuilding(x, y, width, height, wallTile, floorTile) {
        // T-shaped building - horizontal bar with vertical stem
        const barHeight = Math.floor(height * 0.4);
        const stemWidth = Math.floor(width * 0.4);
        const stemX = x + Math.floor((width - stemWidth) / 2);
        
        // Horizontal bar (top)
        for (let dy = 0; dy < barHeight; dy++) {
            for (let dx = 0; dx < width; dx++) {
                if (dx === 0 || dx === width - 1 || dy === 0 || dy === barHeight - 1) {
                    this.setTile(x + dx, y + dy, { ...wallTile }, 0);
                } else {
                    this.setTile(x + dx, y + dy, { ...floorTile }, 0);
                }
            }
        }
        
        // Vertical stem (bottom) - connects to bar
        for (let dy = barHeight - 1; dy < height; dy++) {
            for (let dx = 0; dx < stemWidth; dx++) {
                const absX = stemX + dx;
                const absY = y + dy;
                
                // Skip if already placed by bar
                const existingTile = this.getTile(absX, absY, 0);
                if (existingTile && existingTile.name === 'Floor') continue;
                
                if (dx === 0 || dx === stemWidth - 1 || dy === height - 1) {
                    this.setTile(absX, absY, { ...wallTile }, 0);
                } else {
                    this.setTile(absX, absY, { ...floorTile }, 0);
                }
            }
        }
    }
    
    placeCourtyardBuilding(x, y, width, height, wallTile, floorTile) {
        // Building with interior courtyard - only for larger buildings
        if (width < 10 || height < 10) {
            // Too small for courtyard, make regular building
            this.placeRectangularBuilding(x, y, width, height, wallTile, floorTile);
            return;
        }
        
        const courtyardX = x + Math.floor(width * 0.3);
        const courtyardY = y + Math.floor(height * 0.3);
        const courtyardW = Math.floor(width * 0.4);
        const courtyardH = Math.floor(height * 0.4);
        
        // Courtyard tile (open to sky, grass/dirt)
        const courtyardTile = { glyph: ',', fgColor: '#556b2f', bgColor: '#1a1a0a', blocked: false, name: 'Courtyard' };
        
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                const absX = x + dx;
                const absY = y + dy;
                
                // Check if in courtyard area
                const inCourtyard = (absX >= courtyardX && absX < courtyardX + courtyardW &&
                                   absY >= courtyardY && absY < courtyardY + courtyardH);
                
                if (inCourtyard) {
                    // Courtyard interior walls with doorways
                    const isWall = (absX === courtyardX || absX === courtyardX + courtyardW - 1 ||
                                   absY === courtyardY || absY === courtyardY + courtyardH - 1);
                    
                    if (isWall) {
                        // Add doorways on each side of courtyard
                        const midX = courtyardX + Math.floor(courtyardW / 2);
                        const midY = courtyardY + Math.floor(courtyardH / 2);
                        
                        // Doorways: one on each wall of courtyard
                        if ((absY === courtyardY && absX === midX) ||  // Top doorway
                            (absY === courtyardY + courtyardH - 1 && absX === midX) ||  // Bottom doorway
                            (absX === courtyardX && absY === midY) ||  // Left doorway
                            (absX === courtyardX + courtyardW - 1 && absY === midY)) {  // Right doorway
                            // Doorway - place floor
                            this.setTile(absX, absY, { ...floorTile }, 0);
                        } else {
                            // Wall
                            this.setTile(absX, absY, { ...wallTile }, 0);
                        }
                    } else {
                        // Courtyard interior - open space with ground
                        this.setTile(absX, absY, { ...courtyardTile }, 0);
                    }
                } else if (dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1) {
                    // Outer walls
                    this.setTile(absX, absY, { ...wallTile }, 0);
                } else {
                    // Interior floor (rooms around courtyard)
                    this.setTile(absX, absY, { ...floorTile }, 0);
                }
            }
        }
    }
    
    placeIrregularBuilding(x, y, width, height, wallTile, floorTile) {
        // Irregular/damaged building with missing sections
        for (let dy = 0; dy < height; dy++) {
            for (let dx = 0; dx < width; dx++) {
                // Random chance to skip sections (creates irregular shape)
                const skipChance = (dx < 2 || dx >= width - 2 || dy < 2 || dy >= height - 2) ? 0.3 : 0;
                
                if (this.rng() < skipChance) continue;
                
                if (dx === 0 || dx === width - 1 || dy === 0 || dy === height - 1) {
                    this.setTile(x + dx, y + dy, { ...wallTile }, 0);
                } else {
                    this.setTile(x + dx, y + dy, { ...floorTile }, 0);
                }
            }
        }
    }
    
    addBuildingInterior(x, y, width, height, biome, stairX, stairY) {
        // Add furniture and interior features
        const interiorWidth = width - 2;
        const interiorHeight = height - 2;
        
        // Only add furniture to buildings 10x10 or larger to avoid blocking small spaces
        if (width < 10 || height < 10) return;
        if (interiorWidth < 4 || interiorHeight < 4) return;
        
        // Biome-specific furniture
        let furnitureTiles = [];
        if (biome === 'industrial') {
            furnitureTiles = [
                { glyph: '╬', fgColor: '#666666', name: 'Metal Table', chance: 0.15 },
                { glyph: '□', fgColor: '#888888', name: 'Storage Crate', chance: 0.12 },
                { glyph: '▪', fgColor: '#555555', name: 'Machinery', chance: 0.1 },
                { glyph: '║', fgColor: '#777777', name: 'Locker', chance: 0.08 }
            ];
        } else if (biome === 'ruins') {
            furnitureTiles = [
                { glyph: '╬', fgColor: '#8b4513', name: 'Broken Table', chance: 0.12 },
                { glyph: '□', fgColor: '#654321', name: 'Debris Pile', chance: 0.15 },
                { glyph: '▪', fgColor: '#4a3520', name: 'Rubble', chance: 0.18 },
                { glyph: '≈', fgColor: '#3a2a1a', name: 'Collapsed Shelf', chance: 0.1 }
            ];
        } else {
            furnitureTiles = [
                { glyph: '╬', fgColor: '#6b5d47', name: 'Makeshift Table', chance: 0.1 },
                { glyph: '□', fgColor: '#5a4a3a', name: 'Scrap Pile', chance: 0.12 },
                { glyph: '▪', fgColor: '#4a3a2a', name: 'Junk', chance: 0.15 }
            ];
        }
        
        // Place furniture randomly in interior
        for (let dy = 1; dy < height - 1; dy++) {
            for (let dx = 1; dx < width - 1; dx++) {
                const absX = x + dx;
                const absY = y + dy;
                
                // Don't place furniture on stairs
                if (absX === stairX && absY === stairY) continue;
                
                // Get current tile and verify it's a floor tile
                const tile = this.getTile(absX, absY, 0);
                if (!tile) continue;
                
                // ONLY place furniture on floor tiles
                if (tile.name !== 'Floor') continue;
                if (tile.blocked) continue; // Already has something
                if (tile.glyph !== '.') continue; // Not a floor
                
                // Check adjacent tiles to avoid blocking doorways
                let nearDoor = false;
                for (let checkY = absY - 1; checkY <= absY + 1; checkY++) {
                    for (let checkX = absX - 1; checkX <= absX + 1; checkX++) {
                        const adjacentTile = this.getTile(checkX, checkY, 0);
                        if (adjacentTile && adjacentTile.name === 'Door') {
                            nearDoor = true;
                            break;
                        }
                    }
                    if (nearDoor) break;
                }
                if (nearDoor) continue; // Don't block access to doors
                
                // Random chance to place furniture
                for (const furniture of furnitureTiles) {
                    if (this.rng() < furniture.chance) {
                        const furnitureTile = {
                            glyph: furniture.glyph,
                            fgColor: furniture.fgColor,
                            bgColor: '#2a2a2a',
                            blocked: true,
                            name: furniture.name
                        };
                        this.setTile(absX, absY, furnitureTile, 0);
                        break; // Only one furniture per tile
                    }
                }
            }
        }
        
        // Add interior walls to create rooms (30% chance for larger buildings)
        if (width >= 10 && height >= 10 && this.rng() < 0.3) {
            const wallTile = this.getTile(x, y, 0); // Get building's wall type
            
            // Vertical divider
            if (this.rng() < 0.5) {
                const dividerX = x + Math.floor(width / 2);
                const doorwayStart = Math.floor(height / 2) - 1;
                const doorwayEnd = doorwayStart + 2; // 2-tile wide doorway
                
                for (let dy = 1; dy < height - 1; dy++) {
                    const absY = y + dy;
                    if (absY === stairY) continue; // Don't block stairs
                    
                    // Leave a 2-tile doorway
                    if (dy >= doorwayStart && dy <= doorwayEnd) continue;
                    
                    this.setTile(dividerX, absY, { ...wallTile }, 0);
                }
            } else {
                // Horizontal divider
                const dividerY = y + Math.floor(height / 2);
                const doorwayStart = Math.floor(width / 2) - 1;
                const doorwayEnd = doorwayStart + 2; // 2-tile wide doorway
                
                for (let dx = 1; dx < width - 1; dx++) {
                    const absX = x + dx;
                    if (absX === stairX) continue; // Don't block stairs
                    
                    // Leave a 2-tile doorway
                    if (dx >= doorwayStart && dx <= doorwayEnd) continue;
                    
                    this.setTile(absX, dividerY, { ...wallTile }, 0);
                }
            }
        }
    }
}
