import { Chunk } from './Chunk.js';
import { NPC } from '../entities/NPC.js';
import { ExtractionPoint } from './ExtractionPoint.js';

export class World {
    constructor(game) {
        this.game = game;
        this.chunks = new Map();
        this.chunkSize = 32;
        this.entities = [];
        this.items = [];
        this.extractionPoint = null;
        this.activeRadius = 2;
    }
    
    init() {
        this.generateInitialChunks();
        this.spawnInitialNPCs();
        this.spawnExtractionPoint();
        this.spawnAccessCard();
    }
    
    generateInitialChunks() {
        for (let cy = -1; cy <= 1; cy++) {
            for (let cx = -1; cx <= 1; cx++) {
                this.getOrCreateChunk(cx, cy);
            }
        }
    }
    
    getOrCreateChunk(cx, cy) {
        const key = `${cx},${cy}`;
        if (!this.chunks.has(key)) {
            const chunk = new Chunk(this, cx, cy);
            chunk.generate();
            this.chunks.set(key, chunk);
        }
        return this.chunks.get(key);
    }
    
    getTile(x, y) {
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const chunk = this.getOrCreateChunk(cx, cy);
        
        const localX = x - cx * this.chunkSize;
        const localY = y - cy * this.chunkSize;
        
        return chunk.getTile(localX, localY);
    }
    
    setTile(x, y, tile) {
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const chunk = this.getOrCreateChunk(cx, cy);
        
        const localX = x - cx * this.chunkSize;
        const localY = y - cy * this.chunkSize;
        
        chunk.setTile(localX, localY, tile);
    }
    
    isBlocked(x, y) {
        const tile = this.getTile(x, y);
        if (tile.blocked) return true;
        
        return this.entities.some(e => e.x === x && e.y === y && e.blocksMovement);
    }
    
    getEntityAt(x, y) {
        return this.entities.find(e => e.x === x && e.y === y);
    }
    
    getItemsAt(x, y) {
        return this.items.filter(item => item.x === x && item.y === y);
    }
    
