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
    const icon = worldObject.type === 'door' ? '🚪' : '📦';
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
            description: 'Open the door (1 turn)',
            available: !worldObject.state.locked && !worldObject.state.open
        },
        close: {
            name: 'Close',
            icon: '↙',
            description: 'Close the door (1 turn)',
            available: worldObject.state.open
        },
        peek: {
            name: 'Peek',
            icon: '👁',
            description: 'Look through the door (1 turn)',
            available: !worldObject.state.open
        },
        knock: {
            name: 'Knock',
            icon: '✊',
            description: 'Knock on the door (1 turn, makes noise)',
            available: !worldObject.state.open
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
            available: worldObject.state.open,
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
            description: 'Board up the door (materials required)',
            available: false,
            requirement: 'Not yet implemented'
        },
        remove_barricade: {
            name: 'Remove Barricade',
            icon: '🔨',
            description: 'Remove boards from door (crowbar required)',
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
