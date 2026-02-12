# Systems Reference

## Overview

This document details how every system in Fractured City works and how they interact with each other.

---

## Core Systems

### Player System
**File:** `src/entities/Player.js`

**Purpose:** Manages player character state, stats, inventory, and equipment.

**Key Properties:**
- `hp` / `maxHP` - Health points
- `hunger` / `maxHunger` - Hunger level (0-100)
- `thirst` / `maxThirst` - Thirst level (0-100)
- `stats` - Core attributes (strength, agility, endurance, intelligence, perception)
- `inventory` - Array of carried items
- `equipment` - Equipped items by slot
- `traitEffects` - Active trait modifiers
- `statusEffects` - Active temporary effects (healing, sickness, etc.)

**Key Methods:**
- `getMaxHP()` - Calculates max HP from endurance + trait modifiers
- `getMaxCarryWeight()` - Calculates carry capacity from strength + trait modifiers
- `processStatusEffects()` - Processes hunger/thirst drain and active effects each turn
- `addStatusEffect()` - Adds temporary effect (heal-over-time, sickness, etc.)

**Trait Integration Points:**
- `weakConstitution` - Reduces max HP by 10
- `packRat` - Increases carry capacity by 20%
- `slowHealer` - Reduces healing effectiveness by 50%
- `ironStomach` - Reduces food poisoning by 50%

---

### Anatomy System
**File:** `src/entities/Anatomy.js`

**Purpose:** Manages detailed body part system with HP, functionality, and cybernetics.

**Key Properties:**
- `parts` - Hierarchical body structure (head, torso, arms, legs)
- Each part has: `hp`, `maxHP`, `functional`, `cybernetic`

**Key Methods:**
- `getVisionRange()` - Calculates vision based on eye functionality + traits
- `getHearingRange()` - Calculates hearing based on ear functionality
- `canUseHands()` - Checks if hands are functional
- `takeDamage()` - Applies damage to specific body parts

**Trait Integration Points:**
- `nightVision` - Adds +2 to vision range
- `nearSighted` - Subtracts -2 from vision range

---

### Equipment System
**File:** `src/systems/EquipmentSystem.js`

**Purpose:** Handles equipping/unequipping items and calculating equipment bonuses.

**Key Methods:**
- `equipItem()` - Equips item to appropriate slot
- `unequipItem()` - Removes item from slot
- `getDefenseBonus()` - Calculates total armor defense
- `getActionCostModifier()` - Calculates action speed from equipment + traits

**Trait Integration Points:**
- `quickReflexes` - Reduces action cost by 10%
- `clumsy` - Increases action cost by 10%

---

### Container System
**File:** `src/systems/ContainerSystem.js`

**Purpose:** Manages nested container storage (backpacks, pockets, etc.).

**Key Methods:**
- `addItem()` - Adds item to container with weight/volume checks
- `removeItem()` - Removes item from container
- `getAllStoredItems()` - Gets all items in all containers
- `canFit()` - Checks if item fits in container

---

### Item System
**File:** `src/systems/ItemSystem.js`

**Purpose:** Handles item operations (splitting, opening, consuming, smart consumption).

**Key Methods:**
- `splitItem(item, amount)` - Splits stackable items into portions
- `getAvailableOpeningTools(player, container)` - Finds tools that can open container
- `openContainer(container, tool, player)` - Opens sealed container with consequences
- `calculateOptimalConsumption(item, player)` - Calculates optimal amount to consume based on needs
- `consumeFood(item, player, amount)` - Consumes food/drink with nutrition and contamination

**Opening System:**
```javascript
openMethods: {
    can_opener: { yield: 1.0, durabilityDamage: 0 },
    knife: { yield: 0.8, durabilityDamage: 5 },
    pipe: { yield: 0.5, durabilityDamage: 3 },
    ground: { yield: 0.15, durabilityDamage: 0 }
}
```

**Smart Consumption System:**
- Automatically calculates optimal amount to consume to fill hunger/thirst
- If player is full or needs less than available, consumes only what's needed
- If item won't fill player, consumes all remaining
- Formula: `amountNeeded = Math.ceil(statNeeded / nutritionPerUnit)`
- No UI required - works invisibly when amount parameter is null

**Contamination System:**
- Food on ground gets `state.contaminated = true`
- Food in opened containers gradually spoils (see World System)
- Eating contaminated food applies sickness status effect
- `ironStomach` trait reduces contamination effect by 50%

---

### Content Manager
**File:** `src/content/ContentManager.js`

**Purpose:** Loads and manages all game content (items, materials, modifiers, traits).

**Item Creation:**
- `createItem(familyId, materialId, modifierId)` - Creates item instance
- Sealed containers (`can_sealed`, `bottle_sealed`) get random contents
- Materials and modifiers affect item properties

**Generic Containers:**
- `can_sealed` - Contains random food (beans, soup, mystery_meat)
- `bottle_sealed` - Contains random drink (water, soda, juice)

---

### Character Creation System
**File:** `src/systems/CharacterCreationSystem.js`

**Purpose:** Manages backgrounds and traits for character creation.

**Backgrounds:**
- Apply stat modifiers
- Grant starting gear
- Provide background traits

