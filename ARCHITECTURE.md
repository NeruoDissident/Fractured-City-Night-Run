# Fractured City Roguelike - Architecture Documentation

## Current Architecture Note

The project has shifted from primarily infinite chunk generation toward **bounded zone generation connected by an overworld**. Old `Chunk.js` generation still exists and some sections below describe it historically, but the active design path is:

`DistrictCatalog` names a node -> `Game.enterNode()` returns the cached zone-mode `World` for that node or creates one from the node's zone template -> on first visit `ZoneGenerator` and `ZoneCanvas` (or `InteriorGenerator`) build the map -> the player explores it in first person -> `Tab`, a block edge, or a site exit opens the travel screen -> `Game.travelRoute()` charges time and drain and enters the next node -> the zone left behind stays parked in `Game.zoneCache`.

The quest chain, goal board, delivery errands, POIs/Known Places, and the old NPC roster were removed during the first-person pivot. The game is now being built around a hub-and-run structure; `REDESIGN_BRIEF.md` is the design record and roadmap, and `CLAUDE.md` has the working rules. The tile overworld is shelved as the travel surface (a district graph replaces it in Phase 1) but the code stays for a later region map.

Current priority systems:
- `src/world/gen/InteriorGenerator.js` with `SiteCatalog.js` and `StorefrontCatalog.js`: every site, block, and slice.
- `Game.startAutoExplore()`: auto-explore toward unexplored ground.
- `src/content/NpcCatalog.js` + `Game.debugSpawn()`: placeholder NPC templates and the F9 spawner.

ASCII is currently the primary development view. Sprites remain supported, but every visual path needs a clear ASCII fallback.

## Design Philosophy

**Clean, Expandable, Modular**
- Systems are isolated in their own files with clear responsibilities
- Expansion points are documented in code comments
- Data-driven design: content scales through JSON, not hardcoded logic
- No spaghetti: strict separation between rendering, logic, and data

---

## Core Systems

### 1. Game Loop (`src/core/Game.js`)
**Responsibility:** Main game state, turn processing, initialization

**Key Methods:**
- `init()` - Initializes all subsystems
- `startGame(characterData)` - Begins a new run at the hub
- `enterNode(nodeId, opts)` - Get-or-create a district node's zone from `zoneCache`, move the player into it
- `dropIntoZone(col, row, entryEdge)` - Same for a region-map tile (debug)
- `openTravel(reason)` / `travelSelect(step)` / `travelGo()` - The travel screen
- `routeEstimate(route)` / `travelRoute(route, dest)` - Cost preview and resolution
- `processTurn(action)` - Advances world by one tick
- `advanceTurn(turns)` - A few turns for an action (open a door, search)
- `passTime(turns, opts)` - Many turns in one step (sleep, route travel)
- `render()` - Triggers rendering pipeline

**Expansion Points:**
- Add game modes (tutorial, challenge runs)
- Serialise `zoneCache` for save/load (Phase 4)
- Add run statistics tracking

---

### 2a. First-Person View (`src/core/FirstPersonRenderer.js`)
**Responsibility:** Grid-crawler view of the current zone from the player's cell along `player.facing`

`Game.render()` dispatches to `FirstPersonRenderer.render()` when `game.viewMode === 'first_person'` (the default) and to `World.render()` for the top-down view. Both read the same `World`, `FoVSystem`, and `LightingSystem` data, so nothing in the simulation depends on which view is active.

**How it draws:**
- Cells are addressed in view-relative coordinates: depth `d` (0 = player cell, 1 = cell ahead) and lateral `l` (negative = left).
- Painter's algorithm: far depth first, outer laterals first, so nearer surfaces overwrite farther ones.
- Solid cells (blocked + blocksVision, plus glass) draw a front face and the side face toward the view axis, coloured from the tile's fg/bg colours and lit by the open cell in front of them.
- Walkable cells draw a floor quad (with the tile glyph stamped on it) and a ceiling quad when indoors; outdoors shows a time-of-day sky.
- Doors, furniture, fences, items, and entities are billboards (scaled glyphs, or sprites when sprite mode is on) at the centre of their cell.
- Depth fog fades to black at the effective vision range; remembered-but-unseen cells are drawn dim.
- Overlays: compass strip, "Ahead / Here" readout, interact and inspect cell outlines, floating combat text.

