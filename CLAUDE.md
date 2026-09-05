# Fractured City: Night Run — working notes for Claude Code

## What this project is now
A browser-based, turn-based, **first-person grid crawler** set in a cyberpunk city
that is still running on fumes. Vanilla JS + Canvas 2D, no build step, no
dependencies. Open `index.html` or run `python -m http.server 8000`.

The first-person view (`src/core/FirstPersonRenderer.js`) is the primary view.
The top-down map (`World.render`) is a debug/tuning view toggled with backtick.
Both read the same World / FoV / Lighting data; never make simulation rules
depend on which view is active.

## Current state of the rework
- **Done:** first-person renderer, relative movement (W/S/A/D, Shift+A/D strafe),
  facing-aware interact/inspect, automap facing arrow.
- **Done:** interior *sites* - multi-floor building interiors you drop into from
  the overworld (`src/world/gen/InteriorGenerator.js`,
  `src/content/SiteCatalog.js`). Street zones still generate as before.
- **Removed (do not resurrect):** QuestSystem, GoalSystem, the Street Kid intro
  chain, delivery errands, POIs / Known Places / auto-travel-to-POI, the old NPC
  roster (raider, brute, survivor, ganger...).
- **Kept:** combat, anatomy, equipment, inventory/containers, crafting,
  hunger/thirst, time, sound, lighting, FoV, overworld grid, zone generators,
  the NPC AI shell (detection state machine, hearing, fleeing, energy turns).
- **Placeholders:** `src/content/NpcCatalog.js` has `debug_hostile` and
  `debug_neutral`. `F9` / `Shift+F9` (or `game.debugSpawn()`) spawns one ahead
  of the player so combat stays testable. The real roster arrives with the new
  run flow.

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

## Next phases
1. Define the run flow (start, pull, end) before building content for it.
2. UI cleanup around what the crawler view actually shows.
3. Cone FoV, facing-aware combat, wall textures / billboard sprites.
4. Set pieces and encounter budgets per level, once the roster exists.

## Conventions
- ES modules, no bundler. Keep files importable directly by the browser.
- Systems live in `src/systems/`, content/data in `src/content/`, world and
  generation in `src/world/`, DOM UI in `src/ui/`.
- ASCII first: every tile, object, and entity needs a glyph + colour; sprites
  are optional and must fall back to the glyph.
- Turn costs are energy units (100 = one walk step). Free actions cost 0 and
  must not tick the world (see `Game.processTurn`).
- `Player.facing` is one of north/east/south/west in first-person; use the
  helpers exported from `FirstPersonRenderer.js` (`turnFacing`,
  `relativeToDelta`, `deltaToRelative`) rather than hand-rolling direction math.
- New NPC types go in `NpcCatalog.js`; `ZoneCanvas.addNpc` skips unknown types.

## Verifying changes
There is no test suite. Smoke-test in a headless browser:
`node` + Playwright (`/opt/node22/lib/node_modules/playwright` in the remote
environment) can load `index.html`, click `#cg-play-now`, drive keys, and
screenshot `#game-canvas`. Check `window.game` state and the log panel
(`#log-content`). Always confirm zero `pageerror`s before pushing.

## Workflow
Big cross-cutting changes (new systems, generators, removals) are done in
Claude Code sessions and pushed to the working branch. Quick visual tuning
(colours, projection constants, CSS) happens in the IDE. Pull before starting
either side; push before handing off.
