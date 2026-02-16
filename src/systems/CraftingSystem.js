export class CraftingSystem {
    constructor(game) {
        this.game = game;
    }
    
    /**
     * Get available disassembly tools for an item
     * @param {Object} player - Player object
     * @param {Object} item - Item to disassemble
     * @returns {Array} - Available tools with their effects
     */
    getAvailableDisassemblyTools(player, item) {
        const tools = [];
        const methods = item.disassemblyMethods || {
            hand: { componentYield: 1.0, qualityMod: 0.7, timeRequired: 1 }
        };
        
        // Always available: bare hands
        if (methods.hand) {
            tools.push({
                type: 'hand',
                name: 'Bare Hands',
                ...methods.hand,
                available: true
            });
        }
        
        // Check for knife (excluding the item being disassembled)
        if (methods.knife) {
            const leftHandTool = player.equipment.leftHand;
            const rightHandTool = player.equipment.rightHand;
            
            const hasKnife = (leftHandTool?.tags?.includes('sharp') && leftHandTool !== item) ||
                           (rightHandTool?.tags?.includes('sharp') && rightHandTool !== item);
            
            tools.push({
                type: 'knife',
                name: 'Knife/Sharp Tool',
                ...methods.knife,
                available: hasKnife
            });
        }
        
        return tools;
    }
    
    /**
     * Disassemble an item into its components
     * @param {Object} item - Item to disassemble
     * @param {Object} toolMethod - Tool method from disassemblyMethods
     * @returns {Object} - { success, components, message }
     */
    disassembleItem(item, toolMethod) {
        if (!item.components || item.components.length === 0) {
            return {
                success: false,
                components: [],
                message: `${item.name} cannot be disassembled.`
            };
        }
        
        const qualityModifier = toolMethod.qualityMod || 0.7;
        const componentYield = toolMethod.componentYield || 1.0;
        const excludeComponents = toolMethod.excludeComponents || [];
        
        // Calculate item condition modifier
        const conditionModifier = item.durability ? (item.durability / 100) : 1.0;
        
        // Create component items with adjusted quality
        const recoveredComponents = [];
        for (const comp of item.components) {
            // Skip excluded components
            if (excludeComponents.includes(comp.id)) {
                continue;
            }
            
            // Apply component yield (some components may not be recovered)
            const recoveredQuantity = Math.floor(comp.quantity * componentYield);
            if (recoveredQuantity === 0) continue;
            
            const finalQuality = Math.floor(comp.quality * qualityModifier * conditionModifier);
            
            // Create a component item
            const componentItem = this.createComponentItem(comp, finalQuality, recoveredQuantity);
            if (componentItem) {
                recoveredComponents.push(componentItem);
            }
        }
        
        return {
            success: true,
            components: recoveredComponents,
            message: `Disassembled ${item.name} into ${recoveredComponents.length} component(s).`,
            qualityModifier,
            conditionModifier
        };
    }
    
    /**
     * Create a component item from component definition
     * @param {Object} compDef - Component definition from item
     * @param {number} quality - Quality percentage (0-100)
     * @param {number} quantity - Quantity override (optional)
     * @returns {Object} - Component item
     */
    createComponentItem(compDef, quality, quantity = null) {
        const componentTemplate = this.game.content.components[compDef.id];
        if (!componentTemplate) {
            console.warn(`Component template not found: ${compDef.id}`);
            return null;
        }
        
        // Create component item
        const component = {
            id: `${compDef.id}_${Date.now()}_${Math.random()}`,
            componentId: compDef.id, // Store base component ID for matching
            name: compDef.name,
            type: 'component',
            glyph: '*',
            color: '#ffaa00',
            weight: compDef.weight,
            volume: compDef.volume,
            quality: quality,
            maxQuality: compDef.maxQuality,
            quantity: quantity !== null ? quantity : compDef.quantity,
            stackable: componentTemplate.stackable,
            tags: componentTemplate.tags || [],
            properties: componentTemplate.properties || {}, // Copy properties from template
            isComponent: true
        };
        
        return component;
    }
    
    /**
     * Get disassembly preview for an item with specific tool
     * @param {Object} item - Item to preview
     * @param {Object} toolMethod - Tool method from disassemblyMethods
     * @returns {Object} - Preview data
     */
    getDisassemblyPreview(item, toolMethod) {
        if (!item.components || item.components.length === 0) {
            return {
                canDisassemble: false,
                message: 'This item cannot be disassembled.'
            };
        }
        
        const qualityModifier = toolMethod.qualityMod || 0.7;
        const componentYield = toolMethod.componentYield || 1.0;
        const excludeComponents = toolMethod.excludeComponents || [];
        const conditionModifier = item.durability ? (item.durability / 100) : 1.0;
        
        const preview = {
            canDisassemble: true,
            components: [],
            qualityModifier,
            conditionModifier,
            componentYield,
            timeRequired: toolMethod.timeRequired || 1,
            injuryRisk: 0.0 // TODO: Add injury system
        };
        
        for (const comp of item.components) {
            if (excludeComponents.includes(comp.id)) {
                continue;
            }
            
            const recoveredQuantity = Math.floor(comp.quantity * componentYield);
            if (recoveredQuantity === 0) continue;
            
            const finalQuality = Math.floor(comp.quality * qualityModifier * conditionModifier);
            preview.components.push({
                name: comp.name,
                quantity: recoveredQuantity,
                quality: finalQuality,
                maxQuality: comp.maxQuality
            });
        }
        
        return preview;
    }
    
    /**
     * Check if player can disassemble (has free hands, etc.)
     * @param {Object} player - Player object
     * @returns {Object} - { canDisassemble, reason }
     */
    canPlayerDisassemble(player) {
        // Check if hands are free (both equipment AND carrying)
        const leftBusy = player.equipment.leftHand || player.carrying.leftHand;
        const rightBusy = player.equipment.rightHand || player.carrying.rightHand;
        
        // At least one hand must be free
        if (leftBusy && rightBusy) {
            return {
                canDisassemble: false,
                reason: 'You need at least one free hand to disassemble items. Unequip or drop something first.'
            };
        }
        
        return {
            canDisassemble: true,
            reason: null
        };
    }
    
    /**
     * Get the effective property value for a component.
     * Checks craftedProperties first (for crafted intermediates), then base properties.
     */
    getComponentProperty(comp, property) {
        // Crafted items store their output properties in craftedProperties
        if (comp.craftedProperties && comp.craftedProperties[property] !== undefined) {
            return comp.craftedProperties[property];
        }
        const properties = comp.properties || {};
        return properties[property] || 0;
    }
    
    /**
     * Check if a component matches a property requirement (respects maxValue)
     */
    matchesRequirement(comp, requirement) {
        const value = this.getComponentProperty(comp, requirement.property);
        if (value < requirement.minValue) return false;
        if (requirement.maxValue !== undefined && value > requirement.maxValue) return false;
        return true;
    }
    
    canCraftItem(player, itemFamily) {
        if (!itemFamily.componentRequirements || itemFamily.componentRequirements.length === 0) {
            return { canCraft: false, missingComponents: [] };
        }
        
        const missingComponents = [];
        const availableComponents = this.getPlayerComponents(player);
        
        for (const requirement of itemFamily.componentRequirements) {
            let matchingComponents = [];
            
            if (requirement.component) {
                // Specific component requirement - match by componentId or id prefix
                matchingComponents = availableComponents.filter(comp => 
                    comp.componentId === requirement.component || 
                    (comp.id && comp.id.startsWith(requirement.component))
                );
            } else if (requirement.property) {
                // Property-based requirement with optional maxValue cap
                matchingComponents = availableComponents.filter(comp => 
                    this.matchesRequirement(comp, requirement)
                );
            }
            
            const totalQuantity = matchingComponents.reduce((sum, c) => sum + (c.quantity || 1), 0);
            
            if (totalQuantity < requirement.quantity) {
                missingComponents.push({
                    component: requirement.component,
                    property: requirement.property,
                    minValue: requirement.minValue,
                    maxValue: requirement.maxValue,
                    name: requirement.name,
                    have: totalQuantity,
                    need: requirement.quantity
                });
            }
        }
        
        return {
            canCraft: missingComponents.length === 0,
            missingComponents
        };
    }
    
    /**
     * Get all components from all accessible locations
     * @param {Object} player - Player object
     * @returns {Array} - Component items
     */
    getPlayerComponents(player) {
        const components = [];
        
        // 1. Check equipped items
        for (const [slot, item] of Object.entries(player.equipment)) {
            if (item && typeof item === 'object' && item.isComponent) {
                components.push(item);
            }
        }
        
        // 2. Check carried items
        if (player.carrying.leftHand?.isComponent) {
            components.push(player.carrying.leftHand);
        }
        if (player.carrying.rightHand?.isComponent && player.carrying.rightHand !== player.carrying.leftHand) {
            components.push(player.carrying.rightHand);
        }
        
        // 3. Check stored items (in containers/pockets)
        const storedItems = player.containerSystem.getAllStoredItems(player);
        for (const stored of storedItems) {
            if (stored.item.isComponent) {
                components.push(stored.item);
            }
        }
        
        // 4. Check ground items
        const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
        for (const item of groundItems) {
            if (item.isComponent) {
                components.push(item);
            }
        }
        
        return components;
    }
    
    /**
     * Craft an item from components
     * @param {Object} player - Player object
     * @param {string} itemFamilyId - Item family ID to craft
     * @returns {Object} - { success, item, message }
     */
    craftItem(player, itemFamilyId) {
        const itemFamily = this.game.content.itemFamilies[itemFamilyId];
        if (!itemFamily) {
            return { success: false, message: 'Unknown item type.' };
        }
        
        const canCraft = this.canCraftItem(player, itemFamily);
        if (!canCraft.canCraft) {
            return { success: false, message: 'Missing required components.', missingComponents: canCraft.missingComponents };
        }
        
        // Consume components from all locations
        const componentsUsed = [];
        for (const requirement of itemFamily.componentRequirements) {
            let remaining = requirement.quantity;
            let available = [];
            
            if (requirement.component) {
                // Specific component requirement - match by componentId or id prefix
                available = this.getPlayerComponents(player).filter(comp => 
                    comp.componentId === requirement.component || 
                    (comp.id && comp.id.startsWith(requirement.component))
                );
            } else if (requirement.property) {
                // Property-based requirement with maxValue support
                available = this.getPlayerComponents(player).filter(comp => 
                    this.matchesRequirement(comp, requirement)
                );
            }
            
            for (const comp of available) {
                if (remaining <= 0) break;
                
                const compQuantity = comp.quantity || 1;
                const toConsume = Math.min(compQuantity, remaining);
                
                if (comp.quantity) {
                    comp.quantity -= toConsume;
                }
                remaining -= toConsume;
                componentsUsed.push({ ...comp, consumed: toConsume });
                
                // Remove component if fully consumed
                if (!comp.quantity || comp.quantity <= 0) {
                    this.removeComponentFromLocation(player, comp);
                }
            }
        }
        
        // Create the crafted item
        const craftedItem = this.game.content.createItem(itemFamilyId);
        
        // Calculate quality based on component quality
        const validQualities = componentsUsed.filter(c => c.quality !== undefined);
        const avgQuality = validQualities.length > 0 
            ? validQualities.reduce((sum, c) => sum + c.quality, 0) / validQualities.length 
            : 100;
        craftedItem.durability = Math.floor(avgQuality);
        
        // If this is a craftable component, copy craftedProperties so it can be used in further recipes
        if (itemFamily.craftedComponentId) {
            craftedItem.isComponent = true;
            craftedItem.componentId = itemFamily.craftedComponentId;
            craftedItem.craftedProperties = itemFamily.craftedProperties || {};
            // Also merge into base properties for display
            craftedItem.properties = { ...(craftedItem.properties || {}), ...craftedItem.craftedProperties };
        }
        
        return {
            success: true,
            item: craftedItem,
            message: `Crafted ${craftedItem.name}.`,
            componentsUsed,
            craftTime: itemFamily.craftTime || 1
        };
    }
    
    /**
     * Remove a component from its actual location
     * @param {Object} player - Player object
     * @param {Object} component - Component to remove
     */
    removeComponentFromLocation(player, component) {
        // Check equipped slots
        for (const [slot, item] of Object.entries(player.equipment)) {
            if (item === component) {
                player.equipment[slot] = null;
                return;
            }
        }
        
        // Check carried hands
        if (player.carrying.leftHand === component) {
            player.carrying.leftHand = null;
            return;
        }
        if (player.carrying.rightHand === component) {
            player.carrying.rightHand = null;
            return;
        }
        
        // Check stored items (containers/pockets)
        const storedItems = player.containerSystem.getAllStoredItems(player);
        for (const stored of storedItems) {
            if (stored.item === component) {
                player.containerSystem.removeItem(stored.container, component, stored.pocketIndex);
                const invIndex = player.inventory.indexOf(component);
                if (invIndex !== -1) player.inventory.splice(invIndex, 1);
                return;
            }
        }
        
        // Check ground
        const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
        if (groundItems.includes(component)) {
            this.game.world.removeItem(component);
            return;
        }
    }
}
