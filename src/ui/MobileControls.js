export class MobileControls {
    constructor(game) {
        this.game = game;
        this.isMobile = false;
        this.activePanel = 'log-panel';
        this.drawerOpen = false;
    }

    init() {
        // Always bind events — CSS controls visibility via media queries.
        // This ensures buttons work whether testing on desktop or on real mobile.
        this.isMobile = this.detectMobile();

        this.initDpad();
        this.initActionButtons();
        this.initPanelTabs();

        if (this.isMobile) {
            this.preventZoom();
        }

        // Re-check on resize/orientation change
        window.matchMedia('(max-width: 1024px), (pointer: coarse)').addEventListener('change', (e) => {
            this.isMobile = e.matches;
        });
    }

    detectMobile() {
        const mq = window.matchMedia('(max-width: 1024px), (pointer: coarse)');
        return mq.matches;
    }

    /**
     * Bind a handler to a button that works for both touch and mouse
     * without double-firing. touchstart fires first and sets a flag
     * so the subsequent click is ignored.
     */
    bindButton(btn, handler) {
        let touchFired = false;

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchFired = true;
            handler();
        }, { passive: false });

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (touchFired) {
                touchFired = false;
                return;
            }
            handler();
        });
    }

    initDpad() {
        const INITIAL_DELAY = 300; // ms before repeat starts
        const REPEAT_RATE = 120;   // ms between repeats

        const dpadBtns = document.querySelectorAll('.dpad-btn[data-dx]');
        dpadBtns.forEach(btn => {
            const dx = parseInt(btn.dataset.dx);
            const dy = parseInt(btn.dataset.dy);
            let initialTimer = null;
            let repeatTimer = null;

            const startRepeat = () => {
                // Fire immediately
                this.handleMove(dx, dy);
                // After initial delay, start repeating
                initialTimer = setTimeout(() => {
                    repeatTimer = setInterval(() => {
                        this.handleMove(dx, dy);
                    }, REPEAT_RATE);
                }, INITIAL_DELAY);
            };

            const stopRepeat = () => {
                if (initialTimer) { clearTimeout(initialTimer); initialTimer = null; }
                if (repeatTimer) { clearInterval(repeatTimer); repeatTimer = null; }
            };

            btn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                startRepeat();
            });
            btn.addEventListener('pointerup', stopRepeat);
            btn.addEventListener('pointerleave', stopRepeat);
            btn.addEventListener('pointercancel', stopRepeat);
        });

        // Wait button (center of D-pad) — single press only
        const waitBtn = document.getElementById('dpad-wait');
        if (waitBtn) {
            waitBtn.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleAction('wait');
            });
        }
    }

    initActionButtons() {
        const actionBtns = document.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
            const action = btn.dataset.action;
            this.bindButton(btn, () => this.handleAction(action));
        });
    }

    initPanelTabs() {
        const tabs = document.querySelectorAll('.panel-tab');
        tabs.forEach(tab => {
            this.bindButton(tab, () => {
                const panelId = tab.dataset.panel;

                // Toggle drawer: tap active tab to close, tap other to switch
                if (this.activePanel === panelId && this.drawerOpen) {
                    this.closeDrawer();
                } else {
                    this.activePanel = panelId;
                    this.openDrawer();
                    this.updateDrawerContent();

                    // Update active tab styling
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                }
            });
        });
    }

    handleMove(dx, dy) {
        if (!this.game.isRunning) return;

        if (this.game.inspectMode) {
            this.game.moveInspectCursor(dx, dy);
        } else if (this.game.gameState === 'playing') {
            this.game.processTurn({ type: 'move', dx, dy });
        }
    }

    handleAction(action) {
        switch (action) {
            case 'wait':
                if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                    this.game.processTurn({ type: 'wait' });
                }
                break;

            case 'interact':
                if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                    this.game.interactWithWorldObject();
                }
                break;

            case 'inspect':
                if (this.game.gameState === 'playing') {
                    this.game.toggleInspectMode();
                }
                break;

            case 'inventory':
                this.game.ui.toggleInventoryScreen();
                break;

            case 'character':
                this.game.ui.toggleCharacterScreen();
                break;

            case 'move_mode':
                if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                    this.game.processTurn({ type: 'cycle_movement' });
                }
                break;

            case 'ascend':
                if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                    const tileUp = this.game.world.getTile(this.game.player.x, this.game.player.y, this.game.player.z);
                    if (tileUp.isStaircase || tileUp.isManhole || tileUp.isLadder) {
                        this.game.processTurn({ type: 'ascend' });
                    } else {
                        this.game.ui.log('There are no stairs here.', 'warning');
                    }
                }
                break;

            case 'descend':
                if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                    const tileDown = this.game.world.getTile(this.game.player.x, this.game.player.y, this.game.player.z);
                    if (tileDown.isStaircase || tileDown.isManhole || tileDown.isLadder) {
                        this.game.processTurn({ type: 'descend' });
                    } else {
                        this.game.ui.log('There are no stairs here.', 'warning');
                    }
                }
                break;

            case 'craft':
                this.game.ui.toggleCraftingScreen();
                break;

            case 'help':
                this.game.ui.toggleHelpScreen();
                break;
        }
    }

    openDrawer() {
        const drawer = document.getElementById('mobile-panel-drawer');
        if (drawer) {
            drawer.classList.remove('hidden');
            this.drawerOpen = true;
        }
    }

    closeDrawer() {
        const drawer = document.getElementById('mobile-panel-drawer');
        if (drawer) {
            drawer.classList.add('hidden');
            this.drawerOpen = false;
        }
    }

    updateDrawerContent() {
        const content = document.getElementById('mobile-panel-content');
        if (!content) return;

        // Special handling for minimap — copy canvas image
        if (this.activePanel === 'minimap-panel') {
            const srcCanvas = document.getElementById('minimap-canvas');
            if (srcCanvas) {
                let destCanvas = content.querySelector('canvas');
                if (!destCanvas) {
                    content.innerHTML = '';
                    destCanvas = document.createElement('canvas');
                    destCanvas.style.width = '100%';
                    destCanvas.style.maxHeight = '40vh';
                    destCanvas.style.imageRendering = 'pixelated';
                    destCanvas.style.display = 'block';
                    content.appendChild(destCanvas);
                }
                destCanvas.width = srcCanvas.width;
                destCanvas.height = srcCanvas.height;
                const destCtx = destCanvas.getContext('2d');
                destCtx.drawImage(srcCanvas, 0, 0);
            }
            return;
        }

        const sourcePanel = document.getElementById(this.activePanel);
        if (sourcePanel) {
            // Clone the panel content (skip the h3 header)
            const children = sourcePanel.querySelectorAll(':scope > *:not(h3)');
            let html = '';
            children.forEach(child => {
                html += child.outerHTML;
            });
            content.innerHTML = html;
        }
    }

    updateHUD() {
        if (!this.isMobile || !this.game.player) return;

        const player = this.game.player;

        // HP display
        const hpEl = document.getElementById('mobile-hp');
        if (hpEl) {
            const hpPct = Math.round((player.hp / player.maxHP) * 100);
            hpEl.textContent = `HP: ${player.hp}/${player.maxHP}`;
            if (hpPct > 60) hpEl.style.color = '#44ff44';
            else if (hpPct > 30) hpEl.style.color = '#ffaa00';
            else hpEl.style.color = '#ff4444';
        }

        // Status (movement mode)
        const statusEl = document.getElementById('mobile-status');
        if (statusEl) {
            const mode = player.movementMode || 'walk';
            const modeNames = { walk: 'Walk', run: 'Run', crouch: 'Crouch', prone: 'Prone' };
            statusEl.textContent = modeNames[mode] || mode;
            statusEl.style.color = mode === 'run' ? '#ffaa00' : mode === 'crouch' ? '#8888ff' : mode === 'prone' ? '#888888' : '#00ff00';
        }

        // Zone/biome
        const zoneEl = document.getElementById('mobile-zone');
        if (zoneEl && this.game.world) {
            const biome = this.game.world.getBiomeAt(player.x, player.y);
            const biomeNames = {
                urban_core: 'Urban', suburbs: 'Suburbs', industrial: 'Industrial',
                rich_neighborhood: 'Rich', rural: 'Rural', forest: 'Forest',
                ruins: 'Ruins', unknown: '???'
            };
            const zLabel = player.z === 0 ? '' : player.z > 0 ? ` F${player.z}` : ` B${Math.abs(player.z)}`;
            zoneEl.textContent = (biomeNames[biome] || biome) + zLabel;
        }

        // Update drawer if open
        if (this.drawerOpen) {
            this.updateDrawerContent();
        }
    }

    preventZoom() {
        // Prevent double-tap zoom
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) {
                e.preventDefault();
            }
        }, { passive: false });

        // Prevent pinch zoom
        document.addEventListener('gesturestart', (e) => {
            e.preventDefault();
        }, { passive: false });
    }
}
