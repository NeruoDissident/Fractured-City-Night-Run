/**
 * WorldObjectModal - UI for interacting with world objects (doors, furniture, etc.)
 * Similar to DisassembleModal but for world objects
 */

export function showWorldObjectModal(uiManager, worldObject) {
    const game = uiManager.game;
    const player = game.player;
    const content = document.getElementById('detailed-inventory-content');
    
    const availableActions = worldObject.getAvailableActions();
    
    let html = '<div style="padding: 20px;">';
    html += `<button id="close-world-object" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
    
    // Object header with icon
    const furnitureIcons = {
        cabinet: '🗄', dresser: '🗄', shelf: '📚', locker: '🔒', crate: '📦',
        filing_cabinet: '🗄', table: '🪑', chair: '🪑', couch: '🛋', bed: '🛏',
        sink: '🚰', counter: '🗄', stove: '🔥', toilet: '🚽', shower: '🚿',
        workbench: '🔨'
    };
    const icon = worldObject.type === 'door' ? '🚪' : (furnitureIcons[worldObject.furnitureType] || '📦');
    html += `<h3 style="color: #ff8800; margin-bottom: 15px;">${icon} ${worldObject.name}</h3>`;
    
    // Object status
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #ff8800; margin-bottom: 15px;">`;
    html += `<h4 style="color: #ff8800; margin-bottom: 10px;">Status</h4>`;
    html += `<div style="color: #aaa; margin-bottom: 5px;">${worldObject.getStatusText()}</div>`;
    
    const hpPercent = (worldObject.hp / worldObject.maxHP) * 100;
    const hpColor = hpPercent > 75 ? '#00ff00' : hpPercent > 50 ? '#ffaa00' : hpPercent > 25 ? '#ff8800' : '#ff4444';
    html += `<div style="color: ${hpColor}; margin-bottom: 5px;">Condition: ${Math.floor(worldObject.hp)}/${worldObject.maxHP} HP (${Math.floor(hpPercent)}%)</div>`;
    html += `<div style="color: #888; margin-bottom: 5px;">Material: ${worldObject.material}</div>`;
    html += `</div>`;
    
    // Available actions
    html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #444; margin-bottom: 15px;">`;
    html += `<h4 style="color: #00ffff; margin-bottom: 10px;">Available Actions</h4>`;
    
    for (const action of availableActions) {
        const actionInfo = getActionInfo(action, worldObject, player, game);
        
        const disabled = !actionInfo.available;
        const opacity = disabled ? 'opacity: 0.5;' : '';
        const cursor = disabled ? 'cursor: not-allowed;' : 'cursor: pointer;';
        
        html += `<button class="small-btn" data-world-action="${action}" style="width: 100%; margin-bottom: 8px; text-align: left; ${opacity} ${cursor}" ${disabled ? 'disabled' : ''}>`;
        html += `<div style="font-weight: bold;">${actionInfo.icon} ${actionInfo.name}</div>`;
        html += `<div style="font-size: 12px; color: #888;">${actionInfo.description}</div>`;
        if (actionInfo.requirement) {
            html += `<div style="font-size: 11px; color: #ff8800;">⚠ ${actionInfo.requirement}</div>`;
        }
        html += `</button>`;
    }
    
    html += `</div>`;
    html += '</div>';
    
    content.innerHTML = html;
    
    // Show modal
    uiManager.detailedInventoryModal.classList.remove('hidden');
    
    // Store context
    uiManager.worldObjectContext = { worldObject };
    
    // Attach event listeners
    document.getElementById('close-world-object')?.addEventListener('click', () => {
        uiManager.detailedInventoryModal.classList.add('hidden');
        uiManager.worldObjectContext = null;
    });
    
    const actionButtons = document.querySelectorAll('button[data-world-action]');
    actionButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const action = btn.dataset.worldAction;
            handleWorldObjectAction(uiManager, worldObject, action);
        });
    });
}

/**
 * Get action information for display
 */
