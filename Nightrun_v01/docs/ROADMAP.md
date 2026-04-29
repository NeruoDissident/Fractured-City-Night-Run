# Roadmap

**Direction:** Zone-based dungeon crawler (ToME model) with deep character builds,
three Origins (Flesh / Metal / Echo), cybernetics, Echo abilities, and factions.
Full vision in `docs/VISION.md`.

The project moves in two tracks that run in parallel:

- **Feature track** — building and expanding game content
- **Architecture track** — keeping the codebase clean, documented, and
  Unity-ready as complexity grows

Architecture tasks are not optional extras. They must stay ahead of feature
work or refactoring debt will compound.

---

## Architecture Track

These tasks must be done *before* the feature set grows much larger.
They have no gameplay visible effect but determine whether the project
stays maintainable at DF/CataDDA scale.

### A1 — Extract `IRenderer` interface ⭐ PRIORITY
- Create `IRenderer` with `Put`, `PutString`, `BeginFrame`, `Present`, `Width`, `Height`
- `AsciiRenderer` implements it
- `Game` and all screens take `IRenderer`, not `AsciiRenderer` directly
- **This is the single most important step before the Unity port**

### A2 — Split `Game.cs` into screen classes ⭐ PRIORITY
- Each `GameMode` becomes an `IGameScreen` with its own `HandleInput()` and `Render()`
- `Game` becomes a thin dispatcher that owns the screen stack
- Enables: adding new screens without touching the core loop

### A3 — Fix `AIContext.Turn` staleness
- `AIContext` should hold a reference to `TimeSystem` (or a `Func<int>`)
  so NPCs always see the correct current turn
- Current bug: `Turn` is frozen at the value when `InitWorld()` was called

### A4 — Typed event bus
- Simple `EventBus` with `Publish<T>` / `Subscribe<T>`
- Initial events: `EntityDied`, `SoundEmitted`, `ItemPickedUp`, `TileChanged`
- Decouples systems so new listeners can be added without touching emitters
- Required at DF scale for things like: quest tracking, faction reactions,
  world history logging

### A5 — Chunk unloading + spatial NPC hash
- Unload chunks beyond a configurable radius (save to disk when save/load exists)
- Replace linear NPC scan with a spatial hash keyed on chunk
- Required before world size grows significantly

### A6 — Save / load foundation
- Serialize world chunks, entities, inventory, and game state to JSON
- Can be simple (full-world snapshot) initially, incremental later
- Needs to exist before any "run persistence" features

---

## Feature Track

Features are ordered by dependency. Each block can only start when the
architecture tasks it depends on are complete.

---

### F1 — Remove debug spawning / clean up game start
- Delete `SpawnDebugNpcs()` from `Game.cs`
- NPCs will be zone-profile spawned once the zone generator exists
- Depends on: nothing (do now)

### F2 — Origin system in character creation
- Add `Origin` enum: `Flesh`, `Metal`, `Echo`
- Origin selected in `CharacterCreationScreen` (new section, before Archetype)
- `Player` stores `Origin`, exposes it to all systems that gate on it
- `CharacterCreation.cs` updated: backgrounds group by Origin, locked systems
  are flagged (no enforcement yet — just data)
- Depends on: nothing (do now alongside F1)

### F3 — Movement modes + combat stances
- Port `Player.movementModes` (walk/run/crouch/prone): action cost, sound volume, stealth mod
- Port `Player.combatStances` (aggressive/defensive/opportunistic): damage/hit/crit/intercept mods
- Wire movement mode into `SoundSystem` (running is loud)
- Feed stance modifiers into `CombatSystem.ResolveAttack`
- Depends on: A2 (Game.cs split) recommended first

### F4 — Zone generator (replaces infinite world gen)
- New `ZoneGenerator` class: takes a `ZoneProfile` → produces a bounded map (~80×50)
- Generation pass: blob/BSP rooms → corridors → furniture → loot → NPC spawns → Echo spawns
- `ZoneProfile` data class: zone type, faction, Echo density, loot profile, extraction flag
- `WorldManager` replaced by `ZoneManager` (holds current zone map, no chunk system)
- Existing tile/tile-type/furniture/loot systems reused verbatim
- Depends on: A2 (screen extraction), A1 (IRenderer)
- **This is the biggest single architectural change in the pivot**

### F5 — Overworld map (Caves of Qud style)
- `OverworldMap` samples `WorldManager` biomes at coarse resolution
  (1 chunk = 1 overworld tile) producing a fixed-size grid (~60×36)
- Each overworld tile stores: biome, threat level, faction, explored flag, zone seed
- Biome → ZoneProfile binding: UrbanCore→Urban Ruins, Ruins→Collapsed District,
  Industrial→Sewer/Factory, Forest→Wasteland, etc.
