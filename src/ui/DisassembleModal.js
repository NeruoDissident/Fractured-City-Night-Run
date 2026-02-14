/**
 * Disassemble modal UI handler
 * Shows tool selection for disassembly
 */
export function showDisassembleModal(uiManager, item, sourceType, sourceData) {
    const game = uiManager.game;
    const player = game.player;
    const content = document.getElementById('detailed-inventory-content');
    
    // Check if player can disassemble (needs at least one free hand)
    const canDisassemble = game.craftingSystem.canPlayerDisassemble(player);
    if (!canDisassemble.canDisassemble) {
        let warnHtml = '<div style="padding: 20px;">';
        warnHtml += `<button id="close-disassemble-warn" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
        warnHtml += `<h3 style="color: #ff8800; margin-bottom: 15px;">🔧 Disassemble: ${item.name}</h3>`;
        warnHtml += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #ff4444; margin-bottom: 15px;">`;
        warnHtml += `<div style="color: #ff4444; font-size: 18px; font-weight: bold; margin-bottom: 10px;">⚠️ Cannot Disassemble</div>`;
        warnHtml += `<div style="color: #ffaa00; font-size: 15px;">${canDisassemble.reason}</div>`;
        warnHtml += `</div>`;
        warnHtml += '</div>';
        content.innerHTML = warnHtml;
        document.getElementById('close-disassemble-warn')?.addEventListener('click', () => {
            uiManager.showActionsModal(item, sourceType, sourceData);
        });
        return;
    }
    
    // Get available tools
    const tools = game.craftingSystem.getAvailableDisassemblyTools(player, item);
    
    let html = '<div style="padding: 20px;">';
    html += `<button id="close-disassemble-tool" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
    html += `<h3 style="color: #ff8800; margin-bottom: 15px;">🔧 Disassemble: ${item.name}</h3>`;
    
    // Item info
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #ff8800; margin-bottom: 15px;">`;
    html += `<h4 style="color: #ff8800; margin-bottom: 10px;">Item to Disassemble</h4>`;
    html += `<div style="color: #aaa; margin-bottom: 5px;">Type: ${item.type}</div>`;
    if (item.durability !== undefined) {
        const durabilityColor = item.durability > 75 ? '#00ff00' : item.durability > 50 ? '#ffaa00' : '#ff8800';
        html += `<div style="color: ${durabilityColor}; margin-bottom: 5px;">Condition: ${Math.floor(item.durability)}%</div>`;
    }
    html += `</div>`;
    
    // Tool selection
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #444; margin-bottom: 15px;">`;
    html += `<div style="color: #888; margin-bottom: 10px;">Choose tool to disassemble with:</div>`;
    
    for (const tool of tools) {
        const yieldPercent = Math.floor(tool.componentYield * 100);
        const qualityPercent = Math.floor(tool.qualityMod * 100);
        const disabled = !tool.available;
        const opacity = disabled ? 'opacity: 0.5;' : '';
        const cursor = disabled ? 'cursor: not-allowed;' : 'cursor: pointer;';
        
        html += `<button class="small-btn" data-disassemble-tool="${tool.type}" style="width: 100%; margin-bottom: 8px; text-align: left; ${opacity} ${cursor}" ${disabled ? 'disabled' : ''}>`;
        html += `<div style="font-weight: bold;">${tool.name}</div>`;
        html += `<div style="font-size: 12px; color: #888;">`;
        html += `${yieldPercent}% component yield, ${qualityPercent}% quality recovery, ${tool.timeRequired} turn(s)`;
        html += `</div>`;
        if (tool.excludeComponents && tool.excludeComponents.length > 0) {
            html += `<div style="font-size: 11px; color: #ff8800;">⚠ Some components will be lost</div>`;
        }
        html += `</button>`;
    }
    
    html += `</div>`;
    html += '</div>';
    
    content.innerHTML = html;
    
    // Store context
    uiManager.disassembleContext = { item, sourceType, sourceData, tools };
    
    // Attach event listeners
    document.getElementById('close-disassemble-tool')?.addEventListener('click', () => {
        uiManager.showActionsModal(item, sourceType, sourceData);
    });
    
    const toolButtons = document.querySelectorAll('button[data-disassemble-tool]');
    toolButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const toolType = btn.dataset.disassembleTool;
            const selectedTool = tools.find(t => t.type === toolType);
            if (selectedTool && selectedTool.available) {
                showDisassemblePreview(uiManager, item, sourceType, sourceData, selectedTool);
            }
        });
    });
}

