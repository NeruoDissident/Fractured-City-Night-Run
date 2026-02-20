/**
 * WorldObjectSystem - Handles interactions with world objects
 * Manages doors, furniture, and other interactive world elements
 */
export class WorldObjectSystem {
    constructor(game) {
        this.game = game;
    }
    
    /**
     * Perform action on a world object
     */
    performAction(worldObject, action, player, tool = null) {
        switch (action) {
            case 'open':
                return this.openDoor(worldObject, player);
            case 'close':
                return this.closeDoor(worldObject, player);
            case 'peek':
                return this.peekThroughDoor(worldObject, player);
            case 'knock':
                return this.knockOnDoor(worldObject, player);
            case 'smash':
                return this.smashObject(worldObject, player, tool);
            case 'search':
                return this.searchFurniture(worldObject, player);
            case 'use':
                return this.useObject(worldObject, player, tool);
            case 'disassemble':
                return this.disassembleObject(worldObject, player, tool);
            case 'lockpick':
                return this.lockpickDoor(worldObject, player, tool);
            case 'barricade':
                return this.barricadeDoor(worldObject, player);
            case 'remove_barricade':
                return this.removeBarricade(worldObject, player);
            default:
                return { success: false, message: 'Unknown action.' };
        }
    }
    
    /**
     * Open a door
     */
    openDoor(door, player) {
        const result = door.open();
        
        if (result.success) {
            this.game.world.updateTileAt(door.x, door.y, door.z, door.getTile());
            this.game.advanceTurn(result.timeSpent || 1);
        }
        
        return result;
    }
    
    /**
     * Close a door
     */
    closeDoor(door, player) {
        const result = door.close();
        
        if (result.success) {
            this.game.world.updateTileAt(door.x, door.y, door.z, door.getTile());
            this.game.advanceTurn(result.timeSpent || 1);
        }
        
        return result;
    }
    
    /**
     * Peek through a door
     */
    peekThroughDoor(door, player) {
        const result = door.peek();
        
        if (result.success) {
            this.game.advanceTurn(result.timeSpent || 1);
            
            // TODO: Show limited vision through door
            // For now, just reveal tiles immediately adjacent on other side
            const dx = door.x - player.x;
            const dy = door.y - player.y;
            
            // Peek one tile beyond the door
            const peekX = door.x + (dx !== 0 ? Math.sign(dx) : 0);
            const peekY = door.y + (dy !== 0 ? Math.sign(dy) : 0);
            
            const tile = this.game.world.getTileAt(peekX, peekY, door.z);
            if (tile) {
                result.message += ` You see: ${tile.name || 'floor'}.`;
            }
        }
        
        return result;
    }
    
    /**
     * Knock on a door
     */
    knockOnDoor(door, player) {
        const result = door.knock();
        
        if (result.success) {
            this.game.advanceTurn(result.timeSpent || 1);
            
            // Make noise to alert NPCs
            if (result.makeNoise) {
                this.makeNoise(door.x, door.y, door.z, result.makeNoise);
            }
        }
        
        return result;
    }
    
