import { showDisassembleModal } from './DisassembleModal.js';
import { showCraftingUI } from './CraftingUI.js';
import { showWorldObjectModal, showFurnitureContentsModal } from './WorldObjectModal.js';
import { Anatomy } from '../entities/Anatomy.js';
import { getPropertyLabel, PROPERTY_LABELS } from '../content/ContentManager.js';
import { TalentEffects, TALENT_TREES, TALENT_NODES } from '../content/TalentCatalog.js';

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
        
        // Combat stance (only shown if at least one stance is unlocked)
        const stance = player.getStance();
        if (stance) {
            html += `<div class="stat-line"><span class="stat-label">Stance:</span> <span class="stat-value" style="color: ${stance.color}; font-weight: bold;">${stance.name}</span></div>`;
        } else {
            html += `<div class="stat-line"><span class="stat-label">Stance:</span> <span class="stat-value" style="color: #666;">None — unlock via Talents [Q]</span></div>`;
        }
        
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
    
    updateOverworldPanel() {
        const ow   = this.game.overworldMap;
        const tile = ow ? ow.getCurrentTile() : null;

        // ── Character panel: player name + background ──────────────────────
        if (this.characterPanel && this.game.player) {
            const p = this.game.player;
            let html = `<h4 style="color:#00ff88;margin-bottom:8px;border-bottom:2px solid #00ff88;padding-bottom:5px;">OPERATIVE</h4>`;
            html += `<div class="stat-line"><span class="stat-label">Name:</span> <span class="stat-value" style="color:#ffffff;">${p.name || 'Unknown'}</span></div>`;
            const bgName = p.backgroundId ? p.backgroundId.replace(/([A-Z])/g, ' $1').trim() : '—';
            html += `<div class="stat-line"><span class="stat-label">Background:</span> <span class="stat-value" style="color:#ffcc44;">${bgName}</span></div>`;
            this.characterPanel.innerHTML = html;
        }

        // ── Location panel: overworld tile info ────────────────────────────
        if (this.locationPanel && tile) {
            const biomeColors = {
                urban_core:'#00ccff', suburbs:'#88cc44', industrial:'#cc8800',
                rich_neighborhood:'#ddaa44', rural:'#aa8855', forest:'#44aa44', ruins:'#888888'
            };
            const biomeColor = biomeColors[tile.biome] || '#aaaaaa';
            const biomeLabel = tile.biome.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const threatColor = ['#448844','#888844','#aa7722','#cc4422','#ff2222'][tile.threatLevel - 1] || '#888888';
            const stars = '★'.repeat(tile.threatLevel) + '☆'.repeat(5 - tile.threatLevel);

            let html = `<h4 style="color:#ffaa00;margin-bottom:8px;border-bottom:2px solid #ffaa00;padding-bottom:5px;">OVERWORLD</h4>`;
            html += `<div class="stat-line"><span class="stat-label">Zone:</span> <span class="stat-value" style="color:#ffffff;">${tile.zone.name}</span></div>`;
            html += `<div class="stat-line"><span class="stat-label">Biome:</span> <span class="stat-value" style="color:${biomeColor};">${biomeLabel}</span></div>`;
            html += `<div class="stat-line"><span class="stat-label">Threat:</span> <span class="stat-value" style="color:${threatColor};">${stars}</span></div>`;
            html += `<div class="stat-line"><span class="stat-label">Size:</span> <span class="stat-value" style="color:#888888;">${tile.zone.width}×${tile.zone.height}</span></div>`;
            html += `<div class="stat-line"><span class="stat-label">Coords:</span> <span class="stat-value" style="color:#666666;">(${ow.cursorCol}, ${ow.cursorRow})</span></div>`;
            if (tile.explored) {
                html += `<div class="stat-line" style="margin-top:6px;"><span class="stat-value" style="color:#00ff88;">✓ Visited</span></div>`;
            }
            this.locationPanel.innerHTML = html;
        } else if (this.locationPanel) {
            this.locationPanel.innerHTML = '<div style="color:#666;">No tile data</div>';
        }

        // ── Context panel: controls hint ───────────────────────────────────
        if (this.contextPanel) {
            const hasActiveZone = !!this.game.world;
            const ow = this.game.overworldMap;
            const onActiveZone = ow && hasActiveZone &&
                ow.cursorCol === this.game._currentZoneCol &&
                ow.cursorRow === this.game._currentZoneRow;

            let html = `<h4 style="color:#aaaaaa;margin-bottom:8px;border-bottom:2px solid #555555;padding-bottom:5px;">CONTROLS</h4>`;
            html += `<div style="color:#888888;font-size:13px;line-height:1.8;">`;
            html += `<div><span style="color:#ffcc44;">WASD / Arrows</span> — Move cursor</div>`;
            if (onActiveZone) {
                html += `<div><span style="color:#00ff88;">Enter / Tab</span> — Return to zone</div>`;
            } else if (hasActiveZone) {
                html += `<div><span style="color:#ffcc44;">Enter</span> — Travel here</div>`;
                html += `<div><span style="color:#00ff88;">Tab</span> — Return to zone</div>`;
            } else {
                html += `<div><span style="color:#ffcc44;">Enter / Space</span> — Enter zone</div>`;
            }
            html += `</div>`;
            this.contextPanel.innerHTML = html;
        }
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

        this._cg = {
            name: 'Survivor',
            gender: 'other',
            bg: null,
            stats: { strength: 10, agility: 10, endurance: 10, intelligence: 10, perception: 10 },
            statBudget: 50,
            talentBudget: 6,
            selectedTalents: [],
            selectedDrawbacks: [],
            activeTab: 'combat_tactics'
        };

        form.innerHTML = `<div class="cg-layout">
            <div class="cg-col cg-left"  id="cg-col-left"></div>
            <div class="cg-col cg-center" id="cg-col-center" style="display:flex;flex-direction:column;"></div>
            <div class="cg-col cg-right"  id="cg-col-right"></div>
        </div>`;

        modal.classList.remove('hidden');
        this._cgRefresh();
    }

    _cgRefresh() {
        this._cgRenderLeft();
        this._cgRenderCenter();
        this._cgRenderRight();
    }

    _cgPoints() {
        const charSys = this.game.charCreationSystem;
        let pts = this._cg.talentBudget;
        for (const tid of this._cg.selectedTalents) {
            const node = TALENT_NODES[tid];
            if (node) pts -= node.cost;
        }
        for (const did of this._cg.selectedDrawbacks) {
            const t = charSys.traits[did];
            if (t) pts += Math.abs(t.cost);
        }
        return pts;
    }

    _cgStatTotal() {
        return Object.values(this._cg.stats).reduce((a, b) => a + b, 0);
    }

    _cgRandomName() {
        const first = ['Raze','Cipher','Vex','Nyx','Kade','Zara','Jax','Nova','Ash','Rook','Blade','Echo','Hex','Sable','Wraith','Drift','Lace','Torque','Grit','Flux'];
        const last  = ['Chrome','Steel','Volt','Neon','Razor','Ghost','Wire','Byte','Shade','Spark','Edge','Frost','Blaze','Storm','Void','Mortem','Scar','Vein','Recoil','Creek'];
        return `${first[Math.floor(Math.random()*first.length)]} ${last[Math.floor(Math.random()*last.length)]}`;
    }

    _cgRenderLeft() {
        const col = document.getElementById('cg-col-left');
        if (!col) return;
        const cg = this._cg;
        const charSys = this.game.charCreationSystem;
        const bgData = cg.bg ? charSys.getBackground(cg.bg) : null;
        const bgMods = bgData?.statMods || {};
        const statTotal = this._cgStatTotal();
        const statNames = { strength:'STR', agility:'AGI', endurance:'END', intelligence:'INT', perception:'PER' };

        let html = `<div class="cg-section">
            <div class="cg-section-title">Identity</div>
            <div style="display:flex;gap:5px;margin-bottom:6px;">
                <input type="text" id="cg-name" value="${cg.name}" class="cg-input" style="flex:1;" />
                <button id="cg-rnd" class="cg-btn" style="padding:6px 8px;">&#9856;</button>
            </div>
            <select id="cg-gender" class="cg-input">
                <option value="male"${cg.gender==='male'?' selected':''}>Male</option>
                <option value="female"${cg.gender==='female'?' selected':''}>Female</option>
                <option value="other"${cg.gender==='other'?' selected':''}>Other / Unspecified</option>
            </select>
        </div>`;

        html += `<div class="cg-section">
            <div class="cg-section-title">Background</div>`;
        for (const bg of charSys.getAllBackgrounds()) {
            const sel = cg.bg === bg.id;
            const modStr = Object.entries(bg.statMods).map(([s,v])=>`${s.toUpperCase().slice(0,3)} ${v>0?'+':''}${v}`).join(' ');
            const freeTalentNames = (bg.startingTalents||[]).map(t=>TALENT_NODES[t]?.name||t).join(', ');
            html += `<div class="cg-bg-card${sel?' selected':''}" data-bg="${bg.id}">
                <div class="cg-bg-name">${bg.name}</div>
                <div class="cg-bg-desc">${bg.description}</div>
                <div class="cg-bg-mods">${modStr}</div>
                ${bg.gearLabel ? `<div style="color:#88aacc;font-size:10px;margin-top:2px;">Gear: ${bg.gearLabel}</div>` : ''}
                ${freeTalentNames ? `<div class="cg-bg-talents">Free: ${freeTalentNames}</div>` : ''}
            </div>`;
        }
        html += `</div>`;

        const budgetColor = statTotal===50 ? '#44ff44' : statTotal>50 ? '#ff4444' : '#ffaa00';
        html += `<div class="cg-section">
            <div class="cg-section-title">
                <span>Attributes</span>
                <span id="cg-stat-badge" style="color:${budgetColor};">${statTotal}/50</span>
            </div>`;
        for (const [key, label] of Object.entries(statNames)) {
            const val = cg.stats[key];
            const mod = bgMods[key] || 0;
            const eff = val + mod;
            const modStr = mod!==0 ? ` <span style="color:${mod>0?'#44ff44':'#ff4444'};font-size:10px;">${mod>0?'+':''}${mod}</span>` : '';
            html += `<div class="cg-stat-row">
                <span class="cg-stat-name">${label}</span>
                <button class="cg-stat-btn" data-stat="${key}" data-dir="-1">&#8722;</button>
                <span class="cg-stat-val">${eff}${modStr}</span>
                <button class="cg-stat-btn" data-stat="${key}" data-dir="1">+</button>
            </div>`;
        }
        html += `<div style="font-size:10px;color:#555;margin-top:4px;">Base ${statTotal-50>=0?'+':''} before background mods shown above</div>
        </div>`;

        col.innerHTML = html;

        document.getElementById('cg-name').oninput = e => { this._cg.name = e.target.value; this._cgRenderRight(); };
        document.getElementById('cg-rnd').onclick  = () => { this._cg.name = this._cgRandomName(); document.getElementById('cg-name').value = this._cg.name; this._cgRenderRight(); };
        document.getElementById('cg-gender').onchange = e => { this._cg.gender = e.target.value; this._cgRenderRight(); };

        col.querySelectorAll('.cg-bg-card').forEach(card => {
            card.onclick = () => { this._cg.bg = card.dataset.bg; this._cgRenderLeft(); this._cgRenderCenter(); this._cgRenderRight(); };
        });

        col.querySelectorAll('.cg-stat-btn').forEach(btn => {
            btn.onclick = () => {
                const stat = btn.dataset.stat;
                const dir = parseInt(btn.dataset.dir);
                const cur = this._cg.stats[stat];
                const newVal = cur + dir;
                if (newVal < 1 || newVal > 20) return;
                const newTotal = this._cgStatTotal() + dir;
                if (newTotal > 50) return;
                this._cg.stats[stat] = newVal;
                this._cgRenderLeft();
                this._cgRenderRight();
            };
        });
    }

    _cgRenderCenter() {
        const col = document.getElementById('cg-col-center');
        if (!col) return;
        const cg = this._cg;
        const charSys = this.game.charCreationSystem;
        const pts = this._cgPoints();
        const bgFreeTalents = cg.bg ? (charSys.getBackground(cg.bg)?.startingTalents || []) : [];
        const effectiveUnlocked = [...bgFreeTalents, ...cg.selectedTalents];

        const tabs = [
            { id: 'all', label: 'All', color: '#00ffff' },
            ...Object.entries(TALENT_TREES).map(([id,t]) => ({ id, label: t.name, color: t.color })),
            { id: 'drawbacks', label: 'Drawbacks', color: '#ff6644' }
        ];

        let html = `<div class="cg-tabs">`;
        for (const tab of tabs) {
            const sel = cg.activeTab === tab.id;
            html += `<button class="cg-tab${sel?' active':''}" data-tab="${tab.id}" style="${sel?`border-bottom-color:${tab.color};`:''}">
                ${tab.label}
            </button>`;
        }
        html += `</div><div class="cg-talent-list" id="cg-talent-list">`;

        if (cg.activeTab === 'drawbacks') {
            for (const trait of charSys.getNegativeTraits()) {
                const sel = cg.selectedDrawbacks.includes(trait.id);
                html += this._cgDrawbackCard(trait, sel);
            }
        } else {
            let nodes = Object.values(TALENT_NODES);
            if (cg.activeTab !== 'all') nodes = nodes.filter(n => n.treeId === cg.activeTab);
            for (const node of nodes) {
                const isFree     = bgFreeTalents.includes(node.id);
                const isSelected = cg.selectedTalents.includes(node.id);
                const prereqsMet = TalentEffects.canUnlock({ unlockedTalents: effectiveUnlocked }, node.id);
                const canAfford  = pts >= node.cost || isSelected;
                html += this._cgTalentCard(node, { isFree, isSelected, prereqsMet, canAfford });
            }
        }

        html += `</div>`;
        col.innerHTML = html;

        col.querySelectorAll('.cg-tab').forEach(btn => {
            btn.onclick = () => { this._cg.activeTab = btn.dataset.tab; this._cgRenderCenter(); };
        });
        col.querySelectorAll('.cg-talent-toggle').forEach(btn => {
            btn.onclick = () => {
                const tid = btn.dataset.talent;
                if (this._cg.selectedTalents.includes(tid)) {
                    this._cg.selectedTalents = this._cg.selectedTalents.filter(t => t !== tid);
                } else {
                    this._cg.selectedTalents.push(tid);
                }
                this._cgRenderCenter();
                this._cgRenderRight();
            };
        });
        col.querySelectorAll('.cg-drawback-toggle').forEach(btn => {
            btn.onclick = () => {
                const did = btn.dataset.drawback;
                if (this._cg.selectedDrawbacks.includes(did)) {
                    this._cg.selectedDrawbacks = this._cg.selectedDrawbacks.filter(d => d !== did);
                } else {
                    this._cg.selectedDrawbacks.push(did);
                }
                this._cgRenderCenter();
                this._cgRenderRight();
            };
        });
    }

    _cgTalentCard(node, { isFree, isSelected, prereqsMet, canAfford }) {
        const tree = TALENT_TREES[node.treeId];
        const treeColor = tree ? tree.color : '#aaa';
        let cls = 'cg-talent-card';
        if (isFree)         cls += ' cg-talent-free';
        else if (isSelected) cls += ' cg-talent-selected';
        else if (!prereqsMet) cls += ' cg-talent-locked';
        else if (canAfford)  cls += ' cg-talent-available';
        else                 cls += ' cg-talent-costly';

        let prereqHtml = '';
        if (node.prerequisites?.length) {
            const names = node.prerequisites.map(p => TALENT_NODES[p]?.name || p).join(', ');
            prereqHtml = `<div class="cg-talent-prereq" style="color:${prereqsMet?'#3a7a3a':'#7a3a3a'};">Req: ${names}</div>`;
        }

        let btn = '';
        if (isFree) {
            btn = `<span class="cg-free-badge">Free (${tree?.name || ''})</span>`;
        } else if (isSelected) {
            btn = `<button class="cg-talent-toggle cg-deselect-btn" data-talent="${node.id}">\u2715 Remove</button>`;
        } else if (!prereqsMet) {
            btn = `<button class="cg-talent-toggle cg-buy-btn" data-talent="${node.id}" disabled>Prereq needed</button>`;
        } else if (!canAfford) {
            btn = `<button class="cg-talent-toggle cg-buy-btn" data-talent="${node.id}" disabled>Need ${node.cost}pt</button>`;
        } else {
            btn = `<button class="cg-talent-toggle cg-buy-btn" data-talent="${node.id}">+ Take (${node.cost}pt)</button>`;
        }

        return `<div class="${cls}">
            <div class="cg-talent-card-header">
                <span class="cg-talent-card-name">${node.name}</span>
                <span class="cg-talent-card-tree" style="color:${treeColor};">${tree?.name||''}</span>
                ${!isFree ? `<span class="cg-talent-card-cost" style="color:${isSelected?'#44ffaa':'#ffcc44'};">${isSelected?'\u2713 ':''}${node.cost}pt</span>` : ''}
            </div>
            <div class="cg-talent-card-desc">${node.description}</div>
            ${prereqHtml}${btn}
        </div>`;
    }

    _cgDrawbackCard(trait, selected) {
        const gain = Math.abs(trait.cost);
        const cls = `cg-talent-card cg-drawback-card${selected?' cg-drawback-selected':''}`;
        const btn = selected
            ? `<button class="cg-drawback-toggle cg-deselect-btn" data-drawback="${trait.id}">\u2715 Remove</button>`
            : `<button class="cg-drawback-toggle cg-buy-btn" data-drawback="${trait.id}" style="border-color:#cc4422;color:#cc4422;">Take (+${gain}pt)</button>`;
        return `<div class="${cls}">
            <div class="cg-talent-card-header">
                <span class="cg-talent-card-name" style="color:${selected?'#ff6644':'#cc8877'};">${trait.name}</span>
                <span class="cg-talent-card-cost" style="color:#44ff88;">+${gain}pt</span>
            </div>
            <div class="cg-talent-card-desc">${trait.description}</div>
            ${btn}
        </div>`;
    }

    _cgRenderRight() {
        const col = document.getElementById('cg-col-right');
        if (!col) return;
        const cg = this._cg;
        const charSys = this.game.charCreationSystem;
        const pts = this._cgPoints();
        const statTotal = this._cgStatTotal();
        const bgData = cg.bg ? charSys.getBackground(cg.bg) : null;
        const bgMods = bgData?.statMods || {};
        const bgFreeTalents = bgData?.startingTalents || [];
        const statNames = { strength:'STR', agility:'AGI', endurance:'END', intelligence:'INT', perception:'PER' };
        const valid = cg.bg && statTotal === 50 && pts >= 0;

        let html = `<div class="cg-section" style="flex:1;">
            <div class="cg-section-title">Summary</div>
            <div style="margin-bottom:10px;">
                <div style="font-size:15px;color:#fff;font-weight:bold;">${cg.name||'???'}</div>
                <div style="font-size:11px;color:#666;">${cg.gender} &mdash; ${bgData?`<span style="color:#ffaa00;">${bgData.name}</span>`:'<span style="color:#ff4444;">No background</span>'}</div>
                ${bgData?.gearLabel ? `<div style="font-size:10px;color:#557799;margin-top:2px;">&#128736; ${bgData.gearLabel}</div>` : ''}
            </div>
            <div style="background:#0d0d0d;border:1px solid #222;padding:7px;border-radius:3px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                    <span style="color:#666;font-size:11px;">Talent pts left:</span>
                    <span style="color:${pts<0?'#ff4444':pts===0?'#888':'#ffcc44'};font-weight:bold;">${pts}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                    <span style="color:#666;font-size:11px;">Attr budget:</span>
                    <span style="color:${statTotal===50?'#44ff44':statTotal>50?'#ff4444':'#ffaa00'};font-weight:bold;">${statTotal}/50</span>
                </div>
            </div>`;

        html += `<div style="margin-bottom:8px;">`;
        for (const [key, label] of Object.entries(statNames)) {
            const base = cg.stats[key];
            const mod = bgMods[key] || 0;
            const eff = base + mod;
            const modStr = mod!==0 ? ` <span style="color:${mod>0?'#44ff44':'#ff4444'};font-size:10px;">${mod>0?'+':''}${mod}</span>` : '';
            html += `<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px;">
                <span style="color:#666;">${label}</span><span>${eff}${modStr}</span>
            </div>`;
        }
        html += `</div>`;

        if (cg.selectedDrawbacks.length > 0) {
            html += `<div style="margin-bottom:6px;"><div style="font-size:10px;color:#ff6644;margin-bottom:3px;text-transform:uppercase;letter-spacing:1px;">Drawbacks</div>`;
            for (const did of cg.selectedDrawbacks) {
                const t = charSys.traits[did];
                if (t) html += `<div style="font-size:11px;color:#cc7755;padding-left:4px;">\u2022 ${t.name} <span style="color:#44ff88;">(+${Math.abs(t.cost)}pt)</span></div>`;
            }
            html += `</div>`;
        }

        if (bgFreeTalents.length > 0) {
            html += `<div style="margin-bottom:6px;"><div style="font-size:10px;color:#444;margin-bottom:3px;text-transform:uppercase;letter-spacing:1px;">Free from background</div>`;
            for (const tid of bgFreeTalents) {
                const n = TALENT_NODES[tid];
                if (n) html += `<div style="font-size:11px;color:#3a6a3a;padding-left:4px;">\u2022 ${n.name}</div>`;
            }
            html += `</div>`;
        }

        if (cg.selectedTalents.length > 0) {
            html += `<div style="margin-bottom:6px;"><div style="font-size:10px;color:#444;margin-bottom:3px;text-transform:uppercase;letter-spacing:1px;">Purchased</div>`;
            for (const tid of cg.selectedTalents) {
                const n = TALENT_NODES[tid];
                if (n) html += `<div style="font-size:11px;color:#44ffaa;padding-left:4px;">\u2022 ${n.name} <span style="color:#ffcc44;">(${n.cost}pt)</span></div>`;
            }
            html += `</div>`;
        }

        html += `</div>`;

        html += `<div style="margin-top:8px;">
            <button id="cg-start" class="cg-start-btn" ${!valid?'disabled':''}>&#9654; Start Run</button>
            <button id="cg-play-now" class="cg-play-now-btn">&#9889; Play Now (Random)</button>
        </div>`;

        col.innerHTML = html;

        document.getElementById('cg-start').onclick = () => {
            if (!cg.bg) { return; }
            if (this._cgStatTotal() !== 50) { return; }
            if (this._cgPoints() < 0) { return; }
            const allTalents = [...(bgData?.startingTalents||[]), ...cg.selectedTalents];
            document.getElementById('character-creation').classList.add('hidden');
            this.game.startGame({
                name: cg.name || 'Survivor',
                gender: cg.gender,
                background: cg.bg,
                traits: cg.selectedDrawbacks,
                unlockedTalents: allTalents,
                strength: cg.stats.strength,
                agility: cg.stats.agility,
                endurance: cg.stats.endurance,
                intelligence: cg.stats.intelligence,
                perception: cg.stats.perception
            });
        };

        document.getElementById('cg-play-now').onclick = () => this._cgPlayNow();
    }

    _cgPlayNow() {
        const charSys = this.game.charCreationSystem;
        const bgs = charSys.getAllBackgrounds();
        const bg = bgs[Math.floor(Math.random() * bgs.length)];
        const genders = ['male', 'female', 'other'];
        const stats = { strength:10, agility:10, endurance:10, intelligence:10, perception:10 };
        const keys = Object.keys(stats);
        let remaining = 50;
        for (let i = 0; i < keys.length - 1; i++) {
            const add = Math.floor(Math.random() * 5);
            stats[keys[i]] += add;
            remaining -= 10 + add;
        }
        stats[keys[keys.length-1]] = remaining;

        const drawbacks = charSys.getNegativeTraits();
        const drawback = drawbacks[Math.floor(Math.random() * drawbacks.length)];
        let pts = 6 + Math.abs(drawback.cost);

        const tier1 = Object.values(TALENT_NODES).filter(n => !n.prerequisites.length && n.cost <= 1).sort(() => Math.random()-0.5);
        const picked = [];
        for (const n of tier1) {
            if (pts >= n.cost && picked.length < 4) { picked.push(n.id); pts -= n.cost; }
        }

        const allTalents = [...(bg.startingTalents||[]), ...picked];
        document.getElementById('character-creation').classList.add('hidden');
        this.game.startGame({
            name: this._cgRandomName(),
            gender: genders[Math.floor(Math.random()*genders.length)],
            background: bg.id,
            traits: [drawback.id],
            unlockedTalents: allTalents,
            ...stats
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
                const wColor = wound.infected ? '#ff00ff' : wound.type === 'arterial' ? '#ff0000' : '#ff6644';
                let tags = '';
                if (wound.bandaged) tags += ' [bandaged]';
                if (wound.infected) tags += ' [INFECTED]';
                if (wound.disinfected && !wound.infected) tags += ' [clean]';
                html += `<div style="margin-left: 15px; font-size: 13px; color: ${wColor};">• ${wound.part} — ${wound.type} (${wound.severity.toFixed(1)}/turn)${tags}</div>`;
            }
        }
        if (player.anatomy.painSuppression > 0) {
            html += `<div class="stat-line"><span class="stat-label">Painkiller:</span> <span class="stat-value" style="color: #44ff44;">${player.anatomy.painSuppression} turns</span></div>`;
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
        
        // Unlocked Stances
        const unlockedStanceKeys = TalentEffects.getUnlockedStances(player);
        html += '<div style="margin-bottom: 20px;">';
        if (unlockedStanceKeys.length === 0) {
            html += '<h4 style="color: #555; margin-bottom: 8px;">Combat Stances</h4>';
            html += '<div style="font-size: 13px; color: #555; font-style: italic;">No stances unlocked. Purchase stance talents via <span style="color: #888;">[Q] Traits &amp; Talents</span>.</div>';
        } else {
            html += '<h4 style="color: #00ffff; margin-bottom: 12px;">Combat Stances <span style="font-size: 13px; color: #888;">[T] to cycle</span></h4>';
            for (const key of unlockedStanceKeys) {
                const stanceData = player.combatStances[key];
                if (!stanceData) continue;
                const isActive = player.combatStance === key;
                const borderColor = isActive ? stanceData.color : '#333';
                const bgColor = isActive ? '#1a1a2a' : '#0a0a0a';
                const activeTag = isActive ? ` <span style="color: #fff; font-size: 11px; background: ${stanceData.color}; padding: 1px 6px; border-radius: 3px;">ACTIVE</span>` : '';
                html += `<div style="margin-bottom: 8px; padding: 10px; background: ${bgColor}; border-left: 3px solid ${borderColor};">`;
                html += `<div style="color: ${stanceData.color}; font-weight: bold; margin-bottom: 4px;">${stanceData.name}${activeTag}</div>`;
                html += `<div style="font-size: 12px; color: #aaa;">${stanceData.description || ''}</div>`;
                html += '</div>';
            }
        }
        html += '</div>';

        // Talents summary
        html += '<div style="margin-bottom: 20px;">';
        html += `<h4 style="color: #ff8844; margin-bottom: 8px;">Talents <span style="font-size: 13px; color: #888;">${player.talentPoints || 0} point${(player.talentPoints || 0) !== 1 ? 's' : ''} remaining — [Q] to spend</span></h4>`;
        if (!player.unlockedTalents || player.unlockedTalents.length === 0) {
            html += '<div style="font-size: 13px; color: #555; font-style: italic;">No talents unlocked yet.</div>';
        } else {
            for (const talentId of player.unlockedTalents) {
                const node = TALENT_NODES[talentId];
                if (!node) continue;
                const tree = TALENT_TREES[node.treeId];
                const treeColor = tree ? tree.color : '#aaa';
                html += `<div style="font-size: 12px; margin-bottom: 3px;"><span style="color: ${treeColor}; font-size: 10px;">[${tree ? tree.name : node.treeId}]</span> <span style="color: #44ffaa;">${node.name}</span></div>`;
            }
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
        if (stance) {
            html += `<div style="color: ${stance.color}; font-size: 11px; margin-bottom: 4px;">${stance.name} Stance</div>`;
        } else {
            html += `<div style="color: #666; font-size: 11px; margin-bottom: 4px;">No Stance</div>`;
        }
        
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
                
                // Stagger
                if (evt.staggered) {
                    html += `<br><span style="color: #ffaa00; font-weight: bold; margin-left: 10px;">⚡ STAGGERED — ${evt.targetName} loses next turn</span>`;
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
            } else if (evt.type === 'parry') {
                html += `<div class="combat-feed-entry miss">`;
                html += `<span style="color: #888;">[${evt.turn}]</span> `;
                html += `<span style="color: #4488ff; font-weight: bold;">PARRY!</span> `;
                html += `<span style="color: #aaa;">${evt.targetName}</span> deflects <span style="color: #aaa;">${evt.attackerName}</span>'s <span style="color: #ccc;">${evt.weaponName}</span> with their <span style="color: #88bbff;">${evt.parryWeapon}</span>`;
                if (evt.hitChance !== undefined) {
                    html += ` <span style="color: #555; font-size: 10px;">(${evt.hitChance}% hit negated)</span>`;
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
        
        // Remember active filter for re-renders
        this._invFilter = this._invFilter || 'all';
        
        let html = '';
        
        // Side-by-side layout: Inventory on left, Ground on right
        html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; height: 100%;">';
        
        // Left column: Inventory
        html += '<div style="border-right: 2px solid #333; padding-right: 10px; display: flex; flex-direction: column; min-height: 0;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 8px; font-size: 18px;">Inventory</h3>';
        html += this.renderInventoryTab(player, containerSys);
        html += '</div>';
        
        // Right column: Ground
        html += '<div style="padding-left: 10px; display: flex; flex-direction: column; min-height: 0;">';
        html += '<h3 style="color: #00ffff; margin-bottom: 8px; font-size: 18px;">Ground</h3>';
        html += this.renderGroundTab(player, containerSys);
        html += '</div>';
        
        html += '</div>';
        
        content.innerHTML = html;
        
        this.attachInventoryEventListeners();
    }
    
    /**
     * Categorize an item for filter tabs
     */
    getItemCategory(item) {
        if (item.type === 'weapon') return 'weapons';
        if (item.isComponent || item.type === 'component') return 'components';
        if (item.tags && (item.tags.includes('medical') || item.medicalEffect || item.isMedkit)) return 'medical';
        if (item.type === 'food' || item.type === 'drink' || item.nutrition) return 'consumables';
        if (item.isContainer || (item.pockets && item.pockets.length > 0)) return 'containers';
        if (item.type === 'armor' || item.defense) return 'armor';
        return 'misc';
    }
    
    /**
     * Get dynamic display name for an item. For containers, reflects actual contents.
     */
    getDisplayName(item) {
        // Only apply dynamic naming to food/drink containers (bottles, cans)
        // NOT to flashlights, lanterns, backpacks, etc.
        if (!item.isContainer || !item.contents) return item.name;
        
        const isFoodContainer = item.name.includes('Bottle') || item.name.includes('Can');
        if (!isFoodContainer) return item.name;
        
        const prefix = (item.state && item.state.opened) ? 'Opened' : 'Sealed';
        let baseType = item.name.includes('Bottle') ? 'Bottle' : 'Can';
        
        if (item.contents.length === 0) {
            return `${prefix} ${baseType} (Empty)`;
        }
        
        const contentName = item.contents[0].name;
        return `${prefix} ${baseType} (${contentName})`;
    }
    
    /**
     * Render a compact single-line item row with inline quick buttons
     */
    renderCompactItemRow(item, actionType, actionData, containerSys, options = {}) {
        const w = item.weight ? (item.weight >= 1000 ? `${(item.weight/1000).toFixed(1)}kg` : `${item.weight}g`) : '';
        const isEquippable = item.slots && item.slots.length > 0;
        const cat = this.getItemCategory(item);
        
        // Color-code by category
        const catColors = { weapons: '#ff6666', components: '#ffaa00', medical: '#44ff88', consumables: '#88ccff', containers: '#ffaa00', armor: '#aaaaff', misc: '#aaaaaa' };
        const borderColor = catColors[cat] || '#555';
        
        let html = `<div class="inv-row" data-category="${cat}" style="display: flex; align-items: center; gap: 4px; margin-bottom: 3px; padding: 4px 6px; background: #111; border-left: 3px solid ${borderColor};">`;
        
        // Item name (clickable for full actions)
        const dataAttrs = Object.entries(actionData).map(([k,v]) => `data-${k}="${v}"`).join(' ');
        html += `<button class="small-btn" data-action="${actionType}" ${dataAttrs} style="flex: 1; text-align: left; padding: 4px 6px; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px;">`;
        html += `<span style="color: ${item.color || '#fff'};">${item.glyph || '*'}</span> `;
        html += `<span style="color: #ddd;">${this.getDisplayName(item)}</span>`;
        
        // Inline hints
        if (item.type === 'weapon' && item.weaponStats && item.weaponStats.damage) {
            html += ` <span style="color: #ff6666; font-size: 11px;">⚔${item.weaponStats.damage}</span>`;
        }
        if (item.durability !== undefined && item.durability < 100) {
            const durColor = item.durability > 50 ? '#888' : item.durability > 25 ? '#ff8800' : '#ff4444';
            const durLabel = item.tags && item.tags.includes('power') ? '⚡' : '';
            html += ` <span style="color: ${durColor}; font-size: 11px;">${durLabel}${Math.floor(item.durability)}%</span>`;
        }
        if (item.lightRadius) {
            const isOn = !item.state || item.state.active !== false;
            html += ` <span style="color: ${isOn ? '#44ff44' : '#ff4444'}; font-size: 11px;">[${isOn ? 'ON' : 'OFF'}]</span>`;
        }
        if (item.quantity && item.stackable) {
            html += ` <span style="color: #888; font-size: 11px;">x${item.quantity}</span>`;
        }
        
        if (w) html += `<span style="color: #555; font-size: 11px; margin-left: auto; padding-left: 8px;">${w}</span>`;
        html += `</button>`;
        
        // Quick action buttons (only for stored/ground items, not equipped)
        if (options.showDrop) {
            html += `<button class="small-btn inv-quick-drop" data-action="${actionType}" ${dataAttrs} style="padding: 4px 6px; font-size: 10px; background: #442222; color: #ff8888;" title="Drop">Drop</button>`;
        }
        if (options.showEquip && isEquippable) {
            html += `<button class="small-btn inv-quick-equip" data-action="${actionType}" ${dataAttrs} style="padding: 4px 6px; font-size: 10px; background: #224422; color: #88ff88;" title="Equip">Equip</button>`;
        }
        if (options.showStore) {
            html += `<button class="small-btn inv-quick-store" data-action="${actionType}" ${dataAttrs} style="padding: 4px 6px; font-size: 10px; background: #223344; color: #88ccff;" title="Store">Store</button>`;
        }
        
        html += `</div>`;
        return html;
    }
    
    renderInventoryTab(player, containerSys) {
        let html = '';
        
        // Compact encumbrance bar
        const currentWeight = player.getCurrentCarryWeight();
        const maxWeight = player.maxWeight;
        const encumbrance = player.getEncumbranceLevel();
        const encColors = { light: '#00ff00', medium: '#ffaa00', heavy: '#ff8800', overencumbered: '#ff4444' };
        const pct = Math.min(100, Math.round((currentWeight / maxWeight) * 100));
        
        html += `<div style="margin-bottom: 8px; padding: 6px 8px; background: #111; border: 1px solid ${encColors[encumbrance]};">`;
        html += `<div style="display: flex; justify-content: space-between; font-size: 12px;">`;
        html += `<span style="color: ${encColors[encumbrance]}; font-weight: bold;">${containerSys.formatWeight(currentWeight)} / ${containerSys.formatWeight(maxWeight)}</span>`;
        html += `<span style="color: ${encColors[encumbrance]};">${encumbrance.toUpperCase()}</span>`;
        html += `</div>`;
        html += `<div style="margin-top: 3px; height: 3px; background: #333; border-radius: 2px;">`;
        html += `<div style="height: 100%; width: ${pct}%; background: ${encColors[encumbrance]}; border-radius: 2px;"></div>`;
        html += `</div>`;
        html += `</div>`;
        
        // Category filter tabs
        const filters = [
            { id: 'all', label: 'All' },
            { id: 'weapons', label: 'Weapons' },
            { id: 'armor', label: 'Armor' },
            { id: 'components', label: 'Components' },
            { id: 'medical', label: 'Medical' },
            { id: 'consumables', label: 'Food' },
            { id: 'containers', label: 'Containers' },
            { id: 'misc', label: 'Misc' }
        ];
        
        html += `<div style="display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 8px;">`;
        for (const f of filters) {
            const active = this._invFilter === f.id;
            const style = active 
                ? 'background: #00ffff; color: #000; font-weight: bold;' 
                : 'background: #222; color: #888;';
            html += `<button class="small-btn inv-filter-btn" data-filter="${f.id}" style="padding: 3px 8px; font-size: 11px; ${style}">${f.label}</button>`;
        }
        html += `</div>`;
        
        // Scrollable content area
        html += `<div style="flex: 1; overflow-y: auto; min-height: 0;">`;
        
        // ── Equipment section (collapsible) ──
        html += `<div style="margin-bottom: 6px;">`;
        html += `<button class="small-btn inv-section-toggle" data-section="equip-section" style="width: 100%; text-align: left; padding: 4px 8px; background: #1a1a1a; border-left: 3px solid #88aaff; font-size: 12px; color: #88aaff;">`;
        html += `▼ Equipment</button>`;
        html += `<div id="equip-section" style="margin-top: 2px;">`;
        
        const slots = [
            { key: 'head', label: 'Head' },
            { key: 'torso', label: 'Torso' },
            { key: 'legs', label: 'Legs' },
            { key: 'back', label: 'Back' },
            { key: 'leftHand', label: 'L.Hand' },
            { key: 'rightHand', label: 'R.Hand' }
        ];
        
        for (const slot of slots) {
            const item = player.equipment[slot.key];
            if (slot.key === 'rightHand' && item && player.equipment.leftHand === item) continue;
            
            html += `<div style="display: flex; align-items: center; gap: 4px; padding: 3px 6px; background: #0a0a0a; margin-bottom: 2px;">`;
            html += `<span style="color: #556; font-size: 11px; width: 50px; flex-shrink: 0;">${slot.label}</span>`;
            
            if (item) {
                const twoH = item.twoHandGrip || (slot.key === 'leftHand' && player.equipment.rightHand === item);
                html += `<button class="small-btn" data-action="actions-equipped" data-slot="${slot.key}" style="flex: 1; text-align: left; padding: 3px 6px; font-size: 12px; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">`;
                html += `<span style="color: ${item.color};">${item.glyph || '*'} ${item.name}</span>`;
                if (twoH) html += ` <span style="color: #ffaa00; font-size: 10px;">[2H]</span>`;
                if (item.type === 'weapon' && item.weaponStats && item.weaponStats.damage) html += ` <span style="color: #ff6666; font-size: 10px;">⚔${item.weaponStats.damage}</span>`;
                if (item.lightRadius) {
                    const isOn = !item.state || item.state.active !== false;
                    html += ` <span style="color: ${isOn ? '#44ff44' : '#ff4444'}; font-size: 10px;">[${isOn ? 'ON' : 'OFF'}]</span>`;
                }
                html += `</button>`;
                
                if (item.lightRadius) {
                    const isOn = !item.state || item.state.active !== false;
                    html += `<button class="small-btn" data-action="toggle-light" data-slot="${slot.key}" style="padding: 3px 6px; font-size: 10px; background: ${isOn ? '#442222' : '#224422'}; color: ${isOn ? '#ff8888' : '#88ff88'};">${isOn ? 'Off' : 'On'}</button>`;
                }
            } else {
                html += `<span style="color: #333; font-size: 12px; font-style: italic;">empty</span>`;
            }
            html += `</div>`;
        }
        html += `</div></div>`;
        
        // ── Carrying section (only if carrying something) ──
        if (!player.carrying) player.carrying = { leftHand: null, rightHand: null };
        const leftCarried = player.carrying.leftHand;
        const rightCarried = player.carrying.rightHand;
        
        if (leftCarried || rightCarried) {
            html += `<div style="margin-bottom: 6px;">`;
            html += `<div style="padding: 4px 8px; background: #1a1a1a; border-left: 3px solid #ffaa00; font-size: 12px; color: #ffaa00; margin-bottom: 2px;">Carrying</div>`;
            
            if (leftCarried && leftCarried === rightCarried) {
                html += this.renderCompactItemRow(leftCarried, 'actions-carried', { hand: 'both' }, containerSys, { showDrop: true });
            } else {
                if (leftCarried) html += this.renderCompactItemRow(leftCarried, 'actions-carried', { hand: 'left' }, containerSys, { showDrop: true });
                if (rightCarried) html += this.renderCompactItemRow(rightCarried, 'actions-carried', { hand: 'right' }, containerSys, { showDrop: true });
            }
            html += `</div>`;
        }
        
        // ── Stored Items (grouped by container) ──
        // Filter out sub-container contents (fuel in flashlights, food in cans, etc.)
        // Those are only accessible via Inspect on the parent item
        const storedItems = containerSys.getAllStoredItems(player)
            .filter(s => s.type !== 'container');
        const activeFilter = this._invFilter;
        
        if (storedItems.length === 0) {
            html += '<div style="color: #444; font-size: 12px; padding: 8px;">No items stored.</div>';
        } else {
            // Group items by container location
            const groups = {};
            for (let i = 0; i < storedItems.length; i++) {
                const stored = storedItems[i];
                const loc = stored.location;
                if (!groups[loc]) groups[loc] = [];
                groups[loc].push({ stored, index: i });
            }
            
            for (const [location, items] of Object.entries(groups)) {
                // Filter by category
                const filteredItems = activeFilter === 'all' 
                    ? items 
                    : items.filter(({ stored }) => this.getItemCategory(stored.item) === activeFilter);
                
                if (filteredItems.length === 0) continue;
                
                html += `<div style="margin-bottom: 4px;">`;
                html += `<div style="padding: 3px 8px; background: #0d0d0d; font-size: 11px; color: #00aaaa; border-bottom: 1px solid #222;">${location} (${filteredItems.length})</div>`;
                
                for (const { stored, index } of filteredItems) {
                    html += this.renderCompactItemRow(
                        stored.item, 
                        'actions-stored', 
                        { 'stored-index': index }, 
                        containerSys, 
                        { showDrop: true, showEquip: true }
                    );
                }
                html += `</div>`;
            }
            
            // Show message if filter hides everything
            const totalVisible = activeFilter === 'all' 
                ? storedItems.length 
                : storedItems.filter(s => this.getItemCategory(s.item) === activeFilter).length;
            if (totalVisible === 0) {
                html += `<div style="color: #444; font-size: 12px; padding: 8px; text-align: center;">No ${activeFilter} items stored.</div>`;
            }
        }
        
        html += `</div>`; // end scrollable area
        
        return html;
    }
    
    renderGroundTab(player, containerSys) {
        let html = '';
        
        const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
        
        if (groundItems.length === 0) {
            html += '<div style="color: #444; font-size: 12px; padding: 8px;">Nothing here.</div>';
        } else {
            // Grab All button
            html += `<div style="margin-bottom: 8px;">`;
            html += `<button class="small-btn" id="inv-grab-all" style="width: 100%; padding: 6px; font-size: 12px; background: #224422; color: #88ff88;">Grab All (${groundItems.length})</button>`;
            html += `</div>`;
            
            html += `<div style="flex: 1; overflow-y: auto; min-height: 0;">`;
            for (let i = 0; i < groundItems.length; i++) {
                html += this.renderCompactItemRow(
                    groundItems[i],
                    'actions-ground',
                    { 'ground-index': i },
                    containerSys,
                    { showStore: true, showEquip: true }
                );
            }
            html += `</div>`;
        }
        
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
        const player = this.game.player;
        
        // ── Category filter tabs ──
        const filterBtns = document.querySelectorAll('.inv-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._invFilter = btn.dataset.filter;
                this.showDetailedInventory();
            });
        });
        
        // ── Section collapse/expand toggles ──
        const toggleBtns = document.querySelectorAll('.inv-section-toggle');
        toggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const sectionId = btn.dataset.section;
                const section = document.getElementById(sectionId);
                if (section) {
                    const hidden = section.style.display === 'none';
                    section.style.display = hidden ? '' : 'none';
                    btn.textContent = btn.textContent.replace(/^[▼▶]/, hidden ? '▼' : '▶');
                }
            });
        });
        
        // ── Toggle light on/off ──
        const toggleLightButtons = document.querySelectorAll('button[data-action="toggle-light"]');
        toggleLightButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const slot = btn.dataset.slot;
                const item = player.equipment[slot];
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
        
        // ── Grab All button (ground) ──
        document.getElementById('inv-grab-all')?.addEventListener('click', (e) => {
            e.stopPropagation();
            player.grabAll();
            this.showDetailedInventory();
            this.updatePanels();
        });
        
        // ── Quick Drop buttons (stored items) ──
        document.querySelectorAll('.inv-quick-drop').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionType = btn.dataset.action;
                
                if (actionType === 'actions-stored') {
                    const index = parseInt(btn.dataset.storedIndex);
                    this.handleDropStoredItem(index);
                } else if (actionType === 'actions-carried') {
                    const hand = btn.dataset.hand;
                    this.handleDropCarriedItem(hand);
                }
            });
        });
        
        // ── Quick Equip buttons (stored/ground items → move modal for slot selection) ──
        document.querySelectorAll('.inv-quick-equip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionType = btn.dataset.action;
                
                if (actionType === 'actions-stored') {
                    const index = parseInt(btn.dataset.storedIndex);
                    this.showMoveModal('stored', { index });
                } else if (actionType === 'actions-ground') {
                    const index = parseInt(btn.dataset.groundIndex);
                    this.showMoveModal('ground', { index });
                }
            });
        });
        
        // ── Quick Store buttons (ground items → auto-store) ──
        document.querySelectorAll('.inv-quick-store').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionType = btn.dataset.action;
                
                if (actionType === 'actions-ground') {
                    const index = parseInt(btn.dataset.groundIndex);
                    const groundItems = this.game.world.getItemsAt(player.x, player.y, player.z);
                    const item = groundItems[index];
                    if (item) {
                        const result = player.addToInventory(item);
                        if (result.success) {
                            this.game.world.removeItem(item);
                            this.game.ui.log(`Took ${item.name} → ${result.location}.`, 'info');
                        } else {
                            this.game.ui.log(`No space for ${item.name}.`, 'warning');
                        }
                        this.showDetailedInventory();
                        this.updatePanels();
                    }
                }
            });
        });
        
        // ── Actions button listeners (item name click → full actions modal) ──
        const actionsButtons = document.querySelectorAll('button[data-action^="actions-"]');
        actionsButtons.forEach(btn => {
            // Skip quick-action buttons (they have their own handlers above)
            if (btn.classList.contains('inv-quick-drop') || 
                btn.classList.contains('inv-quick-equip') || 
                btn.classList.contains('inv-quick-store')) return;
            
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionType = btn.dataset.action;
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
                        item = container.pockets[pocketIndex].contents[itemIndex];
                    }
                    sourceData = { containerId, pocketIndex, itemIndex };
                } else if (actionType === 'actions-container-item') {
                    const containerId = btn.dataset.containerId;
                    const itemIndex = parseInt(btn.dataset.itemIndex);
                    const container = this.findContainerById(containerId);
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
        html += `<h3 style="color: #4488ff; margin-bottom: 15px;">Move: ${this.getDisplayName(item)}</h3>`;
        
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
                    // Use dynamic display name for the container portion
                    let label = storage.location;
                    if (storage.item) {
                        const displayName = this.getDisplayName(storage.item);
                        if (displayName !== storage.item.name) {
                            label = label.replace(storage.item.name, displayName);
                        }
                    }
                    html += `<button class="small-btn" data-move-action="store" data-storage-index="${i}" style="background: #00ffff; color: #000; text-align: left;">${label}</button>`;
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
            if (sourceType === 'furniture' && this.furnitureContext) {
                showFurnitureContentsModal(this, this.furnitureContext);
            } else {
                this.showDetailedInventory('inventory');
            }
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
        
        const wasFurniture = sourceType === 'furniture' && this.furnitureContext;
        this.moveContext = null;
        this.updatePanels();
        
        if (wasFurniture) {
            showFurnitureContentsModal(this, this.furnitureContext);
        } else {
            this.showDetailedInventory('inventory');
        }
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
        html += `<h4 style="color: ${item.color}; margin-bottom: 10px;">${this.getDisplayName(item)}</h4>`;
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
                            html += `<div style="display: flex; gap: 5px; flex-wrap: wrap;">`;
                            // Direct consume button for food/drink
                            if ((pocketItem.type === 'food' || pocketItem.type === 'drink') && pocketItem.nutrition) {
                                const warn = pocketItem.state && pocketItem.state.contaminated ? ' ⚠' : '';
                                html += `<button class="small-btn" data-inspect-action="consume" data-container-id="${item.id}" data-pocket-index="${i}" data-item-index="${pi}" style="flex: 1; background: #226622; color: #44ff44;">Consume${warn}</button>`;
                            }
                            // Direct use button for medical items
                            if (pocketItem.medicalEffect) {
                                html += `<button class="small-btn" data-inspect-action="use" data-container-id="${item.id}" data-pocket-index="${i}" data-item-index="${pi}" style="flex: 1; background: #226622; color: #44ff44;">Apply</button>`;
                            }
                            // Take out
                            html += `<button class="small-btn" data-inspect-action="take" data-container-id="${item.id}" data-pocket-index="${i}" data-item-index="${pi}" style="flex: 1;">Take</button>`;
                            // Full actions fallback
                            html += `<button class="small-btn" data-action="actions-pocket-item" data-container-id="${item.id}" data-pocket-index="${i}" data-item-index="${pi}" style="flex: 1; opacity: 0.7;">More...</button>`;
                            html += `</div></div>`;
                        }
                        html += `</div>`;
                    } else {
                        html += `<div style="margin-top: 5px; color: #666; font-size: 14px;">Empty</div>`;
                    }
                    
                    html += `</div>`;
                }
                html += `</div>`;
            } else if (item.contents) {
                if (item.maxWeight !== undefined && item.maxVolume !== undefined) {
                    const contWeight = containerSys.getTotalWeight(item);
                    const contVolume = containerSys.getTotalVolume(item);
                    html += `<div style="color: #888; margin-bottom: 5px;">Weight: ${containerSys.formatWeight(contWeight)} / ${containerSys.formatWeight(item.maxWeight)}</div>`;
                    html += `<div style="color: #888; margin-bottom: 5px;">Volume: ${containerSys.formatVolume(contVolume)} / ${containerSys.formatVolume(item.maxVolume)}</div>`;
                }
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
                        
                        html += `<div style="display: flex; gap: 5px; flex-wrap: wrap;">`;
                        // Direct consume button for food/drink
                        if ((containedItem.type === 'food' || containedItem.type === 'drink') && containedItem.nutrition) {
                            const warn = containedItem.state && containedItem.state.contaminated ? ' ⚠' : '';
                            html += `<button class="small-btn" data-inspect-action="consume" data-container-id="${item.id}" data-item-index="${ci}" style="flex: 1; background: #226622; color: #44ff44;">Consume${warn}</button>`;
                        }
                        // Direct use button for medical items
                        if (containedItem.medicalEffect) {
                            html += `<button class="small-btn" data-inspect-action="use" data-container-id="${item.id}" data-item-index="${ci}" style="flex: 1; background: #226622; color: #44ff44;">Apply</button>`;
                        }
                        // Take out
                        html += `<button class="small-btn" data-inspect-action="take" data-container-id="${item.id}" data-item-index="${ci}" style="flex: 1;">Take</button>`;
                        // Full actions fallback
                        html += `<button class="small-btn" data-action="actions-container-item" data-container-id="${item.id}" data-item-index="${ci}" style="flex: 1; opacity: 0.7;">More...</button>`;
                        html += `</div>`;
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
        
        // Direct action buttons on container contents (Consume/Use/Take)
        const inspectActionBtns = document.querySelectorAll('button[data-inspect-action]');
        inspectActionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.inspectAction;
                const containerId = btn.dataset.containerId;
                const pocketIndex = btn.dataset.pocketIndex !== undefined ? parseInt(btn.dataset.pocketIndex) : null;
                const itemIndex = parseInt(btn.dataset.itemIndex);
                
                const container = this.findContainerById(containerId);
                if (!container) return;
                
                let contentItem = null;
                let sourceType, sourceData;
                
                if (pocketIndex !== null && container.pockets && container.pockets[pocketIndex]) {
                    contentItem = container.pockets[pocketIndex].contents[itemIndex];
                    sourceType = 'actions-pocket-item';
                    sourceData = { containerId, pocketIndex, itemIndex };
                } else if (container.contents) {
                    contentItem = container.contents[itemIndex];
                    sourceType = 'actions-container-item';
                    sourceData = { containerId, itemIndex };
                }
                
                if (!contentItem) return;
                
                if (action === 'consume') {
                    this.actionsContext = { item: contentItem, sourceType, sourceData };
                    this.handleConsumeAction(contentItem, sourceType, sourceData);
                } else if (action === 'use') {
                    this.actionsContext = { item: contentItem, sourceType, sourceData };
                    this.handleUseAction(contentItem, sourceType, sourceData);
                } else if (action === 'take') {
                    const player = this.game.player;
                    const result = player.addToInventory(contentItem);
                    if (result.success) {
                        if (pocketIndex !== null && container.pockets && container.pockets[pocketIndex]) {
                            container.pockets[pocketIndex].contents.splice(itemIndex, 1);
                        } else if (container.contents) {
                            container.contents.splice(itemIndex, 1);
                        }
                        this.game.ui.log(`Took ${contentItem.name} from ${container.name}.`, 'info');
                    } else {
                        this.game.ui.log(`No space for ${contentItem.name}.`, 'warning');
                    }
                    // Refresh inspect modal
                    this.showInspectModal(item);
                }
            });
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
            if (!this._activeTalentTab) this._activeTalentTab = 'talents';
            this.showAbilityPanel();
            this.abilityPanelModal.classList.remove('hidden');
            // Wire tab buttons after showing
            const tabBtns = this.abilityPanelModal.querySelectorAll('.talent-tab-btn');
            tabBtns.forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === this._activeTalentTab);
                btn.onclick = () => {
                    this._activeTalentTab = btn.dataset.tab;
                    this.showAbilityPanel();
                    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === this._activeTalentTab));
                };
            });
        } else {
            this.abilityPanelModal.classList.add('hidden');
            if (this._abilityKeyHandler) {
                document.removeEventListener('keydown', this._abilityKeyHandler);
                this._abilityKeyHandler = null;
            }
        }
    }
    
    showAbilityPanel() {
        if (!this.game.player) return;
        const content = document.getElementById('ability-panel-content');
        if (!content) return;
        if (this._activeTalentTab === 'talents') {
            this.showTalentContent(content);
        } else {
            this.showAbilitiesContent(content);
        }
    }

    showTalentContent(content) {
        const player = this.game.player;
        if (!player) return;

        let html = `<div id="talent-screen-layout">`;

        // Left nav — tree list
        html += `<div id="talent-tree-nav">`;
        html += `<div class="talent-pts-display">${player.talentPoints || 0} point${(player.talentPoints || 0) !== 1 ? 's' : ''} remaining</div>`;
        for (const [treeId, tree] of Object.entries(TALENT_TREES)) {
            const owned = (player.unlockedTalents || []).filter(id => TALENT_NODES[id] && TALENT_NODES[id].treeId === treeId).length;
            const total = Object.values(TALENT_NODES).filter(n => n.treeId === treeId).length;
            const sel = (this._selectedTalentTree || 'combat_tactics') === treeId ? ' selected' : '';
            html += `<button class="talent-tree-btn${sel}" data-tree="${treeId}" style="border-left: 3px solid ${tree.color};">`;
            html += `${tree.name} <span class="tree-count">${owned}/${total}</span>`;
            html += `</button>`;
        }
        html += `</div>`; // end nav

        // Right panel — nodes for selected tree
        const selectedTree = this._selectedTalentTree || 'combat_tactics';
        const treeInfo = TALENT_TREES[selectedTree];
        const nodes = Object.values(TALENT_NODES).filter(n => n.treeId === selectedTree);

        html += `<div id="talent-nodes-panel">`;
        html += `<div style="font-size: 12px; color: #888; margin-bottom: 8px; font-style: italic;">${treeInfo ? treeInfo.description : ''}</div>`;

        for (const node of nodes) {
            const isUnlocked = TalentEffects.has(player, node.id);
            const canBuy = !isUnlocked && TalentEffects.canUnlock(player, node.id) && (player.talentPoints || 0) >= node.cost;
            const prereqsMet = TalentEffects.canUnlock(player, node.id);
            let cardClass = 'talent-node-card';
            if (isUnlocked) cardClass += ' unlocked-talent';
            else if (!prereqsMet) cardClass += ' locked-prereq';
            else if (canBuy) cardClass += ' purchasable';

            html += `<div class="${cardClass}">`;
            html += `<div class="talent-node-header">`;
            html += `<span class="talent-node-name">${node.name}</span>`;
            if (!isUnlocked) html += `<span class="talent-node-cost">${node.cost} pt${node.cost !== 1 ? 's' : ''}</span>`;
            html += `</div>`;
            html += `<div class="talent-node-desc">${node.description}</div>`;

            if (node.prerequisites && node.prerequisites.length > 0) {
                const prereqNames = node.prerequisites.map(pid => TALENT_NODES[pid] ? TALENT_NODES[pid].name : pid).join(', ');
                const prereqColor = prereqsMet ? '#44aa44' : '#aa4444';
                html += `<div class="talent-node-prereqs" style="color: ${prereqColor};">Requires: ${prereqNames}</div>`;
            }

            if (isUnlocked) {
                html += `<span class="talent-unlocked-badge">✓ Unlocked</span>`;
            } else if (!prereqsMet) {
                html += `<div style="font-size: 11px; color: #666; font-style: italic; margin-top: 4px;">Prerequisites not met</div>`;
            } else {
                const btnDisabled = !canBuy ? ' disabled' : '';
                const btnTitle = canBuy ? '' : ((player.talentPoints || 0) < node.cost ? 'Not enough talent points' : 'Prerequisites not met');
                html += `<button class="talent-buy-btn" data-talent="${node.id}"${btnDisabled} title="${btnTitle}">Buy (${node.cost}pt)</button>`;
            }
            html += `</div>`;
        }
        html += `</div>`; // end nodes panel
        html += `</div>`; // end layout

        content.innerHTML = html;

        // Wire tree nav buttons
        content.querySelectorAll('.talent-tree-btn').forEach(btn => {
            btn.onclick = () => {
                this._selectedTalentTree = btn.dataset.tree;
                this.showTalentContent(content);
            };
        });

        // Wire buy buttons
        content.querySelectorAll('.talent-buy-btn').forEach(btn => {
            btn.onclick = () => this.handleTalentPurchase(btn.dataset.talent);
        });
    }

    handleTalentPurchase(talentId) {
        const player = this.game.player;
        if (!player) return;
        const node = TALENT_NODES[talentId];
        if (!node) return;

        if (TalentEffects.has(player, talentId)) {
            this.log('Already unlocked.', 'info');
            return;
        }
        if (!TalentEffects.canUnlock(player, talentId)) {
            this.log('Prerequisites not met.', 'warning');
            return;
        }
        if ((player.talentPoints || 0) < node.cost) {
            this.log('Not enough talent points.', 'warning');
            return;
        }

        player.talentPoints -= node.cost;
        if (!player.unlockedTalents) player.unlockedTalents = [];
        player.unlockedTalents.push(talentId);
        TalentEffects.applyImmediateEffect(player, talentId);

        const unlocks = [];
        if (node.effects.unlocksStance) unlocks.push(`stance: ${node.effects.unlocksStance}`);
        if (node.effects.unlocksAbility) unlocks.push(`ability: ${node.effects.unlocksAbility}`);
        this.log(`Unlocked talent: ${node.name}${unlocks.length ? ' — ' + unlocks.join(', ') : ''}`, 'success');

        this.updateCharacterPanel();
        this.showTalentContent(document.getElementById('ability-panel-content'));
    }

    showAbilitiesContent(content) {
        if (!this.game.player || !this.game.abilitySystem) return;
        const player = this.game.player;
        const abilitySys = this.game.abilitySystem;
        const abilities = abilitySys.getAvailableAbilities(player);
        const weapon = abilitySys.getEntityWeapon(player);
        const weaponType = abilitySys.getWeaponType(weapon);
        const weaponName = weapon ? weapon.name : 'Bare Fists';
        const stance = player.getStance();
        const stanceName = stance ? stance.name : 'None';
        const stanceColor = stance ? stance.color : '#666';
        
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
            
            // Talent requirement
            if (ab.requiredTalent) {
                const talentNode = TALENT_NODES[ab.requiredTalent];
                const talentName = talentNode ? talentNode.name : ab.requiredTalent;
                const reqColor = ab.unlocked ? '#44aa44' : '#886633';
                const reqLabel = ab.unlocked ? `\u2713 ${talentName}` : `\u2715 ${talentName}`;
                html += `<div style="font-size: 11px; margin-bottom: 4px; color: ${reqColor};">Talent: ${reqLabel}</div>`;
            }
            
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
                if (ab.missingTalent) {
                    const talentNode = TALENT_NODES[ab.missingTalent];
                    const talentName = talentNode ? talentNode.name : ab.missingTalent;
                    html += `<div style="font-size: 11px; color: #886633; margin-top: 4px; font-style: italic;">Locked — requires talent: <span style="color: #ff8844;">${talentName}</span></div>`;
                } else {
                    html += `<div style="font-size: 11px; color: #ff4444; margin-top: 4px; font-style: italic;">Locked</div>`;
                }
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
            this._helpActiveTab = this._helpActiveTab || 'controls';
            this.showHelpTab(this._helpActiveTab);
            this.helpModal.classList.remove('hidden');
        } else {
            this.helpModal.classList.add('hidden');
        }
    }
    
    showHelpTab(tabId) {
        this._helpActiveTab = tabId;
        const content = document.getElementById('help-content');
        const tabBar = document.getElementById('help-tabs');
        const searchBox = document.getElementById('help-search');
        const searchInput = document.getElementById('help-search-input');
        
        // Render tab bar
        const tabs = [
            { id: 'controls', label: 'Controls' },
            { id: 'recipes', label: 'Crafting Wiki' },
            { id: 'materials', label: 'Materials' }
        ];
        tabBar.innerHTML = tabs.map(t => {
            const active = t.id === tabId;
            return `<button class="small-btn help-tab-btn" data-help-tab="${t.id}" style="padding: 5px 14px; font-size: 13px; ${active ? 'background: #00ffff; color: #000; font-weight: bold;' : ''}">${t.label}</button>`;
        }).join('');
        
        // Tab click handlers
        tabBar.querySelectorAll('.help-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => this.showHelpTab(btn.dataset.helpTab));
        });
        
        // Show/hide search
        const showSearch = tabId === 'recipes' || tabId === 'materials';
        searchBox.style.display = showSearch ? 'block' : 'none';
        if (showSearch && searchInput) {
            searchInput.value = '';
            // Remove old listener
            if (this._helpSearchHandler) searchInput.removeEventListener('input', this._helpSearchHandler);
            this._helpSearchHandler = () => this._filterHelpWiki(tabId, searchInput.value);
            searchInput.addEventListener('input', this._helpSearchHandler);
            setTimeout(() => searchInput.focus(), 50);
        }
        
        // Render content
        if (tabId === 'controls') {
            content.innerHTML = this._buildControlsTab();
        } else if (tabId === 'recipes') {
            content.innerHTML = this._buildRecipesTab('');
        } else if (tabId === 'materials') {
            content.innerHTML = this._buildMaterialsTab('');
        }
    }
    
    _filterHelpWiki(tabId, query) {
        const content = document.getElementById('help-content');
        if (tabId === 'recipes') {
            content.innerHTML = this._buildRecipesTab(query);
        } else if (tabId === 'materials') {
            content.innerHTML = this._buildMaterialsTab(query);
        }
    }
    
    _buildControlsTab() {
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
        
        return html;
    }
    
    _buildRecipesTab(query) {
        const game = this.game;
        const q = query.toLowerCase().trim();
        let html = '';
        
        // Gather all craftable items (those with componentRequirements)
        const recipes = [];
        for (const [famId, fam] of Object.entries(game.content.itemFamilies)) {
            if (!fam.componentRequirements || fam.componentRequirements.length === 0) continue;
            recipes.push({ id: famId, ...fam });
        }
        
        // Sort alphabetically
        recipes.sort((a, b) => a.name.localeCompare(b.name));
        
        // Filter by search query
        const filtered = q ? recipes.filter(r => {
            if (r.name.toLowerCase().includes(q)) return true;
            if (r.type && r.type.toLowerCase().includes(q)) return true;
            // Search in requirement labels
            for (const req of r.componentRequirements) {
                if (req.name && req.name.toLowerCase().includes(q)) return true;
                if (req.property) {
                    const label = getPropertyLabel(req.property, req.minValue, req.maxValue);
                    if (label.toLowerCase().includes(q)) return true;
                }
            }
            return false;
        }) : recipes;
        
        html += `<div style="color: #888; font-size: 11px; margin-bottom: 10px;">${filtered.length} of ${recipes.length} recipes</div>`;
        
        for (const recipe of filtered) {
            // Header row
            const typeColor = recipe.type === 'weapon' ? '#ff6666' : recipe.type === 'armor' ? '#6688ff' : recipe.type === 'consumable' ? '#66ff66' : recipe.type === 'light_source' ? '#ffcc55' : '#aaa';
            html += `<div style="background: #1a1a1a; border: 1px solid #333; border-left: 3px solid ${typeColor}; padding: 10px 12px; margin-bottom: 6px;">`;
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">`;
            html += `<span style="color: #fff; font-weight: bold; font-size: 14px;">${recipe.name}</span>`;
            html += `<span style="color: ${typeColor}; font-size: 11px; text-transform: uppercase;">${recipe.type || 'item'}`;
            if (recipe.craftTime) html += ` · ${recipe.craftTime} turn${recipe.craftTime > 1 ? 's' : ''}`;
            html += `</span></div>`;
            
            // Weapon stats
            if (recipe.weaponStats && recipe.weaponStats.damage) {
                html += `<div style="color: #ff8888; font-size: 11px; margin-bottom: 4px;">Damage: ${recipe.weaponStats.damage} (${recipe.weaponStats.attackType})</div>`;
            }
            
            // Crafted properties (what this item provides as an intermediate)
            if (recipe.craftedProperties) {
                const props = Object.entries(recipe.craftedProperties).map(([k, v]) => getPropertyLabel(k, v));
                html += `<div style="color: #00ffff; font-size: 11px; margin-bottom: 4px;">Provides: ${props.join(', ')}</div>`;
            }
            
            // Requirements
            html += `<div style="margin-top: 4px;">`;
            for (const req of recipe.componentRequirements) {
                if (req.component) {
                    // Specific component
                    html += `<div style="color: #ccc; font-size: 12px; padding: 2px 0;">`;
                    html += `<span style="color: #ffaa00;">&#9679;</span> ${req.name}`;
                    if (req.quantity > 1) html += ` <span style="color: #888;">×${req.quantity}</span>`;
                    html += `</div>`;
                } else if (req.property) {
                    // Property-based
                    const label = getPropertyLabel(req.property, req.minValue, req.maxValue);
                    html += `<div style="color: #ccc; font-size: 12px; padding: 2px 0;">`;
                    html += `<span style="color: #00ffff;">&#9679;</span> <span style="color: #00ffff;">${label}</span>`;
                    if (req.quantity > 1) html += ` <span style="color: #888;">×${req.quantity}</span>`;
                    html += ` <span style="color: #555; font-size: 10px;">(${req.name})</span>`;
                    html += `</div>`;
                }
            }
            html += `</div>`;
            
            // Disassembly methods
            if (recipe.disassemblyMethods) {
                const methods = Object.keys(recipe.disassemblyMethods).join(', ');
                html += `<div style="color: #666; font-size: 10px; margin-top: 4px;">Disassembly: ${methods}</div>`;
            }
            
            html += `</div>`;
        }
        
        if (filtered.length === 0) {
            html += `<div style="color: #666; text-align: center; padding: 30px;">No recipes match "${query}"</div>`;
        }
        
        return html;
    }
    
    _buildMaterialsTab(query) {
        const game = this.game;
        const q = query.toLowerCase().trim();
        let html = '';
        
        // Gather all base components
        const materials = [];
        for (const [compId, comp] of Object.entries(game.content.components)) {
            materials.push({ id: compId, ...comp });
        }
        
        // Sort alphabetically
        materials.sort((a, b) => a.name.localeCompare(b.name));
        
        // Filter by search query
        const filtered = q ? materials.filter(m => {
            if (m.name.toLowerCase().includes(q)) return true;
            if (m.id.toLowerCase().includes(q)) return true;
            // Search in property labels
            if (m.properties) {
                for (const [prop, val] of Object.entries(m.properties)) {
                    if (prop.toLowerCase().includes(q)) return true;
                    const label = getPropertyLabel(prop, val);
                    if (label.toLowerCase().includes(q)) return true;
                }
            }
            if (m.tags) {
                for (const tag of m.tags) {
                    if (tag.toLowerCase().includes(q)) return true;
                }
            }
            return false;
        }) : materials;
        
        html += `<div style="color: #888; font-size: 11px; margin-bottom: 10px;">${filtered.length} of ${materials.length} materials</div>`;
        
        for (const mat of filtered) {
            html += `<div style="background: #1a1a1a; border: 1px solid #333; border-left: 3px solid #888; padding: 10px 12px; margin-bottom: 6px;">`;
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">`;
            html += `<span style="color: #fff; font-weight: bold; font-size: 13px;">${mat.name}</span>`;
            if (mat.tags && mat.tags.length > 0) {
                html += `<span style="color: #555; font-size: 10px;">${mat.tags.join(', ')}</span>`;
            }
            html += `</div>`;
            
            // Properties
            if (mat.properties) {
                const propEntries = Object.entries(mat.properties).filter(([, v]) => v > 0);
                if (propEntries.length > 0) {
                    html += `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">`;
                    for (const [prop, val] of propEntries) {
                        const label = getPropertyLabel(prop, val);
                        // Color code by tier
                        const tierColor = val >= 3 ? '#ff6666' : val >= 2 ? '#ffaa00' : '#66cc66';
                        html += `<span style="background: #222; border: 1px solid ${tierColor}; color: ${tierColor}; padding: 2px 8px; border-radius: 3px; font-size: 11px;">${label}</span>`;
                    }
                    html += `</div>`;
                }
            } else {
                html += `<div style="color: #555; font-size: 11px; font-style: italic;">No properties</div>`;
            }
            
            // Weight/volume
            html += `<div style="color: #555; font-size: 10px; margin-top: 4px;">Weight: ${mat.weight || '?'}g · Volume: ${mat.volume || '?'}ml</div>`;
            
            html += `</div>`;
        }
        
        if (filtered.length === 0) {
            html += `<div style="color: #666; text-align: center; padding: 30px;">No materials match "${query}"</div>`;
        }
        
        return html;
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
        html += `<h3 style="color: #00ffff; margin-bottom: 15px;">Actions: ${this.getDisplayName(item)}</h3>`;
        
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
        
        // Item actions (use, treat, etc.)
        if (item.actions && item.actions.length > 0) {
            for (const action of item.actions) {
                if (action === 'use' && (item.type === 'consumable' || item.medicalEffect)) {
                    if (!hasContextActions) {
                        html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                        html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                        hasContextActions = true;
                    }
                    const btnColor = item.medicalEffect ? 'background: #226622; color: #44ff44;' : '';
                    const label = item.medicalEffect ? `Apply ${item.name}` : `Use ${item.name}`;
                    html += `<button class="small-btn" data-item-action="use" style="width: 100%; margin-bottom: 5px; ${btnColor}">${label}</button>`;
                }
                if (action === 'treat' && item.isMedkit) {
                    if (!hasContextActions) {
                        html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                        html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                        hasContextActions = true;
                    }
                    const supplyCount = item.pockets ? item.pockets[0].contents.length : 0;
                    html += `<button class="small-btn" data-item-action="treat" style="width: 100%; margin-bottom: 5px; background: #226622; color: #44ff44;">Treat Wounds (${supplyCount} supplies)</button>`;
                }
            }
        }
        
        // Inline container contents for opened containers
        if (item.isContainer && item.state && item.state.opened) {
            const allContents = item.contents || (item.pockets ? item.pockets.flatMap(p => p.contents || []) : []);
            if (allContents.length > 0) {
                if (!hasContextActions) {
                    html += `<div style="border-top: 1px solid #333; padding-top: 10px; margin-top: 10px;">`;
                    html += `<div style="color: #888; font-size: 12px; margin-bottom: 8px; text-transform: uppercase;">Item Specific:</div>`;
                    hasContextActions = true;
                }
                html += `<div style="color: #ffaa00; font-size: 13px; margin-bottom: 8px;">Contents:</div>`;
                for (let ci = 0; ci < allContents.length; ci++) {
                    const cItem = allContents[ci];
                    const qtyText = cItem.quantity ? ` (${cItem.quantity}${cItem.quantityUnit || ''})` : '';
                    html += `<div style="padding: 8px; background: #0a0a0a; border-left: 3px solid ${cItem.color || '#ffaa00'}; margin-bottom: 6px;">`;
                    html += `<div style="color: ${cItem.color || '#ffaa00'}; font-size: 15px; margin-bottom: 5px;">${cItem.name}${qtyText}</div>`;
                    html += `<div style="display: flex; gap: 5px; flex-wrap: wrap;">`;
                    // Direct consume button for food/drink
                    if ((cItem.type === 'food' || cItem.type === 'drink') && cItem.nutrition) {
                        const warn = cItem.state && cItem.state.contaminated ? ' ⚠' : '';
                        html += `<button class="small-btn" data-inline-action="consume" data-inline-index="${ci}" style="flex: 1; background: #226622; color: #44ff44;">Consume${warn}</button>`;
                    }
                    // Direct use button for medical/usable items
                    if (cItem.medicalEffect) {
                        html += `<button class="small-btn" data-inline-action="use" data-inline-index="${ci}" style="flex: 1; background: #226622; color: #44ff44;">Apply ${cItem.name}</button>`;
                    }
                    // Take out of container
                    html += `<button class="small-btn" data-inline-action="take" data-inline-index="${ci}" style="flex: 1;">Take</button>`;
                    html += `</div></div>`;
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
        
        // Inline container content action buttons (Consume/Use/Take)
        const inlineButtons = document.querySelectorAll('button[data-inline-action]');
        inlineButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.inlineAction;
                const idx = parseInt(btn.dataset.inlineIndex);
                const allContents = item.contents || (item.pockets ? item.pockets.flatMap(p => p.contents || []) : []);
                const contentItem = allContents[idx];
                if (!contentItem) return;
                
                if (action === 'consume') {
                    // Determine the correct source type for the content item
                    const contentSourceType = item.contents ? 'actions-container-item' : 'actions-pocket-item';
                    const contentSourceData = item.contents 
                        ? { containerId: item.id, itemIndex: idx }
                        : { containerId: item.id, pocketIndex: 0, itemIndex: idx };
                    this.actionsContext = { item: contentItem, sourceType: contentSourceType, sourceData: contentSourceData };
                    this.handleConsumeAction(contentItem, contentSourceType, contentSourceData);
                } else if (action === 'use') {
                    const contentSourceType = item.contents ? 'actions-container-item' : 'actions-pocket-item';
                    const contentSourceData = item.contents 
                        ? { containerId: item.id, itemIndex: idx }
                        : { containerId: item.id, pocketIndex: 0, itemIndex: idx };
                    this.actionsContext = { item: contentItem, sourceType: contentSourceType, sourceData: contentSourceData };
                    this.handleUseAction(contentItem, contentSourceType, contentSourceData);
                } else if (action === 'take') {
                    const player = this.game.player;
                    const result = player.addToInventory(contentItem);
                    if (result.success) {
                        // Remove from container
                        if (item.contents) {
                            item.contents.splice(idx, 1);
                        } else if (item.pockets) {
                            for (const pocket of item.pockets) {
                                const pi = pocket.contents ? pocket.contents.indexOf(contentItem) : -1;
                                if (pi !== -1) { pocket.contents.splice(pi, 1); break; }
                            }
                        }
                        this.game.ui.log(`Took ${contentItem.name} from ${item.name}.`, 'info');
                    } else {
                        this.game.ui.log(`No space for ${contentItem.name}.`, 'warning');
                    }
                    // Refresh the actions modal to show updated contents
                    this.showActionsModal(item, sourceType, sourceData);
                }
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
        } else if (action === 'treat') {
            this.handleTreatAction(item, sourceType, sourceData);
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
    
    removeItemFromSource(item, sourceType, sourceData) {
        const player = this.game.player;
        
        if (sourceType === 'actions-equipped') {
            player.equipment[sourceData.slot] = null;
        } else if (sourceType === 'actions-stored') {
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
    }
    
    handleUseAction(item, sourceType, sourceData) {
        const player = this.game.player;
        
        // Medical component use
        if (item.medicalEffect) {
            const anatomy = player.anatomy;
            let result;
            
            switch (item.medicalEffect) {
                case 'bandage':
                    result = anatomy.bandageWound();
                    break;
                case 'antiseptic':
                    result = anatomy.applyAntiseptic();
                    break;
                case 'painkiller':
                    result = anatomy.takePainkiller();
                    break;
                default:
                    result = { success: false, msg: `Unknown medical effect: ${item.medicalEffect}` };
            }
            
            if (result.success) {
                this.game.ui.log(result.msg, 'info');
                this.removeItemFromSource(item, sourceType, sourceData);
                // Medical actions cost a turn
                this.game.processTurn({ type: 'wait' });
            } else {
                this.game.ui.log(result.msg, 'warning');
            }
            
            this.actionsContext = null;
            this.showDetailedInventory();
            this.updatePanels();
            return;
        }
        
        // Legacy consumable heal (food/drink items with healAmount)
        if (item.type === 'consumable' && item.healAmount) {
            let healPerTurn = Math.floor(item.healAmount / item.healDuration);
            
            if (player.traitEffects && player.traitEffects.healingMod) {
                healPerTurn = Math.floor(healPerTurn * player.traitEffects.healingMod);
            }
            
            player.addStatusEffect({
                type: 'heal',
                value: healPerTurn,
                duration: item.healDuration,
                name: item.name
            });
            
            this.game.ui.log(`Used ${item.name}. Healing ${healPerTurn}/turn for ${item.healDuration} turns.`, 'info');
            this.removeItemFromSource(item, sourceType, sourceData);
            
            this.actionsContext = null;
            this.showDetailedInventory();
            this.updatePanels();
        }
    }
    
    handleTreatAction(item, sourceType, sourceData) {
        const player = this.game.player;
        const anatomy = player.anatomy;
        
        if (!item.isMedkit || !item.pockets) {
            this.game.ui.log('This item cannot be used for treatment.', 'warning');
            return;
        }
        
        const pocket = item.pockets[0];
        if (!pocket || pocket.contents.length === 0) {
            this.game.ui.log(`${item.name} is empty.`, 'warning');
            return;
        }
        
        const summary = anatomy.getMedicalSummary();
        let treated = false;
        const messages = [];
        
        // Auto-apply relevant meds in priority order:
        // 1. Painkiller if in shock
        if (summary.inShock && !summary.painSuppressed) {
            const pkIdx = pocket.contents.findIndex(c => c.medicalEffect === 'painkiller');
            if (pkIdx !== -1) {
                const result = anatomy.takePainkiller();
                pocket.contents.splice(pkIdx, 1);
                messages.push(result.msg);
                treated = true;
            }
        }
        
        // 2. Bandage worst unbandaged wound
        if (summary.unbandaged > 0) {
            const bIdx = pocket.contents.findIndex(c => c.medicalEffect === 'bandage');
            if (bIdx !== -1) {
                const result = anatomy.bandageWound();
                if (result.success) {
                    pocket.contents.splice(bIdx, 1);
                    messages.push(result.msg);
                    treated = true;
                }
            }
        }
        
        // 3. Antiseptic on infected or at-risk wounds
        if (summary.infected > 0 || summary.unsterilized > 0) {
            const aIdx = pocket.contents.findIndex(c => c.medicalEffect === 'antiseptic');
            if (aIdx !== -1) {
                const result = anatomy.applyAntiseptic();
                if (result.success) {
                    pocket.contents.splice(aIdx, 1);
                    messages.push(result.msg);
                    treated = true;
                }
            }
        }
        
        if (treated) {
            for (const msg of messages) {
                this.game.ui.log(msg, 'info');
            }
            // Treatment costs a turn
            this.game.processTurn({ type: 'wait' });
        } else {
            // Check if we have supplies but nothing to treat
            const hasSupplies = pocket.contents.some(c => c.medicalEffect);
            if (!hasSupplies) {
                this.game.ui.log(`${item.name} has no medical supplies left.`, 'warning');
            } else {
                this.game.ui.log('No treatable conditions right now.', 'info');
            }
        }
        
        this.actionsContext = null;
        this.showDetailedInventory();
        this.updatePanels();
    }
    
    showOpenToolSelection(item, sourceType, sourceData) {
        const player = this.game.player;
        const content = document.getElementById('detailed-inventory-content');
        const tools = this.game.itemSystem.getAvailableOpeningTools(player, item);
        
        let html = '<div style="padding: 20px;">';
        html += `<button id="close-tool-selection" class="small-btn" style="margin-bottom: 15px;">← Back</button>`;
        html += `<h3 style="color: #00ffff; margin-bottom: 15px;">Open: ${this.getDisplayName(item)}</h3>`;
        
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
            
            this.updatePanels();
            // Stay on the actions modal so user sees the now-opened container with inline contents
            this.showActionsModal(item, sourceType, sourceData);
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
        
        // Check top-level inventory
        let container = player.inventory.find(i => i.id === containerId);
        
        // Check equipment slots
        if (!container) {
            for (const slot of Object.values(player.equipment)) {
                if (slot && slot.id === containerId) { container = slot; break; }
            }
        }
        
        // Check carried items
        if (!container && player.carrying?.leftHand?.id === containerId) container = player.carrying.leftHand;
        if (!container && player.carrying?.rightHand?.id === containerId) container = player.carrying.rightHand;
        
        // Check nested: items inside pockets of equipped items (e.g. medkit in backpack)
        if (!container) {
            for (const slot of Object.values(player.equipment)) {
                if (slot && slot.pockets) {
                    for (const pocket of slot.pockets) {
                        if (pocket.contents) {
                            const found = pocket.contents.find(i => i.id === containerId);
                            if (found) { container = found; break; }
                        }
                    }
                    if (container) break;
                }
            }
        }
        
        // Check nested: items inside inventory containers
        if (!container) {
            for (const invItem of player.inventory) {
                if (invItem.isContainer && invItem.contents) {
                    const found = invItem.contents.find(i => i.id === containerId);
                    if (found) { container = found; break; }
                }
                if (invItem.pockets) {
                    for (const pocket of invItem.pockets) {
                        if (pocket.contents) {
                            const found = pocket.contents.find(i => i.id === containerId);
                            if (found) { container = found; break; }
                        }
                    }
                    if (container) break;
                }
            }
        }
        
        // Check ground
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
