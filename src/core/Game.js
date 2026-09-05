import { Renderer } from './Renderer.js';
import { FirstPersonRenderer, normalizeFacing, turnFacing, relativeToDelta, deltaToRelative } from './FirstPersonRenderer.js';
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
import { NPC } from '../entities/NPC.js';

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
        this.graphicsMode = 'ascii';

        // View mode: 'first_person' (grid crawler view) or 'top_down' (classic roguelike map)
        this.viewMode = 'first_person';
        this.fpRenderer = null;
        
        this.isRunning = false;
        this.turnCount = 0;
        this.gameState = 'character_creation';
        
        this.inspectMode = false;
        this.inspectCursor = { x: 0, y: 0 };
        
        this.interactMode = false;
        this.interactCandidates = null;

        this.autoTravelTarget = null;
        this._autoTravelTimer = null;

        // ── Overworld ────────────────────────────────────────────────────
        this.overworldMap    = null;
        this._loadoutGiven   = false;  // starting gear given once per run
        this._currentZoneCol = 0;      // which overworld tile the active zone is
        this._currentZoneRow = 0;

        // ── Zone persistence ─────────────────────────────────────────────
        // Every zone the player has visited stays alive here, keyed by its
        // overworld node id ("col,row"). Leaving a zone parks its World and
        // FoV (explored tiles); coming back reuses them, so looted cabinets
        // stay looted, opened doors stay open, dropped items stay dropped.
        // NPCs in a parked zone do not act until the player returns.
        // Plain data only - this map is what a save file will serialise.
        this.zoneCache = new Map();
    }

    /** Node id for an overworld tile. Phase 1 replaces this with graph node ids. */
    zoneKey(col, row) {
        return `${col},${row}`;
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
        this.renderer.setGraphicsMode(this.graphicsMode);
        this.fpRenderer = new FirstPersonRenderer(this, this.renderer);
        
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

        // Create the overworld (exists but player starts in the hub)
        const runSeed = Date.now() & 0x7FFFFFFF;
        this.overworldMap = new OverworldMap(runSeed);

        this.isRunning = true;
        this.zoneCache.clear();

        // The run starts at the hub. The hub is an ordinary overworld node
        // (see OverworldMap.hubCol/hubRow), so leaving and coming back finds
        // the same yard rather than whatever the tile pool would have rolled.
        this._enterHubZone();
    }

    // ── Enter the hub (safe starting area, and the node you return to) ────────
    _enterHubZone() {
        const ow = this.overworldMap;
        this.dropIntoZone(ow.hubCol, ow.hubRow);

        this.ui.log('Downstairs. A fenced yard, a few shacks, and the city beyond.', 'info');
        this.ui.log('W/S move, A/D turn, E interact, ` toggles the map view, ? for help.', 'info');
    }

    /** True when the active zone is the hub node. */
    isAtHub() {
        const ow = this.overworldMap;
        return !!ow && this._currentZoneCol === ow.hubCol && this._currentZoneRow === ow.hubRow;
    }

    // ── Zone systems init (called on every zone entry) ─────────────────────────
    // FoV is per zone (it owns the explored-tile set) and is handed in from the
    // cache on a return visit. Everything else is transient and rebuilt.
    _initZoneSystems(fov = null) {
        this.fov              = fov || new FoVSystem(this.world);
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
        this.cancelAutoTravel();
        const owTile = this.overworldMap.getTile(col, row);
        if (!owTile) return;

        // Park the zone we are leaving. The player entity travels; the zone stays.
        if (this.world) {
            this.world.removeEntity(this.player);
        }

        this._currentZoneCol = col;
        this._currentZoneRow = row;
        this.overworldMap.markExplored(col, row);

        const key = this.zoneKey(col, row);
        const cached = this.zoneCache.get(key);
        const returning = !!cached;

        if (cached) {
            this.world = cached.world;
            this._initZoneSystems(cached.fov);
        } else {
            // Compute chunk bounds from zone dimensions
            const zw = owTile.zone.width;
            const zh = owTile.zone.height;
            const chunksX = Math.ceil(zw / 128);
            const chunksY = Math.ceil(zh / 128);

            // Build the zone world
            this.world = new World(this);
            this.world.zoneMode     = true;
            this.world.forcedBiome = owTile.playBiome || owTile.biome;
            this.world.worldSeed   = owTile.seed;
            this.world.zoneWidth   = zw;
            this.world.zoneHeight  = zh;
            this.world.zoneBounds  = { minCx: 0, maxCx: chunksX - 1, minCy: 0, maxCy: chunksY - 1 };
            this.world.zoneTemplate = owTile.zone; // faction, purpose, npcSignature, keyFeature
            this.world.init();

            // Init all zone-dependent systems
            this._initZoneSystems();
            this.zoneCache.set(key, { world: this.world, fov: this.fov, col, row });
        }

        // Generation may resize the zone (interior sites own their footprint),
        // so read the dimensions back off the world rather than the template.
        const activeW = this.world.zoneWidth;
        const activeH = this.world.zoneHeight;

        // Determine player spawn position based on entry edge
        let spawnX, spawnY;
        if (this.world.isInterior) {
            // You always arrive at a site's entrance, whichever way you travelled.
            const sp = this.world.getSpawnPosition();
            spawnX = sp.x;
            spawnY = sp.y;
        }
        else if (entryEdge === 'west')  { spawnX = 2;        spawnY = Math.floor(activeH / 2); }
        else if (entryEdge === 'east')  { spawnX = activeW - 3;    spawnY = Math.floor(activeH / 2); }
        else if (entryEdge === 'north') { spawnX = Math.floor(activeW / 2); spawnY = 2; }
        else if (entryEdge === 'south') { spawnX = Math.floor(activeW / 2); spawnY = activeH - 3; }
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
        // Walking in over an edge keeps you facing the way you were going;
        // arriving at an entrance faces you into the place.
        const edgeFacing = { west: 'east', east: 'west', north: 'south', south: 'north' }[entryEdge];
        if (edgeFacing && !this.world.isInterior) {
            this.player.facing = edgeFacing;
        } else if (this.world.spawnFacing) {
            this.player.facing = this.world.spawnFacing;
        }

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

        const threatMod = owTile.zone.threatMod || 0;
        const threat = Math.max(1, Math.min(5, owTile.threatLevel + threatMod));
        const verb = returning ? 'Returning to' : 'Entering';
        this.ui.log(`${verb}: ${owTile.zone.name} [${(owTile.terrain || owTile.biome).replace('_', ' ')}]  Threat: ${'★'.repeat(threat)}`, 'info');
        if (this.timeSystem) {
            this.ui.log(`Time: ${this.timeSystem.getTimeString()} - ${this.timeSystem.getTimePeriod()}`, 'info');
        }
        if (this.world.isInterior && !returning) {
            this.ui.log('Inside. [<] at the entrance to leave, [<] / [>] at the stairwell to change floors.', 'info');
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
        this.cancelAutoTravel();
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
        
        if (action.type === 'turn') {
            // Turning in place is free: no world tick, but the flashlight cone
            // and view depend on facing, so lighting is refreshed.
            this.player.facing = turnFacing(this.player.facing, action.steps || 1);
            this.player.lastActionCost = 0;
            playerActed = true;
            this.updateFoV();
        } else if (action.type === 'move') {
            playerActed = this.player.tryMove(action.dx, action.dy, { keepFacing: !!action.keepFacing });
            // Zone edge transition: if move was blocked and target is outside zone
            // bounds. Interiors are sealed; you leave them through the entrance.
            if (!playerActed && this.world && this.world.zoneMode && !this.world.isInterior) {
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
            const here = this.world.getTile(this.player.x, this.player.y, this.player.z);
            if (here?.isSiteExit) {
                this.ui.log(`You step back out of ${this.world.siteName || 'the building'}.`, 'info');
                this.returnToOverworld();
                return;
            }
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
                this.checkGameOver();
            }
        }
        
        this.render();
    }

    startAutoExplore() {
        if (!this.world || !this.player || !this.fov) return false;
        const destination = this.findAutoExploreDestination();
        if (!destination) {
            this.ui.log('Auto-explore: no reachable unexplored edge in this zone.', 'info');
            return false;
        }

        this.cancelAutoTravel();
        this.autoTravelTarget = {
            type: 'explore',
            name: 'unexplored area',
            x: destination.x,
            y: destination.y
        };
        this.ui.log('Auto-explore started. Press [Esc] to stop.', 'info');
        this.scheduleAutoTravelStep();
        return true;
    }

    scheduleAutoTravelStep() {
        if (!this.autoTravelTarget || typeof window === 'undefined') return;
        this._autoTravelTimer = window.setTimeout(() => this.stepAutoTravel(), 70);
    }

    stepAutoTravel() {
        if (!this.autoTravelTarget || this.gameState !== 'playing' || !this.isRunning) return;

        const danger = this.world.entities.some(entity => (
            entity !== this.player &&
            entity.hostile &&
            entity.z === this.player.z &&
            this.fov?.isVisible(entity.x, entity.y, entity.z)
        ));
        if (danger) {
            this.cancelAutoTravel('Auto-travel stopped: danger nearby.');
            return;
        }

        const target = this.autoTravelTarget;
        if (this.player.x === target.x && this.player.y === target.y) {
            if (target.type === 'explore') {
                const destination = this.findAutoExploreDestination();
                if (!destination) {
                    this.cancelAutoTravel('Auto-explore complete.');
                    return;
                }
                this.autoTravelTarget = {
                    type: 'explore',
                    name: 'unexplored area',
                    x: destination.x,
                    y: destination.y
                };
            } else {
                this.cancelAutoTravel(`Arrived: ${target.name}.`);
                return;
            }
        }

        const currentTarget = this.autoTravelTarget;
        if (!currentTarget) {
            return;
        }

        const path = this.findPathTo(currentTarget.x, currentTarget.y, this.player.z);
        if (!path || path.length < 2) {
            this.cancelAutoTravel(`Auto-travel stopped: no clear path to ${currentTarget.name}.`);
            return;
        }

        const next = path[1];
        const beforeX = this.player.x;
        const beforeY = this.player.y;
        this.processTurn({
            type: 'move',
            dx: Math.sign(next.x - beforeX),
            dy: Math.sign(next.y - beforeY)
        });

        if (!this.autoTravelTarget) return;
        if (this.player.x === beforeX && this.player.y === beforeY) {
            this.cancelAutoTravel(`Auto-travel stopped: path blocked.`);
            return;
        }
        this.scheduleAutoTravelStep();
    }

    cancelAutoTravel(message = null) {
        if (this._autoTravelTimer && typeof window !== 'undefined') {
            window.clearTimeout(this._autoTravelTimer);
        }
        this._autoTravelTimer = null;
        const wasTraveling = !!this.autoTravelTarget;
        this.autoTravelTarget = null;
        if (message && wasTraveling && this.ui) {
            this.ui.log(message, 'info');
        }
    }

    findPathTo(targetX, targetY, z = 0, maxNodes = 5000) {
        if (!this.world || !this.player) return null;
        const startX = this.player.x;
        const startY = this.player.y;
        if (startX === targetX && startY === targetY) {
            return [{ x: startX, y: startY }];
        }

        const width = this.world.zoneMode ? this.world.zoneWidth : this.world.chunkSize * 3;
        const height = this.world.zoneMode ? this.world.zoneHeight : this.world.chunkSize * 3;
        const inBounds = (x, y) => !this.world.zoneMode || (x >= 0 && y >= 0 && x < width && y < height);
        const key = (x, y) => `${x},${y}`;
        const queue = [{ x: startX, y: startY }];
        const cameFrom = new Map([[key(startX, startY), null]]);
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];

        for (let head = 0; head < queue.length && queue.length <= maxNodes; head++) {
            const current = queue[head];
            for (const dir of dirs) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const nextKey = key(nx, ny);
                if (cameFrom.has(nextKey) || !inBounds(nx, ny)) continue;
                const isTarget = nx === targetX && ny === targetY;
                if (!isTarget && this.world.isBlocked(nx, ny, z)) continue;

                cameFrom.set(nextKey, current);
                if (isTarget) {
                    const path = [{ x: nx, y: ny }];
                    let step = current;
                    while (step) {
                        path.push({ x: step.x, y: step.y });
                        step = cameFrom.get(key(step.x, step.y));
                    }
                    return path.reverse();
                }
                queue.push({ x: nx, y: ny });
            }
        }

        return null;
    }

    findAutoExploreDestination(maxNodes = 5000) {
        const z = this.player.z;
        const startX = this.player.x;
        const startY = this.player.y;
        const key = (x, y) => `${x},${y}`;
        const isExplored = (x, y) => this.fov.isExplored?.(x, y, z);
        const inBounds = (x, y) => !this.world.zoneMode || (
            x >= 0 && y >= 0 && x < this.world.zoneWidth && y < this.world.zoneHeight
        );
        const dirs = [
            { dx: 0, dy: -1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: -1, dy: 0 }
        ];
        const hasUnexploredNeighbor = (x, y) => dirs.some(dir => {
            const nx = x + dir.dx;
            const ny = y + dir.dy;
            return inBounds(nx, ny) && !isExplored(nx, ny);
        });

        const queue = [{ x: startX, y: startY }];
        const seen = new Set([key(startX, startY)]);

        for (let head = 0; head < queue.length && queue.length <= maxNodes; head++) {
            const current = queue[head];
            if ((current.x !== startX || current.y !== startY) && hasUnexploredNeighbor(current.x, current.y)) {
                return current;
            }

            for (const dir of dirs) {
                const nx = current.x + dir.dx;
                const ny = current.y + dir.dy;
                const nextKey = key(nx, ny);
                if (seen.has(nextKey) || !inBounds(nx, ny) || !isExplored(nx, ny)) continue;
                if (this.world.isBlocked(nx, ny, z)) continue;
                seen.add(nextKey);
                queue.push({ x: nx, y: ny });
            }
        }

        return null;
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

    /**
     * Pass a long stretch of time in one step (sleeping, resting, later
     * route travel). Runs the same per-turn systems as advanceTurn but only
     * redraws at the end, and stops early if the player dies or, while
     * sleeping, if a hostile closes in.
     *
     * @param {number} turns
     * @param {object} opts
     *   sleeping     - halves hunger/thirst drain and wakes on nearby hostiles
     *   wakeRadius   - Manhattan distance at which a hostile wakes a sleeper
     * @returns {{ turns: number, interrupted: string|null }}
     */
    passTime(turns, opts = {}) {
        if (!this.isRunning) return { turns: 0, interrupted: 'not running' };
        const sleeping = !!opts.sleeping;
        const wakeRadius = opts.wakeRadius ?? 10;
        const p = this.player;

        const savedRates = { hunger: p.hungerRate, thirst: p.thirstRate };
        if (sleeping) {
            p.hungerRate *= 0.5;
            p.thirstRate *= 0.5;
        }

        let done = 0;
        let interrupted = null;
        try {
            for (; done < turns; done++) {
                this.turnCount++;
                this.timeSystem.tick();
                this.lightingSystem.consumeFuel();
                p.processStatusEffects();
                this.world.processTurn(100);
                this.soundSystem.processTurn();
                this.abilitySystem?.processTurn();
                if (p.isDead()) {
                    interrupted = 'death';
                    done++;
                    break;
                }
                if (sleeping && done % 5 === 4 && this._hostileWithin(wakeRadius)) {
                    interrupted = 'hostile';
                    done++;
                    break;
                }
            }
        } finally {
            p.hungerRate = savedRates.hunger;
            p.thirstRate = savedRates.thirst;
        }

        this.updateFoV();
        this.checkGameOver();
        this.render();
        return { turns: done, interrupted };
    }

    /** Any living hostile within `radius` (Manhattan) on the player's floor. */
    _hostileWithin(radius) {
        const p = this.player;
        for (const e of this.world.entities) {
            if (e === p || !e.hostile) continue;
            if (e.z !== undefined && e.z !== p.z) continue;
            if (e.isDead && e.isDead()) continue;
            if (Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= radius) return true;
        }
        return false;
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
            if (this.isFirstPerson()) {
                const ahead = this.relativeDelta('forward');
                this.inspectCursor.x += ahead.dx;
                this.inspectCursor.y += ahead.dy;
                this.ui.log('Inspect mode: W/S/A/D move the cursor relative to your facing, [X] or [Esc] to exit.', 'info');
            } else {
                this.ui.log('Inspect mode: Use arrow keys to move cursor, [X] or [Esc] to exit.', 'info');
            }
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
            const hasStairs = tile && (tile.isStaircase || tile.isManhole || tile.isLadder || tile.isSiteExit);
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
        if (this.isFirstPerson()) {
            const opts = candidates.map(c => this.describeDelta(c.dx, c.dy)).join(', ');
            this.ui.log(`Interact: choose ${opts} with W/S/A/D or Space, [Esc] to cancel.`, 'info');
        } else {
            this.ui.log('Interact: press a direction to choose, [Esc] to cancel.', 'info');
        }
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
            if (tile.isSiteExit) {
                this.ui.log('Press < here to step back outside.', 'info');
            } else if (tile.isStaircase || tile.isManhole || tile.isLadder) {
                this.ui.log('Use < or > to go up/down stairs.', 'info');
            }
        }
        this.render();
    }

    /**
     * Talk to an adjacent NPC. The quest/errand dialogue tree was removed with
     * the flow rework; hostiles can still be stared down, everyone else has a
     * placeholder line until the new contact system exists.
     */
    _talkToNPC(npc) {
        if (npc.hostile) {
            const playerStr = (this.player.stats?.strength || 10);
            const npcCourage = (npc.profile?.courage || 0.5);
            const chance = Math.min(0.9, Math.max(0.05, (playerStr / 20) * (1 - npcCourage)));
            if (Math.random() < chance) {
                npc.detectionState = 'fleeing';
                this.ui.log(`You stare down the ${npc.name}. They back away, shaken.`, 'info');
            } else {
                this.ui.log(`You try to intimidate the ${npc.name} — they aren't impressed.`, 'warning');
            }
            return;
        }

        this.ui.showNPCDialogue(
            npc,
            `"..." ${npc.name} has nothing to say yet.`,
            [{ id: 'leave', label: '<span style="color:#888;">[Leave]</span>' }],
            () => {}
        );
    }

    /**
     * Debug helper: spawn a catalog NPC a few cells ahead of the player so
     * combat and detection stay testable while the real roster is rebuilt.
     * Bound to F9 and available as game.debugSpawn() from the console.
     */
    debugSpawn(type = 'debug_hostile', distance = 3) {
        if (!this.world || !this.player || this.gameState !== 'playing') return null;

        const drop = (x, y, where) => {
            const npc = new NPC(this, type, x, y);
            npc.z = this.player.z;
            this.world.addEntity(npc);
            this.ui.log(`[debug] Spawned ${npc.name} ${where}.`, 'warning');
            this.updateFoV();
            this.render();
            return npc;
        };

        // Straight ahead reads best, so try that first.
        const f = this.relativeDelta('forward');
        for (let d = distance; d >= 1; d--) {
            const x = this.player.x + f.dx * d;
            const y = this.player.y + f.dy * d;
            if (!this.world.isBlocked(x, y, this.player.z)) return drop(x, y, `${d} cell(s) ahead`);
        }

        // Interiors are tight; fall back to the nearest open cell in any direction.
        for (let r = 1; r <= Math.max(2, distance); r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const x = this.player.x + dx;
                    const y = this.player.y + dy;
                    if (!this.world.isBlocked(x, y, this.player.z)) return drop(x, y, `${r} cell(s) away`);
                }
            }
        }

        this.ui.log('[debug] No open cell nearby to spawn into.', 'warning');
        return null;
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

        if (this.isFirstPerson()) {
            this.renderFirstPerson();
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

    // ── First-person view ──────────────────────────────────────────────────────
    isFirstPerson() {
        return this.viewMode === 'first_person' && this.gameState === 'playing' && !!this.fpRenderer;
    }

    renderFirstPerson() {
        this.player.facing = normalizeFacing(this.player.facing);
        this.fpRenderer.render();

        if (this.inspectMode) {
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

    toggleViewMode() {
        this.viewMode = this.viewMode === 'first_person' ? 'top_down' : 'first_person';
        if (this.viewMode === 'first_person' && this.player) {
            this.player.facing = normalizeFacing(this.player.facing);
            if (this.lightingSystem && this.fov) this.updateFoV();
        }
        const label = this.viewMode === 'first_person' ? 'First-person view' : 'Top-down map view';
        this.ui.log(`${label}.`, 'info');
        this.render();
    }

    /**
     * Translate a view-relative direction into a world delta.
     * In top-down view the relative names map straight onto screen directions.
     */
    relativeDelta(rel) {
        if (this.isFirstPerson()) return relativeToDelta(this.player.facing, rel);
        return { forward: { dx: 0, dy: -1 }, back: { dx: 0, dy: 1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 } }[rel] || { dx: 0, dy: 0 };
    }

    /** Human label for an absolute delta, relative to the player's facing. */
    describeDelta(dx, dy) {
        if (this.isFirstPerson()) return deltaToRelative(this.player.facing, dx, dy) || 'nearby';
        if (dx === 0 && dy === 0) return 'here';
        if (dy < 0) return 'north';
        if (dy > 0) return 'south';
        return dx < 0 ? 'west' : 'east';
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

                const visual      = OverworldMap.getTileVisual ? OverworldMap.getTileVisual(tile) : OverworldMap.getBiomeVisual(tile.biome);
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
