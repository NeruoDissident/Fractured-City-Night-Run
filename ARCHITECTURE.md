# Fractured City Roguelike - Architecture Documentation

## Current Architecture Note

The project has shifted from primarily infinite chunk generation toward **bounded zone generation connected by an overworld**. Old `Chunk.js` generation still exists and some sections below describe it historically, but the active design path is:

`OverworldMap` chooses a zone tile -> `Game.dropIntoZone()` creates a zone-mode `World` -> `ZoneGenerator` and `ZoneCanvas` build a detailed map from templates/fragments -> the player explores it in first person.

The quest chain, goal board, delivery errands, POIs/Known Places, and the old NPC roster were removed during the first-person pivot. See `CLAUDE.md` for what is kept, what is placeholder, and what comes next.

Current priority systems:
- `src/world/gen/ZoneGenerator.js` and `src/world/gen/UrbanFragments.js`: current map design focus.
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
- `startGame(characterData)` - Begins a new run
- `processTurn(action)` - Advances world by one tick
- `render()` - Triggers rendering pipeline

**Expansion Points:**
- Add game modes (tutorial, challenge runs)
- Add save/load system
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
- J: Journal/current entries
- O: Auto-explore
- Tab: Toggle Overworld map
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
- `UrbanFragments` contains reusable urban pieces such as corner stores, gas stations, laundries, pawn shops, alleys, bodegas, and clinics.

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

**Expansion Points:**
- More layouts (radial, warehouse aisles, flooded sublevel)
- Set pieces per site; keyed doors; encounter and loot budgets per level
- Sites reached through a street zone's door rather than replacing the zone

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
├── vercel.json             # Deployment config
├── README.md
├── ARCHITECTURE.md         # This file
├── DEVLOG.md              # Development progress
├── GAME_DESIGN.md         # Design principles
├── SPEED_SYSTEM.md        # Movement mechanics
├── SYSTEMS_REFERENCE.md   # System documentation
├── LORE.md                # World lore and narrative
├── CRAFTING_DATABASE.md   # Crafting recipes reference
├── src/
│   ├── main.js            # Bootstrap
│   ├── core/
│   │   ├── Game.js        # Main loop
│   │   ├── Renderer.js    # Canvas drawing
│   │   └── InputHandler.js # Keyboard
│   ├── world/
│   │   ├── World.js       # Chunk manager, Z-level support, zone mode
│   │   ├── Chunk.js       # Terrain gen, district system, prefab placement, seeded RNG
│   │   ├── WorldObject.js # Base class for interactive objects
│   │   ├── ExtractionPoint.js # Win condition
│   │   ├── OverworldMap.js # 60×40 zone grid, threat levels, Tab toggle
│   │   └── objects/
│   │       ├── Door.js    # Interactive door WorldObject
│   │       └── Furniture.js # 16 furniture types, storage, loot population
│   ├── entities/
│   │   ├── Entity.js      # Base class
│   │   ├── Player.js      # Player character
│   │   ├── NPC.js         # AI entities
│   │   └── Anatomy.js     # Body part system
│   ├── systems/
│   │   ├── EquipmentSystem.js # Equip/unequip logic
│   │   ├── FoVSystem.js   # Field of view
│   │   ├── SoundSystem.js # Sound propagation
│   │   ├── ItemSystem.js  # Item interactions
│   │   ├── ContainerSystem.js # Weight/volume
│   │   ├── CraftingSystem.js  # Crafting and disassembly
│   │   ├── WorldObjectSystem.js # WorldObject interactions
│   │   ├── CharacterCreationSystem.js # Character gen (CoQ-style, v52)
│   │   ├── AbilitySystem.js   # Combat abilities, talent-gated
│   │   ├── CombatEffects.js   # Shake, floating text, visual feedback
│   │   ├── TimeSystem.js  # Day/night cycle, 24-hour clock
│   │   └── LightingSystem.js # Ambient + point light, fuel consumption
│   ├── content/
│   │   ├── ContentManager.js    # Data-driven content
│   │   ├── BuildingPrefabs.js   # 18 ASCII prefab layouts + biome door types
│   │   ├── LootTables.js        # 16 room-type loot pools + outdoor loot
│   │   └── TalentCatalog.js     # TALENT_TREES, TALENT_NODES, TalentEffects
│   └── ui/
│       ├── UIManager.js         # Panels, modals, location display
│       ├── CraftingUI.js        # Crafting workshop UI with sub-recipe drill-down
│       ├── DisassembleModal.js  # Disassembly interface
│       ├── WorldObjectModal.js  # Door/object interaction modal
│       └── MobileControls.js   # Touch controls for mobile
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
