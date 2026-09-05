# Fractured City: Night Run — working notes for Claude Code

## What this project is now
A browser-based, turn-based, **first-person grid crawler** set in a cyberpunk city
that is still running on fumes. Vanilla JS + Canvas 2D, no build step, no
dependencies. Open `index.html` or run `python -m http.server 8000`.

The first-person view (`src/core/FirstPersonRenderer.js`) is the primary view.
The top-down map (`World.render`) is a debug/tuning view toggled with backtick.
Both read the same World / FoV / Lighting data; never make simulation rules
depend on which view is active.

The structure the game is being rebuilt around is **hub and run**: one
persistent town (Downstairs), a district of sites you reach from it, and a run
loop of prepare / travel / run / return. `REDESIGN_BRIEF.md` is the design
record and roadmap; when another doc disagrees with it, the brief wins.

## Current state of the rework
- **Done:** first-person renderer, relative movement (W/S/A/D, Shift+A/D strafe),
  facing-aware interact/inspect, automap facing arrow.
- **Done:** interior *sites* - multi-floor building interiors
  (`src/world/gen/InteriorGenerator.js`, `src/content/SiteCatalog.js`).
- **Done (Phase 0):** zone persistence, the hub as a real node, Crew Stash,
  bunks with Rest / Sleep. See "Zone persistence" and "The hub" below.
- **Done (Phase 1):** the district graph is the travel surface. Tab opens the
  travel screen; routes charge time, hunger, thirst, and light, and roll for
  trouble. See "District travel" below.
- **Done (Phase 2):** streets are `block` levels from the same generator
  (corridors with sky, storefront rooms with presets, dead-end alleys, an exit
  at each end); route slices for loud rolls and walkable routes; daylight
  leaking through doors; floor loot per room; a facade per block. The
  hand-placed street generators and `UrbanFragments.js` are gone. See
  "Blocks and slices" below.
- **Removed (do not resurrect):** QuestSystem, GoalSystem, the Street Kid intro
  chain, delivery errands, POIs / Known Places / auto-travel-to-POI, the old NPC
  roster (raider, brute, survivor, ganger...).
- **Kept:** combat, anatomy, equipment, inventory/containers, crafting,
  hunger/thirst, time, sound, lighting, FoV, overworld grid, zone generators,
  the NPC AI shell (detection state machine, hearing, fleeing, energy turns).
- **Placeholders:** `src/content/NpcCatalog.js` has `debug_hostile` and
  `debug_neutral`. `F9` / `Shift+F9` (or `game.debugSpawn()`) spawns one ahead
  of the player so combat stays testable. The real roster arrives in Phase 3.
- **Shelved, not deleted:** the 160x100 tile overworld. `F8` opens it as a
  debug region map and you can still drop into tiles from it; it comes back
  properly later as a region layer between towns.

## Zone persistence
Every zone the player has visited stays alive in `Game.zoneCache`, keyed by its
district node id (`ow:col,row` for a debug region tile). An entry is
`{ world, fov, node }`: the `World` (tiles, world objects, items, NPCs), the
`FoVSystem` (explored tiles), and the node descriptor. `Game._enterZone` is
get-or-create: the player entity is removed from the old world and added to
the cached or new one; every other per-zone system (sound, lighting, combat,
abilities...) is transient and rebuilt by `_initZoneSystems(fov)`.
`Game.enterNode(id)` is the normal way in; `Game.dropIntoZone(col, row)` is
the debug-map way in.

Rules:
- Anything that should survive leaving a zone lives on the `World`, its
  `worldObjects`, its `items`, or its entities. Nothing persistent goes on a
  system object.
- Keep cached state plain data (no closures, no DOM refs). The cache is what a
  save file will serialise in Phase 4.
- NPCs in a parked zone do not act. Catch-up simulation is a later decision.
- `Game.passTime(turns, opts)` is the one way to advance many turns at once
  (sleeping, route travel). It runs the per-turn systems and redraws once.
  `detached: true` means the player is between zones: the clock, fuel, and the
  body run, no zone's NPCs do. Use it rather than looping `advanceTurn`.

## District travel
`src/content/DistrictCatalog.js` is the graph: nodes (`hub` | `site` | `block`,
each naming a zone template from `OverworldMap.ZONE_POOLS`, `SiteCatalog`, or
`HUB_ZONE`) and undirected routes (`turns`, `danger`, optional `lock`). Twelve
nodes ship, two of them behind locks (`pumps_fixed`, `coast_road_open`) that
Phase 4 projects will set on `game.flags`.
- **Getting there.** `Tab` opens the travel screen (`gameState 'travel'`,
  `Game.renderTravel`). Walking off the edge of a block and `<` at a site
  entrance open it too: the edge is where you choose a route. A / D or the
  arrows cycle the routes from the current node, Enter goes, Tab or Esc stays.
