using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Rendering;
using Nightrun.Systems;
using Nightrun.World;
using Nightrun.WorldGen;

namespace Nightrun.Core;

/// <summary>
/// Top-level game coordinator. Owns the world, player, renderer, and the
/// turn-based main loop. Modal input logic lives in partial files:
///   Game.Play.cs        — movement, bump-attack, action dispatch
///   Game.Inventory.cs   — inventory, character, container, open-with
///   Game.Crafting.cs    — recipe crafting and disassembly
///   Game.WorldObject.cs — peek/knock/smash/disassemble adjacent objects
/// </summary>
public sealed partial class Game
{
    private uint _seed;
    private IWorldMap _world = null!;
    private ZoneProfile _zoneProfile = ZoneCatalog.All[0];
    private Player _player = null!;
    private readonly IRenderer _renderer;
    private readonly AsciiRenderer _asciiRenderer; // concrete ref for world-draw methods only
    private readonly Camera _camera;
    private FOVSystem _fov = null!;
    private LightingSystem _lighting = null!;
    private MovementSystem _movement = null!;
    private CombatSystem _combat = null!;
    private AbilitySystem _abilities = null!;
    private CraftingSystem _crafting = null!;
    private AIContext _ai = null!;
    private Random _rng = null!;
    private readonly TimeSystem _time = new();
    private readonly HashSet<long> _seen = new();
    private readonly List<LogEntry> _log = new();
    private readonly CombatVfx _vfx = new();
    private bool _showBiomeOverlay;
    private bool _running = true;

    // Overworld state
    private WorldManager _worldManager = null!;   // owns the persistent biome data
    private OverworldMap _overworld    = null!;
    private OverworldTile? _currentTile;           // tile the player dropped into

    // Zone persistence — keyed by ZoneSeed so each overworld tile keeps its
    // generated world, explored tiles, and the player's last position intact.
    private sealed class ZoneSnapshot
    {
        public IWorldMap World = null!;
        public ZoneProfile Profile = null!;
        public HashSet<long> Seen = new();
        public int PlayerX, PlayerY, PlayerZ;
    }
    private readonly Dictionary<uint, ZoneSnapshot> _zoneCache = new();

    // Modal state
    private enum GameMode : byte { Overworld, Playing, Inventory, Character, Container, OpenWith, Crafting, WorldObject, GameOver }
    private GameMode _mode = GameMode.Playing;

    // WorldObject-mode state — two-step flow: pick a nearby object, then pick an action.
    private WorldObjectSystem _worldObj = null!;
    private SoundSystem _sound = null!;
    private enum WoSubMode : byte { PickObject, PickAction }
    private WoSubMode _woSub;
    private readonly List<WorldObject> _woObjects = new();
    private readonly List<string> _woActions = new();
    private int _woCursor;
    private int _woActionCursor;
    private WorldObject? _woTarget;

    // Inventory-mode state
    private int _invCursor;
    private List<InvSlot> _invSlots = new();

    // Container-mode state (searching furniture)
    private Furniture? _containerTarget;
    private List<InvSlot> _containerSlots = new();

    // OpenWith-mode state (picking a tool to open a sealed container)
    private Item? _openTarget;
    private List<OpenOption> _openOptions = new();
    private int _openCursor;

    // Crafting-mode state (two sub-modes: pick recipe / pick item to disassemble).
    // Re-snapshotted each frame so mutating the world mid-menu (eating, etc.)
    // stays consistent with what the player is actually holding.
    private enum CraftSubMode : byte { Craft, Disassemble }
    private CraftSubMode _craftSub = CraftSubMode.Craft;
    private int _craftCursor;
    private List<Recipe> _craftRecipes = new();
    private List<Item> _disasmItems = new();

    // Inspect-mode state — free cursor, no turn cost
    private bool _inspecting;
    private int _inspectX, _inspectY;

    public Game(uint seed)
    {
        _seed = seed;
        _asciiRenderer = new AsciiRenderer();  // swap for a Unity IRenderer here
        _renderer = _asciiRenderer;              // everything else uses the interface
        _camera = new Camera(_renderer.MapWidth, _renderer.MapHeight);
        _worldManager = new WorldManager(seed);
    }

