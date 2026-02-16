# Crafting Database - Master Reference

**Last Updated:** February 15, 2026 (v19 Crafting Overhaul)  
**Status:** Tier gating, craftable intermediates, raw materials, sub-recipe UI

---

## Table of Contents
1. [Crafting System Overview](#crafting-system-overview)
2. [Crafting Tier System](#crafting-tier-system)
3. [Component Property System](#component-property-system)
4. [Quality & Durability Mechanics](#quality--durability-mechanics)
5. [Current Game Items](#current-game-items)
6. [Component Library](#component-library)
7. [Crafting Recipes](#crafting-recipes)
8. [Disassembly Outcomes](#disassembly-outcomes)
9. [Weapon Stats (All Items)](#weapon-stats-all-items)

---

## Crafting System Overview

### How Crafting Works

The crafting system uses **component properties** and **specific component requirements** to create items:

**Property-Based Requirements:**
- Items require components with specific properties (e.g., `cutting`, `grip`, `fastening`)
- Multiple components can satisfy the same requirement if they have the property
- Example: "Requires cutting +2" can be satisfied by a Crude Blade (cutting: 2) or Knife Blade (cutting: 3)

**Tier Gating (maxValue):**
- Requirements can specify a `maxValue` to **exclude** high-tier components
- Example: Shiv requires `cutting: 1, maxValue: 1` — Metal Shard (1) works, Crude Blade (2) does NOT
- This prevents wasting good components on low-tier recipes

**Specific Component Requirements:**
- Some items require exact components (e.g., "Requires 2x Strap")
- Only components with matching `componentId` will satisfy these
- Example: Backpack requires exactly 2 Strap components, not just items with binding property

**Craftable Intermediates:**
- Some recipes produce **components** that are used in higher-tier recipes
- Example: Crude Blade (cutting: 2) is crafted from Metal Shard + Stone, then used to craft a Knife
- The UI shows "⚒ Craft" buttons on sub-recipes for drill-down navigation

**Mixed Requirements:**
- Most items use both types (e.g., Backpack needs specific fabric panels AND any fasteners with fastening +2)

### Component Matching

Components are matched by:
1. **Component ID** - Exact match for specific requirements (e.g., `fabric_panel`, `strap`)
2. **Properties** - Numeric values for flexible requirements (e.g., `cutting: 3`, `grip: 2`)
3. **craftedProperties** - Checked first on crafted intermediates (e.g., Crude Blade has `craftedProperties.cutting: 2`)
4. **Tags** - Categories for filtering (e.g., `metal`, `fabric`, `medical`)

---

## Crafting Tier System

### Crafting Tree
```
Tier 0: RAW MATERIALS (found in world)
├── Stone, Wood Piece, Glass Shard, Metal Shard, Bone Shard
├── Cloth Wrap, Leather Piece, Rubber Piece, Duct Tape
├── Nail, Wire, Thread, Fabric Panel
└── Can Lid, Screw Cap, Bottle Cap

Tier 1: INTERMEDIATES (crafted from raw materials)
├── Crude Blade (cutting:2) ← Metal/Glass + Stone [3 turns]
├── Sharpened Stick (piercing:1) ← Wood + Stone [2 turns]
├── Wrapped Handle (grip:2) ← Wood/Bone + Cloth/Tape/Leather [1 turn]
└── Strap (binding:3) ← Fabric/Leather [1 turn]

Tier 2: BASIC ITEMS (raw materials only)
├── Shiv (cutting:1 MAX:1, grip:1) [1 turn]
└── (other simple items)

Tier 3: STANDARD ITEMS (intermediates required)
├── Knife (cutting:2+, grip:2+, fastening:1 x2) [2 turns]
├── Canteen (container:1, fastening:1, binding:2) 
└── Medkit (medical:1 x6)

Tier 4: ADVANCED ITEMS (multiple intermediates + specifics)
├── Backpack (3x fabric_panel, 2x strap, fastening:2 x2, thread)
├── Trenchcoat (padding:1 x4, fastening:1 x7, binding:1)
└── Coat, Pants
```

### Tier Gating Examples
```
SHIV requires cutting: 1, maxValue: 1
  ✓ Metal Shard (cutting: 1)     — cheap, intended
  ✓ Glass Shard (cutting: 1)     — cheap, intended
  ✓ Can Lid (cutting: 1)         — cheap, intended
  ✗ Crude Blade (cutting: 2)     — too good, blocked
  ✗ Knife Blade (cutting: 3)     — way too good, blocked
  ✗ Cutting Wheel (cutting: 2)   — too good, blocked

KNIFE requires cutting: 2 (no maxValue)
  ✓ Crude Blade (cutting: 2)     — crafted intermediate
  ✓ Knife Blade (cutting: 3)     — from disassembly
  ✓ Cutting Wheel (cutting: 2)   — from disassembly
  ✗ Metal Shard (cutting: 1)     — too weak
  ✗ Glass Shard (cutting: 1)     — too weak
```

### Raw Material Sources
```
Outdoors:     Stone(common), Wood(common), Glass Shard, Metal Shard, Bone Shard(rare)
Residential:  Glass Shard, Cloth Wrap, Duct Tape
Garage/Tools: Metal Shard, Nail, Wire, Duct Tape, Wood, Rubber
Warehouse:    Metal Shard, Wood, Nail, Wire
Disassembly:  All components from breaking down items
```

---

## Component Property System

### Property Categories

#### **Cutting Properties**
```
cutting: 1  - Sharp edge (Metal Shard, Can Lid)
cutting: 2  - Good blade (Scissors blade)
cutting: 3  - Quality blade (Knife Blade)
```

#### **Piercing Properties**
```
piercing: 1  - Sharp point (Metal Shard)
piercing: 2  - Strong point (Knife Blade, Awl)
```

#### **Grip Properties**
```
grip: 1  - Basic grip (Cloth Wrap, Metal Tube)
grip: 2  - Good grip (Rubber grip)
grip: 3  - Quality grip (Handle, Ergonomic grip)
```

#### **Fastening Properties**
```
fastening: 1  - Simple fastener (Rivet, Button, Thread)
fastening: 2  - Strong fastener (Screw, Zipper, Buckle)
fastening: 3  - Heavy-duty fastener (Bolt, Industrial buckle)
```

#### **Binding Properties**
```
binding: 1  - Light binding (Cloth Wrap, Thread, Fabric Panel)
binding: 2  - Medium binding (Wire, Rope)
binding: 3  - Strong binding (Strap, Cable)
```

#### **Structural Properties**
```
structural: 1  - Light support (Handle, Strap, Metal Casing)
structural: 2  - Medium support (Metal Tube, Frame)
structural: 3  - Heavy support (Beam, Reinforced frame)
```

#### **Padding Properties**
```
padding: 1  - Light padding (Cloth Wrap)
padding: 2  - Medium padding (Fabric Panel)
padding: 3  - Heavy padding (Foam, Cushion)
```

#### **Medical Properties**
```
medical: 1  - Basic medical (Bandage)
medical: 2  - Advanced medical (Antiseptic, Painkiller)
medical: 3  - Surgical (Suture kit, Scalpel)
```

#### **Container Properties**
```
container: 1  - Small container (Metal Casing, Plastic Case)
container: 2  - Medium container (Bottle, Can)
container: 3  - Large container (Barrel, Crate)
```

#### **Chemical Properties**
```
chemical: 1  - Mild chemical (Antiseptic)
chemical: 2  - Active chemical (Electrolyte Paste, Acid)
chemical: 3  - Dangerous chemical (Corrosive, Explosive)
```

#### **Conductor Properties**
```
conductor: 1  - Poor conductor (Wire, Carbon)
conductor: 2  - Good conductor (Carbon Rod, Copper wire)
conductor: 3  - Excellent conductor (Gold wire, Superconductor)
```

#### **Electrical Properties**
```
electrical: 1  - Basic electrical (Wire, Simple circuit)
electrical: 2  - Advanced electrical (Circuit board, Capacitor)
electrical: 3  - Complex electrical (Processor, Advanced circuit)
```

#### **Insulation Properties**
```
insulation: 1  - Light insulation (Fabric Panel)
insulation: 2  - Medium insulation (Rubber, Foam)
insulation: 3  - Heavy insulation (Thermal padding)
```

---

## Quality & Durability Mechanics

### How Quality Works

**Component Quality:**
- All components have a quality value (0-100)
- Quality affects component effectiveness in recipes
- Quality degrades during disassembly based on tool used

**Disassembly Quality Loss:**
```
Tool Quality Modifiers:
- Hand disassembly:  0.60-0.75 (40-25% quality loss)
- Knife disassembly: 0.80-0.90 (20-10% quality loss)
- Proper tool:       0.85-1.00 (15-0% quality loss)
```

**Crafting Quality:**
```
Crafted Item Durability = Average(all component qualities)

Example:
- Blade (quality: 80)
- Handle (quality: 60)
- Rivet x2 (quality: 100)

Crafted Knife Durability = (80 + 60 + 100 + 100) / 4 = 85%
```

**Quality Degradation Loop:**
```
1. Find pristine knife (100% durability)
2. Disassemble with hands (qualityMod: 0.6)
   → Blade: 60 quality
   → Handle: 60 quality
   → Rivets lost (excludeComponents)

3. Craft new knife from degraded parts
   → New knife: 60% durability

4. Disassemble again with knife tool (qualityMod: 0.85)
   → Blade: 51 quality (60 * 0.85)
   → Handle: 51 quality

5. Eventually components become too degraded to use
```

**Strategic Implications:**
- **Use proper tools** to preserve component quality
- **Knife tool is best** for most disassembly (0.85-1.0 quality retention)
- **Fresh items are valuable** - degradation is permanent
- **Plan disassembly carefully** - you can't recover lost quality

---

## Current Game Items

### Weapons
- **Shiv** - Improvised blade (1d4 damage)
- **Knife** - Standard blade (1d6 damage)
- **Pipe** - Metal club (1d8 damage)

### Tools
- **Can Opener** - Opens cans perfectly
- **Battery** - Power source

### Armor/Clothing
- **Trenchcoat** - 1 defense, 3 pockets
- **Coat** - 1 defense, 3 pockets
- **Pants** - 0 defense, 3 pockets

### Containers
- **Backpack** - 3 pockets (Main: 8kg/12L, Front: 2kg/3L, Side: 1kg/1.5L) - Equips to Back slot
- **Canteen** - 1kg, 1L capacity (liquids only)
- **Sealed Can** - Requires opening
- **Sealed Bottle** - Twist cap

### Medical
- **Medkit** - Heals 20 HP over 4 turns

### Food
- **Beans** - 400g, +30 hunger, -5 thirst
- **Soup** - 350g, +25 hunger, +10 thirst
- **Mystery Meat** - 300g, +35 hunger, -10 thirst

### Drinks
- **Water** - 500ml, +40 thirst
- **Soda** - 350ml, +25 thirst, +5 hunger
- **Juice** - 400ml, +35 thirst, +10 hunger

---

## Component Library

### Metal Components
```
scrap_metal_shard
├─ Weight: 50g | Volume: 30cm³
├─ Properties: cutting: 1, piercing: 1
├─ Tags: metal, sharp
├─ Uses: Shiv blade, Crude Blade ingredient
└─ Source: Loot (garages, warehouses, outdoors), smashing metal items

metal_tube
├─ Weight: 200g | Volume: 150cm³
├─ Properties: structural: 2, blunt: 1, grip: 1
├─ Tags: metal, structural
├─ Uses: Pipe weapon, structural support
└─ Source: Pipe disassembly, furniture, plumbing

blade (Knife Blade)
├─ Weight: 80g | Volume: 50cm³
├─ Properties: cutting: 3, piercing: 2
├─ Tags: metal, sharp
├─ Uses: Knife (cutting:2+ requirement)
└─ Source: Knife disassembly ONLY

blade_wheel (Cutting Wheel)
├─ Weight: 30g | Volume: 20cm³
├─ Properties: cutting: 2, piercing: 1
├─ Tags: metal, sharp, tool
├─ Uses: Knife (cutting:2+ requirement)
└─ Source: Can Opener disassembly

rivet
├─ Weight: 5g | Volume: 2cm³
├─ Properties: fastening: 1
├─ Tags: metal, fastener
├─ Uses: Light fastening, metal assembly
└─ Source: Metal items, tools, furniture

screw
├─ Weight: 3g | Volume: 1cm³
├─ Properties: fastening: 2
├─ Tags: metal, fastener
├─ Uses: Strong fastening, electronics
└─ Source: Electronics, furniture, tools

wire
├─ Weight: 10g | Volume: 5cm³
├─ Properties: binding: 2, electrical: 1
├─ Tags: metal, flexible
├─ Uses: Binding, electrical connections
└─ Source: Loot (garages, warehouses), electronics

metal_casing
├─ Weight: 15g | Volume: 8cm³
├─ Properties: container: 1, structural: 1
├─ Tags: metal, container
├─ Uses: Small containers, casings
└─ Source: Battery disassembly

tin_can
├─ Weight: 50g | Volume: 80cm³
├─ Properties: container: 1
├─ Tags: metal, container
├─ Uses: Container crafting
└─ Source: Sealed Can disassembly

can_lid
├─ Weight: 10g | Volume: 10cm³
├─ Properties: cutting: 1
├─ Tags: metal, sharp
├─ Uses: Shiv blade (cutting:1 maxValue:1)
└─ Source: Sealed Can disassembly

metal_bottle
├─ Weight: 150g | Volume: 250cm³
├─ Properties: container: 2
├─ Tags: metal, container, liquid
├─ Uses: Canteen crafting
└─ Source: Canteen disassembly

nail
├─ Weight: 5g | Volume: 2cm³
├─ Properties: piercing: 1, fastening: 1
├─ Tags: metal, sharp, fastener
├─ Uses: Fastening, Knife recipe
└─ Source: Loot (garages, warehouses)
```

### Raw Materials (New in v19)
```
glass_shard
├─ Weight: 15g | Volume: 10cm³
├─ Properties: cutting: 1, piercing: 1
├─ Tags: glass, sharp
├─ Uses: Shiv blade, Crude Blade ingredient
└─ Source: Loot (residential, kitchens, outdoors)

wood_piece
├─ Weight: 80g | Volume: 100cm³
├─ Properties: structural: 1, grip: 1, fuel: 1
├─ Tags: wood, structural
├─ Uses: Wrapped Handle, Sharpened Stick, fuel
└─ Source: Loot (garages, warehouses, outdoors)

stone
├─ Weight: 200g | Volume: 80cm³
├─ Properties: blunt: 2, grinding: 2
├─ Tags: stone, blunt
├─ Uses: Crude Blade (grinding surface), Sharpened Stick
└─ Source: Loot (outdoors, common)

bone_shard
├─ Weight: 20g | Volume: 15cm³
├─ Properties: piercing: 1, structural: 1
├─ Tags: bone, sharp
├─ Uses: Wrapped Handle core, piercing
└─ Source: Loot (outdoors, rare)

rubber_piece
├─ Weight: 30g | Volume: 40cm³
├─ Properties: grip: 2, padding: 1, insulation: 2
├─ Tags: rubber, flexible
├─ Uses: Knife handle (grip:2), insulation
└─ Source: Loot (garages)

duct_tape
├─ Weight: 40g | Volume: 30cm³
├─ Properties: binding: 2, fastening: 1, grip: 1
├─ Tags: adhesive, flexible
├─ Uses: Wrapping, fastening, grip
└─ Source: Loot (garages, residential, offices)
```

### Fabric Components
```
fabric_panel
├─ Weight: 100g | Volume: 200cm³
├─ Properties: padding: 2, insulation: 1, binding: 1
├─ Tags: fabric, flexible
├─ Uses: Clothing, bags, padding, Strap crafting
└─ Source: Clothing disassembly, backpacks, curtains

cloth_wrap
├─ Weight: 20g | Volume: 30cm³
├─ Properties: grip: 1, padding: 1, binding: 1
├─ Tags: fabric, flexible
├─ Uses: Shiv grip, Wrapped Handle wrapping, bandages
└─ Source: Loot (residential), clothing disassembly

thread
├─ Weight: 5g | Volume: 10cm³
├─ Properties: binding: 1, fastening: 1
├─ Tags: fabric, binding
├─ Uses: Sewing, light fastening
└─ Source: Clothing disassembly

leather_piece
├─ Weight: 20g | Volume: 40cm³
├─ Properties: grip: 2, padding: 1, binding: 1
├─ Tags: leather, flexible
├─ Uses: Knife handle (grip:2), Wrapped Handle wrapping
└─ Source: Leather items disassembly

strap (CRAFTABLE)
├─ Weight: 50g | Volume: 80cm³
├─ Properties: binding: 3, structural: 1
├─ Tags: fabric, flexible, structural
├─ Uses: Backpacks, Canteen, load-bearing
└─ Source: Backpack disassembly OR craft from Fabric/Leather [1 turn]
```

### Plastic Components
```
plastic_bottle
├─ Weight: 30g | Volume: 100cm³
├─ Properties: container: 1
├─ Tags: plastic, container, liquid
├─ Uses: Water storage
└─ Source: Sealed bottles

plastic_case
├─ Weight: 80g | Volume: 150cm³
├─ Properties: container: 1
├─ Tags: plastic, container
├─ Uses: Storage, protection
└─ Source: Medkit disassembly

bottle_cap
├─ Weight: 5g | Volume: 5cm³
├─ Properties: fastening: 1
├─ Tags: plastic, seal
├─ Uses: Sealing bottles
└─ Source: Sealed bottles

screw_cap
├─ Weight: 20g | Volume: 15cm³
├─ Properties: fastening: 1
├─ Tags: plastic, seal
├─ Uses: Sealing containers
└─ Source: Canteen disassembly

button
├─ Weight: 2g | Volume: 1cm³
├─ Properties: fastening: 1
├─ Tags: plastic, fastener
├─ Uses: Clothing fastening
└─ Source: Clothing disassembly

zipper
├─ Weight: 15g | Volume: 20cm³
├─ Properties: fastening: 2
├─ Tags: plastic, metal, fastener
├─ Uses: Clothing, bags, strong fastening
└─ Source: Clothing, backpack disassembly

buckle
├─ Weight: 20g | Volume: 15cm³
├─ Properties: fastening: 2, structural: 1
├─ Tags: plastic, metal, fastener
├─ Uses: Straps, belts, load-bearing fastening
└─ Source: Backpack, belt disassembly
```

### Generic Components
```
handle
├─ Weight: 40g | Volume: 60cm³
├─ Properties: grip: 3, structural: 1
├─ Tags: wood, plastic, grip
├─ Uses: Tools, weapons, quality grips
└─ Source: Knife disassembly, tool disassembly
```

### Medical Components
```
bandage
├─ Weight: 20g | Volume: 30cm³
├─ Properties: medical: 1
├─ Tags: medical, fabric
├─ Uses: Stop bleeding, wound care
└─ Source: Medkit disassembly

antiseptic
├─ Weight: 50g | Volume: 50cm³
├─ Properties: medical: 2, chemical: 1
├─ Tags: medical, liquid, chemical
├─ Uses: Prevent infection, sterilization
└─ Source: Medkit disassembly

painkiller
├─ Weight: 10g | Volume: 5cm³
├─ Properties: medical: 2
├─ Tags: medical, drug
├─ Uses: Pain reduction, shock treatment
└─ Source: Medkit disassembly
```

### Power Components
```
electrolyte_paste
├─ Weight: 8g | Volume: 5cm³
├─ Properties: chemical: 2
├─ Tags: chemical, power
├─ Uses: Battery repair (advanced)
└─ Source: Battery disassembly

carbon_rod
├─ Weight: 5g | Volume: 3cm³
├─ Properties: conductor: 2
├─ Tags: carbon, power
├─ Uses: Battery repair, electrodes
└─ Source: Battery disassembly
```

---

## Crafting Recipes

### Tier 1 - Intermediates (crafted from raw materials)

#### Crude Blade
```
CRAFT: Crude Blade (INTERMEDIATE COMPONENT)
═══════════════════════════════════════════════
Time: 3 turns
Provides: cutting: 2, piercing: 1

Requirements:
  • cutting +1 (x1) - "Metal/Glass (sharp edge to grind)"
    Valid: Metal Shard (1), Glass Shard (1), Can Lid (1)
  • grinding +1 (x1) - "Stone (grinding surface)"
    Valid: Stone (2)

Output:
  ✓ Crude Blade component (cutting: 2, piercing: 1)
  ✓ Can be used in Knife recipe (cutting:2+ requirement)
  ✓ Also usable as improvised weapon (1d3 sharp, 15% bleed)

Disassembly:
  • Hand: 50% yield, 50% quality, 1 turn
```

#### Sharpened Stick
```
CRAFT: Sharpened Stick (INTERMEDIATE COMPONENT)
═══════════════════════════════════════════════
Time: 2 turns
Provides: piercing: 1, structural: 1

Requirements:
  • structural +1 (x1) - "Wood Piece"
    Valid: Wood Piece (1), Bone Shard (1)
  • grinding +1 (x1) - "Stone (carving tool)"
    Valid: Stone (2)

Output:
  ✓ Sharpened Stick component (piercing: 1, structural: 1)
  ✓ Also usable as improvised weapon (1d3 sharp, 10% bleed)

Disassembly:
  • Hand: 50% yield, 50% quality, 1 turn
```

#### Wrapped Handle
```
CRAFT: Wrapped Handle (INTERMEDIATE COMPONENT)
═══════════════════════════════════════════════
Time: 1 turn
Provides: grip: 2, structural: 1

Requirements:
  • structural +1 (x1) - "Wood/Bone (handle core)"
    Valid: Wood Piece (1), Bone Shard (1)
  • binding +1 (x1) - "Cloth/Tape/Leather (wrapping)"
    Valid: Cloth Wrap (1), Duct Tape (2), Leather Piece (1), Thread (1), Fabric Panel (1)

Output:
  ✓ Wrapped Handle component (grip: 2, structural: 1)
  ✓ Can be used in Knife recipe (grip:2+ requirement)

Disassembly:
  • Hand: 100% yield, 70% quality, 1 turn
```

#### Strap
```
CRAFT: Strap (INTERMEDIATE COMPONENT)
═══════════════════════════════════════════════
Time: 1 turn
Provides: binding: 3, structural: 1

Requirements:
  • padding +1 (x1) - "Fabric/Leather"
    Valid: Fabric Panel (2), Cloth Wrap (1), Leather Piece (1), Rubber Piece (1)

Output:
  ✓ Strap component (binding: 3, structural: 1)
  ✓ Used in Backpack and Canteen recipes

Disassembly:
  • Hand: 100% yield, 80% quality, 1 turn
  • Knife: 100% yield, 90% quality, 1 turn
```

### Tier 2 - Basic Items

#### Shiv
```
CRAFT: Shiv
═══════════════════════════════════════════════
Time: 1 turn

Requirements (TIER-GATED):
  • cutting 1-1 (x1) - "Sharp Edge (shard/glass/lid)"
    ✓ Metal Shard (1), Glass Shard (1), Can Lid (1)
    ✗ Crude Blade (2), Knife Blade (3) — BLOCKED by maxValue:1
  • grip +1 (x1) - "Grip (cloth/tape/leather)"
    Valid: Cloth Wrap (1), Duct Tape (1), Wood Piece (1), Rubber Piece (2), Leather Piece (2)

Output:
  ✓ Shiv (1d4 damage, 30% bleed)
  ✓ Quality: Average of component qualities

Disassembly:
  • Hand: 100% yield, 70% quality, 1 turn
  • Knife: 100% yield, 90% quality, 1 turn
  → Returns: 1x Metal Shard, 1x Cloth Wrap
```

### Tier 3 - Standard Items

#### Knife
```
CRAFT: Knife
═══════════════════════════════════════════════
Time: 2 turns

Requirements:
  • cutting +2 (x1) - "Blade (crude blade/knife blade)"
    Valid: Crude Blade (2), Knife Blade (3), Cutting Wheel (2)
    → Sub-recipe: ⚒ Craft Crude Blade (Metal/Glass + Stone, 3 turns)
  • grip +2 (x1) - "Handle (wrapped handle/rubber grip)"
    Valid: Wrapped Handle (2), Rubber Piece (2), Leather Piece (2), Handle (3)
    → Sub-recipe: ⚒ Craft Wrapped Handle (Wood + Cloth, 1 turn)
  • fastening +1 (x2) - "Fasteners (rivets/nails/tape)"
    Valid: Rivet (1), Nail (1), Button (1), Thread (1), Duct Tape (1), Screw Cap (1), Bottle Cap (1)

Output:
  ✓ Knife (1d6 damage, 40% bleed, can two-hand)
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 66% yield, 60% quality, 2 turns (loses rivets)
  • Knife: 100% yield, 85% quality, 1 turn
  → Returns: 1x Blade, 1x Handle, 2x Rivet
```

### Tier 3 - Advanced Crafting

#### Backpack
```
CRAFT: Backpack
═══════════════════════════════════════════════════
Difficulty: Advanced
Time: 10 turns

Requirements (Mixed - Specific + Property):
  • fabric_panel (x3) - SPECIFIC COMPONENT
  • strap (x2) - SPECIFIC COMPONENT
  • fastening +2 (x2) - "Fasteners (buckles/zippers)"
    Valid: Zipper, Buckle, Screw
  • thread (x1) - SPECIFIC COMPONENT

Components Consumed:
  • 3x Fabric Panel (must be exact component)
  • 2x Strap (must be exact component)
  • 2x components with fastening +2 (any valid)
  • 1x Thread (must be exact component)

Output:
  ✓ Backpack (3 pockets, equips to Back slot)
    - Main Compartment: 8kg / 12L
    - Front Pocket: 2kg / 3L
    - Side Pocket: 1kg / 1.5L
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 75% yield, 60% quality, 3 turns (loses thread)
  • Knife: 100% yield, 85% quality, 2 turns
  → Returns: 3x Fabric Panel, 2x Strap, 2x Buckle, 2x Zipper, 1x Thread
```

#### Trenchcoat
```
CRAFT: Trenchcoat
═══════════════════════════════════════════════════
Difficulty: Advanced
Time: 15 turns

Requirements (Property-Based):
  • padding +1 (x4) - "Fabric Panel"
    Valid: Fabric Panel (padding: 2)
  • fastening +1 (x7) - "Fasteners (buttons/zipper)"
    Valid: Button, Zipper, Thread, Rivet
  • binding +1 (x1) - "Thread"
    Valid: Thread, Cloth Wrap, Fabric Panel

Components Consumed:
  • 4x components with padding +1 (typically Fabric Panels)
  • 7x components with fastening +1 (typically 6 Buttons + 1 Zipper)
  • 1x component with binding +1 (typically Thread)

Output:
  ✓ Trenchcoat (1 defense, 3 pockets, equips to Torso)
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 75% yield, 50% quality, 3 turns (loses thread)
  • Knife: 100% yield, 80% quality, 2 turns
  → Returns: 4x Fabric Panel, 6x Button, 1x Thread, 1x Zipper
```

#### Coat
```
CRAFT: Coat
═══════════════════════════════════════════════════
Difficulty: Advanced
Time: 12 turns

Requirements (Property-Based):
  • padding +1 (x3) - "Fabric Panel"
  • fastening +1 (x6) - "Fasteners (buttons/zipper)"
  • binding +1 (x1) - "Thread"

Components Consumed:
  • 3x components with padding +1
  • 6x components with fastening +1
  • 1x component with binding +1

Output:
  ✓ Coat (1 defense, 3 pockets, equips to Torso)
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 75% yield, 50% quality, 3 turns (loses thread)
  • Knife: 100% yield, 80% quality, 2 turns
  → Returns: 3x Fabric Panel, 5x Button, 1x Thread, 1x Zipper
```

#### Pants
```
CRAFT: Pants
═══════════════════════════════════════════════════
Difficulty: Standard
Time: 8 turns

Requirements (Property-Based):
  • padding +1 (x2) - "Fabric Panel"
  • fastening +1 (x3) - "Fasteners (buttons/zipper)"
  • binding +1 (x1) - "Thread"

Components Consumed:
  • 2x components with padding +1
  • 3x components with fastening +1
  • 1x component with binding +1

Output:
  ✓ Pants (0 defense, 3 pockets, equips to Legs)
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 75% yield, 50% quality, 2 turns (loses thread)
  • Knife: 100% yield, 80% quality, 1 turn
  → Returns: 2x Fabric Panel, 2x Button, 1x Thread, 1x Zipper
```

#### Canteen
```
CRAFT: Canteen
═══════════════════════════════════════════════════
Difficulty: Standard
Time: 5 turns

Requirements (Property-Based):
  • container +1 (x1) - "Metal Bottle"
  • fastening +1 (x1) - "Screw Cap"
  • binding +2 (x1) - "Strap"

Components Consumed:
  • 1x component with container +1
  • 1x component with fastening +1
  • 1x component with binding +2

Output:
  ✓ Canteen (1kg / 1L capacity, liquids only)
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 100% yield, 70% quality, 1 turn
  • Knife: 100% yield, 90% quality, 1 turn
  → Returns: 1x Metal Bottle, 1x Screw Cap, 1x Strap
```

#### Medkit
```
CRAFT: Medkit
═══════════════════════════════════════════════════
Difficulty: Standard
Time: 3 turns

Requirements (Property-Based):
  • medical +1 (x6) - "Medical Supplies"
    Valid: Bandage (medical: 1), Antiseptic (medical: 2), Painkiller (medical: 2)

Components Consumed:
  • 6x medical value (e.g., 3x Bandage + 1x Antiseptic + 1x Painkiller = 1+1+1+2+2 = 7)

Output:
  ✓ Medkit (heals 20 HP over 4 turns)
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 100% yield, 80% quality, 1 turn
  • Knife: 100% yield, 90% quality, 1 turn
  → Returns: 3x Bandage, 1x Antiseptic, 2x Painkiller, 1x Plastic Case
```

#### Battery
```
CRAFT: Battery
═══════════════════════════════════════════════════
Difficulty: Advanced
Time: 5 turns

Requirements (Property-Based):
  • container +1 (x1) - "Metal Casing"
  • chemical +1 (x1) - "Electrolyte Paste"
  • conductor +1 (x1) - "Carbon Rod"

Components Consumed:
  • 1x component with container +1
  • 1x component with chemical +1
  • 1x component with conductor +1

Output:
  ✓ Battery (100 power capacity)
  ✓ Quality: Average of all component qualities

Disassembly:
  • Hand: 66% yield, 50% quality, 2 turns
  • Knife: 100% yield, 80% quality, 1 turn
  → Returns: 1x Metal Casing, 1x Electrolyte Paste, 1x Carbon Rod
```

---

## Disassembly Outcomes

### Disassembly Summary

All items with `components` array can be disassembled. Quality retention depends on tool used:

**Tool Quality Modifiers:**
- **Hand:** 0.60-0.75 (loses 25-40% quality)
- **Knife:** 0.80-0.90 (loses 10-20% quality)
- **Proper Tool:** 0.85-1.00 (loses 0-15% quality)

**Component Yield:**
- Most items: 66-100% yield depending on tool
- Some components excluded (e.g., thread often lost in hand disassembly)

### Weapons

#### Shiv
```
DISASSEMBLE: Shiv
═══════════════════════════════════════════════════

WITH KNIFE (Perfect Tool):
Time: 1 turn
Risk: None
Components:
  ✓ Scrap Metal Shard x1 (100% quality)
  ✓ Cloth Wrap x1 (100% quality)

WITH BARE HANDS:
Time: 2 turns
Risk: 10% minor cut to hands (5 damage)
Components:
  ✓ Scrap Metal Shard x1 (100% quality)
  ✓ Cloth Wrap x1 (70% quality) - Torn
```

#### Knife
```
DISASSEMBLE: Knife
═══════════════════════════════════════════════════

WITH SCREWDRIVER (Perfect Tool):
Time: 2 turns
Risk: None
Components:
  ✓ Blade x1 (100% quality)
  ✓ Handle x1 (100% quality)
  ✓ Rivet x2 (100% quality)

WITH KNIFE (Improvised):
Time: 4 turns
Risk: 15% moderate cut to hands (10 damage + bleeding)
Components:
  ✓ Blade x1 (90% quality) - Slightly scratched
  ✓ Handle x1 (100% quality)
  ✗ Rivet x2 - Damaged during removal

WITH PIPE (Smash):
Time: 1 turn
Risk: 20% cut to hands (8 damage)
Components:
  ✓ Blade x1 (40% quality) - Bent, chipped
  ✓ Handle x1 (60% quality) - Cracked
  ✗ Rivet x2 - Destroyed
```

#### Pipe
```
DISASSEMBLE: Pipe
═══════════════════════════════════════════════════

WITH WRENCH (Perfect Tool):
Time: 1 turn
Risk: None
Components:
  ✓ Metal Tube x1 (100% quality)

WITH BARE HANDS:
Time: N/A
Result: Cannot disassemble solid metal pipe with bare hands
```

### Tools

#### Can Opener
```
DISASSEMBLE: Can Opener
═══════════════════════════════════════════════════

WITH SCREWDRIVER (Perfect Tool):
Time: 2 turns
Risk: None
Components:
  ✓ Blade Wheel x1 (100% quality)
  ✓ Handle x1 (100% quality)
  ✓ Screw x2 (100% quality)

WITH KNIFE (Improvised):
Time: 4 turns
Risk: 10% cut to hands (5 damage)
Components:
  ✓ Blade Wheel x1 (80% quality) - Slightly bent
  ✓ Handle x1 (100% quality)
  ✗ Screw x2 - Stripped
```

#### Battery
```
DISASSEMBLE: Battery
═══════════════════════════════════════════════════

WITH KNIFE (Careful):
Time: 3 turns
Risk: 20% chemical exposure to hands (10 damage + pain)
Components:
  ✓ Metal Casing x1 (100% quality)
  ✓ Electrolyte Paste x1 (80% quality) - Some spillage
  ✓ Carbon Rod x1 (100% quality)

WITH PIPE (Smash):
Time: 1 turn
Risk: 40% chemical exposure + cuts (15 damage + pain)
Components:
  ✓ Metal Casing x1 (30% quality) - Crushed
  ✗ Electrolyte Paste - Spilled
  ✓ Carbon Rod x1 (60% quality) - Broken
```

### Containers

#### Backpack
```
DISASSEMBLE: Backpack
═══════════════════════════════════════════════════

WITH SCISSORS (Perfect Tool):
Time: 5 turns
Risk: None
Components:
  ✓ Fabric Panel x3 (100% quality)
  ✓ Strap x2 (100% quality)
  ✓ Buckle x2 (100% quality)
  ✓ Zipper x1 (100% quality)

WITH KNIFE (Good Tool):
Time: 8 turns
Risk: 5% cut to hands (5 damage)
Components:
  ✓ Fabric Panel x3 (90% quality) - Slightly frayed
  ✓ Strap x2 (100% quality)
  ✓ Buckle x2 (100% quality)
  ✓ Zipper x1 (80% quality) - Teeth damaged

WITH BARE HANDS (Tear):
Time: 12 turns
Risk: 10% strain to hands (3 damage + pain)
Components:
  ✓ Fabric Panel x2 (50% quality) - Torn, frayed
  ✓ Strap x1 (60% quality) - One destroyed
  ✓ Buckle x2 (100% quality)
  ✗ Zipper - Destroyed
```

#### Sealed Can
```
DISASSEMBLE: Sealed Can
═══════════════════════════════════════════════════

WITH CAN OPENER (Perfect Tool):
Time: 1 turn
Risk: None
Components:
  ✓ Tin Can x1 (100% quality)
  ✓ Can Lid x1 (100% quality)
  ✓ Contents (100% yield)

WITH KNIFE:
Time: 3 turns
Risk: 10% cut to hands (8 damage)
Components:
  ✓ Tin Can x1 (80% quality) - Jagged edge
  ✓ Can Lid x1 (60% quality) - Bent
  ✓ Contents (80% yield) - Some spillage

WITH PIPE (Smash):
Time: 2 turns
Risk: 15% cut to hands (10 damage)
Components:
  ✓ Tin Can x1 (30% quality) - Crushed
  ✗ Can Lid - Destroyed
  ✓ Contents (50% yield) - Major spillage

WITH GROUND (Rub):
Time: 10 turns
Risk: 5% cut to hands (5 damage)
Components:
  ✓ Tin Can x1 (40% quality) - Abraded
  ✗ Can Lid - Destroyed
  ✓ Contents (15% yield) - Major spillage
```

### Armor/Clothing

#### Trenchcoat
```
DISASSEMBLE: Trenchcoat
═══════════════════════════════════════════════════

WITH SCISSORS (Perfect Tool):
Time: 10 turns
Risk: None
Components:
  ✓ Fabric Panel x4 (100% quality)
  ✓ Button x6 (100% quality)
  ✓ Thread x1 (100% quality)
  ✓ Zipper x1 (100% quality)

WITH KNIFE (Good Tool):
Time: 15 turns
Risk: 5% cut to hands (5 damage)
Components:
  ✓ Fabric Panel x4 (90% quality) - Slightly frayed
  ✓ Button x5 (100% quality) - 1 lost
  ✓ Thread x1 (70% quality) - Some waste
  ✓ Zipper x1 (80% quality) - Teeth damaged

WITH BARE HANDS (Tear):
Time: 25 turns
Risk: 15% strain to hands (5 damage + pain)
Components:
  ✓ Fabric Panel x2 (40% quality) - Badly torn
  ✓ Button x3 (100% quality) - 3 lost
  ✗ Thread - Destroyed
  ✗ Zipper - Destroyed
```

### Medical

#### Medkit
```
DISASSEMBLE: Medkit
═══════════════════════════════════════════════════

WITH BARE HANDS (Open Case):
Time: 1 turn
Risk: None
Components:
  ✓ Bandage x3 (100% quality)
  ✓ Antiseptic x1 (100% quality)
  ✓ Painkiller x2 (100% quality)
  ✓ Plastic Case x1 (100% quality)

Note: Medkit is not sealed, just opens
```

---

## Crafting Recipes

### Basic Recipes (Tier 1)

#### Bandage from Fabric
```
CRAFT: Bandage
═══════════════════════════════════════════════════
Difficulty: Simple
Location: Anywhere (except water)
Time: 1 turn

Requirements:
  • Fabric Panel x1 OR Cloth Wrap x2

Tools (Best to Worst):
  • Scissors: 100% quality, 1 turn, 0% risk
  • Knife: 100% quality, 1 turn, 0% risk
  • Bare Hands: 70% quality, 2 turns, 5% strain

Output:
  ✓ Bandage x3 (quality varies by tool)
```

#### Shiv
```
CRAFT: Shiv
═══════════════════════════════════════════════════
Difficulty: Simple
Location: Anywhere (except water)
Time: 2 turns

Requirements:
  • Scrap Metal Shard x1
  • Cloth Wrap x1

Tools (Best to Worst):
  • Knife: 100% quality, 2 turns, 0% risk
  • Can Opener: 80% quality, 3 turns, 5% cut
  • Bare Hands: 60% quality, 5 turns, 15% cut

Output:
  ✓ Shiv (1d4 damage, quality varies)
```

### Standard Recipes (Tier 2)

#### Knife (Repair/Craft)
```
CRAFT: Knife
═══════════════════════════════════════════════════
Difficulty: Standard
Location: Solid surface (not swamp/water)
Time: 8 turns

Requirements:
  • Blade x1
  • Handle x1
  • Rivet x2

Tools (Best to Worst):
  • Screwdriver: 100% quality, 8 turns, 0% risk
  • Knife: 80% quality, 12 turns, 10% cut
  • Bare Hands: 50% quality, 20 turns, 25% cut

Output:
  ✓ Knife (1d6 damage, quality varies)
```

---

## Weapon Stats (All Items)

### Dedicated Weapons
```
Shiv
├─ Damage: 1d4
├─ Speed: 100 action cost
├─ Type: Sharp, Improvised
├─ Special: 10% bleeding chance
└─ Two-Hand: No

Knife
├─ Damage: 1d6 (one-hand), 1d6+1d4 (two-hand)
├─ Speed: 100 (one-hand), 110 (two-hand)
├─ Type: Sharp, Tool
├─ Special: 15% bleeding chance
└─ Two-Hand: Yes

Pipe
├─ Damage: 1d8 (one-hand), 1d8+1d6 (two-hand)
├─ Speed: 120 (one-hand), 140 (two-hand)
├─ Type: Blunt, Improvised
├─ Special: 10% stun chance
└─ Two-Hand: Yes
```

### Improvised Weapons (Tools)
```
Can Opener
├─ Damage: 1d2
├─ Speed: 90 action cost (light, fast)
├─ Type: Sharp
├─ Special: 5% bleeding chance
└─ Two-Hand: No

Battery
├─ Damage: 1d2
├─ Speed: 100 action cost
├─ Type: Blunt, Throwable
├─ Special: Can throw (loses item)
└─ Two-Hand: No
```

### Improvised Weapons (Containers)
```
Sealed Can
├─ Damage: 1d3
├─ Speed: 100 action cost
├─ Type: Blunt
├─ Special: None
└─ Two-Hand: No

Bottle (Sealed)
├─ Damage: 1d2
├─ Speed: 90 action cost (light)
├─ Type: Blunt, Throwable
├─ Special: Can throw
└─ Two-Hand: No

Backpack (Worn)
├─ Damage: 1d2
├─ Speed: 130 action cost (awkward)
├─ Type: Blunt
├─ Special: -20% accuracy (awkward)
└─ Two-Hand: No
```

### Improvised Weapons (Medical)
```
Medkit Case
├─ Damage: 1d2
├─ Speed: 110 action cost
├─ Type: Blunt
├─ Special: None
└─ Two-Hand: No
```

---

## Injury Types

### Cut (Hands, Arms)
```
Source: Knives, sharp edges, glass
Severity Levels:
  Minor:    5 damage, 1 HP/turn bleeding for 10 turns
  Moderate: 15 damage, 2 HP/turn bleeding for 20 turns
  Severe:   30 damage, 3 HP/turn bleeding for 40 turns

Treatment:
  • Bandage: Stops bleeding
  • Antiseptic: Prevents infection
  • Painkiller: Reduces pain penalty

Effects:
  • Minor: -5% crafting speed
  • Moderate: -15% crafting speed, -10% attack accuracy
  • Severe: -30% crafting speed, -25% attack accuracy
```

### Burn (Hands, Face)
```
Source: Heat, chemicals, electricity
Severity Levels:
  Minor:    8 damage, 5 pain for 15 turns
  Moderate: 20 damage, 15 pain for 30 turns
  Severe:   40 damage, 30 pain for 60 turns

Treatment:
  • Burn Gel: Reduces pain, speeds healing
  • Bandage: Protects wound
  • Painkiller: Reduces pain

Effects:
  • Minor: -10% action speed
  • Moderate: -25% action speed, -15% accuracy
  • Severe: -50% action speed, -30% accuracy
```

### Puncture (Hands, Eyes)
```
Source: Sharp points, needles, shrapnel
Severity Levels:
  Minor:    10 damage, 2 HP/turn bleeding for 15 turns
  Moderate: 25 damage, 3 HP/turn bleeding for 30 turns
  Severe:   50 damage, 5 HP/turn bleeding for 60 turns, PERMANENT

Treatment:
  • Bandage: Stops bleeding
  • Antiseptic: Prevents infection
  • Surgery: Required for severe (prevents permanent damage)

Effects:
  • Eye (Severe): Permanent blindness if untreated
  • Hand (Severe): Permanent -50% dexterity if untreated
```

### Chemical (Hands, Face, Eyes)
```
Source: Battery acid, cleaning chemicals, industrial solvents
Severity Levels:
  Minor:    5 damage, 10 pain for 20 turns
  Moderate: 15 damage, 25 pain for 40 turns
  Severe:   35 damage, 50 pain for 80 turns, PERMANENT

Treatment:
  • Water: Immediate rinse (reduces severity)
  • Antiseptic: Prevents infection
  • Medical Attention: Required for severe

Effects:
  • Eye (Severe): Permanent blindness
  • Face (Severe): Permanent scarring, -2 CHA
  • Hand (Severe): Permanent nerve damage, -30% dexterity
```

---

## Update Log

### February 15, 2026 (v19 Crafting Overhaul)
- **MAJOR UPDATE:** Tier gating, craftable intermediates, raw materials, sub-recipe UI
- Added `maxValue` tier gating to prevent high-tier components in low-tier recipes
- Added craftable intermediate components: Crude Blade, Sharpened Stick, Wrapped Handle
- Added `craftedComponentId` + `craftedProperties` system for intermediates
- Added raw material components: glass_shard, wood_piece, stone, bone_shard, rubber_piece, duct_tape, nail
- Added properties to previously bare components: can_lid, leather_piece, blade_wheel, tin_can, metal_bottle, plastic_bottle, bottle_cap, screw_cap
- Added `createComponent()` method to ContentManager for spawning raw materials
- Updated LootTables.js: `rollLootPool()` returns `{familyId}` or `{componentId}`, Chunk.js handles both
- Raw materials spawn in loot tables: outdoors (stone, wood, glass), garages (metal, nails, wire, tape), residential (glass, cloth, tape)
- Reworked Shiv recipe: cutting 1 maxValue:1 (blocks Crude Blade/Knife Blade), grip 1, 1 turn
- Reworked Knife recipe: cutting 2+ (needs Crude Blade or better), grip 2+ (needs Wrapped Handle or better), fastening x2, 2 turns
- Updated Strap to be a proper craftable intermediate with `craftedProperties: { binding: 3, structural: 1 }`
- CraftingUI: sub-recipe drill-down buttons, back-to-parent navigation, craftTime display, craftedProperties display, maxValue range display
- CraftingSystem: `getComponentProperty()` checks craftedProperties first, `matchesRequirement()` supports maxValue
- Cache bumped to v19

### February 4, 2026 (Evening)
- **MAJOR UPDATE:** Implemented Component Property System
- Added property-based crafting requirements
- Added specific component requirements (componentId matching)
- Implemented quality/durability mechanics
- Added all component properties (cutting, grip, fastening, binding, etc.)
- Updated all recipes with actual implementation details
- Added Strap as craftable component
- Fixed knife/shiv disassembly (now returns components)
- Added Coat, Pants, Canteen, Medkit, Battery recipes
- Reduced Backpack fastener requirement (4→2)
- Added Back equipment slot for backpack

### February 4, 2026 (Initial)
- Initial database created
- Added all current game items (20+ items)
- Defined 30+ base components
- Documented disassembly outcomes
- Added weapon stats

### Future Updates
- Add furniture disassembly (Phase 3)
- Add advanced recipes (explosives, electronics, cybernetics)
- Add end-game extraction items (helicopter parts, etc.)
- Expand property system with new properties as needed

---

**End of Crafting Database**
*This document must be updated whenever new items, components, or recipes are added to the game.*