/**
 * Show disassembly preview with selected tool
 */
function showDisassemblePreview(uiManager, item, sourceType, sourceData, toolMethod) {
    const game = uiManager.game;
    const content = document.getElementById('detailed-inventory-content');
    
    // Get preview with selected tool
    const preview = game.craftingSystem.getDisassemblyPreview(item, toolMethod);
    
    let html = '<div style="padding: 20px;">';
    html += `<button id="back-to-tools" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
    html += `<h3 style="color: #ff8800; margin-bottom: 15px;">🔧 Disassemble: ${item.name}</h3>`;
    
    // Tool info
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #4488ff; margin-bottom: 15px;">`;
    html += `<h4 style="color: #4488ff; margin-bottom: 10px;">Using: ${toolMethod.name}</h4>`;
    html += `<div style="color: #aaa; font-size: 13px;">Time Required: ${preview.timeRequired} turn(s)</div>`;
    html += `</div>`;
    
    // Components preview
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #00ff00; margin-bottom: 15px;">`;
    html += `<h4 style="color: #00ff00; margin-bottom: 10px;">Components You'll Receive</h4>`;
    
    for (const comp of preview.components) {
        const qualityColor = comp.quality >= 80 ? '#00ff00' : comp.quality >= 50 ? '#ffaa00' : '#ff8800';
        html += `<div style="padding: 8px; background: #0a0a0a; border-left: 3px solid ${qualityColor}; margin-bottom: 8px;">`;
        html += `<div style="color: #fff; font-weight: bold; margin-bottom: 3px;">${comp.name} x${comp.quantity}</div>`;
        html += `<div style="color: ${qualityColor}; font-size: 14px;">Quality: ${comp.quality}% / ${comp.maxQuality}%</div>`;
        html += `</div>`;
    }
    
    // Quality modifiers info
    html += `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #333;">`;
    html += `<div style="color: #888; font-size: 13px; margin-bottom: 5px;">Recovery Rates:</div>`;
    html += `<div style="color: #aaa; font-size: 13px; margin-left: 10px;">`;
    html += `• Component yield: ${Math.floor(preview.componentYield * 100)}%<br>`;
    html += `• Quality modifier: ${Math.floor(preview.qualityModifier * 100)}%<br>`;
    html += `• Item condition: ${Math.floor(preview.conditionModifier * 100)}%<br>`;
    html += `• Final quality: ${Math.floor(preview.qualityModifier * preview.conditionModifier * 100)}%`;
    html += `</div>`;
    html += `</div>`;
    
    html += `</div>`;
    
    // Confirm button
    html += `<button id="confirm-disassemble" class="small-btn" style="width: 100%; padding: 15px; background: #ff8800; color: #000; font-size: 16px; font-weight: bold;">🔧 Disassemble Item</button>`;
    
    html += '</div>';
    
    content.innerHTML = html;
    
    // Store context for confirmation
    uiManager.disassembleContext = { item, sourceType, sourceData, toolMethod };
    
    // Attach event listeners
    document.getElementById('back-to-tools')?.addEventListener('click', () => {
        showDisassembleModal(uiManager, item, sourceType, sourceData);
    });
    
    document.getElementById('confirm-disassemble')?.addEventListener('click', () => {
        handleDisassembleConfirm(uiManager);
    });
}

