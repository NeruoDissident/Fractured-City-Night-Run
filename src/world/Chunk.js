import { createDoor } from './objects/Door.js';
import { findMatchingPrefab, BIOME_DOOR_TYPES } from '../content/BuildingPrefabs.js';
import { ROOM_LOOT_TABLES, OUTDOOR_LOOT, rollLootPool, generateRoomLoot } from '../content/LootTables.js';

export class Chunk {
    constructor(world, cx, cy) {
        this.world = world;
        this.cx = cx;
        this.cy = cy;
        this.size = world.chunkSize;
        this.tiles = {}; // Now a map of z-levels: { 0: [][], 1: [][], -1: [][] }
        this.buildingDoors = []; // Track door positions for pathway generation
    }
    
    generate() {
        const biome = this.selectBiome();
        this.biome = biome;
        
        // Initialize ground level (z=0)
        this.tiles[0] = [];
        
        // Generate base terrain at ground level (clean, no obstacles)
        for (let y = 0; y < this.size; y++) {
            this.tiles[0][y] = [];
            for (let x = 0; x < this.size; x++) {
                this.tiles[0][y][x] = this.generateCleanTerrain(x, y, biome);
            }
        }
        
        // Initialize underground level (z=-1) with solid rock
        this.tiles[-1] = [];
        for (let y = 0; y < this.size; y++) {
            this.tiles[-1][y] = [];
            for (let x = 0; x < this.size; x++) {
                // Fill underground with impassable rock
                this.tiles[-1][y][x] = {
                    glyph: '█',
                    fgColor: '#222222',
                    bgColor: '#000000',
                    blocked: true,
                    name: 'Solid Rock'
                };
            }
        }
        
        // CORRECT ORDER: Clean terrain > Roads > Sewers > Buildings > Obstacles > Items
        this.generateRoadNetwork(biome);
        this.generateSewerSystem(biome);
        this.generateBuildingsAlongRoads(biome);
        
        // Add obstacles AFTER buildings so they don't block placement
        this.addObstaclesAndDebris(biome);
        
        this.spawnItems(biome);
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
                const item = content.createItem(loot.familyId);
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
            if (Math.random() > OUTDOOR_LOOT.spawnChance) continue;
            
            const familyId = rollLootPool(OUTDOOR_LOOT.pools);
            const item = content.createItem(familyId);
            if (item) {
                item.x = this.cx * this.size + tile.x;
                item.y = this.cy * this.size + tile.y;
                item.z = z;
                this.world.addItem(item);
            }
        }
    }
    
    selectBiome() {
        // Zone-based biome selection for coherent city structure
        // Distance from origin determines biome type
        const distFromOrigin = Math.sqrt(this.cx * this.cx + this.cy * this.cy);
        const hash = this.cx * 73856093 ^ this.cy * 19349663;
        const rand = Math.abs(Math.sin(hash)) * 100;
        
        // Urban core: center of map (distance 0-3)
        if (distFromOrigin < 3) {
            return 'urban_core';
        }
        
        // Suburbs: ring around urban core (distance 3-6)
        if (distFromOrigin < 6) {
            // Mix suburbs with occasional industrial
            return rand < 80 ? 'suburbs' : 'industrial';
        }
        
        // Mixed zone: industrial, ruins, rich neighborhoods (distance 6-10)
        if (distFromOrigin < 10) {
            if (rand < 40) return 'industrial';
            if (rand < 70) return 'ruins';
            if (rand < 85) return 'rich_neighborhood';
            return 'suburbs';
        }
        
        // Outer zone: rural and forest (distance 10+)
        if (distFromOrigin < 15) {
            return rand < 60 ? 'rural' : 'forest';
        }
        
        // Far edges: mostly forest
        return 'forest';
    }
    
    generateCleanTerrain(x, y, biome) {
        // Phase 1: Generate ONLY floor tiles (no obstacles)
        // Obstacles will be added later in addObstaclesAndDebris()
        
        switch(biome) {
            case 'urban_core':
                return { glyph: '.', fgColor: '#666666', bgColor: '#0f0f0f', blocked: false, name: 'Paved Ground' };
            case 'suburbs':
                return { glyph: '.', fgColor: '#556b2f', bgColor: '#0a0a0a', blocked: false, name: 'Suburban Ground' };
            case 'industrial':
                return { glyph: '.', fgColor: '#555555', bgColor: '#0a0a0a', blocked: false, name: 'Concrete Floor' };
            case 'rich_neighborhood':
                return { glyph: '.', fgColor: '#6b8e23', bgColor: '#0f0f0a', blocked: false, name: 'Manicured Ground' };
            case 'rural':
                return { glyph: '.', fgColor: '#8b7355', bgColor: '#0a0805', blocked: false, name: 'Dirt Ground' };
            case 'forest':
                return { glyph: ',', fgColor: '#4a6741', bgColor: '#0a0f0a', blocked: false, name: 'Forest Floor' };
            case 'ruins':
                return { glyph: '.', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Cracked Floor' };
            default:
                return { glyph: '.', fgColor: '#3a3a3a', bgColor: '#050505', blocked: false, name: 'Ground' };
        }
    }
    
    addObstaclesAndDebris(biome) {
        // Phase 2: Add obstacles AFTER buildings are placed
        // Only place in empty spaces (floor tiles that aren't roads/buildings/sewers)
        
        console.log(`Chunk (${this.cx},${this.cy}): Adding obstacles and debris to empty spaces`);
        
        let obstaclesPlaced = 0;
        let debrisPlaced = 0;
        
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                const tile = this.getTile(x, y, 0);
                
                // Only place obstacles on empty floor tiles
                const isEmptyFloor = (
                    tile.name === 'Cracked Floor' ||
                    tile.name === 'Concrete Floor' ||
                    tile.name === 'Wasteland' ||
                    tile.name === 'Paved Ground' ||
                    tile.name === 'Suburban Ground' ||
                    tile.name === 'Manicured Ground' ||
                    tile.name === 'Dirt Ground' ||
                    tile.name === 'Forest Floor'
                );
                
                if (!isEmptyFloor) {
                    continue; // Skip tiles that are already occupied
                }
                
                // Use deterministic random based on world position
                const worldX = this.cx * this.size + x;
                const worldY = this.cy * this.size + y;
                const hash = worldX * 73856093 ^ worldY * 19349663;
                const rand = Math.abs(Math.sin(hash)) * 100;
                
                // Place obstacles based on biome
                switch(biome) {
                    case 'urban_core':
                        if (rand < 2) {
                            // 2% chance of barriers
                            this.setTile(x, y, { glyph: '▓', fgColor: '#ffaa00', bgColor: '#1a1a0a', blocked: true, name: 'Barrier' }, 0);
                            obstaclesPlaced++;
                        } else if (rand < 5) {
                            // 3% chance of street furniture
                            this.setTile(x, y, { glyph: '║', fgColor: '#888888', bgColor: '#0f0f0f', blocked: false, name: 'Street Sign' }, 0);
                            debrisPlaced++;
                        }
                        break;
                    
                    case 'suburbs':
                        if (rand < 1) {
                            // 1% chance of fence
                            this.setTile(x, y, { glyph: '|', fgColor: '#8b7355', bgColor: '#0a0a0a', blocked: true, name: 'Fence' }, 0);
                            obstaclesPlaced++;
                        } else if (rand < 4) {
                            // 3% chance of bushes
                            this.setTile(x, y, { glyph: '♣', fgColor: '#4a6741', bgColor: '#0a0a0a', blocked: false, name: 'Bush' }, 0);
                            debrisPlaced++;
                        }
                        break;
                    
                    case 'industrial':
                        if (rand < 5) {
                            // 5% chance of metal wall
                            this.setTile(x, y, { glyph: '█', fgColor: '#333333', bgColor: '#0f0f0f', blocked: true, name: 'Metal Wall' }, 0);
                            obstaclesPlaced++;
                        } else if (rand < 10) {
                            // 5% chance of grating
                            this.setTile(x, y, { glyph: '=', fgColor: '#666666', bgColor: '#0a0a0a', blocked: false, name: 'Grating' }, 0);
                            debrisPlaced++;
                        }
                        break;
                    
                    case 'rich_neighborhood':
                        if (rand < 1) {
                            // 1% chance of decorative wall
                            this.setTile(x, y, { glyph: '▓', fgColor: '#d4af37', bgColor: '#1a1a0a', blocked: true, name: 'Decorative Wall' }, 0);
                            obstaclesPlaced++;
                        } else if (rand < 3) {
                            // 2% chance of garden features
                            this.setTile(x, y, { glyph: '♠', fgColor: '#6b8e23', bgColor: '#0f0f0a', blocked: false, name: 'Garden' }, 0);
                            debrisPlaced++;
                        }
                        break;
                    
                    case 'rural':
                        if (rand < 2) {
                            // 2% chance of rocks
                            this.setTile(x, y, { glyph: '●', fgColor: '#696969', bgColor: '#0a0805', blocked: true, name: 'Boulder' }, 0);
                            obstaclesPlaced++;
                        } else if (rand < 6) {
                            // 4% chance of tall grass
                            this.setTile(x, y, { glyph: '"', fgColor: '#9acd32', bgColor: '#0a0805', blocked: false, name: 'Tall Grass' }, 0);
                            debrisPlaced++;
                        }
                        break;
                    
                    case 'forest':
                        if (rand < 15) {
                            // 15% chance of trees
                            this.setTile(x, y, { glyph: '♣', fgColor: '#228b22', bgColor: '#0a0f0a', blocked: true, name: 'Tree' }, 0);
                            obstaclesPlaced++;
                        } else if (rand < 25) {
                            // 10% chance of bushes
                            this.setTile(x, y, { glyph: '♠', fgColor: '#4a6741', bgColor: '#0a0f0a', blocked: false, name: 'Bush' }, 0);
                            debrisPlaced++;
                        }
                        break;
                    
                    case 'ruins':
                        if (rand < 3) {
                            // 3% chance of rubble wall
                            this.setTile(x, y, { glyph: '#', fgColor: '#555555', bgColor: '#1a1a1a', blocked: true, name: 'Rubble Wall' }, 0);
                            obstaclesPlaced++;
                        } else if (rand < 8) {
                            // 5% chance of debris
                            this.setTile(x, y, { glyph: '~', fgColor: '#663300', bgColor: '#0a0a0a', blocked: false, name: 'Debris' }, 0);
                            debrisPlaced++;
                        }
                        break;
                }
            }
        }
        
        console.log(`  Added ${obstaclesPlaced} obstacles and ${debrisPlaced} debris pieces`);
    }
    
    getTile(x, y, z = 0) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: true, name: 'Void' };
        }
        
        // Debug: Log z=-1 access attempts
        if (z === -1 && Math.random() < 0.01) { // Sample 1% of calls
            console.log(`getTile z=-1 at (${x},${y}) in chunk (${this.cx},${this.cy})`);
            console.log(`  this.tiles[-1] exists: ${!!this.tiles[-1]}`);
            console.log(`  this.tiles[-1][${y}] exists: ${!!this.tiles[-1]?.[y]}`);
            console.log(`  Available z-levels: ${Object.keys(this.tiles)}`);
        }
        
        // If z-level doesn't exist, return empty air
        if (!this.tiles[z]) {
            console.warn(`getTile: z-level ${z} doesn't exist in chunk (${this.cx},${this.cy}). Available: ${Object.keys(this.tiles)}`);
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: false, name: 'Empty Air' };
        }
        
        if (!this.tiles[z][y]) {
            console.warn(`getTile: row ${y} doesn't exist at z=${z} in chunk (${this.cx},${this.cy})`);
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: false, name: 'Empty Air' };
        }
        
        const tile = this.tiles[z][y][x];
        if (!tile) {
            console.warn(`getTile: tile at (${x},${y},${z}) is undefined in chunk (${this.cx},${this.cy})`);
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: false, name: 'Empty Air' };
        }
        
        // Debug: Log what we're returning for z=-1
        if (z === -1 && Math.random() < 0.01) {
            console.log(`  Returning tile: ${tile.name} (${tile.glyph})`);
        }
        
        return tile;
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
    
    generateRoadNetwork(biome) {
        console.log(`Chunk (${this.cx},${this.cy}): Generating ${biome} road network`);
        
        this.roads = []; // Track all road segments
        
        // Forest biome has no roads
        if (biome === 'forest') {
            console.log('  Forest biome: Skipping road generation');
            return;
        }
        
        // Biome-specific road configuration
        let roadConfig;
        switch(biome) {
            case 'urban_core':
                roadConfig = {
                    mainRoadTile: { glyph: '=', fgColor: '#00ffff', bgColor: '#0a2a2a', blocked: false, name: 'City Street' },
                    sideStreetTile: { glyph: '-', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Side Street' },
                    sidewalkTile: { glyph: '·', fgColor: '#888888', bgColor: '#1a1a1a', blocked: false, name: 'Sidewalk' },
                    mainWidth: 4,
                    sideWidth: 3,
                    density: 'very_high',
                    hasSidewalks: true
                };
                break;
            
            case 'suburbs':
                roadConfig = {
                    mainRoadTile: { glyph: '=', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Suburban Road' },
                    sideStreetTile: { glyph: '-', fgColor: '#008888', bgColor: '#0a0a0a', blocked: false, name: 'Residential Street' },
                    mainWidth: 3,
                    sideWidth: 2,
                    density: 'high',
                    hasSidewalks: false
                };
                break;
            
            case 'industrial':
                roadConfig = {
                    mainRoadTile: { glyph: '=', fgColor: '#00ffff', bgColor: '#0a2a2a', blocked: false, name: 'Paved Road' },
                    sideStreetTile: { glyph: '-', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Asphalt Street' },
                    mainWidth: 3,
                    sideWidth: 2,
                    density: 'high',
                    hasSidewalks: false
                };
                break;
            
            case 'rich_neighborhood':
                roadConfig = {
                    mainRoadTile: { glyph: '=', fgColor: '#d4af37', bgColor: '#1a1a0a', blocked: false, name: 'Pristine Road' },
                    sideStreetTile: { glyph: '-', fgColor: '#b8860b', bgColor: '#0f0f0a', blocked: false, name: 'Private Drive' },
                    mainWidth: 3,
                    sideWidth: 2,
                    density: 'medium',
                    hasSidewalks: false
                };
                break;
            
            case 'rural':
                roadConfig = {
                    mainRoadTile: { glyph: '·', fgColor: '#aa6633', bgColor: '#0a0500', blocked: false, name: 'Dirt Road' },
                    sideStreetTile: { glyph: ',', fgColor: '#885522', bgColor: '#050200', blocked: false, name: 'Dirt Trail' },
                    mainWidth: 2,
                    sideWidth: 1,
                    density: 'low',
                    hasSidewalks: false
                };
                break;
            
            case 'ruins':
                roadConfig = {
                    mainRoadTile: { glyph: '~', fgColor: '#ff8800', bgColor: '#1a0a00', blocked: false, name: 'Cracked Pavement' },
                    sideStreetTile: { glyph: '.', fgColor: '#aa5500', bgColor: '#0a0500', blocked: false, name: 'Broken Path' },
                    mainWidth: 2,
                    sideWidth: 1,
                    density: 'medium',
                    hasSidewalks: false
                };
                break;
            
            default:
                roadConfig = {
                    mainRoadTile: { glyph: '=', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Road' },
                    sideStreetTile: { glyph: '-', fgColor: '#008888', bgColor: '#0a0a0a', blocked: false, name: 'Street' },
                    mainWidth: 3,
                    sideWidth: 2,
                    density: 'medium',
                    hasSidewalks: false
                };
        }
        
        // NEW APPROACH: Sparse, purposeful roads that connect across chunks
        // Only place roads every few chunks to leave room for buildings and exploration
        
        // Major roads run every 3 chunks (creates a grid with large blocks)
        const hasHorizontalMajorRoad = (this.cy % 3 === 0);
        const hasVerticalMajorRoad = (this.cx % 3 === 0);
        
        if (hasHorizontalMajorRoad) {
            // Place horizontal major road in middle of chunk
            const roadY = Math.floor(this.size / 2);
            this.createHorizontalRoad(0, this.size - 1, roadY, roadConfig.mainRoadTile, roadConfig.mainWidth, 'main');
        }
        
        if (hasVerticalMajorRoad) {
            // Place vertical major road in middle of chunk
            const roadX = Math.floor(this.size / 2);
            this.createVerticalRoad(0, this.size - 1, roadX, roadConfig.mainRoadTile, roadConfig.mainWidth, 'main');
        }
        
        // Side streets only in high-density biomes, and only occasionally
        if (roadConfig.density === 'very_high') {
            // Urban core: Add ONE side street if we have a major road
            if (hasHorizontalMajorRoad && Math.random() < 0.4) {
                // Add a perpendicular vertical connector
                const sideX = Math.floor(this.size * 0.25) + Math.floor(Math.random() * Math.floor(this.size * 0.5));
                this.createVerticalRoad(0, this.size - 1, sideX, roadConfig.sideStreetTile, roadConfig.sideWidth, 'side');
            } else if (hasVerticalMajorRoad && Math.random() < 0.4) {
                // Add a perpendicular horizontal connector
                const sideY = Math.floor(this.size * 0.25) + Math.floor(Math.random() * Math.floor(this.size * 0.5));
                this.createHorizontalRoad(0, this.size - 1, sideY, roadConfig.sideStreetTile, roadConfig.sideWidth, 'side');
            }
        } else if (roadConfig.density === 'high') {
            // Suburbs/Industrial: Rare side streets
            if ((hasHorizontalMajorRoad || hasVerticalMajorRoad) && Math.random() < 0.2) {
                if (hasHorizontalMajorRoad) {
                    const sideX = Math.floor(this.size * 0.3) + Math.floor(Math.random() * Math.floor(this.size * 0.4));
                    this.createVerticalRoad(0, this.size - 1, sideX, roadConfig.sideStreetTile, roadConfig.sideWidth, 'side');
                } else {
                    const sideY = Math.floor(this.size * 0.3) + Math.floor(Math.random() * Math.floor(this.size * 0.4));
                    this.createHorizontalRoad(0, this.size - 1, sideY, roadConfig.sideStreetTile, roadConfig.sideWidth, 'side');
                }
            }
        }
        // Medium and low density: No side streets at all
    }
    
    createHorizontalRoad(x1, x2, y, roadTile, width, type) {
        const road = { x1, x2, y, width, type, direction: 'horizontal' };
        this.roads.push(road);
        
        const offset = Math.floor(width / 2);
        
        for (let x = x1; x <= x2; x++) {
            for (let dy = -offset; dy <= offset; dy++) {
                const ty = y + dy;
                if (ty >= 0 && ty < this.size) {
                    this.setTile(x, ty, { ...roadTile }, 0);
                }
            }
        }
        
        console.log(`  Created ${type} horizontal road at y=${y}, width=${width}`);
    }
    
    createVerticalRoad(y1, y2, x, roadTile, width, type) {
        const road = { y1, y2, x, width, type, direction: 'vertical' };
        this.roads.push(road);
        
        const offset = Math.floor(width / 2);
        
        for (let y = y1; y <= y2; y++) {
            for (let dx = -offset; dx <= offset; dx++) {
                const tx = x + dx;
                if (tx >= 0 && tx < this.size) {
                    this.setTile(tx, y, { ...roadTile }, 0);
                }
            }
        }
        
        console.log(`  Created ${type} vertical road at x=${x}, width=${width}`);
    }
    
    generateSewerSystem(biome) {
        if (this.roads.length === 0) return;
        
        // Forest and rural don't have sewers - no underground infrastructure
        if (biome === 'forest' || biome === 'rural') {
            console.log(`Chunk (${this.cx},${this.cy}): Skipping sewers for ${biome} biome`);
            return;
        }
        
        console.log(`Chunk (${this.cx},${this.cy}): Generating sewer system under roads`);
        
        // Sewer tile configuration
        const sewerFloorTile = { glyph: '=', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Sewer Floor' };
        const sewerWallTile = { glyph: '#', fgColor: '#333333', bgColor: '#0a0a0a', blocked: true, name: 'Sewer Wall' };
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
        
        console.log(`    Creating horizontal sewer from x=${x1} to x=${x2} at y=${y}, width=${sewerWidth}`);
        
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
        
        console.log(`    Set ${tilesSet} sewer tiles at z=-1`);
        
        // Add rooms and branches at intervals
        let currentX = x1 + 8;
        while (currentX < x2 - 8) {
            const spacing = 15 + Math.floor(Math.random() * 10); // 15-24 tiles between features
            const featureType = Math.random();
            
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
        const manholeSpacing = 24 + Math.floor(Math.random() * 9);
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
        
        console.log(`    Creating vertical sewer from y=${y1} to y=${y2} at x=${x}, width=${sewerWidth}`);
        
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
        
        console.log(`    Set ${tilesSet} sewer tiles at z=-1`);
        
        // Add rooms and branches at intervals
        let currentY = y1 + 8;
        while (currentY < y2 - 8) {
            const spacing = 15 + Math.floor(Math.random() * 10); // 15-24 tiles between features
            const featureType = Math.random();
            
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
        const manholeSpacing = 24 + Math.floor(Math.random() * 9);
        for (let y = y1; y <= y2; y += manholeSpacing) {
            // Manhole on surface
            this.setTile(x, y, { ...manhole }, 0);
            // Ladder underground
            this.setTile(x, y, { ...ladder }, -1);
        }
    }
    
    createSewerRoom(centerX, centerY, sewerFloor, sewerWall) {
        // Create a small 3x3 or 4x4 room branching off the main tunnel
        const roomSize = Math.random() < 0.5 ? 3 : 4;
        const side = Math.random() < 0.5 ? 1 : -1; // Which side of tunnel to branch
        
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
        const branchLength = 2 + Math.floor(Math.random() * 3);
        const side = Math.random() < 0.5 ? 1 : -1;
        
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
            console.log(`Chunk (${this.cx},${this.cy}): No roads, skipping buildings`);
            return;
        }
        
        console.log(`Chunk (${this.cx},${this.cy}): Placing buildings along ${this.roads.length} roads`);
        
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
        
        console.log(`  Placing buildings along ${road.direction} road (length: ${roadLength})`);
        
        while (currentPos < roadLength - minSpacing) {
            // Random building size with variety (small, medium, large)
            const sizeRoll = Math.random();
            let width, height;
            
            if (sizeRoll < 0.4) {
                // 40% small buildings (8-12 tiles)
                width = Math.floor(Math.random() * 5) + 8;
                height = Math.floor(Math.random() * 5) + 8;
            } else if (sizeRoll < 0.75) {
                // 35% medium buildings (14-18 tiles)
                width = Math.floor(Math.random() * 5) + 14;
                height = Math.floor(Math.random() * 5) + 14;
            } else {
                // 25% large buildings (20-24 tiles)
                width = Math.floor(Math.random() * 5) + 20;
                height = Math.floor(Math.random() * 5) + 20;
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
                        console.log(`    Building ${placedCount}: SUCCESS at (${x},${y}) size ${width}x${height}`);
                        
                        // Move past this building plus spacing
                        const buildingLength = road.direction === 'horizontal' ? width : height;
                        currentPos += buildingLength + Math.floor(Math.random() * (maxSpacing - minSpacing + 1)) + minSpacing;
                        
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
        
        console.log(`  Placed ${placedCount} buildings along road`);
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
                
                // Check for roads
                if (tile.name && (
                    tile.name.includes('Road') || 
                    tile.name.includes('Street') || 
                    tile.name.includes('Path') ||
                    tile.name.includes('Trail') ||
                    tile.name.includes('Pavement') ||
                    tile.name.includes('Asphalt')
                )) {
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
                wallTile = { glyph: '▓', fgColor: '#cccccc', bgColor: '#3a3a3a', blocked: true, name: 'Glass & Steel Wall' };
                break;
            case 'suburbs':
                wallTile = { glyph: '▓', fgColor: '#d2b48c', bgColor: '#3a3a3a', blocked: true, name: 'Brick Wall' };
                break;
            case 'industrial':
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Concrete Wall' };
                break;
            case 'rich_neighborhood':
                wallTile = { glyph: '▓', fgColor: '#f5f5dc', bgColor: '#3a3a3a', blocked: true, name: 'Marble Wall' };
                break;
            case 'rural':
                wallTile = { glyph: '▓', fgColor: '#8b7355', bgColor: '#3a3a3a', blocked: true, name: 'Wood Wall' };
                break;
            case 'forest':
                wallTile = { glyph: '▓', fgColor: '#654321', bgColor: '#2a2a2a', blocked: true, name: 'Log Wall' };
                break;
            case 'ruins':
                wallTile = { glyph: '▓', fgColor: '#888888', bgColor: '#3a3a3a', blocked: true, name: 'Crumbling Wall' };
                break;
            default:
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Wall' };
        }
        
        const floorTile = { glyph: '.', fgColor: '#aaaaaa', bgColor: '#2a2a2a', blocked: false, name: 'Floor' };
        
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
        const prefab = findMatchingPrefab(width, height, biome, doorSide);
        if (prefab) {
            console.log(`    Using prefab: ${prefab.name} (${prefab.width}x${prefab.height})`);
            this.placePrefabBuilding(x, y, prefab, biome, wallTile, floorTile);
            
            // Track door positions from prefab (find + characters)
            for (let py = 0; py < prefab.layout.length; py++) {
                const row = prefab.layout[py];
                for (let px = 0; px < row.length; px++) {
                    if (row[px] === '+') {
                        this.buildingDoors.push({ x: x + px, y: y + py });
                    }
                }
            }
            
            // Handle stairs and upper/lower floors from prefab features
            if (prefab.features.hasUpstairs || prefab.features.hasBasement) {
                const stairX = x + Math.floor(Math.random() * (prefab.width - 2)) + 1;
                const stairY = y + Math.floor(Math.random() * (prefab.height - 2)) + 1;
                
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
                                    this.generateFloor(x, y, prefab.width, prefab.height, biome, 1, checkX, checkY, false, true);
                                }
                                if (prefab.features.hasBasement) {
                                    this.generateFloor(x, y, prefab.width, prefab.height, biome, -1, checkX, checkY, true, false);
                                }
                                foundStair = true;
                            }
                        }
                    }
                }
            }
            
            return; // Prefab placed successfully, skip procedural generation below
        }
        
        // Fallback: procedural rectangular building
        this.placeRectangularBuilding(x, y, width, height, wallTile, floorTile);
        
        // Add door with validation - ensure it leads to floor inside
        const procDoorSide = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
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
            const isLocked = Math.random() < 0.5; // 50% locked for testing
            
            const door = createDoor('wood_basic', worldX, worldY, 0, isLocked, false);
            
            // Add to world's object list
            if (this.world && this.world.addWorldObject) {
                this.world.addWorldObject(door);
                // Set the door tile in this chunk
                this.setTile(doorX, doorY, { glyph: door.glyph, fgColor: door.fgColor, bgColor: '#3a3a3a', blocked: door.blocked, blocksVision: door.blocksVision, name: door.name, worldObjectId: door.id }, 0);
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
        const hasUpstairs = Math.random() < 0.8;
        const hasBasement = Math.random() < 0.6; // Basements coexist with sewers (different locations)
        
        // Pick ONE stair position for all floors (will be placed AFTER rooms)
        const stairX = x + Math.floor(Math.random() * (width - 2)) + 1;
        const stairY = y + Math.floor(Math.random() * (height - 2)) + 1;
        
        // Add rooms for all buildings BEFORE placing staircase
        if (width >= 8 && height >= 8) {
            if (width >= 14 && height >= 14) {
                // Medium/large buildings: hallway with multiple rooms
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
            console.log(`      Generating basement at (${x},${y}) size ${width}x${height}`);
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
        const divideVertically = Math.random() < 0.5 || width > height;
        const divideHorizontally = Math.random() < 0.5 || height > width;
        
        if (divideVertically && width >= 14) {
            // Vertical walls from top to bottom
            const numVertical = Math.min(numDividers, Math.floor(width / 8));
            
            for (let i = 0; i < numVertical; i++) {
                // Random position with variation
                const basePos = (width / (numVertical + 1)) * (i + 1);
                const variation = Math.floor(Math.random() * 4) - 2;
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
                let doorwayY = y + Math.floor(height / 2) + Math.floor(Math.random() * 5) - 2;
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
                const variation = Math.floor(Math.random() * 4) - 2;
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
                let doorwayX = x + Math.floor(width / 2) + Math.floor(Math.random() * 5) - 2;
                // Clamp to valid range to ensure it's always placed
                doorwayX = Math.max(x + 1, Math.min(doorwayX, x + width - 2));
                this.setTile(doorwayX, dividerY, { ...floorTile }, 0);
            }
        }
    }
    
    generateFloor(x, y, width, height, biome, z, stairX, stairY, canAscend, canDescend) {
        // Generate walls and floors for this z-level
        let wallTile;
        switch(biome) {
            case 'urban_core':
                wallTile = { glyph: '▓', fgColor: '#cccccc', bgColor: '#3a3a3a', blocked: true, name: 'Glass & Steel Wall' };
                break;
            case 'suburbs':
                wallTile = { glyph: '▓', fgColor: '#d2b48c', bgColor: '#3a3a3a', blocked: true, name: 'Brick Wall' };
                break;
            case 'industrial':
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Concrete Wall' };
                break;
            case 'rich_neighborhood':
                wallTile = { glyph: '▓', fgColor: '#f5f5dc', bgColor: '#3a3a3a', blocked: true, name: 'Marble Wall' };
                break;
            case 'rural':
                wallTile = { glyph: '▓', fgColor: '#8b7355', bgColor: '#3a3a3a', blocked: true, name: 'Wood Wall' };
                break;
            case 'forest':
                wallTile = { glyph: '▓', fgColor: '#654321', bgColor: '#2a2a2a', blocked: true, name: 'Log Wall' };
                break;
            case 'ruins':
                wallTile = { glyph: '▓', fgColor: '#888888', bgColor: '#3a3a3a', blocked: true, name: 'Crumbling Wall' };
                break;
            default:
                wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Wall' };
        }
        
        const floorTile = { glyph: '.', fgColor: '#aaaaaa', bgColor: '#2a2a2a', blocked: false, name: 'Floor' };
        
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
                        const isLocked = Math.random() < lockChance;
                        
                        try {
                            const door = createDoor(doorTypes.exterior, worldX, worldY, 0, isLocked, false);
                            if (this.world && this.world.addWorldObject) {
                                this.world.addWorldObject(door);
                                this.setTile(tileX, tileY, { glyph: door.glyph, fgColor: door.fgColor, bgColor: '#3a3a3a', blocked: door.blocked, blocksVision: door.blocksVision, name: door.name, worldObjectId: door.id }, 0);
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
                                this.setTile(tileX, tileY, { glyph: door.glyph, fgColor: door.fgColor, bgColor: '#3a3a3a', blocked: door.blocked, blocksVision: door.blocksVision, name: door.name, worldObjectId: door.id }, 0);
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
                
                if (Math.random() < skipChance) continue;
                
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
                    if (Math.random() < furniture.chance) {
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
        if (width >= 10 && height >= 10 && Math.random() < 0.3) {
            const wallTile = this.getTile(x, y, 0); // Get building's wall type
            
            // Vertical divider
            if (Math.random() < 0.5) {
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