    /**
     * Smash an object (door, furniture, etc.)
     * Auto-completes: loops hits until destroyed or weapon breaks
     */
    smashObject(object, player, weapon) {
        // Get weapon from player's hands if not specified
        if (!weapon) {
            weapon = player.equipment.rightHand || player.equipment.leftHand;
        }
        
        // Allow unarmed kicking for weak materials
        let isKicking = false;
        if (!weapon) {
            // Check if material is weak enough to kick
            const canKick = object.material === 'wood' || 
                           object.material === 'glass';
            
            if (!canKick) {
                return { success: false, message: 'You need a weapon or tool to smash this. Metal doors are too strong to kick.' };
            }
            
            // Create fake "kick" weapon
            weapon = { name: 'kick', damage: 8, tags: ['blunt'] };
            isKicking = true;
        }
        
        // Pre-calculate per-hit values
        const baseDamage = weapon.damage || 5;
        const materialMod = this.getMaterialModifier(object.material, weapon);
        const damagePerHit = baseDamage * materialMod;
        const timePerHit = Math.max(2, Math.ceil(5 - (weapon.damage || 0) / 10));
        
        let totalHits = 0;
        let totalTime = 0;
        let destroyed = false;
        let weaponBroke = false;
        let lockBroke = false;
        
        // Loop: keep hitting until destroyed or weapon breaks
        while (!destroyed) {
            // Apply damage to object
            const damageResult = object.takeDamage(damagePerHit);
            totalHits++;
            totalTime += timePerHit;
            
            // Apply durability damage to weapon (not for kicking)
            if (!isKicking && weapon.durability !== undefined) {
                weapon.durability = Math.max(0, weapon.durability - 2);
                if (weapon.durability <= 0) {
                    weaponBroke = true;
                }
            }
            
            // Make noise each hit
            this.makeNoise(object.x, object.y, object.z, {
                volume: 30,
                range: 20,
                type: 'smash',
                description: 'loud smashing'
            });
            
            // Check if lock broke mid-smash
            if (!lockBroke && object.state && object.state.locked && object.hp < object.maxHP * 0.3) {
                object.state.locked = false;
                lockBroke = true;
            }
            
            if (damageResult.destroyed) {
                destroyed = true;
            } else if (weaponBroke) {
                // Weapon broke before object was destroyed — stop
                break;
            }
        }
        
        // Build summary message
        const actionVerb = isKicking ? 'kick' : 'smash';
        let message = '';
        
        if (destroyed) {
            message = isKicking
                ? `You kick apart the ${object.name} in ${totalHits} hit${totalHits > 1 ? 's' : ''} (${totalTime} turns).`
                : `You smash the ${object.name} to pieces with your ${weapon.name} in ${totalHits} hit${totalHits > 1 ? 's' : ''} (${totalTime} turns).`;
            
            object.updateVisuals();
            this.game.world.updateTileAt(object.x, object.y, object.z, object.getTile());
            
            // Drop materials (reduced yield from smashing)
            const materials = this.rollDropTable(object.dropTable, 0.5);
            this.dropMaterials(materials, object.x, object.y, object.z);
            
            if (materials.length > 0) {
                message += ` Some materials scatter on the ground.`;
            }
            
            // Spill stored contents on ground if furniture was a container
            if (object.isContainer && object.pockets) {
                let spillCount = 0;
                for (const pocket of object.pockets) {
                    if (pocket.contents) {
                        for (const item of pocket.contents) {
                            item.x = object.x;
                            item.y = object.y;
                            item.z = object.z;
                            this.game.world.addItem(item);
                            spillCount++;
                        }
                        pocket.contents = [];
                    }
                }
                if (spillCount > 0) {
                    message += ` ${spillCount} item(s) spill out onto the ground.`;
                }
            }
        } else {
            // Weapon broke before finishing
            message = isKicking
                ? `You kick the ${object.name} ${totalHits} time${totalHits > 1 ? 's' : ''} (${totalTime} turns).`
                : `You ${actionVerb} the ${object.name} ${totalHits} time${totalHits > 1 ? 's' : ''} but your ${weapon.name} broke!`;
            message += ` (${Math.floor(object.hp)}/${object.maxHP} HP remaining)`;
            object.updateVisuals();
            this.game.world.updateTileAt(object.x, object.y, object.z, object.getTile());
        }
        
        if (lockBroke) {
            this.game.ui.log(`The lock on the ${object.name} breaks!`, 'info');
        }
        
        if (weaponBroke) {
            this.game.ui.log(`Your ${weapon.name} broke!`, 'warning');
        }
        
        this.game.advanceTurn(totalTime);
        
        return {
            success: true,
            message,
            destroyed,
            hits: totalHits,
            timeSpent: totalTime
        };
    }
    