**Facing helpers** (exported from the same file): `normalizeFacing`, `facingVector`, `rightVector`, `turnFacing`, `relativeToDelta`, `deltaToRelative`.

**Input model in first person:** forward/back/strafe become world deltas via `Game.relativeDelta()`; turning is a `{ type: 'turn', steps }` action that costs no time. `Player.tryMove(dx, dy, { keepFacing })` preserves facing for backpedal/strafe and refuses to attack a creature you are not facing.

**Expansion Points:**
- Wall textures / per-material faces
- Cone-shaped FoV for detection (currently only the *drawn* frustum is limited)
- Facing-aware combat (flank / rear penalties)
- Turn and step tweening, weapon-in-hand overlay, damage vignette

### 2. Rendering (`src/core/Renderer.js`)
**Responsibility:** Canvas 2D drawing, tile rendering

**Key Methods:**
- `drawTile(x, y, glyph, fgColor, bgColor)` - Draws a single 32x32 tile
- `drawRect()` - Utility for backgrounds
- `drawBorder()` - Utility for highlights

**Current Visuals:** Colored ASCII glyphs with optional spritesheets. Walls use autotile bitmasks when sprites are enabled. Entity sprites must not be inferred from glyph alone because NPCs and the player can share glyphs.

**Expansion Points:**
- Add sprite atlas support (replace glyphs with images)
- Add particle effects (blood, sparks, smoke)
- Add lighting/shadow system
- Add screen shake for impacts

---

### 3. Input (`src/core/InputHandler.js`)
**Responsibility:** Keyboard input, action mapping

**Current Keybinds:**
- WASD/Arrows: Movement
- Space: Wait
- G: Pickup
- C: Character sheet
- I: Inventory
- V: Workshop (Craft/Disassemble)
- E: Interact with world object
- X: Inspect mode
- M: Cycle movement mode
- T: Cycle combat stance (talent-gated)
- B: Toggle combat overlay
- Q: Talent & Ability panel
- O: Auto-explore
- Tab: Travel screen (district routes)
- F8: Region tile map (debug)
- F: Toggle explore mode
- < / >: Use stairs/manholes
- Escape: Close all modals / Exit inspect mode
- ?: Help

**Expansion Points:**
- Add mouse support for targeting
- Add gamepad support
- Add rebindable keys
- Add action queuing

---

### 4. World System (`src/world/World.js` + `src/world/Chunk.js` + `src/world/gen/`)
**Responsibility:** Zone-mode maps, older chunk support, entity management, Z-level support

**Architecture:**
Current active path:
- `World.zoneMode = true` creates bounded zone maps.
- `ZoneGenerator.generate(world)` selects and builds zone layouts.
- `ZoneCanvas` provides drawing helpers, fragment placement, furniture, and NPC spawning (`addNpc` skips unknown catalog types).
- Street blocks and route slices are site profiles built by `InteriorGenerator` (`block` layout); `ZoneGenerator` itself only builds the hub, a few open-ground debug zones, and the fallback lot.

Legacy/underlying path:
- World divided into 128×128 tile chunks (increased from 32 in v39)
- Chunks generated procedurally on-demand
- Multi-level support (z=-1 sewers/basements, z=0 ground, z=1 second floors)
- Only active chunks (within radius) are simulated
- Entities and items tracked globally with Z-level awareness
- Each chunk stores its biome for UI queries via `World.getBiomeAt(x, y)`

**Biomes (zone-based, distance from origin):**
- Urban Core (distance 0-3) - Dense city center
- Suburbs (distance 3-6) - Residential areas, some industrial
- Mixed Zone (distance 6-10) - Industrial, ruins, rich neighborhoods
- Outer Zone (distance 10-15) - Rural, forest
- Far Edges (distance 15+) - Mostly forest

**World Features:**
- Road networks (biome-specific styling, district system with 15 district types)
- Prefab buildings (18 validated ASCII layouts) with room-type tagging
- Procedural rectangular buildings as fallback
- Overworld map (60×40 grid of zones, Tab to toggle)
- Interactive doors as WorldObjects (biome-based types, lock chance)
- Multi-floor buildings with staircases
- Sewer systems at z=-1 with manholes and ladders
- Building-aware item spawning via loot tables (16 room types)
- Obstacles and debris (placed after structures)

