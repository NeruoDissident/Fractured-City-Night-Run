using Nightrun.Content;
using Nightrun.Entities;

namespace Nightrun.World;

/// <summary>
/// Bounded zone map — single flat tile grid with no chunk system.
/// Implements <see cref="IWorldMap"/> so every system that used to talk to
/// <see cref="WorldManager"/> works without modification.
///
/// Coordinate convention: (0,0) is top-left, X grows right, Y grows down.
/// Z=0 is ground level; negative Z values are underground (sewers, basements).
/// Only Z=0 is allocated for now — underground Z levels can be added per zone type.
/// </summary>
public sealed class ZoneManager : IWorldMap
{
    public readonly ZoneProfile Profile;
    public readonly uint Seed;
    public int Width  => Profile.Width;
    public int Height => Profile.Height;

    // Flat tile arrays per Z level. Z levels: MinZ..MaxZ inclusive.
    public int MinZ { get; }
    public int MaxZ { get; }
    private int ZRange => MaxZ - MinZ + 1;

    private readonly Tile[] _tiles;

    // World objects (doors, furniture). Index 0 = no object.
    private readonly List<WorldObject?> _objects = new() { null };

    // Ground items: sparse dict keyed on packed tile index.
    private readonly Dictionary<int, List<Item>> _items = new();

    // NPC list — flat, small enough for zone scale.
    private readonly List<Npc> _npcs = new();
    public IReadOnlyList<Npc> Npcs => _npcs;

    public ZoneManager(ZoneProfile profile, uint seed)
    {
        Profile = profile;
        Seed    = seed;
        MinZ    = profile.MinZ;
        MaxZ    = profile.MaxZ;
        _tiles  = new Tile[ZRange * Width * Height];
        FillZ(0, TileType.Floor);
    }

    // ------------------------------------------------------------------
    // Coordinate helpers

    private bool InBounds(int x, int y, int z)
        => x >= 0 && x < Width && y >= 0 && y < Height && z >= MinZ && z <= MaxZ;

    private int Index(int x, int y, int z)
        => ((z - MinZ) * Height + y) * Width + x;

    /// <summary>Fill an entire Z level with a single tile type (used during init and generation).</summary>
    public void FillZ(int z, TileType type)
    {
        var tile = new Tile(type);
        int baseIdx = (z - MinZ) * Height * Width;
        for (int i = 0; i < Width * Height; i++) _tiles[baseIdx + i] = tile;
    }

    // ------------------------------------------------------------------
    // IWorldMap — tile access

    public Tile GetTile(int x, int y, int z)
    {
        if (!InBounds(x, y, z)) return Tile.Empty;
        return _tiles[Index(x, y, z)];
    }

    public void SetTile(int x, int y, int z, Tile tile)
    {
        if (!InBounds(x, y, z)) return;
        _tiles[Index(x, y, z)] = tile;
    }

    public void SetTile(int x, int y, int z, TileType type)
        => SetTile(x, y, z, new Tile(type));

    public ref Tile RefTile(int x, int y, int z)
    {
        if (!InBounds(x, y, z)) throw new ArgumentOutOfRangeException($"Zone tile out of bounds: ({x},{y},{z})");
        return ref _tiles[Index(x, y, z)];
    }

    // ── Rect/line helpers used by the generator ─────────────────────

    public void FillRect(int x, int y, int w, int h, int z, TileType type)
    {
        for (int dy = 0; dy < h; dy++)
        for (int dx = 0; dx < w; dx++)
            SetTile(x + dx, y + dy, z, type);
    }

    public void DrawRect(int x, int y, int w, int h, int z, TileType border, TileType fill)
    {
        FillRect(x, y, w, h, z, border);
        if (w > 2 && h > 2)
            FillRect(x + 1, y + 1, w - 2, h - 2, z, fill);
    }

    public void DrawHLine(int x, int y, int len, int z, TileType type)
    {
        for (int i = 0; i < len; i++) SetTile(x + i, y, z, type);
    }

    public void DrawVLine(int x, int y, int len, int z, TileType type)
    {
        for (int i = 0; i < len; i++) SetTile(x, y + i, z, type);
    }

