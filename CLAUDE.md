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
- **Done:** interior *sites* - multi-floor building interiors you drop into from
  the overworld (`src/world/gen/InteriorGenerator.js`,
  `src/content/SiteCatalog.js`). Street zones still generate as before.
- **Done (Phase 0):** zone persistence, the hub as a real node, Crew Stash,
  bunks with Rest / Sleep. See "Zone persistence" and "The hub" below.
- **Removed (do not resurrect):** QuestSystem, GoalSystem, the Street Kid intro
  chain, delivery errands, POIs / Known Places / auto-travel-to-POI, the old NPC
  roster (raider, brute, survivor, ganger...).
- **Kept:** combat, anatomy, equipment, inventory/containers, crafting,
  hunger/thirst, time, sound, lighting, FoV, overworld grid, zone generators,
  the NPC AI shell (detection state machine, hearing, fleeing, energy turns).
- **Placeholders:** `src/content/NpcCatalog.js` has `debug_hostile` and
  `debug_neutral`. `F9` / `Shift+F9` (or `game.debugSpawn()`) spawns one ahead
  of the player so combat stays testable. The real roster arrives in Phase 3.
- **Shelved, not deleted:** the 160x100 tile overworld as the travel surface.
  It stays reachable with Tab until the district graph (Phase 1) replaces it,
  and comes back later as a region map between towns.

## Zone persistence
Every zone the player has visited stays alive in `Game.zoneCache`, keyed by
`Game.zoneKey(col, row)` (Phase 1 swaps this for graph node ids). An entry is
`{ world, fov, col, row }`: the `World` (tiles, world objects, items, NPCs) and
the `FoVSystem` (explored tiles). `Game.dropIntoZone` is get-or-create: the
player entity is removed from the old world and added to the cached or new one;
every other per-zone system (sound, lighting, combat, abilities...) is transient
and rebuilt by `_initZoneSystems(fov)`.

Rules:
- Anything that should survive leaving a zone lives on the `World`, its
  `worldObjects`, its `items`, or its entities. Nothing persistent goes on a
  system object.
- Keep cached state plain data (no closures, no DOM refs). The cache is what a
  save file will serialise in Phase 4.
- NPCs in a parked zone do not act. Catch-up simulation is a later decision.
- `Game.passTime(turns, opts)` is the one way to advance many turns at once
  (sleeping now; route travel in Phase 1). It runs the per-turn systems and
  redraws once. Use it rather than looping `advanceTurn`.

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
- Phase 2 points this same generator at street blocks: streets as wide
  corridors under a `sky` flag, storefronts as rooms with their own interiors.
  Do not add new hand-placed street generators to `ZoneGenerator.js`; they are
  being retired.

## Next phases (see REDESIGN_BRIEF.md for detail)
1. **Phase 1:** district graph and travel screen replace overworld travel;
   route resolution (time, drain, danger); site exit returns to a node.
2. **Phase 2:** `block` layout (streets as corridors with sky, enterable
   storefronts), route slices, walkable routes near the hub, daylight leak,
   wall material per site, floor props.
3. **Phase 3:** roster v1 (hub roles first), hub needs, contracts and the
   board, set pieces, encounter budgets, night danger.
4. **Phase 4:** projects as recipes with a location, one extraction path end to
   end, save/load from the zone cache.
5. **Phase 5:** colony layer proper, if Phase 4 earns it.

Route model decision: mixed, leaning abstract. Slices by default; walkable
blocks where the place is the content. Any route can be promoted later.

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
item, walk off an edge and back (or leave a site and re-enter), and confirm
`game.world` is the same object and the change is still there.

## Workflow
Big cross-cutting changes (new systems, generators, removals) are done in
Claude Code sessions and pushed to the working branch. Quick visual tuning
(colours, projection constants, CSS) happens in the IDE. Pull before starting
either side; push before handing off.
