export class InputHandler {
    constructor(game) {
        this.game = game;
        this.keyMap = {
            'ArrowUp': { type: 'move', dx: 0, dy: -1 },
            'ArrowDown': { type: 'move', dx: 0, dy: 1 },
            'ArrowLeft': { type: 'move', dx: -1, dy: 0 },
            'ArrowRight': { type: 'move', dx: 1, dy: 0 },
            'w': { type: 'move', dx: 0, dy: -1 },
            's': { type: 'move', dx: 0, dy: 1 },
            'a': { type: 'move', dx: -1, dy: 0 },
            'd': { type: 'move', dx: 1, dy: 0 },
            'W': { type: 'move', dx: 0, dy: -1 },
            'S': { type: 'move', dx: 0, dy: 1 },
            'A': { type: 'move', dx: -1, dy: 0 },
            'D': { type: 'move', dx: 1, dy: 0 },
            ' ': { type: 'wait' },
            'g': { type: 'pickup' },
            'G': { type: 'grabAll' },
            '<': { type: 'ascend' },
            '>': { type: 'descend' }
        };
    }
    
    init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    /**
     * Map a movement key to a view-relative intent.
     * In first-person view: forward / back / left / right (left & right turn,
     * or strafe when Shift is held). In top-down view the same keys are
     * absolute screen directions and are handled by keyMap instead.
     */
    _relativeIntent(key) {
        switch (key) {
            case 'w': case 'W': case 'ArrowUp':    return 'forward';
            case 's': case 'S': case 'ArrowDown':  return 'back';
            case 'a': case 'A': case 'ArrowLeft':  return 'left';
            case 'd': case 'D': case 'ArrowRight': return 'right';
            default: return null;
        }
    }
    
    handleKeyDown(e) {
        // Allow typing in input fields (e.g. wiki search) without triggering game keys
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
            if (e.key === 'Escape') {
                document.activeElement.blur();
            }
            return;
        }
        
        if (e.key === 'c' || e.key === 'C') {
            e.preventDefault();
            this.game.ui.toggleCharacterScreen();
            return;
        }
        
        if (e.key === 'i' || e.key === 'I') {
            e.preventDefault();
            this.game.ui.toggleInventoryScreen();
            return;
        }
        
        if (e.key === 'v' || e.key === 'V') {
            e.preventDefault();
            this.game.ui.toggleCraftingScreen();
            return;
        }

        if (e.key === 'F9') {
            e.preventDefault();
            if (this.game.gameState === 'playing') {
                this.game.debugSpawn(e.shiftKey ? 'debug_neutral' : 'debug_hostile');
            }
            return;
        }

        if (e.key === 'o' || e.key === 'O') {
            e.preventDefault();
            if (this.game.gameState === 'playing' && !this.game.inspectMode && !this.game.interactMode) {
                this.game.startAutoExplore();
            }
            return;
        }
        
        if (e.key === '?') {
            e.preventDefault();
            this.game.ui.toggleHelpScreen();
            return;
        }

        if (e.key === '`' || e.key === '~') {
            e.preventDefault();
            if (this.game.gameState === 'playing') {
                this.game.toggleViewMode();
            }
            return;
        }
        
        if (e.key === 'x' || e.key === 'X') {
            e.preventDefault();
            if (this.game.gameState === 'playing') {
                this.game.toggleInspectMode();
            }
            return;
        }
        