**Traits:**
- **Positive Traits (cost points):**
  - `nightVision` - +2 vision range
  - `quickReflexes` - -10% action cost
  - `ironStomach` - 50% poison resistance
  - `packRat` - +20% carry capacity
  - `lucky` - Better loot/crits (not yet implemented)

- **Negative Traits (give points):**
  - `nearSighted` - -2 vision range
  - `weakConstitution` - -10 max HP
  - `slowHealer` - -50% healing effectiveness
  - `clumsy` - +10% action cost
  - `lightSleeper` - Reduced rest benefits (not yet implemented)

**Trait Application:**
- `applyTraitsToCharacter()` - Merges trait effects into `player.traitEffects`
- All systems check `player.traitEffects` for modifiers

---

### Field of View (FoV) System
**File:** `src/systems/FoVSystem.js`

**Purpose:** Calculates which tiles are visible to the player.

**Algorithm:**
- Simple circular FoV based on vision range
- Vision range from `Anatomy.getVisionRange()`
- Recalculated after each player action

---

### Sound System
**File:** `src/systems/SoundSystem.js`

**Purpose:** Tracks sound events and propagation (for stealth/detection).

**Key Concepts:**
- Actions generate sound with volume
- Movement mode affects sound volume
- Future: Enemy AI will react to sounds

---

### World System
**File:** `src/world/World.js`

**Purpose:** Manages world state, entities, and turn-based environmental effects.

**Key Methods:**
- `processTurn()` - Processes all turn-based systems
- `processFoodSpoilage(player)` - Handles food degradation in opened containers
- `processLiquidSpillage(player)` - Handles liquid leakage from unsealed containers
- `getItemsAt(x, y)` - Gets items at specific coordinates

**Food Spoilage System:**
- Only affects food items in **opened** containers
- Progressive contamination tracked in `state.contaminationLevel`
- Spoilage rates (per turn):
  - Protein foods (meat, beans): 0.03 (~10 turns to contaminate)
  - Liquid foods (soup): 0.05 (~6 turns to contaminate)
  - Default: 0.04
- Contamination threshold: 0.3 (becomes `state.contaminated = true`)
- Creates strategic pressure to consume opened food quickly

**Liquid Spillage System:**
- Only affects drinks in **opened and unsealed** containers
- Spillage rate: 7ml per turn
- Bottles can be resealed to stop spillage (plastic containers)
- Cans cannot be resealed (metal containers)
- Empty items automatically removed from container
- Creates strategic choice: reseal bottles or risk losing contents

**Turn Processing Order:**
```javascript
processTurn() {
    processFoodSpoilage(player);    // Food degrades
    processLiquidSpillage(player);  // Liquids leak
    // Process entity turns...
}
```

---

## System Interactions

### Food & Hunger System Flow

```
Player Turn
    ↓
Player.processStatusEffects()
    ↓
Hunger -= 0.1, Thirst -= 0.2
    ↓
If hunger/thirst <= 0 → Apply HP damage
    ↓
Process other status effects (heal, sickness)
```

### Opening Container Flow

```
Player clicks [Actions] → [Open]
    ↓
UIManager.showOpenToolSelection()
    ↓
ItemSystem.getAvailableOpeningTools()
    ↓
Player selects tool
    ↓
ItemSystem.openContainer()
    ↓
Apply yield percentage to contents
    ↓
Spilled items get contaminated state
    ↓
Apply durability damage to tool
    ↓
Update UI
```

### Consuming Food Flow

```
Player clicks [Actions] → [Consume]
    ↓
UIManager.handleConsumeAction()
    ↓
Check if item is in sealed container → Block if sealed
    ↓
If contaminated → Show warning modal
    ↓
UIManager.executeConsumeAction()
    ↓
ItemSystem.consumeFood(item, player, amount=null)
    ↓
If amount is null → calculateOptimalConsumption()
    ↓
Calculate hunger/thirst needed
    ↓
Calculate optimal amount to consume
    ↓
Consume optimal amount or all if won't fill
    ↓
Apply nutrition (hunger/thirst restoration)
    ↓
If contaminated → Calculate sickness
    ↓
Apply ironStomach trait resistance
    ↓
Add sickness status effect if applicable
    ↓
Reduce item quantity or remove if empty
    ↓
Update UI and refresh inventory display
```

### Healing Flow

```
Player uses medkit
    ↓
UIManager.handleUseAction()
    ↓
Calculate healPerTurn from item.healAmount / item.healDuration
    ↓
Apply slowHealer trait modifier (×0.5 if present)
    ↓
Player.addStatusEffect({ type: 'heal', value, duration })
    ↓
Each turn: Player.processStatusEffects()
    ↓
Apply heal value to HP (capped at maxHP)
    ↓
Decrement duration
    ↓
Remove effect when duration reaches 0
```

### Trait Effect Propagation

```
Character Creation
    ↓
CharacterCreationSystem.applyTraitsToCharacter()
    ↓
Merge trait.effect into player.traitEffects
    ↓
Systems check player.traitEffects:
    - Player.getMaxHP() → checks maxHPMod
    - Player.getMaxCarryWeight() → checks carryMod
    - Anatomy.getVisionRange() → checks visionBonus/visionPenalty
    - EquipmentSystem.getActionCostModifier() → checks actionCostMod
    - UIManager.handleUseAction() → checks healingMod
    - ItemSystem.consumeFood() → checks poisonResist
```

---

## Data Flow

### Turn Processing