- **What a route costs.** `Game.routeEstimate(route)` returns turns, effective
  danger (`dangerMultiplier`: 1.25 at dusk, 1.6 at night), and hunger/thirst
  drain. The side panel shows all of it before you commit; keep that so
  (the "player knows the outcome before acting" pillar).
- **Resolution.** `Game.travelRoute(route, dest)`: refuse if locked, detach
  the player, `passTime(turns, { detached: true })`, roll danger. Quiet:
  `enterNode(dest)`. Loud: charge 60% of the time and drop into the route's
  **slice** with hostiles (`_enterSlice`, `_spawnSliceTrouble`). A route with
  `walk` set is walkable: you always get its slice at the near end and walk it
  (approach time = turns minus the slice length). Slice exits carry
  `world.exitTargets` so `<` at an end goes straight to that endpoint; Tab is
  refused inside a slice.
- **Adding a place** is a node entry plus at least one route. Node `zone` must
  be a known template id; `Game._describeNode` warns and refuses otherwise.
  Positions are 0..1 canvas units and are hand-placed; keep neighbours far
  enough apart that a route label fits between them.
- Survival drain was retuned for the day loop when travel started charging
  time: hunger 0.04/turn, thirst 0.07/turn (about 42h and 24h from full).

## Blocks and slices
A **block** is a `SiteCatalog` profile with `block: true` and one level whose
`layout` is `block` and `sky: true`: a street 3 to 5 wide, wall to wall, an
optional cross street (`cross: 'T' | 'full' | false`), one-wide dead-end
alleys (`alleys`), storefront rooms off every hall, exits at every street end
(`exits: 'all'`). Corridor tiles are exterior (sky, daylight); rooms are
interior. Same invariants and audit as a floor. Corner Store Block, Market
Corner, and Neon Row are blocks; Metro Depths got a proper two-level profile.
- **Storefronts** are room presets in `src/content/StorefrontCatalog.js`:
  `type` (a `FURNITURE_LOOT` key), `label`, `floor`, `furniture`, `doorType`,
  `lightColor`. `storefrontRooms([...])` turns a weighted list into the
  generator's `roomTypes`. A room's preset wins over the level defaults.
- **Slices** (`SLICE_PROFILES`, ids `slice_street | slice_alley |
  slice_underpass | slice_lot`) are one-screen blocks with exactly a west and
  an east exit. `Game._enterSlice` tags west to `route.a` and east to
  `route.b`, places the player at the end they came from, and caches the slice
  by `routeKey(route)` like any zone. Underpass is the one slice without sky.
- **Daylight.** Any door on a sky level that faces a hall gets a static light
  with `daylight: true`; `LightingSystem` scales those by the current outdoor
  ambient and gives them no tint. Non-sky ground floors get one at the
  entrance. Blocks can have no stairwell (`hasCore` is false for a
  single-level profile); the connectivity origin is then the first hall cell.
- **Floor loot.** `level.floorLootChance` (default 0.4) drops one or two items
  from the room type's furniture pools on the floor, never beside a door.
- **Facades.** One wall tile per block (`brickFacade`, `concreteFacade`,
  `neonFacade`, `shutterFacade` in `ZoneTiles`) so a street says which block
  it is. Street floors: `street`, `alleyFloor`, `marketPaving`, `neonStreet`.
- `ZoneGenerator.js` now only builds the hub, the debug-map open-ground zones,
  and the empty-lot fallback. Do not add hand-placed layouts there; add a
  profile.

## The hub
Downstairs is pinned to the overworld centre tile (`OverworldMap.hubCol/hubRow`,
zone id `safe_hub`, `HUB_ZONE` in `OverworldMap.js`) and built by
`generateSafeHub`. `Game.isAtHub()` says whether the active zone is it.
- You arrive at the **South Gate** facing north whenever you travel there;
  walking in over an edge keeps the edge and your direction of travel.
- **Crew Stash** (furniture type `stash`, in the Commons): player-owned
  storage with no loot table, so the generator never fills it. Search it to
  move items in or out with the existing furniture-contents UI.
- **Bunks** (furniture type `bed`) offer `rest` (60 turns) and `sleep` (until
  the next dawn 06:00 or dusk 18:00, minimum an hour). Both go through
  `WorldObjectSystem.restAt` and `Game.passTime` with hunger/thirst drain
  halved; both refuse with a hostile within 12 cells and wake you if one closes
  to 10. The modal shows the predicted cost before you commit - keep it that
  way (the "player knows the outcome before acting" pillar).
- Hub buildings have **baked lights** in `world.staticLights` so the yard and
  shacks read in first person at any hour. Street and site interiors still go
  dark; daylight leak is a Phase 2 item.

