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
    
    clearAllChunks() {
        console.log('Clearing all cached chunks for regeneration...');
        this.chunks.clear();
        this.generateInitialChunks();
        console.log('Chunks regenerated with current generation code');
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
    
    getTile(x, y, z = 0) {
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const chunk = this.getOrCreateChunk(cx, cy);
        
        const localX = x - cx * this.chunkSize;
        const localY = y - cy * this.chunkSize;
        
        const tile = chunk.getTile(localX, localY, z);
        
        // Debug: Sample tile retrieval for z=-1
        if (z === -1 && Math.random() < 0.001) {
            console.log(`World.getTile(${x},${y},${z}) -> chunk(${cx},${cy}) local(${localX},${localY}) = ${tile.name}`);
        }
        
        return tile;
    }
    
    setTile(x, y, tile, z = 0) {
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const chunk = this.getOrCreateChunk(cx, cy);
        
        const localX = x - cx * this.chunkSize;
        const localY = y - cy * this.chunkSize;
        
        chunk.setTile(localX, localY, tile, z);
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
        
        // Process food spoilage and liquid spillage
        this.processFoodSpoilage(player);
        this.processLiquidSpillage(player);
        
        for (const entity of this.entities) {
            if (entity === player) continue;
            if (!entity.takeTurn) continue;
            
            const dist = Math.abs(entity.x - player.x) + Math.abs(entity.y - player.y);
            if (dist < 20) {
                entity.takeTurn();
            }
        }
    }
    
    processFoodSpoilage(player) {
        const SPOILAGE_RATES = {
            'protein': 0.03,   // Slower spoilage for meat, beans
            'liquid': 0.05,    // Faster spoilage for soup
            'default': 0.04    // Default for other foods
        };
        
        // Collect all opened containers from player's possession
        const containers = [
            ...player.inventory.filter(i => i.isContainer && i.state?.opened),
            ...Object.values(player.equipment).filter(i => i?.isContainer && i?.state?.opened),
            ...(player.carrying.leftHand?.isContainer && player.carrying.leftHand?.state?.opened ? [player.carrying.leftHand] : []),
            ...(player.carrying.rightHand?.isContainer && player.carrying.rightHand?.state?.opened ? [player.carrying.rightHand] : [])
        ];
        
        for (const container of containers) {
            if (!container.contents) continue;
            
            for (const item of container.contents) {
                if (item.type !== 'food') continue; // Only food spoils this way
                
                // Initialize contamination level if needed
                if (!item.state) item.state = {};
                if (item.state.contaminationLevel === undefined) {
                    item.state.contaminationLevel = 0;
                }
                
                // Determine spoilage rate based on tags
                let spoilageRate = SPOILAGE_RATES.default;
                if (item.tags && item.tags.includes('protein')) spoilageRate = SPOILAGE_RATES.protein;
                if (item.tags && item.tags.includes('liquid')) spoilageRate = SPOILAGE_RATES.liquid;
                
                // Increase contamination
                item.state.contaminationLevel += spoilageRate;
                
                // Mark as contaminated when threshold reached
                if (item.state.contaminationLevel >= 0.3 && !item.state.contaminated) {
                    item.state.contaminated = true;
                }
            }
        }
    }
    
    processLiquidSpillage(player) {
        const SPILLAGE_RATE = 7; // ml per turn for unsealed liquids
        
        // Collect all opened, unsealed containers from player's possession
        const containers = [
            ...player.inventory.filter(i => i.isContainer && i.state?.opened && !i.state?.sealed),
            ...Object.values(player.equipment).filter(i => i?.isContainer && i?.state?.opened && !i?.state?.sealed),
            ...(player.carrying.leftHand?.isContainer && player.carrying.leftHand?.state?.opened && !player.carrying.leftHand?.state?.sealed ? [player.carrying.leftHand] : []),
            ...(player.carrying.rightHand?.isContainer && player.carrying.rightHand?.state?.opened && !player.carrying.rightHand?.state?.sealed ? [player.carrying.rightHand] : [])
        ];
        
        for (const container of containers) {
            if (!container.contents) continue;
            
            for (let i = container.contents.length - 1; i >= 0; i--) {
                const item = container.contents[i];
                
                // Only drinks spill (liquids)
                if (item.type !== 'drink') continue;
                if (!item.quantity || item.quantityUnit !== 'ml') continue;
                
                // Reduce quantity by spillage rate
                const spillAmount = Math.min(SPILLAGE_RATE, item.quantity);
                item.quantity -= spillAmount;
                
                // Update weight and volume proportionally
                const ratio = item.quantity / (item.quantity + spillAmount);
                item.weight = Math.floor(item.weight * ratio);
                item.volume = Math.floor(item.volume * ratio);
                
                // Remove if empty
                if (item.quantity <= 0) {
                    container.contents.splice(i, 1);
                }
            }
        }
    }
    
    render(renderer, cameraX, cameraY, viewWidth, viewHeight, fov, z = 0) {
        // Debug: Log what z-level we're rendering
        if (Math.random() < 0.01) {
            console.log(`World.render called with z=${z}`);
        }
        
        for (let y = 0; y < viewHeight; y++) {
            for (let x = 0; x < viewWidth; x++) {
                const worldX = cameraX + x;
                const worldY = cameraY + y;
                
                const tile = this.getTile(worldX, worldY, z);
                
                // Debug: Sample what we're about to draw at z=-1
                if (z === -1 && Math.random() < 0.001) {
                    console.log(`World.render drawing at screen(${x},${y}) world(${worldX},${worldY}) z=${z}: ${tile.name} (${tile.glyph})`);
                }
                
                if (!fov) {
                    renderer.drawTile(x, y, tile.glyph, tile.fgColor, tile.bgColor);
                } else {
                    const isVisible = fov.isVisible(worldX, worldY, z);
                    const isExplored = fov.isExplored(worldX, worldY, z);
                    
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
        
        // Only render items on the current z-level
        for (const item of this.items) {
            if (item.z !== z) continue; // Skip items on different z-levels
            
            const screenX = item.x - cameraX;
            const screenY = item.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(item.x, item.y, z)) {
                    renderer.drawTile(screenX, screenY, item.glyph, item.color);
                }
            }
        }
        
        // Only render entities on the current z-level
        for (const entity of this.entities) {
            if (entity.z !== z) continue; // Skip entities on different z-levels
            
            const screenX = entity.x - cameraX;
            const screenY = entity.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(entity.x, entity.y, z)) {
                    renderer.drawTile(screenX, screenY, entity.glyph, entity.color);
                }
            }
        }
        
        // Only render extraction point on ground level
        if (this.extractionPoint && z === 0) {
            const screenX = this.extractionPoint.x - cameraX;
            const screenY = this.extractionPoint.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(this.extractionPoint.x, this.extractionPoint.y, z)) {
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