```
Game.processTurn(action)
    ↓
Player performs action (move, pickup, use item, etc.)
    ↓
If player acted:
    - turnCount++
    - player.processStatusEffects()
    - updateFoV()
    - world.processTurn()
    - soundSystem.processTurn()
    - checkGameOver()
    ↓
Render updated game state
```

### Item Creation

```
ContentManager.createItem(familyId, materialId, modifierId)
    ↓
Copy item family definition
    ↓
Apply material properties (color, durability, weight mod)
    ↓
Apply modifier properties (name prefix, weight mod)
    ↓
If sealed container → Add random contents
    ↓
Deep copy state object
    ↓
Return item instance
```

### World Generation

```
World.init()
    ↓
Generate chunks around spawn
    ↓
For each chunk:
    - Select biome (zone-based: urban_core, suburbs, industrial, etc.)
    - Generate clean terrain
    - Generate road network
    - Generate sewer system (z=-1)
    - Generate buildings along roads
        → Try prefab match (size + biome + door orientation)
        → Fallback to procedural rectangular building
    - Add obstacles and debris
    - Spawn items (building-aware loot tables)
```

### Prefab Building System
**Files:** `src/content/BuildingPrefabs.js`, `src/world/Chunk.js`

**Prefabs:** 9 validated ASCII layouts
- **Small:** studio_apartment (10×8), corner_store (12×10), pharmacy (10×10), garage (12×10)
- **Medium:** two_bedroom_apartment (16×14), small_office (14×14), clinic (16×14)
- **Large:** warehouse (20×20), large_apartment (20×18)

**Layout Symbols:**
- `#` = exterior wall, `|`/`-` = interior walls
- `+` = exterior door (WorldObject via createDoor, biome-based type, lock chance)
- `d` = interior door (WorldObject, always unlocked)
- `.` = floor, `<`/`>` = stairs, `~` = skip tile

**Door Types by Biome (`BIOME_DOOR_TYPES`):**
- urban_core: glass exterior, wood_basic interior
- suburbs/rural/forest/ruins: wood_basic both
- industrial: metal exterior, wood_basic interior
- rich_neighborhood: wood_reinforced exterior, wood_basic interior

**Prefab Selection:** `findMatchingPrefab(width, height, biome, doorSide)` — only matches when door should be on bottom (doorSide=2), ensuring doors face the road.

### Loot Table System
**File:** `src/content/LootTables.js`

**Room Types (16):**
- Residential: living, bedroom, kitchen, bathroom
- Commercial: store, backroom
- Office: office, reception
- Medical: store, storage, waiting, exam
- Industrial: garage_bay, garage_tools, warehouse_floor, warehouse_storage

**How It Works:**
```
Chunk.spawnItems(biome)
    ↓
Scan all floor tiles at z=0
    ↓
Group by tile.roomType
    ↓
For tagged tiles → generateRoomLoot(roomType, floorTiles)
    → Weighted random from room-specific item pools
    → Respects maxItems per room and spawnChance per tile
    ↓
For untagged tiles → OUTDOOR_LOOT (2% per-tile chance)
    → Sparse random items on roads/sidewalks/outdoors
```

**Each room type defines:**
- `spawnChance` — per-tile probability of attempting a spawn
- `maxItems` — cap per room instance
- `pools` — weighted list of `{ familyId, weight }` entries

---

## Status Effects

### Effect Types

**heal:**
- Applied by: Medkit
- Effect: Restores HP over time
- Modified by: `slowHealer` trait
- Duration: Item-specific (medkit = 4 turns)

**sickness:**
- Applied by: Contaminated food
- Effect: Damages HP over time
- Modified by: `ironStomach` trait
- Duration: Based on contamination level

### Status Effect Processing

Each turn in `Player.processStatusEffects()`:
1. Process hunger/thirst drain
2. Apply starvation/dehydration damage if needed
3. Iterate through active status effects
4. Apply effect value to HP
5. Decrement duration
6. Remove expired effects

---

## UI System

### Container Display Pattern (CONSISTENCY RULE)

**All containers use the same inline display pattern:**

1. **Pockets** (on wearable containers like coats, backpacks)
   - Display inline in inventory view
   - Show capacity, volume, and contents
   - Each item in pocket gets its own [Actions] button
   - Source type: `actions-pocket-item`

2. **Opened Containers** (cans, bottles, boxes)
   - Display inline in inventory view (same as pockets)
   - Show contents list with quantity and contamination warnings
   - Each item in container gets its own [Actions] button
   - Source type: `actions-container-item`

**Why this matters:**
- Consistency: Users interact with all container contents the same way
- No special cases: Food in cans works exactly like items in pockets
- Reusable code: Same event handlers and display logic

**Implementation:**
```javascript
// In renderInventoryTab() or showInspectModal()
if (item.state && item.state.opened && item.contents && item.contents.length > 0) {
    // Display contents inline with Actions buttons
    for (let ci = 0; ci < item.contents.length; ci++) {
        const contentItem = item.contents[ci];
        html += `<button data-action="actions-container-item" 
                         data-container-id="${item.id}" 
                         data-item-index="${ci}">Actions</button>`;
    }
}
```

### Modal Flow

