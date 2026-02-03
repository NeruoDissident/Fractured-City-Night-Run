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
**Responsibility:** Infinite world generation, chunk streaming, entity management

**Architecture:**
- World divided into 32x32 tile chunks
- Chunks generated procedurally on-demand
- Only active chunks (within radius) are simulated
- Entities and items tracked globally

**Biomes:**
- Ruins (40% spawn rate)
- Industrial (40% spawn rate)
- Wasteland (20% spawn rate)

**Expansion Points:**
- Add chunk serialization (save/load distant chunks)
- Add more biomes (corporate towers, underground tunnels)
- Add special structures (buildings, vaults, labs)
- Add biome transitions and borders
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

## Planned Systems (Not Yet Implemented)

### Field of View (FoV)
**Purpose:** Limit player vision based on obstacles and lighting

**Algorithm:** Shadowcasting or raycasting
**Factors:**
- Vision range from anatomy
- Light sources (torches, cybernetic eyes)
- Obstacles (walls, smoke)
- Darkness level per tile

**Integration Points:**
- `World.render()` - Only draw visible tiles
- `Player.anatomy.getVisionRange()` - Base vision stat

---

### Movement Modes
**Purpose:** Tactical movement with sound/speed tradeoffs

**Modes:**
- **Walk** (default) - Normal speed, low sound
- **Run** - 2x speed, high sound, stamina drain
- **Crouch** - 0.5x speed, very low sound, stealth bonus
- **Prone** - 0.25x speed, silent, high defense, can't use weapons

**Sound System:**
- Each action generates sound radius
- NPCs hear sounds and investigate
- Louder actions attract more attention

**Integration Points:**
- `InputHandler` - Add mode toggle keys (Shift, Ctrl)
- `Player.tryMove()` - Apply speed/sound modifiers
- `NPC.takeTurn()` - Add sound-based AI

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

### Crafting System
**Purpose:** Create items from components using substitution rules

**Philosophy:**
- Deterministic outputs (no random failure)
- Substitution risk (inferior materials = drawbacks)
- Role-based recipes (any conductive, any binder)

**Example Recipe:**
```javascript
{
  output: 'makeshift_medkit',
  requires: [
    { role: 'bandage', amount: 2 },
    { role: 'antiseptic', amount: 1 },
    { role: 'painkiller', amount: 1 }
  ],
  substitutions: {
    'bandage': { 'cloth_scrap': { penalty: 'infection_risk', value: 0.1 } },
    'antiseptic': { 'alcohol': { penalty: 'pain', value: 5 } }
  }
}
```

**Integration Points:**
- `ContentManager` - Add recipe definitions
- `UIManager` - Add crafting UI
- `Player.inventory` - Check available components

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
nd-fractured-city/
├── index.html              # Entry point
├── styles.css              # UI styling
├── src/
│   ├── main.js            # Bootstrap
│   ├── core/
│   │   ├── Game.js        # Main loop
│   │   ├── Renderer.js    # Canvas drawing
│   │   └── InputHandler.js # Keyboard
│   ├── world/
│   │   ├── World.js       # Chunk manager
│   │   └── Chunk.js       # Terrain generation
│   ├── entities/
│   │   ├── Entity.js      # Base class
│   │   ├── Player.js      # Player character
│   │   ├── NPC.js         # AI entities
│   │   └── Anatomy.js     # Body part system
│   ├── systems/
│   │   └── EquipmentSystem.js # Equip/unequip logic
│   ├── content/
│   │   └── ContentManager.js  # Data-driven content
│   └── ui/
│       └── UIManager.js   # All UI rendering
├── README.md
└── ARCHITECTURE.md        # This file
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
