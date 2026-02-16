# Fractured City - Roguelike

A traditional turn-based roguelike set in a grimy cyberpunk universe. Pure grid-based movement, permadeath, and invasive cybernetics.

## Features

### Implemented
- **Turn-based gameplay**: Every action advances the world by one tick
- **Multi-level world**: 3 Z-levels (sewers/basements, ground, second floors)
- **Structured world generation**: Roads, buildings, sewer systems with 9 prefab layouts
- **Multi-floor buildings**: Staircases, basements, second floors, interactive doors
- **Character creation**: 6 backgrounds, 10+ traits, stat allocation
- **Deep inventory system**: Weight/volume, nested containers, pockets, encumbrance
- **Item interactions**: Opening containers, food/drink consumption, tool usage
- **Food systems**: Hunger/thirst, spoilage, liquid spillage, contamination
- **Movement modes**: Walk/Run/Crouch/Prone with sound propagation
- **Field of View**: Z-aware raycasting with explored tiles
- **Day/night cycle**: 24-hour clock, ambient lighting, flashlight/lantern items
- **NPC AI**: Wandering scavengers, hostile raiders with sound detection
- **Combat system**: Anatomy-based damage, body-part targeting, bleeding/wounds, dual-wielding
- **Anatomy system**: No HP bar — blood level, wounds, organ damage, multiple death causes
- **Crafting system**: Tiered recipes, raw materials, craftable intermediates, property-based requirements, maxValue tier gating, sub-recipe drill-down UI
- **Disassembly system**: Tool-based quality retention, component recovery
- **Furniture system**: 16 types, searchable storage, loot population
- **Loot tables**: 16 room types with weighted pools, raw material spawning
- **Extraction objective**: Access card requirement, win/loss screens
- **Canvas rendering**: 32x32 tile-based graphics with wall spritesheets
- **Comprehensive UI**: Character sheet, inventory modal, inspect mode, combat overlay, workshop

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
- **I**: Open inventory
- **C**: Character sheet
- **V**: Workshop (craft/disassemble)
- **X**: Inspect mode
- **T**: Cycle combat stance
- **B**: Toggle combat detail overlay
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
- `src/systems/CharacterCreationSystem.js` - Backgrounds and traits

### Content
- `src/content/ContentManager.js` - Data-driven items, components, materials, modifiers
- `src/content/BuildingPrefabs.js` - 9 validated ASCII building layouts
- `src/content/LootTables.js` - 16 room-type loot pools + raw material spawning

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

1. Combat balance tuning (stat-based hit chances, weapon targeting)
2. Cybernetic installation with risks
3. NPC dialogue and trading systems
4. Faction and reputation mechanics
5. Multiple extraction paths

See `DEVLOG.md` for detailed development progress and roadmap.