    /**
     * Disassemble an object carefully
     */
    disassembleObject(object, player, tool) {
        // Check if object can be disassembled
        if (!object.dropTable || !object.dropTable.disassembleTool) {
            return { success: false, message: 'This cannot be disassembled.' };
        }
        
        // Check for required tool
        const requiredTool = object.dropTable.disassembleTool;
        if (!tool) {
            tool = this.findTool(player, requiredTool);
        }
        
        if (!tool) {
            return { 
                success: false, 
                message: `You need a ${requiredTool} to disassemble this.` 
            };
        }
        
        // Doors must be open to disassemble
        if (object.type === 'door' && !object.state.open) {
            return { success: false, message: `You must open the ${object.name} first.` };
        }
        
        // Time required based on object HP
        const timeSpent = Math.max(5, Math.ceil(object.maxHP / 10));
        
        // Get full materials (100% yield for careful disassembly)
        const materials = this.rollDropTable(object.dropTable, 1.0);
        
        // Remove object
        object.hp = 0;
        object.updateVisuals();
        this.game.world.updateTileAt(object.x, object.y, object.z, object.getTile());
        
        // Drop materials
        this.dropMaterials(materials, object.x, object.y, object.z);
        
        // Spill stored contents on ground if furniture was a container
        let spillMsg = '';
        if (object.isContainer && object.pockets) {
            let spillCount = 0;
            for (const pocket of object.pockets) {
                if (pocket.contents) {
                    for (const item of pocket.contents) {
                        item.x = object.x;
                        item.y = object.y;
                        item.z = object.z;
                        this.game.world.addItem(item);
                        spillCount++;
                    }
                    pocket.contents = [];
                }
            }
            if (spillCount > 0) {
                spillMsg = ` ${spillCount} stored item(s) dropped on ground.`;
            }
        }
        
        // Small durability damage to tool
        if (tool.durability !== undefined) {
            tool.durability = Math.max(0, tool.durability - 1);
        }
        
        this.game.advanceTurn(timeSpent);
        
        return {
            success: true,
            message: `You carefully disassemble the ${object.name}. (${materials.length} materials recovered)${spillMsg}`,
            materials
        };
    }
    
    /**
     * Lockpick a door (future feature)
     */
    lockpickDoor(door, player, tool) {
        // TODO: Implement lockpicking system
        return { 
            success: false, 
            message: 'Lockpicking not yet implemented. Try smashing the door instead.' 
        };
    }
    
    /**
     * Barricade a door (future feature)
     */
    barricadeDoor(door, player) {
        // TODO: Implement barricading system
        return { 
            success: false, 
            message: 'Barricading not yet implemented.' 
        };
    }
    
    /**
     * Remove barricade from door (future feature)
     */
    removeBarricade(door, player) {
        // TODO: Implement barricade removal
        return { 
            success: false, 
            message: 'Barricade removal not yet implemented.' 
        };
    }
    
    /**
     * Search furniture - marks as searched and signals UI to show contents
     */
    searchFurniture(furniture, player) {
        if (!furniture.isContainer) {
            return { success: false, message: 'Nothing to search here.' };
        }
        
        furniture.state.searched = true;
        this.game.advanceTurn(1);
        
        const itemCount = furniture.getStoredItemCount ? furniture.getStoredItemCount() : 0;
        
        return {
            success: true,
            message: `You search the ${furniture.name}. ${itemCount > 0 ? `Found ${itemCount} item(s).` : 'It\'s empty.'}`,
            showContents: true,
            worldObject: furniture
        };
    }
    
    /**
     * Make noise to alert NPCs
     */
    makeNoise(x, y, z, noiseData) {
        // Check if noise system exists
        if (!this.game.world.noiseSystem) {
            console.warn('Noise system not found - creating basic implementation');
            // Create basic noise alert for NPCs
            const entities = this.game.world.getAllEntities();
            for (const entity of entities) {
                if (entity.z !== z) continue;
                
                const distance = Math.sqrt(
                    Math.pow(entity.x - x, 2) + 
                    Math.pow(entity.y - y, 2)
                );
                
                if (distance <= noiseData.range) {
                    // Alert NPC
                    if (entity.onNoiseHeard) {
                        entity.onNoiseHeard(x, y, noiseData);
                    }
                }
            }
            
            this.game.ui.log(`You hear ${noiseData.description || 'a noise'}.`, 'warning');
        } else {
            // Use existing noise system
            this.game.world.noiseSystem.makeNoise(x, y, z, noiseData);
        }
    }
    
    /**
     * Get material modifier for damage calculation
     */
    getMaterialModifier(material, weapon) {
        const weaponType = weapon.tags || [];
        
        // Blunt weapons good against wood, bad against metal
        if (weaponType.includes('blunt')) {
            if (material === 'wood') return 1.5;
            if (material === 'metal') return 0.5;
            if (material === 'glass') return 2.0;
        }
        
        // Sharp weapons decent against everything
        if (weaponType.includes('sharp')) {
            if (material === 'wood') return 1.2;
            if (material === 'metal') return 0.7;
            if (material === 'glass') return 1.5;
        }
        
        // Default
        return 1.0;
    }
    
