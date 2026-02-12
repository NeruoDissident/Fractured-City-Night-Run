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
import { CraftingSystem } from '../systems/CraftingSystem.js';
import { WorldObjectSystem } from '../systems/WorldObjectSystem.js';
import { TimeSystem } from '../systems/TimeSystem.js';
import { LightingSystem } from '../systems/LightingSystem.js';
import { MobileControls } from '../ui/MobileControls.js';

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
        this.timeSystem = null;
        this.lightingSystem = null;
        this.mobileControls = null;
        
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
        
        this.mobileControls = new MobileControls(this);
        this.mobileControls.init();
        
        this.ui.showCharacterCreation();
        
        // Expose game instance to console for debugging
        window.game = this;
        console.log('Game initialized. Access via window.game or just "game" in console.');
        console.log('Try: game.content.components or game.content.itemFamilies');
    }
    
    startGame(characterData) {
        this.world = new World(this);
        this.world.init();
        
        this.fov = new FoVSystem(this.world);
        this.soundSystem = new SoundSystem(this);
        this.timeSystem = new TimeSystem();
        this.lightingSystem = new LightingSystem(this);
        this.itemSystem = new ItemSystem(this);
        this.craftingSystem = new CraftingSystem(this);
        this.worldObjectSystem = new WorldObjectSystem(this);
        
        this.player = new Player(this, characterData);
        const spawnPos = this.world.getSpawnPosition();
        this.player.x = spawnPos.x;
        this.player.y = spawnPos.y;
        
        this.world.addEntity(this.player);
        
        // Starting loadout
        this.giveStartingLoadout();
        
        this.gameState = 'playing';
        this.isRunning = true;
        
        this.ui.log('Welcome to Fractured City.', 'info');
        this.ui.log('Survive. Extract. Repeat.', 'info');
        this.ui.log('Press [X] to inspect tiles, [?] for help.', 'info');
        this.ui.log(`Time: ${this.timeSystem.getTimeString()} - ${this.timeSystem.getTimePeriod()} (Day ${this.timeSystem.getDay()})`, 'info');
        console.log(`[TimeSystem] Started at ${this.timeSystem.getTimeString()}, outdoor ambient: ${this.timeSystem.getOutdoorAmbient().toFixed(2)}`);
        console.log(`[LightingSystem] Initialized, effective vision range: ${this.lightingSystem.getEffectiveVisionRadius(8)}`);
        
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
        } else if (action.type === 'ascend') {
            playerActed = this.player.tryAscend();
        } else if (action.type === 'descend') {
            playerActed = this.player.tryDescend();
        }
        
        if (playerActed) {
            this.turnCount++;
            this.timeSystem.tick();
            this.lightingSystem.consumeFuel();
            this.player.processStatusEffects();
            this.updateFoV();
            this.world.processTurn();
            this.soundSystem.processTurn();
            this.checkGameOver();
        }
        
        this.render();
    }
    
    /**
     * Advance game turns for actions that take time
     * Used by systems like WorldObjectSystem for door interactions, crafting, etc.
     * @param {number} turns - Number of turns to advance
     */
    advanceTurn(turns = 1) {
        if (!this.isRunning) return;
        
        for (let i = 0; i < turns; i++) {
            this.turnCount++;
            this.timeSystem.tick();
            this.lightingSystem.consumeFuel();
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
        const baseVisionRange = this.player.anatomy.getVisionRange();
        
        // Lighting affects effective vision radius
        const effectiveRange = this.lightingSystem 
            ? this.lightingSystem.getEffectiveVisionRadius(baseVisionRange)
            : baseVisionRange;
        
        this.fov.calculate(this.player.x, this.player.y, effectiveRange, this.player.z);
        
        // Calculate lighting for the visible area
        if (this.lightingSystem) {
            this.lightingSystem.calculate(this.player.x, this.player.y, this.player.z, effectiveRange);
        }
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
    
    giveStartingLoadout() {
        const p = this.player;
        const c = this.content;
        
        // Clothing
        const coat = c.createItem('coat');
        if (coat) p.equipment.torso = coat;
        
        const pants = c.createItem('pants');
        if (pants) p.equipment.legs = pants;
        
        // Backpack
        const backpack = c.createItem('backpack');
        if (backpack) p.equipment.back = backpack;
        
        // Flashlight in right hand (comes pre-loaded with batteries)
        const flashlight = c.createItem('flashlight');
        if (flashlight) p.equipment.rightHand = flashlight;
        
        // Lantern in left hand (comes pre-loaded with fuel)
        const lantern = c.createItem('lantern');
        if (lantern) p.equipment.leftHand = lantern;
        
        console.log('[Loadout] Starting gear equipped:', {
            torso: p.equipment.torso?.name,
            legs: p.equipment.legs?.name,
            back: p.equipment.back?.name,
            rightHand: p.equipment.rightHand?.name,
            leftHand: p.equipment.leftHand?.name
        });
    }
    
    interactWithWorldObject() {
        // Check adjacent tiles (including current position) for world objects
        const range = 1;
        const candidates = [];
        
        for (let dy = -range; dy <= range; dy++) {
            for (let dx = -range; dx <= range; dx++) {
                const checkX = this.player.x + dx;
                const checkY = this.player.y + dy;
                const worldObject = this.world.getWorldObjectAt(checkX, checkY, this.player.z);
                
                if (worldObject) {
                    const distance = Math.abs(dx) + Math.abs(dy); // Manhattan distance
                    candidates.push({ object: worldObject, distance, dx, dy });
                }
            }
        }
        
        if (candidates.length === 0) {
            // No world objects nearby - check for ground items at player position
            const groundItems = this.world.getItemsAt(this.player.x, this.player.y, this.player.z);
            if (groundItems.length > 0) {
                this.ui.showGroundItemsModal();
                return;
            }
            this.ui.log('Nothing to interact with nearby.', 'info');
            return;
        }
        
        // Sort by distance, prefer closest
        candidates.sort((a, b) => a.distance - b.distance);
        
        // If multiple at same distance, could show selection UI, but for now just take first
        const closest = candidates[0];
        this.ui.showWorldObjectModal(closest.object);
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
        
        this.world.render(this.renderer, cameraX, cameraY, viewWidth, viewHeight, this.fov, this.player.z, this.lightingSystem);
        
        if (this.inspectMode) {
            const cursorScreenX = this.inspectCursor.x - cameraX;
            const cursorScreenY = this.inspectCursor.y - cameraY;
            
            if (cursorScreenX >= 0 && cursorScreenX < viewWidth && 
                cursorScreenY >= 0 && cursorScreenY < viewHeight) {
                this.renderer.drawInspectCursor(cursorScreenX, cursorScreenY);
            }
            
            this.ui.updateCharacterPanel();
            this.ui.updateMinimap();
            this.ui.updateInspectInfo(this.inspectCursor.x, this.inspectCursor.y);
        } else {
            this.ui.updatePanels();
        }
        
        if (this.mobileControls) {
            this.mobileControls.updateHUD();
        }
    }
}
