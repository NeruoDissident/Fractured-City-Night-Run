# Fractured City - Development Log

**Project:** Fractured City - Browser-based Cyberpunk Roguelike  
**Engine:** Vanilla JavaScript + HTML5 Canvas 2D  
**Status:** Active Development  
**Last Updated:** May 2026

## First-Person Pivot (September 2026)

The game is being reworked into a **first-person, grid-based, turn-based cyberpunk crawler**. Phase 1 is in:

- New `src/core/FirstPersonRenderer.js` draws the zone from the player's cell along `player.facing` (classic panel projection, painter's order, billboards for objects/items/NPCs, time-of-day sky outdoors, ceilings indoors, depth fog at vision range).
- Relative movement: `W` forward, `S` backpedal, `A`/`D` turn (free action), `Shift+A/D` strafe. Backpedal/strafe keep facing and never swing at creatures you are not facing.
- Interact and inspect now work relative to facing; the view outlines candidate cells and labels them with their key.
- Automap shows a facing arrow and view cone; the location panel shows facing.
- Mobile d-pad is relative (up forward, down back, left/right turn) with strafe and VIEW buttons in the more row.
- Backtick toggles back to the top-down map at any time for debugging and map tuning.

**Removal pass (same month):** QuestSystem, GoalSystem, the Street Kid intro chain, delivery errands, POIs / Known Places / auto-travel-to-POI, and the hardcoded NPC roster are gone. `src/content/NpcCatalog.js` holds two placeholder templates and `F9` / `Shift+F9` (`game.debugSpawn()`) drops one in front of the player so combat and detection stay testable. NPC.js keeps the AI shell. Zone generators no longer spawn NPCs or register POIs; `ZoneCanvas.addNpc` fails soft on unknown types. `CLAUDE.md` documents the current state and conventions.

**Interior sites (phase 2):** `src/world/gen/InteriorGenerator.js` and
`src/content/SiteCatalog.js` add multi-floor building interiors. An overworld zone
with a site profile stops being a street map and becomes a building you drop into:
a stack of floors sharing a stair core, one entrance out, corridors and rooms
carved on a working grid before anything touches a tile. Three layouts (spine, bsp,
ring), rooms capped at 8x8 for first-person readability, real door objects,
wall-hugging furniture keyed to the existing room-aware loot tables, and emergency
lighting baked into `world.staticLights` so corridors are navigable while rooms
stay dark. Connectivity is guaranteed by flooding from the stair core and carving
to anything stranded; verified over 36 generated sites with furniture treated as
blocking.

**Wall invariant (follow-up):** the first version left rooms flush against
cross-corridors and each other, which reads in first person as "all open rooms".
Fixed structurally: rooms keep a one-cell wall on every side except the door,
halls are BFS-routed and never graze a room, the hall network is connected on its
own so a chair in a room can never cut a floor in half, and furniture cannot split
a room. `world.siteAudit` counts leaks per level; 150 generator runs and 36
in-game sites audit at zero with no unreachable rooms. Six profiles ship: Kiroshi Data Hub, Aurora Clinic, Old Town Hall, Dead
Mall, Henderson Plant, Marrow Row, plus five aliases.

**Redesign brief and Phase 0 (same month):** a full review of the repo after
the pivot found two blockers under the "sloppy overworld" feeling: nothing
outside the player persisted between visits (every drop-in rebuilt the zone
from its seed), and the starting hub was unreachable once you left it (its tile
regenerated as whatever the pool rolled). The review and the direction that
came out of it are in `REDESIGN_BRIEF.md`: a hub-and-run structure, streets
rebuilt as corridors with enterable storefronts, routes that are mixed but lean
abstract, and hub needs and projects as the colony layer.

Phase 0 shipped:
- `Game.zoneCache` keeps every visited zone's `World` and `FoVSystem` alive for
  the run; `dropIntoZone` is get-or-create and the player entity moves between
  worlds. Looted cabinets stay looted, doors stay open, dropped items stay put,
  explored tiles are remembered. NPCs in a parked zone do not act.
- Downstairs is pinned to the overworld centre tile as `safe_hub` (`HUB_ZONE`
  in `OverworldMap.js`), so leaving and returning finds the same yard. You
  arrive at the South Gate facing north; edge transitions keep the edge and
  your direction of travel.
- Hub buildings and walks have baked lights so the yard reads in first person
  at any hour (it was pitch black indoors at 08:00 before).
- Crew Stash: a `stash` furniture type with no loot table, in the Commons.
- Bunks offer Rest (60 turns) and Sleep (until the next dawn or dusk) through
  `WorldObjectSystem.restAt` and `Game.passTime`. Metabolism is halved while
  sleeping, hostiles within 12 cells refuse it and one closing to 10 wakes you,
  and the modal shows the hunger and thirst cost before you commit.
