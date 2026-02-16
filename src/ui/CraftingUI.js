/**
 * Unified Crafting/Disassembly UI
 * Split panel: Left = items to disassemble, Right = recipes to craft
 */

export function showCraftingUI(uiManager) {
    const game = uiManager.game;
    const player = game.player;
    const content = document.getElementById('detailed-inventory-content');
    
    let html = '<div style="padding: 20px;">';
    html += `<button id="close-crafting-ui" class="small-btn" style="margin-bottom: 15px;">← Close [V]</button>`;
    html += `<h2 style="color: #00ffff; margin-bottom: 20px;">🔧 Workshop</h2>`;
    
    // Split panel container
    html += `<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">`;
    
    // LEFT PANEL: Items to Disassemble
    html += `<div style="border: 2px solid #ff8800; padding: 15px; background: #1a1a1a;">`;
    html += `<h3 style="color: #ff8800; margin-bottom: 15px;">🔨 Disassemble</h3>`;
    html += renderDisassembleList(game, player);
    html += `</div>`;
    
    // RIGHT PANEL: Recipes to Craft
    html += `<div style="border: 2px solid #00ff00; padding: 15px; background: #1a1a1a;">`;
    html += `<h3 style="color: #00ff00; margin-bottom: 15px;">⚒️ Craft</h3>`;
    html += renderRecipeList(game, player);
    html += `</div>`;
    
    html += `</div>`;
    html += '</div>';
    
    content.innerHTML = html;
    
    // Attach event listeners
    document.getElementById('close-crafting-ui')?.addEventListener('click', () => {
        uiManager.detailedInventoryModal.classList.add('hidden');
    });
    
    // Disassemble buttons
    const disassembleButtons = document.querySelectorAll('button[data-disassemble-item]');
    disassembleButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.disassembleItem;
            // Find item from all locations
            const allItems = getAllAccessibleItems(game, player);
            const itemData = allItems.find(i => i.item.id === itemId);
            if (itemData) {
                showDisassembleFromCrafting(uiManager, itemData);
            }
        });
    });
    
    // Recipe buttons
    const recipeButtons = document.querySelectorAll('button[data-recipe-id]');
    recipeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const recipeId = btn.dataset.recipeId;
            showRecipeDetails(uiManager, recipeId);
        });
    });
}

function renderDisassembleList(game, player) {
    const disassemblableItems = [];
    
    // Get all items from all locations
    const allItems = getAllAccessibleItems(game, player);
    
    for (const itemData of allItems) {
        if (itemData.item.components && itemData.item.components.length > 0) {
            disassemblableItems.push(itemData);
        }
    }
    
    if (disassemblableItems.length === 0) {
        return `<div style="color: #888; font-style: italic; padding: 20px; text-align: center;">No items to disassemble</div>`;
    }
    
    let html = `<div style="max-height: 500px; overflow-y: auto;">`;
    
    for (const itemData of disassemblableItems) {
        const item = itemData.item;
        const durabilityColor = item.durability > 75 ? '#00ff00' : item.durability > 50 ? '#ffaa00' : '#ff8800';
        const componentCount = item.components.length;
        
        // Location badge
        let locationBadge = '';
        let locationColor = '#888';
        if (itemData.location === 'equipped') {
            locationBadge = '⚔️ Equipped';
            locationColor = '#ffaa00';
        } else if (itemData.location === 'carried') {
            locationBadge = '🤲 Carried';
            locationColor = '#ffaa00';
        } else if (itemData.location === 'stored') {
            locationBadge = '📦 Stored';
            locationColor = '#00ffff';
        } else if (itemData.location === 'ground') {
            locationBadge = '⬇️ Ground';
            locationColor = '#888';
        }
        
        html += `<button class="small-btn" data-disassemble-item="${item.id}" style="width: 100%; margin-bottom: 8px; text-align: left; padding: 10px;">`;
        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">`;
        html += `<div style="font-weight: bold; color: #fff;">${item.name}</div>`;
        html += `<div style="font-size: 11px; color: ${locationColor};">${locationBadge}</div>`;
        html += `</div>`;
        html += `<div style="font-size: 12px; color: #888;">`;
        html += `${componentCount} component(s)`;
        if (item.durability !== undefined) {
            html += ` • <span style="color: ${durabilityColor}">${Math.floor(item.durability)}% condition</span>`;
        }
        html += `</div>`;
        html += `</button>`;
    }
    
    html += `</div>`;
    return html;
}

