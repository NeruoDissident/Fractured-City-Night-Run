# Crafting Database - Master Reference

**Last Updated:** February 4, 2026  
**Status:** Based on current game items only - Updated as new items are added

---

## Table of Contents
1. [Current Game Items](#current-game-items)
2. [Component Library](#component-library)
3. [Tool Effectiveness Tables](#tool-effectiveness-tables)
4. [Disassembly Outcomes](#disassembly-outcomes)
5. [Crafting Recipes](#crafting-recipes)
6. [Weapon Stats (All Items)](#weapon-stats-all-items)
7. [Injury Types](#injury-types)

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
- **Backpack** - 15kg, 25L capacity
- **Wallet** - 200g, 300cm³ capacity
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

### Basic Components

#### Metal Components
```
scrap_metal_shard
├─ Weight: 50g
├─ Volume: 30cm³
├─ Uses: Shiv blade, improvised tools
└─ Source: Smashing metal items

metal_tube
├─ Weight: 200g
├─ Volume: 150cm³
├─ Uses: Pipe weapon, flashlight body, structural
└─ Source: Pipe, flashlight, furniture

blade
├─ Weight: 80g
├─ Volume: 50cm³
├─ Uses: Knife, can opener, cutting tools
└─ Source: Knife, can opener, scissors

rivet
├─ Weight: 5g
├─ Volume: 2cm³
├─ Uses: Fastening metal parts
└─ Source: Metal containers, furniture, tools

screw
├─ Weight: 3g
├─ Volume: 1cm³
├─ Uses: Fastening parts, electronics
└─ Source: Electronics, furniture, tools

wire (copper)
├─ Weight: 10g per meter
├─ Volume: 5cm³ per meter
├─ Uses: Electronics, repairs, bindings
└─ Source: Electronics, cables, motors
```

#### Fabric Components
```
fabric_panel
├─ Weight: 100g
├─ Volume: 200cm³
├─ Uses: Clothing, bags, bandages
└─ Source: Clothing, backpacks, curtains

cloth_wrap
├─ Weight: 20g
├─ Volume: 30cm³
├─ Uses: Bandages, grips, bindings
└─ Source: Torn fabric, clothing

thread
├─ Weight: 5g
├─ Volume: 10cm³
├─ Uses: Sewing, repairs
└─ Source: Clothing, fabric items

strap
├─ Weight: 50g
├─ Volume: 80cm³
├─ Uses: Backpacks, bindings, straps
└─ Source: Backpacks, bags, belts
```

#### Plastic Components
```
plastic_bottle
├─ Weight: 30g
├─ Volume: 100cm³
├─ Uses: Container, water storage
└─ Source: Bottles, containers

plastic_case
├─ Weight: 80g
├─ Volume: 150cm³
├─ Uses: Storage, protection
└─ Source: Medkit, electronics

cap (bottle)
├─ Weight: 5g
├─ Volume: 5cm³
├─ Uses: Sealing bottles
└─ Source: Bottles

button
├─ Weight: 2g
├─ Volume: 1cm³
├─ Uses: Clothing, fasteners
└─ Source: Clothing

zipper
├─ Weight: 15g
├─ Volume: 20cm³
├─ Uses: Clothing, bags
└─ Source: Clothing, backpacks, bags

buckle
├─ Weight: 20g
├─ Volume: 15cm³
├─ Uses: Straps, belts, backpacks
└─ Source: Backpacks, belts
```

#### Container Components
```
tin_can
├─ Weight: 50g
├─ Volume: 80cm³
├─ Uses: Container, improvised cup
└─ Source: Sealed cans

can_lid
├─ Weight: 10g
├─ Volume: 10cm³
├─ Uses: Sharp edge, cutting disc
└─ Source: Opened cans
```

#### Medical Components
```
bandage
├─ Weight: 20g
├─ Volume: 30cm³
├─ Uses: Stop bleeding, wound care
└─ Source: Medkit, fabric

antiseptic
├─ Weight: 50g
├─ Volume: 50cm³
├─ Uses: Prevent infection
└─ Source: Medkit, medical supplies

painkiller
├─ Weight: 10g
├─ Volume: 5cm³
├─ Uses: Reduce pain
└─ Source: Medkit, medical supplies
```

#### Tool Components
```
handle
├─ Weight: 40g
├─ Volume: 60cm³
├─ Uses: Tools, weapons, grips
└─ Source: Tools, weapons, furniture

blade_wheel (cutting)
├─ Weight: 30g
├─ Volume: 20cm³
├─ Uses: Can opener, cutting tools
└─ Source: Can opener, tools
```

#### Power Components
```
battery_aa
├─ Weight: 25g
├─ Volume: 10cm³
├─ Uses: Flashlight, electronics, power
└─ Source: Flashlight, electronics, found

metal_casing (battery)
├─ Weight: 15g
├─ Volume: 8cm³
├─ Uses: Small containers, casings
└─ Source: Batteries

electrolyte_paste
├─ Weight: 8g
├─ Volume: 5cm³
├─ Uses: Battery repair (advanced)
└─ Source: Batteries

carbon_rod
├─ Weight: 5g
├─ Volume: 3cm³
├─ Uses: Battery repair, electrodes
└─ Source: Batteries
```

---

## Tool Effectiveness Tables

### Disassembly Tools

#### Electronics (Computers, Radios, Flashlights)
```
Tool              | Quality | Time | Injury Risk
------------------|---------|------|-------------
Screwdriver       | 100%    | 1x   | 0%
Knife             | 70%     | 2x   | 5% minor cut
Butter Knife      | 60%     | 3x   | 15% minor cut
Bare Hands        | 40%     | 5x   | 25% cut/puncture
Pipe (smash)      | 20%     | 0.5x | 25% cut
```

#### Metal Items (Cans, Pipes, Furniture)
```
Tool              | Quality | Time | Injury Risk
------------------|---------|------|-------------
Wrench            | 100%    | 1x   | 0%
Screwdriver       | 90%     | 1.5x | 2% minor cut
Knife             | 70%     | 2x   | 10% cut
Pipe (pry)        | 60%     | 2x   | 15% crush
Bare Hands        | 30%     | 4x   | 30% cut/crush
Pipe (smash)      | 40%     | 0.5x | 20% cut
```

#### Fabric Items (Clothing, Bags)
```
Tool              | Quality | Time | Injury Risk
------------------|---------|------|-------------
Scissors          | 100%    | 1x   | 0%
Knife             | 90%     | 1.2x | 2% minor cut
Can Opener        | 70%     | 1.5x | 5% cut
Bare Hands (tear) | 70%     | 1.5x | 5% strain
```

#### Sealed Containers (Cans, Bottles)
```
Tool              | Yield | Time | Injury Risk
------------------|-------|------|-------------
Can Opener (can)  | 100%  | 1x   | 0%
Knife (can)       | 80%   | 2x   | 10% cut
Pipe (can)        | 50%   | 1x   | 15% cut
Ground (can)      | 15%   | 3x   | 5% cut
Hand (bottle)     | 100%  | 1x   | 0%
Knife (bottle)    | 95%   | 1.5x | 5% cut
```

### Crafting Tools

#### Simple Crafting (Bandages, Rope, Shiv)
```
Tool              | Quality | Time | Injury Risk
------------------|---------|------|-------------
Knife             | 100%    | 1x   | 0%
Scissors          | 100%    | 1x   | 0%
Can Opener        | 80%     | 1.5x | 2% cut
Bare Hands        | 70%     | 2x   | 5% strain
```

#### Standard Crafting (Flashlight, Weapons)
```
Tool              | Quality | Time | Injury Risk
------------------|---------|------|-------------
Screwdriver       | 100%    | 1x   | 0%
Knife             | 80%     | 1.5x | 5% cut
Bare Hands        | 50%     | 3x   | 15% cut/strain
```

---

## Disassembly Outcomes

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

### February 4, 2026
- Initial database created
- Added all current game items (20+ items)
- Defined 30+ base components
- Created tool effectiveness tables
- Documented disassembly outcomes for all items
- Added weapon stats for all items
- Defined injury types and effects

### Future Updates
- Add new items as they are implemented
- Add crafting recipes as they are designed
- Add furniture disassembly (Phase 3)
- Add advanced recipes (explosives, electronics, cybernetics)
- Add end-game extraction items (helicopter parts, etc.)

---

**End of Crafting Database**
*This document must be updated whenever new items, components, or recipes are added to the game.*