- Docs brought in line: the Street Kid / journal / POI milestone that
  `GAME_DESIGN.md`, `DESIGN_BRAINSTORM.md`, and `SYSTEMS_REFERENCE.md` still
  locked is retired in favour of the brief's roadmap.

Verified headless: hub tile is `safe_hub`, stash keeps an item and the Commons
door stays open across an east-and-back edge transition, a Kiroshi Data Hub
door stays open across exit and re-entry, sleep from 08:02 to 18:00 runs in one
step (598 turns, hunger 100 to 70, thirst 100 to 40), zero page errors.

Tuning note: thirst drains 0.2 per turn, so a full day awake costs about 290
thirst and a ten-hour sleep at half rate costs 60. That is the existing rate,
not a Phase 0 change, but it will need a look when routes start charging time.

## Current Pivot

The project has shifted toward an occupation-driven survival roguelike with dense traversable zones.

Current design commitments:
- The setting is roughly 40 years after collapse, but society is still running on fumes.
- Backgrounds are becoming occupations with starting motives, social hooks, talents, loadouts, and objective chains.
- Street Kid is the first/tutorial-like occupation template.
- The old endless procedural map feel is being replaced by detailed zone slices connected by the overworld.
- Zones are not mandatory stages. Travel remains free; objectives can cross zones; some zones may be empty, dangerous, or loot-focused.
- ASCII-first development is preferred until zone readability is solid. Sprites remain optional and must have ASCII fallbacks.

---

## 🎯 Project Vision

A turn-based survival roguelike set in a cyberpunk dystopia that is still barely functioning. Features permadeath, detailed character/occupation starts, dense zone exploration, deep simulation, robust crafting, and tactical combat. Runs entirely in the browser with no dependencies.

### Core Pillars
- **Turn-Based Gameplay:** One action = one world tick
- **Permadeath:** Death ends the run
- **Procedural Content:** overworld-connected zones, randomized details, dynamic encounters
- **Deep Simulation:** Anatomy tracking, item interactions, crafting/disassembly
- **Tactical Depth:** Stealth, sound propagation, equipment choices matter

---

## ✅ Completed Features

### Phase 0: Foundation (Complete)
- [x] **Core Game Loop** - Turn-based system, game state management
- [x] **Canvas Renderer** - 32x32 tile grid, colored ASCII glyphs
- [x] **Input Handler** - Keyboard controls, action mapping
- [x] **World System** - Chunked world foundation; current direction uses bounded zone-mode maps
- [x] **Biome Generation** - Ruins, Industrial, Wasteland with unique tiles
- [x] **Entity System** - Base entity class, player, NPCs
- [x] **Detailed Anatomy** - Organs, limbs, eyes, ears with health tracking
- [x] **Basic Equipment** - Equip/unequip, left/right hand slots
- [x] **Dual-Wielding** - Two weapons simultaneously
- [x] **Two-Handed Grip** - Weapons can be held with both hands for damage bonus
- [x] **Content Manager** - Data-driven items, materials, modifiers
- [x] **Item Spawning** - Procedural items spawn in world
- [x] **NPC AI** - Scavengers (wander), Raiders (chase/attack)
- [x] **Combat System** - Attack, damage calculation, death
- [x] **UI Panels** - Log, character stats, inventory, context info
- [x] **Deep Character Creation** - Backgrounds, traits (positive/negative), gender, stat allocation with validation
- [x] **Detailed UI Screens** - Character sheet, inventory modal, help screen
- [x] **Field of View (FoV)** - Raycasting vision with explored/visible tiles
- [x] **Inspect Mode** - Examine tiles, entities, items within FoV
- [x] **Extraction Objective** - Access card requirement, win/loss screens, run completion
- [x] **Movement Modes & Sound System** - Walk/Run/Crouch/Prone with sound generation, NPC sound detection
- [x] **Robust Inventory Management** - Container system, weight/volume tracking, encumbrance, nested containers, pockets
- [x] **Item Interaction System** - Opening containers, tool selection, yield mechanics, durability damage
- [x] **Food & Consumables** - Hunger/thirst mechanics, smart consumption, nutrition system
- [x] **Food Spoilage System** - Progressive contamination in opened containers, spoilage rates by food type
- [x] **Liquid Spillage System** - Drinks leak from unsealed containers, resealing mechanics
- [x] **Status Effects System** - Food poisoning, heal-over-time, duration-based effects
- [x] **Z-Level System** - Multi-floor buildings, basements, staircases, vertical movement
- [x] **Robust World Builder** - Road networks, building generation, sewer systems, structured world generation
- [x] **Prefab Building System** - 9 ASCII layout prefabs with interactive doors, room tagging, biome-aware door types
- [x] **Loot Table System** - 16 room-type weighted loot pools, building-aware item spawning, outdoor loot
- [x] **Location UI** - Sidebar panel showing biome, floor level, and room/area type