/**
 * Get all items accessible to player from all locations
 * Returns array of { item, location, locationData }
 */
function getAllAccessibleItems(game, player) {
    const items = [];
    
    // 1. Equipped items
    for (const [slot, item] of Object.entries(player.equipment)) {
        if (item && typeof item === 'object') {
            items.push({
                item,
                location: 'equipped',
                locationData: { slot }
            });
        }
    }
    
    // 2. Carried items
    if (player.carrying.leftHand) {
        items.push({
            item: player.carrying.leftHand,
            location: 'carried',
            locationData: { hand: 'left' }
        });
    }
    if (player.carrying.rightHand && player.carrying.rightHand !== player.carrying.leftHand) {
        items.push({
            item: player.carrying.rightHand,
            location: 'carried',
            locationData: { hand: 'right' }
        });
    }
    
    // 3. Stored items (in containers/pockets)
    const storedItems = player.containerSystem.getAllStoredItems(player);
    for (const stored of storedItems) {
        items.push({
            item: stored.item,
            location: 'stored',
            locationData: {
                container: stored.container,
                pocketIndex: stored.pocketIndex
            }
        });
    }
    
    // 4. Ground items
    const groundItems = game.world.getItemsAt(player.x, player.y, player.z);
    for (const item of groundItems) {
        items.push({
            item,
            location: 'ground',
            locationData: {}
        });
    }
    
    return items;
}

function renderRecipeList(game, player) {
    const itemFamilies = game.content.itemFamilies;
    const recipes = [];
    
    // Build recipe list with availability
    for (const [id, family] of Object.entries(itemFamilies)) {
        if (!family.componentRequirements || family.componentRequirements.length === 0) continue;
        
        const availability = game.craftingSystem.canCraftItem(player, family);
        const requirementCount = family.componentRequirements.length;
        
        // Calculate how many requirements player has met
        let haveCount = 0;
        const availableComponents = game.craftingSystem.getPlayerComponents(player);
        
        for (const requirement of family.componentRequirements) {
            let matchingComponents = [];
            
            if (requirement.component) {
                // Specific component requirement - match by componentId or id prefix
                matchingComponents = availableComponents.filter(comp => 
                    comp.componentId === requirement.component || 
                    (comp.id && comp.id.startsWith(requirement.component))
                );
            } else if (requirement.property) {
                // Property-based requirement with maxValue support
                matchingComponents = availableComponents.filter(comp => 
                    game.craftingSystem.matchesRequirement(comp, requirement)
                );
            }
            
            const totalQuantity = matchingComponents.reduce((sum, c) => sum + (c.quantity || 1), 0);
            if (totalQuantity >= requirement.quantity) haveCount++;
        }
        
        let status = 'none';
        let color = '#ff4444';
        if (availability.canCraft) {
            status = 'can_craft';
            color = '#00ff00';
        } else if (haveCount > 0) {
            status = 'partial';
            color = '#ffaa00';
        }
        
        recipes.push({
            id,
            name: family.name,
            status,
            color,
            componentCount: requirementCount,
            haveCount
        });
    }
    
    // Sort: can craft first, then partial, then none
    recipes.sort((a, b) => {
        const order = { can_craft: 0, partial: 1, none: 2 };
        return order[a.status] - order[b.status];
    });
    
    let html = `<div style="max-height: 500px; overflow-y: auto;">`;
    
    for (const recipe of recipes) {
        html += `<button class="small-btn" data-recipe-id="${recipe.id}" style="width: 100%; margin-bottom: 8px; text-align: left; padding: 10px; border-left: 4px solid ${recipe.color};">`;
        html += `<div style="font-weight: bold; color: ${recipe.color}; margin-bottom: 3px;">${recipe.name}</div>`;
        html += `<div style="font-size: 12px; color: #888;">`;
        html += `${recipe.haveCount}/${recipe.componentCount} components`;
        html += `</div>`;
        html += `</button>`;
    }
    
    html += `</div>`;
    return html;
}