```
Detailed Inventory (I key)
    ↓
Click [Actions] button on item
    ↓
UIManager.showActionsModal()
    ↓
Display context-aware actions:
    - Always: Inspect, Move, Drop, Throw
    - If sealed: Open
    - If food/drink: Consume
    - If consumable: Use
    ↓
Player selects action
    ↓
UIManager.handleItemAction()
    ↓
Route to specific handler
```

### Action Handlers

- `handleDropAction()` - Removes item from inventory, adds to ground
- `handleUseAction()` - Uses consumable (medkit, etc.)
- `showOpenToolSelection()` - Shows available opening methods
- `handleOpenAction()` - Opens container with selected tool
- `handleConsumeAction()` - Consumes food/drink
- `handleConsumeContentsAction()` - Consumes food from opened container

---

## Time System
**File:** `src/systems/TimeSystem.js`

**Purpose:** Manages day/night cycle and time-of-day tracking.

**Key Properties:**
- `currentTick` - Current tick count
- `ticksPerHour` - 30 ticks per game hour (1 turn ≈ 2 minutes)
- `hour` / `minute` - Current time of day

**Key Methods:**
- `tick()` - Advances time by one turn
- `getAmbientLight()` - Returns 0.0-1.0 light level based on time of day
- `getTimeOfDay()` - Returns period name (dawn, morning, noon, afternoon, dusk, night)
- `getFormattedTime()` - Returns "HH:MM" string

**Light Levels by Time:**
- Night (22:00-5:00): 0.05-0.1
- Dawn (5:00-7:00): 0.1-0.6
- Day (7:00-17:00): 0.8-1.0
- Dusk (17:00-20:00): 0.6-0.1
- Evening (20:00-22:00): 0.1-0.05

---

## Lighting System
**File:** `src/systems/LightingSystem.js`

**Purpose:** Calculates per-tile light levels from ambient and point sources, manages fuel consumption.

**Key Methods:**
- `calculate(px, py, pz, range)` - Calculates light levels for visible area
- `getEffectiveVisionRadius(baseRange)` - Modulates vision by ambient light + player light
- `isLightActive(item)` - Checks if light source is on and has fuel
- `consumeFuel()` - Drains batteries/fuel from active light sources each turn
- `getPlayerLightSources()` - Returns active light items in player's hands

**Light Source Types:**
- **Flashlight** - Cone-shaped, radius 12, uses batteries (durability drain), fuelPerTurn 0.02
- **Lantern** - Radial, radius 7, uses lantern_fuel (quantity drain), fuelPerTurn 0.03

**Fuel Consumption:**
- Batteries: `fuel.durability -= item.fuelPerTurn` per turn (removed at 0)
- Lantern fuel: `fuel.quantity -= item.fuelPerTurn * 10` per turn (removed at 0)

**Integration:**
- `Game.advanceTurn()` calls `lightingSystem.consumeFuel()` each turn
- `Game.updateFoV()` calls `lightingSystem.getEffectiveVisionRadius()` and `lightingSystem.calculate()`
- `TimeSystem.getAmbientLight()` provides base ambient level

---

## World Object System
**File:** `src/systems/WorldObjectSystem.js`

**Purpose:** Handles interactions with doors, furniture, and other world objects.

**Key Methods:**
- `performAction(worldObject, action, player)` - Routes to specific action handler
- `smashObject(object, player, weapon)` - Auto-completes: loops hits until destroyed or weapon breaks
- `disassembleObject(object, player, tool)` - Careful removal with full material yield
- `searchFurniture(object, player)` - Opens furniture contents transfer UI

**Smash Auto-Complete:**
- Loops damage until object HP reaches 0 or weapon durability reaches 0
- Reports summary: hit count, total turns, materials dropped, contents spilled
- Lock breaks at <30% HP
- All turns advance at once via `advanceTurn(totalTime)`

---

## Future Systems (Planned)

### Sleep/Rest System
- Will use `lightSleeper` trait
- Natural healing during rest
- Modified by `slowHealer` trait

### Loot System ✅ (Implemented)
- Building-aware spawning via room-type loot tables
- 16 room types with weighted item pools
- Outdoor loot at 2% per-tile chance
- Future: `lucky` trait for better quality/rare drops

### Combat System (Phase 2 — Next)
- Melee/ranged combat
- NPC behavior loops, aggro, factions
- Action cost modifiers from traits
- Weapon durability degradation

---

## Crafting System
**Files:** `src/systems/CraftingSystem.js`, `src/ui/CraftingUI.js`, `src/content/ContentManager.js`

**Purpose:** Manages component-based crafting and disassembly with quality mechanics.

### Core Concepts

**Component Property System:**
- Components have numeric properties (e.g., `cutting: 3`, `grip: 2`, `fastening: 1`)
- Recipes require minimum property values
- Multiple components can satisfy the same requirement
- Example: "Requires cutting +2" accepts Knife Blade (cutting: 3) or 2x Metal Shards (cutting: 1 each)

**Specific Component Requirements:**
- Some recipes require exact component types (e.g., `component: 'fabric_panel'`)
- Matched by `componentId` field, not properties
- Example: Backpack requires exactly 2 Strap components, not just any item with binding property

**Mixed Requirements:**
- Recipes can combine both requirement types
- Example: Backpack needs specific fabric_panel + strap components AND any fasteners with fastening +2

### Component Properties