### Phase 1: Light & Dark (Complete)
- [x] **Day/Night Cycle** - TimeSystem with 24-hour clock, ambient light levels, time-of-day display
- [x] **Lighting System** - LightingSystem with ambient + point light sources, light level per tile
- [x] **FoV Integration** - Effective vision radius modulated by ambient light and player light sources
- [x] **Flashlight & Lantern** - Flashlight (cone, radius 12) and Lantern (radial, radius 7) as equippable items
- [x] **Fuel/Battery System** - Batteries drain durability, lantern fuel drains quantity per turn
- [x] **Player Facing Direction** - Tracked in Player.js for cone-shaped flashlight light
- [x] **Starting Loadout** - Clothes, backpack, lantern w/ fuel, flashlight w/ batteries
- [x] **Light Toggle** - On/off toggle in equipment panel and actions modal
- [x] **Yellow Light Tint** - Light radius rendered with warm yellow tint in World.applyLight()

### Item System Audit & Fixes (Complete)
- [x] **Full Item System Health Check** - Comprehensive audit of all item, container, pocket, and UI systems
- [x] **Pocket Container Lookup Fix** - Replaced 8 broken ternary chains with `findContainerById()` helper across UIManager.js
- [x] **DisassembleModal Fix** - Updated to use `findContainerById()` for correct container resolution
- [x] **Container Disassembly Safety** - Disassembling containers now spills contents (batteries, fuel) to inventory or ground
- [x] **Equip+Carry Conflict Fix** - Prevented equipping and carrying items in the same hand simultaneously
- [x] **Move Modal Drop Fix** - Added missing `item.z` when dropping items
- [x] **Can Opener Item** - New `can_opener` item family with components and disassembly
- [x] **Loot Table Expansion** - Added flashlight, lantern, lantern_fuel, can_opener to 9 loot tables
- [x] **Disassembly Hand Check** - `canPlayerDisassemble()` validates free hands before allowing disassembly
- [x] **Battery Charge Display** - Batteries show "Charge" instead of "Durability" across all 5 UI locations
- [x] **Disassembly Warning UI** - Visible red warning panel when disassembly blocked by full hands
- [x] **Dynamic WorldObject Text** - Replaced hardcoded "door" strings with `worldObject.name` in all modals/systems

### QoL Improvements (Complete)
- [x] **Auto-Complete Smash** - Smashing world objects loops until destroyed or weapon breaks, reports summary
- [x] **Escape Key Closes Modals** - Escape key closes all open windows before exiting inspect mode
- [x] **Modal Scroll Fix** - Fixed CSS overflow for PWA modal scrolling (touch-action, overflow-y, overscroll-behavior)

### Current Build Stats
- **Files:** 35+ modular ES6 modules
- **Systems:** 22 core systems (+ AbilitySystem, CombatEffects, CharacterCreationSystem overhaul, OverworldMap)
- **Item Types:** 25+ families
- **Components:** 40+ component types with 16 property categories
- **Craftable Intermediates:** 4 (Crude Blade, Sharpened Stick, Wrapped Handle, Strap)
- **Raw Materials:** 8 world-spawning types
- **Building Prefabs:** 18 validated layouts (9 added v39)
- **Loot Room Types:** 16
- **NPCs:** 5 types (Scavenger, Raider, Armed Raider, Brute, Stalker)
- **Biomes:** 7 (Urban Core, Suburbs, Industrial, Rich Neighborhood, Rural, Forest, Ruins)
- **District Types:** 15
- **Talent Trees:** 5, **Talent Nodes:** 35+
- **Combat Abilities:** 15 (5 blunt, 5 sharp, 5 unarmed)
- **Z-Levels:** 3 levels
- **Chunk Size:** 128×128
- **Cache:** v52

---

## 🚧 Current Sprint

### Active: Hub-and-Run Redesign (see REDESIGN_BRIEF.md)
**Status:** Phase 0 complete, Phase 1 next  
**Priority:** HIGH  

Order:
0. ✅ Zones persist; the hub is a node; stash; rest and sleep.
1. District graph and travel screen replace overworld travel; route
   resolution (time, drain, danger); site exit returns to a node.
2. `block` layout: streets as corridors with sky, enterable storefronts as
   rooms; route slices; walkable routes near the hub; daylight leak.
3. Roster v1 (hub roles first), hub needs, contracts, set pieces, encounter
   budgets, night danger.
4. Projects as recipes with a location; one extraction path end to end;
   save/load from the zone cache.
5. Colony layer proper, if Phase 4 earns it.

The earlier "Street Kid Starter Milestone" (intro flow, journal, POIs,
auto-travel to POI) was removed with the first-person pivot and is not coming
back in that form. Occupations return in Phase 3 as a hub contact, a want,
and an access tag per background rather than a scripted intro.

#### Previous Sprint: v52 — Character Creation Overhaul (CoQ-style) ✅
**Status:** ✅ Complete  
**Completed:** April 28, 2026

