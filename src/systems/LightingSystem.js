/**
 * LightingSystem - Computes per-tile light levels
 * 
 * Light level per tile = max(ambient, point_sources)
 * 
 * Ambient light depends on:
 *   - Time of day (from TimeSystem)
 *   - Whether tile is outdoor, indoor, or underground
 * 
 * Point light sources:
 *   - Player-held flashlight/lantern
 *   - World light sources (streetlights, fires, etc.)
 *   - Each has a radius and intensity, with falloff
 * 
 * The lightMap is recalculated each turn for the visible area only.
 * Light level range: 0.0 (pitch black) to 1.0 (full brightness)
 */

export class LightingSystem {
    constructor(game) {
        this.game = game;
        
        // Light map: key = "x,y,z" -> { level: 0.0-1.0, tint: '#rrggbb' | null }
        this.lightMap = new Map();
        
        // Registered world light sources (bonfires, etc.)
        this.worldLightSources = [];
        
        // Direction vectors for cone lights (dx, dy per facing)
        this.facingVectors = {
            'north': { dx: 0, dy: -1 },
            'south': { dx: 0, dy: 1 },
            'east':  { dx: 1, dy: 0 },
            'west':  { dx: -1, dy: 0 },
            'ne':    { dx: 0.707, dy: -0.707 },
            'nw':    { dx: -0.707, dy: -0.707 },
            'se':    { dx: 0.707, dy: 0.707 },
            'sw':    { dx: -0.707, dy: 0.707 }
        };
    }
    