**Expansion Points:**
- Add chunk serialization (save/load distant chunks)
- Add natural features (trees, rocks, mountains)
- Interior-first generators (corridors, rooms, z-levels) for the crawler view
- Add more prefab layouts and building types
- Add weather/environmental effects per biome

---

### 5. Entity System (`src/entities/`)

#### Player (`Player.js`)
**Responsibility:** Player character, stats, inventory, equipment

**Key Properties:**
- `stats` - STR, AGI, END, INT, PER
- `anatomy` - Detailed body part tracking
- `inventory` - Array of items
- `equipment` - Slots: head, torso, legs, leftHand, rightHand
- `equipmentSystem` - Handles equip/unequip logic

**Expansion Points:**
- Add status effects (bleeding, poisoned, stunned)
- Add skills/experience system
- Add hunger/thirst/fatigue
- Add radiation/toxicity tracking

#### Anatomy (`Anatomy.js`)
**Responsibility:** Body part tracking, cybernetic slots, derived stats

**Tracked Parts:**
- Head: eyes (2), ears (2), brain, jaw
- Torso: heart, lungs (2), stomach, liver, kidneys (2)
- Arms: arm, hand, fingers (5 each)
- Legs: leg, foot (each)

**Derived Stats:**
- Vision range (from functional eyes)
- Hearing range (from functional ears)
- Movement penalty (from damaged legs)
- Hand usage (from functional hands)

**Expansion Points:**
- Add targeted damage system (hit specific parts)
- Add bleeding/infection per part
- Add prosthetic limbs (non-cyber replacements)
- Add mutations

#### NPC (`NPC.js`)
**Responsibility:** AI-driven entities

**Current AI Types (5 types):**
- Scavenger — wander, non-hostile, slow (speed 70)
- Raider — chase/attack (speed 85)
- Armed Raider — armed, brave, faster (speed 90)
- Brute — high STR, fearless, slow (speed 70)
- Stalker — fast, hit-and-run (speed 100)

**Detection State Machine:** UNAWARE → ALERT → SEARCHING → ENGAGED → FLEEING

**Expansion Points:**
- Add `flee` AI (run from player when low HP)
- Add `patrol` AI (follow waypoints)
- Add `guard` AI (protect area/entity)
- Add faction system (allies, enemies, neutral)
- Add dialogue system
- Add trading system
- Add NPC schedules (sleep, eat, work)

---

### 6. Equipment System (`src/systems/EquipmentSystem.js`)
**Responsibility:** Equip/unequip logic, stat calculations, dual-wielding

**Key Methods:**
- `equipItem(index, slot)` - Equips item from inventory to slot
- `unequipSlot(slot)` - Removes item from slot to inventory
- `getEquippedDamage()` - Calculates total weapon damage
- `getEquippedDefense()` - Calculates total armor defense
- `getValidSlotsForItem(item)` - Returns valid slots for item type

**Features:**
- Dual-wielding support (left/right hand selection)
- Automatic slot validation
- Damage dice rolling (e.g., "1d6", "2d4")
- Defense stacking from multiple armor pieces

**Expansion Points:**
- Add two-handed weapons (require both hands)
- Add weapon reach/range
- Add armor types (light/medium/heavy)
- Add equipment weight/encumbrance
- Add equipment degradation on use
- Add set bonuses
- Add stat requirements for equipment

---

### 7. Content System (`src/content/ContentManager.js`)
**Responsibility:** Data-driven content generation

**Content Types:**
- **Components** - Raw materials and crafting parts with properties (40+ types)
- **Materials** - Base properties (quality, durability, color, tags)
- **Item Families** - Base item templates (weapons, armor, consumables, intermediates)
- **Modifiers** - Adjectives that alter items (rusty, reinforced)
- **Cybernetics** - Implants with bonuses/drawbacks/risks
- **Traits** - Character creation perks

**Item Generation:**
```javascript
content.createItem(familyId, materialId, modifierId)
content.createComponent(componentId)  // Raw material spawning
```

**Expansion Points:**
- Add item quality tiers (poor, standard, fine, masterwork)
- Add unique/legendary items
- Add consumable effects (healing, buffs, debuffs)
- Add ammunition system
- Add tool durability and repair

---

### 8. UI System (`src/ui/UIManager.js`)
**Responsibility:** All UI rendering and interaction

