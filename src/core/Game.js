import { Renderer } from './Renderer.js';
import { SpriteManager } from './SpriteManager.js';
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
import { CombatSystem } from '../systems/CombatSystem.js';
import { CombatEffects } from '../systems/CombatEffects.js';
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
        
        this.interactMode = false;
        this.interactCandidates = null;
    }
    
    async init() {
        this.content = new ContentManager();
        this.content.loadContent();
        
        this.charCreationSystem = new CharacterCreationSystem();
        
        // Load spritesheets before renderer needs them
        this.spriteManager = new SpriteManager();
        await this.spriteManager.loadSheet('walls', 'assets/walls/walls.png', 4, 32);
        await this.spriteManager.loadSheet('objects', 'assets/objects/objects.png', 8, 32);
        await this.spriteManager.loadSheet('player', 'assets/entites/player_characters/player_characers.png', 1, 32);
        await this.spriteManager.loadSheet('npcs', 'assets/entites/npcs/npc.png', 2, 32);
        
        this.renderer = new Renderer();
        this.renderer.init();
        this.renderer.setSpriteManager(this.spriteManager);
        
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
        this.combatSystem = new CombatSystem(this);
        this.combatEffects = new CombatEffects(this);
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
        } else if (action.type === 'grabAll') {
            playerActed = this.player.grabAll();
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
    
    enterInteractMode() {
        // Scan cardinal + center for interactable tiles
        const dirs = [
            { dx: 0, dy: 0, label: 'here' },
            { dx: 0, dy: -1, label: 'north' },
            { dx: 0, dy: 1, label: 'south' },
            { dx: -1, dy: 0, label: 'west' },
            { dx: 1, dy: 0, label: 'east' }
        ];
        
        const candidates = [];
        for (const dir of dirs) {
            const cx = this.player.x + dir.dx;
            const cy = this.player.y + dir.dy;
            const worldObj = this.world.getWorldObjectAt(cx, cy, this.player.z);
            const groundItems = (dir.dx === 0 && dir.dy === 0) ? this.world.getItemsAt(cx, cy, this.player.z) : [];
            const tile = this.world.getTile(cx, cy, this.player.z);
            const hasStairs = tile && (tile.isStaircase || tile.isManhole || tile.isLadder);
            
            if (worldObj || groundItems.length > 0 || (hasStairs && dir.dx === 0 && dir.dy === 0)) {
                candidates.push({ x: cx, y: cy, dx: dir.dx, dy: dir.dy, worldObj, groundItems, hasStairs });
            }
        }
        
        if (candidates.length === 0) {
            this.ui.log('Nothing to interact with nearby.', 'info');
            return;
        }
        
        // If only one candidate, interact immediately
        if (candidates.length === 1) {
            this.resolveInteraction(candidates[0]);
            return;
        }
        
        // Multiple candidates — enter interact mode
        this.interactMode = true;
        this.interactCandidates = candidates;
        this.ui.log('Interact: press a direction to choose, [Esc] to cancel.', 'info');
        this.render();
    }
    
    interactInDirection(dx, dy) {
        if (!this.interactMode) return;
        
        const match = this.interactCandidates.find(c => c.dx === dx && c.dy === dy);
        if (!match) {
            this.ui.log('Nothing to interact with in that direction.', 'info');
            return;
        }
        
        this.interactMode = false;
        this.interactCandidates = null;
        this.resolveInteraction(match);
    }
    
    cancelInteractMode() {
        this.interactMode = false;
        this.interactCandidates = null;
        this.ui.log('Cancelled.', 'info');
        this.render();
    }
    
    resolveInteraction(candidate) {
        if (candidate.worldObj) {
            this.ui.showWorldObjectModal(candidate.worldObj);
        } else if (candidate.groundItems && candidate.groundItems.length > 0) {
            this.ui.showGroundItemsModal();
        } else if (candidate.hasStairs) {
            // Let the stair interaction handle it
            const tile = this.world.getTile(candidate.x, candidate.y, this.player.z);
            if (tile.isStaircase || tile.isManhole || tile.isLadder) {
                this.ui.log('Use < or > to go up/down stairs.', 'info');
            }
        }
        this.render();
    }
    
    checkGameOver() {
        if (this.player.isDead()) {
            this.gameState = 'game_over';
            this.isRunning = false;
            const cause = this.player.anatomy.getDeathCause();
            this.ui.log(`You have died. Cause: ${cause}.`, 'combat');
            this.ui.showGameOver(false, cause);
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
        
        if (this.interactMode && this.interactCandidates) {
            for (const c of this.interactCandidates) {
                const sx = c.x - cameraX;
                const sy = c.y - cameraY;
                if (sx >= 0 && sx < viewWidth && sy >= 0 && sy < viewHeight) {
                    this.renderer.drawInteractHighlight(sx, sy);
                }
            }
        }
        
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