    /// <summary>
    /// Build a fresh world + player + all systems for <paramref name="seed"/>.
    /// Called from <see cref="Run"/> after chargen and from the reseed /
    /// restart paths (which reuse the stored <see cref="_charData"/>).
    /// </summary>
    private CharacterData _charData = CharacterData.Default;

    private void InitZone(ZoneProfile profile, uint seed)
    {
        _zoneProfile = profile;

        // Check zone cache first — restore a previously explored zone.
        if (_zoneCache.TryGetValue(seed, out var snap))
        {
            _world = snap.World;
            _seen.Clear();
            foreach (var v in snap.Seen) _seen.Add(v);

            if (_player == null)
            {
                _player = new Player(snap.PlayerX, snap.PlayerY, _charData);
                _player.TalentPoints = 10; // TODO: set to 3 for release
            }
            else
            {
                _player.X = snap.PlayerX;
                _player.Y = snap.PlayerY;
                _player.Z = snap.PlayerZ;
            }
        }
        else
        {
            // Fresh zone — generate and let the player spawn at the entry point.
            var (zone, sx, sy) = ZoneGenerator.Generate(profile, seed);
            _world = zone;
            _seen.Clear();

            if (_player == null)
            {
                _player = new Player(sx, sy, _charData);
                _player.TalentPoints = 10; // TODO: set to 3 for release
            }
            else
            {
                _player.X = sx;
                _player.Y = sy;
                _player.Z = 0;
            }
        }

        _fov      = new FOVSystem(_world);
        _lighting = new LightingSystem(_world);
        _movement = new MovementSystem(_world);
        _rng      = new Random(unchecked((int)seed));
        _combat   = new CombatSystem(_rng, () => _time.Turn, (Action<string, byte>)AddMessage);
        _abilities = new AbilitySystem(_combat, _rng, AddLog);
        _crafting = new CraftingSystem(_world, _rng, AddLog);
        _worldObj = new WorldObjectSystem(_world, _rng, AddLog);
        _sound    = new SoundSystem(_world);
        _ai       = new AIContext
        {
            World  = _world,
            Player = _player,
            Fov    = _fov,
            Combat = _combat,
            Turn   = _time.Turn,
            Rng    = _rng,
            Log    = AddLog,
            OnAttackResult = (r, wx, wy) => QueueCombatVfx(r, wx, wy),
        };
    }

    private void InitWorld(uint seed)
    {
        _worldManager = new WorldManager(seed);
        _overworld    = OverworldMap.Build(_worldManager);
    }

    /// <summary>Drop the player into the given overworld tile.</summary>
    private void DropIntoTile(OverworldTile tile)
    {
        _currentTile = tile;
        var profile  = ZoneCatalog.Get(tile.ZoneId) ?? ZoneCatalog.All[0];
        bool revisit = _zoneCache.ContainsKey(tile.ZoneSeed);
        InitZone(profile, tile.ZoneSeed);
        _log.Clear();
        AddMessage(revisit
            ? $"Returning to: {profile.Name}."
            : $"Dropping into: {profile.Name}.", 226);
        AddMessage($"Threat level {tile.ThreatLevel}/5.", 214);
        _mode = GameMode.Playing;
        RecomputeFOV();
    }

    /// <summary>Exit the current zone and return to the overworld.</summary>
    private void ExitToOverworld()
    {
        // Snapshot the zone so re-entering restores its full state.
        if (_currentTile != null)
        {
            _currentTile.Explored = true;
            _zoneCache[_currentTile.ZoneSeed] = new ZoneSnapshot
            {
                World   = _world,
                Profile = _zoneProfile,
                Seen    = new HashSet<long>(_seen),
                PlayerX = _player.X,
                PlayerY = _player.Y,
                PlayerZ = _player.Z,
            };
        }
        _mode = GameMode.Overworld;
    }