#### Previous Sprint: Phase 1 — Light & Dark + Item Audit ✅
**Status:** ✅ Complete  
**Completed:** February 11, 2026

**Delivered:**
- [x] Day/night cycle with TimeSystem (24-hour clock, ambient light)
- [x] LightingSystem with ambient + point light sources
- [x] Flashlight (cone, radius 12) and Lantern (radial, radius 7)
- [x] Battery/fuel consumption per turn
- [x] Player facing direction for cone light
- [x] Starting loadout with light sources
- [x] On/off toggle for light items
- [x] Full item system health check and 12+ bug fixes
- [x] Can opener item, loot table expansion
- [x] Auto-complete smash, Escape closes modals, modal scroll fix

#### Previous Sprint: Prefab Buildings & Loot Tables ✅
**Status:** ✅ Complete  
**Completed:** February 6, 2026

**Delivered:**
- [x] 9 prefab building layouts (small, medium, large)
- [x] Interactive doors as WorldObjects with biome-based types
- [x] 16 room-type loot tables with weighted item pools
- [x] Building-aware item spawning (replaced random spawning)
- [x] Location UI panel (biome, floor, room type)
- [x] Bug fixes (door.getTile(), entrance bypass, variable conflicts)

#### Previous Sprint: Z-Levels & World Builder ✅
**Status:** ✅ Complete  
**Completed:** February 4, 2026

**Delivered:**
- [x] Multi-level world generation (3 Z-levels)
- [x] Buildings with staircases (80% upstairs, 60% basements)
- [x] Bidirectional staircase system
- [x] Staircase interaction UI
- [x] Sewer system at z=-1 with manholes and ladders
- [x] Road network generation (biome-specific)
- [x] Building placement along roads
- [x] Z-aware collision and interaction system
- [x] Multi-floor building generation

---

## 📅 Development Roadmap

### TIER 1: Foundation Systems ✅ (Complete)

#### 1. ✅ Movement Modes & Sound System
#### 2. ✅ Deep Character Creation
#### 3. ✅ Robust Inventory Management

---

### TIER 2: Item Depth Systems (Features 4-6)

#### 4. Item Interaction System
**Status:** Not Started  
**Priority:** MEDIUM-HIGH  
**Estimated Time:** 3-4 hours

**Scope:**
- Multiple interaction types per item (open, close, read, activate, etc.)
- Store items in containers
- Detailed item descriptions with lore
- Item condition/durability tracking
- Context-sensitive interaction menu

**Dependencies:** Requires Tier 1.3 (Inventory Management)

#### 5. Food & Consumables
**Status:** Not Started  
**Priority:** MEDIUM  
**Estimated Time:** 2 hours

**Scope:**
- Food/drink containers (cans, bottles, boxes)
- Tools for opening (can opener, bottle opener)
- Hunger/thirst mechanics
- Eating/drinking actions with effects
- Spoilage system (future)

**Dependencies:** Requires Tier 2.4 (Item Interactions)

#### 6. Crafting & Disassembly System ⭐ MAJOR SYSTEM
**Status:** Not Started  
**Priority:** MEDIUM-HIGH  
**Estimated Time:** 5-6 hours

**Scope:**
- Disassemble any item into components
- Recipe system for assembly
- Tool requirements for crafting
- Skill checks for complex recipes
- Destroy/salvage map structures
- Component library (hundreds planned)
- Quality levels affect output

**Dependencies:** Requires Tier 1.3 (Inventory) and Tier 2.4 (Item Interactions)

---

### TIER 3: World Expansion (Features 7-8)

#### 7. ✅ Robust World Builder ⭐ MAJOR SYSTEM
**Status:** ✅ Complete  
**Completed:** February 4, 2026

**Delivered:**
- Building generation (rectangular, L-shaped, T-shaped)
- Road and pathway systems (biome-specific)
- Sewer system with rooms and branches
- Building placement along roads with doors
- Structured generation replacing random noise
- Multi-floor building support

**Future Enhancements:**
- Natural features (trees, rocks, mountains)
- Terrain elevation and cliffs
- POI (Points of Interest) system
- Building prefabs and templates

#### 8. ✅ Z-Level System
**Status:** ✅ Complete  
**Completed:** February 4, 2026

**Delivered:**
- Vertical movement (stairs, manholes, ladders)
- Multi-floor buildings (ground, second floor, basement)
- Underground sewers and tunnels
- Player Z position tracking
- Render only current level
- Z-aware collision and interactions

**Future Enhancements:**
- Direct keybinds for stair usage (< and >)
- Z-aware pathfinding for NPCs
- Elevators and ropes
- Multi-level combat tactics

---

### TIER 4: Social & Advanced Systems (Features 9-12)

#### 9. Cybernetics Installation
**Status:** Not Started  
**Priority:** MEDIUM-LOW  
**Estimated Time:** 2-3 hours

