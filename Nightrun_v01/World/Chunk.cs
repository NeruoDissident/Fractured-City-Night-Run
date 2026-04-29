using Nightrun.Content;

namespace Nightrun.World;

/// <summary>
/// A fixed-size tile region at integer chunk coordinates (cx, cy).
/// Stores multiple Z-levels: 0 = surface, -N = underground, +N = floors above.
/// Also owns per-chunk world objects (doors, furniture) and ground items.
/// Only generated once per session and cached by the WorldManager.
/// </summary>
public sealed class Chunk
{
    public const int Size = 64;
    public const int MinZ = -1;
    public const int MaxZ = 2;
    public const int ZRange = MaxZ - MinZ + 1;

    public readonly int Cx;
    public readonly int Cy;
    public Biome Biome;
    public District District;
    public bool Generated;

    // Flat tile array: [ z * (Size*Size) + y * Size + x ]
    // Z offset so MinZ maps to index 0.
    private readonly Tile[] _tiles = new Tile[ZRange * Size * Size];

    // World objects stored by 1-based ushort id; index 0 means "no object".
    // Tile.ObjectId references into this list.
    private readonly List<WorldObject?> _objects = new() { null };

    // Ground items keyed by packed (lx, ly, z) — sparse, most tiles have none.
    private readonly Dictionary<int, List<Item>> _items = new();

    public IReadOnlyList<WorldObject?> Objects => _objects;

    public Chunk(int cx, int cy)
    {
        Cx = cx;
        Cy = cy;
    }

    private static int Index(int x, int y, int z)
        => ((z - MinZ) * Size + y) * Size + x;

    public bool InBounds(int x, int y, int z)
        => x >= 0 && x < Size && y >= 0 && y < Size && z >= MinZ && z <= MaxZ;

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
    {
        if (!InBounds(x, y, z)) return;
        _tiles[Index(x, y, z)] = new Tile(type);
    }

    /// <summary>Direct reference — lets callers modify flags/damage in place.</summary>
    public ref Tile RefTile(int x, int y, int z)
    {
        if (!InBounds(x, y, z)) throw new ArgumentOutOfRangeException();
        return ref _tiles[Index(x, y, z)];
    }

    /// <summary>Fills an entire Z-level with a single tile type (used during init).</summary>
    public void FillLevel(int z, TileType type)
    {
        var tile = new Tile(type);
        int baseIdx = (z - MinZ) * Size * Size;
        for (int i = 0; i < Size * Size; i++) _tiles[baseIdx + i] = tile;
    }

    // ------------------------------------------------------------------
    // World objects (doors, furniture, etc.)

    /// <summary>Register a WorldObject and stamp its id onto the tile it occupies.</summary>
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
            // Objects can force blocking/vision flags on the tile beneath them.
            if (obj.Blocked)      t.Flags |= TileFlags.Blocked;
            if (obj.BlocksVision) t.Flags |= TileFlags.BlocksSight;
        }
        return id;
    }

    public WorldObject? GetObject(ushort id)
    {
        if (id == 0 || id >= _objects.Count) return null;
        return _objects[id];
    }

    public WorldObject? GetObjectAt(int x, int y, int z)
    {
        var t = GetTile(x, y, z);
        return GetObject(t.ObjectId);
    }

    // ------------------------------------------------------------------
    // Ground items

    public void AddItem(int x, int y, int z, Item item)
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

    public IReadOnlyList<Item>? GetItems(int x, int y, int z)
    {
        if (!InBounds(x, y, z)) return null;
        return _items.TryGetValue(Index(x, y, z), out var l) ? l : null;
    }

    public bool RemoveItem(int x, int y, int z, Item item)
    {
        if (!InBounds(x, y, z)) return false;
        int key = Index(x, y, z);
        if (!_items.TryGetValue(key, out var list)) return false;
        bool ok = list.Remove(item);
        if (list.Count == 0) _items.Remove(key);
        return ok;
    }
}
