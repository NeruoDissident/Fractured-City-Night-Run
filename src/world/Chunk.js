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
        const itemCount = Math.floor(Math.random() * 5) + 2;
        
        for (let i = 0; i < itemCount; i++) {
            const x = Math.floor(Math.random() * this.size);
            const y = Math.floor(Math.random() * this.size);
            
            const tile = this.getTile(x, y);
            if (tile.blocked) continue;
            
            const worldX = this.cx * this.size + x;
            const worldY = this.cy * this.size + y;
            
            const item = this.generateRandomItem(biome);
            if (item) {
                item.x = worldX;
                item.y = worldY;
                item.z = 0; // Items spawn on ground level only
                this.world.addItem(item);
            }
        }
    }
    
    generateRandomItem(biome) {
        const content = this.world.game.content;
        const rand = Math.random();
        
        const itemFamilies = ['shiv', 'knife', 'pipe', 'trenchcoat', 'medkit', 'battery', 'can_sealed', 'bottle_sealed', 'can_opener'];
        const materials = ['scrap_metal', 'carbon_steel', 'copper_wire', 'plastic_scrap', 'synth_fiber'];
        const modifiers = ['rusty', 'reinforced', 'makeshift', 'sterile'];
        
        const familyId = itemFamilies[Math.floor(Math.random() * itemFamilies.length)];
        
        // Food containers and tools don't need materials/modifiers
        if (familyId === 'can_sealed' || familyId === 'bottle_sealed' || familyId === 'can_opener') {
            return content.createItem(familyId);
        }
        
        const materialId = materials[Math.floor(Math.random() * materials.length)];
        const modifierId = rand < 0.3 ? modifiers[Math.floor(Math.random() * modifiers.length)] : null;
        
        return content.createItem(familyId, materialId, modifierId);
    }
    
    selectBiome() {
        const hash = this.cx * 73856093 ^ this.cy * 19349663;
        const rand = Math.abs(Math.sin(hash)) * 10000;
        
        if (rand % 100 < 40) return 'ruins';
        if (rand % 100 < 80) return 'industrial';
        return 'wasteland';
    }
    
    generateCleanTerrain(x, y, biome) {
        // Phase 1: Generate ONLY floor tiles (no obstacles)
        // Obstacles will be added later in addObstaclesAndDebris()
        
        if (biome === 'ruins') {
            return { glyph: '.', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Cracked Floor' };
        } else if (biome === 'industrial') {
            return { glyph: '.', fgColor: '#555555', bgColor: '#0a0a0a', blocked: false, name: 'Concrete Floor' };
        } else {
            return { glyph: '.', fgColor: '#3a3a3a', bgColor: '#050505', blocked: false, name: 'Wasteland' };
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
                    tile.name === 'Wasteland'
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
                if (biome === 'ruins') {
                    if (rand < 3) {
                        // 3% chance of rubble wall
                        this.setTile(x, y, { glyph: '#', fgColor: '#555555', bgColor: '#1a1a1a', blocked: true, name: 'Rubble Wall' }, 0);
                        obstaclesPlaced++;
                    } else if (rand < 8) {
                        // 5% chance of debris
                        this.setTile(x, y, { glyph: '~', fgColor: '#663300', bgColor: '#0a0a0a', blocked: false, name: 'Debris' }, 0);
                        debrisPlaced++;
                    }
                } else if (biome === 'industrial') {
                    if (rand < 5) {
                        // 5% chance of metal wall
                        this.setTile(x, y, { glyph: '█', fgColor: '#333333', bgColor: '#0f0f0f', blocked: true, name: 'Metal Wall' }, 0);
                        obstaclesPlaced++;
                    } else if (rand < 10) {
                        // 5% chance of grating
                        this.setTile(x, y, { glyph: '=', fgColor: '#666666', bgColor: '#0a0a0a', blocked: false, name: 'Grating' }, 0);
                        debrisPlaced++;
                    }
                } else {
                    if (rand < 4) {
                        // 4% chance of wreckage
                        this.setTile(x, y, { glyph: '▓', fgColor: '#2a2a2a', bgColor: '#0a0a0a', blocked: true, name: 'Wreckage' }, 0);
                        obstaclesPlaced++;
                    }
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
        
        // Biome-specific road configuration
        let roadConfig;
        if (biome === 'industrial') {
            roadConfig = {
                mainRoadTile: { glyph: '=', fgColor: '#00ffff', bgColor: '#0a2a2a', blocked: false, name: 'Paved Road' },
                sideStreetTile: { glyph: '-', fgColor: '#00aaaa', bgColor: '#0a1a1a', blocked: false, name: 'Asphalt Street' },
                mainWidth: 3,
                sideWidth: 2,
                density: 'high'
            };
        } else if (biome === 'ruins') {
            roadConfig = {
                mainRoadTile: { glyph: '~', fgColor: '#ff8800', bgColor: '#1a0a00', blocked: false, name: 'Cracked Pavement' },
                sideStreetTile: { glyph: '.', fgColor: '#aa5500', bgColor: '#0a0500', blocked: false, name: 'Broken Path' },
                mainWidth: 2,
                sideWidth: 1,
                density: 'medium'
            };
        } else {
            roadConfig = {
                mainRoadTile: { glyph: '·', fgColor: '#aa6633', bgColor: '#0a0500', blocked: false, name: 'Dirt Road' },
                sideStreetTile: { glyph: ',', fgColor: '#885522', bgColor: '#050200', blocked: false, name: 'Dirt Trail' },
                mainWidth: 2,
                sideWidth: 1,
                density: 'low'
            };
        }
        
        // Generate main roads that cross the chunk
        // Horizontal main road
        const mainRoadY = Math.floor(this.size / 2) + (this.cy % 3 - 1) * 8;
        if (mainRoadY >= 2 && mainRoadY < this.size - 2) {
            this.createHorizontalRoad(0, this.size - 1, mainRoadY, roadConfig.mainRoadTile, roadConfig.mainWidth, 'main');
        }
        
        // Vertical main road
        const mainRoadX = Math.floor(this.size / 2) + (this.cx % 3 - 1) * 8;
        if (mainRoadX >= 2 && mainRoadX < this.size - 2) {
            this.createVerticalRoad(0, this.size - 1, mainRoadX, roadConfig.mainRoadTile, roadConfig.mainWidth, 'main');
        }
        
        // Add side streets perpendicular to main roads
        if (roadConfig.density === 'high') {
            // Industrial: More side streets
            for (let i = 0; i < 2; i++) {
                const sideY = Math.floor(Math.random() * (this.size - 8)) + 4;
                this.createHorizontalRoad(0, this.size - 1, sideY, roadConfig.sideStreetTile, roadConfig.sideWidth, 'side');
            }
        } else if (roadConfig.density === 'medium') {
            // Ruins: Some side paths
            if (Math.random() < 0.6) {
                const sideY = Math.floor(Math.random() * (this.size - 8)) + 4;
                this.createHorizontalRoad(0, this.size - 1, sideY, roadConfig.sideStreetTile, roadConfig.sideWidth, 'side');
            }
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
        
        // Wasteland doesn't have sewers - dirt paths don't need underground infrastructure
        if (biome === 'wasteland') {
            console.log(`Chunk (${this.cx},${this.cy}): Skipping sewers for wasteland biome`);
            return;
        }
        
        console.log(`Chunk (${this.cx},${this.cy}): Generating sewer system under roads`);
        
        // Sewer tile configuration
        const sewerFloorTile = { glyph: '=', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Sewer Floor' };
        const sewerWallTile = { glyph: '#', fgColor: '#333333', bgColor: '#0a0a0a', blocked: true, name: 'Sewer Wall' };
        const manholeTile = { glyph: 'O', fgColor: '#ffff00', bgColor: '#0a2a2a', blocked: false, name: 'Manhole Cover', isManhole: true };
        const ladderTile = { glyph: 'H', fgColor: '#888888', bgColor: '#0a0a0a', blocked: false, name: 'Ladder', isLadder: true };
        
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
        
        // Place manholes every 12-18 tiles (reduced density)
        const manholeSpacing = 12 + Math.floor(Math.random() * 7);
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
        
        // Place manholes every 12-18 tiles (reduced density)
        const manholeSpacing = 12 + Math.floor(Math.random() * 7);
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
        const minSpacing = 10;
        const maxSpacing = 20;
        const roadOffset = Math.floor(road.width / 2) + 2;
        
        let placedCount = 0;
        let currentPos = minSpacing; // Start with offset from road start
        let side = 1; // Alternate sides: 1 or -1
        
        const roadLength = road.direction === 'horizontal' ? (road.x2 - road.x1) : (road.y2 - road.y1);
        
        console.log(`  Placing buildings along ${road.direction} road (length: ${roadLength})`);
        
        while (currentPos < roadLength - minSpacing) {
            // Random building size
            const width = Math.floor(Math.random() * 7) + 8;  // 8-14
            const height = Math.floor(Math.random() * 7) + 8; // 8-14
            
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
                    const placed = this.placeBuilding(x, y, width, height, biome);
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
    
    placeBuilding(x, y, width, height, biome) {
        // Determine wall style based on biome
        let wallTile;
        if (biome === 'ruins') {
            wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Crumbling Wall' };
        } else if (biome === 'industrial') {
            wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Concrete Wall' };
        } else {
            wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Makeshift Wall' };
        }
        
        const floorTile = { glyph: '.', fgColor: '#aaaaaa', bgColor: '#2a2a2a', blocked: false, name: 'Floor' };
        
        // SIMPLIFIED: Only rectangles for now
        this.placeRectangularBuilding(x, y, width, height, wallTile, floorTile);
        
        // Add door with validation - ensure it leads to floor inside
        const doorSide = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
        let doorX, doorY;
        let insideX, insideY; // Tile directly inside the door
        
        if (doorSide === 0) { // Top
            doorX = x + Math.floor(width / 2);
            doorY = y;
            insideX = doorX;
            insideY = doorY + 1;
        } else if (doorSide === 1) { // Right
            doorX = x + width - 1;
            doorY = y + Math.floor(height / 2);
            insideX = doorX - 1;
            insideY = doorY;
        } else if (doorSide === 2) { // Bottom
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
        
        const doorTile = { glyph: '+', fgColor: '#ff8800', bgColor: '#3a3a3a', blocked: false, name: 'Door' };
        this.setTile(doorX, doorY, doorTile, 0);
        
        // Track door position for pathway generation
        this.buildingDoors.push({ x: doorX, y: doorY });
        
        // Add stairs and generate corresponding floors
        const hasUpstairs = Math.random() < 0.8;
        const hasBasement = Math.random() < 0.6; // Basements coexist with sewers (different locations)
        
        // Pick ONE stair position for all floors
        const stairX = x + Math.floor(Math.random() * (width - 2)) + 1;
        const stairY = y + Math.floor(Math.random() * (height - 2)) + 1;
        
        // Place staircase on ground floor if building has any vertical levels
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
            this.setTile(stairX, stairY, stairTile, 0);
        }
        
        // REMOVED: No interior features for now - keeping it simple
        
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
    
    generateFloor(x, y, width, height, biome, z, stairX, stairY, canAscend, canDescend) {
        // Generate walls and floors for this z-level
        let wallTile;
        if (biome === 'ruins') {
            wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Crumbling Wall' };
        } else if (biome === 'industrial') {
            wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Concrete Wall' };
        } else {
            wallTile = { glyph: '▓', fgColor: '#aaaaaa', bgColor: '#3a3a3a', blocked: true, name: 'Makeshift Wall' };
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