**Scope:**
- Installation UI with risk visualization
- Tool/medical supply requirements
- Risk rolls (infection, shock, rejection, failure)
- Consequences system (permanent injuries, malfunctions)
- Ripper doc NPC services
- Black market vs. legitimate clinics

#### 10. Basic NPC Interactions
**Status:** Not Started  
**Priority:** MEDIUM-LOW  
**Estimated Time:** 3-4 hours

**Scope:**
- Dialogue system foundation
- Trading interface (buy/sell)
- Faction reputation (basic tracking)
- Simple quest/task system
- NPC memory of player actions

#### 11. Procedural Dialogue System ⭐ MAJOR SYSTEM
**Status:** Not Started  
**Priority:** LOW  
**Estimated Time:** 6-8 hours

**Scope:**
- Language system piecing words/phrases together
- Context-aware responses
- Varied dialogue for same meaning
- NPC personality traits affecting speech patterns
- Mood/relationship affects tone
- Dynamic quest generation through dialogue

**Dependencies:** Requires Tier 4.10 (Basic NPC Interactions)

#### 12. Faction & Corporation Systems
**Status:** Not Started  
**Priority:** LOW  
**Estimated Time:** 4-5 hours

**Scope:**
- Multiple factions with complex relationships
- Corporate influence and territories
- Reputation tracking per faction
- Faction-specific content and quests
- Faction wars and dynamic events
- Player can join/betray factions

**Dependencies:** Requires Tier 4.10 and 4.11 (NPC systems)

---

## 🎨 Long-Term Vision

### How Short-Term Goals Support Long-Term Vision

**Movement & Sound → Stealth Gameplay**
- Foundation for infiltration missions
- Enables social stealth (blend in vs. sneak)
- Supports faction territory mechanics

**Inventory & Items → Survival Simulation**
- Weight/encumbrance creates meaningful choices
- Container system enables looting/scavenging gameplay
- Sets up for economy and trading

**Crafting & Disassembly → Player Agency**
- Every item has value (can be broken down)
- Player-driven solutions to problems
- Emergent gameplay through creative crafting

**World Builder & Z-Levels → Environmental Storytelling**
- Designed spaces tell stories
- Vertical exploration adds depth
- Multi-level combat tactics

**NPC Systems → Living World**
- Factions create dynamic conflicts
- Procedural dialogue makes every run unique
- Player choices have lasting consequences

### Ultimate Goal
A roguelike where every run feels different, player choices matter, and the world reacts dynamically to your actions. Deep enough for 100+ hour playthroughs, accessible enough for quick runs.

---

## 📊 Technical Debt & Refactoring

### Known Issues
- None currently blocking development

### Future Refactoring Needed
- **Content Manager:** Will need database/JSON files when item count exceeds 100
- **Chunk Loading:** May need optimization for very large explored areas
- **Save System:** Not yet implemented (needed before public release)

---

## 🔧 Development Notes

### Architecture Decisions
- **No Framework:** Vanilla JS for maximum control and learning
- **ES6 Modules:** Clean separation of concerns
- **Data-Driven Content:** Easy to expand without code changes
- **Turn-Based:** Simplifies multiplayer potential (future)

### Code Standards
- Detailed comments for all systems
- Modular design (avoid spaghetti code)
- Each system in its own file
- Clear naming conventions

---

## 📝 Session Notes

### Session: May 2026
**Completed / Updated:**
- Major design pivot documented: occupation-driven starts, dense zone slices, large world with freely traversable zones.
- Current focus is `src/world/gen` zone generation rather than the older endless procedural map feel.
- Rebuilt current starter flow around Street Kid testing:
  - Quick Start now defaults to Street Kid.
  - Starting talents include Opportunistic stance, Weapon Aptitude, and several small blade talents.
  - Downstairs functions as the current start hub.
  - Market Corner functions as the first external objective zone.
- Added/continued early objective loop:
  - Working NPC handoff loop through `QuestSystem`.
  - Rook can handle starter objective flow.
  - Journal wording softened to "Current", "Start", "Errands", "Done".
- Added exploration support:
  - POIs discovered through FoV/explored tiles.
  - `P` Known Places modal.
  - Auto-travel to discovered POIs.
  - `O` auto-explore.
  - Auto-travel cancels on danger, blocked paths, overworld/zone transitions, or `Esc`.
- Current caveat:
  - Intro objective is still universal in code and needs to become Street Kid-specific next.

**Next Session Goal:**
- Build the occupation-start registry and move the current intro into the Street Kid start definition.

### Session: April 28, 2026
**Completed:**
- **v52 Character Creation Overhaul** — CoQ-style 3-column chargen screen
  - Left col: Name/gender, 6 background cards (stat mods, gear label, free talent)
  - Center col: Talent browser with 6 tabs (All/trees), 2-col card grid, Buy/Remove buttons with prereq gating
  - Right col: Live summary (name, bg, gear, talent pts, attr preview, start button)
  - 6pt talent budget, drawbacks refund points, backgrounds grant free talents
  - `_cgPlayNow` button: random bg + 4 tier-1 talents within budget
  - `player.talentPoints = 0` at start; earned in-game via leveling
  - `skipTalents` flag on `applyBackgroundToCharacter` prevents double-grant
  - Added `gearLabel` to all 6 backgrounds in `CharacterCreationSystem.js`
  - Cache bumped to v52