**Panels:**
- **Log Panel** - Turn-by-turn message feed
- **Character Panel** - Quick stats (HP, stats, vision/hearing)
- **Inventory Panel** - Item list
- **Context Panel** - Current tile info, items at feet
- **Location Panel** - Biome, floor level, room/area type

**Modal Screens:**
- **Character Creation** - Stat allocation
- **Detailed Character** - Full anatomy breakdown
- **Detailed Inventory** - Equipment management with buttons
- **Help Screen** - Controls, gameplay guide, crafting/combat overview
- **Workshop** - Crafting and disassembly with sub-recipe drill-down
- **Combat Overlay** - Real-time combat detail (B key toggle)

**Expansion Points:**
- Add targeting cursor for ranged attacks
- Add minimap
- Add quest/objective tracker
- Add trading UI
- Add dialogue UI

---

## Additional Systems

### 9. Field of View System (`src/systems/FoVSystem.js`)
**Responsibility:** Line-of-sight calculations, visible/explored tile tracking

**Status:** ✅ Implemented

**Features:**
- Raycasting algorithm for line-of-sight
- Z-level aware visibility
- Explored tiles persist across turns
- Vision blocking based on tile properties

**Key Methods:**
- `calculate(x, y, radius, z)` - Calculates visible tiles
- `isVisible(x, y, z)` - Checks if tile is currently visible
- `isExplored(x, y, z)` - Checks if tile has been seen before
- `hasLineOfSight(x0, y0, x1, y1)` - Raycasting between points

---

### 10. Sound System (`src/systems/SoundSystem.js`)
**Responsibility:** Sound propagation, NPC detection

**Status:** ✅ Implemented

**Features:**
- Movement modes (Walk, Run, Crouch, Prone)
- Sound volume based on movement mode
- NPCs detect and investigate sounds
- Sound events tracked per turn

**Movement Modes:**
- **Walk** - Normal speed (100 action cost), low sound (3 volume)
- **Run** - Fast (75 action cost), high sound (8 volume)
- **Crouch** - Slow (125 action cost), very low sound (1 volume)
- **Prone** - Very slow (150 action cost), silent (0 volume)

**Key Methods:**
- `makeSound(x, y, volume, type, source)` - Creates sound event
- `processTurn()` - Processes and clears sounds
- NPCs with raider AI investigate sounds

---

### Cybernetics Installation
**Purpose:** Brutal, risky body modification system

**Requirements:**
- Tools (surgical kit, welding torch)
- Meds (anesthetic, antibiotics)
- Skill check (INT + trait bonuses)
- Ripper doc station (optional, reduces risks)

**Risks:**
- Infection (ongoing HP drain)
- Shock (temporary stat penalties)
- Failure (lose implant, damage body part)
- Rejection (permanent debuff)

**Integration Points:**
- `Anatomy.installCybernetic()` - Replace body part
- `UIManager` - Add installation UI with risk display
- `Player.cybernetics[]` - Track installed implants

---

### 11. Item System (`src/systems/ItemSystem.js`)
**Responsibility:** Item interactions, consumption, container operations

**Status:** ✅ Implemented

**Features:**
- Opening containers with tool requirements
- Food/drink consumption with nutrition tracking
- Item splitting and stacking
- Tool durability damage
- Yield and spillage mechanics

**Key Methods:**
- `openContainer(player, container)` - Opens sealed containers
- `consumeFood(player, item, amount)` - Handles eating/drinking
- `splitItem(item, amount)` - Splits stackable items
- `findToolInInventory(player, tags)` - Locates required tools

### 12. Container System (`src/systems/ContainerSystem.js`)
**Responsibility:** Weight/volume calculations, storage management

**Status:** ✅ Implemented

**Features:**
- Weight and volume tracking (grams, cm³)
- Nested container support (unlimited depth)
- Pocket system for clothing
- Encumbrance levels (light/medium/heavy/overencumbered)
- Auto-storage with priority rules

**Key Methods:**
- `getTotalWeight(container)` - Recursive weight calculation
- `findAvailableStorage(player, item)` - Finds valid storage locations
- `autoStoreItem(player, item)` - Automatically stores items
- `canFitInPocket(pocket, item)` - Validates pocket capacity

### 13. Character Creation System (`src/systems/CharacterCreationSystem.js`)
**Responsibility:** Character backgrounds, traits, stat allocation

