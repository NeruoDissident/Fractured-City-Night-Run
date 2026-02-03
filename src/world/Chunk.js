export class Chunk {
    constructor(world, cx, cy) {
        this.world = world;
        this.cx = cx;
        this.cy = cy;
        this.size = world.chunkSize;
        this.tiles = [];
    }
    
    generate() {
        const biome = this.selectBiome();
        
        for (let y = 0; y < this.size; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.size; x++) {
                this.tiles[y][x] = this.generateTile(x, y, biome);
            }
        }
        
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
                this.world.addItem(item);
            }
        }
    }
    
    generateRandomItem(biome) {
        const content = this.world.game.content;
        const rand = Math.random();
        
        const itemFamilies = ['shiv', 'knife', 'pipe', 'trenchcoat', 'medkit', 'battery'];
        const materials = ['scrap_metal', 'carbon_steel', 'copper_wire', 'plastic_scrap', 'synth_fiber'];
        const modifiers = ['rusty', 'reinforced', 'makeshift', 'sterile'];
        
        const familyId = itemFamilies[Math.floor(Math.random() * itemFamilies.length)];
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
    
    generateTile(x, y, biome) {
        const worldX = this.cx * this.size + x;
        const worldY = this.cy * this.size + y;
        
        const hash = worldX * 73856093 ^ worldY * 19349663;
        const rand = Math.abs(Math.sin(hash)) * 100;
        
        if (biome === 'ruins') {
            if (rand < 15) {
                return { glyph: '#', fgColor: '#555555', bgColor: '#1a1a1a', blocked: true, name: 'Rubble Wall' };
            } else if (rand < 20) {
                return { glyph: '~', fgColor: '#663300', bgColor: '#0a0a0a', blocked: false, name: 'Debris' };
            } else {
                return { glyph: '.', fgColor: '#444444', bgColor: '#0a0a0a', blocked: false, name: 'Cracked Floor' };
            }
        } else if (biome === 'industrial') {
            if (rand < 20) {
                return { glyph: '█', fgColor: '#333333', bgColor: '#0f0f0f', blocked: true, name: 'Metal Wall' };
            } else if (rand < 25) {
                return { glyph: '=', fgColor: '#666666', bgColor: '#0a0a0a', blocked: false, name: 'Grating' };
            } else {
                return { glyph: '.', fgColor: '#555555', bgColor: '#0a0a0a', blocked: false, name: 'Concrete Floor' };
            }
        } else {
            if (rand < 10) {
                return { glyph: '▓', fgColor: '#2a2a2a', bgColor: '#0a0a0a', blocked: true, name: 'Wreckage' };
            } else {
                return { glyph: '.', fgColor: '#3a3a3a', bgColor: '#050505', blocked: false, name: 'Wasteland' };
            }
        }
    }
    
    getTile(x, y) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return { glyph: ' ', fgColor: '#000000', bgColor: '#000000', blocked: true, name: 'Void' };
        }
        return this.tiles[y][x];
    }
    
    setTile(x, y, tile) {
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
            this.tiles[y][x] = tile;
        }
    }
}