function handleDisassembleConfirm(uiManager) {
    const { item, sourceType, sourceData, toolMethod } = uiManager.disassembleContext;
    const game = uiManager.game;
    const player = game.player;
    
    // Perform disassembly with selected tool
    const result = game.craftingSystem.disassembleItem(item, toolMethod);
    
    if (!result.success) {
        game.ui.log(result.message, 'warning');
        uiManager.showDetailedInventory('inventory');
        return;
    }
    
    // Spill container contents before removing (batteries, fuel, food, etc.)
    if (item.contents && item.contents.length > 0) {
        for (const contentItem of item.contents) {
            const addResult = player.addToInventory(contentItem);
            if (addResult.success) {
                game.ui.log(`Recovered ${contentItem.name} from ${item.name}.`, 'info');
            } else {
                contentItem.x = player.x;
                contentItem.y = player.y;
                contentItem.z = player.z;
                game.world.addItem(contentItem);
                game.ui.log(`${contentItem.name} dropped on ground (no storage space).`, 'warning');
            }
        }
        item.contents = [];
    }
    
    // Remove original item from source
    removeItemFromSource(uiManager, player, item, sourceType, sourceData);
    
    // Add components to player inventory using proper container system
    let componentsAdded = 0;
    let componentsFailed = 0;
    
    for (const component of result.components) {
        const addResult = player.addToInventory(component);
        if (addResult.success) {
            componentsAdded++;
        } else {
            // Component doesn't fit, drop it on ground
            component.x = player.x;
            component.y = player.y;
            component.z = player.z;
            game.world.addItem(component);
            componentsFailed++;
        }
    }
    
    // Log success
    game.ui.log(result.message, 'success');
    if (componentsAdded > 0) {
        game.ui.log(`Stored ${componentsAdded} component(s) at ${Math.floor(result.qualityModifier * result.conditionModifier * 100)}% quality.`, 'info');
    }
    if (componentsFailed > 0) {
        game.ui.log(`${componentsFailed} component(s) dropped on ground (no storage space).`, 'warning');
    }
    
    // Clear context and return to inventory
    uiManager.disassembleContext = null;
    uiManager.showDetailedInventory('inventory');
    uiManager.updatePanels();
}

function removeItemFromSource(uiManager, player, item, sourceType, sourceData) {
    if (sourceType === 'actions-equipped') {
        player.equipment[sourceData.slot] = null;
        if (item.twoHandGrip) {
            player.equipment.leftHand = null;
            player.equipment.rightHand = null;
            item.twoHandGrip = false;
        }
    } else if (sourceType === 'actions-stored') {
        const storedItems = player.containerSystem.getAllStoredItems(player);
        const stored = storedItems[sourceData.index];
        if (stored) {
            player.containerSystem.removeItem(stored.container, item, stored.pocketIndex);
            const invIndex = player.inventory.indexOf(item);
            if (invIndex !== -1) player.inventory.splice(invIndex, 1);
        }
    } else if (sourceType === 'actions-carried') {
        if (sourceData.hand === 'both') {
            player.carrying.leftHand = null;
            player.carrying.rightHand = null;
        } else {
            player.carrying[sourceData.hand + 'Hand'] = null;
        }
        delete item.carriedIn;
    } else if (sourceType === 'actions-ground' || sourceType === 'actions-ground-interact') {
        // Item is on ground, remove it from world
        player.game.world.removeItem(item);
    } else if (sourceType === 'actions-pocket-item') {
        const container = uiManager.findContainerById(sourceData.containerId);
        if (container && container.pockets && container.pockets[sourceData.pocketIndex]) {
            const pocket = container.pockets[sourceData.pocketIndex];
            pocket.contents.splice(sourceData.itemIndex, 1);
        }
        const invIndex = player.inventory.indexOf(item);
        if (invIndex !== -1) player.inventory.splice(invIndex, 1);
    } else if (sourceType === 'actions-container-item') {
        const container = uiManager.findContainerById(sourceData.containerId);
        
        if (container && container.contents && container.contents[sourceData.itemIndex]) {
            container.contents.splice(sourceData.itemIndex, 1);
        }
    }
}