**Available Properties:**
```javascript
cutting: 1-3      // Sharp edges (Metal Shard: 1, Blade: 3)
piercing: 1-2     // Sharp points (Metal Shard: 1, Blade: 2)
grip: 1-3         // Handle quality (Cloth Wrap: 1, Handle: 3)
fastening: 1-3    // Fastener strength (Button: 1, Zipper: 2, Bolt: 3)
binding: 1-3      // Binding strength (Thread: 1, Wire: 2, Strap: 3)
structural: 1-3   // Support strength (Handle: 1, Metal Tube: 2)
padding: 1-3      // Cushioning (Cloth Wrap: 1, Fabric Panel: 2)
medical: 1-3      // Medical value (Bandage: 1, Antiseptic: 2)
container: 1-3    // Container capacity (Metal Casing: 1)
chemical: 1-3     // Chemical potency (Antiseptic: 1, Acid: 2)
conductor: 1-3    // Electrical conductivity (Wire: 1, Carbon Rod: 2)
electrical: 1-3   // Electrical complexity (Wire: 1, Circuit: 2)
insulation: 1-3   // Insulation quality (Fabric Panel: 1)
```

### Quality & Durability System

**Component Quality:**
- All components have quality value (0-100)
- Quality degrades during disassembly based on tool
- Quality affects crafted item durability

**Disassembly Quality Modifiers:**
```javascript
qualityMod values in disassemblyMethods:
- Hand: 0.60-0.75 (loses 25-40% quality)
- Knife: 0.80-0.90 (loses 10-20% quality)  
- Proper tool: 0.85-1.00 (loses 0-15% quality)
```

**Crafting Quality Calculation:**
```javascript
// Average all component qualities
const avgQuality = componentsUsed.reduce((sum, c) => sum + c.quality, 0) / componentsUsed.length;
craftedItem.durability = Math.floor(avgQuality);
```

**Quality Degradation Loop:**
```
1. Find pristine knife (100% durability)
2. Disassemble with hands (qualityMod: 0.6)
   → Components: 60 quality
3. Craft new knife from degraded parts
   → New knife: 60% durability
4. Disassemble again
   → Components: 36 quality (60 * 0.6)
5. Eventually unusable
```

### Component Matching Logic

**Property-Based Matching:**
```javascript
// Requirement: { property: 'cutting', minValue: 2, quantity: 1 }
matchingComponents = availableComponents.filter(comp => {
    const properties = comp.properties || {};
    return properties['cutting'] >= 2;
});
```

**Specific Component Matching:**
```javascript
// Requirement: { component: 'fabric_panel', quantity: 3 }
matchingComponents = availableComponents.filter(comp => 
    comp.componentId === 'fabric_panel' || 
    comp.id.startsWith('fabric_panel')
);
```

### Component Creation

**From Disassembly:**
```javascript
CraftingSystem.createComponentItem(compDef, quality, quantity) {
    return {
        id: `${compDef.id}_${Date.now()}_${Math.random()}`,
        componentId: compDef.id,           // For matching
        name: compDef.name,
        type: 'component',
        properties: componentTemplate.properties || {},  // Copy properties
        quality: quality,
        quantity: quantity,
        isComponent: true
    };
}
```

**From Crafting:**
```javascript
ContentManager.createItem(familyId) {
    // If component-type item, add componentId and properties
    if (family.type === 'component' && this.components[familyId]) {
        item.componentId = familyId;
        item.properties = this.components[familyId].properties || {};
        item.isComponent = true;
    }
}
```

### Recipe Structure

**Property-Based Recipe (Shiv):**
```javascript
shiv: {
    componentRequirements: [
        { property: 'cutting', minValue: 1, quantity: 1, name: 'Sharp Edge' },
        { property: 'grip', minValue: 1, quantity: 1, name: 'Handle/Grip' }
    ],
    components: [
        { id: 'scrap_metal_shard', quantity: 1, quality: 100 },
        { id: 'cloth_wrap', quantity: 1, quality: 100 }
    ],
    disassemblyMethods: {
        hand: { componentYield: 1.0, qualityMod: 0.7, timeRequired: 1 },
        knife: { componentYield: 1.0, qualityMod: 0.9, timeRequired: 1 }
    }
}
```

**Mixed Recipe (Backpack):**
```javascript
backpack: {
    componentRequirements: [
        { component: 'fabric_panel', quantity: 3, name: 'Fabric Panel' },  // Specific
        { component: 'strap', quantity: 2, name: 'Strap' },                // Specific
        { property: 'fastening', minValue: 2, quantity: 2, name: 'Fasteners' },  // Property
        { component: 'thread', quantity: 1, name: 'Thread' }               // Specific
    ],
    components: [
        { id: 'fabric_panel', quantity: 3, quality: 100 },
        { id: 'strap', quantity: 2, quality: 100 },
        { id: 'buckle', quantity: 2, quality: 100 },
        { id: 'zipper', quantity: 2, quality: 100 },
        { id: 'thread', quantity: 1, quality: 100 }
    ],
    disassemblyMethods: {
        hand: { componentYield: 0.75, qualityMod: 0.6, timeRequired: 3, excludeComponents: ['thread'] },
        knife: { componentYield: 1.0, qualityMod: 0.85, timeRequired: 2 }
    }
}
```

### Key Methods