        if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
            if (this.game.gameState === 'playing' && !this.game.inspectMode && !this.game.interactMode) {
                this.game.enterInteractMode();
            }
            return;
        }
        
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            if (this.game.gameState === 'overworld') {
                // M on overworld — no-op (already on map)
                return;
            }
            if (this.game.gameState === 'playing') {
                if (this.game.inspectMode) return;
                // Hold M vs tap: tap = cycle movement, but we need map toggle too.
                // Use shift+M for map overlay.
                if (e.shiftKey) {
                    // Shift+M: not used yet — reserved for map overlay overlay
                    return;
                }
                this.game.processTurn({ type: 'cycle_movement' });
            }
            return;
        }
        
        if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            if (this.game.gameState === 'playing' && !this.game.inspectMode && this.game.player) {
                const stance = this.game.player.cycleCombatStance();
                if (stance) {
                    this.game.ui.log(`Combat stance: ${stance.name}`, 'info');
                } else {
                    this.game.ui.log('No stances unlocked — purchase Combat Tactics talents [Q].', 'warning');
                }
                this.game.render();
            }
            return;
        }
        
        if (e.key === 'q' || e.key === 'Q') {
            e.preventDefault();
            if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                this.game.ui.toggleAbilityPanel();
            }
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            if (this.game.gameState === 'playing') {
                this.game.returnToOverworld();
            } else if (this.game.gameState === 'overworld') {
                this.game.closeOverworld();
            }
            return;
        }
        
        if (e.key === 'b' || e.key === 'B') {
            e.preventDefault();
            this.game.ui.toggleCombatOverlay();
            return;
        }
        
        if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            if (this.game.gameState === 'playing') {
                this.game.player.exploreMode = !this.game.player.exploreMode;
                const status = this.game.player.exploreMode ? 'ENABLED' : 'DISABLED';
                const color = this.game.player.exploreMode ? 'success' : 'info';
                this.game.ui.log(`Explore Mode ${status} (Hunger/Thirst frozen)`, color);
            }
            return;
        }
        
        if (e.key === 'Escape') {
            e.preventDefault();
            // Close any open modals first
            if (this.game.ui.closeAllModals()) {
                return;
            }
            if (this.game.autoTravelTarget) {
                this.game.cancelAutoTravel('Auto-travel cancelled.');
                return;
            }
            // Cancel interact mode
            if (this.game.interactMode) {
                this.game.cancelInteractMode();
                return;
            }
            // Then exit inspect mode if no modals were open
            if (this.game.inspectMode) {
                this.game.toggleInspectMode();
            }
            return;
        }
        
        // Handle staircase navigation (< and >) - check before gameState
        if ((e.key === '<' || e.key === '>') && this.game.gameState === 'playing' && !this.game.inspectMode) {
            e.preventDefault();
            const tile = this.game.world.getTile(this.game.player.x, this.game.player.y, this.game.player.z);
            if (tile.isStaircase || tile.isManhole || tile.isLadder || tile.isSiteExit) {
                const action = this.keyMap[e.key];
                this.game.processTurn(action);
            } else {
                this.game.ui.log('There are no stairs here.', 'warning');
            }
            return;
        }
        
        // ── Overworld navigation ────────────────────────────────────────────────────
        if (this.game.gameState === 'overworld') {
            const ow = this.game.overworldMap;
            const action = this.keyMap[e.key];

            if (action && action.type === 'move') {
                e.preventDefault();
                ow.moveCursor(action.dx, action.dy);
                this.game.render();
                return;
            }

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const onActiveZone = ow.cursorCol === this.game._currentZoneCol &&
                                     ow.cursorRow === this.game._currentZoneRow &&
                                     this.game.world;
                if (onActiveZone) {
                    // Return to the zone already loaded
                    this.game.closeOverworld();
                } else {
                    // Travel to a different zone (generates new world)
                    this.game.dropIntoZone(ow.cursorCol, ow.cursorRow);
                }
                return;
            }

            return; // block all other keys on overworld
        }

        if (this.game.gameState !== 'playing') return;
        
        const firstPerson = this.game.isFirstPerson();
        const intent = this._relativeIntent(e.key);

        // Interact mode: direction keys select a target
        if (this.game.interactMode) {
            if (e.key === ' ') {
                e.preventDefault();
                this.game.interactInDirection(0, 0);
                return;
            }
            if (firstPerson) {
                if (intent) {
                    e.preventDefault();
                    const d = this.game.relativeDelta(intent);
                    this.game.interactInDirection(d.dx, d.dy);
                }
                return;
            }
            const action = this.keyMap[e.key];
            if (action && action.type === 'move') {
                e.preventDefault();
                this.game.interactInDirection(action.dx, action.dy);
            }
            return;
        }
        
        if (this.game.inspectMode) {
            if (firstPerson) {
                if (intent) {
                    e.preventDefault();
                    const d = this.game.relativeDelta(intent);
                    this.game.moveInspectCursor(d.dx, d.dy);
                }
                return;
            }
            const action = this.keyMap[e.key];
            if (action && action.type === 'move') {
                e.preventDefault();
                this.game.moveInspectCursor(action.dx, action.dy);
            }
            return;
        }

        // First-person movement: W forward, S backpedal, A/D turn, Shift+A/D strafe
        if (firstPerson && intent) {
            e.preventDefault();
            if (this.game.autoTravelTarget) {
                this.game.cancelAutoTravel();
            }
            this.game.processTurn(this.firstPersonAction(intent, e.shiftKey));
            return;
        }
        
        const action = this.keyMap[e.key];
        if (action) {
            e.preventDefault();
            if (this.game.autoTravelTarget) {
                this.game.cancelAutoTravel();
            }
            this.game.processTurn(action);
        }
    }

    /**
     * Build the processTurn action for a first-person movement intent.
     * @param {'forward'|'back'|'left'|'right'} intent
     * @param {boolean} strafe - true to sidestep instead of turning
     */
    firstPersonAction(intent, strafe = false) {
        if (intent === 'forward') {
            const d = this.game.relativeDelta('forward');
            return { type: 'move', dx: d.dx, dy: d.dy };
        }
        if (intent === 'back') {
            const d = this.game.relativeDelta('back');
            return { type: 'move', dx: d.dx, dy: d.dy, keepFacing: true };
        }
        if (strafe) {
            const d = this.game.relativeDelta(intent);
            return { type: 'move', dx: d.dx, dy: d.dy, keepFacing: true };
        }
        return { type: 'turn', steps: intent === 'left' ? -1 : 1 };
    }
}