    addEntity(entity) {
        this.entities.push(entity);
    }
    
    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index > -1) {
            this.entities.splice(index, 1);
        }
    }
    
    addItem(item) {
        this.items.push(item);
    }
    
    removeItem(item) {
        const index = this.items.indexOf(item);
        if (index > -1) {
            this.items.splice(index, 1);
        }
    }
    
    getSpawnPosition() {
        return { x: 5, y: 5 };
    }
    
    spawnInitialNPCs() {
        const npcTypes = [
            { type: 'scavenger', count: 8 },
            { type: 'raider', count: 6 }
        ];
        
        for (const npcDef of npcTypes) {
            for (let i = 0; i < npcDef.count; i++) {
                const x = Math.floor(Math.random() * 80) - 20;
                const y = Math.floor(Math.random() * 80) - 20;
                
                if (!this.isBlocked(x, y)) {
                    const npc = new NPC(this.game, npcDef.type, x, y);
                    this.addEntity(npc);
                }
            }
        }
    }
    
    spawnExtractionPoint() {
        const angle = Math.random() * Math.PI * 2;
        const distance = 25 + Math.floor(Math.random() * 15);
        
        const spawnPos = this.getSpawnPosition();
        const x = Math.floor(spawnPos.x + Math.cos(angle) * distance);
        const y = Math.floor(spawnPos.y + Math.sin(angle) * distance);
        
        for (let attempts = 0; attempts < 50; attempts++) {
            const testX = x + Math.floor(Math.random() * 10) - 5;
            const testY = y + Math.floor(Math.random() * 10) - 5;
            
            if (!this.isBlocked(testX, testY)) {
                const types = ['transit_gate', 'safehouse', 'elevator', 'escape_tunnel'];
                const type = types[Math.floor(Math.random() * types.length)];
                this.extractionPoint = new ExtractionPoint(testX, testY, type);
                console.log(`Extraction spawned at (${testX}, ${testY}), distance: ${Math.floor(distance)} tiles`);
                this.game.ui.log(`Extraction point located: ${this.extractionPoint.name} (${Math.floor(distance)} tiles away)`, 'info');
                return;
            }
        }
        
        this.extractionPoint = new ExtractionPoint(x, y, 'transit_gate');
        console.log(`Extraction spawned at (${x}, ${y}) - fallback`);
    }
    
    spawnAccessCard() {
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.floor(Math.random() * 15);
        
        const spawnPos = this.getSpawnPosition();
        const x = Math.floor(spawnPos.x + Math.cos(angle) * distance);
        const y = Math.floor(spawnPos.y + Math.sin(angle) * distance);
        
        for (let attempts = 0; attempts < 50; attempts++) {
            const testX = x + Math.floor(Math.random() * 10) - 5;
            const testY = y + Math.floor(Math.random() * 10) - 5;
            
            if (!this.isBlocked(testX, testY)) {
                const card = {
                    id: 'access_card',
                    name: 'Access Card',
                    type: 'key_item',
                    glyph: '▪',
                    color: '#00ff00',
                    x: testX,
                    y: testY
                };
                this.addItem(card);
                console.log(`Access card spawned at (${testX}, ${testY}), distance: ${Math.floor(distance)} tiles`);
                this.game.ui.log(`Access card detected in the area (${Math.floor(distance)} tiles away).`, 'info');
                return;
            }
        }
        console.warn('Failed to spawn access card after 50 attempts');
    }
    
    processTurn() {
        const player = this.game.player;
        
        for (const entity of this.entities) {
            if (entity === player) continue;
            if (!entity.takeTurn) continue;
            
            const dist = Math.abs(entity.x - player.x) + Math.abs(entity.y - player.y);
            if (dist < 20) {
                entity.takeTurn();
            }
        }
    }
    
    render(renderer, cameraX, cameraY, viewWidth, viewHeight, fov) {
        for (let y = 0; y < viewHeight; y++) {
            for (let x = 0; x < viewWidth; x++) {
                const worldX = cameraX + x;
                const worldY = cameraY + y;
                
                const tile = this.getTile(worldX, worldY);
                
                if (!fov) {
                    renderer.drawTile(x, y, tile.glyph, tile.fgColor, tile.bgColor);
                } else {
                    const isVisible = fov.isVisible(worldX, worldY);
                    const isExplored = fov.isExplored(worldX, worldY);
                    
                    if (isVisible) {
                        renderer.drawTile(x, y, tile.glyph, tile.fgColor, tile.bgColor);
                    } else if (isExplored) {
                        const dimFg = this.dimColor(tile.fgColor);
                        const dimBg = this.dimColor(tile.bgColor);
                        renderer.drawTile(x, y, tile.glyph, dimFg, dimBg);
                    }
                }
            }
        }
        
        for (const item of this.items) {
            const screenX = item.x - cameraX;
            const screenY = item.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(item.x, item.y)) {
                    renderer.drawTile(screenX, screenY, item.glyph, item.color);
                }
            }
        }
        
        for (const entity of this.entities) {
            const screenX = entity.x - cameraX;
            const screenY = entity.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(entity.x, entity.y)) {
                    renderer.drawTile(screenX, screenY, entity.glyph, entity.color);
                }
            }
        }
        
        if (this.extractionPoint) {
            const screenX = this.extractionPoint.x - cameraX;
            const screenY = this.extractionPoint.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(this.extractionPoint.x, this.extractionPoint.y)) {
                    renderer.drawTile(screenX, screenY, this.extractionPoint.glyph, this.extractionPoint.color);
                }
            }
        }
    }
    
    dimColor(color) {
        if (!color || color === '#000000') return color;
        
        const hex = color.replace('#', '');
        const r = Math.floor(parseInt(hex.substr(0, 2), 16) * 0.4);
        const g = Math.floor(parseInt(hex.substr(2, 2), 16) * 0.4);
        const b = Math.floor(parseInt(hex.substr(4, 2), 16) * 0.4);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}
