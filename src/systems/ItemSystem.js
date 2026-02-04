export class ItemSystem {
    constructor(game) {
        this.game = game;
    }
    
    splitItem(item, amount) {
        if (!item.quantity || !item.quantityUnit) {
            return null;
        }
        
        if (amount >= item.quantity) {
            return null;
        }
        
        const newItem = { ...item };
        newItem.id = `${item.name}_${Date.now()}_${Math.random()}`;
        newItem.quantity = amount;
        
        if (item.state) {
            newItem.state = { ...item.state };
        }
        
        item.quantity -= amount;
        
        const weightPerUnit = item.weight / (item.quantity + amount);
        const volumePerUnit = item.volume / (item.quantity + amount);
        
        item.weight = Math.floor(weightPerUnit * item.quantity);
        item.volume = Math.floor(volumePerUnit * item.quantity);
        newItem.weight = Math.floor(weightPerUnit * amount);
        newItem.volume = Math.floor(volumePerUnit * amount);
        
        return newItem;
    }
    
    getAvailableOpeningTools(player, container) {
        if (!container.openMethods) return [];
        
        const tools = [];
        
        for (const [toolType, method] of Object.entries(container.openMethods)) {
            if (toolType === 'hand') {
                tools.push({
                    type: 'hand',
                    name: 'Your Hands',
                    item: null,
                    yield: method.yield,
                    durabilityDamage: method.durabilityDamage
                });
                continue;
            }
            
            if (toolType === 'ground') {
                tools.push({
                    type: 'ground',
                    name: 'Smash on Ground',
                    item: null,
                    yield: method.yield,
                    durabilityDamage: method.durabilityDamage
                });
                continue;
            }
            
            const equippedTool = this.findToolInEquipment(player, toolType);
            if (equippedTool) {
                tools.push({
                    type: toolType,
                    name: equippedTool.name,
                    item: equippedTool,
                    yield: method.yield,
                    durabilityDamage: method.durabilityDamage,
                    location: 'equipped'
                });
                continue;
            }
            
            const inventoryTool = this.findToolInInventory(player, toolType);
            if (inventoryTool) {
                tools.push({
                    type: toolType,
                    name: inventoryTool.name,
                    item: inventoryTool,
                    yield: method.yield,
                    durabilityDamage: method.durabilityDamage,
                    location: 'inventory'
                });
            }
        }
        
        return tools;
    }
    
    findToolInEquipment(player, toolType) {
        for (const slot in player.equipment) {
            const item = player.equipment[slot];
            if (!item) continue;
            
            if (toolType === 'can_opener' && item.tags && item.tags.includes('opener')) {
                return item;
            }
            if (toolType === 'knife' && item.tags && item.tags.includes('sharp')) {
                return item;
            }
            if (toolType === 'pipe' && item.tags && item.tags.includes('blunt')) {
                return item;
            }
        }
        return null;
    }
    
    findToolInInventory(player, toolType) {
        for (const item of player.inventory) {
            if (toolType === 'can_opener' && item.tags && item.tags.includes('opener')) {
                return item;
            }
            if (toolType === 'knife' && item.tags && item.tags.includes('sharp')) {
                return item;
            }
            if (toolType === 'pipe' && item.tags && item.tags.includes('blunt')) {
                return item;
            }
        }
        return null;
    }
    
    openContainer(container, tool, player) {
        if (!container.state || container.state.opened) {
            return { success: false, message: 'Already opened.' };
        }
        
        if (!container.openMethods || !container.openMethods[tool.type]) {
            return { success: false, message: 'Cannot open with this tool.' };
        }
        
        const method = container.openMethods[tool.type];
        
        // Ensure state object exists
        if (!container.state) {
            container.state = {};
        }
        
        container.state.opened = true;
        container.state.sealed = false;
        
        // Update container name to show opened status
        if (!container.name.includes('[OPENED]')) {
            container.name = container.name.replace('Sealed', 'Opened');
        }
        
        if (tool.item && method.durabilityDamage > 0) {
            tool.item.durability = Math.max(0, tool.item.durability - method.durabilityDamage);
            if (tool.item.durability <= 0) {
                this.game.ui.log(`Your ${tool.item.name} broke!`, 'warning');
            }
        }
        
        const spilledItems = [];
        if (method.yield < 1.0 && container.contents.length > 0) {
            for (const content of container.contents) {
                if (content.quantity) {
                    const spillAmount = Math.floor(content.quantity * (1 - method.yield));
                    if (spillAmount > 0) {
                        const spilledItem = this.splitItem(content, spillAmount);
                        if (spilledItem) {
                            spilledItem.state = { contaminated: true };
                            spilledItem.x = player.x;
                            spilledItem.y = player.y;
                            spilledItems.push(spilledItem);
                        }
                    }
                }
            }
        }
        
        return {
            success: true,
            message: `Opened ${container.name} with ${tool.name}.`,
            spilledItems: spilledItems,
            yield: method.yield
        };
    }
    
    calculateOptimalConsumption(item, player) {
        if (!item.quantity || !item.nutrition) {
            return item.quantity || 1;
        }
        
        const hungerNeeded = player.maxHunger - player.hunger;
        const thirstNeeded = player.maxThirst - player.thirst;
        
        const hungerPerUnit = item.nutrition.hunger / item.quantity;
        const thirstPerUnit = item.nutrition.thirst / item.quantity;
        
        let amountForHunger = Infinity;
        let amountForThirst = Infinity;
        
        if (hungerPerUnit > 0 && hungerNeeded > 0) {
            amountForHunger = Math.ceil(hungerNeeded / hungerPerUnit);
        }
        if (thirstPerUnit > 0 && thirstNeeded > 0) {
            amountForThirst = Math.ceil(thirstNeeded / thirstPerUnit);
        }
        
        const optimalAmount = Math.min(
            item.quantity,
            amountForHunger,
            amountForThirst
        );
        
        // If player is full or calculation resulted in invalid amount, consume all
        if (optimalAmount === Infinity || optimalAmount <= 0) {
            return item.quantity;
        }
        
        return optimalAmount;
    }
    
    consumeFood(item, player, amount = null) {
        if (!item.nutrition) {
            return { success: false, message: 'This is not consumable.' };
        }
        
        // Check if item has quantity and it's 0 or less
        if (item.quantity !== undefined && item.quantity <= 0) {
            return { success: false, message: 'Nothing left to consume.' };
        }
        
        // Smart consumption: calculate optimal amount if not specified
        let consumeAmount = amount;
        if (consumeAmount === null && item.quantity) {
            consumeAmount = this.calculateOptimalConsumption(item, player);
        } else if (consumeAmount === null) {
            consumeAmount = item.quantity || 1;
        }
        
        if (item.quantity && consumeAmount > item.quantity) {
            return { success: false, message: 'Not enough to consume.' };
        }
        
        // Calculate ratio - if no quantity system, consume all (ratio 1.0)
        // If quantity exists, calculate based on amount consumed
        const ratio = item.quantity ? (consumeAmount / item.quantity) : 1.0;
        
        if (item.nutrition.hunger) {
            player.hunger = Math.min(player.maxHunger, player.hunger + (item.nutrition.hunger * ratio));
        }
        if (item.nutrition.thirst) {
            player.thirst = Math.min(player.maxThirst, player.thirst + (item.nutrition.thirst * ratio));
        }
        
        if (item.state && item.state.contaminated) {
            let contaminationLevel = 0.3;
            
            // Apply ironStomach trait resistance
            if (player.traitEffects && player.traitEffects.poisonResist) {
                contaminationLevel *= (1 - player.traitEffects.poisonResist);
            }
            
            // Only apply sickness if contamination level is significant
            if (contaminationLevel > 0.05) {
                const sicknessDuration = Math.floor(10 * contaminationLevel);
                const sicknessValue = Math.floor(-1 * contaminationLevel);
                
                player.addStatusEffect({
                    type: 'sickness',
                    value: sicknessValue,
                    duration: sicknessDuration,
                    name: 'Food Poisoning'
                });
            }
        }
        
        if (item.quantity) {
            item.quantity -= consumeAmount;
            
            const weightPerUnit = item.weight / (item.quantity + consumeAmount);
            const volumePerUnit = item.volume / (item.quantity + consumeAmount);
            item.weight = Math.floor(weightPerUnit * item.quantity);
            item.volume = Math.floor(volumePerUnit * item.quantity);
        }
        
        return {
            success: true,
            consumed: consumeAmount,
            remaining: item.quantity || 0,
            contaminated: item.state && item.state.contaminated
        };
    }
}