**Status:** ✅ Implemented (v52 CoQ-style overhaul)

**Features:**
- 6 backgrounds with stat mods, gear labels, and free starting talents
- Talent browser: 3-column layout (identity/background, talent selector, summary)
- 6pt talent budget at chargen; drawbacks refund points
- Stat allocation: 50pt budget, 5 stats, +/− buttons
- `applyBackgroundToCharacter(player, bgId, skipTalents=false)` — no double-grant

### 13b. Talent System (`src/content/TalentCatalog.js`)
**Responsibility:** Talent trees, talent effects, unlock gating

**Status:** ✅ Implemented (v51)

**Features:**
- 5 talent trees: combat_tactics, small_blades, blunt_weapons, unarmed, survival
- 35+ talent nodes with tier/prereq gating
- `TalentEffects.applyImmediateEffect()` — modifies player stats on grant
- All combat stances and abilities gated behind talents (no defaults)

### 14. Crafting System (`src/systems/CraftingSystem.js`)
**Responsibility:** Tiered component-based crafting and disassembly with quality mechanics

**Status:** ✅ Implemented (v19 overhaul)

**Features:**
- Disassemble any item into components with quality loss
- Component property system (16 properties: cutting, grip, fastening, etc.)
- Recipe system with property-based and specific component requirements
- **Tier gating via maxValue** — prevents high-tier components in low-tier recipes
- **Craftable intermediates** — Crude Blade, Sharpened Stick, Wrapped Handle, Strap
- **craftedProperties** — crafted intermediates carry properties for use in higher-tier recipes
- **Raw materials** — stone, wood, glass, metal spawn in world via loot tables
- Tool-based quality modifiers (hand vs knife vs proper tool)
- `canPlayerDisassemble()` free-hand validation
- Quality degradation loop prevents infinite recycling
- Sub-recipe drill-down UI with back navigation

### 15. Time System (`src/systems/TimeSystem.js`)
**Responsibility:** Day/night cycle, time-of-day tracking

**Status:** ✅ Implemented

**Features:**
- 24-hour clock (1 turn ≈ 2 minutes game time)
- Ambient light levels based on time of day
- Sunrise/sunset transitions
- Time display in UI

### 16. Lighting System (`src/systems/LightingSystem.js`)
**Responsibility:** Light level calculations, point light sources, fuel consumption

**Status:** ✅ Implemented

**Features:**
- Ambient light from time of day
- Point light sources (player-held flashlight, lantern)
- Cone-shaped light (flashlight, based on player facing direction)
- Radial light (lantern)
- Fuel/battery consumption per turn
- Light affects effective vision radius
- Yellow warm tint on light rendering

---

### 17. Interior Sites (`src/world/gen/InteriorGenerator.js`, `src/content/SiteCatalog.js`)
**Responsibility:** Multi-floor building interiors for the first-person view.

**Flow:** `ZoneGenerator.generate()` calls `getSiteProfile(zoneId)`. When a profile
exists the zone becomes an interior: the world's footprint is resized to the
profile, `generateSite()` builds every floor, and the street generators are skipped.

**How a site is built:**
- Geometry is assembled on a working grid of cell kinds (SOLID / ROOM / CORRIDOR /
  DOOR / STAIRS / EXIT) and only painted onto tiles at the end. Connectivity and
  door placement are decided on the grid, where they are cheap to reason about.
- A **stair core** occupies the same x/y on every floor, so floors always connect.
  `ensureConnected()` floods from it and carves to anything stranded, so a site
  can never generate an unreachable room.
- The ground floor gets one **entrance**; layouts hand back perimeter spots that
  already back onto a corridor so you arrive in a hall rather than inside a shop.
- Layouts: `spine` (parallel corridors with room strips both sides, cross-linked
  into a loop), `bsp` (recursive subdivision, L-corridors), `ring` (corridor loop,
  shop band outside, corridor-grid core).
- Rooms are capped at `MAX_ROOM_SPAN` (8). This is a readability constraint, not a
  performance one: larger rooms stop reading as rooms in first person.
