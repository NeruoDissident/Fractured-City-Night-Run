# Architecture Reference

## Guiding Principles

1. **Systems are injectable.** Every system class takes its dependencies
   through its constructor. No `static` mutable state, no service locators.
2. **Renderer-agnostic logic.** Game systems operate in world-space tile
   coordinates. The renderer is the only layer that knows about screen pixels,
   ANSI codes, or sprite sheets.
3. **Data-driven content.** Items, recipes, NPC types, loot tables, and
   prefabs live in `Content/` as static C# catalogs. The plan is to move
   these to JSON files (and then Unity ScriptableObjects) without touching
   system code.
4. **One turn = one atomic action.** The world only advances when the player
   spends a turn. Modal screens (inventory, crafting, etc.) are zero-cost.

---

## Namespace Map

| Namespace | Folder | Responsibility |
|---|---|---|
| `Nightrun.Core` | `Core/` | `Game` — top-level loop, modal dispatch, system wiring |
| `Nightrun.Entities` | `Entities/` | `Entity`, `Player`, `Npc`, `Anatomy`, `Stats` |
| `Nightrun.Systems` | `Systems/` | All game logic — see table below |
| `Nightrun.World` | `World/` | `WorldManager`, `Chunk`, `Tile`, `TileType`, `Biome` |
| `Nightrun.WorldGen` | `WorldGen/` | Procedural generation passes |
| `Nightrun.Content` | `Content/` | Static data catalogs |
| `Nightrun.Rendering` | `Rendering/` | `AsciiRenderer`, screen helpers, modal UIs |

---

## Systems

| Class | File | What it does |
|---|---|---|
| `CombatSystem` | `Systems/CombatSystem.cs` | Hit resolution, anatomy damage, wounds, stagger, parry |
| `CraftingSystem` | `Systems/CraftingSystem.cs` | Recipe matching, crafting, disassembly |
| `FOVSystem` | `Systems/FOVSystem.cs` | Symmetric shadowcast field of view |
| `InputSystem` | `Systems/InputSystem.cs` | Key → `GameAction` mapping |
| `ItemSystem` | `Systems/ItemSystem.cs` | Food spoilage, liquid spillage, fuel tick, consumption |
| `LightingSystem` | `Systems/LightingSystem.cs` | Day/night cycle, indoor/outdoor light levels, torches |
| `MovementSystem` | `Systems/MovementSystem.cs` | Tile walkability, player move, door open/close |
| `SoundSystem` | `Systems/SoundSystem.cs` | Active sound events, decay, NPC alerting |
| `TimeSystem` | `Systems/TimeSystem.cs` | Turn counter, time of day |
| `WorldObjectSystem` | `Systems/WorldObjectSystem.cs` | Peek, knock, smash, disassemble, drop tables |

---

## World / Chunk Architecture

```
WorldManager
 └─ Dictionary<long, Chunk>        chunks keyed by (cx,cy) packed into long
     └─ Tile[Size, Size, Levels]   flat 3-D tile array per chunk
         └─ List<Item>             ground items per tile
         └─ WorldObject?           furniture / door per tile
```

- **Chunk size:** 64 tiles.
- **Infinite world:** chunks generated on first access, cached forever
  (no unloading yet — roadmap item).
- **`WorldManager`** is the only entry point for tile reads/writes.
  Systems never hold a `Chunk` reference directly.

---

## Entity Hierarchy

```
Entity  (base — position, name, glyph, stats, anatomy, equipment, inventory)
 ├─ Player
 └─ Npc
```

- `Entity` owns `Anatomy`, `Stats`, `Equipment`, and `Inventory` as
  optional fields (null for simple entities).
- `Anatomy` drives the health model — no HP bar. Death comes from blood
  loss, organ destruction, shock, or suffocation.

---

## Rendering Pipeline (Console)

```
AsciiRenderer.BeginFrame()        clear back buffer
  WorldManager → tile glyphs      terrain layer
  LightingSystem → light levels   darken unlit cells
  FOVSystem → visibility mask     hide unseen tiles
  Entities (NPCs, player)         entity layer
  UI overlay (log, sidebar)       HUD layer
AsciiRenderer.Present()           diff → ANSI escape write
```

### Unity Swap Point

`AsciiRenderer` exposes only:
- `Put(x, y, char glyph, byte fg, byte bg)`
- `PutString(x, y, string, byte fg, byte bg)`
- `BeginFrame()` / `Present()`

A Unity `TileRenderer : IRenderer` replacing these with
`Tilemap.SetTile(...)` calls is a single class swap.
**The `IRenderer` interface has not been extracted yet — this is a
priority architectural task before the Unity port begins.**

---

## Known Architectural Debt

| Item | Impact | Priority |
|---|---|---|
| `Game.cs` is ~1200 lines with all modal state inlined | Hard to add new screens/modes | High |
| No `IRenderer` interface | Unity swap requires grep-and-replace | High |
| `AIContext.Turn` set once at world init, never updated | NPC anatomy ticks see wrong turn number | Medium |
| No event bus — systems communicate via direct calls + `Action<string>` | Adding new listeners requires code changes everywhere | Medium |
| No chunk unloading | Memory grows unboundedly on long sessions | Low |
| No save/load | Sessions are not persistent | Medium |