function showDisassembleFromCrafting(uiManager, itemData) {
    const game = uiManager.game;
    const player = game.player;
    const content = document.getElementById('detailed-inventory-content');
    const item = itemData.item;
    
    // Get available tools
    const tools = game.craftingSystem.getAvailableDisassemblyTools(player, item);
    
    let html = '<div style="padding: 20px;">';
    html += `<button id="back-to-crafting" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
    html += `<h3 style="color: #ff8800; margin-bottom: 15px;">🔧 Disassemble: ${item.name}</h3>`;
    
    // Item info
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #ff8800; margin-bottom: 15px;">`;
    html += `<h4 style="color: #ff8800; margin-bottom: 10px;">Item Details</h4>`;
    html += `<div style="color: #aaa; margin-bottom: 5px;">Type: ${item.type}</div>`;
    if (item.durability !== undefined) {
        const durabilityColor = item.durability > 75 ? '#00ff00' : item.durability > 50 ? '#ffaa00' : '#ff8800';
        html += `<div style="color: ${durabilityColor}; margin-bottom: 5px;">Condition: ${Math.floor(item.durability)}%</div>`;
    }
    html += `</div>`;
    
    // Tool selection
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #444; margin-bottom: 15px;">`;
    html += `<div style="color: #888; margin-bottom: 10px;">Choose tool:</div>`;
    
    for (const tool of tools) {
        const yieldPercent = Math.floor(tool.componentYield * 100);
        const qualityPercent = Math.floor(tool.qualityMod * 100);
        const disabled = !tool.available;
        const opacity = disabled ? 'opacity: 0.5;' : '';
        const cursor = disabled ? 'cursor: not-allowed;' : 'cursor: pointer;';
        
        html += `<button class="small-btn" data-disassemble-tool="${tool.type}" style="width: 100%; margin-bottom: 8px; text-align: left; ${opacity} ${cursor}" ${disabled ? 'disabled' : ''}>`;
        html += `<div style="font-weight: bold;">${tool.name}</div>`;
        html += `<div style="font-size: 12px; color: #888;">`;
        html += `${yieldPercent}% yield, ${qualityPercent}% quality, ${tool.timeRequired} turn(s)`;
        html += `</div>`;
        if (tool.excludeComponents && tool.excludeComponents.length > 0) {
            html += `<div style="font-size: 11px; color: #ff8800;">⚠ Some components lost</div>`;
        }
        html += `</button>`;
    }
    
    html += `</div>`;
    html += '</div>';
    
    content.innerHTML = html;
    
    // Store context with location data
    uiManager.craftingContext = { itemData, tools };
    
    // Event listeners
    document.getElementById('back-to-crafting')?.addEventListener('click', () => {
        showCraftingUI(uiManager);
    });
    
    const toolButtons = document.querySelectorAll('button[data-disassemble-tool]');
    toolButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const toolType = btn.dataset.disassembleTool;
            const selectedTool = tools.find(t => t.type === toolType);
            if (selectedTool && selectedTool.available) {
                showDisassemblePreviewFromCrafting(uiManager, itemData, selectedTool);
            }
        });
    });
}

