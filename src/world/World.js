import { Chunk } from './Chunk.js';
import { NPC } from '../entities/NPC.js';
import { ExtractionPoint } from './ExtractionPoint.js';

// Biome tint colors for wall sprites (applied over neutral gray spritesheet)
const BIOME_WALL_TINTS = {
    urban_core:        '#cccccc',
    suburbs:           '#d2b48c',
    industrial:        '#aaaaaa',
    rich_neighborhood: '#f5f5dc',
    rural:             '#8b7355',
    forest:            '#654321',
    ruins:             '#888888'
};

export class World {
    constructor(game) {
        this.game = game;
        this.chunks = new Map();
        this.chunkSize = 64;
        this.entities = [];
        this.items = [];
        this.worldObjects = []; // Doors, furniture, etc.
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
    
    getBiomeAt(x, y) {
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const chunk = this.getOrCreateChunk(cx, cy);
        return chunk.biome || 'unknown';
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
    
    isBlocked(x, y, z = 0) {
        const tile = this.getTile(x, y, z);
        if (tile.blocked) return true;
        
        return this.entities.some(e => e.x === x && e.y === y && e.z === z && e.blocksMovement);
    }
    
    getEntityAt(x, y, z = 0) {
        return this.entities.find(e => e.x === x && e.y === y && e.z === z);
    }
    
    getItemsAt(x, y, z = 0) {
        return this.items.filter(item => item.x === x && item.y === y && (item.z === z || item.z === undefined));
    }
    
    addEntity(entity) {
        this.entities.push(entity);
    }
    
    getAllEntities() {
        return this.entities;
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
                
                if (!this.isBlocked(x, y, 0)) {
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
            
            if (!this.isBlocked(testX, testY, 0)) {
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
            
            if (!this.isBlocked(testX, testY, 0)) {
                const card = {
                    id: 'access_card',
                    name: 'Access Card',
                    type: 'key_item',
                    glyph: '▪',
                    color: '#00ff00',
                    x: testX,
                    y: testY,
                    z: 0
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
        
        // Copy array — entities may die (and be removed) during their turn
        const activeEntities = [...this.entities];
        for (const entity of activeEntities) {
            if (entity === player) continue;
            if (!entity.takeTurn) continue;
            // Skip entities that died earlier this turn
            if (entity.anatomy && entity.anatomy.isDead()) continue;
            
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
    
    /**
     * Calculate 4-bit bitmask for wall autotiling.
     * Checks N/E/S/W neighbors for wall tiles.
     * Bit layout matches spritesheet where index = direction wall faces:
     *   bit 1 = neighbor to SOUTH  (wall faces N)
     *   bit 2 = neighbor to WEST   (wall faces E)
     *   bit 4 = neighbor to NORTH  (wall faces S)
     *   bit 8 = neighbor to EAST   (wall faces W)
     */
    getWallBitmask(x, y, z) {
        const n = this.getTile(x, y - 1, z);
        const e = this.getTile(x + 1, y, z);
        const s = this.getTile(x, y + 1, z);
        const w = this.getTile(x - 1, y, z);
        
        let mask = 0;
        if (n && n.isWall) mask |= 1;
        if (w && w.isWall) mask |= 2;
        if (s && s.isWall) mask |= 4;
        if (e && e.isWall) mask |= 8;
        return mask;
    }
    
    /**
     * Build sprite data for a wall tile if sprites are available.
     * Returns { sheet, index, tint } or null for ASCII fallback.
     */
    getWallSpriteData(worldX, worldY, z) {
        const biome = this.getBiomeAt(worldX, worldY);
        const tint = BIOME_WALL_TINTS[biome] || BIOME_WALL_TINTS.suburbs;
        const bitmask = this.getWallBitmask(worldX, worldY, z);
        return { sheet: 'walls', index: bitmask, tint: tint };
    }
    
    /**
     * Get sprite data for an entity (player or NPC).
     * Returns { sheet, index } or null for ASCII fallback.
     */
    getEntitySpriteData(entity) {
        // Player character
        if (entity.glyph === '@') {
            return { sheet: 'player', index: 0 };
        }
        // NPCs by type
        if (entity.type === 'raider') {
            return { sheet: 'npcs', index: 0 };
        }
        if (entity.type === 'scavenger') {
            return { sheet: 'npcs', index: 1 };
        }
        return null;
    }
    
    render(renderer, cameraX, cameraY, viewWidth, viewHeight, fov, z = 0, lighting = null) {
        for (let y = 0; y < viewHeight; y++) {
            for (let x = 0; x < viewWidth; x++) {
                const worldX = cameraX + x;
                const worldY = cameraY + y;
                
                const tile = this.getTile(worldX, worldY, z);
                
                // Get sprite data: walls use autotile bitmask, furniture/doors use tile.spriteData
                const spriteData = tile.isWall
                    ? this.getWallSpriteData(worldX, worldY, z)
                    : (tile.spriteData || null);
                
                if (!fov) {
                    renderer.drawTileSprite(x, y, tile.glyph, tile.fgColor, tile.bgColor, spriteData);
                } else {
                    const isVisible = fov.isVisible(worldX, worldY, z);
                    const isExplored = fov.isExplored(worldX, worldY, z);
                    
                    if (isVisible) {
                        const light = lighting ? lighting.getLightLevel(worldX, worldY, z) : 1.0;
                        const tint = lighting ? lighting.getLightTint(worldX, worldY, z) : null;
                        if (spriteData) {
                            renderer.drawTileSprite(x, y, tile.glyph, tile.fgColor, tile.bgColor, spriteData, light, tint);
                        } else {
                            // ASCII path with color-based lighting
                            const litFg = this.applyLight(tile.fgColor, light, tint);
                            const litBg = this.applyLight(tile.bgColor, light, tint);
                            renderer.drawTile(x, y, tile.glyph, litFg, litBg);
                        }
                    } else if (isExplored) {
                        if (spriteData) {
                            renderer.drawTileSpriteDimmed(x, y, tile.glyph, tile.fgColor, tile.bgColor, spriteData);
                        } else {
                            const dimFg = this.dimColor(tile.fgColor);
                            const dimBg = this.dimColor(tile.bgColor);
                            renderer.drawTile(x, y, tile.glyph, dimFg, dimBg);
                        }
                    }
                }
            }
        }
        
        // Only render items on the current z-level
        for (const item of this.items) {
            if (item.z !== z) continue;
            
            const screenX = item.x - cameraX;
            const screenY = item.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(item.x, item.y, z)) {
                    const light = lighting ? lighting.getLightLevel(item.x, item.y, z) : 1.0;
                    const tint = lighting ? lighting.getLightTint(item.x, item.y, z) : null;
                    renderer.drawTile(screenX, screenY, item.glyph, this.applyLight(item.color, light, tint));
                }
            }
        }
        
        // Only render entities on the current z-level
        for (const entity of this.entities) {
            if (entity.z !== z) continue;
            
            const screenX = entity.x - cameraX;
            const screenY = entity.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(entity.x, entity.y, z)) {
                    const light = lighting ? lighting.getLightLevel(entity.x, entity.y, z) : 1.0;
                    const tint = lighting ? lighting.getLightTint(entity.x, entity.y, z) : null;
                    
                    // Determine sprite data for entity
                    const entitySprite = this.getEntitySpriteData(entity);
                    if (entitySprite) {
                        renderer.drawTileSprite(screenX, screenY, entity.glyph, entity.color, null, entitySprite, light, tint);
                    } else {
                        renderer.drawTile(screenX, screenY, entity.glyph, this.applyLight(entity.color, light, tint));
                    }
                }
            }
        }
        
        // Only render extraction point on ground level
        if (this.extractionPoint && z === 0) {
            const screenX = this.extractionPoint.x - cameraX;
            const screenY = this.extractionPoint.y - cameraY;
            
            if (screenX >= 0 && screenX < viewWidth && screenY >= 0 && screenY < viewHeight) {
                if (!fov || fov.isVisible(this.extractionPoint.x, this.extractionPoint.y, z)) {
                    const light = lighting ? lighting.getLightLevel(this.extractionPoint.x, this.extractionPoint.y, z) : 1.0;
                    const tint = lighting ? lighting.getLightTint(this.extractionPoint.x, this.extractionPoint.y, z) : null;
                    renderer.drawTile(screenX, screenY, this.extractionPoint.glyph, this.applyLight(this.extractionPoint.color, light, tint));
                }
            }
        }
    }
    
    /**
     * Apply light level to a color
     * lightLevel: 0.0 (pitch black) to 1.0 (full brightness)
     * Minimum brightness ensures tiles aren't completely invisible
     */
    applyLight(color, lightLevel, tint = null) {
        if (!color || color === '#000000') return color;
        if (lightLevel >= 1.0 && !tint) return color;
        
        // Minimum light floor so you can still faintly see lit geometry
        const effective = Math.max(0.08, lightLevel);
        
        const hex = color.replace('#', '');
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);
        
        // Apply brightness
        r = Math.floor(r * effective);
        g = Math.floor(g * effective);
        b = Math.floor(b * effective);
        
        // Blend tint color from light sources (warm yellow glow)
        if (tint && lightLevel > 0.08) {
            const tintHex = tint.replace('#', '');
            const tr = parseInt(tintHex.substr(0, 2), 16);
            const tg = parseInt(tintHex.substr(2, 2), 16);
            const tb = parseInt(tintHex.substr(4, 2), 16);
            
            // Tint strength based on how much the light source contributes vs ambient
            const tintStrength = Math.min(0.35, lightLevel * 0.4);
            r = Math.floor(r * (1 - tintStrength) + tr * tintStrength * effective);
            g = Math.floor(g * (1 - tintStrength) + tg * tintStrength * effective);
            b = Math.floor(b * (1 - tintStrength) + tb * tintStrength * effective);
        }
        
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    dimColor(color) {
        if (!color || color === '#000000') return color;
        
        const hex = color.replace('#', '');
        const r = Math.floor(parseInt(hex.substr(0, 2), 16) * 0.4);
        const g = Math.floor(parseInt(hex.substr(2, 2), 16) * 0.4);
        const b = Math.floor(parseInt(hex.substr(4, 2), 16) * 0.4);
        
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // World Object Management
    addWorldObject(worldObject) {
        this.worldObjects.push(worldObject);
        // Note: Tile update is handled by the chunk during generation
        // We don't call updateTileAt here to avoid circular dependency
    }
    
    getWorldObjectAt(x, y, z = 0) {
        return this.worldObjects.find(obj => obj.x === x && obj.y === y && obj.z === z);
    }
    
    removeWorldObject(worldObject) {
        const index = this.worldObjects.indexOf(worldObject);
        if (index !== -1) {
            this.worldObjects.splice(index, 1);
        }
    }
    
    updateTileAt(x, y, z, tileData) {
        const cx = Math.floor(x / this.chunkSize);
        const cy = Math.floor(y / this.chunkSize);
        const chunk = this.getOrCreateChunk(cx, cy);
        
        const localX = x - cx * this.chunkSize;
        const localY = y - cy * this.chunkSize;
        
        chunk.setTile(localX, localY, tileData, z);
    }
    
    getTileAt(x, y, z = 0) {
        return this.getTile(x, y, z);
    }
}
