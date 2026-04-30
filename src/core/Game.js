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
import { AbilitySystem } from '../systems/AbilitySystem.js';
import { TimeSystem } from '../systems/TimeSystem.js';
import { LightingSystem } from '../systems/LightingSystem.js';
import { MobileControls } from '../ui/MobileControls.js';
import { OverworldMap } from '../world/OverworldMap.js';
import { GoalSystem } from '../systems/GoalSystem.js';

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
        this.goalSystem = null;
        
        this.isRunning = false;
        this.turnCount = 0;
        this.gameState = 'character_creation';
        
        this.inspectMode = false;
        this.inspectCursor = { x: 0, y: 0 };
        
        this.interactMode = false;
        this.interactCandidates = null;

        // ── Overworld ────────────────────────────────────────────────────
        this.overworldMap    = null;
        this._loadoutGiven   = false;  // starting gear given once per run
        this._currentZoneCol = 0;      // which overworld tile the active zone is
        this._currentZoneRow = 0;
    }
    
    async init() {
        this.content = new ContentManager();
        this.content.loadContent();
        
        this.charCreationSystem = new CharacterCreationSystem();
        
        // Load spritesheets before renderer needs them
        this.spriteManager = new SpriteManager();
        await this.spriteManager.loadSheet('walls', 'assets/walls/walls.png', 4, 32);
        await this.spriteManager.loadSheet('ground', 'assets/ground/ground.png', 8, 32);
        await this.spriteManager.loadSheet('objects', 'assets/objects/objects.png', 8, 32);
        await this.spriteManager.loadSheet('player', 'assets/entites/player_characters/player_characers.png', 1, 32);
        await this.spriteManager.loadSheet('npcs', 'assets/entites/npcs/npc.png', 4, 32);
        
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
        // Create the player (no world yet — systems init on first zone drop-in)
        this.player = new Player(this, characterData);
        this._loadoutGiven = false;

        // Init goal system
        this.goalSystem = new GoalSystem(this);
        this.goalSystem.initGoals(this.player);

        // Create the overworld
        const runSeed = Date.now() & 0x7FFFFFFF;
        this.overworldMap = new OverworldMap(runSeed);

        this.isRunning = true;
        this.gameState = 'overworld';

        this.ui.log('Welcome to Fractured City.', 'info');
        this.ui.log(`Archetype: ${this.player.archetypeLabel} — ${this.player.primaryGoal.text}`, 'info');
        this.ui.log('Navigate the overworld. [Enter] or [Space] to drop into a zone.', 'info');
        this.ui.log('Walk to a zone edge to move to the adjacent zone.', 'info');
        this.render();
    }

    // ── Zone systems init (called on every zone entry) ─────────────────────────
    _initZoneSystems() {
        this.fov              = new FoVSystem(this.world);
        this.soundSystem      = new SoundSystem(this);
        this.timeSystem       = this.timeSystem || new TimeSystem();
        this.lightingSystem   = new LightingSystem(this);
        this.itemSystem       = new ItemSystem(this);
        this.craftingSystem   = new CraftingSystem(this);
        this.combatSystem     = new CombatSystem(this);
        this.combatEffects    = new CombatEffects(this);
        this.abilitySystem    = new AbilitySystem(this);
        this.worldObjectSystem = new WorldObjectSystem(this);
    }

    // ── Drop into an overworld tile ───────────────────────────────────────────
    dropIntoZone(col, row, entryEdge = null) {
        const owTile = this.overworldMap.getTile(col, row);
        if (!owTile) return;

        this._currentZoneCol = col;
        this._currentZoneRow = row;
        this.overworldMap.markExplored(col, row);

        // Compute chunk bounds from zone dimensions
        const zw = owTile.zone.width;
        const zh = owTile.zone.height;
        const chunksX = Math.ceil(zw / 128);
        const chunksY = Math.ceil(zh / 128);

        // Build the zone world
        this.world = new World(this);
        this.world.zoneMode    = true;
        this.world.forcedBiome = owTile.biome;
        this.world.worldSeed   = owTile.seed;
        this.world.zoneWidth   = zw;
        this.world.zoneHeight  = zh;
        this.world.zoneBounds  = { minCx: 0, maxCx: chunksX - 1, minCy: 0, maxCy: chunksY - 1 };
        this.world.init();

        // Init all zone-dependent systems
        this._initZoneSystems();

        // Determine player spawn position based on entry edge
        let spawnX, spawnY;
        if (entryEdge === 'west')  { spawnX = 2;        spawnY = Math.floor(zh / 2); }
        else if (entryEdge === 'east')  { spawnX = zw - 3;    spawnY = Math.floor(zh / 2); }
        else if (entryEdge === 'north') { spawnX = Math.floor(zw / 2); spawnY = 2; }
        else if (entryEdge === 'south') { spawnX = Math.floor(zw / 2); spawnY = zh - 3; }
        else {
            // Initial drop-in from overworld: use world spawn position
            const sp = this.world.getSpawnPosition();
            spawnX = sp.x;
            spawnY = sp.y;
        }

        // Find a non-blocked tile near the target spawn
        const found = this._findOpenNear(spawnX, spawnY);
        this.player.x = found.x;
        this.player.y = found.y;
        this.player.z = 0;

        // Add player to world (remove from previous world entity list first)
        if (!this.world.entities.includes(this.player)) {
            this.world.addEntity(this.player);
        }

        // Give starting gear on first drop
        if (!this._loadoutGiven) {
            this.giveStartingLoadout();
            this._loadoutGiven = true;
        }

        this.gameState = 'playing';

        const threat = owTile.threatLevel;
        this.ui.log(`Entering: ${owTile.zone.name} [${owTile.biome.replace('_', ' ')}]  Threat: ${'★'.repeat(threat)}`, 'info');
        if (this.timeSystem) {
            this.ui.log(`Time: ${this.timeSystem.getTimeString()} - ${this.timeSystem.getTimePeriod()}`, 'info');
        }

        // Goal hints
        if (this.player && this.player.floorGoals) {
            const active = this.player.floorGoals.filter(g => !g.completed);
            for (const goal of active) {
                const hints = {
                    find_stash:       'Search furniture and containers to find a stash.',
                    reach_extraction: `Reach the extraction point — check your location panel for distance.`,
                    kill_gang_leader: 'Eliminate a Brute or Armed Raider in this zone.',
                    avoid_kills:      'Complete the zone without killing anyone.',
                    find_medicine:    'Search containers for medical supplies.',
                    treat_npc:        'Find a Survivor (green @) and talk to them.',
                    deliver_item:     'Find a Survivor (green @) — they need something. Press [E] to talk.',
                    hack_terminal:    'Find a terminal to access.',
                    destroy_stash:    'Find and destroy a gang stash.',
                    strip_electronics:'Loot containers to strip electronics.',
                    salvage_gear:     'Loot gear from bodies or containers.',
                    find_fragment:    'Search for an Echo fragment in this zone.',
                };
                const hint = hints[goal.id];
                if (hint) this.ui.log(`Goal: ${hint}`, 'warning');
            }
        }

        this.updateFoV();
        this.render();
    }

    // ── Seamless zone transition when walking off an edge ──────────────────────
    transitionZone(dx, dy) {
        const ow = this.overworldMap;
        const newCol = this._currentZoneCol + dx;
        const newRow = this._currentZoneRow + dy;

        const target = ow.getTile(newCol, newRow);
        if (!target) {
            this.ui.log('Edge of the known world.', 'warning');
            return;
        }

        // Preserve player Y% when transitioning east/west, X% when north/south
        const oldW = this.world.zoneWidth;
        const oldH = this.world.zoneHeight;
        const ratioX = this.player.x / oldW;
        const ratioY = this.player.y / oldH;

        let entryEdge;
        let entryX, entryY;
        const newW = target.zone.width;
        const newH = target.zone.height;

        if (dx === 1)  { entryEdge = 'west';  entryX = 2;        entryY = Math.round(ratioY * newH); }
        if (dx === -1) { entryEdge = 'east';  entryX = newW - 3; entryY = Math.round(ratioY * newH); }
        if (dy === 1)  { entryEdge = 'north'; entryX = Math.round(ratioX * newW); entryY = 2; }
        if (dy === -1) { entryEdge = 'south'; entryX = Math.round(ratioX * newW); entryY = newH - 3; }

        // Update overworld cursor
        ow.cursorCol = newCol;
        ow.cursorRow = newRow;

        this.dropIntoZone(newCol, newRow, entryEdge);

        // Override spawn to match the edge ratio (dropIntoZone used center, override here)
        const found = this._findOpenNear(
            Math.max(1, Math.min(newW - 2, entryX)),
            Math.max(1, Math.min(newH - 2, entryY))
        );
        this.player.x = found.x;
        this.player.y = found.y;
        this.updateFoV();
        this.render();
    }

    // Helper: find open tile near (px, py) by spiral search
    _findOpenNear(px, py) {
        for (let r = 0; r < 15; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const x = px + dx;
                    const y = py + dy;
                    if (!this.world.isBlocked(x, y, 0)) return { x, y };
                }
            }
        }
        return this.world.getSpawnPosition();
    }

    // ── Open overworld map (non-destructive — zone state is preserved) ─────────
    returnToOverworld() {
        // Sync the overworld cursor back to wherever the player currently is
        if (this.overworldMap) {
            this.overworldMap.cursorCol = this._currentZoneCol;
            this.overworldMap.cursorRow = this._currentZoneRow;
        }
        this.gameState = 'overworld';
        this.render();
    }

    // ── Close overworld map and return to active zone ─────────────────────────
    closeOverworld() {
        if (!this.world) return; // no active zone yet
        this.gameState = 'playing';
        this.render();
    }
    
    processTurn(action) {
        if (!this.isRunning) return;
        
        // Clear ability popup from previous turn (but not when we're using an ability right now)
        if (this.ui && action.type !== 'use_ability') this.ui.clearAbilityPopup();
        
        let playerActed = false;
        
        // Reset last action cost — each action type sets this
        this.player.lastActionCost = 100; // default 1 turn
        
        if (action.type === 'move') {
            playerActed = this.player.tryMove(action.dx, action.dy);
            // Zone edge transition: if move was blocked and target is outside zone bounds
            if (!playerActed && this.world && this.world.zoneMode) {
                const nx = this.player.x + action.dx;
                const ny = this.player.y + action.dy;
                if (nx < 0 || nx >= this.world.zoneWidth || ny < 0 || ny >= this.world.zoneHeight) {
                    this.transitionZone(action.dx, action.dy);
                    return; // transitionZone handles render
                }
            }
        } else if (action.type === 'wait') {
            playerActed = true;
            this.player.lastActionCost = 100;
        } else if (action.type === 'pickup') {
            playerActed = this.player.tryPickup();
            this.player.lastActionCost = 50; // quick action
        } else if (action.type === 'grabAll') {
            playerActed = this.player.grabAll();
            this.player.lastActionCost = 50;
        } else if (action.type === 'cycle_movement') {
            playerActed = this.player.cycleMovementMode();
            this.player.lastActionCost = 0; // free action — no world tick
        } else if (action.type === 'ascend') {
            playerActed = this.player.tryAscend();
            this.player.lastActionCost = this.player.getMovementActionCost();
        } else if (action.type === 'descend') {
            playerActed = this.player.tryDescend();
            this.player.lastActionCost = this.player.getMovementActionCost();
        } else if (action.type === 'use_ability') {
            // Ability was resolved by the UI before creating this action
            // action.result contains the ability resolution result
            if (action.result && action.result.success) {
                playerActed = true;
                this.player.lastActionCost = action.result.actionCost || 100;
            }
        }
        
        if (playerActed) {
            const actionCost = this.player.lastActionCost;
            
            // Free actions (cost 0) don't advance the world
            if (actionCost > 0) {
                this.turnCount++;
                this.timeSystem.tick();
                this.lightingSystem.consumeFuel();
                this.player.processStatusEffects();
                this.updateFoV();
                this.world.processTurn(actionCost);
                this.soundSystem.processTurn();
                this.abilitySystem.processTurn();
                if (this.goalSystem) this.goalSystem.checkGoals(this.player);
                this.checkGameOver();
            }
        }
        
        this.render();
    }
    
    /**
     * Advance game turns for actions that take time
     * Used by systems like WorldObjectSystem for door interactions, crafting, etc.
     * @param {number} turns - Number of turns to advance (each turn = 100 energy)
     */
    advanceTurn(turns = 1) {
        if (!this.isRunning) return;
        
        for (let i = 0; i < turns; i++) {
            this.turnCount++;
            this.timeSystem.tick();
            this.lightingSystem.consumeFuel();
            this.player.processStatusEffects();
            this.updateFoV();
            this.world.processTurn(100); // 1 full turn = 100 energy
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
        
        // ── Base gear (everyone) ──
        const coat = c.createItem('coat');
        if (coat) p.equipment.torso = coat;
        
        const pants = c.createItem('pants');
        if (pants) p.equipment.legs = pants;
        
        const backpack = c.createItem('backpack');
        if (backpack) p.equipment.back = backpack;
        
        // ── Background-specific gear ──
        const bg = p.backgroundId || 'streetKid';
        
        const LOADOUTS = {
            streetKid: {
                equip: { rightHand: 'shiv' },
                inventory: ['flashlight'],
            },
            corpo: {
                equip: {},
                inventory: ['flashlight', 'lantern'],
            },
            nomad: {
                equip: { rightHand: 'knife' },
                inventory: ['canteen'],
            },
            scavenger: {
                equip: { rightHand: 'shiv' },
                inventory: ['flashlight', 'lantern'],
            },
            raiderDefector: {
                equip: { rightHand: 'knife' },
                inventory: ['pipe'],
            },
            medic: {
                equip: {},
                inventory: ['medkit', 'flashlight'],
            },
        };
        
        const loadout = LOADOUTS[bg] || LOADOUTS.streetKid;
        
        // Equip weapons/items to slots
        for (const [slot, itemId] of Object.entries(loadout.equip)) {
            const item = c.createItem(itemId);
            if (item) {
                p.equipment[slot] = item;
            }
        }
        
        // Add inventory items
        for (const itemId of loadout.inventory) {
            const item = c.createItem(itemId);
            if (item) {
                if (item.state && (itemId === 'flashlight' || itemId === 'lantern')) {
                    item.state.active = false;
                }
                const result = p.addToInventory(item);
                console.log(`[Loadout] ${item.name}: ${result.message}`);
            }
        }
        
        console.log(`[Loadout] Background: ${bg}`, {
            torso: p.equipment.torso?.name,
            legs: p.equipment.legs?.name,
            back: p.equipment.back?.name,
            rightHand: p.equipment.rightHand?.name,
            leftHand: p.equipment.leftHand?.name,
            inventory: p.inventory.map(i => i.name)
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
            const npc = this.world.entities.find(e => e !== this.player && e.x === cx && e.y === cy && e.z === this.player.z);
            
            if (worldObj || groundItems.length > 0 || (hasStairs && dir.dx === 0 && dir.dy === 0) || npc) {
                candidates.push({ x: cx, y: cy, dx: dir.dx, dy: dir.dy, worldObj, groundItems, hasStairs, npc });
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
        if (candidate.npc) {
            this._talkToNPC(candidate.npc);
        } else if (candidate.worldObj) {
            this.ui.showWorldObjectModal(candidate.worldObj);
        } else if (candidate.groundItems && candidate.groundItems.length > 0) {
            this.ui.showGroundItemsModal();
        } else if (candidate.hasStairs) {
            const tile = this.world.getTile(candidate.x, candidate.y, this.player.z);
            if (tile.isStaircase || tile.isManhole || tile.isLadder) {
                this.ui.log('Use < or > to go up/down stairs.', 'info');
            }
        }
        this.render();
    }

    _talkToNPC(npc) {
        // Hostile NPCs — attempt intimidation
        if (npc.hostile) {
            const { DETECTION_STATE } = npc.constructor ? {} : {};
            const playerStr = (this.player.stats?.strength || 10);
            const npcCourage = (npc.profile?.courage || 0.5);
            // Chance = player STR scaled against NPC courage (0=fearless,1=coward)
            const chance = Math.min(0.9, Math.max(0.05, (playerStr / 20) * (1 - npcCourage)));
            if (Math.random() < chance) {
                npc.detectionState = 'fleeing';
                if (!this.player.goalsData) this.player.goalsData = {};
                this.player.goalsData.npcIntimidated = true;
                this.ui.log(`You stare down the ${npc.name}. They back away, shaken. [Intimidated]`, 'info');
                if (this.goalSystem) this.goalSystem.checkGoals(this.player);
            } else {
                this.ui.log(`You try to intimidate the ${npc.name} — they aren't impressed.`, 'warning');
            }
            return;
        }
        if (npc.deliveryRequest && !npc.deliveryRequest.fulfilled) {
            const req = npc.deliveryRequest;
            const item = this.player.inventory.find(i => i.id === req.itemId);
            if (item) {
                this.player.removeFromInventory(item);
                npc.deliveryRequest.fulfilled = true;
                if (!this.player.goalsData) this.player.goalsData = {};
                this.player.goalsData.itemDelivered = true;
                this.ui.log(`${npc.name}: "Thank you... this means everything." [Delivered ${req.label}]`, 'info');
                if (this.goalSystem) this.goalSystem.checkGoals(this.player);
            } else {
                this.ui.log(`${npc.name}: "Please... I need ${req.label}. Can you help me?"`, 'info');
            }
        } else if (npc.deliveryRequest?.fulfilled) {
            this.ui.log(`${npc.name}: "You already helped me. Stay safe out there."`, 'info');
        } else {
            // Treatment path — Field Medic goal
            const medicalIds = ['medkit', 'bandage', 'antiseptic', 'painkiller'];
            const medItem = this.player.inventory.find(i => medicalIds.includes(i.id) || i.medicalEffect);
            if (medItem && !npc.treated) {
                this.player.removeFromInventory(medItem);
                npc.treated = true;
                if (!this.player.goalsData) this.player.goalsData = {};
                this.player.goalsData.npcsSaved = (this.player.goalsData.npcsSaved || 0) + 1;
                this.ui.log(`${npc.name}: "I... thank you. I thought I wouldn't make it." [Treated with ${medItem.name}]`, 'info');
                if (this.goalSystem) this.goalSystem.checkGoals(this.player);
            } else if (npc.treated) {
                this.ui.log(`${npc.name}: "You've already patched me up. Thank you."`, 'info');
            } else {
                this.ui.log(`${npc.name}: "..." They don't respond.`, 'info');
            }
        }
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

        if (this.gameState === 'overworld') {
            this.renderOverworld();
            return;
        }

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

    // ── Overworld rendering ────────────────────────────────────────────────────
    renderOverworld() {
        const ow = this.overworldMap;
        const viewWidth  = this.renderer.tilesX;
        const viewHeight = this.renderer.tilesY;

        // Centre view on cursor
        const camCol = ow.cursorCol - Math.floor(viewWidth  / 2);
        const camRow = ow.cursorRow - Math.floor(viewHeight / 2);

        for (let sy = 0; sy < viewHeight; sy++) {
            for (let sx = 0; sx < viewWidth; sx++) {
                const col = camCol + sx;
                const row = camRow + sy;
                const tile = ow.getTile(col, row);

                if (!tile) {
                    this.renderer.drawTile(sx, sy, ' ', '#000000', '#050505');
                    continue;
                }

                const visible  = ow.isVisible(col, row);
                const explored = tile.explored;

                if (!visible && !explored) {
                    this.renderer.drawTile(sx, sy, ' ', '#000000', '#111111');
                    continue;
                }

                const visual      = OverworldMap.getBiomeVisual(tile.biome);
                const isCursor    = col === ow.cursorCol && row === ow.cursorRow;
                const isActiveZone = col === this._currentZoneCol && row === this._currentZoneRow && this.world;

                let fgColor = visible ? visual.color : '#3a3a3a';
                let bgColor = '#000000';

                let glyph, fg;
                if (isCursor && isActiveZone) {
                    // Cursor is on the player's active zone
                    glyph = '@'; fg = '#00ff88'; bgColor = '#1a2a1a';
                } else if (isCursor) {
                    // Cursor on a different tile
                    glyph = '>'; fg = '#ffff00'; bgColor = '#1a1a00';
                } else if (isActiveZone) {
                    // Active zone tile (cursor elsewhere)
                    glyph = '@'; fg = '#00aa55'; bgColor = '#111a11';
                } else {
                    glyph = visual.glyph; fg = fgColor;
                }

                this.renderer.drawTile(sx, sy, glyph, fg, bgColor);
            }
        }

        this.ui.updateOverworldPanel();

        if (this.mobileControls) {
            this.mobileControls.updateHUD();
        }
    }
}