function showDisassemblePreviewFromCrafting(uiManager, itemData, toolMethod) {
    const game = uiManager.game;
    const content = document.getElementById('detailed-inventory-content');
    const item = itemData.item;
    
    const preview = game.craftingSystem.getDisassemblyPreview(item, toolMethod);
    
    let html = '<div style="padding: 20px;">';
    html += `<button id="back-to-tool-select" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
    html += `<h3 style="color: #ff8800; margin-bottom: 15px;">🔧 Disassemble: ${item.name}</h3>`;
    
    // Tool info
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #4488ff; margin-bottom: 15px;">`;
    html += `<h4 style="color: #4488ff; margin-bottom: 10px;">Using: ${toolMethod.name}</h4>`;
    html += `<div style="color: #aaa; font-size: 13px;">Time: ${preview.timeRequired} turn(s)</div>`;
    html += `</div>`;
    
    // Components preview
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #00ff00; margin-bottom: 15px;">`;
    html += `<h4 style="color: #00ff00; margin-bottom: 10px;">Components You'll Receive</h4>`;
    
    for (const comp of preview.components) {
        const qualityColor = comp.quality >= 80 ? '#00ff00' : comp.quality >= 50 ? '#ffaa00' : '#ff8800';
        html += `<div style="padding: 8px; background: #0a0a0a; border-left: 3px solid ${qualityColor}; margin-bottom: 8px;">`;
        html += `<div style="color: #fff; font-weight: bold; margin-bottom: 3px;">${comp.name} x${comp.quantity}</div>`;
        html += `<div style="color: ${qualityColor}; font-size: 14px;">Quality: ${comp.quality}%</div>`;
        html += `</div>`;
    }
    
    html += `</div>`;
    
    // Confirm button
    html += `<button id="confirm-disassemble-craft" class="small-btn" style="width: 100%; padding: 15px; background: #ff8800; color: #000; font-size: 16px; font-weight: bold;">🔧 Disassemble</button>`;
    
    html += '</div>';
    
    content.innerHTML = html;
    
    uiManager.craftingContext = { itemData, toolMethod };
    
    document.getElementById('back-to-tool-select')?.addEventListener('click', () => {
        showDisassembleFromCrafting(uiManager, itemData);
    });
    
    document.getElementById('confirm-disassemble-craft')?.addEventListener('click', () => {
        handleDisassembleFromCrafting(uiManager);
    });
}

function handleDisassembleFromCrafting(uiManager) {
    const { itemData, toolMethod } = uiManager.craftingContext;
    const game = uiManager.game;
    const player = game.player;
    const item = itemData.item;
    
    const result = game.craftingSystem.disassembleItem(item, toolMethod);
    
    if (!result.success) {
        game.ui.log(result.message, 'warning');
        showCraftingUI(uiManager);
        return;
    }
    
    // Remove item from its actual location
    removeItemFromLocation(player, itemData, game);
    
    // Add components
    let componentsAdded = 0;
    let componentsFailed = 0;
    
    for (const component of result.components) {
        const addResult = player.addToInventory(component);
        if (addResult.success) {
            componentsAdded++;
        } else {
            component.x = player.x;
            component.y = player.y;
            component.z = player.z;
            game.world.addItem(component);
            componentsFailed++;
        }
    }
    
    game.ui.log(result.message, 'success');
    if (componentsAdded > 0) {
        game.ui.log(`Stored ${componentsAdded} component(s).`, 'info');
    }
    if (componentsFailed > 0) {
        game.ui.log(`${componentsFailed} component(s) dropped (no space).`, 'warning');
    }
    
    uiManager.craftingContext = null;
    uiManager.updatePanels();
    showCraftingUI(uiManager);
}

/**
 * Remove item from its actual location (equipped, carried, stored, ground)
 */
function removeItemFromLocation(player, itemData, game) {
    const item = itemData.item;
    const location = itemData.location;
    const locationData = itemData.locationData;
    
    if (location === 'equipped') {
        // Remove from equipment slot
        player.equipment[locationData.slot] = null;
        if (item.twoHandGrip) {
            player.equipment.leftHand = null;
            player.equipment.rightHand = null;
            item.twoHandGrip = false;
        }
    } else if (location === 'carried') {
        // Remove from carried hands
        if (locationData.hand === 'left') {
            player.carrying.leftHand = null;
        } else if (locationData.hand === 'right') {
            player.carrying.rightHand = null;
        }
        delete item.carriedIn;
    } else if (location === 'stored') {
        // Remove from container/pocket
        player.containerSystem.removeItem(locationData.container, item, locationData.pocketIndex);
        const invIndex = player.inventory.indexOf(item);
        if (invIndex !== -1) player.inventory.splice(invIndex, 1);
    } else if (location === 'ground') {
        // Remove from ground
        game.world.removeItem(item);
    }
}