**CraftingSystem:**
- `getPlayerComponents(player)` - Gathers all components from equipped, carried, stored, and ground
- `canCraftItem(player, itemFamilyId)` - Checks if player has required components
- `craftItem(player, itemFamilyId)` - Consumes components and creates item
- `canDisassembleItem(item)` - Checks if item has components array
- `disassembleItem(item, tool, player)` - Breaks item into components with quality loss
- `createComponentItem(compDef, quality, quantity)` - Creates component with properties

**Component Gathering:**
```javascript
getPlayerComponents(player) {
    const components = [];
    
    // 1. Equipped items
    for (const slot in player.equipment) {
        if (item && item.isComponent) components.push(item);
    }
    
    // 2. Carried items (hands)
    if (player.carrying.leftHand?.isComponent) components.push(...);
    if (player.carrying.rightHand?.isComponent) components.push(...);
    
    // 3. Stored items (pockets/containers)
    const storedItems = player.containerSystem.getAllStoredItems(player);
    for (const stored of storedItems) {
        if (stored.item.isComponent) components.push(stored.item);
    }
    
    // 4. Ground items at player location
    const groundItems = world.getItemsAt(player.x, player.y, player.z);
    for (const item of groundItems) {
        if (item.isComponent) components.push(item);
    }
    
    return components;
}
```

### Disassembly Methods

**Structure:**
```javascript
disassemblyMethods: {
    hand: {
        componentYield: 0.75,           // 75% of components returned
        qualityMod: 0.6,                // Components at 60% quality
        timeRequired: 3,                // Takes 3 turns
        excludeComponents: ['thread']   // Thread is lost
    },
    knife: {
        componentYield: 1.0,            // 100% of components returned
        qualityMod: 0.85,               // Components at 85% quality
        timeRequired: 1                 // Takes 1 turn
    }
}
```

**Exclude Options:**
- `excludeComponents: ['thread', 'rivet']` - Specific components lost
- `excludeProperties: ['fastening']` - All components with property lost

### UI Integration

**Workshop Panel (V key):**
- Shows all craftable items
- Displays requirement status (have/need)
- Lists valid components for property requirements
- Shows disassemblable items

**Crafting UI:**
```javascript
showRecipeDetails(itemFamilyId) {
    // For each requirement
    if (requirement.component) {
        // Show specific component requirement
        html += `Requires: ${requirement.name} (x${requirement.quantity})`;
    } else if (requirement.property) {
        // Show property requirement + valid items
        html += `Requires: ${requirement.property} +${requirement.minValue}`;
        html += `Valid items: ${allMatchingItems.join(', ')}`;
    }
}
```

### Equipment Integration

**Back Slot:**
- Added to `Player.equipment` object
- Backpack equips to `back` slot
- `EquipmentSystem.getValidSlotsForItem()` recognizes 'back' slot type
- `EquipmentSystem.getSlotDisplayName()` shows "Back"

**Container Access:**
- Equipped items with pockets accessible via `ContainerSystem.getAllStoredItems()`
- Backpack pockets appear in "Stored Items" section when equipped
- Items can be moved to/from backpack pockets

### Strategic Implications

**Quality Management:**
- Use proper tools to preserve component quality
- Knife is best general-purpose disassembly tool (0.85-0.9 quality retention)
- Hand disassembly degrades quality significantly (0.6-0.75)
- Fresh items are valuable - quality loss is permanent

**Component Economy:**
- Disassemble found items for components
- Craft needed items from components
- Quality degrades with each craft/disassemble cycle
- Eventually need to find fresh items

**Recipe Design:**
- Property-based requirements allow flexibility
- Specific component requirements ensure exact items
- Mixed requirements balance flexibility and specificity

---

## Debugging & Testing

### Trait Testing Checklist

- [ ] `weakConstitution` - Check max HP is reduced by 10
- [ ] `packRat` - Check carry capacity increased by 20%
- [ ] `slowHealer` - Use medkit, verify heal is halved
- [ ] `ironStomach` - Eat contaminated food, verify reduced sickness
- [ ] `quickReflexes` - Check action cost modifier
- [ ] `clumsy` - Check action cost modifier
- [ ] `nightVision` - Check vision range increased by 2
- [ ] `nearSighted` - Check vision range decreased by 2

### System Integration Tests

- [ ] Open can with different tools, verify yield percentages
- [ ] Eat contaminated food, verify sickness applied
- [ ] Use medkit with slowHealer trait, verify reduced healing
- [ ] Consume partial food, verify quantity tracking
- [ ] Split food item, verify weight/volume recalculation

---

## Performance Considerations

### Optimization Points

1. **FoV Calculation** - Only recalculate when player moves
2. **Status Effects** - Process only active effects
3. **Container Searches** - Cache stored item lists
4. **Trait Checks** - Single object lookup, not array iteration

### Memory Management

- Deep copy item states to avoid shared references
- Remove expired status effects immediately
- Clean up dropped items from world when appropriate

---

## Extension Guidelines

### Adding a New Trait

1. Define in `CharacterCreationSystem.js` traits object
2. Add effect property (e.g., `{ myNewMod: 1.5 }`)
3. Find relevant system that should use the trait
4. Add check for `player.traitEffects.myNewMod`
5. Apply modifier to calculation
6. Test with and without trait

### Adding a New Item Type