    public void Run()
    {
        // Chargen first — blocks until the player confirms Play Now (or
        // hits Escape to fall back to CharacterData.Default).
        _charData = CharacterCreationScreen.Run(_renderer);

        // Build overworld from the seeded WorldManager.
        _worldManager = new WorldManager(_seed);
        _overworld    = OverworldMap.Build(_worldManager);
        // Reveal a small area around the spawn tile.
        OverworldScreen_RevealStart(_overworld);

        _mode = GameMode.Overworld;
        AddMessage($"Welcome to Nightrun, {_player?.CharacterName ?? _charData.Name}. Seed {_seed}.", 226);
        Render();

        while (_running)
        {
            _vfx.Clear();

            // Inspect mode intercepts input before the main mode switch
            if (_inspecting && _mode == GameMode.Playing)
            {
                ProcessInspectInput();
            }
            else
            switch (_mode)
            {
                case GameMode.Overworld:   ProcessOverworldInput(); break;
                case GameMode.Playing:     ProcessPlayInput(); break;
                case GameMode.Inventory:   ProcessInventoryInput(); break;
                case GameMode.Character:   ProcessCharacterInput(); break;
                case GameMode.Container:   ProcessContainerInput(); break;
                case GameMode.OpenWith:    ProcessOpenWithInput(); break;
                case GameMode.Crafting:    ProcessCraftingInput(); break;
                case GameMode.WorldObject: ProcessWorldObjectInput(); break;
                case GameMode.GameOver:    ProcessGameOverInput(); break;
            }

            if (_running)
            {
                if (_mode != GameMode.Overworld) RecomputeFOV();
                Render();
            }
        }
    }

    // ------------------------------------------------------------------
    // Overworld input

    private void ProcessOverworldInput()
    {
        var result = OverworldScreen.Run(_renderer, _overworld);
        if (result.QuitToMenu)
        {
            _running = false;
            return;
        }
        if (result.DropInto != null)
            DropIntoTile(result.DropInto);
    }

    private static void OverworldScreen_RevealStart(OverworldMap map)
    {
        int cx = OverworldMap.Cols / 2;
        int cy = OverworldMap.Rows / 2;
        for (int dy = -3; dy <= 3; dy++)
        for (int dx = -3; dx <= 3; dx++)
        {
            int nx = Math.Clamp(cx + dx, 0, OverworldMap.Cols - 1);
            int ny = Math.Clamp(cy + dy, 0, OverworldMap.Rows - 1);
            map[nx, ny].Explored = true;
        }
    }

    // ------------------------------------------------------------------
    // Turn tick — called once per action that consumes a turn. Advances
    // the world clock AND runs per-turn item processes (spoilage, spillage)
    // and per-turn anatomy processes (bleeding, clotting, infection, shock).

    private void TickTurn()
    {
        _time.Tick();
        ItemSystem.ProcessFoodSpoilage(_player);
        ItemSystem.ProcessLiquidSpillage(_player);
        LightingSystem.TickFuel(_player, AddLog);

        AbilitySystem.TickEntity(_player);
        _player.TickSurvival(_player.Anatomy!, _time.Turn);

        // Active effect consequences — run before anatomy ProcessTurn so wounds feed in
        if (_player.HasEffect("grappled"))
        {
            _player.Anatomy!.AddWound("throat", 1.5, "puncture");
            AddMessage("You are being choked — blood loss!");
        }

        // Static Veil: reset all nearby NPCs to Unaware for 1 tick
        if (_player.HasEffect("static_veil_pulse"))
        {
            foreach (var npc in _world.Npcs)
            {
                if (npc.IsDead || npc.Z != _player.Z) continue;
                int dx = npc.X - _player.X; int dy = npc.Y - _player.Y;
                if (dx * dx + dy * dy <= 36)
                    npc.Detection = DetectionState.Unaware;
            }
            AddMessage("Static Veil pulses — nearby enemies lose you.");
        }

        var r = _player.Anatomy!.ProcessTurn(_time.Turn);
        foreach (var eff in r.Effects)
        {
            byte effColor = eff.Kind switch
            {
                "death"     => 196,  // bright red
                "shock"     => 201,  // magenta
                "blood"     => 203,  // pink-red
                "organ"     => 214,  // orange
                "infection" => 207,  // purple-pink
                _           => 250,
            };
            string msg = eff.Kind == "death" ? $"You {eff.Message}." : eff.Message;
            AddMessage(msg, effColor);
        }

        if (!r.Alive || _player.Anatomy.IsDead())
        {
            EnterGameOver();
            return;
        }

        ProcessNpcTurns();
        _sound.ProcessTurn();
        _world.SweepDead();

        // NPC attacks may have killed the player — check again.
        if (_player.Anatomy.IsDead())
            EnterGameOver();
    }

