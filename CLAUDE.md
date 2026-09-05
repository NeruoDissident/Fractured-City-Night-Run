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

## Next phases
1. Define the run flow (start, pull, end) before building maps for it.
2. Interior-first zone generators: corridors, rooms, doors, multiple z-levels.
3. UI cleanup around what the crawler view actually shows.
4. Cone FoV, facing-aware combat, wall textures / billboard sprites.

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
