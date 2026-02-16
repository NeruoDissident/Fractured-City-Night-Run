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
    
    handleKeyDown(e) {
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
        
        if (e.key === '?') {
            e.preventDefault();
            this.game.ui.toggleHelpScreen();
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
            if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                this.game.processTurn({ type: 'cycle_movement' });
            }
            return;
        }
        
        if (e.key === 't' || e.key === 'T') {
            e.preventDefault();
            if (this.game.gameState === 'playing' && !this.game.inspectMode && this.game.player) {
                const stance = this.game.player.cycleCombatStance();
                this.game.ui.log(`Combat stance: ${stance.name}`, 'info');
                this.game.render();
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
            if (tile.isStaircase || tile.isManhole || tile.isLadder) {
                const action = this.keyMap[e.key];
                this.game.processTurn(action);
            } else {
                this.game.ui.log('There are no stairs here.', 'warning');
            }
            return;
        }
        
        if (this.game.gameState !== 'playing') return;
        
        // Interact mode: direction keys select a target
        if (this.game.interactMode) {
            const action = this.keyMap[e.key];
            if (action && action.type === 'move') {
                e.preventDefault();
                this.game.interactInDirection(action.dx, action.dy);
            }
            return;
        }
        
        if (this.game.inspectMode) {
            const action = this.keyMap[e.key];
            if (action && action.type === 'move') {
                e.preventDefault();
                this.game.moveInspectCursor(action.dx, action.dy);
            }
            return;
        }
        
        const action = this.keyMap[e.key];
        if (action) {
            e.preventDefault();
            this.game.processTurn(action);
        }
    }
}