    /// <summary>
    /// Drive every "active" NPC's turn. An NPC is active if it's within
    /// <see cref="NpcActiveRange"/> of the player — distant NPCs stay dormant
    /// to keep per-turn cost bounded in a near-endless world.
    /// </summary>
    private void ProcessNpcTurns()
    {
        _ai.Turn = _time.Turn;

        // Snapshot: an NPC may die (or we may sweep) mid-iteration.
        var snapshot = _world.Npcs.ToArray();
        foreach (var npc in snapshot)
        {
            if (npc.IsDead) continue;
            if (npc.Z != _player.Z) continue;
            int dx = npc.X - _player.X;
            int dy = npc.Y - _player.Y;
            if (dx * dx + dy * dy > NpcActiveRange * NpcActiveRange) continue;

            AbilitySystem.TickEntity(npc);
            int baseCost = _player.HasEffect("overclocked") ? 50 : 100;
            double costMod = _player.ActionCostMod;
            // Adrenaline Junkie: -15% action cost when below 50% blood
            if (_player.AdrenalineRush > 0 && _player.Anatomy != null
                && _player.Anatomy.GetBloodPercent() < 50)
                costMod *= 0.85;
            int npcCost  = (int)(baseCost * costMod);
            npc.TakeTurn(_ai, npcCost);

            // Stop the loop early if the player was killed this NPC turn.
            if (_player.Anatomy?.IsDead() == true) break;
        }
    }

    /// <summary>Radius (in tiles) inside which NPCs are simulated per turn.</summary>
    private const int NpcActiveRange = 40;

    private void EnterGameOver()
    {
        if (_mode == GameMode.GameOver) return;
        AddMessage($"You {_player.Anatomy!.GetDeathCause()}.");
        _mode = GameMode.GameOver;
    }

    private void ProcessGameOverInput()
    {
        var info = InputSystem.ReadKey();
        if (info.Key == ConsoleKey.Escape || info.Key == ConsoleKey.Q || info.KeyChar == 'q')
        {
            _running = false;
            return;
        }
        if (info.Key == ConsoleKey.R || info.KeyChar == 'r')
        {
            _seed++;
            // New run — go through full chargen so the player can pick a new Origin/Background.
            _charData = CharacterCreationScreen.Run(_renderer);
            _worldManager = new WorldManager(_seed);
            _overworld    = OverworldMap.Build(_worldManager);
            OverworldScreen_RevealStart(_overworld);
            _player       = null!;   // force fresh player on next zone entry
            _zoneCache.Clear();       // wipe all cached zones for the new run
            _currentTile  = null;
            _seen.Clear();
            _log.Clear();
            AddMessage($"A new run begins. Seed {_seed}.", 226);
            _mode = GameMode.Overworld;
        }
    }

    // ------------------------------------------------------------------
    // FOV & render