**Completed (earlier sessions v20-v51, summarized):**
- v20: NPC energy-based speed, detection state machine (UNAWARE/ALERT/SEARCHING/ENGAGED/FLEEING)
- v21-v28: Medkit system, infection, pain suppression, mobile UX, container UX streamlining
- v31: Stat-based combat math (AGI hit %, PER crit %, STR damage)
- v32: Stagger (blunt) + Parry (sharp defensive) system
- v33: 3 new NPC types (Armed Raider, Brute, Stalker)
- v34-v37: Background-specific starting gear, Spiked Club weapon, ADDING_ITEMS.md
- v38-v39: World gen overhaul — 128×128 chunks, seeded RNG, 15 district types, 18 prefabs, 9 new POI generators, per-chunk NPC spawning
- v40-v49: Combat overlay, anatomy combat penalties, stance modifiers
- v50: Overworld system — 60×40 zone grid, zone drop-in, Tab toggle, zone biome forcing
- v51: Talent system — 5 trees, 35+ nodes, TalentCatalog.js, ability gating, stance gating

### Session: February 15, 2026
**Completed:**
- **v19 Crafting System Overhaul** — Complete redesign of crafting to be tiered and intuitive
  - Added `maxValue` tier gating: Shiv requires cutting 1 maxValue:1, blocks Crude Blade/Knife Blade
  - Added 4 craftable intermediate components: Crude Blade (cutting:2), Sharpened Stick (piercing:1), Wrapped Handle (grip:2), Strap (binding:3)
  - Added `craftedComponentId` + `craftedProperties` system for intermediates
  - Added 8 raw material components: glass_shard, wood_piece, stone, bone_shard, rubber_piece, duct_tape, nail, cloth_wrap
  - Added properties to 8+ previously bare components (can_lid, leather_piece, blade_wheel, etc.)
  - Added `createComponent()` method to ContentManager for spawning raw materials from loot
  - Updated LootTables.js: `rollLootPool()` returns `{familyId}` or `{componentId}`, Chunk.js handles both
  - Raw materials spawn in world: outdoors (stone, wood, glass), garages (metal, nails, wire), residential (glass, cloth, tape)
  - CraftingSystem: `getComponentProperty()` checks craftedProperties first, `matchesRequirement()` supports maxValue
  - CraftingUI: sub-recipe drill-down buttons, back-to-parent navigation, craftTime display, maxValue range display
  - Reworked Shiv recipe: cutting 1-1, grip 1, 1 turn
  - Reworked Knife recipe: cutting 2+, grip 2+, fastening x2, 2 turns

- **Help Screen Expansion** — Added detailed gameplay sections
  - Items & Inventory guide (pickup, actions, encumbrance, containers)
  - Crafting & Disassembly guide (workshop, sub-recipes, raw materials)
  - Combat overview (anatomy-based, no HP bar, bleeding, lethality)
  - Survival tips

- **Documentation Update** — Updated all MD files
  - CRAFTING_DATABASE.md: Full rewrite with tier system, intermediates, raw materials, maxValue examples
  - README.md: Updated features, controls, architecture sections
  - DEVLOG.md: Added v19 session entry
  - ARCHITECTURE.md: Updated crafting system section
  - GAME_DESIGN.md: Updated phase status
  - SYSTEMS_REFERENCE.md: Updated crafting section with tier gating and intermediates

- **Cache:** Bumped to v19

**Impact:**
- Crafting is now a multi-tier progression: raw materials → intermediates → items
- Players can’t waste good components on low-tier recipes (maxValue gating)
- UI shows drill-down sub-recipes for crafting intermediate components
- Raw materials spawn naturally in the world via loot tables
- Help screen now serves as a proper in-game guide

**Next Session Goals:**
- Playtest crafting flow and tune names/numbers
- Combat balance: stat-based hit chances, weapon targeting distributions

### Session: February 11, 2026
**Completed:**
- **Phase 1: Light & Dark** — Full day/night cycle and lighting system
  - Created `TimeSystem.js` — 24-hour clock, ambient light levels, sunrise/sunset
  - Created `LightingSystem.js` — ambient + point light sources, cone/radial shapes
  - Integrated with FoV — effective vision radius modulated by light
  - Flashlight (cone, radius 12, battery-powered) and Lantern (radial, radius 7, fuel-powered)
  - Fuel consumption per turn (batteries drain durability, fuel drains quantity)
  - Player facing direction tracked for cone-shaped flashlight light
  - Starting loadout includes clothes, backpack, lantern w/ fuel, flashlight w/ batteries
  - On/off toggle in equipment panel and actions modal
  - Yellow warm tint on light radius rendering