function getActionInfo(action, worldObject, player, game) {
    const actions = {
        open: {
            name: 'Open',
            icon: '↗',
            description: `Open the ${worldObject.name} (1 turn)`,
            available: !worldObject.state.locked && !worldObject.state.open
        },
        close: {
            name: 'Close',
            icon: '↙',
            description: `Close the ${worldObject.name} (1 turn)`,
            available: worldObject.state.open
        },
        peek: {
            name: 'Peek',
            icon: '👁',
            description: `Look through the ${worldObject.name} (1 turn)`,
            available: !worldObject.state.open
        },
        knock: {
            name: 'Knock',
            icon: '✊',
            description: `Knock on the ${worldObject.name} (1 turn, makes noise)`,
            available: !worldObject.state.open
        },
        search: {
            name: 'Search',
            icon: '🔍',
            description: 'Search for items inside (1 turn)',
            available: worldObject.isContainer === true
        },
        smash: {
            name: 'Smash',
            icon: '💥',
            description: 'Break the object (weapon required, makes loud noise)',
            available: true,
            requirement: !hasWeapon(player) ? 'Requires weapon or tool' : null
        },
        disassemble: {
            name: 'Disassemble',
            icon: '🔧',
            description: `Carefully remove (${worldObject.dropTable?.disassembleTool || 'tool'} required, 5-10 turns)`,
            available: worldObject.type === 'door' ? worldObject.state.open : true,
            requirement: !hasTool(player, worldObject.dropTable?.disassembleTool) ? `Requires ${worldObject.dropTable?.disassembleTool}` : null
        },
        lockpick: {
            name: 'Lockpick',
            icon: '🔓',
            description: 'Attempt to pick the lock (lockpick required, 3-5 turns)',
            available: false,
            requirement: 'Not yet implemented'
        },
        barricade: {
            name: 'Barricade',
            icon: '🛡',
            description: `Board up the ${worldObject.name} (materials required)`,
            available: false,
            requirement: 'Not yet implemented'
        },
        remove_barricade: {
            name: 'Remove Barricade',
            icon: '🔨',
            description: `Remove boards from ${worldObject.name} (crowbar required)`,
            available: false,
            requirement: 'Not yet implemented'
        }
    };
    
    return actions[action] || {
        name: action,
        icon: '?',
        description: 'Unknown action',
        available: false
    };
}

/**
 * Check if player has a weapon
 */
function hasWeapon(player) {
    return player.equipment.rightHand || player.equipment.leftHand;
}

/**
 * Check if player has required tool
 */
function hasTool(player, toolType) {
    if (!toolType) return true;
    
    // Check equipment
    for (const slot in player.equipment) {
        const item = player.equipment[slot];
        if (!item || !item.tags) continue;
        
        const toolMap = {
            'screwdriver': ['screwdriver', 'multitool'],
            'crowbar': ['crowbar', 'prybar'],
            'hacksaw': ['hacksaw', 'saw']
        };
        
        const validTags = toolMap[toolType] || [toolType];
        if (validTags.some(tag => item.tags.includes(tag))) {
            return true;
        }
    }
    
    // Check inventory
    for (const item of player.inventory) {
        if (!item.tags) continue;
        
        const toolMap = {
            'screwdriver': ['screwdriver', 'multitool'],
            'crowbar': ['crowbar', 'prybar'],
            'hacksaw': ['hacksaw', 'saw']
        };
        
        const validTags = toolMap[toolType] || [toolType];
        if (validTags.some(tag => item.tags.includes(tag))) {
            return true;
        }
    }
    
    return false;
}

/**
 * Handle world object action
 */
