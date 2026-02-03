# Fractured City - Roguelike

A traditional turn-based roguelike set in a grimy cyberpunk universe. Pure grid-based movement, permadeath, and invasive cybernetics.

## Features

### Implemented
- **Turn-based gameplay**: Every action advances the world by one tick
- **Chunked open world**: Infinite procedurally generated world with streaming chunks
- **Character creation**: Detailed anatomy system with stats and body parts
- **NPC AI**: Wandering scavengers and hostile raiders
- **Content system**: Data-driven items, materials, and modifiers
- **Canvas rendering**: 32x32 tile-based graphics with colored glyphs
- **UI panels**: Log, character sheet, inventory, and context info

### In Progress
- Cybernetics installation system
- Full inventory and equipment
- Combat refinement
- Extraction objectives

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
- `src/world/World.js` - Chunk management and entity tracking
- `src/world/Chunk.js` - Procedural terrain generation per chunk

### Entities
- `src/entities/Player.js` - Player character with stats and anatomy
- `src/entities/NPC.js` - AI-driven NPCs (scavengers, raiders)
- `src/entities/Anatomy.js` - Detailed body part tracking

### Content
- `src/content/ContentManager.js` - Data-driven content system for items, materials, modifiers, and cybernetics

### UI
- `src/ui/UIManager.js` - Panel updates and character creation

## Design Philosophy

- **Data-driven**: Content scales through families, materials, and modifiers
- **No libraries**: Pure vanilla JavaScript with ES6 modules
- **Permadeath**: No meta progression, only player skill
- **Systemic**: Anatomy, cybernetics, and items interact through rules
- **Vercel-ready**: Static site, instant deployment

## Next Steps

1. Implement cybernetic installation with risks and requirements
2. Add equipment slots and combat modifiers
3. Create extraction objectives (safehouse, transit gate)
4. Expand content catalog (more items, cybernetics, traits)
5. Add crafting system with substitution mechanics