- **Wall invariant.** Every room keeps a one-cell wall on all sides except its
  doorway. Room strips check their rect plus a one-cell ring; BSP leaves carry two
  cells of padding (a wall-hall-wall corridor needs three); halls are routed with
  `bfsCorridor`, which refuses any cell beside a room; `ensureHallsConnected`
  joins hall pockets without crossing rooms; `sealRoomEdges` walls off anything a
  blunt fallback still grazed; furniture is only placed if the room's free cells
  stay one connected region. `countRoomLeaks` audits the result and the count is
  exposed on `world.siteAudit` (must be zero). `world.siteDebugGrids` carries the
  raw cell kinds per level for tests.
- Doors become real `WorldObject`s, so they open, lock, and smash. Locks are
  smash-only until a key system exists.
- Furniture is placed along walls from `ROOM_FURNITURE`, never on a cell beside a
  doorway, budgeted by room area so a room can never be sealed by its own contents.
- Emergency lights are baked into `world.staticLights` at generation time and read
  by the `LightingSystem` constructor, because generation runs before that system
  exists.

**World flags set:** `isInterior`, `siteName`, `siteExit`, `spawnPoint`, `spawnFacing`.

**Game integration:** interiors are sealed (no zone-edge transition), `<` on a
`isSiteExit` tile returns to the overworld, and drop-in always lands at the
entrance regardless of travel direction.

**Blocks (Phase 2).** `layoutBlock` carves a street band `streetWidth` wide
wall to wall, an optional cross street, `alleys` one-wide dead ends, then
`carveRoomStrip` along every hall for storefronts and back rooms. Exits are
returned for every street end and, with `level.exits === 'all'`, all become
`EXIT` cells; `world.siteExits` lists them with a `side`. A `sky` level paints
halls with exterior tiles (`street`, `alleyFloor`, ...) and rooms with
interior ones, so the renderer draws sky over the street and ceilings in the
shops. Single-level profiles have no stair core; the connectivity origin is
the first hall cell. Room presets from `StorefrontCatalog` override floor,
furniture, door type, and light per room. Doors facing a hall on a sky level
get a `daylight` static light; `floorLootChance` drops items on room floors.

**Slices.** `SLICE_PROFILES` are 30x14 to 32x18 single-level blocks with a
west and an east exit. `Game._enterSlice` caches them by route and writes
`world.exitTargets` so each end leads to a route endpoint.

**Expansion Points:**
- More layouts (radial, warehouse aisles, flooded sublevel)
- Set pieces per site; keyed doors; encounter and loot budgets per level
- Multiple entrances per site tied to routes
- Signs and awnings as street props outside storefronts

---

### 17b. Zone Persistence and the Hub (`src/core/Game.js`, `src/world/OverworldMap.js`)
**Responsibility:** Every visited zone keeps its state for the run; the hub is
a node you can always return to.

**Zone cache.** `Game.zoneCache` is a `Map` from `Game.zoneKey(col, row)` to
`{ world, fov, col, row }`. `dropIntoZone` removes the player from the current
`World`, then either reuses the cached `World` and `FoVSystem` (explored tiles)
or builds a new pair and stores it. Per-zone systems that hold no persistent
state (sound, lighting, items, crafting, combat, effects, abilities, world
objects) are rebuilt on every entry by `_initZoneSystems(fov)`. Persistent
state therefore lives only on the `World` and what it owns: tiles, world
objects (door state, furniture contents), items on the ground, NPCs. NPCs in a
parked zone do not act.

**Hub node.** `OverworldMap._placeHub` pins `HUB_ZONE` (`safe_hub`,
"Downstairs") to the centre tile (`hubCol`, `hubRow`) after generation.
`ZoneGenerator` always builds `generateSafeHub` for that id. `Game.startGame`
drops into that tile, so the hub is an ordinary cached zone from turn one.
`generateSafeHub` sets `spawnPoint` at the South Gate with `spawnFacing`
north, bakes `staticLights` for the shacks and walks, and places a `stash`.

**Arrival facing.** Edge transitions face the player in the direction of
travel; arrivals at an entrance use the world's `spawnFacing`.

**Passing time.** `Game.passTime(turns, { sleeping })` ticks time, fuel,
status effects, the world, sound, and abilities without redrawing until the
end. With `sleeping`, hunger and thirst rates are halved and a living hostile
within `wakeRadius` (default 10) interrupts. `WorldObjectSystem.restAt` uses
it for the bed actions `rest` (60 turns) and `sleep`
(`getSleepPlan()`: until 06:00 or 18:00, whichever is next, minimum an hour).

