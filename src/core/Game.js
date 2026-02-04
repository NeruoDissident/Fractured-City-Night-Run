import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { World } from '../world/World.js';
import { ContentManager } from '../content/ContentManager.js';
import { UIManager } from '../ui/UIManager.js';
import { Player } from '../entities/Player.js';
import { FoVSystem } from '../systems/FoVSystem.js';
import { SoundSystem } from '../systems/SoundSystem.js';
import { CharacterCreationSystem } from '../systems/CharacterCreationSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';

export class Game {
    constructor() {
        this.renderer = null;
        this.input = null;
        this.world = null;
        this.content = null;
        this.ui = null;
        this.player = null;
        this.fov = null;
        this.soundSystem = null;
        
        this.isRunning = false;
        this.turnCount = 0;
        this.gameState = 'character_creation';
        
        this.inspectMode = false;
        this.inspectCursor = { x: 0, y: 0 };
    }
    
    init() {
        this.content = new ContentManager();
        this.content.loadContent();
        
        this.charCreationSystem = new CharacterCreationSystem();
        
        this.renderer = new Renderer();
        this.renderer.init();
        
        this.ui = new UIManager(this);
        this.ui.init();
        
        this.input = new InputHandler(this);
        this.input.init();
        
        this.ui.showCharacterCreation();
    }
    
    startGame(characterData) {
        this.world = new World(this);
        this.world.init();
        
        this.fov = new FoVSystem(this.world);
        this.soundSystem = new SoundSystem(this);
        this.itemSystem = new ItemSystem(this);
        
        this.player = new Player(this, characterData);
        const spawnPos = this.world.getSpawnPosition();
        this.player.x = spawnPos.x;
        this.player.y = spawnPos.y;
        
        this.world.addEntity(this.player);
        
        this.gameState = 'playing';
        this.isRunning = true;
        
        this.ui.log('Welcome to Fractured City.', 'info');
        this.ui.log('Survive. Extract. Repeat.', 'info');
        this.ui.log('Press [X] to inspect tiles, [?] for help.', 'info');
        
        this.updateFoV();
        this.render();
    }
    
    processTurn(action) {
        if (!this.isRunning) return;
        
        let playerActed = false;
        
        if (action.type === 'move') {
            playerActed = this.player.tryMove(action.dx, action.dy);
        } else if (action.type === 'wait') {
            playerActed = true;
        } else if (action.type === 'pickup') {
            playerActed = this.player.tryPickup();
        } else if (action.type === 'cycle_movement') {
            playerActed = this.player.cycleMovementMode();
        }
        
        if (playerActed) {
            this.turnCount++;
            this.player.processStatusEffects();
            this.updateFoV();
            this.world.processTurn();
            this.soundSystem.processTurn();
            this.checkGameOver();
        }
        
        this.render();
    }
    
    updateFoV() {
        if (!this.fov) {
            console.error('FoV system not initialized!');
            return;
        }
        const visionRange = this.player.anatomy.getVisionRange();
        this.fov.calculate(this.player.x, this.player.y, visionRange);
    }
    
    toggleInspectMode() {
        this.inspectMode = !this.inspectMode;
        
        if (this.inspectMode) {
            this.inspectCursor.x = this.player.x;
            this.inspectCursor.y = this.player.y;
            this.ui.log('Inspect mode: Use arrow keys to move cursor, [X] or [Esc] to exit.', 'info');
        } else {
            this.ui.log('Inspect mode off.', 'info');
        }
        
        this.render();
    }
    
    moveInspectCursor(dx, dy) {
        this.inspectCursor.x += dx;
        this.inspectCursor.y += dy;
        this.render();
    }
    
    checkGameOver() {
        if (this.player.isDead()) {
            this.gameState = 'game_over';
            this.isRunning = false;
            this.ui.log('You have died. Run ended.', 'combat');
            this.ui.showGameOver(false);
        }
    }
    
    completeRun() {
        this.gameState = 'run_complete';
        this.isRunning = false;
        this.ui.log('Extraction successful! Run complete.', 'info');
        this.ui.showGameOver(true);
    }
    
    render() {
        this.renderer.clear();
        
        const viewWidth = this.renderer.tilesX;
        const viewHeight = this.renderer.tilesY;
        const cameraX = this.player.x - Math.floor(viewWidth / 2);
        const cameraY = this.player.y - Math.floor(viewHeight / 2);
        
        this.world.render(this.renderer, cameraX, cameraY, viewWidth, viewHeight, this.fov);
        
        if (this.inspectMode) {
            const cursorScreenX = this.inspectCursor.x - cameraX;
            const cursorScreenY = this.inspectCursor.y - cameraY;
            
            if (cursorScreenX >= 0 && cursorScreenX < viewWidth && 
                cursorScreenY >= 0 && cursorScreenY < viewHeight) {
                this.renderer.drawInspectCursor(cursorScreenX, cursorScreenY);
            }
            
            this.ui.updateCharacterPanel();
            this.ui.updateInventoryPanel();
            this.ui.updateInspectInfo(this.inspectCursor.x, this.inspectCursor.y);
        } else {
            this.ui.updatePanels();
        }
    }
}