    /**
     * Recalculate lighting for the area around the player
     * Called once per turn (or per render)
     */
    calculate(centerX, centerY, z, radius) {
        this.lightMap.clear();
        
        const timeSystem = this.game.timeSystem;
        if (!timeSystem) return;
        
        // Get ambient levels for this tick
        const outdoorAmbient = timeSystem.getOutdoorAmbient();
        const indoorAmbient = timeSystem.getIndoorAmbient();
        const undergroundAmbient = timeSystem.getUndergroundAmbient();
        
        // Step 1: Set ambient light for each tile in range (no tint for ambient)
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = centerX + dx;
                const ty = centerY + dy;
                const key = `${tx},${ty},${z}`;
                
                const ambient = this.getAmbientForTile(tx, ty, z, outdoorAmbient, indoorAmbient, undergroundAmbient);
                this.lightMap.set(key, { level: ambient, tint: null });
            }
        }
        
        // Step 2: Apply point light sources
        this.applyPlayerLight(centerX, centerY, z);
        this.applyWorldLightSources(centerX, centerY, z, radius);
    }
    
    /**
     * Determine ambient light for a specific tile based on its type
     */
    getAmbientForTile(x, y, z, outdoorAmbient, indoorAmbient, undergroundAmbient) {
        // Underground is always dark
        if (z < 0) return undergroundAmbient;
        
        // Upper floors (z > 0) are indoor
        if (z > 0) return indoorAmbient;
        
        // Ground level (z=0): check if tile is indoor or outdoor
        const tile = this.game.world.getTile(x, y, z);
        if (!tile) return outdoorAmbient;
        
        if (this.isIndoorTile(tile)) {
            return indoorAmbient;
        }
        
        return outdoorAmbient;
    }
    
    /**
     * Check if a tile is considered "indoor"
     * Uses tile name to determine - building floors, staircases inside buildings, etc.
     */
    isIndoorTile(tile) {
        if (!tile || !tile.name) return false;
        
        const name = tile.name;
        
        // Building interior tiles
        if (name === 'Floor') return true;
        if (name === 'Interior Wall') return true;
        if (name === 'Doorway') return true;
        if (name === 'Staircase') return true;
        
        // Door tiles are on the boundary - treat as indoor
        if (name.includes('Door')) return true;
        
        // Wall tiles are structural, not really "lit" spaces
        if (name.includes('Wall')) return true;
        
        return false;
    }
    
    /**
     * Apply light from player-held light sources
     */
    applyPlayerLight(playerX, playerY, z) {
        const player = this.game.player;
        if (!player) return;
        
        const lightSources = this.getPlayerLightSources(player);
        
        for (const light of lightSources) {
            if (light.shape === 'cone') {
                this.applyConeLight(playerX, playerY, z, light.radius, light.intensity, light.color, player.facing, light.coneAngle || 60);
            } else {
                this.applyPointLight(playerX, playerY, z, light.radius, light.intensity, light.color);
            }
        }
    }
    
    /**
     * Get all active light sources the player is carrying/using
     */
    getPlayerLightSources(player) {
        const sources = [];
        
        // Check hands
        const hands = [player.equipment.rightHand, player.equipment.leftHand];
        for (const item of hands) {
            if (!item) continue;
            if (item.lightRadius && item.lightRadius > 0 && this.isLightActive(item)) {
                sources.push({
                    radius: item.lightRadius,
                    intensity: item.lightIntensity || 1.0,
                    color: item.lightColor || null,
                    shape: item.lightShape || 'radius',
                    coneAngle: item.lightConeAngle || 60
                });
            }
        }
        
        // Check worn equipment (e.g., headlamp on helmet)
        for (const slot in player.equipment) {
            if (slot === 'rightHand' || slot === 'leftHand') continue;
            const item = player.equipment[slot];
            if (!item) continue;
            if (item.lightRadius && item.lightRadius > 0 && this.isLightActive(item)) {
                sources.push({
                    radius: item.lightRadius,
                    intensity: item.lightIntensity || 1.0,
                    color: item.lightColor || null,
                    shape: item.lightShape || 'radius',
                    coneAngle: item.lightConeAngle || 60
                });
            }
        }
        
        return sources;
    }
    
    /**
     * Check if a light-emitting item is currently active
     * Requires fuel (contents) to function - batteries for flashlight, fuel for lantern
     */
    isLightActive(item) {
        // If item has an explicit "off" state
        if (item.state && item.state.active === false) return false;
        
        // Check if the item has fuel/batteries in its contents
        if (item.isContainer && item.contents) {
            // Needs at least one fuel/battery item with remaining quantity or durability
            const hasFuel = item.contents.some(c => {
                if (c.type === 'fuel' && c.quantity > 0) return true;
                if (c.tags && c.tags.includes('power') && c.durability > 0) return true;
                return false;
            });
            return hasFuel;
        }
        
        // Non-container light sources (torches, etc.) - check durability
        if (item.durability !== undefined && item.durability <= 0) return false;
        
        return true;
    }
    
    /**
     * Consume fuel from a light source each turn
     * Called from Game.js processTurn
     */
    consumeFuel() {
        const player = this.game.player;
        if (!player) return;
        
        const hands = [player.equipment.rightHand, player.equipment.leftHand];
        for (const item of hands) {
            if (!item || !item.lightRadius || !item.fuelPerTurn) continue;
            if (!this.isLightActive(item)) continue;
            
            // Consume from contents
            if (item.contents) {
                for (let i = item.contents.length - 1; i >= 0; i--) {
                    const fuel = item.contents[i];
                    if (fuel.type === 'fuel' && fuel.quantity > 0) {
                        fuel.quantity -= item.fuelPerTurn * 10; // ml per turn
                        fuel.weight = Math.max(0, Math.floor(fuel.weight * (fuel.quantity / (fuel.quantity + item.fuelPerTurn * 10))));
                        if (fuel.quantity <= 0) {
                            item.contents.splice(i, 1);
                            this.game.ui.log(`${item.name} ran out of fuel.`, 'warning');
                        }
                        break;
                    }
                    if (fuel.tags && fuel.tags.includes('power') && fuel.durability > 0) {
                        fuel.durability -= item.fuelPerTurn;
                        if (fuel.durability <= 0) {
                            fuel.durability = 0;
                            item.contents.splice(i, 1);
                            this.game.ui.log(`A battery in ${item.name} died.`, 'warning');
                        }
                        break;
                    }
                }
            }
        }
    }
    
    /**
     * Apply a radial point light source (lantern-style)
     */
    applyPointLight(x, y, z, radius, intensity, tint) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;
                
                const tx = x + dx;
                const ty = y + dy;
                const key = `${tx},${ty},${z}`;
                
                if (!this.hasLightLOS(x, y, tx, ty, z)) continue;
                
                const falloff = 1.0 - (dist / radius);
                const lightLevel = intensity * falloff * falloff;
                
                const current = this.lightMap.get(key);
                const currentLevel = current ? current.level : 0;
                if (lightLevel > currentLevel) {
                    this.lightMap.set(key, { level: Math.min(1.0, lightLevel), tint: tint });
                }
            }
        }
    }
    
    /**
     * Apply a cone-shaped light source (flashlight-style)
     * Projects light in the player's facing direction within a cone angle
     */
    applyConeLight(x, y, z, radius, intensity, tint, facing, coneAngle) {
        const dir = this.facingVectors[facing] || this.facingVectors['south'];
        const halfAngle = (coneAngle / 2) * (Math.PI / 180);
        
        // Also emit a small radial glow around the player (spill light)
        this.applyPointLight(x, y, z, 3, intensity * 0.4, tint);
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > radius) continue;
                
                // Calculate angle between facing direction and tile direction
                const tileDirX = dx / dist;
                const tileDirY = dy / dist;
                const dot = dir.dx * tileDirX + dir.dy * tileDirY;
                const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                
                // Skip tiles outside the cone
                if (angle > halfAngle) continue;
                
                const tx = x + dx;
                const ty = y + dy;
                const key = `${tx},${ty},${z}`;
                
                if (!this.hasLightLOS(x, y, tx, ty, z)) continue;
                
                // Falloff: distance-based + angle-based (brighter in center of cone)
                const distFalloff = 1.0 - (dist / radius);
                const angleFalloff = 1.0 - (angle / halfAngle) * 0.5; // Softer at edges
                const lightLevel = intensity * distFalloff * distFalloff * angleFalloff;
                
                const current = this.lightMap.get(key);
                const currentLevel = current ? current.level : 0;
                if (lightLevel > currentLevel) {
                    this.lightMap.set(key, { level: Math.min(1.0, lightLevel), tint: tint });
                }
            }
        }
    }
    
    /**
     * Check if light can reach from source to target (simplified LOS)
     * Reuses the same Bresenham approach as FoV
     */
    hasLightLOS(x0, y0, x1, y1, z) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        let x = x0;
        let y = y0;
        
        while (true) {
            if (x === x1 && y === y1) return true;
            
            if (x !== x0 || y !== y0) {
                const tile = this.game.world.getTile(x, y, z);
                const blocked = tile.blocksVision !== undefined ? tile.blocksVision : tile.blocked;
                if (blocked) return false;
            }
            
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x += sx; }
            if (e2 < dx) { err += dx; y += sy; }
        }
    }
    
    /**
     * Apply world light sources (bonfires, etc.)
     * Only processes sources within range of the calculation area
     */
    applyWorldLightSources(centerX, centerY, z, viewRadius) {
        for (const source of this.worldLightSources) {
            if (source.z !== z) continue;
            
            const dist = Math.abs(source.x - centerX) + Math.abs(source.y - centerY);
            if (dist > viewRadius + source.radius) continue;
            
            this.applyPointLight(source.x, source.y, z, source.radius, source.intensity, source.color);
        }
    }
    
    /**
     * Register a world light source (campfire, bonfire, etc.)
     */
    addWorldLightSource(x, y, z, radius, intensity, color) {
        this.worldLightSources.push({ x, y, z, radius, intensity, color: color || null });
    }
    
    /**
     * Remove a world light source at position
     */
    removeWorldLightSource(x, y, z) {
        this.worldLightSources = this.worldLightSources.filter(
            s => !(s.x === x && s.y === y && s.z === z)
        );
    }
    
    /**
     * Get the light level at a specific tile
     * Returns 0.0 - 1.0
     */
    getLightLevel(x, y, z) {
        const entry = this.lightMap.get(`${x},${y},${z}`);
        return entry ? entry.level : 0.0;
    }
    
    /**
     * Get the light tint color at a specific tile (for yellow-ish light sources)
     * Returns hex color string or null
     */
    getLightTint(x, y, z) {
        const entry = this.lightMap.get(`${x},${y},${z}`);
        return entry ? entry.tint : null;
    }
    
    /**
     * Get effective vision radius based on ambient light + player light
     * In daylight: huge radius (see whole map)
     * At night: shrinks to character's base sight or light source radius
     */
    getEffectiveVisionRadius(baseVisionRange) {
        const player = this.game.player;
        const z = player.z;
        const timeSystem = this.game.timeSystem;
        
        if (!timeSystem) return baseVisionRange;
        
        // Get ambient at player's position
        let ambient;
        if (z < 0) {
            ambient = timeSystem.getUndergroundAmbient();
        } else if (z > 0) {
            ambient = timeSystem.getIndoorAmbient();
        } else {
            const tile = this.game.world.getTile(player.x, player.y, z);
            ambient = this.isIndoorTile(tile) ? timeSystem.getIndoorAmbient() : timeSystem.getOutdoorAmbient();
        }
        
        // Get player's best light source radius
        const lightSources = this.getPlayerLightSources(player);
        let bestLightRadius = 0;
        for (const light of lightSources) {
            if (light.radius > bestLightRadius) {
                bestLightRadius = light.radius;
            }
        }
        
        // In full daylight outdoors: see the entire viewport (use large radius)
        // As it gets darker: radius shrinks toward base vision range
        // Light sources extend vision in the dark
        
        const MAX_VISION = 50; // Effectively "see everything on screen"
        
        // Ambient-based vision: interpolate between base vision and max
        const ambientVision = Math.floor(baseVisionRange + (MAX_VISION - baseVisionRange) * ambient);
        
        // Light source extends vision in darkness
        const lightVision = bestLightRadius;
        
        // Take the best of ambient vision and light-extended vision
        // But never less than 2 (can always see adjacent tiles)
        return Math.max(2, Math.max(ambientVision, lightVision));
    }
}
