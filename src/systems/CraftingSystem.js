// Ground surfaces that provide crafting properties when standing on them
// The player can grind/sharpen items on concrete, stone, asphalt, etc.
const SURFACE_PROPERTIES = {
    // Concrete/paved surfaces provide grinding
    'Paved Ground':     { grinding: 1 },
    'Concrete Floor':   { grinding: 2 },
    'Sidewalk':         { grinding: 1 },
    'City Street':      { grinding: 1 },
    'Side Street':      { grinding: 1 },
    'Paved Road':       { grinding: 1 },
    'Asphalt Street':   { grinding: 1 },
    'Cracked Floor':    { grinding: 1 },
    'Cracked Pavement': { grinding: 1 },
    'Floor':            { grinding: 1 },
    // Stone/brick surfaces
    'Pristine Road':    { grinding: 1 },
    'Private Drive':    { grinding: 1 },
    'Suburban Road':    { grinding: 1 },
    'Residential Street': { grinding: 1 },
    'Manicured Ground': { grinding: 1 }
};

export class CraftingSystem {
    constructor(game) {
        this.game = game;
    }
    
    /**
     * Get crafting properties provided by the ground surface under the player.
     * Returns a virtual component object or null if the surface has no properties.
     */
    getSurfaceProperties(player) {
        const tile = this.game.world.getTile(player.x, player.y, player.z);
        if (!tile || !tile.name) return null;
        
        const props = SURFACE_PROPERTIES[tile.name];
        if (!props) return null;
        
        return {
            id: '__surface__',
            componentId: '__surface__',
            name: tile.name,
            type: 'component',
            isComponent: true,
            isSurface: true,
            quantity: 999,
            properties: { ...props },
            tags: ['surface']
        };
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
        
        // Check for tool-based disassembly methods (knife, screwdriver, prybar, etc.)
        // Each method type maps to a required property on an equipped item
        const TOOL_PROPERTY_MAP = {
            knife:       { property: 'cutting',      minValue: 1, name: 'Sharp Tool' },
            screwdriver: { property: 'screwdriving',  minValue: 1, name: 'Screwdriver' },
            prybar:      { property: 'prying',        minValue: 1, name: 'Pry Tool' },
            wrench:      { property: 'bolt_turning',  minValue: 1, name: 'Wrench' }
        };
        
        for (const [toolType, toolReq] of Object.entries(TOOL_PROPERTY_MAP)) {
            if (!methods[toolType]) continue;
            
            const hasTool = this.playerHasToolProperty(player, toolReq.property, toolReq.minValue, item);
            
            tools.push({
                type: toolType,
                name: toolReq.name,
                ...methods[toolType],
                available: hasTool
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
     * Check if player has an equipped/carried item with a specific tool property.
     * @param {Object} player - Player object
     * @param {string} property - Property name to check (e.g., 'cutting', 'screwdriving')
     * @param {number} minValue - Minimum property value required
     * @param {Object} excludeItem - Item to exclude (the item being disassembled)
     * @returns {boolean}
     */
    playerHasToolProperty(player, property, minValue, excludeItem = null) {
        const candidates = [
            player.equipment.leftHand,
            player.equipment.rightHand
        ];
        
        for (const item of candidates) {
            if (!item || item === excludeItem) continue;
            
            // Check item properties (components have these)
            if (item.properties && item.properties[property] >= minValue) return true;
            
            // Check craftedProperties (crafted intermediates)
            if (item.craftedProperties && item.craftedProperties[property] >= minValue) return true;
            
            // Backward compat: sharp weapons satisfy 'cutting' even without explicit property
            if (property === 'cutting' && item.weaponStats?.attackType === 'sharp') return true;
            if (property === 'cutting' && item.tags?.includes('sharp')) return true;
        }
        
        return false;
    }
    
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
        // Prevent items from being used to craft themselves
        const selfId = itemFamily.craftedComponentId || null;
        
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
                // Exclude the recipe's own output type to prevent self-crafting loops
                matchingComponents = availableComponents.filter(comp => 
                    this.matchesRequirement(comp, requirement) &&
                    comp.componentId !== selfId
                );
            }
            
            // Skip ghost items with quantity 0 (consumed but not removed)
            const validComponents = matchingComponents.filter(c => c.quantity === undefined || c.quantity > 0);
            const totalQuantity = validComponents.reduce((sum, c) => sum + (c.quantity || 1), 0);
            
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
        
        // 5. Check ground surface properties (concrete provides grinding, etc.)
        const surface = this.getSurfaceProperties(player);
        if (surface) {
            components.push(surface);
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
            
            // Prevent items from being used to craft themselves
            const selfId = itemFamily.craftedComponentId || null;
            
            if (requirement.component) {
                // Specific component requirement - match by componentId or id prefix
                available = this.getPlayerComponents(player).filter(comp => 
                    comp.componentId === requirement.component || 
                    (comp.id && comp.id.startsWith(requirement.component))
                );
            } else if (requirement.property) {
                // Property-based requirement with maxValue support
                // Exclude the recipe's own output type to prevent self-crafting loops
                available = this.getPlayerComponents(player).filter(comp => 
                    this.matchesRequirement(comp, requirement) &&
                    comp.componentId !== selfId
                );
            }
            
            // Skip ghost items with quantity 0
            const validAvailable = available.filter(c => c.quantity === undefined || c.quantity > 0);
            
            for (const comp of validAvailable) {
                if (remaining <= 0) break;
                if (comp.isSurface) {
                    // Surface is infinite, just count it as satisfying the requirement
                    componentsUsed.push({ ...comp, consumed: remaining });
                    remaining = 0;
                    break;
                }
                
                const compQuantity = comp.quantity !== undefined ? comp.quantity : 1;
                const toConsume = Math.min(compQuantity, remaining);
                
                if (comp.quantity !== undefined) {
                    comp.quantity -= toConsume;
                }
                remaining -= toConsume;
                componentsUsed.push({ ...comp, consumed: toConsume });
                
                // Remove component if fully consumed
                if (comp.quantity === undefined || comp.quantity <= 0) {
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