**Expansion Points:**
- Catch-up simulation for parked zones
- Serialisation of the cache (Phase 4)

---

### 17c. District Travel (`src/content/DistrictCatalog.js`, `src/core/Game.js`)
**Responsibility:** The travel surface. Places are graph nodes; moving between
them costs time and risk.

**Catalog.** `DISTRICT.nodes` (id, name, `zone` template id, `kind`, `threat`,
`pos`, `blurb`) and `DISTRICT.routes` (`a`, `b`, `name`, `turns`, `danger`,
`desc`, optional `lock: { flag, reason }`). Helpers: `getNode`, `routesFrom`,
`dangerLabel`, `dangerMultiplier`.

**Entry.** `Game._describeNode(id)` resolves the node's zone template through
`findZoneTemplate` (all `ZONE_POOLS` plus `HUB_ZONE`), applies the site
profile footprint when the template is a site, and derives a stable seed with
`hashString(nodeId, runSeed)`. `_enterZone(desc)` is shared with the debug
`dropIntoZone`, which builds a descriptor from a tile instead.

**Travel screen.** `gameState 'travel'`; `Game.travel = { from, options,
index }` where options are `routesFrom(current)` with `locked` resolved
against `game.flags`. `renderTravel` draws the graph on the canvas; the UI's
`updateTravelPanel` shows the selected route's time, arrival clock, danger,
drain, and lock reason. Keyboard: A/D or arrows cycle, Enter or Space go,
Tab or Esc close. Mobile: d-pad cycles, ACT or centre goes, MAP toggles.

**Resolution.** `travelRoute(route, dest)`: refuse locked; remove the player
from the current world; `passTime(turns, { detached: true })` so the clock,
fuel, hunger, thirst, and wounds run without any zone ticking; `enterNode`;
roll `Math.random() < routeEstimate(route).danger`. Loud: log and
`_spawnArrivalTrouble()` (one hostile in line of sight, 3 to 6 cells off),
never at the hub. Quiet: log.

**Expansion Points:**
- Route slices for loud rolls (Phase 2)
- Walkable routes: a block with two exits (Phase 2)
- Per-entrance routes; faction-modified danger and locks (Phase 3)
- Projects setting lock flags (Phase 4)

---

### 18. Auto-Explore
**Files:** `World.js`, `Game.js`, `UIManager.js`, `InputHandler.js`

**Status:** Implemented as a current milestone slice.

**Features:**
- `O` auto-explores toward reachable unexplored edges (BFS over explored walkable tiles).
- Auto-explore stops for visible danger, blocked paths, zone changes, overworld entry, or `Esc`.
- In first person each step sets facing, so the view turns as it walks.

---

## Data Flow

```
User Input
    ↓
InputHandler → Game.processTurn(action)
    ↓
Player.tryMove() / Player.attack() / etc.
    ↓
World.processTurn() (NPCs take turns)
    ↓
Game.render()
    ↓
Renderer.drawTile() × N
    ↓
UIManager.updatePanels()
```

---

## File Structure