    private void RecomputeFOV()
    {
        // 1. Ambient-driven base FOV. At night the floor is small but the
        //    player can always see their immediate surroundings.
        int baseR = _player.ViewRadius;
        double amb = _time.AmbientLight;
        int radius = (int)Math.Round(baseR * (0.35 + 0.65 * amb));
        if (radius < 3) radius = 3;
        _fov.Compute(_player.X, _player.Y, _player.Z, radius);

        // 2. Light solve. Any tile that's illuminated and in the player's
        //    line of sight becomes visible even if it was outside the
        //    ambient radius — streetlights, flashlights, etc.
        _lighting.Compute(_player, _time);
        foreach (var (key, brightness) in _lighting.LightMap)
        {
            if (brightness < LightingSystem.LitThreshold) continue;
            int lx = (int)(key >> 32);
            int ly = (int)(uint)key;
            if (_fov.HasLineOfSight(_player.X, _player.Y, lx, ly, _player.Z))
                _fov.AddVisible(lx, ly);
        }

        // 3. Everything visible this frame is also "remembered" next frame.
        foreach (var v in _fov.Visible) _seen.Add(v);

        _camera.TargetX = _player.X;
        _camera.TargetY = _player.Y;
        _camera.Width = _renderer.MapWidth;
        _camera.Height = _renderer.MapHeight;
    }

    private void Render()
    {
        _renderer.BeginFrame();

        // Overworld renders itself via OverworldScreen — nothing else to do here.
        if (_mode == GameMode.Overworld)
        {
            _renderer.Present();
            return;
        }

        _asciiRenderer.DrawWorld(_world, _camera, _fov, _seen, _player, _lighting, _time);

        // Combat VFX overlay (flashes, floating damage numbers)
        _vfx.Draw(_asciiRenderer, _camera.OriginX, _camera.OriginY,
                   _asciiRenderer.MapWidth, _asciiRenderer.MapHeight);

        // Tile underfoot for sidebar
        var underTile = _world.GetTile(_player.X, _player.Y, _player.Z);
        string tileUnderfoot = TileDisplayName(underTile.Type);

        // Inspect cursor overlay
        InspectInfo? inspectInfo = null;
        if (_inspecting)
        {
            inspectInfo = BuildInspectInfo(_inspectX, _inspectY, _player.Z);
            _asciiRenderer.DrawInspectCursor(_camera, _inspectX, _inspectY);
        }

        // Biome overlay and chunk-based sidebar data only apply when using WorldManager.
        if (_world is WorldManager wm)
        {
            if (_showBiomeOverlay)
                _asciiRenderer.DrawBiomeOverlay(wm, _camera);
            var biome = wm.GetBiomeAt(_player.X, _player.Y);
            var chunk = wm.GetChunk(FloorDiv(_player.X, Chunk.Size), FloorDiv(_player.Y, Chunk.Size));
            _asciiRenderer.DrawSidebar(_player, biome, chunk.District, _seed, _log, _time,
                tileUnderfoot: tileUnderfoot, inspect: inspectInfo);
        }
        else
        {
            _asciiRenderer.DrawSidebar(_player, Biome.UrbanCore, District.None, _seed, _log, _time,
                zoneName: _zoneProfile.Name, tileUnderfoot: tileUnderfoot, inspect: inspectInfo);
        }

        // Modal screens on top
        switch (_mode)
        {
            case GameMode.Inventory:
                InventoryScreen.Draw(_renderer, _player, _invSlots, _invCursor, _invSort, _invFilter, _invSearching, _invPocketCollapsed);
                if (_invSub == InvSubMode.MovePick)
                    InventoryScreen.DrawMovePicker(_renderer, _movePockets, _movePocketCursor);
                break;
            case GameMode.Character:
                CharacterScreen.Draw(_renderer, _player);
                break;
            case GameMode.Container:
                if (_containerTarget != null)
                    ContainerScreen.Draw(_renderer, _containerTarget, _containerSlots, _invCursor);
                break;
            case GameMode.OpenWith:
                // Draw inventory underneath so the picker feels layered on top of it.
                InventoryScreen.Draw(_renderer, _player, _invSlots, _invCursor, _invSort, _invFilter, _invSearching, _invPocketCollapsed);
                if (_openTarget != null)
                    OpenWithScreen.Draw(_renderer, _openTarget, _openOptions, _openCursor);
                break;
            case GameMode.Crafting:
                if (_craftSub == CraftSubMode.Craft)
                    CraftingScreen.DrawCraft(_renderer, _player, _crafting, _craftRecipes, _craftCursor);
                else
                    CraftingScreen.DrawDisassemble(_renderer, _player, _crafting, _disasmItems, _craftCursor);
                break;
            case GameMode.WorldObject:
                if (_woSub == WoSubMode.PickAction && _woTarget != null)
                    WorldObjectScreen.DrawActionList(_renderer, _woTarget, _woActions, _woActionCursor);
                else
                    WorldObjectScreen.DrawObjectList(_renderer, _woObjects, _woCursor);
                break;
            case GameMode.GameOver:
                GameOverScreen.Draw(_renderer, _player, _seed);
                break;
        }

        _renderer.Present();
    }