- **Full Item System Audit** — Comprehensive health check of all item systems
  - Identified 5 critical bugs, 4 significant issues, and several minor improvements
  - Fixed pocket container lookup bugs (8 broken ternary chains → `findContainerById()`)
  - Fixed DisassembleModal stale container lookups
  - Fixed container disassembly destroying contents (now spills to inventory/ground)
  - Fixed equip+carry in same hand conflict
  - Fixed missing `item.z` in move modal drop action
  - Added `can_opener` item family definition
  - Added flashlight, lantern, lantern_fuel, can_opener to 9 loot tables
  - Added `canPlayerDisassemble()` free-hand check with visible warning UI
  - Battery display now shows "Charge" instead of "Durability"
  - Replaced hardcoded "door" strings with dynamic `worldObject.name`

- **QoL Improvements**
  - Auto-complete smash: loops hits until destroyed or weapon breaks, shows summary
  - Escape key closes all open modals/windows
  - Fixed modal scrolling in PWA (CSS touch-action, overflow-y, overscroll-behavior)

- **Cache:** Bumped to v7

**Impact:**
- Game now has full day/night cycle with dynamic lighting
- Light sources are functional equipment with fuel management
- Item system is significantly more robust with 12+ bug fixes
- Smashing objects is now a single-action experience
- Escape key provides universal modal dismissal
- PWA modals scroll correctly on mobile

**Next Session Goals:**
- Begin Phase 2: Combat & NPC AI
- Melee/ranged combat, NPC behavior loops, aggro, factions

### Session: February 6, 2026
**Completed:**
- **Prefab Building System** - 9 validated ASCII layout prefabs
  - Small: studio_apartment (10×8), corner_store (12×10), pharmacy (10×10), garage (12×10)
  - Medium: two_bedroom_apartment (16×14), small_office (14×14), clinic (16×14)
  - Large: warehouse (20×20), large_apartment (20×18)
  - Doors are interactive WorldObjects created via `createDoor()` with biome-based types
  - Interior walls use `|`/`-` symbols, exterior use `#`
  - `findMatchingPrefab()` ensures doors face the road based on building orientation
  - Fallback to procedural rectangular generation when no prefab matches

- **Loot Table System** - Building-aware item spawning
  - Created `LootTables.js` with 16 room-type loot pools
  - Room types: residential (living, bedroom, kitchen, bathroom), commercial (store, backroom), office (office, reception), medical (store, storage, waiting, exam), industrial (garage_bay, garage_tools, warehouse_floor, warehouse_storage)
  - Each room type has weighted item pools, spawn chance, and max items
  - Replaced old random `spawnItems()` with building-aware system
  - Outdoor loot at 2% per-tile chance for untagged tiles
  - Items spawn contextually (medkits in clinics, food in kitchens, tools in garages)

- **Location UI Panel** - New sidebar panel below Target Info
  - Shows current biome (color-coded), floor level, and room/area type
  - Added `getBiomeAt()` to World.js, stored biome on Chunk during generation
  - Updates every turn as player moves

- **Bug Fixes**
  - Fixed `door.getTile()` crash — method didn't exist on Door class, replaced with inline tile construction
  - Fixed door bypass bug — removed `_` (open floor) characters from all entrance rows, single-door entrances only
  - Fixed `doorSide` variable redeclaration conflict in procedural building path

**Impact:**
- Buildings now have cohesive, purpose-driven room layouts
- Items spawn in contextually appropriate locations
- Players can see biome and room info in real-time
- All doors are interactive WorldObjects with HP, lock state, and interaction modal

**Next Session Goals:**
- NPC system improvements
- Additional content (more items, more prefab variety)
- Combat system enhancements

### Session: February 4, 2026
**Completed:**
- **Z-Level Collision & Interaction Fix** - Made all gameplay queries Z-aware
  - Updated World.isBlocked(), getEntityAt(), getItemsAt() to accept z parameter
  - Updated Player.tryMove(), tryPickup(), dropItem() to pass player.z
  - Updated NPC AI to only chase/attack on same Z-level
  - Updated all UIManager calls to pass player.z for ground item queries
  - NPCs now respect Z-levels for movement and combat
  - Items dropped now inherit player's Z-level
  - All 15+ locations in UIManager updated for Z-awareness

**Impact:**
- Walls now properly block movement on correct Z-level
- Entities only interact on same Z-level
- Items only visible/pickupable on same Z-level
- NPCs can't attack through floors/ceilings
- Multi-level gameplay now fully functional

**Next Session Goals:**
- Add direct keybinds for staircase usage (< and >)
- Improve building interior features
- Begin crafting system planning