- `OverworldScreen`: Qud-style ASCII map — biome glyphs, `@` cursor, 8-dir movement,
  `Enter` to drop into the tile's zone, sidebar shows tile info
- `GameMode.Overworld` added to Game.cs state machine
- Run flow: chargen → overworld → drop into zone → play → exit zone → overworld
- Death on any zone ends the run (back to main menu)
- Zone exit returns player to overworld at the same tile they entered
- Depends on: F4

### F6 — Talent tree foundation
- `TalentTree` data class: tree ID, tiers (1–5), each talent has requirements,
  cost, and an `Effect` descriptor
- `Player` gains `TalentPoints` (awarded on zone completion or level-up)
- `TalentScreen` modal: browse trees, spend points, preview effects
- No ability *execution* yet — just the data and UI scaffolding
- Depends on: A2

### F7 — Combat abilities (first pass)
- Port `AbilitySystem.js` core: 4–6 abilities across blunt/sharp/unarmed
- Abilities are talent tree unlocks, not free from the start
- Ability selection during combat: press key → numbered list → execute
- Origin gate enforced: Echo trees locked for Flesh/Metal, etc.
- Depends on: F6

### F8 — Faction system (first pass)
- `FactionRep` dictionary on `Player`: faction ID → reputation (-100 to +100)
- NPC profiles get a `Faction` field
- Killing NPCs adjusts rep; entering zones with faction presence sets baseline
- At rep thresholds: NPCs become hostile/neutral/friendly
- NPC services unlocked by rep (surgeon, merchant, Echo trainer stubs)
- Depends on: F4 (zone profiles have faction data)

### F9 — Cybernetics system (Metal Origin)
- `Implant` data class: slot, tier, effects, failure table, durability
- `CyberneticsSystem`: install procedure (surgeon NPC required or self-surgery),
  resolve outcome (success/partial/failure/complication), cascade failure on damage
- `Player.Implants` list; implant effects applied to stats each turn
- EMP damage triggers failure roll on all implants
- Origin gate: non-Metal characters cannot install implants
- Depends on: F8 (surgeon NPCs come from faction system), F6 (talent tree unlocks slots)

### F10 — Echo ability system (Echo Origin)
- `EchoInstability` stat on Player (0–100), displayed in sidebar
- `EchoAbility` data class: instability cost, tier, training requirement
- Instability rises on use and in Echo-dense zones; falls in quiet zones
- Training requirements: must have encountered N of a specific Echo entity type
- Origin gate: non-Echo characters cannot use Echo abilities
- Fragmentation at 100 instability: run-ending condition (not death)
- Depends on: F4 (zone Echo density), F6 (talent tree unlocks abilities)

### F11 — Crafting rework (Tinkering tree)
- Remove crafting as a mandatory starting system
- Move all recipes behind `Tinkering` talent tree investment
- Flesh Origin: full tinkering access (all existing recipes + new trees)
- Metal Origin: electronics and weapon mods only
- Echo Origin: crafting locked entirely
- Scav King archetype: Tinkering talent costs halved
- Existing `CraftingSystem.cs` and `RecipeCatalog.cs` preserved — just gated
- Depends on: F6 (talent trees gate access), F2 (Origin system)

### F12 — Extraction points
- `ExtractionPoint` data class: type, required items, required faction rep
- Placed in applicable zones by zone generator
- Win screen: run stats, cause of extraction, zone history
- Multiple paths unlock based on Origin and faction rep
- Depends on: F4, F8

### F13 — NPC leash + morale
- Leash: NPCs stop chasing beyond spawn radius
- Morale: destroyed limb or courage threshold → flee
- `SpawnX/SpawnY` already exist; just needs wiring into `TakeTurn`
- Depends on: nothing (can do any time)

### F14 — Ranged combat
- Thrown items (arc, noise on land)
- Ranged weapons (accuracy falloff, ammo, noise)
- Cover (crouching behind furniture reduces hit chance)
- Depends on: F3

### F15 — Status effects system
- Poison, radiation, hypothermia, exhaustion, EMP stun
- Data-driven: tick rate, stat modifiers, cure conditions
- Feeds into anatomy for damage-over-time effects
- Depends on: nothing (can layer onto existing anatomy system)

---

## Unity Port (Future)

When the C# console version reaches a stable zone-crawler feature set:

1. Create new Unity project
2. Copy `Entities/`, `Systems/`, `Content/` verbatim — no console dependencies
3. Implement `IRenderer` (see A1) as a Unity `TileRenderer` using `Tilemap`
4. Replace `InputSystem` with Unity `Input.GetKeyDown`
5. Replace `Game.cs` main loop with a `MonoBehaviour` coroutine / state machine
6. Convert `Content/` static catalogs to `ScriptableObject` assets
7. Zone maps become Unity `Scene`s or loaded `Tilemap` assets

The console version remains the primary development target indefinitely.
Faster iteration, no Unity overhead, immediate feedback.