1. Define in `ContentManager.js` itemFamilies
2. Add glyph, color, type, tags
3. Add to weight/volume defaults
4. If container, define openMethods
5. If consumable, define nutrition
6. Add to world generation spawn list
7. Test spawning and interactions

### Adding a New System

1. Create system file in `src/systems/`
2. Initialize in `Game.js` startGame()
3. Add integration points in relevant systems
4. Check for trait modifiers where applicable
5. Update this documentation
6. Add to turn processing if needed

---

## Item Addition Workflows

### How to Add a New Food Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the item in `itemFamilies` object**
```javascript
my_new_food: {
    name: 'My New Food',
    type: 'food',              // 'food' for solid foods
    glyph: 'f',                // Single character display
    color: '#ffaa00',          // Hex color code
    quantity: 250,             // Amount in grams
    quantityUnit: 'g',         // Unit (g for grams)
    nutrition: {
        hunger: 25,            // Total hunger restoration
        thirst: -5             // Negative = makes you thirsty
    },
    tags: ['food', 'protein'], // Tags affect spoilage rate
    state: {}                  // Empty state object
}
```

**Step 2: Add to weight/volume defaults (if needed)**
```javascript
const WEIGHT_DEFAULTS = {
    food: 250  // Default weight in grams
};

const VOLUME_DEFAULTS = {
    food: 200  // Default volume in ml
};
```

**Step 3: Add to container contents (if spawning in containers)**
```javascript
can_sealed: {
    // ...
    contents: [
        { family: 'beans', weight: 0.8 },
        { family: 'soup', weight: 0.15 },
        { family: 'my_new_food', weight: 0.05 }  // Add here
    ]
}
```

**Spoilage Rates by Tag:**
- `protein` tag: 0.03/turn (~10 turns)
- `liquid` tag: 0.05/turn (~6 turns)
- No tag: 0.04/turn (~7-8 turns)

**Nutrition Guidelines:**
- Hunger restoration: 15-35 per item
- Thirst: Positive for wet foods, negative for dry foods
- Per-gram calculation: `nutrition.hunger / quantity`

---

### How to Add a New Drink Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the item in `itemFamilies` object**
```javascript
my_new_drink: {
    name: 'My New Drink',
    type: 'drink',             // 'drink' for liquids
    glyph: '~',                // Single character display
    color: '#00aaff',          // Hex color code
    quantity: 350,             // Amount in milliliters
    quantityUnit: 'ml',        // Unit (ml for milliliters)
    nutrition: {
        thirst: 30,            // Total thirst restoration
        hunger: 5              // Optional hunger bonus
    },
    tags: ['drink', 'liquid'], // Tags for categorization
    state: {}                  // Empty state object
}
```

**Step 2: Add to bottle contents**
```javascript
bottle_sealed: {
    // ...
    contents: [
        { family: 'water', weight: 0.4 },
        { family: 'soda', weight: 0.3 },
        { family: 'juice', weight: 0.2 },
        { family: 'my_new_drink', weight: 0.1 }  // Add here
    ]
}
```

**Important: Drinks spill from unsealed containers at 7ml/turn**

---

### How to Add a New Tool Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the item in `itemFamilies` object**
```javascript
my_new_tool: {
    name: 'My New Tool',
    type: 'tool',              // Type: tool
    glyph: 't',                // Single character display
    color: '#888888',          // Hex color code
    weight: 500,               // Weight in grams
    volume: 300,               // Volume in ml
    durability: 100,           // Max durability
    tags: ['tool', 'metal'],   // Tags for categorization
    toolType: 'my_tool_type',  // Unique tool type identifier
    actions: []                // Available actions
}
```

**Step 2: Add to container opening methods (if it can open containers)**
```javascript
can_sealed: {
    // ...
    openMethods: {
        can_opener: { yield: 1.0, durabilityDamage: 0 },
        my_tool_type: { yield: 0.9, durabilityDamage: 3 }  // Add here
    }
}
```

**Step 3: Add to world generation spawn list**
```javascript
// In Chunk.js generateRandomItem()
const itemPool = [
    'pipe', 'knife', 'medkit', 'my_new_tool'  // Add here
];
```

**Tool Properties:**
- `durability`: How many uses before breaking
- `yield`: Percentage of contents preserved when opening (0.0-1.0)
- `durabilityDamage`: How much durability lost per use

---

### How to Add a New Container Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the container in `itemFamilies` object**
```javascript
my_container: {
    name: 'My Container',
    type: 'container',
    glyph: 'C',
    color: '#666666',
    isContainer: true,         // Required flag
    state: { 
        opened: false,         // Starts sealed
        sealed: true 
    },
    openMethods: {             // How to open it
        hand: { yield: 1.0, durabilityDamage: 0 },
        knife: { yield: 0.95, durabilityDamage: 2 }
    },
    contents: [                // What's inside (random selection)
        { family: 'item1', weight: 0.5 },
        { family: 'item2', weight: 0.5 }
    ],
    tags: ['container', 'plastic']  // 'plastic' = resealable
}
```

**Container Tags:**
- `plastic`: Can be resealed (bottles)
- `metal`: Cannot be resealed (cans)
- `sealed`: Starts sealed

**Container State:**
- `state.opened`: true/false - Has been opened
- `state.sealed`: true/false - Currently sealed (prevents spillage)

---