    private void AddMessage(string msg, byte color = 250)
    {
        _log.Add(new LogEntry(msg, color));
        if (_log.Count > 60) _log.RemoveAt(0);
    }

    private void AddLog(string msg) => AddMessage(msg);

    // ------------------------------------------------------------------
    // Inspect mode helpers

    private void EnterInspectMode()
    {
        _inspecting = true;
        _inspectX   = _player.X;
        _inspectY   = _player.Y;
    }

    private void ProcessInspectInput()
    {
        Render(); // show current state before blocking on next key
        var key = InputSystem.ReadKey();
        switch (key.Key)
        {
            case ConsoleKey.Escape:
            case ConsoleKey.L:
                _inspecting = false;
                break;
            case ConsoleKey.UpArrow:    case ConsoleKey.W: case ConsoleKey.K: case ConsoleKey.NumPad8: _inspectY--; break;
            case ConsoleKey.DownArrow:  case ConsoleKey.S: case ConsoleKey.J: case ConsoleKey.NumPad2: _inspectY++; break;
            case ConsoleKey.LeftArrow:  case ConsoleKey.A: case ConsoleKey.H: case ConsoleKey.NumPad4: _inspectX--; break;
            case ConsoleKey.RightArrow: case ConsoleKey.D: case ConsoleKey.NumPad6: _inspectX++; break;
            case ConsoleKey.Y: case ConsoleKey.NumPad7: _inspectX--; _inspectY--; break;
            case ConsoleKey.U: case ConsoleKey.NumPad9: _inspectX++; _inspectY--; break;
            case ConsoleKey.B: case ConsoleKey.NumPad1: _inspectX--; _inspectY++; break;
            case ConsoleKey.N: case ConsoleKey.NumPad3: _inspectX++; _inspectY++; break;
        }
        _inspectX = Math.Clamp(_inspectX, 0, _world.Width  - 1);
        _inspectY = Math.Clamp(_inspectY, 0, _world.Height - 1);
    }

    private InspectInfo BuildInspectInfo(int wx, int wy, int wz)
    {
        var tile = _world.GetTile(wx, wy, wz);
        string tileName = TileDisplayName(tile.Type);
        string tileDesc = TileDesc(tile.Type);

        // Object on tile
        var obj  = _world.GetObjectAt(wx, wy, wz);
        string? objName = obj?.Name;

        // NPC on tile — rich inspect data
        var npc = _world.GetNpcAt(wx, wy, wz);
        Nightrun.Rendering.NpcInspectData? npcData = null;
        if (npc != null)
        {
            bool alive = !npc.IsDead;
            var  blood = npc.Anatomy.GetBloodStatus();
            int  pct   = (int)npc.Anatomy.GetBloodPercent();
            (string detLabel, byte detColor) = npc.Detection switch
            {
                Nightrun.Entities.DetectionState.Unaware   => ("Unaware",   (byte)244),
                Nightrun.Entities.DetectionState.Alert     => ("Alert!",    (byte)214),
                Nightrun.Entities.DetectionState.Searching => ("Searching", (byte)226),
                Nightrun.Entities.DetectionState.Engaged   => ("ENGAGED",   (byte)196),
                Nightrun.Entities.DetectionState.Fleeing   => ("Fleeing",   (byte)51),
                _                                          => ("?",         (byte)244),
            };
            string weapon = npc.Weapon?.Name ?? "unarmed";
            npcData = new Nightrun.Rendering.NpcInspectData(
                npc.Name, npc.Hostile, alive,
                alive ? blood.Label : "DEAD",
                alive ? blood.Color : (byte)240,
                pct, detLabel, detColor, weapon,
                npc.Anatomy.Wounds.Count);
        }

        // Items on tile (ground items)
        var items = new List<string>();
        var groundItems = _world.GetItemsAt(wx, wy, wz);
        if (groundItems != null)
            foreach (var item in groundItems)
                items.Add(item.Name);

        return new InspectInfo(wx, wy, tileName, tileDesc, objName, npcData, items);
    }

