# Nightrun — C# Console Roguelike

**Fractured City: Night Run** is a turn-based survival roguelike inspired by
*Dwarf Fortress*, *Cataclysm: Dark Days Ahead*, and *Caves of Qud*.

This C# project is a full rewrite of the original JavaScript browser prototype,
built with the following goals:

- **Typed, modular, documented** codebase as a clean foundation
- **Scalable systems** that can grow to DF/CataDDA complexity without rewrites
- **Unity-ready architecture** — the long-term plan is to port this to Unity,
  swapping the ANSI console renderer for a sprite-based tileset renderer

---

## Requirements

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- Windows Terminal or any terminal with ANSI/UTF-8 support

## Running

```bash
dotnet run                  # random-ish default seed
dotnet run -- 99999         # explicit uint seed
```

Resize your terminal to at least **120×40** for the best layout.
Press **?** in-game for the full keybindings reference.

---

## Project Structure

```
Nightrun_v01/
├── Core/               Game loop, turn dispatch, modal state machine
├── Entities/           Player, Npc, Entity base, Anatomy, Stats
├── Systems/            All game logic (combat, crafting, FOV, lighting, sound…)
├── World/              WorldManager, Chunk, Tile, TileType, Biome
├── WorldGen/           Procedural generation (terrain, roads, buildings, prefabs)
├── Content/            Static data: items, recipes, loot tables, NPC types, prefabs
├── Rendering/          AsciiRenderer, Screens, modal UIs
└── Program.cs          Entry point
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a full system map.

---

## Design Philosophy

> Every system should be **injectable**, **testable in isolation**, and
> **renderer-agnostic**. No system should know whether it is running inside a
> console or a Unity scene.

- Systems take their dependencies via constructor (no singletons, no statics
  except pure data catalogs).
- The renderer is the only place that knows about the screen. Everything else
  works in world-space coordinates.
- Data lives in `Content/` as C# static catalogs (items, recipes, NPC types).
  These are designed to be replaced with JSON/ScriptableObjects when porting to Unity.

---

## Current Status

See [`docs/PROGRESS.md`](docs/PROGRESS.md) for a detailed feature checklist.

**Working now:**
- Procedural world generation (biomes, roads, buildings, prefabs, loot)
- Field of view + day/night lighting + flashlight/lantern items
- Full item / inventory / pocket / equipment system
- Character creation (name, gender, background, stats, traits)
- Melee combat (hit location, anatomy damage, wounds, bleeding)
- NPC AI (detection states, vision, hearing, investigation, pursuit)
- World object interaction (peek, knock, smash, disassemble, drops)
- Sound system (volume, decay, NPC alerting)
- Crafting + disassembly

**Not yet ported from JS:**
- Movement modes (walk/run/crouch/prone)
- Combat stances (aggressive/defensive/opportunistic)
- Ability system (12+ weapon abilities)
- Encumbrance / carry-weight penalties
- Extraction points (run exit objective)
- Chunk-based NPC spawning (currently debug-spawned only)
- Save / load

---

## Roadmap

See [`docs/ROADMAP.md`](docs/ROADMAP.md).
