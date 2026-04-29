# Fractured City - Roguelike

A traditional turn-based roguelike set in a grimy cyberpunk universe. Pure grid-based movement, permadeath, and invasive cybernetics.

## Features

### Implemented
- **Turn-based gameplay**: Every action advances the world by one tick
- **Multi-level world**: 3 Z-levels (sewers/basements, ground, second floors)
- **Structured world generation**: Roads, buildings, sewer systems with 9 prefab layouts
- **Multi-floor buildings**: Staircases, basements, second floors, interactive doors
- **Character creation**: CoQ-style 3-column (v52) — 6 backgrounds, talent browser, 6pt talent budget, stat allocation
- **Talent system**: 5 trees, 35+ talents, talent-gated stances & abilities, in-game Q screen
- **Ability system**: 15 combat abilities across 3 weapon classes, talent-gated, stance bonuses
- **Combat stances**: Aggressive / Defensive / Opportunistic (talent-gated)
- **Overworld map**: 60×40 zone grid, Tab to toggle, zone drop-in with biome-matched generation
- **Deep inventory system**: Weight/volume, nested containers, pockets, encumbrance
- **Item interactions**: Opening containers, food/drink consumption, tool usage
- **Food systems**: Hunger/thirst, spoilage, liquid spillage, contamination
- **Movement modes**: Walk/Run/Crouch/Prone with sound propagation
- **Field of View**: Z-aware raycasting with explored tiles
- **Day/night cycle**: 24-hour clock, ambient lighting, flashlight/lantern items
- **NPC AI**: 5 types (Scavenger/Raider/Armed Raider/Brute/Stalker), energy-based speed, detection state machine
- **Combat system**: Anatomy-based damage, stat-based hit/crit, stagger, parry, abilities
- **Anatomy system**: No HP bar — blood level, wounds, organ damage, infection, shock
- **Medical system**: Bandages, antiseptic, painkillers, infection/sepsis, pain suppression
- **Crafting system**: Tiered recipes, raw materials, craftable intermediates, property-based requirements
- **Disassembly system**: Tool-based quality retention, component recovery
- **Furniture system**: 16 types, searchable storage, loot population
- **Loot tables**: 16 room types with weighted pools, raw material spawning
- **Extraction objective**: Access card requirement, win/loss screens
- **Canvas rendering**: 32x32 tile-based graphics with wall/NPC spritesheets (5 NPC types)
- **Comprehensive UI**: Character sheet, inventory modal, inspect mode, combat overlay, workshop, talent panel

## How to Play

### Local Development
1. Open `index.html` in a modern web browser
2. Or use a local server:
   ```bash
   python -m http.server 8000
   ```
   Then navigate to `http://localhost:8000`

### Controls
- **WASD** or **Arrow Keys**: Move
- **Space**: Wait/skip turn
- **G**: Pick up item
- **E**: Interact with door/object
- **M**: Cycle movement mode (Walk/Run/Crouch/Prone)
- **T**: Cycle combat stance (talent-gated)
- **Q**: Talent & Ability panel
- **B**: Toggle combat detail overlay
- **Tab**: Toggle Overworld map
- **I**: Open inventory
- **C**: Character sheet
- **V**: Workshop (craft/disassemble)
- **X**: Inspect mode
- **F**: Toggle explore mode
- **< / >**: Use stairs/manholes
- **?**: Help screen

### Deploying to Vercel
```bash
vercel deploy
```

No build step required - this is a pure static site.

## Architecture

### Core Systems
- `src/core/Game.js` - Main game loop and state management
- `src/core/Renderer.js` - Canvas 2D rendering with 32x32 tiles
- `src/core/InputHandler.js` - Turn-based input processing

### World
- `src/world/World.js` - Chunk management, entity tracking, Z-level support
- `src/world/Chunk.js` - Procedural generation: roads, buildings, sewers
- `src/world/ExtractionPoint.js` - Win condition system
- `src/world/objects/Door.js` - Interactive doors with lock/HP
- `src/world/objects/Furniture.js` - 16 furniture types with storage

### Entities
- `src/entities/Player.js` - Player character with stats, anatomy, inventory
- `src/entities/NPC.js` - AI-driven NPCs with Z-aware pathfinding
- `src/entities/Anatomy.js` - Detailed body part and organ tracking, blood/wound system

### Systems
- `src/systems/EquipmentSystem.js` - Equip/unequip, damage/defense calculations
- `src/systems/CombatSystem.js` - Anatomy-based combat, wounds, bleeding
- `src/systems/CraftingSystem.js` - Tiered crafting with property matching and maxValue gating
- `src/systems/FoVSystem.js` - Z-aware field of view with raycasting
- `src/systems/SoundSystem.js` - Sound propagation and NPC detection
- `src/systems/ItemSystem.js` - Item interactions and consumption
- `src/systems/ContainerSystem.js` - Weight/volume, nested containers
- `src/systems/TimeSystem.js` - Day/night cycle, 24-hour clock
- `src/systems/LightingSystem.js` - Ambient + point light sources
- `src/systems/WorldObjectSystem.js` - Door/furniture interactions
- `src/systems/CharacterCreationSystem.js` - Backgrounds, traits, CoQ chargen
- `src/systems/AbilitySystem.js` - Combat abilities with talent/stance gating
- `src/systems/CombatEffects.js` - Visual feedback (shake, floating text)

### Content
- `src/content/ContentManager.js` - Data-driven items, components, materials, modifiers
- `src/content/BuildingPrefabs.js` - 18 validated ASCII building layouts
- `src/content/LootTables.js` - 16 room-type loot pools + raw material spawning
- `src/content/TalentCatalog.js` - Talent trees, nodes, and TalentEffects helper

### UI
- `src/ui/UIManager.js` - All UI rendering and interactions
- `src/ui/CraftingUI.js` - Workshop with sub-recipe drill-down
- `src/ui/DisassembleModal.js` - Disassembly interface
- `src/ui/WorldObjectModal.js` - Door/furniture interaction modals
- `src/ui/MobileControls.js` - Touch controls for mobile

## Design Philosophy

- **Data-driven**: Content scales through families, materials, and modifiers
- **No libraries**: Pure vanilla JavaScript with ES6 modules
- **Permadeath**: No meta progression, only player skill
- **Systemic**: Anatomy, cybernetics, and items interact through rules
- **Vercel-ready**: Static site, instant deployment

## Next Steps

1. Town building / world gen improvements (districts, POIs, named locations)
2. NPC dialogue and lore integration
3. Three Origins system: **Flesh / Metal (Chrome) / Echo** — system-locking origin choice at chargen
4. Cybernetic installation (Chrome path)
5. Faction and reputation mechanics

See `DEVLOG.md` for detailed development progress and roadmap.