    // ------------------------------------------------------------------
    // IWorldMap — world objects

    /// <summary>Register a world object and stamp its id onto the underlying tile.</summary>
    public ushort AddObject(WorldObject obj)
    {
        if (_objects.Count >= ushort.MaxValue) return 0;
        ushort id = (ushort)_objects.Count;
        obj.Id = id;
        _objects.Add(obj);
        if (InBounds(obj.X, obj.Y, obj.Z))
        {
            ref var t = ref _tiles[Index(obj.X, obj.Y, obj.Z)];
            t.ObjectId = id;
            if (obj.Blocked)      t.Flags |= TileFlags.Blocked;
            if (obj.BlocksVision) t.Flags |= TileFlags.BlocksSight;
        }
        return id;
    }

    public WorldObject? GetObjectAt(int x, int y, int z)
    {
        if (!InBounds(x, y, z)) return null;
        var t = _tiles[Index(x, y, z)];
        if (t.ObjectId == 0 || t.ObjectId >= _objects.Count) return null;
        return _objects[t.ObjectId];
    }

    // ------------------------------------------------------------------
    // IWorldMap — items

    public IReadOnlyList<Item>? GetItemsAt(int x, int y, int z)
    {
        if (!InBounds(x, y, z)) return null;
        return _items.TryGetValue(Index(x, y, z), out var l) ? l : null;
    }

    public void AddItemAt(int x, int y, int z, Item item)
    {
        if (!InBounds(x, y, z)) return;
        int key = Index(x, y, z);
        if (!_items.TryGetValue(key, out var list))
        {
            list = new List<Item>();
            _items[key] = list;
        }
        list.Add(item);
    }

    public void RemoveItemAt(int x, int y, int z, Item item)
    {
        if (!InBounds(x, y, z)) return;
        int key = Index(x, y, z);
        if (!_items.TryGetValue(key, out var list)) return;
        list.Remove(item);
        if (list.Count == 0) _items.Remove(key);
    }

    // ------------------------------------------------------------------
    // IWorldMap — NPCs

    public void AddNpc(Npc n)  => _npcs.Add(n);
    public bool RemoveNpc(Npc n) => _npcs.Remove(n);

    public Npc? GetNpcAt(int x, int y, int z)
    {
        for (int i = 0; i < _npcs.Count; i++)
        {
            var n = _npcs[i];
            if (n.X == x && n.Y == y && n.Z == z && !n.IsDead) return n;
        }
        return null;
    }

    public int SweepDead()
    {
        int removed = 0;
        for (int i = _npcs.Count - 1; i >= 0; i--)
            if (_npcs[i].IsDead) { _npcs.RemoveAt(i); removed++; }
        return removed;
    }

    // ------------------------------------------------------------------
    // IWorldMap — spawn helper

    /// <summary>
    /// Find the first open floor tile scanning left-to-right, top-to-bottom.
    /// Guaranteed to return something on any generated map (there's always at
    /// least one open floor tile in the spawn room).
    /// </summary>
    public (int x, int y) FindSpawn()
    {
        for (int y = 1; y < Height - 1; y++)
        for (int x = 1; x < Width  - 1; x++)
        {
            var t = GetTile(x, y, 0);
            if (!t.IsBlocked && !t.IsWater && t.ObjectId == 0)
                return (x, y);
        }
        return (Width / 2, Height / 2);
    }

    /// <summary>
    /// Find a spawn point near a preferred location, spiraling outward.
    /// Used by the generator to place the player entry point precisely.
    /// </summary>
    public (int x, int y) FindSpawnNear(int px, int py)
    {
        for (int r = 0; r < 20; r++)
        for (int dy = -r; dy <= r; dy++)
        for (int dx = -r; dx <= r; dx++)
        {
            if (Math.Abs(dx) != r && Math.Abs(dy) != r) continue;
            int x = px + dx, y = py + dy;
            if (!InBounds(x, y, 0)) continue;
            var t = GetTile(x, y, 0);
            if (!t.IsBlocked && !t.IsWater && t.ObjectId == 0) return (x, y);
        }
        return FindSpawn();
    }
}
