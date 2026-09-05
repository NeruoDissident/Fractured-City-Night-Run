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
import { OverworldMap, findZoneTemplate, hashString } from '../world/OverworldMap.js';
import { DISTRICT, HUB_NODE_ID, getNode, routesFrom, dangerMultiplier } from '../content/DistrictCatalog.js';
import { getSiteProfile } from '../content/SiteCatalog.js';
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
        // district node id (or "ow:col,row" for a debug region tile). Leaving
        // a zone parks its World and FoV (explored tiles); coming back reuses
        // them, so looted cabinets stay looted, opened doors stay open,
        // dropped items stay dropped.
        // NPCs in a parked zone do not act until the player returns.
        // Plain data only - this map is what a save file will serialise.
        this.zoneCache = new Map();

        // ── District travel ──────────────────────────────────────────────
        this.district       = null;   // DistrictCatalog graph for this run
        this._currentNodeId = null;   // graph node the active zone belongs to
        this.flags          = {};     // run flags (route locks, projects)
        this.travel         = null;   // travel screen state { from, options, index }
        this.runSeed        = 0;
    }

    /** Key fragment for a region-map tile (debug travel). District nodes use their id. */
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

        // Region map (debug / future region layer) and the district graph the
        // run actually travels on.
        const runSeed = Date.now() & 0x7FFFFFFF;
        this.runSeed = runSeed;
        this.overworldMap = new OverworldMap(runSeed);
        this.district = DISTRICT;
        this.flags = {};

        this.isRunning = true;
        this.zoneCache.clear();

        // The run starts at the hub node, an ordinary cached zone from turn one.
        this._enterHubZone();
    }

    // ── Enter the hub (safe starting area, and the node you return to) ────────
    _enterHubZone() {
        this.enterNode(HUB_NODE_ID);
        this.ui.log('Downstairs. A fenced yard, a few shacks, and the city beyond.', 'info');
        this.ui.log('W/S move, A/D turn, E interact, Tab to travel, ` toggles the map view, ? for help.', 'info');
    }

    /** True when the active zone is the hub node. */
    isAtHub() {
        return this._currentNodeId === HUB_NODE_ID;
    }

    /** The district node the player is in (null on a debug tile). */
    currentNode() {
        return getNode(this._currentNodeId, this.district);
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

    // ── Node descriptors ───────────────────────────────────────────────────────
    // A descriptor is everything _enterZone needs to build or find a zone:
    //   { id, name, zone (template), seed, biome, playBiome, threat, kind, debugTile? }

    /** Descriptor for a district node. */
    _describeNode(nodeId) {
        const node = getNode(nodeId, this.district);
        if (!node) return null;
        const found = findZoneTemplate(node.zone);
        if (!found) {
            console.warn(`[District] node "${nodeId}" names unknown zone "${node.zone}"`);
            return null;
        }
        const zone = found.template;
        const site = getSiteProfile(zone.id);
        if (site) {
            zone.width = site.width;
            zone.height = site.height;
            zone.interior = true;
        }
        const water = ['ocean', 'lake', 'river', 'coast', 'wetland'].includes(found.biome);
        return {
            id: nodeId,
            name: node.name,
            zone,
            seed: hashString(nodeId, this.runSeed || 1),
            biome: found.biome,
            playBiome: water ? 'rural' : found.biome,
            threat: node.threat || 2,
            kind: node.kind
        };
    }

    /** Descriptor for a region-map tile (debug travel only). */
    _describeTile(col, row) {
        const owTile = this.overworldMap.getTile(col, row);
        if (!owTile) return null;
        const threat = Math.max(1, Math.min(5, owTile.threatLevel + (owTile.zone.threatMod || 0)));
        return {
            id: `ow:${this.zoneKey(col, row)}`,
            name: owTile.zone.name,
            zone: owTile.zone,
            seed: owTile.seed,
            biome: owTile.biome,
            playBiome: owTile.playBiome || owTile.biome,
            threat,
            kind: owTile.zone.id === 'safe_hub' ? 'hub' : (owTile.zone.interior ? 'site' : 'block'),
            debugTile: { col, row }
        };
    }

    // ── Enter a district node ──────────────────────────────────────────────────
    enterNode(nodeId, opts = {}) {
        const desc = this._describeNode(nodeId);
        if (!desc) {
            this.ui.log(`No such place: ${nodeId}.`, 'warning');
            return false;
        }
        this._enterZone(desc, opts);
        return true;
    }

    // ── Drop into a region-map tile (debug travel; kept for the future region layer) ──
    dropIntoZone(col, row, entryEdge = null) {
        const desc = this._describeTile(col, row);
        if (!desc) return;
        this.overworldMap.markExplored(col, row);
        this.overworldMap.cursorCol = col;
        this.overworldMap.cursorRow = row;
        this._enterZone(desc, { entryEdge });
    }

    /**
     * Shared entry path. Parks the current zone, fetches or builds the target
     * zone, places the player, logs the arrival.
     */
    _enterZone(desc, opts = {}) {
        this.cancelAutoTravel();
        this.closeTravel(false);
        const entryEdge = opts.entryEdge || null;

        // Park the zone we are leaving. The player entity travels; the zone stays.
        if (this.world) {
            this.world.removeEntity(this.player);
        }

        this._currentNodeId = desc.id;
        if (desc.debugTile) {
            this._currentZoneCol = desc.debugTile.col;
            this._currentZoneRow = desc.debugTile.row;
        } else {
            // Keep the region cursor parked on the hub tile so the debug map
            // still opens somewhere sensible.
            this._currentZoneCol = this.overworldMap?.hubCol ?? 0;
            this._currentZoneRow = this.overworldMap?.hubRow ?? 0;
        }

        const cached = this.zoneCache.get(desc.id);
        const returning = !!cached;

        if (cached) {
            this.world = cached.world;
            this._initZoneSystems(cached.fov);
        } else {
            const zw = desc.zone.width;
            const zh = desc.zone.height;
            const chunksX = Math.ceil(zw / 128);
            const chunksY = Math.ceil(zh / 128);

            this.world = new World(this);
            this.world.zoneMode     = true;
            this.world.forcedBiome  = desc.playBiome;
            this.world.worldSeed    = desc.seed;
            this.world.zoneWidth    = zw;
            this.world.zoneHeight   = zh;
            this.world.zoneBounds   = { minCx: 0, maxCx: chunksX - 1, minCy: 0, maxCy: chunksY - 1 };
            this.world.zoneTemplate = desc.zone; // faction, purpose, npcSignature, keyFeature
            this.world.nodeId       = desc.id;
            this.world.init();

            this._initZoneSystems();
            this.zoneCache.set(desc.id, { world: this.world, fov: this.fov, node: desc });
        }

        // Generation may resize the zone (interior sites own their footprint),
        // so read the dimensions back off the world rather than the template.
        const activeW = this.world.zoneWidth;
        const activeH = this.world.zoneHeight;

        // Where you appear: a site's entrance, an edge if you walked in over one,
        // otherwise the zone's own arrival point (the hub's gate, a block's kerb).
        let spawnX, spawnY;
        if (this.world.isInterior || !entryEdge) {
            const sp = this.world.getSpawnPosition();
            spawnX = sp.x;
            spawnY = sp.y;
        }
        else if (entryEdge === 'west')  { spawnX = 2;        spawnY = Math.floor(activeH / 2); }
        else if (entryEdge === 'east')  { spawnX = activeW - 3;    spawnY = Math.floor(activeH / 2); }
        else if (entryEdge === 'north') { spawnX = Math.floor(activeW / 2); spawnY = 2; }
        else                            { spawnX = Math.floor(activeW / 2); spawnY = activeH - 3; }

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

        if (!this.world.entities.includes(this.player)) {
            this.world.addEntity(this.player);
        }

        if (!this._loadoutGiven) {
            this.giveStartingLoadout();
            this._loadoutGiven = true;
        }

        this.gameState = 'playing';

        const verb = returning ? 'Returning to' : 'Entering';
        this.ui.log(`${verb}: ${desc.name}  Threat: ${'★'.repeat(desc.threat)}`, 'info');
        if (this.timeSystem && !opts.quiet) {
            this.ui.log(`Time: ${this.timeSystem.getTimeString()} - ${this.timeSystem.getTimePeriod()}`, 'info');
        }
        if (this.world.isInterior && !returning) {
            this.ui.log('Inside. [<] at the entrance to leave, [<] / [>] at the stairwell to change floors.', 'info');
        }

        this.updateFoV();
        this.render();
    }

    // ── Debug: walk off a region-tile edge into the neighbouring tile ─────────
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

    // ── Travel screen (the district graph) ────────────────────────────────────
    /**
     * Open the travel screen from the current node. `reason` is 'edge' when
     * the player walked off the zone, 'exit' when they used a site's door.
     */
    openTravel(reason = null) {
        if (!this.world || !this.player) return;
        this.cancelAutoTravel();
        const nodeId = this._currentNodeId;
        if (!getNode(nodeId, this.district)) {
            // On a debug tile the graph does not apply; show the region map.
            this.openDebugMap();
            return;
        }
        const options = routesFrom(nodeId, this.district).map(o => ({
            ...o,
            locked: !!(o.route.lock && !this.flags[o.route.lock.flag])
        }));
        // Keep the previous selection when reopening from the same node.
        let index = 0;
        if (this.travel && this.travel.from === nodeId) index = Math.min(this.travel.index, options.length - 1);
        this.travel = { from: nodeId, options, index: Math.max(0, index) };
        this.gameState = 'travel';
        if (reason === 'edge') this.ui.log(`You reach the edge of ${this.currentNode()?.name || 'the block'}. Where to?`, 'info');
        this.render();
    }

    closeTravel(render = true) {
        if (this.gameState !== 'travel') return;
        if (!this.world) return;
        this.gameState = 'playing';
        if (render) this.render();
    }

    /** Move the destination selection by +1 / -1. */
    travelSelect(step) {
        if (this.gameState !== 'travel' || !this.travel) return;
        const n = this.travel.options.length;
        if (!n) return;
        this.travel.index = ((this.travel.index + step) % n + n) % n;
        this.render();
    }

    travelSelection() {
        if (!this.travel) return null;
        return this.travel.options[this.travel.index] || null;
    }

    /** Take the selected route. */
    travelGo() {
        if (this.gameState !== 'travel') return;
        const sel = this.travelSelection();
        if (!sel) return;
        this.travelRoute(sel.route, sel.dest);
    }

    /**
     * Estimate what a route will cost right now: turns, effective danger, and
     * survival drain. Shown before the player commits; used again to resolve.
     */
    routeEstimate(route) {
        const turns = route.turns;
        const mult = dangerMultiplier(this.timeSystem);
        const danger = Math.min(0.95, route.danger * mult);
        const p = this.player;
        return {
            turns,
            danger,
            nightMult: mult,
            hungerCost: turns * (p?.hungerRate || 0),
            thirstCost: turns * (p?.thirstRate || 0)
        };
    }

    /**
     * Resolve travelling a route: refuse if locked, pass the time detached from
     * any zone, arrive, then roll for trouble. Phase 1 stub: a loud roll drops
     * a hostile near the arrival point; Phase 2 replaces that with a slice.
     */
    travelRoute(route, dest) {
        if (!this.isRunning || !this.player || this.player.isDead()) return false;
        if (route.lock && !this.flags[route.lock.flag]) {
            this.ui.log(`${route.name}: ${route.lock.reason}`, 'warning');
            return false;
        }
        const est = this.routeEstimate(route);
        const from = this.currentNode();
        const startTime = this.timeSystem.getTimeString();

        // Detach from the zone we are leaving before time passes so its NPCs do
        // not act around a player who is no longer there.
        this.world.removeEntity(this.player);
        this.gameState = 'playing';
        const passed = this.passTime(est.turns, { detached: true, render: false });
        if (passed.interrupted === 'death') return false;

        this.enterNode(dest.id, { quiet: true });

        const h = Math.floor(passed.turns / 60);
        const m = passed.turns % 60;
        const span = `${h ? `${h}h ` : ''}${m}m`.trim();
        this.ui.log(`${route.name}: ${from?.name || 'the road'} to ${dest.name}, ${span}. Left ${startTime}, arrived ${this.timeSystem.getTimeString()}.`, 'info');

        const loud = Math.random() < est.danger;
        if (!loud) {
            this.ui.log(est.nightMult > 1 ? 'A dark walk, but a quiet one.' : 'The way was quiet.', 'info');
        } else if (dest.kind === 'hub') {
            this.ui.log('Something followed you as far as the gate, then thought better of it.', 'warning');
        } else {
            this.ui.log('Trouble found you on the way in.', 'warning');
            this._spawnArrivalTrouble();
        }
        this.render();
        return true;
    }

    /** Phase 1 stand-in for a route slice: one hostile a few cells off. */
    _spawnArrivalTrouble() {
        const p = this.player;
        for (let r = 3; r <= 6; r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
                    const x = p.x + dx;
                    const y = p.y + dy;
                    if (this.world.isBlocked(x, y, p.z)) continue;
                    if (!this.fov.hasLineOfSight(p.x, p.y, x, y)) continue;
                    const npc = new NPC(this, 'debug_hostile', x, y);
                    npc.z = p.z;
                    npc.name = 'Roadside Mugger';
                    this.world.addEntity(npc);
                    this.updateFoV();
                    return npc;
                }
            }
        }
        return null;
    }

    // ── Region map (debug; the future region layer) ────────────────────────────
    openDebugMap() {
        this.cancelAutoTravel();
        if (this.overworldMap) {
            this.overworldMap.cursorCol = this._currentZoneCol;
            this.overworldMap.cursorRow = this._currentZoneRow;
        }
        this.gameState = 'overworld';
        this.render();
    }

    /** Kept for callers that predate the travel screen. */
    returnToOverworld() {
        this.openTravel('exit');
    }

    closeOverworld() {
        if (!this.world) return;
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
                    // On a district node the edge is where you pick a route.
                    // On a debug region tile you still walk into the neighbour.
                    if (this.currentNode()) this.openTravel('edge');
                    else this.transitionZone(action.dx, action.dy);
                    return; // both handle render
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
                this.openTravel('exit');
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
     *   detached     - the player is between zones (route travel): the clock,
     *                  fuel, and the body run; no zone's NPCs or sounds do
     *   render       - redraw at the end (default true)
     * @returns {{ turns: number, interrupted: string|null }}
     */
    passTime(turns, opts = {}) {
        if (!this.isRunning) return { turns: 0, interrupted: 'not running' };
        const sleeping = !!opts.sleeping;
        const detached = !!opts.detached;
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
                if (!detached) {
                    this.world.processTurn(100);
                    this.soundSystem.processTurn();
                }
                this.abilitySystem?.processTurn();
                if (p.isDead()) {
                    interrupted = 'death';
                    done++;
                    break;
                }
                if (sleeping && !detached && done % 5 === 4 && this._hostileWithin(wakeRadius)) {
                    interrupted = 'hostile';
                    done++;
                    break;
                }
            }
        } finally {
            p.hungerRate = savedRates.hunger;
            p.thirstRate = savedRates.thirst;
        }

        if (!detached) this.updateFoV();
        this.checkGameOver();
        if (opts.render !== false) this.render();
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

        if (this.gameState === 'travel') {
            this.renderTravel();
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

    // ── Travel screen rendering ───────────────────────────────────────────────
    /**
     * The district graph on the game canvas: every node at its catalog
     * position, routes as lines, the current node and the selected destination
     * highlighted, travel time on the routes you can take from here.
     */
    renderTravel() {
        const ctx = this.renderer.ctx;
        const W = this.renderer.canvas.width;
        const H = this.renderer.canvas.height;
        const t = this.travel;
        const district = this.district;
        if (!ctx || !t || !district) return;

        ctx.save();
        ctx.fillStyle = '#07090c';
        ctx.fillRect(0, 0, W, H);

        // Faint grid so the screen reads as a map, not a blank.
        ctx.strokeStyle = 'rgba(80,110,130,0.10)';
        ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

        const top = 64, bottom = 44, side = 24;
        const nodeW = Math.max(112, Math.min(176, Math.floor(W * 0.15)));
        const nodeH = 46;
        const usableW = W - side * 2 - nodeW;
        const usableH = H - top - bottom - nodeH;
        const centre = (node) => ({
            x: side + nodeW / 2 + node.pos[0] * usableW,
            y: top + nodeH / 2 + node.pos[1] * usableH
        });

        const here = this.currentNode();
        const sel = this.travelSelection();
        const selDest = sel?.dest?.id;
        const selRoute = sel?.route;
        const fromHere = new Set(t.options.map(o => o.dest.id));
        const visited = (id) => this.zoneCache.has(id);

        // Title strip
        ctx.fillStyle = '#0d1218';
        ctx.fillRect(0, 0, W, top - 12);
        ctx.fillStyle = '#7fe0e8';
        ctx.font = 'bold 15px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(district.name.toUpperCase(), 20, 20);
        ctx.fillStyle = '#9aa1ad';
        ctx.font = '13px monospace';
        ctx.fillText(`You are at ${here?.name || '?'}`, 20, 40);
        ctx.textAlign = 'right';
        const ts = this.timeSystem;
        if (ts) {
            ctx.fillStyle = ts.isNight() ? '#7f9cff' : '#ffd36a';
            ctx.fillText(`${ts.getTimeString()}  ${ts.getTimePeriod()}  Day ${ts.getDay()}`, W - 20, 20);
            if (ts.isDark()) {
                ctx.fillStyle = '#e0a04a';
                ctx.fillText(ts.isNight() ? 'Night: routes are much more dangerous' : 'Dusk: routes are more dangerous', W - 20, 40);
            }
        }

        // Routes
        const drawEdge = (r, style) => {
            const a = getNode(r.a, district), b = getNode(r.b, district);
            if (!a || !b) return;
            const pa = centre(a), pb = centre(b);
            ctx.save();
            ctx.strokeStyle = style.color;
            ctx.lineWidth = style.width;
            ctx.setLineDash(style.dash || []);
            ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
            ctx.restore();
            return { mx: (pa.x + pb.x) / 2, my: (pa.y + pb.y) / 2 };
        };
        for (const r of district.routes) {
            const touches = r.a === t.from || r.b === t.from;
            const locked = r.lock && !this.flags[r.lock.flag];
            if (touches) continue;
            drawEdge(r, { color: locked ? 'rgba(120,60,60,0.5)' : 'rgba(90,110,130,0.45)', width: 1.5, dash: locked ? [4, 4] : [] });
        }
        const labels = [];
        for (const o of t.options) {
            const r = o.route;
            const isSel = r === selRoute;
            const mid = drawEdge(r, {
                color: isSel ? '#ffdd44' : (o.locked ? 'rgba(200,90,90,0.8)' : 'rgba(140,210,230,0.85)'),
                width: isSel ? 3 : 2,
                dash: o.locked ? [5, 4] : []
            });
            if (mid) labels.push({ mid, o, isSel });
        }

        // Nodes
        const KIND_GLYPH = { hub: '@', site: '#', block: '=' };
        for (const [id, n] of Object.entries(district.nodes)) {
            const node = { id, ...n };
            const c = centre(node);
            const x = c.x - nodeW / 2, y = c.y - nodeH / 2;
            const isHere = id === t.from;
            const isSel = id === selDest;
            const reach = fromHere.has(id);
            const opt = t.options.find(o => o.dest.id === id);
            const locked = !!opt?.locked;
            const seen = visited(id);

            let fill = '#12161c', border = '#2e3640', text = seen ? '#d8dde5' : '#8a93a0', sub = '#6c7480';
            if (isHere) { fill = '#0f2a1c'; border = '#00ff88'; text = '#e6ffe6'; sub = '#7fd8a8'; }
            else if (isSel) { fill = locked ? '#2a1414' : '#2a2410'; border = locked ? '#ff6666' : '#ffdd44'; text = '#ffffff'; sub = locked ? '#ff9999' : '#ffe9a0'; }
            else if (reach) { border = locked ? '#7a3a3a' : '#4fa8b8'; }

            ctx.fillStyle = fill;
            ctx.strokeStyle = border;
            ctx.lineWidth = isHere || isSel ? 2.5 : 1.5;
            ctx.setLineDash(locked && !isSel ? [4, 3] : []);
            ctx.beginPath();
            ctx.roundRect ? ctx.roundRect(x, y, nodeW, nodeH, 6) : ctx.rect(x, y, nodeW, nodeH);
            ctx.fill(); ctx.stroke();
            ctx.setLineDash([]);

            ctx.fillStyle = text;
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.name, c.x, c.y - 8, nodeW - 14);
            ctx.fillStyle = sub;
            ctx.font = '10.5px monospace';
            const kindText = node.kind === 'hub' ? 'hub' : node.kind;
            const stars = '★'.repeat(node.threat || 1);
            const status = isHere ? 'here' : seen ? 'visited' : 'unvisited';
            ctx.fillText(`${KIND_GLYPH[node.kind] || '?'} ${kindText} · ${stars} · ${status}`, c.x, c.y + 10, nodeW - 14);
        }

        // Route labels last so they sit above whatever they cross.
        for (const { mid, o, isSel } of labels) {
            const est = this.routeEstimate(o.route);
            const label = o.locked ? 'locked' : `${est.turns}m`;
            ctx.font = 'bold 11px monospace';
            const tw = ctx.measureText(label).width + 10;
            ctx.fillStyle = isSel ? '#ffdd44' : '#0d1218';
            ctx.fillRect(mid.mx - tw / 2, mid.my - 9, tw, 18);
            ctx.strokeStyle = isSel ? '#ffdd44' : (o.locked ? '#aa5555' : '#4fa8b8');
            ctx.lineWidth = 1;
            ctx.setLineDash([]);
            ctx.strokeRect(mid.mx - tw / 2, mid.my - 9, tw, 18);
            ctx.fillStyle = isSel ? '#111' : (o.locked ? '#dd8888' : '#bfe4ff');
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, mid.mx, mid.my);
        }

        // Hint bar
        ctx.fillStyle = '#0d1218';
        ctx.fillRect(0, H - bottom + 8, W, bottom - 8);
        ctx.fillStyle = '#8a93a0';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('A / D  or  ◄ ►  choose a route   ·   Enter  go   ·   Tab  back   ·   F8  region map (debug)', W / 2, H - bottom / 2 + 4);
        ctx.restore();

        this.ui.updateTravelPanel();
        if (this.mobileControls) this.mobileControls.updateHUD();
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