### Session: February 3, 2026
**Completed:**
- **Item Interaction System** - Complete item operations framework
  - Created ItemSystem.js with splitItem, openContainer, consumeFood methods
  - Tool finding in equipment and inventory
  - Opening containers with yield/spillage mechanics
  - Durability damage to tools when opening containers
  - Smart consumption system (auto-calculates optimal amount)

- **Food & Consumables System** - Full hunger/thirst mechanics
  - Nutrition values on food/drink items
  - Quantity-based consumption (grams/milliliters)
  - Contamination system with food poisoning
  - Trait integration (ironStomach reduces poison by 50%)
  - Smart consumption prevents overeating

- **Food Spoilage System** - Progressive degradation
  - Only affects opened containers
  - Different spoilage rates: protein (0.03), liquid (0.05), default (0.04)
  - Contamination threshold at 0.3
  - Creates strategic pressure to consume quickly

- **Liquid Spillage System** - Drink leakage mechanics
  - 7ml per turn from unsealed containers
  - Bottles can be resealed (plastic)
  - Cans cannot be resealed (metal)
  - Empty items auto-removed

- **Status Effects System** - Duration-based effects
  - Food poisoning from contaminated food
  - Heal-over-time from medkits
  - Trait modifiers (slowHealer, ironStomach)
  - Processed each turn in Player.processStatusEffects()

- **Comprehensive Documentation** - Created SYSTEMS_REFERENCE.md
  - Complete system documentation
  - Item addition workflows for all types
  - Testing checklists
  - Quick reference guides

**Next Session Goals:**
- Add 10-20 new food/drink varieties
- Add new tools and containers
- Balance and test new content

### Session: February 2, 2026
**Completed:**
- Fixed equipment slot bug (items no longer disappear)
- Simplified unequipSlot to only remove from slot
- Blocked occupied slots in move modal
- Added occupied slot checks to all equip pathways

### Session: February 1, 2026
**Completed:**
- Implemented Field of View system (raycasting)
- Added Inspect Mode with detailed tile examination
- Created Extraction Objective system
- Added Access Card requirement for extraction
- Implemented Win/Loss screens with run statistics
- Added distance tracking to objectives in UI
- Created DEVLOG.md for progress tracking
- **Implemented Movement Modes & Sound System**
  - 4 movement modes: Walk, Run, Crouch, Prone
  - Each mode has unique action cost and sound volume
  - Created SoundSystem.js for sound event management
  - Raiders now investigate sounds
  - UI shows current movement mode with color coding
  - [M] key cycles through modes

**Next Session Goals:**
- Implement Deep Character Creation expansion
- Begin Robust Inventory Management system

---

## 🎯 Milestones

- [x] **Alpha 0.1:** Core gameplay loop (Complete)
- [x] **Alpha 0.2:** Equipment and combat (Complete)
- [x] **Alpha 0.3:** FoV and exploration (Complete)
- [x] **Alpha 0.4:** Extraction objective (Complete)
- [x] **Alpha 0.5:** Movement modes and stealth (Complete)
- [x] **Alpha 0.6:** Deep character creation (Complete)
- [x] **Alpha 0.7:** Robust inventory system (Complete)
- [x] **Alpha 0.8:** Item interactions and food systems (Complete)
- [x] **Beta 0.1:** World builder and structures (Complete)
- [x] **Beta 0.2:** Z-levels and vertical exploration (Complete)
- [x] **Beta 0.3:** Crafting and disassembly system (Complete)
- [x] **Beta 0.4:** Phase 1 — Light & Dark + Item System Audit (Complete)
- [x] **Beta 0.5:** Combat & Anatomy System (Complete)
- [x] **Beta 0.6:** v19 Crafting System Overhaul — Tiered crafting, intermediates, raw materials (Complete)
- [x] **Beta 0.7:** Combat Balance — Stat-based hit/crit, stagger, parry, 5 NPC types (Complete)
- [x] **Beta 0.8:** World Gen Overhaul — 128 chunk, districts, 18 prefabs, seeded RNG (Complete)
- [x] **Beta 0.9:** Overworld System — 60×40 zone grid, zone drop-in, Tab toggle (Complete)
- [x] **Beta 0.10:** Talent System — 5 trees, 35+ nodes, ability/stance gating (Complete)
- [x] **Beta 0.11:** Character Creation Overhaul — CoQ-style 3-column, talent chargen (Complete)
- [x] **Beta 0.12:** First-person crawler view, interior sites, zone persistence, hub node (Complete)
- [ ] **Beta 0.13:** District graph and travel; streets as corridors with storefronts
- [ ] **Beta 0.14:** Roster, hub needs, contracts, set pieces
- [ ] **Beta 0.15:** Projects, one extraction path, save/load
- [ ] **Later:** Three Origins (Flesh / Metal / Echo), cybernetics, colony layer
- [ ] **Release 1.0:** Full feature set, polished, balanced

---

**End of Development Log**  
*This document is updated after each major feature completion.*
