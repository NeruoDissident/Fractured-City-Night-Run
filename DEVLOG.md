# Fractured City - Development Log

**Project:** Fractured City - Browser-based Cyberpunk Roguelike  
**Engine:** Vanilla JavaScript + HTML5 Canvas 2D  
**Status:** Active Development  
**Last Updated:** February 2, 2026

---

## 🎯 Project Vision

A traditional turn-based roguelike set in a cyberpunk dystopia. Features permadeath, procedural generation, deep character customization, detailed anatomy simulation, robust crafting, and tactical combat. Runs entirely in the browser with no dependencies.

### Core Pillars
- **Turn-Based Gameplay:** One action = one world tick
- **Permadeath:** Death ends the run
- **Procedural Content:** Infinite world, randomized items, dynamic encounters
- **Deep Simulation:** Anatomy tracking, item interactions, crafting/disassembly
- **Tactical Depth:** Stealth, sound propagation, equipment choices matter

---

## ✅ Completed Features

### Phase 0: Foundation (Complete)
- [x] **Core Game Loop** - Turn-based system, game state management
- [x] **Canvas Renderer** - 32x32 tile grid, colored ASCII glyphs
- [x] **Input Handler** - Keyboard controls, action mapping
- [x] **World System** - Chunked infinite world (32x32 chunks)
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
- [x] **Equipment Slot Protection** - Occupied slots blocked, prevents item loss, forces manual unequip

### Current Build Stats
- **Files:** 22+ modular ES6 modules
- **Systems:** 10 core systems (Renderer, World, Entities, Equipment, FoV, UI, Content, Input, Container, CharCreation)
- **Item Types:** 10+ families (weapons, armor, materials, tools)
- **NPCs:** 2 types (Scavengers, Raiders)
- **Biomes:** 3 (Ruins, Industrial, Wasteland)

---

## 🚧 Current Sprint

### Active: Item Interaction System
**Status:** Not Started  
**Priority:** HIGH  
**Estimated Time:** 3-4 hours

#### Goals
- Multiple interaction types per item
- Context menus for items
- Use/consume items
- Combine items
- Drop items
- Move items between containers

#### Previous Sprint: Robust Inventory Management ✅
**Status:** ✅ Complete  
**Completed:** February 2, 2026

**Delivered:**
- [x] ContainerSystem.js - Core container logic with weight/volume
- [x] Weight & volume properties on all items
- [x] Container items (backpack, wallet, coat with pockets, pants, canteen)
- [x] Encumbrance system (light/medium/heavy/overencumbered)
- [x] Strength-based carry weight calculation
- [x] Pickup validation with weight/volume checking
- [x] Inventory UI showing weight, volume, encumbrance status
- [x] Container browsing UI (view contents, pockets)
- [x] Character panel shows current weight with color coding
- [x] Nested container support (unlimited depth)

---

## 📅 Development Roadmap

### TIER 1: Foundation Systems (Next 3 Features)

#### 1. ✅ Movement Modes & Sound System
**Status:** ✅ Complete  
**Why:** Adds tactical depth, self-contained, doesn't block other features

#### 2. ✅ Deep Character Creation
**Status:** ✅ Complete  
**Delivered:** 6 backgrounds, 10 traits, gender selection, validation system

#### 3. ✅ Robust Inventory Management
**Status:** ✅ Complete  
**Delivered:** Container system, weight/volume, encumbrance, nested containers, pockets

**Why Next:** Foundation for item interactions, crafting, and all future item-based systems
- Pocket count and size limits per clothing item
- Weight calculations and encumbrance penalties
- Volume/space management
- Nested container inspection (coat → pockets → wallet → contents)
- Drag-and-drop item organization
- Quick slots for fast access

**Why Next:** Foundation for crafting, food, and all item interactions

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

#### 7. Robust World Builder ⭐ MAJOR SYSTEM
**Status:** Not Started  
**Priority:** MEDIUM  
**Estimated Time:** 4-5 hours

**Scope:**
- Building generation (rooms, corridors, prefabs)
- Road and pathway systems
- Natural features (trees, rocks, mountains)
- Terrain elevation and cliffs
- Structured generation replacing random noise
- POI (Points of Interest) system

**Dependencies:** None, but enhances all gameplay

#### 8. Z-Level System
**Status:** Not Started  
**Priority:** MEDIUM  
**Estimated Time:** 3-4 hours

**Scope:**
- Vertical movement (stairs, elevators, ladders, ropes)
- Multi-floor buildings
- Underground sewers and tunnels
- Track player Z position
- Render only current level
- Z-aware pathfinding for NPCs

**Dependencies:** Requires Tier 3.7 (World Builder for multi-level structures)

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

### Session: February 2, 2026
**Completed:**
- **Fixed Equipment Slot Bug** - Items no longer disappear when equipping to occupied slots
  - Simplified `EquipmentSystem.unequipSlot()` to only remove from slot
  - Blocked all occupied slots in move modal (filters out occupied options)
  - Added occupied slot checks to all three equip pathways
  - Unequip still auto-stores or drops to ground
  - Clear warning messages: "Slot is occupied by [item]. Unequip it first."
  - Simple solution: force manual unequip before equipping new item

**Next Session Goals:**
- Begin Item Interaction System
- Add context menus for items

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

---

## 🎯 Milestones

- [x] **Alpha 0.1:** Core gameplay loop (Complete)
- [x] **Alpha 0.2:** Equipment and combat (Complete)
- [x] **Alpha 0.3:** FoV and exploration (Complete)
- [x] **Alpha 0.4:** Extraction objective (Complete)
- [x] **Alpha 0.5:** Movement modes and stealth (Complete)
- [ ] **Alpha 0.6:** Deep character creation
- [ ] **Alpha 0.7:** Robust inventory system
- [ ] **Beta 0.1:** Crafting and item interactions
- [ ] **Beta 0.2:** World builder and structures
- [ ] **Beta 0.3:** Z-levels and vertical exploration
- [ ] **Beta 0.4:** NPC interactions and trading
- [ ] **Release 1.0:** Full feature set, polished, balanced

---

**End of Development Log**  
*This document is updated after each major feature completion.*
