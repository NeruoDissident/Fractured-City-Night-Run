# Fractured City Roguelike - Architecture Documentation

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

### 2. Rendering (`src/core/Renderer.js`)
**Responsibility:** Canvas 2D drawing, tile rendering

**Key Methods:**
- `drawTile(x, y, glyph, fgColor, bgColor)` - Draws a single 32x32 tile
- `drawRect()` - Utility for backgrounds
- `drawBorder()` - Utility for highlights

**Current Visuals:** Colored ASCII glyphs (no sprites)

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
- ?: Help

**Expansion Points:**
- Add mouse support for targeting
- Add gamepad support
- Add rebindable keys
- Add action queuing

---

### 4. World System (`src/world/World.js` + `src/world/Chunk.js`)
**Responsibility:** Infinite world generation, chunk streaming, entity management, Z-level support

**Architecture:**
- World divided into 32x32 tile chunks
- Chunks generated procedurally on-demand
- Multi-level support (z=-1 sewers/basements, z=0 ground, z=1 second floors)
- Only active chunks (within radius) are simulated
- Entities and items tracked globally with Z-level awareness

**Biomes:**
- Ruins (40% spawn rate) - Cracked pavement, broken paths
- Industrial (40% spawn rate) - Paved roads, asphalt streets
- Wasteland (20% spawn rate) - Dirt roads, trails

**World Features:**
- Road networks (biome-specific styling)
- Buildings along roads (rectangular, L-shaped, T-shaped)
- Multi-floor buildings with staircases (80% have upstairs, 60% have basements)
- Sewer systems at z=-1 with manholes and ladders
- Doors connecting buildings to roads
- Obstacles and debris (placed after structures)

**Expansion Points:**
- Add chunk serialization (save/load distant chunks)
- Add natural features (trees, rocks, mountains)
- Add POI (Points of Interest) system
- Add building prefabs and templates
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

**Current AI Types:**
- `wander` - Random movement (scavengers)
- `chase` - Pathfinding toward player (raiders)

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
- **Materials** - Base properties (quality, durability, color, tags)
- **Item Families** - Base item templates (weapons, armor, consumables)
- **Modifiers** - Adjectives that alter items (rusty, reinforced)
- **Cybernetics** - Implants with bonuses/drawbacks/risks
- **Traits** - Character creation perks

**Item Generation:**
```javascript
content.createItem(familyId, materialId, modifierId)
// Example: createItem('knife', 'carbon_steel', 'rusty')
// Result: "Rusty Carbon Steel Knife"
```

**Expansion Points:**
- Add crafting recipes (combine items to create new ones)
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
- **Context Panel** - Current tile info

**Modal Screens:**
- **Character Creation** - Stat allocation
- **Detailed Character** - Full anatomy breakdown
- **Detailed Inventory** - Equipment management with buttons
- **Help Screen** - Controls reference

**Expansion Points:**
- Add targeting cursor for ranged attacks
- Add minimap
- Add quest/objective tracker
- Add crafting UI
- Add trading UI
- Add dialogue UI
- Add death screen with run stats

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

**Status:** ✅ Implemented

**Features:**
- 6 backgrounds (Street Kid, Corporate Drone, Ex-Military, etc.)
- 10+ traits (positive and negative)
- Stat point allocation with validation
- Gender selection
- Trait effects on gameplay

**Planned: Crafting System**
**Status:** Not Yet Implemented

**Philosophy:**
- Deterministic outputs (no random failure)
- Substitution risk (inferior materials = drawbacks)
- Role-based recipes (any conductive, any binder)
- Disassembly of any item into components

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
├── DESIGN_PHILOSOPHY.md   # Design principles
├── SPEED_SYSTEM.md        # Movement mechanics
├── SYSTEMS_REFERENCE.md   # System documentation
├── src/
│   ├── main.js            # Bootstrap
│   ├── core/
│   │   ├── Game.js        # Main loop
│   │   ├── Renderer.js    # Canvas drawing
│   │   └── InputHandler.js # Keyboard
│   ├── world/
│   │   ├── World.js       # Chunk manager, Z-level support
│   │   ├── Chunk.js       # Terrain generation, buildings, sewers
│   │   └── ExtractionPoint.js # Win condition
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
│   │   └── CharacterCreationSystem.js # Character gen
│   ├── content/
│   │   └── ContentManager.js  # Data-driven content
│   └── ui/
│       └── UIManager.js   # All UI rendering
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