```
Fractured-City-Night-Run/
├── index.html              # Entry point
├── styles.css              # UI styling
├── sw.js                   # PWA service worker (bump CACHE_NAME on release)
├── vercel.json             # Deployment config
├── README.md
├── CLAUDE.md               # Working rules for Claude Code sessions
├── REDESIGN_BRIEF.md       # Design record and roadmap (hub and run)
├── ARCHITECTURE.md         # This file
├── DEVLOG.md               # Development progress
├── GAME_DESIGN.md          # Design principles
├── DESIGN_BRAINSTORM.md    # Occupation / faction / zone-tag ideas
├── SPEED_SYSTEM.md         # Movement mechanics
├── SYSTEMS_REFERENCE.md    # System documentation
├── LORE.md                 # World lore and narrative
├── CRAFTING_DATABASE.md    # Crafting recipes reference
├── ADDING_ITEMS.md         # Item addition checklist
├── src/
│   ├── main.js            # Bootstrap
│   ├── core/
│   │   ├── Game.js        # Main loop, zone cache, hub entry, passTime
│   │   ├── FirstPersonRenderer.js # Grid-crawler view
│   │   ├── Renderer.js    # Canvas drawing (top-down)
│   │   ├── SpriteManager.js # Optional spritesheets
│   │   └── InputHandler.js # Keyboard
│   ├── world/
│   │   ├── World.js       # Zone-mode world, entities/items/objects, Z-levels
│   │   ├── Chunk.js       # Legacy chunk generation (not the active path)
│   │   ├── WorldObject.js # Base class for interactive objects
│   │   ├── OverworldMap.js # 160×100 region grid (debug map), hub tile, zone pools, findZoneTemplate
│   │   ├── gen/
│   │   │   ├── ZoneGenerator.js   # Zone entrypoint, hub layout, debug open-ground zones
│   │   │   ├── InteriorGenerator.js # Sites, street blocks, route slices
│   │   │   ├── ZoneCanvas.js      # Tile/door/furniture drawing helpers
│   │   │   └── ZoneTiles.js       # Tile palette (incl. facades and street floors)
│   │   └── objects/
│   │       ├── Door.js    # Interactive door WorldObject
│   │       └── Furniture.js # Furniture types (incl. stash, bed), room loot tables
│   ├── entities/
│   │   ├── Entity.js      # Base class
│   │   ├── Player.js      # Player character
│   │   ├── NPC.js         # AI shell
│   │   └── Anatomy.js     # Body part system
│   ├── systems/
│   │   ├── EquipmentSystem.js # Equip/unequip logic
│   │   ├── FoVSystem.js   # Field of view (cached per zone)
│   │   ├── SoundSystem.js # Sound propagation
│   │   ├── ItemSystem.js  # Item interactions
│   │   ├── ContainerSystem.js # Weight/volume
│   │   ├── CraftingSystem.js  # Crafting and disassembly
│   │   ├── WorldObjectSystem.js # WorldObject actions (incl. rest/sleep)
│   │   ├── CharacterCreationSystem.js # Character gen
│   │   ├── AbilitySystem.js   # Combat abilities, talent-gated
│   │   ├── CombatSystem.js    # Anatomy combat
│   │   ├── CombatEffects.js   # Shake, floating text
│   │   ├── TimeSystem.js  # Day/night cycle, 24-hour clock
│   │   └── LightingSystem.js # Ambient + point light, fuel consumption
│   ├── content/
│   │   ├── ContentManager.js    # Data-driven items, components, materials
│   │   ├── NpcCatalog.js        # NPC templates (placeholders)
│   │   ├── SiteCatalog.js       # Site, block, and slice profiles
│   │   ├── DistrictCatalog.js   # Travel graph: nodes, routes, locks, slices
│   │   ├── StorefrontCatalog.js # Storefront room presets
│   │   └── TalentCatalog.js     # Talent trees, nodes, effects
│   ├── utils/
│   │   └── noise.js
│   └── ui/
│       ├── UIManager.js         # Panels, modals, chargen, help
│       ├── CraftingUI.js        # Workshop
│       ├── DisassembleModal.js  # Disassembly interface
│       ├── WorldObjectModal.js  # Door/furniture actions, furniture contents
│       └── MobileControls.js   # Touch controls
```

---

## Anti-Spaghetti Rules

1. **One Responsibility Per File**
   - `Renderer.js` only draws, never modifies game state
   - `InputHandler.js` only translates keys to actions
   - `Game.js` orchestrates, never implements details

2. **Data-Driven Content**
   - Never hardcode item names in logic
   - Use tags and roles: `if (item.hasTag('sharp'))` not `if (item.name === 'Knife')`

3. **Expansion Points Documented**
   - Every system has a comment block listing future features
   - New features extend, never rewrite

4. **No Global State**
   - All state lives in `Game` or entity instances
   - Pass references explicitly, never use globals

5. **Modular Systems**
   - `EquipmentSystem` is a separate class, not methods on `Player`
   - Easy to test, easy to replace, easy to extend

---

## Testing Checklist

- [ ] Player can move in all directions
- [ ] Player can pick up items
- [ ] Player can equip items in left/right hand
- [ ] Player can dual-wield weapons
- [ ] Player can equip armor
- [ ] Combat uses equipped weapon damage
- [ ] Combat uses equipped armor defense
- [ ] NPCs wander and chase correctly
- [ ] World generates multiple biomes
- [ ] Items spawn in chunks
- [ ] Character sheet shows full anatomy
- [ ] Inventory shows equipment slots
- [ ] All keybinds work (WASD, G, C, I, ?)
