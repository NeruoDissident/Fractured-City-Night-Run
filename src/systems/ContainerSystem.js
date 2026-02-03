export class ContainerSystem {
    constructor() {
        this.weightUnits = 'g'; // grams
        this.volumeUnits = 'cm³'; // cubic centimeters
    }
    
    canFitItem(container, item) {
        if (!container.isContainer) {
            return { canFit: false, reason: 'Not a container' };
        }
        
        const currentWeight = this.getTotalWeight(container);
        const currentVolume = this.getTotalVolume(container);
        
        const itemWeight = this.getItemWeight(item);
        const itemVolume = this.getItemVolume(item);
        
        if (currentWeight + itemWeight > container.maxWeight) {
            return { 
                canFit: false, 
                reason: `Too heavy (${currentWeight + itemWeight}g / ${container.maxWeight}g)` 
            };
        }
        
        if (currentVolume + itemVolume > container.maxVolume) {
            return { 
                canFit: false, 
                reason: `Too bulky (${currentVolume + itemVolume}cm³ / ${container.maxVolume}cm³)` 
            };
        }
        
        return { canFit: true };
    }
    
    canFitInPocket(pocket, item) {
        if (!pocket) {
            return { canFit: false, reason: 'Invalid pocket' };
        }
        
        const currentWeight = this.getPocketWeight(pocket);
        const currentVolume = this.getPocketVolume(pocket);
        
        const itemWeight = this.getItemWeight(item);
        const itemVolume = this.getItemVolume(item);
        
        if (currentWeight + itemWeight > pocket.maxWeight) {
            return { 
                canFit: false, 
                reason: `Too heavy for pocket (${currentWeight + itemWeight}g / ${pocket.maxWeight}g)` 
            };
        }
        
        if (currentVolume + itemVolume > pocket.maxVolume) {
            return { 
                canFit: false, 
                reason: `Too bulky for pocket (${currentVolume + itemVolume}cm³ / ${pocket.maxVolume}cm³)` 
            };
        }
        
        return { canFit: true };
    }
    
    addItem(container, item, pocketIndex = null) {
        if (pocketIndex !== null && container.pockets && container.pockets[pocketIndex]) {
            const pocket = container.pockets[pocketIndex];
            const canFit = this.canFitInPocket(pocket, item);
            
            if (!canFit.canFit) {
                return { success: false, message: canFit.reason };
            }
            
            if (!pocket.contents) {
                pocket.contents = [];
            }
            
            pocket.contents.push(item);
            item.containedIn = { container, pocketIndex };
            
            return { success: true, message: `Added to ${pocket.name}` };
        }
        
        const canFit = this.canFitItem(container, item);
        
        if (!canFit.canFit) {
            return { success: false, message: canFit.reason };
        }
        
        if (!container.contents) {
            container.contents = [];
        }
        
        container.contents.push(item);
        item.containedIn = { container };
        
        return { success: true, message: `Added to ${container.name}` };
    }
    
    removeItem(container, item) {
        if (container.contents) {
            const index = container.contents.indexOf(item);
            if (index > -1) {
                container.contents.splice(index, 1);
                delete item.containedIn;
                return { success: true };
            }
        }
        
        if (container.pockets) {
            for (const pocket of container.pockets) {
                if (pocket.contents) {
                    const index = pocket.contents.indexOf(item);
                    if (index > -1) {
                        pocket.contents.splice(index, 1);
                        delete item.containedIn;
                        return { success: true };
                    }
                }
            }
        }
        
        return { success: false, message: 'Item not found in container' };
    }
    
    getItemWeight(item) {
        if (!item) return 0;
        
        let weight = item.weight;
        
        if (weight === undefined || weight === null) {
            weight = this.estimateWeight(item);
        }
        
        if (item.isContainer && item.contents) {
            for (const containedItem of item.contents) {
                weight += this.getItemWeight(containedItem);
            }
        }
        
        if (item.pockets) {
            for (const pocket of item.pockets) {
                if (pocket.contents) {
                    for (const pocketItem of pocket.contents) {
                        weight += this.getItemWeight(pocketItem);
                    }
                }
            }
        }
        
        return weight;
    }
    
    getItemVolume(item) {
        if (!item) return 0;
        
        let volume = item.volume;
        
        if (volume === undefined || volume === null) {
            volume = this.estimateVolume(item);
        }
        
        return volume;
    }
    
    estimateWeight(item) {
        if (!item || !item.type) return 100;
        
        const typeWeights = {
            weapon: 500,
            armor: 1000,
            consumable: 300,
            component: 100,
            container: 500
        };
        
        return typeWeights[item.type] || 100;
    }
    
    estimateVolume(item) {
        if (!item || !item.type) return 100;
        
        const typeVolumes = {
            weapon: 400,
            armor: 2000,
            consumable: 500,
            component: 100,
            container: 1000
        };
        
        return typeVolumes[item.type] || 100;
    }
    
    getTotalWeight(container) {
        if (!container) return 0;
        
        let weight = 0;
        
        if (container.contents) {
            for (const item of container.contents) {
                weight += this.getItemWeight(item);
            }
        }
        
        if (container.pockets) {
            for (const pocket of container.pockets) {
                if (pocket.contents) {
                    for (const item of pocket.contents) {
                        weight += this.getItemWeight(item);
                    }
                }
            }
        }
        
        return weight;
    }
    
    getTotalVolume(container) {
        if (!container) return 0;
        
        let volume = 0;
        
        if (container.contents) {
            for (const item of container.contents) {
                volume += this.getItemVolume(item);
            }
        }
        
        return volume;
    }
    
    getPocketWeight(pocket) {
        if (!pocket || !pocket.contents) return 0;
        
        let weight = 0;
        for (const item of pocket.contents) {
            weight += this.getItemWeight(item);
        }
        
        return weight;
    }
    
    getPocketVolume(pocket) {
        if (!pocket || !pocket.contents) return 0;
        
        let volume = 0;
        for (const item of pocket.contents) {
            volume += this.getItemVolume(item);
        }
        
        return volume;
    }
    
    getAllItems(container, includeNested = true) {
        const items = [];
        
        if (container.contents) {
            for (const item of container.contents) {
                items.push(item);
                
                if (includeNested && item.isContainer) {
                    items.push(...this.getAllItems(item, true));
                }
            }
        }
        
        if (container.pockets) {
            for (const pocket of container.pockets) {
                if (pocket.contents) {
                    for (const item of pocket.contents) {
                        items.push(item);
                        
                        if (includeNested && item.isContainer) {
                            items.push(...this.getAllItems(item, true));
                        }
                    }
                }
            }
        }
        
        return items;
    }
    
    findItem(container, itemId) {
        const allItems = this.getAllItems(container, true);
        return allItems.find(item => item.id === itemId);
    }
    
    getContainerPath(item) {
        const path = [];
        let current = item;
        
        while (current && current.containedIn) {
            const containerInfo = current.containedIn;
            
            if (containerInfo.pocketIndex !== undefined) {
                const pocket = containerInfo.container.pockets[containerInfo.pocketIndex];
                path.unshift(`${containerInfo.container.name} → ${pocket.name}`);
            } else {
                path.unshift(containerInfo.container.name);
            }
            
            current = containerInfo.container;
        }
        
        return path.length > 0 ? path.join(' → ') : 'Ground';
    }
    
    formatWeight(grams) {
        if (grams >= 1000) {
            return `${(grams / 1000).toFixed(2)} kg`;
        }
        return `${grams} g`;
    }
    
    formatVolume(volume) {
        if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}L`;
        }
        return `${volume}${this.volumeUnits}`;
    }
    
    findAvailableStorage(player, item) {
        const itemWeight = this.getItemWeight(item);
        const itemVolume = this.getItemVolume(item);
        
        const storageOptions = [];
        
        // Check equipped items with pockets
        for (const slot in player.equipment) {
            const equippedItem = player.equipment[slot];
            if (equippedItem && equippedItem.pockets) {
                for (let i = 0; i < equippedItem.pockets.length; i++) {
                    const pocket = equippedItem.pockets[i];
                    const canFit = this.canFitInPocket(pocket, item);
                    if (canFit.canFit) {
                        storageOptions.push({
                            type: 'pocket',
                            item: equippedItem,
                            pocketIndex: i,
                            pocket: pocket,
                            location: `${equippedItem.name} - ${pocket.name}`
                        });
                    }
                }
            }
        }
        
        // Check inventory containers (backpacks, etc.)
        for (let i = 0; i < player.inventory.length; i++) {
            const invItem = player.inventory[i];
            if (invItem.isContainer && !invItem.pockets) {
                const canFit = this.canFitItem(invItem, item);
                if (canFit.canFit) {
                    storageOptions.push({
                        type: 'container',
                        item: invItem,
                        location: invItem.name
                    });
                }
            }
        }
        
        return storageOptions;
    }
    
    autoStoreItem(player, item) {
        const storageOptions = this.findAvailableStorage(player, item);
        
        if (storageOptions.length === 0) {
            return { success: false, message: 'No storage space available', reason: 'No pockets or containers with space' };
        }
        
        // Prefer pockets on equipped items first, then containers
        const pocketOptions = storageOptions.filter(opt => opt.type === 'pocket');
        const containerOptions = storageOptions.filter(opt => opt.type === 'container');
        
        const chosenStorage = pocketOptions.length > 0 ? pocketOptions[0] : containerOptions[0];
        
        if (chosenStorage.type === 'pocket') {
            const result = this.addItem(chosenStorage.item, item, chosenStorage.pocketIndex);
            if (result.success) {
                item.storedIn = {
                    type: 'pocket',
                    container: chosenStorage.item,
                    pocketIndex: chosenStorage.pocketIndex,
                    location: chosenStorage.location
                };
                return { success: true, message: `Stored in ${chosenStorage.location}`, location: chosenStorage.location };
            }
        } else {
            const result = this.addItem(chosenStorage.item, item);
            if (result.success) {
                item.storedIn = {
                    type: 'container',
                    container: chosenStorage.item,
                    location: chosenStorage.location
                };
                return { success: true, message: `Stored in ${chosenStorage.location}`, location: chosenStorage.location };
            }
        }
        
        return { success: false, message: 'Failed to store item' };
    }
    
    getAllStoredItems(player) {
        const allItems = [];
        
        // Get items from equipped items with pockets
        for (const slot in player.equipment) {
            const equippedItem = player.equipment[slot];
            if (equippedItem && equippedItem.pockets) {
                for (let i = 0; i < equippedItem.pockets.length; i++) {
                    const pocket = equippedItem.pockets[i];
                    if (pocket.contents) {
                        for (const item of pocket.contents) {
                            allItems.push({
                                item: item,
                                location: `${equippedItem.name} - ${pocket.name}`,
                                type: 'pocket',
                                container: equippedItem,
                                pocketIndex: i
                            });
                        }
                    }
                }
            }
        }
        
        // Get items from inventory containers
        for (const invItem of player.inventory) {
            if (invItem.isContainer && invItem.contents) {
                for (const item of invItem.contents) {
                    allItems.push({
                        item: item,
                        location: invItem.name,
                        type: 'container',
                        container: invItem
                    });
                }
            }
        }
        
        return allItems;
    }
}