### How to Add a New Weapon Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the weapon in `itemFamilies` object**
```javascript
my_weapon: {
    name: 'My Weapon',
    type: 'weapon',
    glyph: '/',
    color: '#ff0000',
    weight: 1200,
    volume: 800,
    durability: 150,
    damage: {
        min: 5,
        max: 15
    },
    attackCost: 100,           // Action cost to attack
    range: 1,                  // Attack range in tiles
    tags: ['weapon', 'melee'], // or 'ranged'
    actions: ['equip', 'attack']
}
```

**Weapon Properties:**
- `damage.min/max`: Damage range
- `attackCost`: Action points to use
- `range`: How far it can attack
- `durability`: Uses before breaking

---

### How to Add a New Wearable/Armor Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the wearable in `itemFamilies` object**
```javascript
my_armor: {
    name: 'My Armor',
    type: 'wearable',
    glyph: '[',
    color: '#0088ff',
    weight: 2000,
    volume: 1500,
    slot: 'torso',             // 'head', 'torso', 'legs'
    defense: 5,                // Damage reduction
    durability: 200,
    pockets: [                 // Optional storage
        {
            name: 'Pocket',
            maxWeight: 1000,
            maxVolume: 500,
            contents: []
        }
    ],
    tags: ['wearable', 'armor'],
    actions: ['equip']
}
```

**Wearable Slots:**
- `head`: Helmets, hats, masks
- `torso`: Jackets, vests, shirts
- `legs`: Pants, shorts

**Pockets (Optional):**
- Add `pockets` array for storage containers
- Each pocket has `maxWeight`, `maxVolume`, `contents`

---

## Quick Reference: Files to Touch When Adding Items

### Adding ANY Item:
1. **`src/content/ContentManager.js`** - Define item in `itemFamilies`
2. **`src/content/LootTables.js`** - Add to room-type loot pools (building spawns) and/or `OUTDOOR_LOOT` (outdoor spawns)

### Adding Food/Drink:
3. **`src/content/ContentManager.js`** - Add to container contents (cans/bottles)
4. **Check spoilage rates** - Ensure tags match desired spoilage behavior

### Adding Tools:
3. **`src/content/ContentManager.js`** - Add to container `openMethods` (if opener)
4. **`src/systems/ItemSystem.js`** - Add tool-specific logic (if special behavior)

### Adding Containers:
3. **`src/content/ContentManager.js`** - Define contents and opening methods
4. **`src/systems/ItemSystem.js`** - Verify opening logic handles new container

### Adding Weapons:
3. **`src/systems/CombatSystem.js`** - Add weapon-specific combat logic (when implemented)

### Adding Wearables:
3. **`src/systems/EquipmentSystem.js`** - Verify slot compatibility

---

## Item Property Reference

### Required Properties (All Items):
```javascript
{
    name: 'Item Name',         // Display name
    type: 'food',              // Item category
    glyph: 'i',                // Single character
    color: '#ffffff',          // Hex color
    tags: ['tag1', 'tag2']     // Categorization
}
```

### Optional Properties:
```javascript
{
    weight: 100,               // Grams (defaults by type)
    volume: 50,                // Milliliters (defaults by type)
    quantity: 250,             // Amount (food/drink)
    quantityUnit: 'g',         // 'g' or 'ml'
    durability: 100,           // Tool/weapon durability
    nutrition: {               // Food/drink only
        hunger: 20,
        thirst: 10
    },
    state: {},                 // Dynamic state (contamination, opened, etc.)
    isContainer: true,         // Container flag
    contents: [],              // Container contents
    openMethods: {},           // How to open container
    pockets: [],               // Wearable storage
    slot: 'torso',             // Equipment slot
    defense: 5,                // Armor value
    damage: { min: 5, max: 10 }, // Weapon damage
    actions: []                // Available actions
}
```

---

## Testing Checklist for New Items

### Food Items:
- [ ] Item spawns in world or containers
- [ ] Quantity displays correctly
- [ ] Nutrition values restore hunger/thirst appropriately
- [ ] Spoilage rate matches tag (protein/liquid/default)
- [ ] Freshness indicator shows correct colors
- [ ] Smart consumption calculates optimal amount
- [ ] Empty items are removed from containers

### Drink Items:
- [ ] Item spawns in bottles
- [ ] Quantity displays in ml
- [ ] Thirst restoration works correctly
- [ ] Spillage occurs at 7ml/turn when unsealed
- [ ] Resealing stops spillage (bottles only)
- [ ] Empty items are removed from containers

### Tool Items:
- [ ] Item spawns in world
- [ ] Can be equipped/carried
- [ ] Durability decreases with use
- [ ] Opening containers works with correct yield
- [ ] Tool breaks when durability reaches 0

### Container Items:
- [ ] Starts sealed with correct state
- [ ] Opening methods work correctly
- [ ] Contents spawn with correct yield
- [ ] Spilled items become contaminated
- [ ] Resealing works (plastic only)
- [ ] Contents display inline with Actions buttons

### Weapon Items:
- [ ] Item spawns in world
- [ ] Can be equipped
- [ ] Damage values are balanced
- [ ] Attack cost is reasonable
- [ ] Durability decreases with use

### Wearable Items:
- [ ] Item spawns in world
- [ ] Equips to correct slot
- [ ] Defense bonus applies
- [ ] Pockets function correctly (if present)
- [ ] Unequipping works properly
