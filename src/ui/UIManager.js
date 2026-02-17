import { showDisassembleModal } from './DisassembleModal.js';
import { showCraftingUI } from './CraftingUI.js';
import { showWorldObjectModal, showFurnitureContentsModal } from './WorldObjectModal.js';
import { Anatomy } from '../entities/Anatomy.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.logPanel = null;
        this.characterPanel = null;
        this.inventoryPanel = null;
        this.contextPanel = null;
        this.logEntries = [];
        this.maxLogEntries = 50;
        this.disassembleContext = null;
        this.craftingContext = null;
        this.worldObjectContext = null;
    }
    
    showDisassembleModal(item, sourceType, sourceData) {
        showDisassembleModal(this, item, sourceType, sourceData);
    }
    
    showWorldObjectModal(worldObject) {
        showWorldObjectModal(this, worldObject);
    }
    
    toggleCraftingScreen() {
        if (this.detailedInventoryModal.classList.contains('hidden')) {
            this.detailedInventoryModal.classList.remove('hidden');
            showCraftingUI(this);
        } else {
            this.detailedInventoryModal.classList.add('hidden');
        }
    }
    
    init() {
        this.logPanel = document.getElementById('log-content');
        this.characterPanel = document.getElementById('character-content');
        this.contextPanel = document.getElementById('context-content');
        this.locationPanel = document.getElementById('location-content');
        
        this.minimapCanvas = document.getElementById('minimap-canvas');
        if (this.minimapCanvas) {
            this.minimapCtx = this.minimapCanvas.getContext('2d');
        }
        
        this.detailedCharacterModal = document.getElementById('detailed-character');
        this.detailedInventoryModal = document.getElementById('detailed-inventory');
        this.helpModal = document.getElementById('help-screen');
        this.abilityPanelModal = document.getElementById('ability-panel');
        this.abilityPopup = document.getElementById('ability-popup');
        
        // Combat overlay elements
        this.combatOverlay = document.getElementById('combat-overlay');
        this.combatPlayerPanel = document.getElementById('combat-player-panel');
        this.combatFeedPanel = document.getElementById('combat-feed-panel');
        this.combatEnemyPanel = document.getElementById('combat-enemy-panel');
        this.combatOverlayVisible = false;
        
        document.getElementById('close-character-btn').addEventListener('click', () => {
            this.detailedCharacterModal.classList.add('hidden');
        });
        
        document.getElementById('close-inventory-btn').addEventListener('click', () => {
            this.detailedInventoryModal.classList.add('hidden');
        });
        
        document.getElementById('close-help-btn').addEventListener('click', () => {
            this.helpModal.classList.add('hidden');
        });
        
        document.getElementById('close-ability-btn').addEventListener('click', () => {
            this.abilityPanelModal.classList.add('hidden');
        });
        
        const closeCombatBtn = document.getElementById('close-combat-btn');
        if (closeCombatBtn) {
            closeCombatBtn.addEventListener('click', () => {
                this.toggleCombatOverlay();
            });
        }
    }
    
    log(message, type = 'info') {
        this.logEntries.push({ message, type, turn: this.game.turnCount });
        
        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries.shift();
        }
        
        this.updateLog();
    }
    
    updateLog() {
        if (!this.logPanel) return;
        
        this.logPanel.innerHTML = '';
        
        for (let i = this.logEntries.length - 1; i >= 0; i--) {
            const entry = this.logEntries[i];
            const div = document.createElement('div');
            div.className = `log-entry ${entry.type}`;
            div.textContent = `[${entry.turn}] ${entry.message}`;
            this.logPanel.appendChild(div);
        }
    }
    
    updatePanels() {
        this.updateCharacterPanel();
        this.updateContextPanel();
        this.updateLocationPanel();
        this.updateMinimap();
        
        // Auto-manage combat overlay
        if (this.game.combatSystem) {
            const inCombat = this.game.combatSystem.isInCombat();
            if (inCombat && this.combatOverlayVisible) {
                this.updateCombatOverlay();
            } else if (!inCombat && this.combatOverlayVisible) {
                // Auto-hide after combat ends
                this.hideCombatOverlay();
            }
        }
    }
    
    updateCharacterPanel() {
        if (!this.characterPanel || !this.game.player) return;
        
        const player = this.game.player;
        const mode = player.movementModes[player.movementMode];
        
        let html = '';
        html += `<div class="stat-line"><span class="stat-label">Name:</span> <span class="stat-value">${player.name}</span></div>`;
        
        // Body condition (replaces HP bar)
        const condition = player.anatomy.getBodyCondition();
        html += `<div class="stat-line"><span class="stat-label">Condition:</span> <span class="stat-value" style="color: ${condition.color}; font-weight: bold;">${condition.label}</span></div>`;
        if (condition.details) {
            html += `<div class="stat-line"><span class="stat-label"></span> <span class="stat-value" style="color: ${condition.color}; font-size: 13px;">${condition.details}</span></div>`;
        }
        
        // Blood level
        const bloodStatus = player.anatomy.getBloodStatus();
        html += `<div class="stat-line"><span class="stat-label">Blood:</span> <span class="stat-value" style="color: ${bloodStatus.color};">${Math.floor(player.anatomy.blood)}%</span></div>`;
        
        // Active wounds count
        if (player.anatomy.wounds.length > 0) {
            html += `<div class="stat-line"><span class="stat-label">Wounds:</span> <span class="stat-value" style="color: #ff4444;">${player.anatomy.wounds.length} bleeding</span></div>`;
        }
        
        const hungerColor = player.hunger < 20 ? '#ff4444' : player.hunger < 50 ? '#ffaa00' : '#00ff00';
        const thirstColor = player.thirst < 20 ? '#ff4444' : player.thirst < 50 ? '#ffaa00' : '#00ff00';
        html += `<div class="stat-line"><span class="stat-label">Hunger:</span> <span class="stat-value" style="color: ${hungerColor};">${Math.floor(player.hunger)}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Thirst:</span> <span class="stat-value" style="color: ${thirstColor};">${Math.floor(player.thirst)}</span></div>`;
        
        html += `<div class="stat-line"><span class="stat-label">Mode:</span> <span class="stat-value" style="color: ${mode.color};">${mode.name}</span></div>`;
        
        // Combat stance
        const stance = player.getStance();
        html += `<div class="stat-line"><span class="stat-label">Stance:</span> <span class="stat-value" style="color: ${stance.color}; font-weight: bold;">${stance.name}</span></div>`;
        
        html += `<div class="stat-line"><span class="stat-label">Turn:</span> <span class="stat-value">${this.game.turnCount}</span></div>`;
        html += '<br>';
        
        const encumbrance = player.getEncumbranceLevel();
        const encumbranceColors = {
            light: '#00ff00',
            medium: '#ffaa00',
            heavy: '#ff8800',
            overencumbered: '#ff4444'
        };
        const weight = player.containerSystem.formatWeight(player.getCurrentCarryWeight());
        const maxWeight = player.containerSystem.formatWeight(player.maxWeight);
        html += `<div class="stat-line"><span class="stat-label">Weight:</span> <span class="stat-value" style="color: ${encumbranceColors[encumbrance]};">${weight}/${maxWeight}</span></div>`;
        
        this.characterPanel.innerHTML = html;
    }
    
    updateMinimap() {
        if (!this.minimapCanvas || !this.minimapCtx || !this.game.player || !this.game.fov) return;
        
        const ctx = this.minimapCtx;
        const player = this.game.player;
        const world = this.game.world;
        const fov = this.game.fov;
        
        const RADIUS = 64;
        const TILE_PX = 2;
        const mapSize = RADIUS * 2 + 1;
        const canvasSize = mapSize * TILE_PX;
        
        // Set canvas internal resolution
        if (this.minimapCanvas.width !== canvasSize || this.minimapCanvas.height !== canvasSize) {
            this.minimapCanvas.width = canvasSize;
            this.minimapCanvas.height = canvasSize;
        }
        
        // Clear
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvasSize, canvasSize);
        
        const z = player.z;
        const startX = player.x - RADIUS;
        const startY = player.y - RADIUS;
        
        // Tile color lookup
        const getColor = (tile, visible) => {
            const dim = visible ? 1.0 : 0.4;
            let r = 0, g = 0, b = 0;
            
            if (tile.name === 'Wall' || tile.name === 'Interior Wall') {
                r = 80; g = 80; b = 80;
            } else if (tile.name === 'Floor') {
                r = 60; g = 50; b = 40;
            } else if (tile.name === 'Road') {
                r = 50; g = 50; b = 55;
            } else if (tile.name === 'Sidewalk') {
                r = 70; g = 70; b = 65;
            } else if (tile.name === 'Grass') {
                r = 30; g = 60; b = 20;
            } else if (tile.name === 'Dirt') {
                r = 70; g = 55; b = 35;
            } else if (tile.isStaircase || tile.isManhole || tile.isLadder) {
                r = 0; g = 200; b = 200;
            } else if (tile.blocked) {
                r = 60; g = 60; b = 60;
            } else {
                r = 40; g = 40; b = 35;
            }
            
            // Room-tagged tiles get a subtle tint
            if (tile.roomType) {
                r = Math.min(255, r + 15);
                g = Math.min(255, g + 10);
            }
            
            r = Math.round(r * dim);
            g = Math.round(g * dim);
            b = Math.round(b * dim);
            return `rgb(${r},${g},${b})`;
        };
        
        // Draw explored tiles
        for (let dy = 0; dy < mapSize; dy++) {
            for (let dx = 0; dx < mapSize; dx++) {
                const wx = startX + dx;
                const wy = startY + dy;
                const key = `${wx},${wy},${z}`;
                
                if (fov.exploredTiles.has(key)) {
                    const tile = world.getTile(wx, wy, z);
                    const visible = fov.visibleTiles.has(key);
                    ctx.fillStyle = getColor(tile, visible);
                    ctx.fillRect(dx * TILE_PX, dy * TILE_PX, TILE_PX, TILE_PX);
                }
            }
        }
        
        // Draw entities (NPCs) in visible range
        if (world.entities) {
            for (const entity of world.entities) {
                if (entity === player) continue;
                if (entity.z !== z) continue;
                const ex = entity.x - startX;
                const ey = entity.y - startY;
                if (ex >= 0 && ex < mapSize && ey >= 0 && ey < mapSize) {
                    if (fov.visibleTiles.has(`${entity.x},${entity.y},${z}`)) {
                        ctx.fillStyle = '#ff4444';
                        ctx.fillRect(ex * TILE_PX, ey * TILE_PX, TILE_PX, TILE_PX);
                    }
                }
            }
        }
        
        // Draw items in visible range
        if (world.items) {
            for (const item of world.items) {
                if (item.z !== undefined && item.z !== z) continue;
                const ix = item.x - startX;
                const iy = item.y - startY;
                if (ix >= 0 && ix < mapSize && iy >= 0 && iy < mapSize) {
                    if (fov.visibleTiles.has(`${item.x},${item.y},${z}`)) {
                        ctx.fillStyle = '#ffcc00';
                        ctx.fillRect(ix * TILE_PX, iy * TILE_PX, TILE_PX, TILE_PX);
                    }
                }
            }
        }
        
        // Draw player (bright white, 3x3 for visibility)
        const px = RADIUS * TILE_PX;
        const py = RADIUS * TILE_PX;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 1, py - 1, TILE_PX + 2, TILE_PX + 2);
    }
    
    updateContextPanel() {
        if (!this.contextPanel || !this.game.player) return;
        
        const player = this.game.player;
        const tile = this.game.world.getTile(player.x, player.y);
        
        let html = '';
        html += `<div class="stat-line"><span class="stat-label">Tile:</span> <span class="stat-value">${tile.name}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Pos:</span> <span class="stat-value">(${player.x}, ${player.y})</span></div>`;
        
        if (this.game.world.extractionPoint) {
            const ex = this.game.world.extractionPoint;
            const dist = Math.floor(Math.sqrt(Math.pow(ex.x - player.x, 2) + Math.pow(ex.y - player.y, 2)));
            html += `<div class="stat-line"><span class="stat-label">Extraction:</span> <span class="stat-value" style="color: #00ff00;">${dist} tiles</span></div>`;
        }
        
        const accessCard = this.game.world.items.find(item => item.id === 'access_card');
        if (accessCard && !player.inventory.some(item => item.id === 'access_card')) {
            const dist = Math.floor(Math.sqrt(Math.pow(accessCard.x - player.x, 2) + Math.pow(accessCard.y - player.y, 2)));
            html += `<div class="stat-line"><span class="stat-label">Access Card:</span> <span class="stat-value" style="color: #00ff00;">${dist} tiles</span></div>`;
        }
        
        const items = this.game.world.getItemsAt(player.x, player.y, player.z);
        if (items.length > 0) {
            html += '<br><div style="color: #ffaa00;">Items here:</div>';
            for (const item of items) {
                html += `<div style="color: ${item.color};">${item.name}</div>`;
            }
        }
        
        this.contextPanel.innerHTML = html;
    }
    
    updateLocationPanel() {
        if (!this.locationPanel || !this.game.player || !this.game.world) return;
        
        const player = this.game.player;
        const world = this.game.world;
        const tile = world.getTile(player.x, player.y, player.z);
        const biome = world.getBiomeAt(player.x, player.y);
        
        const biomeNames = {
            urban_core: 'Urban Core',
            suburbs: 'Suburbs',
            industrial: 'Industrial Zone',
            rich_neighborhood: 'Rich Neighborhood',
            rural: 'Rural Outskirts',
            forest: 'Forest',
            ruins: 'Ruins',
            unknown: 'Unknown'
        };
        
        const biomeColors = {
            urban_core: '#00ccff',
            suburbs: '#88cc44',
            industrial: '#cc8800',
            rich_neighborhood: '#ddaa44',
            rural: '#aa8855',
            forest: '#44aa44',
            ruins: '#888888',
            unknown: '#666666'
        };
        
        const roomTypeNames = {
            residential_living: 'Living Room',
            residential_bedroom: 'Bedroom',
            residential_kitchen: 'Kitchen',
            residential_bathroom: 'Bathroom',
            commercial_store: 'Store',
            commercial_backroom: 'Back Room',
            office: 'Office',
            office_reception: 'Reception',
            medical_store: 'Pharmacy',
            medical_storage: 'Medical Storage',
            medical_waiting: 'Waiting Room',
            medical_exam: 'Exam Room',
            garage_bay: 'Garage Bay',
            garage_tools: 'Tool Room',
            warehouse_floor: 'Warehouse Floor',
            warehouse_storage: 'Storage Bay'
        };
        
        let html = '';
        
        // Time of day
        if (this.game.timeSystem) {
            const time = this.game.timeSystem;
            const period = time.getTimePeriod();
            const periodColors = {
                'Dawn': '#ff8844', 'Morning': '#ffcc44', 'Late Morning': '#ffee66',
                'Midday': '#ffffaa', 'Afternoon': '#ffdd55', 'Evening': '#ff8844',
                'Dusk': '#cc6644', 'Night': '#4466aa'
            };
            const periodColor = periodColors[period] || '#aaaaaa';
            html += `<div class="stat-line"><span class="stat-label">Time:</span> <span class="stat-value" style="color: ${periodColor};">${time.getTimeString()} - ${period}</span></div>`;
            html += `<div class="stat-line"><span class="stat-label">Day:</span> <span class="stat-value">${time.getDay()}</span></div>`;
        }
        
        // Biome
        const biomeName = biomeNames[biome] || biome;
        const biomeColor = biomeColors[biome] || '#aaaaaa';
        html += `<div class="stat-line"><span class="stat-label">Biome:</span> <span class="stat-value" style="color: ${biomeColor};">${biomeName}</span></div>`;
        
        // Floor level
        const floorLabel = player.z === 0 ? 'Ground' : player.z > 0 ? `Floor ${player.z}` : `Basement ${Math.abs(player.z)}`;
        html += `<div class="stat-line"><span class="stat-label">Floor:</span> <span class="stat-value">${floorLabel}</span></div>`;
        
        // Building / Room
        if (tile.roomType) {
            const roomName = roomTypeNames[tile.roomType] || tile.roomType;
            html += `<div class="stat-line"><span class="stat-label">Room:</span> <span class="stat-value" style="color: #ffcc44;">${roomName}</span></div>`;
        } else if (tile.name === 'Floor') {
            html += `<div class="stat-line"><span class="stat-label">Area:</span> <span class="stat-value" style="color: #aaaaaa;">Building Interior</span></div>`;
        } else if (tile.name === 'Wall' || tile.name === 'Interior Wall') {
            html += `<div class="stat-line"><span class="stat-label">Area:</span> <span class="stat-value" style="color: #666666;">Wall</span></div>`;
        } else if (tile.name === 'Sidewalk') {
            html += `<div class="stat-line"><span class="stat-label">Area:</span> <span class="stat-value" style="color: #888888;">Sidewalk</span></div>`;
        } else if (tile.name === 'Road') {
            html += `<div class="stat-line"><span class="stat-label">Area:</span> <span class="stat-value" style="color: #555555;">Road</span></div>`;
        } else {
            html += `<div class="stat-line"><span class="stat-label">Area:</span> <span class="stat-value" style="color: #888888;">Outdoors</span></div>`;
        }
        
        this.locationPanel.innerHTML = html;
    }
    
    updateInspectInfo(x, y) {
        if (!this.contextPanel) return;
        
        let html = '<h4 style="color: #ffff00; margin-bottom: 8px; border-bottom: 2px solid #ffff00; padding-bottom: 5px;">🔍 INSPECTING</h4>';
        
        if (!this.game.fov) {
            html += '<div style="color: #ff0000;">FoV system not initialized</div>';
            this.contextPanel.innerHTML = html;
            return;
        }
        
        const playerZ = this.game.player.z;
        const isVisible = this.game.fov.isVisible(x, y, playerZ);
        const isExplored = this.game.fov.isExplored(x, y, playerZ);
        
        html += `<div style="margin-bottom: 10px; padding: 5px; background: #1a1a1a; border-left: 3px solid #ffff00;">`;
        html += `<div style="font-size: 15px; color: #aaa;">Location: <span style="color: #ffff00;">(${x}, ${y}, Z${playerZ})</span></div>`;
        
        if (!isExplored) {
            html += '<div style="color: #666; margin-top: 5px;">⚫ Area not yet explored</div>';
            html += '</div>';
            this.contextPanel.innerHTML = html;
            return;
        }
        
        const tile = this.game.world.getTile(x, y, playerZ);
        html += `<div style="font-size: 15px; color: #aaa;">Terrain: <span style="color: #00ffff;">${tile.name}</span></div>`;
        
        if (!isVisible) {
            html += '<div style="color: #888; margin-top: 5px;">👁️ Out of current sight</div>';
            html += '<div style="font-size: 14px; color: #888;">(Previously explored)</div>';
            html += '</div>';
            this.contextPanel.innerHTML = html;
            return;
        }
        
        html += '<div style="color: #00ff00; margin-top: 5px; font-size: 14px;">✓ Currently visible</div>';
        html += '</div>';
        
        const extraction = this.game.world.extractionPoint;
        if (extraction && extraction.x === x && extraction.y === y) {
            html += '<div style="margin-top: 10px; padding: 5px; background: #0a1a0a; border-left: 3px solid #00ff00;">';
            html += '<div style="color: #00ff00; font-weight: bold; margin-bottom: 3px;">🚪 EXTRACTION POINT</div>';
            html += `<div style="color: ${extraction.color}; font-weight: bold; font-size: 16px;">${extraction.name}</div>`;
            html += `<div style="font-size: 15px; color: #aaa; margin-top: 5px;">${extraction.getRequirementText()}</div>`;
            if (extraction.canUse(this.game.player)) {
                html += '<div style="font-size: 15px; color: #00ff00; margin-top: 5px;">✓ Ready to extract</div>';
            } else {
                html += '<div style="font-size: 15px; color: #ffaa00; margin-top: 5px;">⚠ Missing requirements</div>';
            }
            html += '</div>';
        }
        
        const entity = this.game.world.getEntityAt(x, y, this.game.player.z);
        if (entity) {
            html += '<div style="margin-top: 10px; padding: 5px; background: #1a0a0a; border-left: 3px solid #ff4444;">';
            html += '<div style="color: #ff4444; font-weight: bold; margin-bottom: 3px;">👤 ENTITY</div>';
            html += `<div style="color: ${entity.color}; font-weight: bold; font-size: 16px;">${entity.name}</div>`;
            if (entity.getDetectionLabel) {
                const label = entity.getDetectionLabel();
                const dColor = entity.getDetectionColor();
                html += `<div style="font-size: 13px; color: ${dColor}; font-weight: bold;">${label}</div>`;
            }
            if (entity.anatomy) {
                const cond = entity.anatomy.getBodyCondition();
                html += `<div style="font-size: 15px; color: ${cond.color}; font-weight: bold;">${cond.label}</div>`;
                if (cond.details) {
                    html += `<div style="font-size: 13px; color: ${cond.color};">${cond.details}</div>`;
                }
                const bloodPct = Math.floor(entity.anatomy.blood);
                const bColor = entity.anatomy.getBloodStatus().color;
                html += `<div style="font-size: 13px; color: ${bColor};">Blood: ${bloodPct}%</div>`;
                if (entity.anatomy.wounds.length > 0) {
                    html += `<div style="font-size: 13px; color: #ff4444;">${entity.anatomy.wounds.length} bleeding wound(s)</div>`;
                }
                if (entity.weapon) {
                    html += `<div style="font-size: 13px; color: #ffaa00;">Armed: ${entity.weapon.name}</div>`;
                }
            }
            html += '</div>';
        }
        
        const items = this.game.world.getItemsAt(x, y, this.game.player.z);
        if (items.length > 0) {
            html += '<div style="margin-top: 10px; padding: 5px; background: #1a1a0a; border-left: 3px solid #ffaa00;">';
            html += '<div style="color: #ffaa00; font-weight: bold; margin-bottom: 3px;">📦 ITEMS ON GROUND</div>';
            for (const item of items) {
                html += `<div style="color: ${item.color}; font-size: 15px; margin-bottom: 2px;">• ${item.name}</div>`;
                if (item.type) {
                    html += `<div style="font-size: 14px; color: #888; margin-left: 10px;">Type: ${item.type}</div>`;
                }
            }
            html += '</div>';
        }
        
        if (!entity && items.length === 0) {
            html += '<div style="margin-top: 10px; padding: 5px; color: #888; font-size: 15px;">Nothing of interest here.</div>';
        }
        
        this.contextPanel.innerHTML = html;
    }
    
    showCharacterCreation() {
        const modal = document.getElementById('character-creation');
        const form = document.getElementById('creation-form');
        
        const charSys = this.game.charCreationSystem;
        
        let html = '';
        
        html += '<div style="max-height: 70vh; overflow-y: auto; padding-right: 10px;">';
        
        html += '<div class="form-group">';
        html += '<label style="color: #00ffff; font-size: 16px;">Name:</label>';
        html += '<div style="display: flex; gap: 10px;">';
        html += '<input type="text" id="char-name" value="Survivor" style="flex: 1; padding: 8px; font-size: 14px;" />';
        html += '<button id="random-name-btn" type="button" style="padding: 8px 16px;">Random</button>';
        html += '</div>';
        html += '</div>';
        
        html += '<div class="form-group" style="margin-top: 20px;">';
        html += '<label style="color: #00ffff; font-size: 16px;">Gender:</label>';
        html += '<select id="char-gender" style="width: 100%; padding: 8px; font-size: 14px;">';
        html += '<option value="male">Male</option>';
        html += '<option value="female">Female</option>';
        html += '<option value="other">Other</option>';
        html += '</select>';
        html += '</div>';
        
        html += '<div class="form-group" style="margin-top: 20px;">';
        html += '<label style="color: #00ffff; font-size: 16px; margin-bottom: 10px; display: block;">Background:</label>';
        const backgrounds = charSys.getAllBackgrounds();
        for (const bg of backgrounds) {
            html += '<div class="background-option" style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border: 2px solid #333; cursor: pointer;" data-bg-id="' + bg.id + '">';
            html += '<div style="color: #ffaa00; font-weight: bold; font-size: 14px;">' + bg.name + '</div>';
            html += '<div style="color: #aaa; font-size: 15px; margin: 5px 0; line-height: 1.4;">' + bg.description + '</div>';
            html += '<div style="color: #00ffff; font-size: 15px;">Stats: ';
            const statMods = [];
            for (const [stat, mod] of Object.entries(bg.statMods)) {
                const sign = mod > 0 ? '+' : '';
                statMods.push(stat.toUpperCase() + ' ' + sign + mod);
            }
            html += statMods.join(', ');
            html += '</div>';
            html += '</div>';
        }
        html += '</div>';
        
        html += '<div class="form-group" style="margin-top: 20px;">';
        html += '<label style="color: #00ffff; font-size: 16px;">Distribute 50 points across stats:</label>';
        html += '<div style="margin-top: 10px;"><label>Strength:</label> <input type="number" id="stat-str" value="10" min="1" max="20" class="stat-input" /></div>';
        html += '<div><label>Agility:</label> <input type="number" id="stat-agi" value="10" min="1" max="20" class="stat-input" /></div>';
        html += '<div><label>Endurance:</label> <input type="number" id="stat-end" value="10" min="1" max="20" class="stat-input" /></div>';
        html += '<div><label>Intelligence:</label> <input type="number" id="stat-int" value="10" min="1" max="20" class="stat-input" /></div>';
        html += '<div><label>Perception:</label> <input type="number" id="stat-per" value="10" min="1" max="20" class="stat-input" /></div>';
        html += '<div id="stat-total" style="margin-top: 10px; color: #ffaa00; font-weight: bold;">Total: 50/50</div>';
        html += '</div>';
        
        html += '<div class="form-group" style="margin-top: 20px;">';
        html += '<label style="color: #00ffff; font-size: 16px; margin-bottom: 10px; display: block;">Traits (3 points available):</label>';
        html += '<div id="trait-points" style="margin-bottom: 10px; color: #ffaa00; font-weight: bold;">Points: 3</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += '<div style="color: #00ff00; font-weight: bold; margin-bottom: 5px;">Positive Traits (Cost Points):</div>';
        const posTraits = charSys.getPositiveTraits();
        for (const trait of posTraits) {
            html += '<div style="margin-bottom: 8px; padding: 8px; background: #0a1a0a; border-left: 3px solid #00ff00;">';
            html += '<label style="cursor: pointer; display: block;">';
            html += '<input type="checkbox" class="trait-checkbox" data-trait-id="' + trait.id + '" data-trait-cost="' + trait.cost + '" /> ';
            html += '<span style="color: #00ff00; font-weight: bold; font-size: 18px;">' + trait.name + '</span> <span style="color: #ffaa00; font-size: 16px;">(Cost: ' + trait.cost + ')</span>';
            html += '<div style="color: #ccc; font-size: 16px; margin-top: 5px; line-height: 1.4;">' + trait.description + '</div>';
            html += '</label>';
            html += '</div>';
        }
        html += '</div>';
        
        html += '<div>';
        html += '<div style="color: #ff4444; font-weight: bold; margin-bottom: 5px;">Negative Traits (Give Points):</div>';
        const negTraits = charSys.getNegativeTraits();
        for (const trait of negTraits) {
            html += '<div style="margin-bottom: 8px; padding: 8px; background: #1a0a0a; border-left: 3px solid #ff4444;">';
            html += '<label style="cursor: pointer; display: block;">';
            html += '<input type="checkbox" class="trait-checkbox" data-trait-id="' + trait.id + '" data-trait-cost="' + trait.cost + '" /> ';
            html += '<span style="color: #ff4444; font-weight: bold; font-size: 18px;">' + trait.name + '</span> <span style="color: #00ff00; font-size: 16px;">(Gives: ' + Math.abs(trait.cost) + ')</span>';
            html += '<div style="color: #ccc; font-size: 16px; margin-top: 5px; line-height: 1.4;">' + trait.description + '</div>';
            html += '</label>';
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        html += '<div style="display: flex; gap: 10px; margin-top: 20px;">';
        html += '<button id="play-now-btn" style="flex: 1; padding: 12px; font-size: 16px; background: #ff8800; border: 2px solid #ffaa00;">⚡ Play Now</button>';
        html += '<button id="start-game-btn" style="flex: 1; padding: 12px; font-size: 16px;">Start Game</button>';
        html += '</div>';
        
        form.innerHTML = html;
        modal.classList.remove('hidden');
        
        let selectedBackground = null;
        
        const bgOptions = form.querySelectorAll('.background-option');
        bgOptions.forEach(option => {
            option.addEventListener('click', () => {
                bgOptions.forEach(o => o.style.border = '2px solid #333');
                option.style.border = '2px solid #00ffff';
                selectedBackground = option.getAttribute('data-bg-id');
            });
        });
        
        const statInputs = form.querySelectorAll('.stat-input');
        const updateStatTotal = () => {
            let total = 0;
            statInputs.forEach(input => {
                total += parseInt(input.value) || 0;
            });
            const totalDiv = document.getElementById('stat-total');
            totalDiv.textContent = `Total: ${total}/50`;
            totalDiv.style.color = total === 50 ? '#00ff00' : (total > 50 ? '#ff4444' : '#ffaa00');
        };
        
        statInputs.forEach(input => {
            input.addEventListener('input', updateStatTotal);
        });
        
        const traitCheckboxes = form.querySelectorAll('.trait-checkbox');
        const updateTraitPoints = () => {
            let points = 3;
            traitCheckboxes.forEach(cb => {
                if (cb.checked) {
                    points -= parseInt(cb.getAttribute('data-trait-cost'));
                }
            });
            const pointsDiv = document.getElementById('trait-points');
            pointsDiv.textContent = `Points: ${points}`;
            pointsDiv.style.color = points >= 0 ? '#00ff00' : '#ff4444';
        };
        
        traitCheckboxes.forEach(cb => {
            cb.addEventListener('change', updateTraitPoints);
        });
        
        const generateCyberpunkName = () => {
            const firstNames = ['Raze', 'Cipher', 'Vex', 'Nyx', 'Kade', 'Zara', 'Jax', 'Nova', 'Ash', 'Rook', 'Blade', 'Echo', 'Hex', 'Sable', 'Wraith'];
            const lastNames = ['Chrome', 'Steel', 'Volt', 'Neon', 'Razor', 'Ghost', 'Wire', 'Byte', 'Shade', 'Spark', 'Edge', 'Frost', 'Blaze', 'Storm', 'Void'];
            const first = firstNames[Math.floor(Math.random() * firstNames.length)];
            const last = lastNames[Math.floor(Math.random() * lastNames.length)];
            return `${first} ${last}`;
        };
        
        document.getElementById('random-name-btn').addEventListener('click', () => {
            document.getElementById('char-name').value = generateCyberpunkName();
        });
        
        document.getElementById('play-now-btn').addEventListener('click', () => {
            const backgrounds = charSys.getAllBackgrounds();
            const randomBg = backgrounds[Math.floor(Math.random() * backgrounds.length)];
            
            const genders = ['male', 'female', 'other'];
            const randomGender = genders[Math.floor(Math.random() * genders.length)];
            
            const allTraits = [...charSys.getPositiveTraits(), ...charSys.getNegativeTraits()];
            const selectedTraits = [];
            let points = 3;
            
            const shuffled = allTraits.sort(() => Math.random() - 0.5);
            for (const trait of shuffled) {
                if (points - trait.cost >= 0 && selectedTraits.length < 3) {
                    selectedTraits.push(trait.id);
                    points -= trait.cost;
                }
            }
            
            const stats = [10, 10, 10, 10, 10];
            let remaining = 0;
            for (let i = 0; i < 5; i++) {
                const add = Math.floor(Math.random() * 6);
                stats[i] += add;
                remaining += add;
            }
            
            const characterData = {
                name: generateCyberpunkName(),
                gender: randomGender,
                background: randomBg.id,
                traits: selectedTraits,
                strength: stats[0],
                agility: stats[1],
                endurance: stats[2],
                intelligence: stats[3],
                perception: stats[4]
            };
            
            modal.classList.add('hidden');
            this.game.startGame(characterData);
        });
        
        document.getElementById('start-game-btn').addEventListener('click', () => {
            if (!selectedBackground) {
                alert('Please select a background!');
                return;
            }
            
            const total = Array.from(statInputs).reduce((sum, input) => sum + (parseInt(input.value) || 0), 0);
            if (total !== 50) {
                alert('Stats must total exactly 50 points!');
                return;
            }
            
            let traitPoints = 3;
            const selectedTraits = [];
            traitCheckboxes.forEach(cb => {
                if (cb.checked) {
                    selectedTraits.push(cb.getAttribute('data-trait-id'));
                    traitPoints -= parseInt(cb.getAttribute('data-trait-cost'));
                }
            });
            
            if (traitPoints < 0) {
                alert('Not enough trait points!');
                return;
            }
            
            const characterData = {
                name: document.getElementById('char-name').value,
                gender: document.getElementById('char-gender').value,
                background: selectedBackground,
                traits: selectedTraits,
                strength: parseInt(document.getElementById('stat-str').value),
                agility: parseInt(document.getElementById('stat-agi').value),
                endurance: parseInt(document.getElementById('stat-end').value),
                intelligence: parseInt(document.getElementById('stat-int').value),
                perception: parseInt(document.getElementById('stat-per').value)
            };
            
            modal.classList.add('hidden');
            this.game.startGame(characterData);
        });
    }
    
    toggleCharacterScreen() {
        if (!this.detailedCharacterModal) return;
        
        if (this.detailedCharacterModal.classList.contains('hidden')) {
            this.showDetailedCharacter();
            this.detailedCharacterModal.classList.remove('hidden');
        } else {
            this.detailedCharacterModal.classList.add('hidden');
        }
    }
    
    showDetailedCharacter() {
        if (!this.game.player) return;
        
        const player = this.game.player;
        const content = document.getElementById('detailed-character-content');
        
        let html = '';
        html += '<div style="margin-bottom: 20px;">';
        html += `<h3 style="color: #00ffff; margin-bottom: 10px;">${player.name}</h3>`;
        if (player.background) {
            html += `<div class="stat-line"><span class="stat-label">Background:</span> <span class="stat-value" style="color: #ffaa00;">${player.background}</span></div>`;
        }
        if (player.gender) {
            html += `<div class="stat-line"><span class="stat-label">Gender:</span> <span class="stat-value">${player.gender}</span></div>`;
        }
        
        // Body condition (replaces HP)
        const detailCond = player.anatomy.getBodyCondition();
        html += `<div class="stat-line"><span class="stat-label">Condition:</span> <span class="stat-value" style="color: ${detailCond.color}; font-weight: bold;">${detailCond.label}</span></div>`;
        if (detailCond.details) {
            html += `<div class="stat-line"><span class="stat-label"></span> <span class="stat-value" style="color: ${detailCond.color}; font-size: 13px;">${detailCond.details}</span></div>`;
        }
        const detailBlood = player.anatomy.getBloodStatus();
        html += `<div class="stat-line"><span class="stat-label">Blood:</span> <span class="stat-value" style="color: ${detailBlood.color};">${Math.floor(player.anatomy.blood)}%</span></div>`;
        if (player.anatomy.wounds.length > 0) {
            html += `<div class="stat-line"><span class="stat-label">Wounds:</span> <span class="stat-value" style="color: #ff4444;">${player.anatomy.wounds.length} active</span></div>`;
            for (const wound of player.anatomy.wounds) {
                const wColor = wound.type === 'arterial' ? '#ff0000' : '#ff6644';
                html += `<div style="margin-left: 15px; font-size: 13px; color: ${wColor};">• ${wound.part} — ${wound.type} (${wound.severity.toFixed(1)}/turn)</div>`;
            }
        }
        
        const hungerColor = player.hunger < 20 ? '#ff4444' : player.hunger < 50 ? '#ffaa00' : '#00ff00';
        const thirstColor = player.thirst < 20 ? '#ff4444' : player.thirst < 50 ? '#ffaa00' : '#00ff00';
        html += `<div class="stat-line"><span class="stat-label">Hunger:</span> <span class="stat-value" style="color: ${hungerColor};">${Math.floor(player.hunger)}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Thirst:</span> <span class="stat-value" style="color: ${thirstColor};">${Math.floor(player.thirst)}</span></div>`;
        
        html += `<div class="stat-line"><span class="stat-label">Turn:</span> <span class="stat-value">${this.game.turnCount}</span></div>`;
        html += '</div>';
        
        if (player.selectedTraits && player.selectedTraits.length > 0) {
            html += '<div style="margin-bottom: 20px;">';
            html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Traits</h4>';
            const charSys = this.game.charCreationSystem;
            for (const traitId of player.selectedTraits) {
                const trait = charSys.getTrait(traitId);
                if (trait) {
                    const color = trait.type === 'positive' ? '#00ff00' : '#ff4444';
                    html += `<div style="margin-bottom: 5px;"><span style="color: ${color}; font-weight: bold;">${trait.name}</span></div>`;
                    html += `<div style="color: #aaa; font-size: 15px; margin-left: 10px; margin-bottom: 8px; line-height: 1.4;">${trait.description}</div>`;
                }
            }
            html += '</div>';
        }
        
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Stats</h4>';
        html += `<div class="stat-line"><span class="stat-label">Strength:</span> <span class="stat-value">${player.stats.strength}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Agility:</span> <span class="stat-value">${player.stats.agility}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Endurance:</span> <span class="stat-value">${player.stats.endurance}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Intelligence:</span> <span class="stat-value">${player.stats.intelligence}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Perception:</span> <span class="stat-value">${player.stats.perception}</span></div>`;
        html += '</div>';
        
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 12px;">Anatomy</h4>';
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">';
        html += '<div>' + this.renderAnatomySection('Head', player.anatomy.parts.head) + '</div>';
        html += '<div>' + this.renderAnatomySection('Torso', player.anatomy.parts.torso) + '</div>';
        html += '<div>' + this.renderAnatomySection('Left Arm', player.anatomy.parts.leftArm) + '</div>';
        html += '<div>' + this.renderAnatomySection('Right Arm', player.anatomy.parts.rightArm) + '</div>';
        html += '<div>' + this.renderAnatomySection('Left Leg', player.anatomy.parts.leftLeg) + '</div>';
        html += '<div>' + this.renderAnatomySection('Right Leg', player.anatomy.parts.rightLeg) + '</div>';
        html += '</div>';
        html += '</div>';
        
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Derived Stats</h4>';
        html += `<div class="stat-line"><span class="stat-label">Vision Range:</span> <span class="stat-value">${player.anatomy.getVisionRange()}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Hearing Range:</span> <span class="stat-value">${player.anatomy.getHearingRange()}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Can Use Hands:</span> <span class="stat-value">${player.anatomy.canUseHands() ? 'Yes' : 'No'}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Movement Penalty:</span> <span class="stat-value">${player.anatomy.getMovementPenalty()}</span></div>`;
        html += '</div>';
        
        // Combat Stances reference
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 12px;">Combat Stances <span style="font-size: 13px; color: #888;">[T] to cycle</span></h4>';
        const stanceDescriptions = {
            aggressive: {
                desc: 'All-in. Hit hard, get hit hard.',
                details: [
                    { label: 'Damage Dealt', value: '+25%', color: '#44ff44' },
                    { label: 'Hit Chance', value: '+5%', color: '#44ff44' },
                    { label: 'Crit Chance', value: '+3%', color: '#44ff44' },
                    { label: 'Bleed Chance', value: '+30%', color: '#44ff44' },
                    { label: 'Damage Taken', value: '+20%', color: '#ff4444' },
                    { label: 'Arm Guard', value: 'Reduced', color: '#ff4444' }
                ]
            },
            defensive: {
                desc: 'Guard up. Survive and retreat.',
                details: [
                    { label: 'Damage Taken', value: '-30%', color: '#44ff44' },
                    { label: 'Arm Guard', value: '1.5x', color: '#44ff44' },
                    { label: 'Safe Disengage', value: 'Yes', color: '#44ff44' },
                    { label: 'Damage Dealt', value: '-30%', color: '#ff4444' },
                    { label: 'Hit Chance', value: '-5%', color: '#ff4444' },
                    { label: 'Crit Chance', value: '-2%', color: '#ff4444' }
                ]
            },
            opportunistic: {
                desc: 'Exploit weakness. Finish them off.',
                details: [
                    { label: 'Crit on Wounded', value: '+10%', color: '#44ff44' },
                    { label: 'Damage Dealt', value: 'Normal', color: '#888888' },
                    { label: 'Damage Taken', value: 'Normal', color: '#888888' },
                    { label: 'Arm Guard', value: 'Normal', color: '#888888' }
                ]
            }
        };
        for (const [key, stanceData] of Object.entries(player.combatStances)) {
            const isActive = player.combatStance === key;
            const borderColor = isActive ? stanceData.color : '#333';
            const bgColor = isActive ? '#1a1a2a' : '#0a0a0a';
            const activeTag = isActive ? ' <span style="color: #fff; font-size: 11px; background: ' + stanceData.color + '; padding: 1px 6px; border-radius: 3px;">ACTIVE</span>' : '';
            
            html += `<div style="margin-bottom: 8px; padding: 10px; background: ${bgColor}; border-left: 3px solid ${borderColor};">`;
            html += `<div style="color: ${stanceData.color}; font-weight: bold; margin-bottom: 4px;">${stanceData.name}${activeTag}</div>`;
            
            const sd = stanceDescriptions[key];
            html += `<div style="font-size: 12px; color: #aaa; font-style: italic; margin-bottom: 6px;">${sd.desc}</div>`;
            
            for (const detail of sd.details) {
                html += `<div style="font-size: 12px; margin-bottom: 2px;"><span style="color: #888;">${detail.label}:</span> <span style="color: ${detail.color};">${detail.value}</span></div>`;
            }
            html += '</div>';
        }
        html += '</div>';
        
        if (player.cybernetics.length > 0) {
            html += '<div style="margin-bottom: 20px;">';
            html += '<h4 style="color: #ff00ff; margin-bottom: 8px;">Cybernetics</h4>';
            for (const cyber of player.cybernetics) {
                html += `<div style="color: #ff00ff; margin-bottom: 5px;">${cyber.name}</div>`;
            }
            html += '</div>';
        }
        
        content.innerHTML = html;
    }
    
    renderAnatomySection(title, parts) {
        let html = `<div style="margin-bottom: 10px; padding: 10px; background: #0a0a0a; border-left: 3px solid #00ffff;">`;
        html += `<div style="color: #00ffff; font-weight: bold; margin-bottom: 8px; font-size: 16px;">${title}</div>`;
        
        for (const [key, value] of Object.entries(parts)) {
            if (Array.isArray(value)) {
                for (const part of value) {
                    html += this.renderAnatomyPart(part);
                }
            } else {
                html += this.renderAnatomyPart(value);
            }
        }
        
        html += '</div>';
        return html;
    }
    
    renderAnatomyPart(part) {
        const { status, color } = Anatomy.getPartStatus(part);
        const cyberTag = part.cybernetic ? ' [CYBER]' : '';
        return `<div style="color: ${color}; font-size: 14px; margin-bottom: 4px; line-height: 1.4;">${part.name}${cyberTag}: ${status} (${part.hp}/${part.maxHP})</div>`;
    }
    
    // ── Combat Overlay Methods ────────────────────────────────────────
    
    toggleCombatOverlay() {
        if (!this.combatOverlay) return;
        this.combatOverlayVisible = !this.combatOverlayVisible;
        if (this.combatOverlayVisible) {
            this.combatOverlay.classList.remove('hidden');
            this.updateCombatOverlay();
        } else {
            this.combatOverlay.classList.add('hidden');
        }
    }
    
    showCombatOverlay(forceShow = false) {
        if (!this.combatOverlay) return;
        // On mobile, don't auto-show — only open via BATTLE button (forceShow)
        if (!forceShow && window.innerWidth <= 768) return;
        if (!this.combatOverlayVisible) {
            this.combatOverlayVisible = true;
            this.combatOverlay.classList.remove('hidden');
        }
        this.updateCombatOverlay();
    }
    
    hideCombatOverlay() {
        if (!this.combatOverlay) return;
        this.combatOverlayVisible = false;
        this.combatOverlay.classList.add('hidden');
    }
    
    updateCombatOverlay() {
        if (!this.combatOverlayVisible || !this.combatOverlay) return;
        if (!this.game.player || !this.game.combatSystem) return;
        
        this.renderCombatPlayerPanel();
        this.renderCombatEnemyPanel();
        this.renderCombatFeed();
    }
    
    renderCombatPlayerPanel() {
        if (!this.combatPlayerPanel) return;
        const player = this.game.player;
        const stance = player.getStance();
        const weapon = player.equipmentSystem ? player.equipmentSystem.getActiveWeapon() : null;
        
        let html = '';
        html += `<div class="combat-entity-name" style="color: #00ffff;">YOU</div>`;
        
        // Stance
        html += `<div style="color: ${stance.color}; font-size: 11px; margin-bottom: 4px;">${stance.name} Stance</div>`;
        
        // Weapon
        const weaponName = weapon ? weapon.name : 'Bare Fists';
        const weaponType = weapon ? (weapon.weaponStats?.attackType || 'blunt') : 'unarmed';
        html += `<div style="font-size: 11px; margin-bottom: 6px;"><span style="color: #888;">Weapon:</span> <span style="color: #fff;">${weaponName}</span> <span style="color: #666;">(${weaponType})</span></div>`;
        
        // Blood
        if (player.anatomy) {
            const bloodStatus = player.anatomy.getBloodStatus();
            html += `<div style="font-size: 11px; margin-bottom: 2px;"><span style="color: #888;">Blood:</span> <span style="color: ${bloodStatus.color};">${Math.floor(player.anatomy.blood)}%</span></div>`;
            
            // Damaged parts only
            const damagedParts = this.getCombatDamagedParts(player.anatomy);
            if (damagedParts.length > 0) {
                html += `<div class="combat-section-label">Injuries</div>`;
                for (const dp of damagedParts) {
                    html += `<div class="combat-part-status" style="color: ${dp.color};">${dp.name}: ${dp.status} (${dp.hp}/${dp.maxHP})</div>`;
                }
            }
            
            // Active wounds
            if (player.anatomy.wounds.length > 0) {
                html += `<div class="combat-section-label">Wounds</div>`;
                for (const wound of player.anatomy.wounds) {
                    const wColor = this.getWoundColor(wound.type);
                    html += `<div class="combat-wound-line" style="color: ${wColor};">${wound.part} — ${wound.type} (${wound.severity.toFixed(1)}/turn)</div>`;
                }
            }
            
            // Status effects
            const effects = [];
            if (player.anatomy.inShock) effects.push({ label: 'SHOCK', color: '#ff00ff' });
            if (player.anatomy.suffocating) effects.push({ label: 'SUFFOCATING', color: '#8800ff' });
            const bloodPct = player.anatomy.getBloodPercent();
            if (bloodPct <= 40) effects.push({ label: 'Woozy', color: '#ffaa00' });
            if (bloodPct <= 20) effects.push({ label: 'Critical Blood Loss', color: '#ff4444' });
            
            if (effects.length > 0) {
                html += `<div class="combat-section-label">Status</div>`;
                for (const eff of effects) {
                    html += `<div style="font-size: 11px; color: ${eff.color}; font-weight: bold;">${eff.label}</div>`;
                }
            }
            
            // Injury combat modifiers
            const combatPenalties = player.anatomy.getCombatPenalties();
            if (combatPenalties.details.length > 0) {
                html += `<div class="combat-section-label">Combat Modifiers</div>`;
                html += this.renderCombatPenaltySummary(combatPenalties);
            }
        }
        
        this.combatPlayerPanel.innerHTML = html;
    }
    
    renderCombatEnemyPanel() {
        if (!this.combatEnemyPanel) return;
        const enemies = this.game.combatSystem.getEngagedEnemies();
        
        if (enemies.length === 0) {
            this.combatEnemyPanel.innerHTML = '<div style="color: #666; font-style: italic;">No enemies engaged</div>';
            return;
        }
        
        let html = '';
        for (let i = 0; i < Math.min(enemies.length, 3); i++) {
            const enemy = enemies[i];
            if (i > 0) html += '<div style="border-top: 1px solid #333; margin: 8px 0;"></div>';
            
            html += `<div class="combat-entity-name" style="color: ${enemy.color || '#ff4444'};">${enemy.name}</div>`;
            
            // Weapon
            const wName = enemy.weapon ? enemy.weapon.name : 'Bare Fists';
            html += `<div style="font-size: 11px; margin-bottom: 6px;"><span style="color: #888;">Weapon:</span> <span style="color: #fff;">${wName}</span></div>`;
            
            if (enemy.anatomy) {
                // Blood
                const bloodStatus = enemy.anatomy.getBloodStatus();
                html += `<div style="font-size: 11px; margin-bottom: 2px;"><span style="color: #888;">Blood:</span> <span style="color: ${bloodStatus.color};">${Math.floor(enemy.anatomy.blood)}%</span></div>`;
                
                // Overall condition
                const cond = enemy.anatomy.getBodyCondition();
                html += `<div style="font-size: 11px; margin-bottom: 4px;"><span style="color: #888;">Condition:</span> <span style="color: ${cond.color}; font-weight: bold;">${cond.label}</span></div>`;
                
                // Damaged parts only
                const damagedParts = this.getCombatDamagedParts(enemy.anatomy);
                if (damagedParts.length > 0) {
                    html += `<div class="combat-section-label">Injuries</div>`;
                    for (const dp of damagedParts) {
                        html += `<div class="combat-part-status" style="color: ${dp.color};">${dp.name}: ${dp.status} (${dp.hp}/${dp.maxHP})</div>`;
                    }
                }
                
                // Active wounds
                if (enemy.anatomy.wounds.length > 0) {
                    html += `<div class="combat-section-label">Wounds</div>`;
                    for (const wound of enemy.anatomy.wounds) {
                        const wColor = this.getWoundColor(wound.type);
                        html += `<div class="combat-wound-line" style="color: ${wColor};">${wound.part} — ${wound.type} (${wound.severity.toFixed(1)}/turn)</div>`;
                    }
                }
                
                // Status effects
                const effects = [];
                if (enemy.anatomy.inShock) effects.push({ label: 'SHOCK', color: '#ff00ff' });
                if (enemy.anatomy.suffocating) effects.push({ label: 'SUFFOCATING', color: '#8800ff' });
                const bloodPct = enemy.anatomy.getBloodPercent();
                if (bloodPct <= 40) effects.push({ label: 'Woozy', color: '#ffaa00' });
                if (bloodPct <= 20) effects.push({ label: 'Critical Blood Loss', color: '#ff4444' });
                
                if (effects.length > 0) {
                    html += `<div class="combat-section-label">Status</div>`;
                    for (const eff of effects) {
                        html += `<div style="font-size: 11px; color: ${eff.color}; font-weight: bold;">${eff.label}</div>`;
                    }
                }
                
                // Injury combat modifiers
                const combatPenalties = enemy.anatomy.getCombatPenalties();
                if (combatPenalties.details.length > 0) {
                    html += `<div class="combat-section-label">Combat Modifiers</div>`;
                    html += this.renderCombatPenaltySummary(combatPenalties);
                }
            }
        }
        
        this.combatEnemyPanel.innerHTML = html;
    }
    
    renderCombatFeed() {
        if (!this.combatFeedPanel) return;
        const events = this.game.combatSystem.combatEvents;
        
        if (events.length === 0) {
            this.combatFeedPanel.innerHTML = '<div style="color: #666; font-style: italic;">No combat yet</div>';
            return;
        }
        
        let html = '<div class="combat-section-label">Combat Log</div>';
        
        // Show most recent events first (last 10)
        const recent = events.slice(-10).reverse();
        for (const evt of recent) {
            if (evt.type === 'miss') {
                html += `<div class="combat-feed-entry miss">`;
                html += `<span style="color: #888;">[${evt.turn}]</span> `;
                html += `<span style="color: #aaa;">${evt.attackerName}</span> swings at <span style="color: #aaa;">${evt.targetName}</span> with <span style="color: #ccc;">${evt.weaponName}</span> — <span style="color: #666;">MISS</span>`;
                if (evt.hitChance !== undefined) {
                    html += ` <span style="color: #555; font-size: 10px;">(${evt.hitChance}% chance)</span>`;
                }
                // Show attacker injury penalties on miss
                if (evt.attackerPenalties) {
                    html += this.renderCombatPenaltyInline(evt.attackerPenalties);
                }
                html += `</div>`;
            } else if (evt.type === 'hit') {
                const entryClass = evt.killed ? 'kill' : (evt.critical ? 'crit' : 'hit');
                html += `<div class="combat-feed-entry ${entryClass}">`;
                html += `<span style="color: #888;">[${evt.turn}]</span> `;
                
                // Main hit line
                if (evt.critical) {
                    html += `<span style="color: #ffff00; font-weight: bold;">CRIT!</span> `;
                }
                html += `<span style="color: #aaa;">${evt.attackerName}</span> hits <span style="color: #aaa;">${evt.targetName}</span>'s <span style="color: #fff;">${evt.bodyPart}</span> with <span style="color: #ccc;">${evt.weaponName}</span>`;
                html += ` — <span style="color: #ff4444; font-weight: bold;">${evt.damage} damage</span>`;
                if (evt.hitChance !== undefined) {
                    html += ` <span style="color: #555; font-size: 10px;">(${evt.hitChance}% hit)</span>`;
                }
                
                // Attacker injury penalties inline
                if (evt.attackerPenalties) {
                    html += this.renderCombatPenaltyInline(evt.attackerPenalties);
                }
                
                // Armor
                if (evt.blocked > 0) {
                    html += `<br><span style="color: #888; margin-left: 10px;">${evt.armorName} absorbs ${evt.blocked} damage</span>`;
                }
                
                // Wounds inflicted
                if (evt.woundsInflicted && evt.woundsInflicted.length > 0) {
                    for (const w of evt.woundsInflicted) {
                        const wColor = this.getWoundColor(w.type);
                        html += `<br><span style="color: ${wColor}; margin-left: 10px;">Inflicts ${w.type} on ${w.part} (${w.severity.toFixed(1)}/turn bleed)</span>`;
                    }
                }
                
                // Part destroyed
                if (evt.partDestroyed) {
                    html += `<br><span style="color: #ff8800; font-weight: bold; margin-left: 10px;">${evt.bodyPart} DESTROYED</span>`;
                }
                
                // Kill
                if (evt.killed) {
                    html += `<br><span style="color: #ff0000; font-weight: bold; margin-left: 10px;">${evt.targetName} KILLED</span>`;
                }
                
                html += `</div>`;
            } else if (evt.type === 'ability_miss') {
                html += `<div class="combat-feed-entry miss">`;
                html += `<span style="color: #888;">[${evt.turn}]</span> `;
                html += `<span style="color: #cc88ff; font-weight: bold;">[${evt.abilityName}]</span> `;
                html += `<span style="color: #aaa;">${evt.attackerName}</span> attempts <span style="color: #cc88ff;">${evt.abilityName}</span> — <span style="color: #666;">MISS</span>`;
                if (evt.hitChance !== undefined) {
                    html += ` <span style="color: #555; font-size: 10px;">(${evt.hitChance}% chance)</span>`;
                }
                if (!evt.inPreferredStance) {
                    html += ` <span style="color: #ffaa00; font-size: 10px;">⚠ wrong stance</span>`;
                }
                html += `</div>`;
            } else if (evt.type === 'ability_hit') {
                const entryClass = evt.killed ? 'kill' : (evt.critical ? 'crit' : 'hit');
                html += `<div class="combat-feed-entry ${entryClass}">`;
                html += `<span style="color: #888;">[${evt.turn}]</span> `;
                html += `<span style="color: #cc88ff; font-weight: bold;">[${evt.abilityName}]</span> `;
                
                if (evt.critical) {
                    html += `<span style="color: #ffff00; font-weight: bold;">CRIT!</span> `;
                }
                
                // Body parts hit
                if (evt.bodyParts && evt.bodyParts.length > 0) {
                    const partNames = evt.bodyParts.map(p => p.name).join(', ');
                    html += `<span style="color: #aaa;">${evt.attackerName}</span> hits <span style="color: #aaa;">${evt.targetName}</span>'s <span style="color: #fff;">${partNames}</span>`;
                } else {
                    html += `<span style="color: #aaa;">${evt.attackerName}</span> hits <span style="color: #aaa;">${evt.targetName}</span>`;
                }
                html += ` — <span style="color: #ff4444; font-weight: bold;">${evt.damage} damage</span>`;
                
                if (!evt.inPreferredStance) {
                    html += ` <span style="color: #ffaa00; font-size: 10px;">⚠ wrong stance</span>`;
                }
                
                // Armor on each body part
                if (evt.bodyParts) {
                    for (const bp of evt.bodyParts) {
                        if (bp.blocked > 0) {
                            html += `<br><span style="color: #888; margin-left: 10px;">${bp.armorName} absorbs ${bp.blocked} on ${bp.name}</span>`;
                        }
                    }
                }
                
                // Wounds
                if (evt.woundsInflicted && evt.woundsInflicted.length > 0) {
                    for (const w of evt.woundsInflicted) {
                        const wColor = this.getWoundColor(w.type);
                        html += `<br><span style="color: ${wColor}; margin-left: 10px;">Inflicts ${w.type} on ${w.part} (${w.severity.toFixed(1)}/turn bleed)</span>`;
                    }
                }
                
                // Special effects
                if (evt.specialEffects) {
                    for (const eff of evt.specialEffects) {
                        if (eff.type === 'stun') {
                            html += `<br><span style="color: #ffff00; margin-left: 10px; font-weight: bold;">⚡ STUNNED for ${eff.turns} turn(s)</span>`;
                        }
                        if (eff.type === 'guard_break') {
                            html += `<br><span style="color: #ff8800; margin-left: 10px; font-weight: bold;">🛡 Guard broken for ${eff.turns} turn(s)</span>`;
                        }
                        if (eff.type === 'disarm' || eff.type === 'weapon_dropped') {
                            html += `<br><span style="color: #ff4400; margin-left: 10px; font-weight: bold;">⚔ DISARMED${eff.weaponName ? ` — ${eff.weaponName} dropped` : ''}</span>`;
                        }
                        if (eff.type === 'grapple') {
                            html += `<br><span style="color: #cc88ff; margin-left: 10px; font-weight: bold;">🤼 Grappling for ${eff.turns} turn(s)</span>`;
                        }
                        if (eff.type === 'knock_prone') {
                            html += `<br><span style="color: #ff8844; margin-left: 10px;">Knocked ${eff.target === 'self' ? 'self' : 'target'} prone</span>`;
                        }
                        if (eff.type === 'part_destroyed') {
                            html += `<br><span style="color: #ff8800; font-weight: bold; margin-left: 10px;">${eff.part} DESTROYED</span>`;
                        }
                        if (eff.type === 'self_damage') {
                            html += `<br><span style="color: #ff8844; margin-left: 10px;">Self-damage: ${eff.damage} to ${eff.part}</span>`;
                        }
                        if (eff.type === 'arterial_bleed') {
                            html += `<br><span style="color: #ff0000; margin-left: 10px; font-weight: bold;">🩸 ARTERIAL BLEEDING</span>`;
                        }
                    }
                }
                
                // Kill
                if (evt.killed) {
                    html += `<br><span style="color: #ff0000; font-weight: bold; margin-left: 10px;">${evt.targetName} KILLED</span>`;
                }
                
                html += `</div>`;
            }
        }
        
        this.combatFeedPanel.innerHTML = html;
        // Auto-scroll to top (newest)
        this.combatFeedPanel.scrollTop = 0;
    }
    
    /**
     * Get color for a wound type — used across combat overlay and feed.
     */
    getWoundColor(woundType) {
        switch (woundType) {
            case 'arterial': return '#ff0000';
            case 'internal': return '#cc2222';
            case 'puncture': return '#ff4422';
            case 'laceration': return '#ff6644';
            case 'cut': return '#ff8844';
            default: return '#ff6644';
        }
    }
    
    /**
     * Get only damaged body parts from an anatomy for compact combat display.
     * Returns array of { name, hp, maxHP, status, color }.
     */
    getCombatDamagedParts(anatomy) {
        const damaged = [];
        anatomy.forEachPart((part) => {
            if (part.hp < part.maxHP) {
                const { status, color } = Anatomy.getPartStatus(part);
                damaged.push({ name: part.name, hp: part.hp, maxHP: part.maxHP, status, color });
            }
        });
        return damaged;
    }
    
    /**
     * Render a compact combat penalty summary for the overlay panels.
     * Shows each injury source and its effects, plus a totals line.
     */
    renderCombatPenaltySummary(penalties) {
        let html = '';
        for (const detail of penalties.details) {
            let parts = [];
            if (detail.hitMod) parts.push(`Hit ${detail.hitMod > 0 ? '+' : ''}${detail.hitMod}%`);
            if (detail.critMod) parts.push(`Crit ${detail.critMod > 0 ? '+' : ''}${detail.critMod}%`);
            if (detail.damageMod) parts.push(`Dmg ${detail.damageMod > 0 ? '+' : ''}${detail.damageMod}%`);
            if (detail.dodgePenalty) parts.push(`Dodge ${-detail.dodgePenalty}%`);
            html += `<div style="font-size: 10px; color: ${detail.color}; margin-bottom: 1px;">⚠ ${detail.label}: ${parts.join(', ')}</div>`;
        }
        // Totals line
        const totalHit = penalties.hitChanceMod;
        const totalCrit = penalties.critChanceMod;
        const totalDmg = Math.round((penalties.damageMod - 1) * 100);
        const totalDodge = penalties.dodgeMod;
        let totals = [];
        if (totalHit !== 0) totals.push(`Hit ${totalHit > 0 ? '+' : ''}${totalHit}%`);
        if (totalCrit !== 0) totals.push(`Crit ${totalCrit > 0 ? '+' : ''}${totalCrit}%`);
        if (totalDmg !== 0) totals.push(`Dmg ${totalDmg > 0 ? '+' : ''}${totalDmg}%`);
        if (totalDodge !== 0) totals.push(`Dodge ${-totalDodge}%`);
        if (totals.length > 0) {
            html += `<div style="font-size: 10px; color: #ff6666; margin-top: 2px; border-top: 1px solid #333; padding-top: 2px; font-weight: bold;">Total: ${totals.join(', ')}</div>`;
        }
        return html;
    }
    
    /**
     * Render a compact inline penalty note for combat feed entries.
     * Returns a short string like "(-15% hit, -30% dmg from injuries)"
     */
    renderCombatPenaltyInline(penalties) {
        if (!penalties || penalties.details.length === 0) return '';
        let parts = [];
        if (penalties.hitChanceMod !== 0) parts.push(`${penalties.hitChanceMod > 0 ? '+' : ''}${penalties.hitChanceMod}% hit`);
        if (penalties.critChanceMod !== 0) parts.push(`${penalties.critChanceMod > 0 ? '+' : ''}${penalties.critChanceMod}% crit`);
        const dmgPct = Math.round((penalties.damageMod - 1) * 100);
        if (dmgPct !== 0) parts.push(`${dmgPct > 0 ? '+' : ''}${dmgPct}% dmg`);
        if (parts.length === 0) return '';
        return `<span style="color: #ff8844; font-size: 10px;"> [injuries: ${parts.join(', ')}]</span>`;
    }
    
    toggleInventoryScreen() {
        if (!this.detailedInventoryModal) return;
        
        if (this.detailedInventoryModal.classList.contains('hidden')) {
            // Check if player is standing on a staircase or manhole
            const tile = this.game.world.getTile(this.game.player.x, this.game.player.y, this.game.player.z);
            if (tile.isStaircase) {
                this.showStaircaseInspection(tile);
            } else if (tile.isManhole) {
                this.showManholeInspection(tile);
            } else if (tile.isLadder) {
                this.showLadderInspection(tile);
            } else {
                this.showDetailedInventory();
            }
            this.detailedInventoryModal.classList.remove('hidden');
        } else {
            this.detailedInventoryModal.classList.add('hidden');
        }
    }
    
    showDetailedInventory(activeTab = 'inventory', inspectingItem = null) {
        if (!this.game.player) return;
        
        const player = this.game.player;
        const content = document.getElementById('detailed-inventory-content');
        const containerSys = player.containerSystem;
        
        let html = '';
        
        // Side-by-side layout: Inventory on left, Ground on right
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">';
        
        // Left column: Inventory
        html += '<div style="border-right: 2px solid #333; padding-right: 15px;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 15px; font-size: 20px;">Inventory</h3>';
        html += this.renderInventoryTab(player, containerSys);
        html += '</div>';
        
        // Right column: Ground
        html += '<div style="padding-left: 15px;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 15px; font-size: 20px;">Ground</h3>';
        html += this.renderGroundTab(player, containerSys);
        html += '</div>';
        
        html += '</div>';
        
        content.innerHTML = html;
        
        this.attachInventoryEventListeners();
    }
    
    renderInventoryTab(player, containerSys) {
        let html = '';
        
        // Encumbrance display
        const currentWeight = player.getCurrentCarryWeight();
        const maxWeight = player.maxWeight;
        const encumbrance = player.getEncumbranceLevel();
        const encumbranceColors = {
            light: '#00ff00',
            medium: '#ffaa00',
            heavy: '#ff8800',
            overencumbered: '#ff4444'
        };
        
        html += '<div style="margin-bottom: 20px; padding: 10px; background: #1a1a1a; border: 2px solid ' + encumbranceColors[encumbrance] + ';">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Carry Weight</h4>';
        html += `<div style="font-size: 14px;"><span style="color: ${encumbranceColors[encumbrance]}; font-weight: bold;">${containerSys.formatWeight(currentWeight)}</span> / ${containerSys.formatWeight(maxWeight)}</div>`;
        html += `<div style="font-size: 15px; color: ${encumbranceColors[encumbrance]}; margin-top: 5px;">Status: ${encumbrance.toUpperCase()}</div>`;
        if (encumbrance !== 'light') {
            const penalty = player.getEncumbrancePenalty();
            html += `<div style="font-size: 15px; color: #ff8800; margin-top: 3px;">Movement penalty: +${penalty}% action cost</div>`;
        }
        html += '</div>';
        
        // Equipment section
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Equipment</h4>';
        
        const slots = [
            { key: 'head', label: 'Head' },
            { key: 'torso', label: 'Torso' },
            { key: 'legs', label: 'Legs' },
            { key: 'back', label: 'Back' },
            { key: 'leftHand', label: 'Left Hand' },
            { key: 'rightHand', label: 'Right Hand' }
        ];
        
        for (const slot of slots) {
            const item = player.equipment[slot.key];
            
            // Skip right hand if it's the same item as left hand (2H grip)
            if (slot.key === 'rightHand' && item && player.equipment.leftHand === item) {
                continue;
            }
            
            html += `<div style="margin-bottom: 8px; padding: 8px; background: #1a1a1a; border: 1px solid #333;">`;
            html += `<div style="margin-bottom: 5px;"><span class="stat-label">${slot.label}:</span> `;
            if (item) {
                html += `<span class="stat-value" style="color: ${item.color};">${item.name}</span>`;
                const weight = containerSys.formatWeight(containerSys.getItemWeight(item));
                html += ` <span style="color: #aaa; font-size: 14px;">(${weight})</span>`;
                
                // Show 2H indicator
                if (item.twoHandGrip || (slot.key === 'leftHand' && player.equipment.rightHand === item)) {
                    html += ` <span style="color: #ffaa00; font-size: 14px;">[2H]</span>`;
                }
                
                if (item.isContainer && item.pockets) {
                    html += ` <span style="color: #ffaa00; font-size: 14px;">[${item.pockets.length} pockets]</span>`;
                }
                
                // Show on/off status for light-emitting items
                if (item.lightRadius) {
                    const isOn = !item.state || item.state.active !== false;
                    const statusColor = isOn ? '#44ff44' : '#ff4444';
                    const statusText = isOn ? 'ON' : 'OFF';
                    html += ` <span style="color: ${statusColor}; font-size: 14px; font-weight: bold;">[${statusText}]</span>`;
                }
                
                html += `</div>`;
                
                // Weapon stats inline for equipped items
                if (item.weaponStats && item.weaponStats.damage) {
                    html += `<div style="font-size: 11px; color: #ff6666; margin-top: 2px;">⚔ ${item.weaponStats.damage} ${item.weaponStats.attackType || 'blunt'}`;
                    if (item.weaponStats.bleedChance) html += ` | bleed ${Math.round(item.weaponStats.bleedChance * 100)}%`;
                    if (item.weaponStats.stunChance) html += ` | stun ${Math.round(item.weaponStats.stunChance * 100)}%`;
                    html += `</div>`;
                }
                html += `<div style="margin-top: 5px; display: flex; gap: 5px;">`;
                html += `<button class="small-btn" data-action="actions-equipped" data-slot="${slot.key}">Actions</button>`;
                
                // Toggle button for light-emitting items
                if (item.lightRadius) {
                    const isOn = !item.state || item.state.active !== false;
                    const toggleLabel = isOn ? 'Turn Off' : 'Turn On';
                    const toggleColor = isOn ? '#ff4444' : '#44ff44';
                    html += `<button class="small-btn" data-action="toggle-light" data-slot="${slot.key}" style="background: ${toggleColor}; color: #000;">${toggleLabel}</button>`;
                }
                html += `</div>`;
                
                // Show contents for light-source containers (batteries, fuel)
                if (item.isContainer && item.contents && item.contents.length > 0 && item.lightRadius) {
                    html += `<div style="margin-top: 8px; padding: 6px; background: #0a0a0a; border-left: 2px solid ${item.color};">`;
                    for (let ci = 0; ci < item.contents.length; ci++) {
                        const contentItem = item.contents[ci];
                        html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">`;
                        html += `<span style="font-size: 13px; color: ${contentItem.color};">• ${contentItem.name}`;
                        if (contentItem.quantity) html += ` (${Math.floor(contentItem.quantity)}${contentItem.quantityUnit || ''})`;
                        if (contentItem.tags && contentItem.tags.includes('power') && contentItem.durability !== undefined) {
                            html += ` [Charge: ${Math.floor(contentItem.durability)}%]`;
                        } else if (contentItem.durability !== undefined) {
                            html += ` [${Math.floor(contentItem.durability)}%]`;
                        }
                        html += `</span>`;
                        html += `<button class="small-btn" data-action="actions-container-item" data-container-id="${item.id}" data-item-index="${ci}" style="font-size: 11px; padding: 2px 6px;">Actions</button>`;
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
            } else {
                html += `<span class="stat-value" style="color: #666;">Empty</span></div>`;
            }
            html += `</div>`;
        }
        html += '</div>';
        
        // Carried items section
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #ffaa00; margin-bottom: 8px;">Carrying</h4>';
        
        // Initialize carrying if it doesn't exist (for old save games)
        if (!player.carrying) {
            player.carrying = { leftHand: null, rightHand: null };
        }
        
        console.log('Player carrying:', player.carrying);
        const leftCarried = player.carrying.leftHand;
        const rightCarried = player.carrying.rightHand;
        console.log('Left carried:', leftCarried, 'Right carried:', rightCarried);
        
        if (!leftCarried && !rightCarried) {
            html += '<div style="color: #666;">Hands are free</div>';
        } else {
            if (leftCarried && leftCarried === rightCarried) {
                // Two-handed carry
                const itemWeight = containerSys.getItemWeight(leftCarried);
                html += `<div style="padding: 8px; background: #1a1a1a; border: 1px solid #333; border-left: 3px solid #ffaa00; margin-bottom: 5px;">`;
                html += `<div style="color: ${leftCarried.color}; font-weight: bold;">${leftCarried.name}</div>`;
                html += `<div style="font-size: 14px; color: #ffaa00;">🤲 Both Hands | ${containerSys.formatWeight(itemWeight)}</div>`;
                html += `<div style="margin-top: 5px; display: flex; gap: 5px;">`;
                html += `<button class="small-btn" data-action="actions-carried" data-hand="both">Actions</button>`;
                html += `</div>`;
                html += `</div>`;
            } else {
                if (leftCarried) {
                    const itemWeight = containerSys.getItemWeight(leftCarried);
                    html += `<div style="padding: 8px; background: #1a1a1a; border: 1px solid #333; border-left: 3px solid #ffaa00; margin-bottom: 5px;">`;
                    html += `<div style="color: ${leftCarried.color}; font-weight: bold;">${leftCarried.name}</div>`;
                    html += `<div style="font-size: 14px; color: #ffaa00;">👈 Left Hand | ${containerSys.formatWeight(itemWeight)}</div>`;
                    html += `<div style="margin-top: 5px; display: flex; gap: 5px;">`;
                    html += `<button class="small-btn" data-action="actions-carried" data-hand="left">Actions</button>`;
                    html += `</div>`;
                    html += `</div>`;
                }
                if (rightCarried) {
                    const itemWeight = containerSys.getItemWeight(rightCarried);
                    html += `<div style="padding: 8px; background: #1a1a1a; border: 1px solid #333; border-left: 3px solid #ffaa00; margin-bottom: 5px;">`;
                    html += `<div style="color: ${rightCarried.color}; font-weight: bold;">${rightCarried.name}</div>`;
                    html += `<div style="font-size: 14px; color: #ffaa00;">👉 Right Hand | ${containerSys.formatWeight(itemWeight)}</div>`;
                    html += `<div style="margin-top: 5px; display: flex; gap: 5px;">`;
                    html += `<button class="small-btn" data-action="actions-carried" data-hand="right">Actions</button>`;
                    html += `</div>`;
                    html += `</div>`;
                }
            }
        }
        html += '</div>';
        
        // Inventory section - show all stored items with locations
        html += '<div style="margin-bottom: 20px;">';
        html += `<h4 style="color: #00ffff; margin-bottom: 8px;">Stored Items</h4>`;
        
        const storedItems = containerSys.getAllStoredItems(player);
        
        if (storedItems.length === 0) {
            html += '<div style="color: #666;">No items stored. You need pockets or containers to carry items!</div>';
        } else {
            for (let i = 0; i < storedItems.length; i++) {
                const stored = storedItems[i];
                const item = stored.item;
                
                const itemWeight = containerSys.getItemWeight(item);
                const itemVolume = containerSys.getItemVolume(item);
                
                html += `<div class="inventory-item" data-stored-index="${i}" style="margin-bottom: 10px; padding: 8px; background: #1a1a1a; border: 1px solid #333; border-left: 3px solid #00ffff;">`;
                html += `<div style="color: ${item.color}; font-weight: bold; margin-bottom: 3px;">${item.name}</div>`;
                html += `<div style="font-size: 10px; color: #00ffff; margin-bottom: 5px;">📍 ${stored.location}</div>`;
                html += `<div style="font-size: 11px; color: #888;">Type: ${item.type} | ${containerSys.formatWeight(itemWeight)} | ${containerSys.formatVolume(itemVolume)}</div>`;
                
                if (item.material) {
                    html += `<div style="font-size: 10px; color: #888;">Material: ${this.game.content.materials[item.material].name}</div>`;
                }
                
                if (item.durability !== undefined) {
                    const durLabel = item.tags && item.tags.includes('power') ? 'Charge' : 'Durability';
                    html += `<div style="font-size: 10px; color: #888;">${durLabel}: ${Math.floor(item.durability)}%</div>`;
                }
                
                // Inline weapon stats
                if (item.weaponStats && item.weaponStats.damage) {
                    html += `<div style="font-size: 10px; color: #ff6666;">⚔ ${item.weaponStats.damage} ${item.weaponStats.attackType || 'blunt'}`;
                    if (item.weaponStats.bleedChance) html += ` | bleed ${Math.round(item.weaponStats.bleedChance * 100)}%`;
                    if (item.weaponStats.stunChance) html += ` | stun ${Math.round(item.weaponStats.stunChance * 100)}%`;
                    html += `</div>`;
                }
                
                html += `<div style="margin-top: 8px; display: flex; gap: 5px;">`;
                html += `<button class="small-btn" data-action="actions-stored" data-stored-index="${i}">Actions</button>`;
                html += `</div>`;
                
                // Display opened container contents inline (also show for light-source containers)
                const showContents = (item.state && item.state.opened && item.contents && item.contents.length > 0) ||
                                     (item.lightRadius && item.contents && item.contents.length > 0);
                if (showContents) {
                    html += `<div style="margin-top: 10px; padding: 8px; background: #0a0a0a; border-left: 2px solid #00ffff;">`;
                    html += `<div style="color: #00ffff; font-size: 12px; font-weight: bold; margin-bottom: 5px;">Contents:</div>`;
                    
                    for (let ci = 0; ci < item.contents.length; ci++) {
                        const contentItem = item.contents[ci];
                        html += `<div style="margin-top: 5px; padding: 5px; background: #000; border-left: 2px solid ${contentItem.color};">`;
                        html += `<div style="font-size: 14px; color: ${contentItem.color}; margin-bottom: 3px;">• ${contentItem.name}</div>`;
                        
                        if (contentItem.quantity) {
                            html += `<div style="font-size: 12px; color: #888; margin-bottom: 3px;">${contentItem.quantity}${contentItem.quantityUnit}</div>`;
                        }
                        
                        // Show freshness indicator for food items
                        if (contentItem.type === 'food' && contentItem.state && contentItem.state.contaminationLevel !== undefined) {
                            const freshness = 1 - (contentItem.state.contaminationLevel / 0.3);
                            let freshnessText = '';
                            let freshnessColor = '';
                            
                            if (freshness > 0.66) {
                                freshnessText = '✓ Fresh';
                                freshnessColor = '#44ff44';
                            } else if (freshness > 0.33) {
                                freshnessText = '⚠ Aging';
                                freshnessColor = '#ffaa00';
                            } else {
                                freshnessText = '⚠ Spoiling';
                                freshnessColor = '#ff8800';
                            }
                            
                            html += `<div style="font-size: 12px; color: ${freshnessColor}; margin-bottom: 3px;">${freshnessText}</div>`;
                        }
                        
                        if (contentItem.state && contentItem.state.contaminated) {
                            html += `<div style="font-size: 12px; color: #ff8800; margin-bottom: 3px;">⚠ Contaminated</div>`;
                        }
                        
                        html += `<button class="small-btn" data-action="actions-container-item" data-container-id="${item.id}" data-item-index="${ci}" style="margin-top: 3px;">Actions</button>`;
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
                
                html += `</div>`;
            }
        }
        html += '</div>';
        
        return html;
    }
    
    renderGroundTab(player, containerSys) {
        let html = '';
        
        const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
        
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Items on Ground</h4>';
        
        if (groundItems.length === 0) {
            html += '<div style="color: #666;">Nothing here.</div>';
        } else {
            for (let i = 0; i < groundItems.length; i++) {
                const item = groundItems[i];
                const itemWeight = containerSys.getItemWeight(item);
                const itemVolume = containerSys.getItemVolume(item);
                
                html += `<div class="inventory-item" data-ground-index="${i}" style="margin-bottom: 10px; padding: 8px; background: #1a1a1a; border: 1px solid #333;">`;
                html += `<div style="color: ${item.color}; font-weight: bold; margin-bottom: 3px;">${item.name}</div>`;
                html += `<div style="font-size: 15px; color: #aaa;">Type: ${item.type} | ${containerSys.formatWeight(itemWeight)} | ${containerSys.formatVolume(itemVolume)}</div>`;
                
                if (item.material) {
                    html += `<div style="font-size: 15px; color: #aaa;">Material: ${this.game.content.materials[item.material].name}</div>`;
                }
                
                if (item.durability !== undefined) {
                    const durLabel = item.tags && item.tags.includes('power') ? 'Charge' : 'Durability';
                    html += `<div style="font-size: 15px; color: #aaa;">${durLabel}: ${Math.floor(item.durability)}%</div>`;
                }
                
                html += `<div style="margin-top: 8px; display: flex; gap: 5px; flex-wrap: wrap;">`;
                html += `<button class="small-btn" data-action="actions-ground" data-ground-index="${i}">Actions</button>`;
                html += `</div>`;
                
                html += `</div>`;
            }
        }
        html += '</div>';
        
        return html;
    }
    
    renderInspectTab(player, containerSys, inspectingItem) {
        let html = '';
        
        if (!inspectingItem) {
            html += '<div style="color: #888; padding: 20px; text-align: center;">Select an item to inspect from Inventory or Ground tabs.</div>';
            return html;
        }
        
        const item = inspectingItem;
        const itemWeight = containerSys.getItemWeight(item);
        const itemVolume = containerSys.getItemVolume(item);
        
        html += '<div style="padding: 10px; background: #1a1a1a; border: 2px solid #00ffff;">';
        html += `<h3 style="color: ${item.color}; margin-bottom: 15px;">${item.name}</h3>`;
        
        html += '<div style="margin-bottom: 15px;">';
        html += `<div style="margin-bottom: 5px;"><span style="color: #888;">Type:</span> <span style="color: #fff;">${item.type}</span></div>`;
        html += `<div style="margin-bottom: 5px;"><span style="color: #888;">Weight:</span> <span style="color: #fff;">${containerSys.formatWeight(itemWeight)}</span></div>`;
        html += `<div style="margin-bottom: 5px;"><span style="color: #888;">Volume:</span> <span style="color: #fff;">${containerSys.formatVolume(itemVolume)}</span></div>`;
        
        if (item.material) {
            const material = this.game.content.materials[item.material];
            html += `<div style="margin-bottom: 5px;"><span style="color: #888;">Material:</span> <span style="color: ${material.color};">${material.name}</span></div>`;
        }
        
        if (item.durability !== undefined) {
            const durColor = item.durability > 75 ? '#00ff00' : item.durability > 50 ? '#ffaa00' : item.durability > 25 ? '#ff8800' : '#ff4444';
            const durLabel = item.tags && item.tags.includes('power') ? 'Charge' : 'Durability';
            html += `<div style="margin-bottom: 5px;"><span style="color: #888;">${durLabel}:</span> <span style="color: ${durColor};">${Math.floor(item.durability)}%</span></div>`;
        }
        
        // Weapon stats tooltip
        const ws = item.weaponStats;
        if (ws && ws.damage) {
            html += '<div style="margin-top: 10px; padding: 8px; background: #0a0a0a; border-left: 3px solid #ff4444;">';
            html += '<div style="color: #ff4444; font-weight: bold; margin-bottom: 6px;">⚔ Combat Stats</div>';
            html += `<div style="margin-bottom: 3px;"><span style="color: #888;">Damage:</span> <span style="color: #fff;">${ws.damage}</span></div>`;
            html += `<div style="margin-bottom: 3px;"><span style="color: #888;">Type:</span> <span style="color: #fff;">${ws.attackType || 'blunt'}</span></div>`;
            if (ws.bleedChance) html += `<div style="margin-bottom: 3px;"><span style="color: #888;">Bleed Chance:</span> <span style="color: #ff6666;">${Math.round(ws.bleedChance * 100)}%</span></div>`;
            if (ws.stunChance) html += `<div style="margin-bottom: 3px;"><span style="color: #888;">Stun Chance:</span> <span style="color: #ffaa00;">${Math.round(ws.stunChance * 100)}%</span></div>`;
            if (ws.canTwoHand) html += `<div style="margin-bottom: 3px;"><span style="color: #888;">Two-hand:</span> <span style="color: #00ffff;">${ws.twoHandDamage || 'Yes'}</span></div>`;
            if (ws.throwable) html += `<div style="margin-bottom: 3px;"><span style="color: #888;">Throwable:</span> <span style="color: #ffaa00;">Yes</span></div>`;
            
            // Targeting profile description
            const targetDesc = {
                blunt: 'Overhead swings target the head and torso. Arms often intercept blows.',
                sharp: 'Close-range stabs and slashes focus on the torso and arms.',
                unarmed: 'Wild punches aimed at the head and body. Poor reach.'
            };
            const desc = targetDesc[ws.attackType] || targetDesc.blunt;
            html += `<div style="margin-top: 6px; font-size: 12px; color: #aaa; font-style: italic;">${desc}</div>`;
            html += '</div>';
        }
        
        html += '</div>';
        
        if (item.isContainer) {
            html += '<div style="margin-top: 20px; padding: 10px; background: #0a0a0a; border: 1px solid #ffaa00;">';
            html += '<h4 style="color: #ffaa00; margin-bottom: 10px;">📦 Container Details</h4>';
            
            const contWeight = containerSys.getTotalWeight(item);
            const contVolume = containerSys.getTotalVolume(item);
            
            html += `<div style="margin-bottom: 5px;"><span style="color: #888;">Capacity:</span> <span style="color: #fff;">${containerSys.formatWeight(contWeight)} / ${containerSys.formatWeight(item.maxWeight)}</span></div>`;
            html += `<div style="margin-bottom: 5px;"><span style="color: #888;">Volume:</span> <span style="color: #fff;">${containerSys.formatVolume(contVolume)} / ${containerSys.formatVolume(item.maxVolume)}</span></div>`;
            
            if (item.pockets) {
                html += '<div style="margin-top: 15px;">';
                html += '<h5 style="color: #ffaa00; margin-bottom: 8px;">Pockets:</h5>';
                
                for (let p = 0; p < item.pockets.length; p++) {
                    const pocket = item.pockets[p];
                    const pocketWeight = containerSys.getPocketWeight(pocket);
                    const pocketVolume = containerSys.getPocketVolume(pocket);
                    const pocketItems = pocket.contents || [];
                    
                    html += `<div style="margin-bottom: 10px; padding: 8px; background: #1a1a1a; border-left: 3px solid #ffaa00;">`;
                    html += `<div style="color: #ffaa00; font-weight: bold; margin-bottom: 5px;">${pocket.name}</div>`;
                    html += `<div style="font-size: 15px; color: #aaa;">Capacity: ${containerSys.formatWeight(pocketWeight)} / ${containerSys.formatWeight(pocket.maxWeight)}</div>`;
                    html += `<div style="font-size: 15px; color: #aaa;">Volume: ${containerSys.formatVolume(pocketVolume)} / ${containerSys.formatVolume(pocket.maxVolume)}</div>`;
                    
                    if (pocketItems.length > 0) {
                        html += '<div style="margin-top: 8px; font-size: 15px; color: #00ffff;">Contents:</div>';
                        for (let pi = 0; pi < pocketItems.length; pi++) {
                            const pItem = pocketItems[pi];
                            html += `<div style="margin-left: 10px; margin-top: 5px; padding: 5px; background: #0a0a0a; border-left: 2px solid ${pItem.color};">`;
                            html += `<div style="font-size: 15px; color: ${pItem.color}; margin-bottom: 3px;">• ${pItem.name}</div>`;
                            html += `<button class="small-btn" data-action="actions-pocket-item" data-container-id="${item.id}" data-pocket-index="${p}" data-item-index="${pi}" style="margin-top: 3px;">Actions</button>`;
                            html += `</div>`;
                        }
                    } else {
                        html += '<div style="margin-top: 5px; font-size: 14px; color: #666;">Empty</div>';
                    }
                    html += `</div>`;
                }
                html += '</div>';
            }
            
            // Display opened container contents (cans, bottles, etc.) and light-source contents
            const showInspectContents = (item.state && item.state.opened && item.contents && item.contents.length > 0) ||
                                        (item.lightRadius && item.contents && item.contents.length > 0);
            if (showInspectContents) {
                html += '<div style="margin-top: 15px;">';
                html += '<h5 style="color: #00ffff; margin-bottom: 8px;">Contents:</h5>';
                
                for (let ci = 0; ci < item.contents.length; ci++) {
                    const contentItem = item.contents[ci];
                    html += `<div style="margin-left: 10px; margin-top: 5px; padding: 5px; background: #0a0a0a; border-left: 2px solid ${contentItem.color};">`;
                    html += `<div style="font-size: 15px; color: ${contentItem.color}; margin-bottom: 3px;">• ${contentItem.name}</div>`;
                    
                    // Show quantity if available
                    if (contentItem.quantity) {
                        html += `<div style="font-size: 13px; color: #888; margin-bottom: 3px;">${contentItem.quantity}${contentItem.quantityUnit}</div>`;
                    }
                    
                    // Show freshness indicator for food items
                    if (contentItem.type === 'food' && contentItem.state && contentItem.state.contaminationLevel !== undefined) {
                        const freshness = 1 - (contentItem.state.contaminationLevel / 0.3);
                        let freshnessText = '';
                        let freshnessColor = '';
                        
                        if (freshness > 0.66) {
                            freshnessText = '✓ Fresh';
                            freshnessColor = '#44ff44';
                        } else if (freshness > 0.33) {
                            freshnessText = '⚠ Aging';
                            freshnessColor = '#ffaa00';
                        } else {
                            freshnessText = '⚠ Spoiling';
                            freshnessColor = '#ff8800';
                        }
                        
                        html += `<div style="font-size: 13px; color: ${freshnessColor}; margin-bottom: 3px;">${freshnessText}</div>`;
                    }
                    
                    // Show contamination warning
                    if (contentItem.state && contentItem.state.contaminated) {
                        html += `<div style="font-size: 13px; color: #ff8800; margin-bottom: 3px;">⚠ Contaminated</div>`;
                    }
                    
                    html += `<button class="small-btn" data-action="actions-container-item" data-container-id="${item.id}" data-item-index="${ci}" style="margin-top: 3px;">Actions</button>`;
                    html += `</div>`;
                }
                html += '</div>';
            }
            
            html += '</div>';
        }
        
        html += '</div>';
        
        return html;
    }
    
    attachInventoryEventListeners() {
        const equipButtons = document.querySelectorAll('button[data-action="equip"]');
        equipButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                const slot = btn.dataset.slot;
                this.handleEquipItem(index, slot);
            });
        });
        
        const equipStoredButtons = document.querySelectorAll('button[data-action="equip-stored"]');
        equipStoredButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.storedIndex);
                const slot = btn.dataset.slot;
                this.handleEquipStoredItem(index, slot);
            });
        });
        
        const equipGroundButtons = document.querySelectorAll('button[data-action="equip-ground"]');
        equipGroundButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.groundIndex);
                const slot = btn.dataset.slot;
                this.handleEquipGroundItem(index, slot);
            });
        });
        
        const unequipButtons = document.querySelectorAll('button[data-action="unequip"]');
        unequipButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const slot = btn.dataset.slot;
                this.handleUnequipItem(slot);
            });
        });
        
        const dropButtons = document.querySelectorAll('button[data-action="drop"]');
        dropButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.handleDropItem(index);
            });
        });
        
        const dropStoredButtons = document.querySelectorAll('button[data-action="drop-stored"]');
        dropStoredButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.storedIndex);
                this.handleDropStoredItem(index);
            });
        });
        
        // Toggle light on/off button listeners
        const toggleLightButtons = document.querySelectorAll('button[data-action="toggle-light"]');
        toggleLightButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const slot = btn.dataset.slot;
                const item = this.game.player.equipment[slot];
                if (item && item.lightRadius) {
                    if (!item.state) item.state = {};
                    item.state.active = item.state.active === false ? true : false;
                    const status = item.state.active ? 'on' : 'off';
                    this.game.ui.log(`Turned ${item.name} ${status}.`, 'info');
                    this.game.render();
                    this.showDetailedInventory();
                }
            });
        });
        
        // Actions button listeners
        const actionsButtons = document.querySelectorAll('button[data-action^="actions-"]');
        actionsButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionType = btn.dataset.action;
                const player = this.game.player;
                let item = null;
                let sourceData = {};
                
                if (actionType === 'actions-equipped') {
                    const slot = btn.dataset.slot;
                    item = player.equipment[slot];
                    sourceData = { slot };
                } else if (actionType === 'actions-carried') {
                    const hand = btn.dataset.hand;
                    item = hand === 'both' ? player.carrying.leftHand : player.carrying[hand + 'Hand'];
                    sourceData = { hand };
                } else if (actionType === 'actions-stored') {
                    const index = parseInt(btn.dataset.storedIndex);
                    const storedItems = player.containerSystem.getAllStoredItems(player);
                    item = storedItems[index]?.item;
                    sourceData = { index };
                } else if (actionType === 'actions-ground') {
                    const index = parseInt(btn.dataset.groundIndex);
                    const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
                    item = groundItems[index];
                    sourceData = { index };
                } else if (actionType === 'actions-pocket-item') {
                    const containerId = btn.dataset.containerId;
                    const pocketIndex = parseInt(btn.dataset.pocketIndex);
                    const itemIndex = parseInt(btn.dataset.itemIndex);
                    const container = this.findContainerById(containerId);
                    if (container && container.pockets && container.pockets[pocketIndex]) {
                        const pocket = container.pockets[pocketIndex];
                        item = pocket.contents[itemIndex];
                    }
                    sourceData = { containerId, pocketIndex, itemIndex };
                } else if (actionType === 'actions-container-item') {
                    const containerId = btn.dataset.containerId;
                    const itemIndex = parseInt(btn.dataset.itemIndex);
                    
                    // Check all locations: inventory, equipment, carrying, and ground
                    let container = this.findContainerById(containerId);
                    
                    if (container && container.contents && container.contents[itemIndex]) {
                        item = container.contents[itemIndex];
                    }
                    sourceData = { containerId, itemIndex };
                }
                
                if (item) {
                    this.showActionsModal(item, actionType, sourceData);
                }
            });
        });
        
        const pickupGroundButtons = document.querySelectorAll('button[data-action="pickup-ground"]');
        pickupGroundButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.groundIndex);
                this.handlePickupGroundItem(index);
            });
        });
        
        const carryGroundButtons = document.querySelectorAll('button[data-action="carry-ground"]');
        carryGroundButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.groundIndex);
                this.handleCarryGroundItem(index);
            });
        });
        
        const dropCarriedButtons = document.querySelectorAll('button[data-action="drop-carried"]');
        dropCarriedButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const hand = btn.dataset.hand;
                this.handleDropCarriedItem(hand);
            });
        });
    }
    
    handleEquipItem(index, slot) {
        const player = this.game.player;
        const item = player.inventory[index];
        
        if (!item) {
            this.game.ui.log('Invalid item.', 'warning');
            return;
        }
        
        // Check if the target slot is occupied - block if occupied
        let occupiedItem = null;
        if (slot === 'bothHands') {
            if (player.equipment.leftHand || player.equipment.rightHand) {
                occupiedItem = player.equipment.leftHand || player.equipment.rightHand;
            }
        } else if (slot === 'leftHand' || slot === 'rightHand') {
            occupiedItem = player.equipment[slot];
        }
        
        if (occupiedItem) {
            this.game.ui.log(`${player.equipmentSystem.getSlotDisplayName(slot)} is occupied by ${occupiedItem.name}. Unequip it first.`, 'warning');
            return;
        }
        
        // Slot is free, proceed with equipping
        const result = player.equipmentSystem.equipItem(index, slot);
        this.game.ui.log(result.message, result.success ? 'info' : 'warning');
        this.showDetailedInventory();
        this.updatePanels();
    }
    
    handleUnequipItem(slot) {
        const result = this.game.player.equipmentSystem.unequipSlot(slot);
        
        if (result.success && result.unequipped) {
            const item = result.unequipped;
            const player = this.game.player;
            
            // Try to auto-store, otherwise drop to ground
            const storeResult = player.containerSystem.autoStoreItem(player, item);
            if (storeResult.success) {
                player.inventory.push(item);
                this.game.ui.log(`${result.message} Stored in ${storeResult.location}.`, 'info');
            } else {
                // No storage space, drop to ground
                item.x = player.x;
                item.y = player.y;
                this.game.world.addItem(item);
                this.game.ui.log(`${result.message} No storage space - dropped to ground.`, 'info');
            }
        } else {
            this.game.ui.log(result.message, 'warning');
        }
        
        this.showDetailedInventory();
        this.updatePanels();
    }
    
    handleEquipStoredItem(storedIndex, slot) {
        const player = this.game.player;
        const storedItems = player.containerSystem.getAllStoredItems(player);
        const stored = storedItems[storedIndex];
        
        if (stored && stored.item) {
            const item = stored.item;
            const invIndex = player.inventory.indexOf(item);
            
            if (invIndex > -1) {
                // Check if the target slot is occupied - block if occupied
                let occupiedItem = null;
                if (slot === 'bothHands') {
                    if (player.equipment.leftHand || player.equipment.rightHand) {
                        occupiedItem = player.equipment.leftHand || player.equipment.rightHand;
                    }
                } else if (slot === 'leftHand' || slot === 'rightHand') {
                    occupiedItem = player.equipment[slot];
                }
                
                if (occupiedItem) {
                    this.game.ui.log(`${player.equipmentSystem.getSlotDisplayName(slot)} is occupied by ${occupiedItem.name}. Unequip it first.`, 'warning');
                    return;
                }
                
                // Slot is free, proceed with equipping
                const result = player.equipmentSystem.equipItem(invIndex, slot);
                this.game.ui.log(result.message, result.success ? 'info' : 'warning');
                this.showDetailedInventory();
                this.updatePanels();
            }
        }
    }
    
    handleEquipGroundItem(groundIndex, slot) {
        const player = this.game.player;
        const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
        const item = groundItems[groundIndex];
        
        if (item) {
            const validSlots = player.equipmentSystem.getValidSlotsForItem(item);
            if (validSlots.includes(slot)) {
                // Check if slot is occupied - block if occupied
                const currentItem = player.equipment[slot];
                if (currentItem) {
                    this.game.ui.log(`${player.equipmentSystem.getSlotDisplayName(slot)} is occupied by ${currentItem.name}. Unequip it first.`, 'warning');
                    return;
                }
                
                // Remove from ground and equip
                this.game.world.removeItem(item);
                player.equipment[slot] = item;
                this.game.ui.log(`Equipped ${item.name} to ${player.equipmentSystem.getSlotDisplayName(slot)}.`, 'info');
                this.showDetailedInventory('ground');
                this.updatePanels();
            } else {
                this.game.ui.log(`Cannot equip ${item.name} to ${slot}.`, 'warning');
            }
        }
    }
    
    handleDropItem(index) {
        const item = this.game.player.inventory[index];
        if (item) {
            this.game.player.dropItem(item);
            this.showDetailedInventory('ground');
            this.updatePanels();
        }
    }
    
    handleDropStoredItem(storedIndex) {
        const storedItems = this.game.player.containerSystem.getAllStoredItems(this.game.player);
        const stored = storedItems[storedIndex];
        if (stored && stored.item) {
            this.game.player.dropItem(stored.item);
            this.showDetailedInventory('ground');
            this.updatePanels();
        }
    }
    
    handleInspectInventoryItem(index) {
        const item = this.game.player.inventory[index];
        if (item) {
            this.showDetailedInventory('inspect', item);
        }
    }
    
    handleInspectStoredItem(storedIndex) {
        const storedItems = this.game.player.containerSystem.getAllStoredItems(this.game.player);
        const stored = storedItems[storedIndex];
        if (stored && stored.item) {
            this.showInspectModal(stored.item);
        }
    }
    
    handleInspectEquippedItem(slot) {
        const item = this.game.player.equipment[slot];
        if (item) {
            this.showInspectModal(item);
        }
    }
    
    handleInspectGroundItem(index) {
        const groundItems = this.game.world.getItemsAt(this.game.player.x, this.game.player.y, this.game.player.z);
        const item = groundItems[index];
        if (item) {
            this.showInspectModal(item);
        }
    }
    
    showMoveModal(sourceType, sourceData) {
        const player = this.game.player;
        const containerSys = player.containerSystem;
        const content = document.getElementById('detailed-inventory-content');
        
        // Get the item based on source
        let item = null;
        if (sourceType === 'equipped') {
            item = player.equipment[sourceData.slot];
        } else if (sourceType === 'stored') {
            const storedItems = containerSys.getAllStoredItems(player);
            item = storedItems[sourceData.index]?.item;
        } else if (sourceType === 'carried') {
            item = sourceData.hand === 'both' ? player.carrying.leftHand : player.carrying[sourceData.hand + 'Hand'];
        } else if (sourceType === 'ground') {
            const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
            item = groundItems[sourceData.index];
        } else if (sourceType === 'furniture') {
            const furniture = this.game.world.worldObjects.find(o => o.id === sourceData.furnitureId);
            if (furniture && furniture.pockets && furniture.pockets[sourceData.pocketIndex]) {
                item = furniture.pockets[sourceData.pocketIndex].contents[sourceData.itemIndex];
            }
        } else if (sourceType === 'pocket') {
            // Find the container and get the item from the pocket
            const container = this.findContainerById(sourceData.containerId);
            if (container && container.pockets && container.pockets[sourceData.pocketIndex]) {
                const pocket = container.pockets[sourceData.pocketIndex];
                item = pocket.contents[sourceData.itemIndex];
            }
        } else if (sourceType === 'container-item') {
            // Find the container and get the item from its contents
            const container = this.findContainerById(sourceData.containerId);
            
            if (container && container.contents && container.contents[sourceData.itemIndex]) {
                item = container.contents[sourceData.itemIndex];
            }
        }
        
        if (!item) return;
        
        let html = '<div style="padding: 20px;">';
        html += `<button id="close-move-modal" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
        html += `<h3 style="color: #4488ff; margin-bottom: 15px;">Move: ${item.name}</h3>`;
        
        html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #4488ff; margin-bottom: 15px;">`;
        html += `<div style="color: #888; margin-bottom: 10px;">Choose where to move this item:</div>`;
        
        // Equip option (if item can be equipped and not already equipped)
        const validSlots = player.equipmentSystem.getValidSlotsForItem(item);
        if (validSlots.length > 0 && sourceType !== 'equipped') {
            // Filter out occupied slots (check both equipment AND carrying)
            const availableSlots = validSlots.filter(slot => {
                if (slot === 'bothHands') {
                    return !player.equipment.leftHand && !player.equipment.rightHand &&
                           !player.carrying.leftHand && !player.carrying.rightHand;
                }
                if (slot === 'leftHand') {
                    return !player.equipment.leftHand && !player.carrying.leftHand;
                }
                if (slot === 'rightHand') {
                    return !player.equipment.rightHand && !player.carrying.rightHand;
                }
                return !player.equipment[slot];
            });
            
            if (availableSlots.length > 0) {
                html += `<div style="margin-bottom: 15px; padding: 10px; background: #0a0a0a; border: 1px solid #444;">`;
                html += `<div style="color: #88ff88; font-weight: bold; margin-bottom: 8px;">⚔️ Equip</div>`;
                html += `<div style="display: flex; gap: 5px; flex-wrap: wrap;">`;
                for (const slot of availableSlots) {
                    html += `<button class="small-btn" data-move-action="equip" data-move-slot="${slot}" style="background: #88ff88; color: #000;">${player.equipmentSystem.getSlotDisplayName(slot)}</button>`;
                }
                html += `</div>`;
                html += `</div>`;
            } else {
                // Show message that all slots are occupied
                html += `<div style="margin-bottom: 15px; padding: 10px; background: #0a0a0a; border: 1px solid #666;">`;
                html += `<div style="color: #888; font-weight: bold; margin-bottom: 8px;">⚔️ Equip</div>`;
                html += `<div style="color: #ff8800; font-size: 14px;">All equipment slots are occupied. Unequip an item first.</div>`;
                html += `</div>`;
            }
        }
        
        // Store option (if not already stored)
        if (sourceType !== 'stored') {
            const storageOptions = containerSys.findAvailableStorage(player, item);
            if (storageOptions.length > 0) {
                html += `<div style="margin-bottom: 15px; padding: 10px; background: #0a0a0a; border: 1px solid #444;">`;
                html += `<div style="color: #00ffff; font-weight: bold; margin-bottom: 8px;">📦 Store</div>`;
                html += `<div style="color: #888; font-size: 11px; margin-bottom: 8px;">Choose storage location:</div>`;
                html += `<div style="display: flex; flex-direction: column; gap: 5px;">`;
                for (let i = 0; i < storageOptions.length; i++) {
                    const storage = storageOptions[i];
                    html += `<button class="small-btn" data-move-action="store" data-storage-index="${i}" style="background: #00ffff; color: #000; text-align: left;">${storage.location}</button>`;
                }
                html += `</div>`;
                html += `</div>`;
            } else {
                html += `<div style="margin-bottom: 15px; padding: 10px; background: #0a0a0a; border: 1px solid #444;">`;
                html += `<div style="color: #666; font-weight: bold; margin-bottom: 8px;">📦 Store</div>`;
                html += `<div style="color: #666; font-size: 11px;">No storage space available</div>`;
                html += `</div>`;
            }
        }
        
        // Carry option (if not already carried and hands available)
        if (sourceType !== 'carried') {
            const canCarry = player.canCarryInHands(item);
            if (canCarry.canCarry) {
                html += `<div style="margin-bottom: 15px; padding: 10px; background: #0a0a0a; border: 1px solid #444;">`;
                html += `<div style="color: #ffaa00; font-weight: bold; margin-bottom: 8px;">🤲 Carry in Hands</div>`;
                html += `<button class="small-btn" data-move-action="carry" style="background: #ffaa00; color: #000;">Carry (${canCarry.hands === 'both' ? 'Both Hands' : 'One Hand'})</button>`;
                html += `</div>`;
            } else {
                html += `<div style="margin-bottom: 15px; padding: 10px; background: #0a0a0a; border: 1px solid #444;">`;
                html += `<div style="color: #666; font-weight: bold; margin-bottom: 8px;">🤲 Carry in Hands</div>`;
                html += `<div style="color: #666; font-size: 11px;">${canCarry.reason}</div>`;
                html += `</div>`;
            }
        }
        
        // Drop option (always available)
        html += `<div style="margin-bottom: 15px; padding: 10px; background: #0a0a0a; border: 1px solid #444;">`;
        html += `<div style="color: #ff8888; font-weight: bold; margin-bottom: 8px;">⬇️ Drop to Ground</div>`;
        html += `<button class="small-btn" data-move-action="drop" style="background: #ff8888; color: #000;">Drop Here</button>`;
        html += `</div>`;
        
        html += `</div>`;
        html += '</div>';
        
        content.innerHTML = html;
        
        // Store context for move actions
        this.moveContext = { sourceType, sourceData, item, storageOptions: containerSys.findAvailableStorage(player, item) };
        
        // Attach event listeners
        document.getElementById('close-move-modal')?.addEventListener('click', () => {
            this.showDetailedInventory('inventory');
        });
        
        const moveActionButtons = document.querySelectorAll('button[data-move-action]');
        moveActionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.moveAction;
                const slot = btn.dataset.moveSlot;
                const storageIndex = btn.dataset.storageIndex;
                this.handleMoveAction(action, slot, storageIndex);
            });
        });
    }
    
    handleMoveAction(action, slot, storageIndex) {
        if (!this.moveContext) return;
        
        const { sourceType, sourceData, item, storageOptions } = this.moveContext;
        const player = this.game.player;
        
        // Remove item from source
        if (sourceType === 'equipped') {
            player.equipment[sourceData.slot] = null;
            if (item.twoHandGrip) {
                player.equipment.leftHand = null;
                player.equipment.rightHand = null;
                item.twoHandGrip = false;
            }
        } else if (sourceType === 'stored') {
            const storedItems = player.containerSystem.getAllStoredItems(player);
            const stored = storedItems[sourceData.index];
            player.containerSystem.removeItem(stored.container, item, stored.pocketIndex);
            const invIndex = player.inventory.indexOf(item);
            if (invIndex !== -1) player.inventory.splice(invIndex, 1);
        } else if (sourceType === 'carried') {
            if (sourceData.hand === 'both') {
                player.carrying.leftHand = null;
                player.carrying.rightHand = null;
            } else {
                player.carrying[sourceData.hand + 'Hand'] = null;
            }
            delete item.carriedIn;
        } else if (sourceType === 'ground') {
            this.game.world.removeItem(item);
        } else if (sourceType === 'furniture') {
            const furniture = this.game.world.worldObjects.find(o => o.id === sourceData.furnitureId);
            if (furniture && furniture.pockets && furniture.pockets[sourceData.pocketIndex]) {
                furniture.pockets[sourceData.pocketIndex].contents.splice(sourceData.itemIndex, 1);
            }
        } else if (sourceType === 'pocket') {
            // Remove from pocket contents
            const container = this.findContainerById(sourceData.containerId);
            if (container && container.pockets && container.pockets[sourceData.pocketIndex]) {
                const pocket = container.pockets[sourceData.pocketIndex];
                pocket.contents.splice(sourceData.itemIndex, 1);
            }
            const invIndex = player.inventory.indexOf(item);
            if (invIndex !== -1) player.inventory.splice(invIndex, 1);
        } else if (sourceType === 'container-item') {
            // Remove from container contents
            const container = this.findContainerById(sourceData.containerId);
            
            if (container && container.contents && container.contents[sourceData.itemIndex]) {
                container.contents.splice(sourceData.itemIndex, 1);
            }
        }
        
        // Move to destination
        if (action === 'equip') {
            if (slot === 'bothHands') {
                player.equipment.leftHand = item;
                player.equipment.rightHand = item;
                item.twoHandGrip = true;
            } else {
                player.equipment[slot] = item;
            }
            this.game.ui.log(`Equipped ${item.name}.`, 'info');
        } else if (action === 'store') {
            const storage = storageOptions[parseInt(storageIndex)];
            if (storage.type === 'pocket') {
                player.containerSystem.addItem(storage.item, item, storage.pocketIndex);
            } else {
                player.containerSystem.addItem(storage.item, item);
            }
            player.inventory.push(item);
            this.game.ui.log(`Stored ${item.name} in ${storage.location}.`, 'info');
        } else if (action === 'carry') {
            player.carryInHands(item);
            this.game.ui.log(`Carrying ${item.name} in hands.`, 'info');
        } else if (action === 'drop') {
            item.x = player.x;
            item.y = player.y;
            item.z = player.z;
            this.game.world.addItem(item);
            this.game.ui.log(`Dropped ${item.name}.`, 'info');
        }
        
        this.moveContext = null;
        this.showDetailedInventory('inventory');
        this.updatePanels();
    }
    
    showOccupiedSlotPrompt(newItemIndex, targetSlot, occupiedItem) {
        const player = this.game.player;
        const newItem = player.inventory[newItemIndex];
        const content = document.getElementById('detailed-inventory-content');
        const containerSys = player.containerSystem;
        
        let html = '<div style="padding: 20px;">';
        html += `<h3 style="color: #ffaa00; margin-bottom: 15px;">⚠️ Slot Occupied</h3>`;
        
        html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #ffaa00; margin-bottom: 15px;">`;
        html += `<div style="color: #fff; font-size: 16px; margin-bottom: 10px;">You are trying to equip:</div>`;
        html += `<div style="color: ${newItem.color}; font-size: 18px; font-weight: bold; margin-bottom: 15px;">→ ${newItem.name}</div>`;
        
        const slotName = player.equipmentSystem.getSlotDisplayName(targetSlot);
        html += `<div style="color: #fff; font-size: 16px; margin-bottom: 10px;">But ${slotName} is occupied by:</div>`;
        html += `<div style="color: ${occupiedItem.color}; font-size: 18px; font-weight: bold; margin-bottom: 15px;">→ ${occupiedItem.name}</div>`;
        
        html += `<div style="color: #ffaa00; font-size: 16px; margin-top: 15px;">What do you want to do with ${occupiedItem.name}?</div>`;
        html += `</div>`;
        
        // Drop option
        html += `<div style="margin-bottom: 15px; padding: 15px; background: #1a1a1a; border: 2px solid #ff8888;">`;
        html += `<div style="color: #ff8888; font-weight: bold; margin-bottom: 8px; font-size: 18px;">⬇️ Drop to Ground</div>`;
        html += `<div style="color: #aaa; font-size: 15px; margin-bottom: 10px;">Drop ${occupiedItem.name} on the ground and equip ${newItem.name}.</div>`;
        html += `<button id="occupied-drop" class="small-btn" style="background: #ff8888; color: #000; font-size: 16px; padding: 10px 20px;">Drop & Equip</button>`;
        html += `</div>`;
        
        // Move option
        html += `<div style="margin-bottom: 15px; padding: 15px; background: #1a1a1a; border: 2px solid #4488ff;">`;
        html += `<div style="color: #4488ff; font-weight: bold; margin-bottom: 8px; font-size: 18px;">📦 Move to Storage</div>`;
        html += `<div style="color: #aaa; font-size: 15px; margin-bottom: 10px;">Choose where to move ${occupiedItem.name}, then equip ${newItem.name}.</div>`;
        
        // Check available storage
        const storageOptions = containerSys.findAvailableStorage(player, occupiedItem);
        if (storageOptions.length > 0) {
            html += `<div style="display: flex; flex-direction: column; gap: 5px;">`;
            for (let i = 0; i < storageOptions.length; i++) {
                const storage = storageOptions[i];
                html += `<button class="occupied-move-btn small-btn" data-storage-index="${i}" style="background: #4488ff; color: #000; text-align: left; font-size: 15px; padding: 10px;">Move to: ${storage.location}</button>`;
            }
            html += `</div>`;
        } else {
            html += `<div style="color: #666; font-size: 15px;">No storage space available. You must drop the item.</div>`;
        }
        html += `</div>`;
        
        // Cancel option
        html += `<button id="occupied-cancel" class="small-btn" style="font-size: 16px; padding: 10px 20px;">← Cancel</button>`;
        
        html += '</div>';
        
        content.innerHTML = html;
        
        // Store context for the action
        this.occupiedSlotContext = {
            newItemIndex,
            targetSlot,
            occupiedItem,
            storageOptions
        };
        
        // Attach event listeners
        document.getElementById('occupied-drop')?.addEventListener('click', () => {
            this.handleOccupiedSlotDrop();
        });
        
        document.getElementById('occupied-cancel')?.addEventListener('click', () => {
            this.showDetailedInventory();
        });
        
        const moveButtons = document.querySelectorAll('.occupied-move-btn');
        moveButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const storageIndex = parseInt(btn.dataset.storageIndex);
                this.handleOccupiedSlotMove(storageIndex);
            });
        });
    }
    
    handleOccupiedSlotDrop() {
        if (!this.occupiedSlotContext) return;
        
        const { newItemIndex, targetSlot, occupiedItem } = this.occupiedSlotContext;
        const player = this.game.player;
        
        // Unequip the occupied item and drop it
        if (targetSlot === 'bothHands') {
            player.equipment.leftHand = null;
            player.equipment.rightHand = null;
            if (occupiedItem.twoHandGrip) {
                occupiedItem.twoHandGrip = false;
            }
        } else {
            player.equipment[targetSlot] = null;
        }
        
        // Drop to ground
        occupiedItem.x = player.x;
        occupiedItem.y = player.y;
        this.game.world.addItem(occupiedItem);
        
        // Now equip the new item (skipAutoUnequip=true since we already cleared the slot)
        const result = player.equipmentSystem.equipItem(newItemIndex, targetSlot, true);
        this.game.ui.log(`Dropped ${occupiedItem.name} to ground. ${result.message}`, result.success ? 'info' : 'warning');
        
        this.occupiedSlotContext = null;
        this.showDetailedInventory();
        this.updatePanels();
    }
    
    handleOccupiedSlotMove(storageIndex) {
        if (!this.occupiedSlotContext) return;
        
        const { newItemIndex, targetSlot, occupiedItem, storageOptions } = this.occupiedSlotContext;
        const player = this.game.player;
        const storage = storageOptions[storageIndex];
        
        // Unequip the occupied item
        if (targetSlot === 'bothHands') {
            player.equipment.leftHand = null;
            player.equipment.rightHand = null;
            if (occupiedItem.twoHandGrip) {
                occupiedItem.twoHandGrip = false;
            }
        } else {
            player.equipment[targetSlot] = null;
        }
        
        // Move to storage
        if (storage.type === 'pocket') {
            player.containerSystem.addItem(storage.item, occupiedItem, storage.pocketIndex);
        } else {
            player.containerSystem.addItem(storage.item, occupiedItem);
        }
        player.inventory.push(occupiedItem);
        
        // Now equip the new item (skipAutoUnequip=true since we already cleared the slot)
        const result = player.equipmentSystem.equipItem(newItemIndex, targetSlot, true);
        this.game.ui.log(`Moved ${occupiedItem.name} to ${storage.location}. ${result.message}`, result.success ? 'info' : 'warning');
        
        this.occupiedSlotContext = null;
        this.showDetailedInventory();
        this.updatePanels();
    }
    
    showInspectModal(item) {
        if (!item) return;
        
        const containerSys = this.game.player.containerSystem;
        const content = document.getElementById('detailed-inventory-content');
        
        let html = '<div style="padding: 20px;">';
        html += `<button id="close-inspect" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
        html += '<h3 style="color: #00ffff; margin-bottom: 15px;">Item Inspection</h3>';
        
        html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid ${item.color}; margin-bottom: 15px;">`;
        html += `<h4 style="color: ${item.color}; margin-bottom: 10px;">${item.name}</h4>`;
        html += `<div style="color: #888; margin-bottom: 5px;">Type: ${item.type}</div>`;
        
        if (item.material) {
            const material = this.game.content.materials[item.material];
            html += `<div style="color: #888; margin-bottom: 5px;">Material: ${material.name}</div>`;
        }
        
        const itemWeight = containerSys.getItemWeight(item);
        const itemVolume = containerSys.getItemVolume(item);
        html += `<div style="color: #888; margin-bottom: 5px;">Weight: ${containerSys.formatWeight(itemWeight)}</div>`;
        html += `<div style="color: #888; margin-bottom: 5px;">Volume: ${containerSys.formatVolume(itemVolume)}</div>`;
        
        if (item.durability !== undefined) {
            const durabilityColor = item.durability > 75 ? '#00ff00' : item.durability > 50 ? '#ffaa00' : item.durability > 25 ? '#ff8800' : '#ff4444';
            const durLabel = item.tags && item.tags.includes('power') ? 'Charge' : 'Durability';
            html += `<div style="color: ${durabilityColor}; margin-bottom: 5px;">${durLabel}: ${Math.floor(item.durability)}%</div>`;
        }
        
        if (item.damage) {
            html += `<div style="color: #ff8888; margin-top: 10px;">Damage: ${item.damage}</div>`;
        }
        
        if (item.defense !== undefined) {
            html += `<div style="color: #88ff88; margin-top: 10px;">Defense: ${item.defense}</div>`;
        }
        
        // Show components if item has them
        if (item.components && item.components.length > 0) {
            html += `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;">`;
            html += `<div style="color: #ffaa00; font-weight: bold; margin-bottom: 8px;">Components:</div>`;
            for (const comp of item.components) {
                const qualityColor = comp.quality >= 80 ? '#00ff00' : comp.quality >= 50 ? '#ffaa00' : '#ff8800';
                html += `<div style="margin-left: 10px; margin-bottom: 5px; color: #aaa; font-size: 14px;">`;
                html += `• ${comp.name} x${comp.quantity} `;
                html += `<span style="color: ${qualityColor};">(${comp.quality}%)</span>`;
                html += `</div>`;
            }
            html += `</div>`;
        }
        
        // Show weapon stats if item can be used as weapon
        if (item.weaponStats) {
            html += `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;">`;
            html += `<div style="color: #ff8888; font-weight: bold; margin-bottom: 8px;">As Weapon:</div>`;
            html += `<div style="margin-left: 10px; color: #aaa; font-size: 14px;">`;
            html += `<div style="margin-bottom: 3px;">Damage: <span style="color: #ff8888;">${item.weaponStats.damage}</span></div>`;
            html += `<div style="margin-bottom: 3px;">Speed: <span style="color: #88ff88;">${item.weaponStats.actionCost}</span></div>`;
            html += `<div style="margin-bottom: 3px;">Type: <span style="color: #ffaa00;">${item.weaponStats.attackType}</span></div>`;
            if (item.weaponStats.bleedChance) {
                html += `<div style="margin-bottom: 3px;">Bleed Chance: <span style="color: #ff4444;">${Math.floor(item.weaponStats.bleedChance * 100)}%</span></div>`;
            }
            if (item.weaponStats.stunChance) {
                html += `<div style="margin-bottom: 3px;">Stun Chance: <span style="color: #ffff00;">${Math.floor(item.weaponStats.stunChance * 100)}%</span></div>`;
            }
            if (item.weaponStats.canTwoHand) {
                html += `<div style="margin-bottom: 3px; color: #00ffff;">Can wield two-handed</div>`;
            }
            if (item.weaponStats.throwable) {
                html += `<div style="margin-bottom: 3px; color: #00ffff;">Throwable</div>`;
            }
            html += `</div>`;
            html += `</div>`;
        }
        
        html += `</div>`;
        
        // Container details
        if (item.isContainer) {
            html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #ffaa00; margin-bottom: 15px;">`;
            html += `<h4 style="color: #ffaa00; margin-bottom: 10px;">Container Details</h4>`;
            
            if (item.pockets) {
                html += `<div style="margin-bottom: 10px;">`;
                html += `<div style="color: #ffaa00; font-weight: bold; margin-bottom: 8px;">Pockets: ${item.pockets.length}</div>`;
                
                for (let i = 0; i < item.pockets.length; i++) {
                    const pocket = item.pockets[i];
                    const pocketWeight = containerSys.getPocketWeight(pocket);
                    const pocketVolume = containerSys.getPocketVolume(pocket);
                    const itemCount = pocket.contents ? pocket.contents.length : 0;
                    
                    html += `<div style="padding: 10px; background: #0a0a0a; border: 1px solid #444; margin-bottom: 8px;">`;
                    html += `<div style="color: #ffaa00; font-weight: bold; margin-bottom: 5px;">${pocket.name}</div>`;
                    html += `<div style="font-size: 15px; color: #aaa;">Capacity: ${containerSys.formatWeight(pocketWeight)} / ${containerSys.formatWeight(pocket.maxWeight)}</div>`;
                    html += `<div style="font-size: 15px; color: #aaa;">Volume: ${containerSys.formatVolume(pocketVolume)} / ${containerSys.formatVolume(pocket.maxVolume)}</div>`;
                    html += `<div style="font-size: 15px; color: #aaa; margin-top: 5px;">Items: ${itemCount}</div>`;
                    
                    if (pocket.contents && pocket.contents.length > 0) {
                        html += `<div style="margin-top: 8px;">`;
                        for (let pi = 0; pi < pocket.contents.length; pi++) {
                            const pocketItem = pocket.contents[pi];
                            html += `<div style="margin-bottom: 8px; padding: 8px; background: #000; border-left: 2px solid ${pocketItem.color};">`;
                            html += `<div style="color: ${pocketItem.color}; font-size: 16px; margin-bottom: 5px;">• ${pocketItem.name}</div>`;
                            html += `<button class="small-btn" data-action="actions-pocket-item" data-container-id="${item.id}" data-pocket-index="${i}" data-item-index="${pi}">Actions</button>`;
                            html += `</div>`;
                        }
                        html += `</div>`;
                    } else {
                        html += `<div style="margin-top: 5px; color: #666; font-size: 14px;">Empty</div>`;
                    }
                    
                    html += `</div>`;
                }
                html += `</div>`;
            } else if (item.contents) {
                const contWeight = containerSys.getTotalWeight(item);
                const contVolume = containerSys.getTotalVolume(item);
                html += `<div style="color: #888; margin-bottom: 5px;">Weight: ${containerSys.formatWeight(contWeight)} / ${containerSys.formatWeight(item.maxWeight)}</div>`;
                html += `<div style="color: #888; margin-bottom: 5px;">Volume: ${containerSys.formatVolume(contVolume)} / ${containerSys.formatVolume(item.maxVolume)}</div>`;
                html += `<div style="color: #888; margin-bottom: 10px;">Items: ${item.contents.length}</div>`;
                
                if (item.contents.length > 0) {
                    html += `<div style="margin-top: 8px;">`;
                    for (let ci = 0; ci < item.contents.length; ci++) {
                        const containedItem = item.contents[ci];
                        html += `<div style="margin-bottom: 8px; padding: 8px; background: #000; border-left: 2px solid ${containedItem.color};">`;
                        html += `<div style="color: ${containedItem.color}; font-size: 16px; margin-bottom: 5px;">• ${containedItem.name}</div>`;
                        
                        // Show quantity if available
                        if (containedItem.quantity) {
                            html += `<div style="font-size: 13px; color: #888; margin-bottom: 3px;">${containedItem.quantity}${containedItem.quantityUnit}</div>`;
                        }
                        
                        // Show freshness indicator for food items
                        if (containedItem.type === 'food' && containedItem.state && containedItem.state.contaminationLevel !== undefined) {
                            const freshness = 1 - (containedItem.state.contaminationLevel / 0.3);
                            let freshnessText = '';
                            let freshnessColor = '';
                            
                            if (freshness > 0.66) {
                                freshnessText = '✓ Fresh';
                                freshnessColor = '#44ff44';
                            } else if (freshness > 0.33) {
                                freshnessText = '⚠ Aging';
                                freshnessColor = '#ffaa00';
                            } else {
                                freshnessText = '⚠ Spoiling';
                                freshnessColor = '#ff8800';
                            }
                            
                            html += `<div style="font-size: 13px; color: ${freshnessColor}; margin-bottom: 3px;">${freshnessText}</div>`;
                        }
                        
                        // Show contamination warning
                        if (containedItem.state && containedItem.state.contaminated) {
                            html += `<div style="font-size: 13px; color: #ff8800; margin-bottom: 3px;">⚠ Contaminated</div>`;
                        }
                        
                        html += `<button class="small-btn" data-action="actions-container-item" data-container-id="${item.id}" data-item-index="${ci}">Actions</button>`;
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
            }
            
            html += `</div>`;
        }
        
        html += '</div>';
        
        content.innerHTML = html;
        
        document.getElementById('close-inspect')?.addEventListener('click', () => {
            this.showDetailedInventory('inventory');
        });
        
        // Attach all inventory event listeners (includes actions-pocket-item and actions-container-item)
        this.attachInventoryEventListeners();
    }
    
    handlePickupGroundItem(index) {
        const groundItems = this.game.world.getItemsAt(this.game.player.x, this.game.player.y, this.game.player.z);
        const item = groundItems[index];
        if (item) {
            const success = this.game.player.tryPickup(item);
            if (success) {
                this.showDetailedInventory('inventory');
                this.updatePanels();
            }
        }
    }
    
    handleCarryGroundItem(index) {
        const groundItems = this.game.world.getItemsAt(this.game.player.x, this.game.player.y, this.game.player.z);
        const item = groundItems[index];
        if (item) {
            // Initialize carrying if it doesn't exist (for old save games)
            if (!this.game.player.carrying) {
                this.game.player.carrying = { leftHand: null, rightHand: null };
            }
            
            const result = this.game.player.carryInHands(item);
            console.log('Carry result:', result);
            console.log('Player carrying after carry:', this.game.player.carrying);
            
            if (result.success) {
                this.game.world.removeItem(item);
                this.game.ui.log(result.message, 'info');
                this.showDetailedInventory('inventory');
                this.updatePanels();
            } else {
                this.game.ui.log(result.message, 'warning');
            }
        }
    }
    
    handleDropCarriedItem(hand) {
        const result = this.game.player.dropCarriedItem(hand);
        if (result.success) {
            this.game.ui.log(`Dropped ${result.item.name}.`, 'info');
            this.showDetailedInventory('ground');
            this.updatePanels();
        }
    }
    
    closeAllModals() {
        let closedAny = false;
        
        if (this.detailedCharacterModal && !this.detailedCharacterModal.classList.contains('hidden')) {
            this.detailedCharacterModal.classList.add('hidden');
            closedAny = true;
        }
        
        if (this.detailedInventoryModal && !this.detailedInventoryModal.classList.contains('hidden')) {
            this.detailedInventoryModal.classList.add('hidden');
            this.disassembleContext = null;
            this.craftingContext = null;
            this.worldObjectContext = null;
            this.actionsContext = null;
            this.moveContext = null;
            this.furnitureContext = null;
            closedAny = true;
        }
        
        if (this.helpModal && !this.helpModal.classList.contains('hidden')) {
            this.helpModal.classList.add('hidden');
            closedAny = true;
        }
        
        if (this.abilityPanelModal && !this.abilityPanelModal.classList.contains('hidden')) {
            this.abilityPanelModal.classList.add('hidden');
            if (this._abilityKeyHandler) {
                document.removeEventListener('keydown', this._abilityKeyHandler);
                this._abilityKeyHandler = null;
            }
            closedAny = true;
        }
        
        if (this.combatOverlayVisible) {
            this.hideCombatOverlay();
            closedAny = true;
        }
        
        return closedAny;
    }
    
    toggleAbilityPanel() {
        if (!this.abilityPanelModal) return;
        
        if (this.abilityPanelModal.classList.contains('hidden')) {
            this.showAbilityPanel();
            this.abilityPanelModal.classList.remove('hidden');
        } else {
            this.abilityPanelModal.classList.add('hidden');
            // Clean up number key handler
            if (this._abilityKeyHandler) {
                document.removeEventListener('keydown', this._abilityKeyHandler);
                this._abilityKeyHandler = null;
            }
        }
    }
    
    showAbilityPanel() {
        if (!this.game.player || !this.game.abilitySystem) return;
        
        const content = document.getElementById('ability-panel-content');
        const player = this.game.player;
        const abilitySys = this.game.abilitySystem;
        const abilities = abilitySys.getAvailableAbilities(player);
        const weapon = abilitySys.getEntityWeapon(player);
        const weaponType = abilitySys.getWeaponType(weapon);
        const weaponName = weapon ? weapon.name : 'Bare Fists';
        const stance = player.getStance();
        const stanceName = stance ? stance.name : 'Aggressive';
        const stanceColor = stance ? stance.color : '#ff4444';
        
        // Check if in combat (any engaged enemies)
        const inCombat = this.game.combatSystem && this.game.combatSystem.getEngagedEnemies().length > 0;
        
        let html = '';
        
        // Header: weapon + stance info
        html += `<div style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #333;">`;
        html += `<div style="font-size: 14px; color: #aaa;">Weapon: <span style="color: #fff; font-weight: bold;">${weaponName}</span> <span style="color: #888;">(${weaponType})</span></div>`;
        html += `<div style="font-size: 14px; color: #aaa;">Stance: <span style="color: ${stanceColor}; font-weight: bold;">${stanceName}</span> <span style="color: #888;">[T to change]</span></div>`;
        if (!inCombat) {
            html += `<div style="font-size: 12px; color: #888; margin-top: 4px;">Not in combat — abilities can only be used when engaged with an enemy.</div>`;
        }
        html += `</div>`;
        
        if (abilities.length === 0) {
            html += `<div style="color: #888; font-style: italic;">No abilities available for ${weaponType} weapons.</div>`;
        }
        
        // Render each ability
        for (let i = 0; i < abilities.length; i++) {
            const ab = abilities[i];
            const locked = !ab.unlocked;
            const onCooldown = ab.onCooldown;
            const opacity = locked ? '0.45' : (onCooldown ? '0.6' : '1.0');
            const borderColor = locked ? '#333' : (onCooldown ? '#555' : (ab.inPreferredStance ? '#44ff44' : '#ffaa00'));
            const bgColor = locked ? '#111' : (onCooldown ? '#151520' : '#1a1a2a');
            
            html += `<div style="opacity: ${opacity}; border: 1px solid ${borderColor}; background: ${bgColor}; padding: 8px; margin-bottom: 6px; border-radius: 4px;">`;
            
            // Title row: name + stance tag + AP cost
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
            html += `<div>`;
            html += `<span style="color: #fff; font-weight: bold; font-size: 14px;">${ab.name}</span> `;
            
            // Stance tag
            const stanceTagColor = ab.inPreferredStance ? '#44ff44' : '#ffaa00';
            const stanceTagLabel = ab.inPreferredStance ? `✓ ${ab.preferredStance}` : `⚠ best in ${ab.preferredStance}`;
            html += `<span style="color: ${stanceTagColor}; font-size: 11px; border: 1px solid ${stanceTagColor}; padding: 1px 4px; border-radius: 3px;">${stanceTagLabel}</span>`;
            html += `</div>`;
            
            // AP cost + cooldown info
            if (onCooldown) {
                html += `<span style="font-size: 12px;"><span style="color: #ffcc00; font-weight: bold;">${ab.actionCost} AP</span> <span style="color: #ff6666; font-weight: bold;">CD: ${ab.cooldownRemaining}t</span></span>`;
            } else {
                html += `<span style="font-size: 12px;"><span style="color: #ffcc00; font-weight: bold;">${ab.actionCost} AP</span> <span style="color: #888;">${ab.cooldown}t CD</span></span>`;
            }
            html += `</div>`;
            
            // Description
            html += `<div style="color: #aaa; font-size: 12px; margin-bottom: 6px;">${ab.description}</div>`;
            
            // Stat requirements
            html += `<div style="font-size: 11px; margin-bottom: 4px;">`;
            html += `<span style="color: #888;">Requires: </span>`;
            const statNames = { strength: 'STR', agility: 'AGI', perception: 'PER', endurance: 'END', intelligence: 'INT' };
            const reqEntries = Object.entries(ab.statRequirements);
            for (let j = 0; j < reqEntries.length; j++) {
                const [stat, val] = reqEntries[j];
                const playerVal = player.stats[stat] || 0;
                const met = playerVal >= val;
                const color = met ? '#44ff44' : '#ff4444';
                const label = statNames[stat] || stat.toUpperCase();
                html += `<span style="color: ${color};">${label} ${val}</span>`;
                if (!met) html += ` <span style="color: #ff4444; font-size: 10px;">(${playerVal})</span>`;
                if (j < reqEntries.length - 1) html += `, `;
            }
            html += `</div>`;
            
            // Stance modifiers preview
            if (!locked) {
                const mods = ab.stanceMods;
                let modParts = [];
                if (mods.hitMod) modParts.push(`Hit ${mods.hitMod > 0 ? '+' : ''}${mods.hitMod}%`);
                if (mods.critMod) modParts.push(`Crit ${mods.critMod > 0 ? '+' : ''}${mods.critMod}%`);
                if (mods.damageMod && mods.damageMod !== 1.0) {
                    const pct = Math.round((mods.damageMod - 1) * 100);
                    modParts.push(`Dmg ${pct > 0 ? '+' : ''}${pct}%`);
                }
                if (mods.bleedMod && mods.bleedMod !== 1.0) {
                    const pct = Math.round((mods.bleedMod - 1) * 100);
                    modParts.push(`Bleed ${pct > 0 ? '+' : ''}${pct}%`);
                }
                if (mods.stunDurationBonus) modParts.push(`Stun +${mods.stunDurationBonus} turn`);
                if (mods.effectDurationBonus) modParts.push(`Duration +${mods.effectDurationBonus} turn`);
                
                if (modParts.length > 0) {
                    const modColor = ab.inPreferredStance ? '#44ff44' : '#ff8844';
                    const modLabel = ab.inPreferredStance ? 'Stance bonus' : 'Wrong stance penalty';
                    html += `<div style="font-size: 11px; color: ${modColor};">${modLabel}: ${modParts.join(', ')}</div>`;
                }
            }
            
            // Use button (only if unlocked, not on cooldown, and in combat)
            if (!locked && onCooldown) {
                html += `<div style="font-size: 11px; color: #ff6666; margin-top: 4px; font-style: italic;">On cooldown — ${ab.cooldownRemaining} turn(s) remaining</div>`;
            } else if (!locked && inCombat) {
                const needsTarget = ab.effects.targetRegion === 'choose_limb' || ab.effects.targetRegion === 'choose_leg';
                if (needsTarget) {
                    html += `<div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap;">`;
                    if (ab.effects.targetRegion === 'choose_limb') {
                        const limbs = [
                            { id: 'leftArm', label: 'L.Arm' }, { id: 'rightArm', label: 'R.Arm' },
                            { id: 'leftLeg', label: 'L.Leg' }, { id: 'rightLeg', label: 'R.Leg' }
                        ];
                        for (const limb of limbs) {
                            html += `<button class="ability-use-btn" data-ability="${ab.id}" data-limb="${limb.id}" style="background: #333; color: #fff; border: 1px solid #555; padding: 3px 8px; cursor: pointer; font-size: 11px; border-radius: 3px;">${limb.label}</button>`;
                        }
                    } else {
                        const legs = [{ id: 'leftLeg', label: 'L.Leg' }, { id: 'rightLeg', label: 'R.Leg' }];
                        for (const leg of legs) {
                            html += `<button class="ability-use-btn" data-ability="${ab.id}" data-limb="${leg.id}" style="background: #333; color: #fff; border: 1px solid #555; padding: 3px 8px; cursor: pointer; font-size: 11px; border-radius: 3px;">${leg.label}</button>`;
                        }
                    }
                    html += `</div>`;
                } else {
                    html += `<button class="ability-use-btn" data-ability="${ab.id}" style="margin-top: 6px; background: #224422; color: #44ff44; border: 1px solid #44ff44; padding: 4px 12px; cursor: pointer; font-size: 12px; font-weight: bold; border-radius: 3px;">Use [${i + 1}]</button>`;
                }
            } else if (locked) {
                html += `<div style="font-size: 11px; color: #ff4444; margin-top: 4px; font-style: italic;">Locked — stat requirements not met</div>`;
            }
            
            html += `</div>`;
        }
        
        content.innerHTML = html;
        
        // Attach event listeners to use buttons
        const buttons = content.querySelectorAll('.ability-use-btn');
        for (const btn of buttons) {
            btn.addEventListener('click', (e) => {
                const abilityId = e.target.dataset.ability;
                const targetLimb = e.target.dataset.limb || null;
                this.useAbility(abilityId, targetLimb);
            });
        }
        
        // Number key shortcuts for abilities (1-5)
        this._abilityKeyHandler = (e) => {
            const num = parseInt(e.key);
            if (num >= 1 && num <= abilities.length) {
                const ab = abilities[num - 1];
                if (ab.unlocked && inCombat && !ab.onCooldown) {
                    // If needs target selection, skip shortcut (must click)
                    if (ab.effects.targetRegion !== 'choose_limb' && ab.effects.targetRegion !== 'choose_leg') {
                        this.useAbility(ab.id, null);
                    }
                }
            }
        };
        document.addEventListener('keydown', this._abilityKeyHandler);
    }
    
    useAbility(abilityId, targetLimb) {
        if (!this.game.player || !this.game.abilitySystem) return;
        
        const enemies = this.game.combatSystem.getEngagedEnemies();
        if (enemies.length === 0) {
            this.log('No enemies in range.', 'warning');
            return;
        }
        
        // Target the closest engaged enemy
        const target = enemies[0];
        const options = {};
        if (targetLimb) options.targetLimb = targetLimb;
        
        const result = this.game.abilitySystem.resolveAbility(this.game.player, target, abilityId, options);
        
        if (!result.success) {
            this.log(`Cannot use ability: ${result.reason}`, 'warning');
            return;
        }
        
        // Log the ability use
        if (result.hit) {
            let msg = `Used ${result.abilityName}!`;
            if (result.damage > 0) {
                const parts = result.bodyParts ? result.bodyParts.map(p => p.name).join(', ') : '';
                msg += ` ${result.damage} damage${parts ? ' to ' + parts : ''}.`;
            }
            if (result.specialEffects) {
                for (const eff of result.specialEffects) {
                    if (eff.type === 'stun') msg += ` STUNNED ${eff.turns}t — skips next turn!`;
                    if (eff.type === 'guard_break') msg += ` GUARD BROKEN ${eff.turns}t — halved arm block!`;
                    if (eff.type === 'disarm') msg += ` DISARMED!`;
                    if (eff.type === 'weapon_dropped') msg += ` ${eff.weaponName} dropped on ground!`;
                    if (eff.type === 'grapple') msg += ` GRAPPLED ${eff.turns}t — suffocating!`;
                    if (eff.type === 'knock_prone') {
                        if (eff.target === 'self') msg += ` You fall prone (skip turn, +15% to be hit).`;
                        else msg += ` PRONE ${eff.turns}t — skips turn, easier to hit!`;
                    }
                    if (eff.type === 'part_destroyed') msg += ` ${eff.part} DESTROYED!`;
                    if (eff.type === 'self_damage') msg += ` Self-damage: ${eff.damage} to ${eff.part}.`;
                    if (eff.type === 'arterial_bleed') msg += ` ARTERIAL BLEED — rapid blood loss!`;
                }
            }
            this.log(msg, 'combat');
        } else {
            this.log(`${result.abilityName} missed! (ability on cooldown for ${result.actionCost ? Math.ceil(result.actionCost / 100) : '?'}t)`, 'combat');
        }
        
        // Show persistent popup with result summary
        this.showAbilityPopup(result);
        
        // Close the ability panel
        this.abilityPanelModal.classList.add('hidden');
        
        // Remove number key handler
        if (this._abilityKeyHandler) {
            document.removeEventListener('keydown', this._abilityKeyHandler);
            this._abilityKeyHandler = null;
        }
        
        // Process the turn with the ability's action cost
        this.game.processTurn({ type: 'use_ability', result });
    }
    
    /**
     * Show a persistent popup summarizing the ability result.
     * Stays visible until clearAbilityPopup() is called (on next player action).
     */
    showAbilityPopup(result) {
        if (!this.abilityPopup) return;
        
        let html = '';
        html += `<span class="popup-ability-name">${result.abilityName}</span> — `;
        
        if (result.hit) {
            html += `<span class="popup-hit">HIT</span>`;
            if (result.damage > 0) {
                html += ` <span class="popup-damage">${result.damage} dmg</span>`;
            }
            if (result.bodyParts && result.bodyParts.length > 0) {
                const parts = result.bodyParts.map(p => p.name).join(', ');
                html += ` → ${parts}`;
            }
            if (result.specialEffects && result.specialEffects.length > 0) {
                const effects = [];
                for (const eff of result.specialEffects) {
                    if (eff.type === 'stun') effects.push(`Stunned ${eff.turns}t (skip turn)`);
                    if (eff.type === 'guard_break') effects.push(`Guard broken ${eff.turns}t (halved block)`);
                    if (eff.type === 'disarm') effects.push('Disarmed!');
                    if (eff.type === 'weapon_dropped') effects.push(`${eff.weaponName} dropped`);
                    if (eff.type === 'grapple') effects.push(`Grapple ${eff.turns}t (suffocating)`);
                    if (eff.type === 'knock_prone') {
                        if (eff.target === 'self') effects.push('You: prone');
                        else effects.push(`Prone ${eff.turns}t (skip turn, +hit)`);
                    }
                    if (eff.type === 'part_destroyed') effects.push(`${eff.part} DESTROYED`);
                    if (eff.type === 'self_damage') effects.push(`Self: -${eff.damage}`);
                    if (eff.type === 'arterial_bleed') effects.push('Arterial bleed!');
                }
                if (effects.length > 0) {
                    html += ` | <span class="popup-effect">${effects.join(', ')}</span>`;
                }
            }
        } else {
            html += `<span class="popup-miss">MISS</span>`;
        }
        
        this.abilityPopup.innerHTML = html;
        this.abilityPopup.classList.remove('hidden');
    }
    
    /**
     * Clear the ability popup (called on next player action).
     */
    clearAbilityPopup() {
        if (this.abilityPopup) {
            this.abilityPopup.classList.add('hidden');
        }
    }
    
    toggleHelpScreen() {
        if (!this.helpModal) return;
        
        if (this.helpModal.classList.contains('hidden')) {
            this.showHelp();
            this.helpModal.classList.remove('hidden');
        } else {
            this.helpModal.classList.add('hidden');
        }
    }
    
    showHelp() {
        const content = document.getElementById('help-content');
        
        let html = '';
        
        // Movement
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Movement</h4>';
        html += '<div class="stat-line"><span class="stat-label">WASD / Arrow Keys:</span> <span class="stat-value">Move</span></div>';
        html += '<div class="stat-line"><span class="stat-label">Space:</span> <span class="stat-value">Wait/Skip Turn</span></div>';
        html += '<div class="stat-line"><span class="stat-label">M:</span> <span class="stat-value">Cycle mode (Walk/Run/Crouch/Prone)</span></div>';
        html += '<div class="stat-line"><span class="stat-label">< / >:</span> <span class="stat-value">Use stairs/manholes</span></div>';
        html += '<div style="color: #888; font-size: 11px; margin-top: 4px;">Running is fast but loud. Crouching is quiet. Prone is silent but very slow.</div>';
        html += '</div>';
        
        // Actions
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Actions</h4>';
        html += '<div class="stat-line"><span class="stat-label">G:</span> <span class="stat-value">Pick up item at feet</span></div>';
        html += '<div class="stat-line"><span class="stat-label">E:</span> <span class="stat-value">Interact with door/object</span></div>';
        html += '<div class="stat-line"><span class="stat-label">X:</span> <span class="stat-value">Inspect mode (move cursor with arrows)</span></div>';
        html += '<div class="stat-line"><span class="stat-label">F:</span> <span class="stat-value">Toggle explore mode (auto-walk)</span></div>';
        html += '<div class="stat-line"><span class="stat-label">Escape:</span> <span class="stat-value">Close any open window</span></div>';
        html += '</div>';
        
        // Interface
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px;">Interface</h4>';
        html += '<div class="stat-line"><span class="stat-label">I:</span> <span class="stat-value">Inventory — manage items, equip gear</span></div>';
        html += '<div class="stat-line"><span class="stat-label">C:</span> <span class="stat-value">Character sheet — stats, anatomy, wounds</span></div>';
        html += '<div class="stat-line"><span class="stat-label">V:</span> <span class="stat-value">Workshop — craft and disassemble</span></div>';
        html += '<div class="stat-line"><span class="stat-label">T:</span> <span class="stat-value">Cycle combat stance</span></div>';
        html += '<div class="stat-line"><span class="stat-label">Q:</span> <span class="stat-value">Combat abilities panel</span></div>';
        html += '<div class="stat-line"><span class="stat-label">B:</span> <span class="stat-value">Toggle combat detail overlay</span></div>';
        html += '<div class="stat-line"><span class="stat-label">?:</span> <span class="stat-value">This help screen</span></div>';
        html += '</div>';
        
        // Items & Inventory
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #ffaa00; margin-bottom: 8px;">Items & Inventory</h4>';
        html += '<div style="color: #ccc; font-size: 12px; line-height: 1.5;">';
        html += 'Walk over an item and press <span style="color: #fff;">G</span> to pick it up. ';
        html += 'Open <span style="color: #fff;">I</span> (Inventory) to manage your gear. ';
        html += 'Each item has an <span style="color: #fff;">[Actions]</span> button for equip, drop, consume, move, and more.<br><br>';
        html += 'Items have weight and volume. Clothing and backpacks have pockets with limited capacity. ';
        html += 'Watch your encumbrance — overloading slows you down.<br><br>';
        html += 'Sealed cans and bottles must be opened first. A can opener gives full yield; a knife works but spills some. ';
        html += 'Opened food spoils over time — eat it quickly.';
        html += '</div></div>';
        
        // Crafting & Disassembly
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #ffaa00; margin-bottom: 8px;">Crafting & Disassembly</h4>';
        html += '<div style="color: #ccc; font-size: 12px; line-height: 1.5;">';
        html += 'Press <span style="color: #fff;">V</span> to open the Workshop. Two tabs: <span style="color: #fff;">Disassemble</span> and <span style="color: #fff;">Craft</span>.<br><br>';
        html += '<span style="color: #ff6666;">Disassemble:</span> Break items into components. Better tools preserve quality. ';
        html += 'Hand disassembly loses 25-40% quality; a knife keeps 85-90%.<br><br>';
        html += '<span style="color: #66ff66;">Craft:</span> Combine components to build items. Recipes need specific components or properties. ';
        html += 'Some recipes show <span style="color: #ffaa00;">⚒ Craft</span> buttons for sub-recipes — click to drill down and craft intermediate parts first.<br><br>';
        html += 'Raw materials (stone, wood, glass, metal) are found in the world. ';
        html += 'Craft intermediates (Crude Blade, Wrapped Handle) from raw materials, then use those to build weapons and tools.';
        html += '</div></div>';
        
        // Combat
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #ff4444; margin-bottom: 8px;">Combat</h4>';
        html += '<div style="color: #ccc; font-size: 12px; line-height: 1.5;">';
        html += '<span style="color: #fff;">Walk into an enemy</span> to attack. Damage depends on your equipped weapon. ';
        html += 'Unarmed combat is desperate and nearly unwinnable — find a weapon first.<br><br>';
        html += 'Hits target specific body parts. Sharp weapons cause bleeding; blunt weapons stun. ';
        html += 'Vital organ hits (heart, brain, lungs) are extremely dangerous.<br><br>';
        html += 'There is no HP bar. Your condition is tracked by blood level and wounds. ';
        html += 'Wounds bleed over time and must clot naturally or be treated. ';
        html += 'Press <span style="color: #fff;">B</span> to see the combat detail overlay during fights.<br><br>';
        html += '<span style="color: #ff6666;">Combat is lethal. Avoid fights you can\'t win. Preparation matters.</span>';
        html += '</div></div>';
        
        // Survival Tips
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #44ff44; margin-bottom: 8px;">Survival Tips</h4>';
        html += '<div style="color: #ccc; font-size: 12px; line-height: 1.5;">';
        html += '• Search furniture (cabinets, lockers, crates) for supplies<br>';
        html += '• Crouch near enemies to avoid detection<br>';
        html += '• Disassemble junk items for useful components<br>';
        html += '• Craft a Shiv early — any sharp shard + cloth wrap<br>';
        html += '• Keep a light source — flashlight or lantern<br>';
        html += '• Eat opened food quickly before it spoils<br>';
        html += '• Use the right tool for disassembly to preserve quality';
        html += '</div></div>';
        
        content.innerHTML = html;
    }
    
    showGameOver(victory, causeOfDeath = null) {
        const modal = document.getElementById('character-creation');
        const form = document.getElementById('creation-form');
        
        const player = this.game.player;
        const turns = this.game.turnCount;
        
        let html = '';
        
        if (victory) {
            html += '<h2 style="color: #00ff00;">🎉 EXTRACTION SUCCESSFUL</h2>';
            html += '<div style="color: #00ffff; margin: 20px 0; font-size: 18px;">You survived the Fractured City.</div>';
        } else {
            html += '<h2 style="color: #ff4444;">💀 RUN FAILED</h2>';
            const deathCause = causeOfDeath || 'unknown causes';
            html += `<div style="color: #ff4444; margin: 20px 0; font-size: 18px;">You ${deathCause} in the Fractured City.</div>`;
        }
        
        html += '<div style="margin: 20px 0; padding: 15px; background: #1a1a1a; border: 1px solid #333;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 10px;">Run Statistics</h3>';
        html += `<div class="stat-line"><span class="stat-label">Character:</span> <span class="stat-value">${player.name}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Turns Survived:</span> <span class="stat-value">${turns}</span></div>`;
        
        // Body state at death
        const finalCond = player.anatomy.getBodyCondition();
        html += `<div class="stat-line"><span class="stat-label">Final Condition:</span> <span class="stat-value" style="color: ${finalCond.color};">${finalCond.label}</span></div>`;
        html += `<div class="stat-line"><span class="stat-label">Blood Remaining:</span> <span class="stat-value">${Math.floor(player.anatomy.blood)}%</span></div>`;
        const destroyed = player.anatomy.getDestroyedParts();
        if (destroyed.length > 0) {
            html += `<div class="stat-line"><span class="stat-label">Parts Destroyed:</span> <span class="stat-value" style="color: #ff4444;">${destroyed.join(', ')}</span></div>`;
        }
        
        html += `<div class="stat-line"><span class="stat-label">Items Carried:</span> <span class="stat-value">${player.inventory.length}</span></div>`;
        
        const enemiesKilled = this.game.world.entities.filter(e => e !== player && e.anatomy && !e.anatomy.alive).length;
        html += `<div class="stat-line"><span class="stat-label">Enemies Defeated:</span> <span class="stat-value">${enemiesKilled}</span></div>`;
        html += '</div>';
        
        html += '<button id="restart-btn" style="font-size: 16px; padding: 12px 24px;">Start New Run</button>';
        
        form.innerHTML = html;
        modal.classList.remove('hidden');
        
        document.getElementById('restart-btn').addEventListener('click', () => {
            location.reload();
        });
    }
    
    showGroundItemsModal() {
        const player = this.game.player;
        const containerSys = player.containerSystem;
        const content = document.getElementById('detailed-inventory-content');
        const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
        
        let html = '<div style="padding: 15px;">';
        html += `<button id="close-ground-modal" class="small-btn" style="margin-bottom: 10px;">← Close</button>`;
        html += `<h3 style="color: #00ffff; margin-bottom: 10px;">Items on Ground</h3>`;
        
        html += `<div style="padding: 10px; background: #1a1a1a; border: 2px solid #00ffff; max-height: 60vh; overflow-y: auto;">`;
        
        if (groundItems.length === 0) {
            html += `<div style="color: #555; font-style: italic;">Nothing here.</div>`;
        } else {
            for (let i = 0; i < groundItems.length; i++) {
                const item = groundItems[i];
                const itemWeight = containerSys.getItemWeight(item);
                const w = itemWeight >= 1000 ? `${(itemWeight/1000).toFixed(1)}kg` : `${itemWeight}g`;
                html += `<button class="small-btn" data-ground-interact="${i}" style="width: 100%; margin-bottom: 4px; text-align: left; padding: 8px;">`;
                html += `<span style="color: ${item.color || '#fff'};">${item.glyph || '*'} ${item.name}</span>`;
                html += `<span style="color: #666; font-size: 11px; float: right;">${w}</span>`;
                html += `</button>`;
            }
        }
        
        html += `</div>`;
        html += '</div>';
        
        content.innerHTML = html;
        this.detailedInventoryModal.classList.remove('hidden');
        
        document.getElementById('close-ground-modal')?.addEventListener('click', () => {
            this.detailedInventoryModal.classList.add('hidden');
        });
        
        const itemButtons = document.querySelectorAll('button[data-ground-interact]');
        itemButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.groundInteract);
                const items = this.game.world.getItemsAt(player.x, player.y, player.z);
                const item = items[index];
                if (item) {
                    this.showActionsModal(item, 'actions-ground-interact', { index });
                }
            });
        });
    }
    
    showActionsModal(item, sourceType, sourceData) {
        const player = this.game.player;
        const content = document.getElementById('detailed-inventory-content');
        
        let html = '<div style="padding: 20px;">';
        html += `<button id="close-actions-modal" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
        html += `<h3 style="color: #00ffff; margin-bottom: 15px;">Actions: ${item.name}</h3>`;
        
        html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #444; margin-bottom: 15px;">`;
        
        // Always available actions
        html += `<div style="margin-bottom: 10px;">`;
        html += `<button class="small-btn" data-item-action="inspect" style="width: 100%; margin-bottom: 5px;">Inspect</button>`;
        html += `<button class="small-btn" data-item-action="move" style="width: 100%; margin-bottom: 5px;">Move</button>`;
        html += `<button class="small-btn" data-item-action="drop" style="width: 100%; margin-bottom: 5px;">Drop</button>`;
        html += `<button class="small-btn" data-item-action="throw" style="width: 100%; margin-bottom: 5px; opacity: 0.5;" disabled>Throw (Coming Soon)</button>`;
        html += `</div>`;
        
        // Context-aware actions
        let hasContextActions = false;
        
        // Toggle on/off for light-emitting items
        if (item.lightRadius) {
            if (!hasContextActions) {
                html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                hasContextActions = true;
            }
            const isOn = !item.state || item.state.active !== false;
            const toggleLabel = isOn ? 'Turn Off' : 'Turn On';
            const toggleColor = isOn ? '#ff4444' : '#44ff44';
            html += `<button class="small-btn" data-item-action="toggle-light" style="width: 100%; margin-bottom: 5px; background: ${toggleColor}; color: #000;">${toggleLabel}</button>`;
        }
        
        // Check for openable containers
        if (item.state && !item.state.opened && item.openMethods) {
            if (!hasContextActions) {
                html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                hasContextActions = true;
            }
            html += `<button class="small-btn" data-item-action="open" style="width: 100%; margin-bottom: 5px;">Open</button>`;
        }
        
        // Check for resealable opened containers (bottles only, not cans)
        if (item.state && item.state.opened && item.tags && item.tags.includes('plastic') && !item.tags.includes('metal')) {
            if (!hasContextActions) {
                html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                hasContextActions = true;
            }
            html += `<button class="small-btn" data-item-action="reseal" style="width: 100%; margin-bottom: 5px;">Reseal</button>`;
        }
        
        // Check for consumable food/drink
        if ((item.type === 'food' || item.type === 'drink') && item.nutrition) {
            if (!hasContextActions) {
                html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                hasContextActions = true;
            }
            const quantityText = item.quantity ? ` (${item.quantity}${item.quantityUnit})` : '';
            const contaminatedWarning = item.state && item.state.contaminated ? ' ⚠' : '';
            html += `<button class="small-btn" data-item-action="consume" style="width: 100%; margin-bottom: 5px;">Consume${quantityText}${contaminatedWarning}</button>`;
        }
        
        // Legacy consumable actions
        if (item.actions && item.actions.length > 0) {
            for (const action of item.actions) {
                if (action === 'use' && item.type === 'consumable') {
                    if (!hasContextActions) {
                        html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                        html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                        hasContextActions = true;
                    }
                    html += `<button class="small-btn" data-item-action="use" style="width: 100%; margin-bottom: 5px;">Use ${item.name}</button>`;
                }
            }
        }
        
        // Disassemble action for items with components
        if (item.components && item.components.length > 0) {
            if (!hasContextActions) {
                html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                hasContextActions = true;
            }
            html += `<button class="small-btn" data-item-action="disassemble" style="width: 100%; margin-bottom: 5px; background: #ff8800; color: #000;">🔧 Disassemble</button>`;
        }
        
        if (hasContextActions) {
            html += `</div>`;
        }
        
        html += `</div>`;
        html += '</div>';
        
        content.innerHTML = html;
        
        // Store context for action handlers
        this.actionsContext = { item, sourceType, sourceData };
        
        // Attach event listeners
        document.getElementById('close-actions-modal')?.addEventListener('click', () => {
            if (sourceType === 'actions-furniture' && this.furnitureContext) {
                // Go back to furniture contents modal
                showFurnitureContentsModal(this, this.furnitureContext);
            } else if (sourceType === 'actions-ground-interact') {
                // Go back to ground items modal
                this.showGroundItemsModal();
            } else {
                this.showDetailedInventory();
            }
        });
        
        const actionButtons = document.querySelectorAll('button[data-item-action]');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.itemAction;
                this.handleItemAction(action);
            });
        });
    }
    
    handleItemAction(action) {
        if (!this.actionsContext) return;
        
        const { item, sourceType, sourceData } = this.actionsContext;
        
        if (action === 'inspect') {
            this.showInspectModal(item);
        } else if (action === 'move') {
            // Convert sourceType from 'actions-equipped' to 'equipped' format
            let moveSourceType = sourceType.replace('actions-', '');
            if (moveSourceType === 'pocket-item') moveSourceType = 'pocket';
            if (moveSourceType === 'container-item') moveSourceType = 'container-item';
            if (moveSourceType === 'furniture') moveSourceType = 'furniture';
            if (moveSourceType === 'ground-interact') moveSourceType = 'ground';
            this.showMoveModal(moveSourceType, sourceData);
        } else if (action === 'drop') {
            this.handleDropAction(item, sourceType, sourceData);
        } else if (action === 'throw') {
            this.handleThrowAction(item, sourceType, sourceData);
        } else if (action === 'use') {
            this.handleUseAction(item, sourceType, sourceData);
        } else if (action === 'open') {
            this.showOpenToolSelection(item, sourceType, sourceData);
        } else if (action === 'consume') {
            this.handleConsumeAction(item, sourceType, sourceData);
        } else if (action === 'reseal') {
            this.handleResealAction(item, sourceType, sourceData);
        } else if (action === 'disassemble') {
            this.showDisassembleModal(item, sourceType, sourceData);
        } else if (action === 'toggle-light') {
            if (!item.state) item.state = {};
            item.state.active = item.state.active === false ? true : false;
            const status = item.state.active ? 'on' : 'off';
            this.game.ui.log(`Turned ${item.name} ${status}.`, 'info');
            this.game.render();
            this.showActionsModal(item, sourceType, sourceData);
        }
    }
    
    handleDropAction(item, sourceType, sourceData) {
        const player = this.game.player;
        
        // Remove item from source
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
            this.game.world.removeItem(item);
        } else if (sourceType === 'actions-furniture') {
            const furniture = this.game.world.worldObjects.find(o => o.id === sourceData.furnitureId);
            if (furniture && furniture.pockets && furniture.pockets[sourceData.pocketIndex]) {
                furniture.pockets[sourceData.pocketIndex].contents.splice(sourceData.itemIndex, 1);
            }
        } else if (sourceType === 'actions-pocket-item') {
            const container = this.findContainerById(sourceData.containerId);
            if (container && container.pockets && container.pockets[sourceData.pocketIndex]) {
                const pocket = container.pockets[sourceData.pocketIndex];
                pocket.contents.splice(sourceData.itemIndex, 1);
            }
            const invIndex = player.inventory.indexOf(item);
            if (invIndex !== -1) player.inventory.splice(invIndex, 1);
        } else if (sourceType === 'actions-container-item') {
            let container = this.findContainerById(sourceData.containerId);
            
            if (container && container.contents && container.contents[sourceData.itemIndex]) {
                container.contents.splice(sourceData.itemIndex, 1);
            }
        }
        
        // Drop to ground
        item.x = player.x;
        item.y = player.y;
        item.z = player.z;
        this.game.world.addItem(item);
        
        this.game.ui.log(`Dropped ${item.name}.`, 'info');
        this.actionsContext = null;
        this.showDetailedInventory();
        this.updatePanels();
    }
    
    handleThrowAction(item, sourceType, sourceData) {
        this.game.ui.log('Throwing not yet implemented.', 'info');
    }
    
    handleUseAction(item, sourceType, sourceData) {
        const player = this.game.player;
        
        if (item.type === 'consumable' && item.healAmount) {
            // Calculate heal per turn
            let healPerTurn = Math.floor(item.healAmount / item.healDuration);
            
            // Apply slowHealer trait modifier
            if (player.traitEffects && player.traitEffects.healingMod) {
                healPerTurn = Math.floor(healPerTurn * player.traitEffects.healingMod);
            }
            
            // Add heal-over-time effect
            player.addStatusEffect({
                type: 'heal',
                value: healPerTurn,
                duration: item.healDuration,
                name: item.name
            });
            
            this.game.ui.log(`Used ${item.name}. Healing ${healPerTurn}/turn for ${item.healDuration} turns (restores blood, patches wounds).`, 'info');
            
            // Remove item from source
            if (sourceType === 'actions-stored') {
                const storedItems = player.containerSystem.getAllStoredItems(player);
                const stored = storedItems[sourceData.index];
                if (stored) {
                    player.containerSystem.removeItem(stored.container, item, stored.pocketIndex);
                    const invIndex = player.inventory.indexOf(item);
                    if (invIndex !== -1) player.inventory.splice(invIndex, 1);
                }
            } else if (sourceType === 'actions-ground' || sourceType === 'actions-ground-interact') {
                this.game.world.removeItem(item);
            } else if (sourceType === 'actions-furniture') {
                const furniture = this.game.world.worldObjects.find(o => o.id === sourceData.furnitureId);
                if (furniture && furniture.pockets && furniture.pockets[sourceData.pocketIndex]) {
                    furniture.pockets[sourceData.pocketIndex].contents.splice(sourceData.itemIndex, 1);
                }
            } else if (sourceType === 'actions-pocket-item') {
                const container = this.findContainerById(sourceData.containerId);
                if (container && container.pockets && container.pockets[sourceData.pocketIndex]) {
                    const pocket = container.pockets[sourceData.pocketIndex];
                    pocket.contents.splice(sourceData.itemIndex, 1);
                }
                const invIndex = player.inventory.indexOf(item);
                if (invIndex !== -1) player.inventory.splice(invIndex, 1);
            }
            
            this.actionsContext = null;
            this.showDetailedInventory();
            this.updatePanels();
        }
    }
    
    showOpenToolSelection(item, sourceType, sourceData) {
        const player = this.game.player;
        const content = document.getElementById('detailed-inventory-content');
        const tools = this.game.itemSystem.getAvailableOpeningTools(player, item);
        
        let html = '<div style="padding: 20px;">';
        html += `<button id="close-tool-selection" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
        html += `<h3 style="color: #00ffff; margin-bottom: 15px;">Open: ${item.name}</h3>`;
        
        html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #444; margin-bottom: 15px;">`;
        html += `<div style="color: #888; margin-bottom: 10px;">Choose tool to open:</div>`;
        
        for (const tool of tools) {
            const yieldPercent = Math.floor(tool.yield * 100);
            const spillPercent = 100 - yieldPercent;
            const durabilityWarning = tool.durabilityDamage > 0 ? ` (-${tool.durabilityDamage} durability)` : '';
            
            html += `<button class="small-btn" data-open-tool="${tool.type}" style="width: 100%; margin-bottom: 8px; text-align: left;">`;
            html += `<div>${tool.name}</div>`;
            html += `<div style="font-size: 12px; color: #888;">${yieldPercent}% yield, ${spillPercent}% spills${durabilityWarning}</div>`;
            html += `</button>`;
        }
        
        html += `</div>`;
        html += '</div>';
        
        content.innerHTML = html;
        
        document.getElementById('close-tool-selection')?.addEventListener('click', () => {
            this.showActionsModal(item, sourceType, sourceData);
        });
        
        const toolButtons = document.querySelectorAll('button[data-open-tool]');
        toolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const toolType = btn.dataset.openTool;
                const selectedTool = tools.find(t => t.type === toolType);
                this.handleOpenAction(item, selectedTool, sourceType, sourceData);
            });
        });
    }
    
    handleOpenAction(item, tool, sourceType, sourceData) {
        const player = this.game.player;
        const result = this.game.itemSystem.openContainer(item, tool, player);
        
        if (result.success) {
            this.game.ui.log(result.message, 'info');
            
            if (result.spilledItems && result.spilledItems.length > 0) {
                for (const spilledItem of result.spilledItems) {
                    this.game.world.addItem(spilledItem);
                    this.game.ui.log(`${spilledItem.quantity}${spilledItem.quantityUnit} of ${spilledItem.name} spilled on the ground.`, 'warning');
                }
            }
            
            this.actionsContext = null;
            this.showDetailedInventory();
            this.updatePanels();
        } else {
            this.game.ui.log(result.message, 'warning');
        }
    }
    
    handleConsumeAction(item, sourceType, sourceData) {
        const player = this.game.player;
        
        // Check if item is in a sealed container
        if (sourceType === 'actions-container-item') {
            // Find the container
            let container = this.findContainerById(sourceData.containerId);
            
            // Check if container is sealed
            if (container && container.state && container.state.sealed) {
                this.game.ui.log('You must open the container first.', 'warning');
                return;
            }
        }
        
        if (item.state && item.state.contaminated) {
            const content = document.getElementById('detailed-inventory-content');
            let html = '<div style="padding: 20px;">';
            html += `<h3 style="color: #ff8800; margin-bottom: 15px;">⚠ Warning</h3>`;
            html += `<div style="padding: 15px; background: #1a1a1a; border: 2px solid #ff8800; margin-bottom: 15px;">`;
            html += `<div style="color: #ff8800; margin-bottom: 10px;">This food is contaminated!</div>`;
            html += `<div style="color: #888; margin-bottom: 15px;">Eating contaminated food may cause sickness.</div>`;
            html += `<button id="confirm-consume" class="small-btn" style="width: 100%; margin-bottom: 5px; background: #ff8800;">Eat Anyway</button>`;
            html += `<button id="cancel-consume" class="small-btn" style="width: 100%;">Cancel</button>`;
            html += `</div></div>`;
            
            content.innerHTML = html;
            
            document.getElementById('confirm-consume')?.addEventListener('click', () => {
                this.executeConsumeAction(item, sourceType, sourceData);
            });
            
            document.getElementById('cancel-consume')?.addEventListener('click', () => {
                this.showActionsModal(item, sourceType, sourceData);
            });
        } else {
            this.executeConsumeAction(item, sourceType, sourceData);
        }
    }
    
    executeConsumeAction(item, sourceType, sourceData) {
        const player = this.game.player;
        const result = this.game.itemSystem.consumeFood(item, player);
        
        if (result.success) {
            const quantityText = result.consumed ? `${result.consumed}${item.quantityUnit} of ` : '';
            this.game.ui.log(`Consumed ${quantityText}${item.name}.`, 'info');
            
            if (result.contaminated) {
                this.game.ui.log('You feel sick from eating contaminated food...', 'warning');
            }
            
            if (result.remaining <= 0) {
                this.removeItemFromSource(item, sourceType, sourceData);
            }
            
            this.actionsContext = null;
            this.showDetailedInventory();
            this.updatePanels();
        } else {
            this.game.ui.log(result.message, 'warning');
        }
    }
    
    handleResealAction(item, sourceType, sourceData) {
        if (!item.state || !item.state.opened) {
            this.game.ui.log('Container is not opened.', 'warning');
            return;
        }
        
        // Reseal the container
        item.state.opened = false;
        item.state.sealed = true;
        
        // Update container name to show sealed status
        item.name = item.name.replace('Opened', 'Sealed');
        
        this.game.ui.log(`Resealed ${item.name}.`, 'info');
        this.actionsContext = null;
        this.showDetailedInventory();
        this.updatePanels();
    }
    
    removeItemFromSource(item, sourceType, sourceData) {
        const player = this.game.player;
        
        if (sourceType === 'actions-stored') {
            const storedItems = player.containerSystem.getAllStoredItems(player);
            const stored = storedItems[sourceData.index];
            if (stored) {
                player.containerSystem.removeItem(stored.container, item, stored.pocketIndex);
                const invIndex = player.inventory.indexOf(item);
                if (invIndex !== -1) player.inventory.splice(invIndex, 1);
            }
        } else if (sourceType === 'actions-ground' || sourceType === 'actions-ground-interact') {
            this.game.world.removeItem(item);
        } else if (sourceType === 'actions-furniture') {
            const furniture = this.game.world.worldObjects.find(o => o.id === sourceData.furnitureId);
            if (furniture && furniture.pockets && furniture.pockets[sourceData.pocketIndex]) {
                furniture.pockets[sourceData.pocketIndex].contents.splice(sourceData.itemIndex, 1);
            }
        } else if (sourceType === 'actions-pocket-item') {
            const container = this.findContainerById(sourceData.containerId);
            if (container && container.pockets && container.pockets[sourceData.pocketIndex]) {
                const pocket = container.pockets[sourceData.pocketIndex];
                pocket.contents.splice(sourceData.itemIndex, 1);
            }
            const invIndex = player.inventory.indexOf(item);
            if (invIndex !== -1) player.inventory.splice(invIndex, 1);
        } else if (sourceType === 'actions-container-item') {
            let container = this.findContainerById(sourceData.containerId);
            
            if (container && container.contents && container.contents[sourceData.itemIndex]) {
                container.contents.splice(sourceData.itemIndex, 1);
            }
        }
    }
    
    /**
     * Find a container item by ID across all player locations
     */
    findContainerById(containerId) {
        const player = this.game.player;
        let container = player.inventory.find(i => i.id === containerId);
        if (!container && player.equipment.head?.id === containerId) container = player.equipment.head;
        if (!container && player.equipment.torso?.id === containerId) container = player.equipment.torso;
        if (!container && player.equipment.legs?.id === containerId) container = player.equipment.legs;
        if (!container && player.equipment.back?.id === containerId) container = player.equipment.back;
        if (!container && player.equipment.rightHand?.id === containerId) container = player.equipment.rightHand;
        if (!container && player.equipment.leftHand?.id === containerId) container = player.equipment.leftHand;
        if (!container && player.carrying?.leftHand?.id === containerId) container = player.carrying.leftHand;
        if (!container && player.carrying?.rightHand?.id === containerId) container = player.carrying.rightHand;
        if (!container) {
            const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
            container = groundItems.find(i => i.id === containerId);
        }
        return container;
    }
    
    showStaircaseInspection(stairTile) {
        const content = document.getElementById('detailed-inventory-content');
        
        let html = '';
        
        // Side-by-side layout: Staircase details on left, Ground on right
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">';
        
        // Left column: Staircase details
        html += '<div style="border-right: 2px solid #333; padding-right: 15px;">';
        html += '<h3 style="color: #ffff00; margin-bottom: 15px; font-size: 20px;">Staircase</h3>';
        
        // Staircase info box
        html += '<div style="margin-bottom: 20px; padding: 15px; background: #1a1a1a; border: 2px solid #ffff00;">';
        html += `<div style="text-align: center; font-size: 48px; color: #ffff00; margin-bottom: 10px;">${stairTile.glyph}</div>`;
        html += `<div style="color: #ffff00; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px;">${stairTile.name}</div>`;
        
        // Properties
        html += '<div style="margin-top: 15px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px; font-size: 16px;">Properties</h4>';
        html += '<div style="font-size: 15px; color: #aaa; line-height: 1.6;">';
        html += `<div>Material: <span style="color: #fff;">Concrete & Steel</span></div>`;
        html += `<div>Durability: <span style="color: #fff;">100%</span></div>`;
        html += `<div>Blocked: <span style="color: #fff;">${stairTile.blocked ? 'Yes' : 'No'}</span></div>`;
        html += '</div>';
        html += '</div>';
        
        html += '</div>';
        
        // Actions
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 10px; font-size: 16px;">Actions</h4>';
        
        if (stairTile.canAscend) {
            html += '<button class="action-btn" data-stair-action="ascend" style="width: 100%; margin-bottom: 10px; padding: 12px; background: #2a4a2a; border: 2px solid #00ff00; color: #00ff00; font-size: 16px; cursor: pointer;">↑ Ascend Stairs</button>';
        }
        
        if (stairTile.canDescend) {
            html += '<button class="action-btn" data-stair-action="descend" style="width: 100%; margin-bottom: 10px; padding: 12px; background: #4a2a2a; border: 2px solid #ff8800; color: #ff8800; font-size: 16px; cursor: pointer;">↓ Descend Stairs</button>';
        }
        
        html += '</div>';
        
        html += '</div>';
        
        // Right column: Ground items
        html += '<div style="padding-left: 15px;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 15px; font-size: 20px;">Ground</h3>';
        html += this.renderGroundTab(this.game.player, this.game.player.containerSystem);
        html += '</div>';
        
        html += '</div>';
        
        content.innerHTML = html;
        
        // Attach stair action listeners
        const stairButtons = document.querySelectorAll('button[data-stair-action]');
        stairButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-stair-action');
                this.handleStairAction(action);
            });
        });
        
        // Also attach ground item listeners
        this.attachInventoryEventListeners();
    }
    
    handleStairAction(action) {
        const player = this.game.player;
        
        if (action === 'ascend') {
            player.z++;
            this.game.ui.log(`You climb the stairs up to level ${player.z}.`, 'info');
        } else if (action === 'descend') {
            player.z--;
            this.game.ui.log(`You climb the stairs down to level ${player.z}.`, 'info');
        }
        
        // Close modal and update view
        this.detailedInventoryModal.classList.add('hidden');
        this.game.processTurn({ type: 'wait' }); // Use a turn for climbing stairs
    }
    
    showManholeInspection(manholeTile) {
        const content = document.getElementById('detailed-inventory-content');
        
        let html = '';
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">';
        
        // Left column: Manhole details
        html += '<div style="border-right: 2px solid #333; padding-right: 15px;">';
        html += '<h3 style="color: #ffff00; margin-bottom: 15px; font-size: 20px;">Manhole Cover</h3>';
        
        html += '<div style="margin-bottom: 20px; padding: 15px; background: #1a1a1a; border: 2px solid #ffff00;">';
        html += `<div style="text-align: center; font-size: 48px; color: #ffff00; margin-bottom: 10px;">${manholeTile.glyph}</div>`;
        html += `<div style="color: #ffff00; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px;">${manholeTile.name}</div>`;
        
        html += '<div style="margin-top: 15px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px; font-size: 16px;">Description</h4>';
        html += '<div style="font-size: 15px; color: #aaa; line-height: 1.6;">';
        html += '<div>A heavy metal cover providing access to the sewer system below.</div>';
        html += '</div></div></div>';
        
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 10px; font-size: 16px;">Actions</h4>';
        html += '<button class="action-btn" data-manhole-action="descend" style="width: 100%; margin-bottom: 10px; padding: 12px; background: #4a2a2a; border: 2px solid #ff8800; color: #ff8800; font-size: 16px; cursor: pointer;">↓ Climb Down Into Sewers</button>';
        html += '</div></div>';
        
        // Right column: Ground items
        html += '<div style="padding-left: 15px;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 15px; font-size: 20px;">Ground</h3>';
        html += this.renderGroundTab(this.game.player, this.game.player.containerSystem);
        html += '</div></div>';
        
        content.innerHTML = html;
        
        const manholeButtons = document.querySelectorAll('button[data-manhole-action]');
        manholeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-manhole-action');
                this.handleManholeAction(action);
            });
        });
        
        this.attachInventoryEventListeners();
    }
    
    showLadderInspection(ladderTile) {
        const content = document.getElementById('detailed-inventory-content');
        
        let html = '';
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">';
        
        // Left column: Ladder details
        html += '<div style="border-right: 2px solid #333; padding-right: 15px;">';
        html += '<h3 style="color: #888888; margin-bottom: 15px; font-size: 20px;">Ladder</h3>';
        
        html += '<div style="margin-bottom: 20px; padding: 15px; background: #1a1a1a; border: 2px solid #888888;">';
        html += `<div style="text-align: center; font-size: 48px; color: #888888; margin-bottom: 10px;">${ladderTile.glyph}</div>`;
        html += `<div style="color: #888888; font-size: 18px; font-weight: bold; text-align: center; margin-bottom: 15px;">${ladderTile.name}</div>`;
        
        html += '<div style="margin-top: 15px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 8px; font-size: 16px;">Description</h4>';
        html += '<div style="font-size: 15px; color: #aaa; line-height: 1.6;">';
        html += '<div>A rusty metal ladder leading up to the surface.</div>';
        html += '</div></div></div>';
        
        html += '<div style="margin-bottom: 20px;">';
        html += '<h4 style="color: #00ffff; margin-bottom: 10px; font-size: 16px;">Actions</h4>';
        html += '<button class="action-btn" data-ladder-action="ascend" style="width: 100%; margin-bottom: 10px; padding: 12px; background: #2a4a2a; border: 2px solid #00ff00; color: #00ff00; font-size: 16px; cursor: pointer;">↑ Climb Up To Surface</button>';
        html += '</div></div>';
        
        // Right column: Ground items
        html += '<div style="padding-left: 15px;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 15px; font-size: 20px;">Ground</h3>';
        html += this.renderGroundTab(this.game.player, this.game.player.containerSystem);
        html += '</div></div>';
        
        content.innerHTML = html;
        
        const ladderButtons = document.querySelectorAll('button[data-ladder-action]');
        ladderButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-ladder-action');
                this.handleLadderAction(action);
            });
        });
        
        this.attachInventoryEventListeners();
    }
    
    handleManholeAction(action) {
        const player = this.game.player;
        
        if (action === 'descend') {
            player.z = -1;
            this.game.ui.log('You climb down the ladder into the dark sewers.', 'info');
        }
        
        this.detailedInventoryModal.classList.add('hidden');
        this.game.processTurn({ type: 'wait' });
    }
    
    handleLadderAction(action) {
        const player = this.game.player;
        
        if (action === 'ascend') {
            player.z = 0;
            this.game.ui.log('You climb up the ladder to the surface.', 'info');
        }
        
        this.detailedInventoryModal.classList.add('hidden');
        this.game.processTurn({ type: 'wait' });
    }
}
