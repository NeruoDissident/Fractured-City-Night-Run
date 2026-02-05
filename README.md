# Fractured City - Roguelike

A traditional turn-based roguelike set in a grimy cyberpunk universe. Pure grid-based movement, permadeath, and invasive cybernetics.

## Features

### Implemented
- **Turn-based gameplay**: Every action advances the world by one tick
- **Multi-level world**: 3 Z-levels (sewers/basements, ground, second floors)
- **Structured world generation**: Roads, buildings, sewer systems
- **Multi-floor buildings**: Staircases, basements, second floors
- **Character creation**: 6 backgrounds, 10+ traits, stat allocation
- **Deep inventory system**: Weight/volume, nested containers, pockets, encumbrance
- **Item interactions**: Opening containers, food/drink consumption, tool usage
- **Food systems**: Hunger/thirst, spoilage, liquid spillage
- **Movement modes**: Walk/Run/Crouch/Prone with sound propagation
- **Field of View**: Z-aware raycasting with explored tiles
- **NPC AI**: Wandering scavengers, hostile raiders with sound detection
- **Combat system**: Equipment-based damage/defense, dual-wielding
- **Extraction objective**: Access card requirement, win/loss screens
- **Canvas rendering**: 32x32 tile-based graphics with colored glyphs
- **Comprehensive UI**: Character sheet, inventory modal, inspect mode

### In Progress
- Staircase keybinds (< and > keys)
- Building interior features
- Crafting and disassembly system

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
- **M**: Cycle movement mode (Walk/Run/Crouch/Prone)
- **I**: Open inventory
- **C**: Character sheet
- **X**: Inspect mode
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

### Entities
- `src/entities/Player.js` - Player character with stats, anatomy, inventory
- `src/entities/NPC.js` - AI-driven NPCs with Z-aware pathfinding
- `src/entities/Anatomy.js` - Detailed body part tracking

### Systems
- `src/systems/EquipmentSystem.js` - Equip/unequip, damage/defense calculations
- `src/systems/FoVSystem.js` - Z-aware field of view with raycasting
- `src/systems/SoundSystem.js` - Sound propagation and NPC detection
- `src/systems/ItemSystem.js` - Item interactions and consumption
- `src/systems/ContainerSystem.js` - Weight/volume, nested containers
- `src/systems/CharacterCreationSystem.js` - Backgrounds and traits

### Content
- `src/content/ContentManager.js` - Data-driven items, materials, modifiers

### UI
- `src/ui/UIManager.js` - All UI rendering and interactions

## Design Philosophy

- **Data-driven**: Content scales through families, materials, and modifiers
- **No libraries**: Pure vanilla JavaScript with ES6 modules
- **Permadeath**: No meta progression, only player skill
- **Systemic**: Anatomy, cybernetics, and items interact through rules
- **Vercel-ready**: Static site, instant deployment

## Next Steps

1. Add direct staircase keybinds (< and > keys)
2. Implement crafting and disassembly system
3. Add building interior features (furniture, loot containers)
4. Implement cybernetic installation with risks
5. Add NPC dialogue and trading systems
6. Expand faction and reputation mechanics

See `DEVLOG.md` for detailed development progress and roadmap.