function handleWorldObjectAction(uiManager, worldObject, action) {
    const game = uiManager.game;
    const player = game.player;
    
    // Check if worldObjectSystem exists
    if (!game.worldObjectSystem) {
        console.error('WorldObjectSystem not initialized!');
        game.ui.log('Error: World object system not available.', 'warning');
        return;
    }
    
    // Perform action through WorldObjectSystem
    const result = game.worldObjectSystem.performAction(worldObject, action, player);
    
    if (result.success) {
        // Update display immediately
        game.render();
        game.ui.updatePanels();
        
        // Special handling for search - show transfer UI
        if (result.showContents && result.worldObject) {
            game.ui.log(result.message, 'info');
            showFurnitureContentsModal(uiManager, result.worldObject);
            return;
        }
        
        // Show success feedback in modal
        const content = document.getElementById('detailed-inventory-content');
        
        // Special handling for peek - show what was seen
        if (action === 'peek' && result.message) {
            content.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px;">👁</div>
                    <div style="color: #00ffff; font-size: 20px; font-weight: bold; margin-bottom: 10px;">Peeking...</div>
                    <div style="color: #aaa; font-size: 16px; margin-bottom: 20px;">${result.message}</div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div style="padding: 40px; text-align: center;">
                    <div style="font-size: 48px; margin-bottom: 20px;">✓</div>
                    <div style="color: #00ff00; font-size: 20px; font-weight: bold; margin-bottom: 10px;">Success!</div>
                    <div style="color: #aaa; font-size: 16px;">${result.message}</div>
                </div>
            `;
        }
        
        // Log to game log
        game.ui.log(result.message, 'success');
        
        // Auto-close modal after brief delay
        setTimeout(() => {
            uiManager.detailedInventoryModal.classList.add('hidden');
            uiManager.worldObjectContext = null;
        }, 1200);
    } else {
        // Show error feedback in modal
        const content = document.getElementById('detailed-inventory-content');
        
        if (!content) {
            console.error('ERROR: Could not find detailed-inventory-content element!');
            return;
        }
        
        content.innerHTML = `
            <div style="padding: 40px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚠</div>
                <div style="color: #ff8800; font-size: 20px; font-weight: bold; margin-bottom: 10px;">Cannot Perform Action</div>
                <div style="color: #aaa; font-size: 16px;">${result.message}</div>
                <button id="back-to-actions" class="small-btn" style="margin-top: 20px;">← Back</button>
            </div>
        `;
        
        // Log to game log
        game.ui.log(result.message, 'warning');
        
        // Add back button listener
        const backBtn = document.getElementById('back-to-actions');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                showWorldObjectModal(uiManager, worldObject);
            });
        }
    }
}

/**
 * Show furniture contents modal - transfer UI for storage furniture
 * Each item has inline Store/Equip quick buttons for fast looting
 */
export function showFurnitureContentsModal(uiManager, furniture) {
    const game = uiManager.game;
    const player = game.player;
    const content = document.getElementById('detailed-inventory-content');
    
    const furnitureIcons = {
        cabinet: '🗄', dresser: '🗄', shelf: '📚', locker: '🔒', crate: '📦',
        filing_cabinet: '🗄', counter: '🗄', workbench: '🔨'
    };
    const icon = furnitureIcons[furniture.furnitureType] || '📦';
    
    // Count total items for Take All button
    let totalItems = 0;
    if (furniture.pockets) {
        for (const pocket of furniture.pockets) {
            if (pocket.contents) totalItems += pocket.contents.length;
        }
    }
    
    let html = '<div style="padding: 15px;">';
    html += `<button id="close-furniture-contents" class="small-btn" style="margin-bottom: 10px;">← Close</button>`;
    html += `<h3 style="color: #ff8800; margin-bottom: 10px;">${icon} ${furniture.name}</h3>`;
    
    // Furniture contents section
    html += `<div style="padding: 10px; background: #1a1a1a; border: 2px solid #ff8800; margin-bottom: 10px; max-height: 45vh; overflow-y: auto;">`;
    html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
    html += `<h4 style="color: #ff8800; margin: 0;">Contents</h4>`;
    if (totalItems > 0) {
        html += `<button id="take-all-btn" class="small-btn" style="font-size: 11px; padding: 4px 10px; background: #44aa44; color: #000;">Take All</button>`;
    }
    html += `</div>`;
    
    if (furniture.pockets) {
        let hasItems = false;
        for (let pi = 0; pi < furniture.pockets.length; pi++) {
            const pocket = furniture.pockets[pi];
            if (pocket.contents && pocket.contents.length > 0) {
                hasItems = true;
                if (furniture.pockets.length > 1) {
                    html += `<div style="color: #888; font-size: 12px; margin-bottom: 4px;">${pocket.name}:</div>`;
                }
                for (let ii = 0; ii < pocket.contents.length; ii++) {
                    const item = pocket.contents[ii];
                    const isEquippable = item.slots && item.slots.length > 0;
                    const w = item.weight ? (item.weight >= 1000 ? `${(item.weight/1000).toFixed(1)}kg` : `${item.weight}g`) : '';
                    
                    html += `<div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">`;
                    
                    // Item name button (opens full actions modal)
                    html += `<button class="small-btn" data-details-pocket="${pi}" data-details-item="${ii}" style="flex: 1; text-align: left; padding: 6px 8px; min-width: 0;">`;
                    html += `<span style="color: ${item.color || '#fff'};">${item.glyph || '*'} ${item.name}</span>`;
                    if (w) html += `<span style="color: #666; font-size: 11px; float: right;">${w}</span>`;
                    html += `</button>`;
                    
                    // Quick Store button (auto-store like G key)
                    html += `<button class="small-btn" data-quick-store-pocket="${pi}" data-quick-store-item="${ii}" style="padding: 6px 8px; font-size: 11px; background: #226644; color: #44ff88; white-space: nowrap;" title="Auto-store in your inventory">Store</button>`;
                    
                    // Quick Equip button (only for equippable items)
                    if (isEquippable) {
                        html += `<button class="small-btn" data-quick-equip-pocket="${pi}" data-quick-equip-item="${ii}" style="padding: 6px 8px; font-size: 11px; background: #446622; color: #88ff88; white-space: nowrap;" title="Equip this item">Equip</button>`;
                    }
                    
                    html += `</div>`;
                }
            }
        }
        if (!hasItems) {
            html += `<div style="color: #555; font-style: italic;">Empty</div>`;
        }
    }
    html += `</div>`;
    
    // Player inventory section - items that can be stored in furniture
    html += `<div style="padding: 10px; background: #1a1a1a; border: 2px solid #4488ff; max-height: 25vh; overflow-y: auto;">`;
    html += `<h4 style="color: #4488ff; margin-bottom: 8px;">Your Items (tap to store)</h4>`;
    
    const storedItems = player.containerSystem.getAllStoredItems(player);
    if (storedItems.length > 0) {
        for (let si = 0; si < storedItems.length; si++) {
            const stored = storedItems[si];
            const item = stored.item;
            html += `<button class="small-btn" data-store-index="${si}" style="width: 100%; margin-bottom: 4px; text-align: left; padding: 6px 8px;">`;
            html += `<span style="color: ${item.color || '#fff'};">${item.glyph || '*'} ${item.name}</span>`;
            html += `<span style="color: #555; font-size: 11px; float: right;">${stored.location}</span>`;
            html += `</button>`;
        }
    } else {
        html += `<div style="color: #555; font-style: italic;">No items to store</div>`;
    }
    html += `</div>`;
    
    html += '</div>';
    content.innerHTML = html;
    
    // Show modal
    uiManager.detailedInventoryModal.classList.remove('hidden');
    
    // Close button
    document.getElementById('close-furniture-contents')?.addEventListener('click', () => {
        uiManager.detailedInventoryModal.classList.add('hidden');
        uiManager.worldObjectContext = null;
    });
    
    // Store furniture reference for back-navigation from actions modal
    uiManager.furnitureContext = furniture;
    
    // --- Take All button ---
    document.getElementById('take-all-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        let picked = 0;
        let failed = 0;
        
        // Iterate backwards so splice doesn't shift indices
        for (let pi = 0; pi < furniture.pockets.length; pi++) {
            const pocket = furniture.pockets[pi];
            if (!pocket.contents) continue;
            for (let ii = pocket.contents.length - 1; ii >= 0; ii--) {
                const item = pocket.contents[ii];
                const result = player.addToInventory(item);
                if (result.success) {
                    pocket.contents.splice(ii, 1);
                    picked++;
                } else {
                    failed++;
                }
            }
        }
        
        if (picked > 0) game.ui.log(`Took ${picked} item(s) from ${furniture.name}.`, 'success');
        if (failed > 0) game.ui.log(`${failed} item(s) wouldn't fit.`, 'warning');
        
        uiManager.updatePanels();
        showFurnitureContentsModal(uiManager, furniture);
    });
    
    // --- Quick Store buttons (auto-store into player inventory) ---
    const quickStoreButtons = document.querySelectorAll('button[data-quick-store-pocket]');
    quickStoreButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pi = parseInt(btn.dataset.quickStorePocket);
            const ii = parseInt(btn.dataset.quickStoreItem);
            
            const pocket = furniture.pockets[pi];
            if (!pocket || !pocket.contents || !pocket.contents[ii]) return;
            const item = pocket.contents[ii];
            
            const result = player.addToInventory(item);
            if (result.success) {
                pocket.contents.splice(ii, 1);
                game.ui.log(`Took ${item.name} → ${result.location}.`, 'info');
            } else {
                game.ui.log(`No space for ${item.name}.`, 'warning');
            }
            
            uiManager.updatePanels();
            showFurnitureContentsModal(uiManager, furniture);
        });
    });
    
    // --- Quick Equip buttons (open hand selection via move modal) ---
    const quickEquipButtons = document.querySelectorAll('button[data-quick-equip-pocket]');
    quickEquipButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pi = parseInt(btn.dataset.quickEquipPocket);
            const ii = parseInt(btn.dataset.quickEquipItem);
            
            const pocket = furniture.pockets[pi];
            if (!pocket || !pocket.contents || !pocket.contents[ii]) return;
            const item = pocket.contents[ii];
            
            // Use the existing move modal which shows equip slot selection
            uiManager.showMoveModal('furniture', {
                furnitureId: furniture.id,
                pocketIndex: pi,
                itemIndex: ii
            });
        });
    });
    
    // --- Item name buttons (open full actions modal for inspect/drop/etc) ---
    const detailButtons = document.querySelectorAll('button[data-details-pocket]');
    detailButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const pi = parseInt(btn.dataset.detailsPocket);
            const ii = parseInt(btn.dataset.detailsItem);
            
            const pocket = furniture.pockets[pi];
            if (!pocket || !pocket.contents || !pocket.contents[ii]) return;
            const item = pocket.contents[ii];
            
            uiManager.showActionsModal(item, 'actions-furniture', {
                furnitureId: furniture.id,
                pocketIndex: pi,
                itemIndex: ii
            });
        });
    });
    
    // --- Store player items into furniture ---
    const storeButtons = document.querySelectorAll('button[data-store-index]');
    storeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const storeIndex = parseInt(btn.dataset.storeIndex);
            
            const storedItems = player.containerSystem.getAllStoredItems(player);
            const stored = storedItems[storeIndex];
            if (!stored) return;
            
            const item = stored.item;
            
            // Find a pocket in furniture with space
            let placed = false;
            for (const pocket of furniture.pockets) {
                const currentWeight = (pocket.contents || []).reduce((sum, i) => sum + (i.weight || 100), 0);
                const currentVolume = (pocket.contents || []).reduce((sum, i) => sum + (i.volume || 100), 0);
                const itemWeight = item.weight || 100;
                const itemVolume = item.volume || 100;
                
                if (currentWeight + itemWeight <= pocket.maxWeight && currentVolume + itemVolume <= pocket.maxVolume) {
                    // Remove from player
                    player.containerSystem.removeItem(stored.container, item, stored.pocketIndex);
                    const invIndex = player.inventory.indexOf(item);
                    if (invIndex !== -1) player.inventory.splice(invIndex, 1);
                    
                    // Add to furniture
                    if (!pocket.contents) pocket.contents = [];
                    pocket.contents.push(item);
                    
                    game.ui.log(`Stored ${item.name} in ${furniture.name}.`, 'info');
                    placed = true;
                    break;
                }
            }
            
            if (!placed) {
                game.ui.log(`${furniture.name} is full.`, 'warning');
            }
            
            showFurnitureContentsModal(uiManager, furniture);
        });
    });
}