    private static string TileDisplayName(TileType t) => t switch
    {
        TileType.None           => "void",
        TileType.Grass          => "grass",
        TileType.TallGrass      => "tall grass",
        TileType.Dirt           => "dirt",
        TileType.Mud            => "mud",
        TileType.Sand           => "sand",
        TileType.Gravel         => "gravel",
        TileType.Concrete       => "concrete",
        TileType.CrackedConcrete=> "cracked concrete",
        TileType.Asphalt        => "asphalt",
        TileType.Sidewalk       => "sidewalk",
        TileType.Water          => "deep water",
        TileType.ShallowWater   => "shallow water",
        TileType.Shore          => "shore",
        TileType.BrickWall      => "brick wall",
        TileType.ConcreteWall   => "concrete wall",
        TileType.WoodWall       => "wood wall",
        TileType.MetalWall      => "metal wall",
        TileType.RustedMetal    => "rusted metal",
        TileType.Floor          => "floor",
        TileType.WoodFloor      => "wood floor",
        TileType.TileFloor      => "tile floor",
        TileType.DoorClosed     => "door (closed)",
        TileType.DoorOpen       => "door (open)",
        TileType.Window         => "window",
        TileType.Highway        => "highway",
        TileType.HighwayLine    => "highway",
        TileType.Road           => "road",
        TileType.RoadLine       => "road",
        TileType.Alley          => "alley",
        TileType.Tree           => "tree",
        TileType.PineTree       => "pine tree",
        TileType.Bush           => "bush",
        TileType.Rock           => "rock",
        TileType.Stump          => "tree stump",
        TileType.Streetlight    => "streetlight",
        TileType.Bench          => "bench",
        TileType.Fence          => "fence",
        TileType.Rubble         => "rubble",
        TileType.Trash          => "trash",
        TileType.Barrier        => "barrier",
        TileType.SolidRock      => "solid rock",
        TileType.SewerFloor     => "sewer floor",
        TileType.SewerWall      => "sewer wall",
        TileType.Manhole        => "manhole cover",
        TileType.Ladder         => "ladder",
        TileType.StairsUp       => "stairs up",
        TileType.StairsDown     => "stairs down",
        _                       => t.ToString(),
    };

    private static string TileDesc(TileType t) => t switch
    {
        TileType.Grass          => "Open ground, easy to move through.",
        TileType.TallGrass      => "Conceals movement.",
        TileType.Water          => "Impassable. Deep water.",
        TileType.ShallowWater   => "Passable but slows movement.",
        TileType.BrickWall      or TileType.ConcreteWall
            or TileType.WoodWall or TileType.MetalWall => "Solid wall. Blocks sight.",
        TileType.DoorClosed     => "Closed door. Press E to open.",
        TileType.DoorOpen       => "Open door.",
        TileType.Window         => "Can be seen through. Blocks movement.",
        TileType.Tree           or TileType.PineTree => "Blocks sight and movement.",
        TileType.Rubble         => "Difficult terrain.",
        TileType.Manhole        => "Leads underground.",
        TileType.StairsUp       => "Press < to ascend.",
        TileType.StairsDown     => "Press > to descend.",
        TileType.Bench          => "Somewhere to sit.",
        TileType.Streetlight    => "Provides light at night.",
        TileType.Fence          => "Low barrier. Blocks movement.",
        TileType.Barrier        => "Heavy barrier. Blocks movement.",
        _                       => "",
    };

    private static int FloorDiv(int a, int b)
    {
        int q = a / b;
        if ((a ^ b) < 0 && q * b != a) q--;
        return q;
    }
}