function showRecipeDetails(uiManager, recipeId, parentRecipeId = null) {
    const game = uiManager.game;
    const player = game.player;
    const content = document.getElementById('detailed-inventory-content');
    
    const itemFamily = game.content.itemFamilies[recipeId];
    const availability = game.craftingSystem.canCraftItem(player, itemFamily);
    
    let html = '<div style="padding: 20px;">';
    html += `<button id="back-to-crafting-recipe" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
    html += `<h3 style="color: #00ff00; margin-bottom: 15px;">⚒️ Craft: ${itemFamily.name}</h3>`;
    
    // Recipe info
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #4488ff; margin-bottom: 15px;">`;
    html += `<h4 style="color: #4488ff; margin-bottom: 10px;">Item Details</h4>`;
    html += `<div style="color: #aaa; margin-bottom: 5px;">Type: ${itemFamily.type}</div>`;
    if (itemFamily.weaponStats) {
        html += `<div style="color: #aaa; margin-bottom: 5px;">Damage: ${itemFamily.weaponStats.damage} (${itemFamily.weaponStats.attackType})</div>`;
    }
    if (itemFamily.craftedProperties) {
        const props = Object.entries(itemFamily.craftedProperties).map(([k,v]) => `${k}: ${v}`).join(', ');
        html += `<div style="color: #00ffff; margin-bottom: 5px;">Provides: ${props}</div>`;
    }
    if (itemFamily.craftTime) {
        html += `<div style="color: #ffaa00; margin-bottom: 5px;">Craft time: ${itemFamily.craftTime} turn(s)</div>`;
    }
    html += `</div>`;
    
    // Component requirements (property-based)
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid ${availability.canCraft ? '#00ff00' : '#ff8800'}; margin-bottom: 15px;">`;
    html += `<h4 style="color: ${availability.canCraft ? '#00ff00' : '#ff8800'}; margin-bottom: 10px;">Required Components</h4>`;
    
    const availableComponents = game.craftingSystem.getPlayerComponents(player);
    
    for (const requirement of itemFamily.componentRequirements) {
        let matchingComponents = [];
        
        if (requirement.component) {
            // Specific component requirement - match by componentId or id prefix
            matchingComponents = availableComponents.filter(comp => 
                comp.componentId === requirement.component || 
                (comp.id && comp.id.startsWith(requirement.component))
            );
        } else if (requirement.property) {
            // Property-based requirement with maxValue support
            matchingComponents = availableComponents.filter(comp => 
                game.craftingSystem.matchesRequirement(comp, requirement)
            );
        }
        
        const totalQuantity = matchingComponents.reduce((sum, c) => sum + (c.quantity || 1), 0);
        const hasEnough = totalQuantity >= requirement.quantity;
        const statusColor = hasEnough ? '#00ff00' : '#ff4444';
        const statusIcon = hasEnough ? '✓' : '✗';
        
        html += `<div style="padding: 8px; background: #0a0a0a; border-left: 3px solid ${statusColor}; margin-bottom: 8px;">`;
        html += `<div style="color: #fff; font-weight: bold; margin-bottom: 3px;">`;
        html += `<span style="color: ${statusColor}">${statusIcon}</span> ${requirement.name}`;
        html += `</div>`;
        
        if (requirement.component) {
            // Show specific component requirement
            html += `<div style="color: #aaa; font-size: 13px; margin-bottom: 5px;">`;
            html += `Requires: ${requirement.name} (x${requirement.quantity})`;
            html += `</div>`;
        } else if (requirement.property) {
            // Show property-based requirement
            const rangeText = requirement.maxValue !== undefined 
                ? `${requirement.property} ${requirement.minValue}-${requirement.maxValue}` 
                : `${requirement.property} +${requirement.minValue}`;
            html += `<div style="color: #aaa; font-size: 13px; margin-bottom: 5px;">`;
            html += `Requires: ${rangeText} (x${requirement.quantity})`;
            html += `</div>`;
            
            // List all base components that match this property
            const allMatchingItems = [];
            for (const [compId, compDef] of Object.entries(game.content.components)) {
                if (compDef.properties && compDef.properties[requirement.property] >= requirement.minValue) {
                    if (requirement.maxValue !== undefined && compDef.properties[requirement.property] > requirement.maxValue) continue;
                    allMatchingItems.push(`${compDef.name} (${requirement.property}: ${compDef.properties[requirement.property]})`);
                }
            }
            // Also check craftable intermediates
            const subRecipes = [];
            for (const [famId, fam] of Object.entries(game.content.itemFamilies)) {
                if (fam.craftedProperties && fam.craftedProperties[requirement.property] >= requirement.minValue) {
                    if (requirement.maxValue !== undefined && fam.craftedProperties[requirement.property] > requirement.maxValue) continue;
                    subRecipes.push({ id: famId, name: fam.name, value: fam.craftedProperties[requirement.property] });
                }
            }
            
            if (allMatchingItems.length > 0) {
                html += `<div style="color: #666; font-size: 11px; margin-top: 5px; font-style: italic;">`;
                html += `Sources: ${allMatchingItems.join(', ')}`;
                html += `</div>`;
            }
            if (subRecipes.length > 0) {
                html += `<div style="margin-top: 4px;">`;
                for (const sub of subRecipes) {
                    html += `<button class="small-btn sub-recipe-btn" data-sub-recipe="${sub.id}" style="font-size: 11px; padding: 3px 8px; margin: 2px 4px 2px 0; border-left: 3px solid #00ffff;">`;
                    html += `⚒ Craft ${sub.name} (${requirement.property}: ${sub.value})`;
                    html += `</button>`;
                }
                html += `</div>`;
            }
        }
        
        html += `<div style="color: #888; font-size: 12px; margin-bottom: 3px;">Have: ${totalQuantity} | Need: ${requirement.quantity}</div>`;
        html += `</div>`;
    }
    
    html += `</div>`;
    
    // Craft button
    if (availability.canCraft) {
        html += `<button id="confirm-craft" class="small-btn" style="width: 100%; padding: 15px; background: #00ff00; color: #000; font-size: 16px; font-weight: bold;">⚒️ Craft Item</button>`;
    } else {
        html += `<button class="small-btn" disabled style="width: 100%; padding: 15px; background: #666; color: #333; font-size: 16px; font-weight: bold; cursor: not-allowed;">⚒️ Missing Components</button>`;
    }
    
    html += '</div>';
    
    content.innerHTML = html;
    
    uiManager.craftingContext = { recipeId, itemFamily, parentRecipeId };
    
    document.getElementById('back-to-crafting-recipe')?.addEventListener('click', () => {
        if (parentRecipeId) {
            showRecipeDetails(uiManager, parentRecipeId);
        } else {
            showCraftingUI(uiManager);
        }
    });
    
    // Sub-recipe drill-down buttons
    const subRecipeBtns = document.querySelectorAll('button[data-sub-recipe]');
    subRecipeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const subId = btn.dataset.subRecipe;
            showRecipeDetails(uiManager, subId, recipeId);
        });
    });
    
    if (availability.canCraft) {
        document.getElementById('confirm-craft')?.addEventListener('click', () => {
            handleCraftItem(uiManager);
        });
    }
}

