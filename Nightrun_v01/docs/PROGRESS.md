# Feature Progress

Tracks what is complete, partial, or missing relative to the JS prototype
(`src/`) and the long-term DF/CataDDA-scale vision.

Status keys: ✅ Complete | 🟡 Partial | ❌ Not started

---

## Core Loop

| Feature | Status | Notes |
|---|---|---|
| Turn-based input loop | ✅ | `Game.cs` |
| Modal screen system | 🟡 | Works, but all modals inlined in `Game.cs` — needs extraction |
| Game-over / death screen | ✅ | Anatomy-driven cause of death |
| New game / reseed | ✅ | |
| Save / load | ❌ | Not started |
| Run extraction / win condition | ❌ | `ExtractionPoint.js` not ported |

---

## World Generation

| Feature | Status | Notes |
|---|---|---|
| Infinite procedural world (chunks) | ✅ | |
| Biome system | ✅ | |
| Road network | ✅ | |
| Building placement | ✅ | |
| Prefab buildings (9 types) | ✅ | |
| Furniture spawning | ✅ | |
| Loot spawning | ✅ | |
| Chunk-based NPC spawning | ❌ | Only `SpawnDebugNpcs()` near player exists |
| Z-levels (multi-floor buildings, underground) | ❌ | Fields exist, no generator support |
| District system (density / style) | 🟡 | Biome-based, less detailed than JS |

---

## Entities

| Feature | Status | Notes |
|---|---|---|
| Player entity | ✅ | |
| NPC entity | ✅ | |
| Anatomy / body-part damage model | ✅ | |
| Blood loss / death causes | ✅ | |
| Wounds (cut, laceration, arterial, internal) | ✅ | |
| Infection system | ✅ | |
| Pain / shock | ✅ | |
| Movement modes (walk/run/crouch/prone) | ❌ | In JS `Player.js`, not ported |
| Combat stances (aggressive/defensive/opportunistic) | ❌ | In JS `Player.js`, not ported |
| Encumbrance / carry-weight penalties | ❌ | Weight tracked, penalties not applied |
| Player facing direction | ❌ | Needed for flashlight cone |
| Morale / retreat on injury | ❌ | `SpawnX/SpawnY` exist, leash/morale not implemented |

---

## Systems

| System | Status | Notes |
|---|---|---|
| FOV (shadowcast) | ✅ | |
| Lighting (day/night, indoor/outdoor, torches) | ✅ | |
| Combat (hit location, anatomy, wounds) | ✅ | Stances + abilities excluded |
| Ability system | ❌ | `AbilitySystem.js` (47KB) not ported |
| Combat stances feeding into combat | ❌ | |
| Sound system | ✅ | Volume, decay, NPC alerting |
| NPC AI (detection, vision, hearing, pursuit) | ✅ | |
| NPC leash / morale | ❌ | |
| Item system (food, spoilage, liquid, fuel) | ✅ | |
| Crafting + disassembly | ✅ | |
| World object interaction (smash/peek/knock/disassemble) | ✅ | |
| Lockpick | ❌ | Stubbed |
| Barricade | ❌ | Stubbed |
| Equipment system (slot penalties, two-hand rules) | 🟡 | Slots work, penalties not applied |
| Container system | ✅ | Pockets, nested containers |
| Movement noise hooking into sound system | ❌ | |
| Combat noise hooking into sound system | ❌ | |

---

## UI / Rendering

| Feature | Status | Notes |
|---|---|---|
| ANSI double-buffered renderer | ✅ | |
| World tile render | ✅ | |
| Sidebar (stats, log) | ✅ | |
| Inventory screen | ✅ | |
| Character screen | ✅ | |
| Crafting screen | ✅ | |
| World object screen | ✅ | |
| Character creation screen | ✅ | Arrow-key nav fixed |
| Disassembly warning modal | ❌ | JS `DisassembleModal.js` not ported |
| `IRenderer` interface | ❌ | Required before Unity port |

---

## Infrastructure

| Feature | Status | Notes |
|---|---|---|
| `.gitignore` | ✅ | |
| `README.md` | ✅ | |
| Architecture docs | ✅ | `docs/ARCHITECTURE.md` |
| Progress tracking | ✅ | This file |
| Roadmap | ✅ | `docs/ROADMAP.md` |
| XML doc comments on all public APIs | 🟡 | Systems have them; some Content classes sparse |
| Unit tests | ❌ | No test project yet |
| Benchmark / profiling harness | ❌ | |
