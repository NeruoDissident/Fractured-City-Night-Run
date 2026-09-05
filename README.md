# Fractured City: Night Run

A browser-based turn-based survival roguelike set in a fractured cyberpunk world that is still running on fumes. The current design pivot is toward **occupation-driven starts**, dense isolated-but-connected zones, ASCII-first readability, and objectives that come from backgrounds, factions, and local situations.

The target mix is:
- **Caves of Qud**: deep character building, strange abilities, rich world texture
- **Cataclysm: DDA**: grounded survival, item depth, crafting, anatomy, and tactical consequence
- **Streets of Rogue**: compact local situations, NPC roles, faction hooks, and background-specific motives

Zones are not rigid stages. The player can travel freely between zones and use the overworld, but each zone should feel like a real place: a hideout, market corner, clinic, mall, school, gas station, alley network, construction site, or faction-controlled facility.

## Current Direction

The game is being rebuilt as a first-person grid crawler. The old quest chain,
delivery errands, Known Places, and NPC roster were removed; combat, anatomy,
crafting, inventory, survival, lighting, and zone generation remain. Two
placeholder NPC types exist for testing (`F9` spawns a hostile ahead,
`Shift+F9` a bystander). The next steps are the run flow, interior-first zone
generators, and a UI pass built around the crawler view. See `CLAUDE.md`.

## Implemented Systems

- Turn-based gameplay with action costs and NPC energy processing
- Anatomy-based combat with blood, wounds, organs, pain, shock, and no real HP bar
- Movement modes: walk, run, crouch, prone
- Sound propagation and NPC detection
- Field of view, explored tiles, lighting, day/night cycle
- Hunger, thirst, food spoilage, liquid spillage, contamination
- Deep inventory with weight, volume, nested containers, pockets, equipment, carried items
- Item actions, opening containers, consumption, tool usage
- Crafting and disassembly with component properties, quality, intermediates, and tier gates
- Character creation with backgrounds, traits, stats, talents, stances, and abilities
- Overworld zone grid
- Zone-mode generation through templates/fragments
- Auto-explore (`O`) toward unexplored ground
- Canvas rendering with ASCII and optional sprites

## View

The game now plays as a **first-person grid crawler**: the map is the same
turn-based tile world, but you see it from inside your cell, looking along
your facing. Press `` ` `` (backtick) at any time to flip to the classic
top-down map view and back. Both views share the same simulation, FoV, and
lighting rules.

## Controls

First-person view (default):

- `W` / Up: step forward (bump into a creature to attack it)
- `S` / Down: step back without turning
- `A` / `D`, Left / Right: turn left / right (free action, no world tick)
- `Shift` + `A` / `D`: sidestep left / right
- `` ` ``: toggle first-person / top-down view

Top-down view:

- `WASD` / Arrow Keys: move
- `Space`: wait
- `G`: pick up item
- `E`: interact with nearby object/NPC (in first person: `W`/`S`/`A`/`D` pick ahead/behind/left/right, `Space` picks your own tile)
- `M`: cycle movement mode
- `T`: cycle combat stance
- `Q`: talent and ability panel
- `O`: auto-explore
- `F9` / `Shift+F9`: debug spawn a hostile / bystander ahead
- `B`: combat detail overlay
- `Tab`: overworld map
- `I`: inventory
- `C`: character sheet
- `V`: workshop
- `X`: inspect mode (in first person the cursor starts on the cell ahead and moves relative to your facing)
- `F`: debug explore mode, freezes hunger/thirst
- `<` / `>`: stairs/manholes/ladders
- `?`: help
- `Esc`: close modal/cancel mode/cancel auto-explore

## Local Development

Open `index.html` directly, or run a local server:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

For cache problems during local testing, use `dev-reset.html` or hard-refresh. The service worker is disabled for localhost.

## Architecture Map

### Core
- `src/core/Game.js` - main game state, turn processing, zone transitions, auto-travel
- `src/core/InputHandler.js` - keyboard mapping
- `src/core/Renderer.js` - canvas tile renderer
- `src/core/SpriteManager.js` - optional spritesheet loading

### World
- `src/world/World.js` - chunk manager, entities/items/objects, zone mode
- `src/world/OverworldMap.js` - overworld zone grid
- `src/world/gen/ZoneGenerator.js` - current zone generation entrypoint
- `src/world/gen/ZoneCanvas.js` - zone drawing helper (tiles, doors, furniture, NPC spawns)
- `src/world/gen/UrbanFragments.js` - reusable urban sub-zone fragments
- `src/world/Chunk.js` - older procedural chunk generation, still present but no longer the main design direction

### Systems
- `src/systems/CharacterCreationSystem.js` - backgrounds/traits/stat setup
- `src/content/TalentCatalog.js` - talent trees, nodes, effects
- `src/content/NpcCatalog.js` - NPC templates (placeholders until the new roster)
- `src/systems/AbilitySystem.js` - talent-gated abilities and effects
- `src/systems/CombatSystem.js` - anatomy combat resolution
- `src/systems/CraftingSystem.js` - crafting/disassembly
- `src/systems/FoVSystem.js` - visible/explored tiles
- `src/systems/SoundSystem.js` - sound events and detection
- `src/systems/TimeSystem.js` / `LightingSystem.js` - time and light

### UI
- `src/ui/UIManager.js` - panels, modals, chargen
- `src/ui/CraftingUI.js` - workshop
- `src/ui/DisassembleModal.js` - disassembly
- `src/ui/WorldObjectModal.js` - world object/furniture interactions
- `src/ui/MobileControls.js` - touch controls

## Current Design Rules

- Build zones as dense scenario containers, not endless noise.
- Alive zones should feel inhabited; abandoned zones should feel abandoned.
- Backgrounds are evolving into occupations with motives, starting situations, social hooks, and skill bias.
- Skills/abilities should unlock new actions, not just small stat bumps.
- Use ASCII first while zone readability is being rebuilt.
- Use existing sprites only when they are actually correct; new entities should start as ASCII.
- Preserve ASCII fallback for every sprite/tile/entity path.

## Next Steps

1. Define the run flow: where a run starts, what pulls the player forward, what ends it.
2. Interior-first zone generators (corridors, rooms, doors, z-levels) for the crawler view.
3. UI cleanup around the first-person view.
4. Cone FoV, facing-aware combat, wall textures and billboard sprites.
