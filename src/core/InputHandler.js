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
            'G': { type: 'pickup' }
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
        
        if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            if (this.game.gameState === 'playing' && !this.game.inspectMode) {
                this.game.processTurn({ type: 'cycle_movement' });
            }
            return;
        }
        
        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.game.inspectMode) {
                this.game.toggleInspectMode();
            }
            return;
        }
        
        if (this.game.gameState !== 'playing') return;
        
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
