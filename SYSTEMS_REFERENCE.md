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
    - Select biome (ruins, industrial, wasteland)
    - Generate tiles based on biome
    - Spawn random items (5% chance per tile)
    ↓
Chunk.generateRandomItem()
    ↓
Select random item family
    ↓
If food/tool → Create without material/modifier
    ↓
Else → Create with random material and modifier
```

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

## Future Systems (Planned)

### Sleep/Rest System
- Will use `lightSleeper` trait
- Natural healing during rest
- Modified by `slowHealer` trait

### Loot System
- Will use `lucky` trait
- Better quality items
- More frequent rare drops

### Crafting System
- Combine items to create new items
- Tool requirements with alternatives
- Quality affected by tools used

### Combat System
- Action cost modifiers from traits
- Cybernetic enhancements
- Weapon durability degradation

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
2. **`src/world/Chunk.js`** - Add to spawn pool (if spawning in world)

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