    /**
     * Roll drop table for materials
     */
    rollDropTable(dropTable, yieldModifier = 1.0) {
        if (!dropTable || !dropTable.materials) return [];
        
        const materials = [];
        
        for (const materialDef of dropTable.materials) {
            const quantity = Array.isArray(materialDef.quantity) 
                ? Math.floor(Math.random() * (materialDef.quantity[1] - materialDef.quantity[0] + 1)) + materialDef.quantity[0]
                : materialDef.quantity;
            
            const quality = Array.isArray(materialDef.quality)
                ? Math.floor(Math.random() * (materialDef.quality[1] - materialDef.quality[0] + 1)) + materialDef.quality[0]
                : materialDef.quality || 100;
            
            const actualQuantity = Math.max(1, Math.floor(quantity * yieldModifier));
            
            if (actualQuantity > 0) {
                materials.push({
                    name: materialDef.name,
                    quantity: actualQuantity,
                    quality: Math.floor(quality * yieldModifier)
                });
            }
        }
        
        return materials;
    }
    
    /**
     * Drop materials on ground
     */
    dropMaterials(materials, x, y, z) {
        const player = this.game.player;
        
        // Map drop-table display names → component IDs in ContentManager
        const DROP_NAME_TO_COMPONENT = {
            'Glass Shards': 'glass_shard',
            'Glass Shard':  'glass_shard',
            'Metal Scraps': 'scrap_metal_shard',
            'Metal Shard':  'scrap_metal_shard',
            'Wood Plank':   'wood_plank',
            'Wood Piece':   'wood_piece',
            'Nails':        'nail',
            'Nail':         'nail',
            'Screws':       'screw',
            'Screw':        'screw',
            'Fabric Panel': 'fabric_panel',
            'Pipe':         'metal_tube',
            'Bone Shard':   'bone_shard',
            'Rubber Piece': 'rubber_piece',
            'Duct Tape':    'duct_tape',
            'Cloth Wrap':   'cloth_wrap',
            'Stone':        'stone'
        };
        
        for (const material of materials) {
            // Try to create a proper component via ContentManager
            const componentId = DROP_NAME_TO_COMPONENT[material.name];
            let materialItem = null;
            
            if (componentId && this.game.content) {
                materialItem = this.game.content.createComponent(componentId);
            }
            
            if (materialItem) {
                // Override quantity/quality from the drop table roll
                materialItem.quantity = material.quantity;
                materialItem.quality = material.quality || 100;
                materialItem.maxQuality = 100;
            } else {
                // Fallback: create bare item for unknown materials (e.g. Steel Plate)
                materialItem = {
                    id: `${material.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random()}`,
                    name: material.name,
                    type: 'component',
                    glyph: '*',
                    color: '#ffaa00',
                    weight: material.quantity * 10,
                    volume: material.quantity * 5,
                    quality: material.quality || 100,
                    maxQuality: 100,
                    quantity: material.quantity,
                    stackable: true,
                    tags: ['material', 'salvage'],
                    isComponent: true
                };
            }
            
            materialItem.x = x;
            materialItem.y = y;
            materialItem.z = z;
            
            // Try to add to player inventory first
            const addResult = player.addToInventory(materialItem);
            if (!addResult.success) {
                // Inventory full, drop on ground
                this.game.world.addItem(materialItem);
                this.game.ui.log(`${material.name} x${material.quantity} dropped on ground (no storage space).`, 'warning');
            } else {
                this.game.ui.log(`Recovered ${material.name} x${material.quantity}.`, 'info');
            }
        }
    }
    
    /**
     * Find tool in player inventory/equipment
     */
    findTool(player, toolType) {
        // Check equipment
        for (const slot in player.equipment) {
            const item = player.equipment[slot];
            if (!item) continue;
            
            if (this.isToolType(item, toolType)) {
                return item;
            }
        }
        
        // Check inventory
        for (const item of player.inventory) {
            if (this.isToolType(item, toolType)) {
                return item;
            }
        }
        
        return null;
    }
    
    /**
     * Check if item matches tool type
     */
    isToolType(item, toolType) {
        if (!item.tags) return false;
        
        const toolMap = {
            'screwdriver': ['screwdriver', 'multitool'],
            'crowbar': ['crowbar', 'prybar'],
            'hacksaw': ['hacksaw', 'saw'],
            'lockpick': ['lockpick', 'lockpick_set']
        };
        
        const validTags = toolMap[toolType] || [toolType];
        
        return validTags.some(tag => item.tags.includes(tag));
    }
}