function handleCraftItem(uiManager) {
    const { recipeId, parentRecipeId } = uiManager.craftingContext;
    const game = uiManager.game;
    const player = game.player;
    
    const result = game.craftingSystem.craftItem(player, recipeId);
    
    if (!result.success) {
        game.ui.log(result.message, 'warning');
        showCraftingUI(uiManager);
        return;
    }
    
    // Advance turns for craft time
    if (result.craftTime && result.craftTime > 0) {
        game.advanceTurn(result.craftTime);
    }
    
    // Add crafted item to inventory
    const addResult = player.addToInventory(result.item);
    if (addResult.success) {
        game.ui.log(result.message, 'success');
        game.ui.log(`Stored in ${addResult.location}.`, 'info');
    } else {
        // Drop on ground if no space
        result.item.x = player.x;
        result.item.y = player.y;
        result.item.z = player.z;
        game.world.addItem(result.item);
        game.ui.log(result.message, 'success');
        game.ui.log('Item dropped on ground (no space).', 'warning');
    }
    
    uiManager.craftingContext = null;
    uiManager.updatePanels();
    
    // Navigate back to parent recipe if we were crafting a sub-component
    if (parentRecipeId) {
        showRecipeDetails(uiManager, parentRecipeId);
    } else {
        showCraftingUI(uiManager);
    }
}