## Sites (interiors)
A *site* is a building you enter from the overworld instead of a street map.
`getSiteProfile(zoneId)` decides: if an overworld zone id has a profile,
`ZoneGenerator` hands off to `generateSite()` and the zone becomes an interior.

- Each site is a stack of floors sharing one **stair core** at fixed x/y, plus a
  single **entrance** on z 0. `<` at the entrance leaves; `<` / `>` at the
  stairwell changes floor. Interiors are sealed - no walking off the zone edge.
- Layouts: `spine` (corridors with rooms both sides), `bsp` (irregular
  sublevels), `ring` (corridor loop, shops outside, subdivided core).
- Rooms are capped at 8x8 on purpose. Bigger than that stops reading as a room
  in first person and the floor turns into a warehouse.
- **Every room keeps a one-cell wall on all sides except its doorway.** Halls
  are routed by BFS and never run along a room; the hall network is connected
  on its own (rooms hang off halls, never serve as the way through); furniture
  can never split a room's free cells. `world.siteAudit` reports leaks per
  level and must read zero. If a floor ever looks like "open rooms", one of
  these invariants has been broken - check the audit before touching visuals.
- Room `type` must be a `FURNITURE_LOOT` key (see `Furniture.js`) so room-aware
  loot and furniture keep working.
- Emergency lighting is baked at generation time into `world.staticLights` and
  picked up by `LightingSystem`'s constructor. Corridors are lit enough to
  navigate; rooms mostly are not, so a carried light still matters.
- **To add a site:** add a profile to `SITE_PROFILES` keyed by an overworld zone
  id (or alias an existing one). Nothing else needs touching.
- Blocks (streets) are this same generator with the `block` layout; see
  "Blocks and slices".

## Next phases (see REDESIGN_BRIEF.md for detail)
1. ~~Phase 1~~ done: district graph and travel screen, route resolution.
2. ~~Phase 2~~ done: blocks, slices, walkable routes, daylight, floor loot,
   facades.
3. **Phase 3:** roster v1 (hub roles first), hub needs, contracts and the
   board, set pieces, encounter budgets, night danger.
4. **Phase 4:** projects as recipes with a location, one extraction path end to
   end, save/load from the zone cache.
5. **Phase 5:** colony layer proper, if Phase 4 earns it.

Route model decision: mixed, leaning abstract. Slices only on a loud roll by
default; the two streets leaving the hub are walkable. Promote a route by
setting `walk` on it.

## Conventions
- ES modules, no bundler. Keep files importable directly by the browser.
- Systems live in `src/systems/`, content/data in `src/content/`, world and
  generation in `src/world/`, DOM UI in `src/ui/`.
- ASCII first: every tile, object, and entity needs a glyph + colour; sprites
  are optional and must fall back to the glyph. New furniture types also need
  an entry in `ZoneCanvas.FURNITURE_ASCII` and the icon maps in
  `WorldObjectModal.js`.
- Turn costs are energy units (100 = one walk step). Free actions cost 0 and
  must not tick the world (see `Game.processTurn`).
- `Player.facing` is one of north/east/south/west in first-person; use the
  helpers exported from `FirstPersonRenderer.js` (`turnFacing`,
  `relativeToDelta`, `deltaToRelative`) rather than hand-rolling direction math.
- New NPC types go in `NpcCatalog.js`; `ZoneCanvas.addNpc` skips unknown types.
- New world-object actions: add the verb to the object's `getAvailableActions`,
  a case in `WorldObjectSystem.performAction`, and a `getActionInfo` entry in
  `WorldObjectModal.js` that states the cost.
- Bump `CACHE_NAME` in `sw.js` when shipping changes the PWA should pick up.

## Verifying changes
There is no test suite. Smoke-test in a headless browser:
`node` + Playwright (`/opt/node22/lib/node_modules/playwright` in the remote
environment) can load `index.html`, click `#cg-play-now`, drive keys, and
screenshot `#game-canvas`. Check `window.game` state and the log panel
(`#log-content`). Always confirm zero `pageerror`s before pushing.

Persistence check worth repeating after world changes: open a door or store an
item, travel away and back (or leave a site with `<` and re-enter), and confirm
`game.world` is the same object and the change is still there. From the
console: `game.openTravel()`, `game.travelRoute(route, dest)` with an entry
from `game.travel.options`, `game.enterNode('clinic')`, `game.flags.x = true`.

## Workflow
Big cross-cutting changes (new systems, generators, removals) are done in
Claude Code sessions and pushed to the working branch. Quick visual tuning
(colours, projection constants, CSS) happens in the IDE. Pull before starting
either side; push before handing off.
