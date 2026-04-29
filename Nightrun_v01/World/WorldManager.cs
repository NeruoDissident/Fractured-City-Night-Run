using Nightrun.Content;
using Nightrun.Core;
using Nightrun.Entities;
using Nightrun.WorldGen;

namespace Nightrun.World;

/// <summary>
/// Owns all chunks and exposes the world in global tile coordinates.
/// Chunks are generated on demand and cached. Designed for near-endless worlds.
/// </summary>
public sealed class WorldManager : IWorldMap
{
    public int MinZ => Chunk.MinZ;
    public int MaxZ => Chunk.MaxZ;
    public int Width  => int.MaxValue; // unbounded world
    public int Height => int.MaxValue;

    public readonly uint Seed;
    public readonly SimplexNoise BiomeNoise;
    public readonly SimplexNoise VarietyNoise;
    public readonly SimplexNoise DistrictNoise;
    public readonly SimplexNoise ElevationNoise;
    public readonly SimplexNoise MoistureNoise;
    public readonly BiomeMapper BiomeMapper;
    public readonly RoadNetworkGenerator RoadNetwork;

    private readonly Dictionary<long, Chunk> _chunks = new();
    private readonly ChunkGenerator _generator;

    // ── NPC registry ─────────────────────────────────────────────────────
    // Flat list, linearly scanned for GetNpcAt. Fine for the hundreds we
    // expect to have active at once; swap to a spatial hash if it ever hurts.
    private readonly List<Npc> _npcs = new();
    public IReadOnlyList<Npc> Npcs => _npcs;

    public void AddNpc(Npc n) => _npcs.Add(n);
    public bool RemoveNpc(Npc n) => _npcs.Remove(n);

    /// <summary>Find the first living NPC standing on (x, y, z), if any.</summary>
    public Npc? GetNpcAt(int x, int y, int z)
    {
        for (int i = 0; i < _npcs.Count; i++)
        {
            var n = _npcs[i];
            if (n.X == x && n.Y == y && n.Z == z && !n.IsDead) return n;
        }
        return null;
    }

    /// <summary>Remove every dead NPC from the registry. Call once per turn.</summary>
    public int SweepDead()
    {
        int removed = 0;
        for (int i = _npcs.Count - 1; i >= 0; i--)
            if (_npcs[i].IsDead) { _npcs.RemoveAt(i); removed++; }
        return removed;
    }

    public WorldManager(uint seed)
    {
        Seed = seed;
        // Distinct seed offsets so noise layers are independent
        BiomeNoise     = new SimplexNoise(seed + 1111);
        VarietyNoise   = new SimplexNoise(seed + 2222);
        DistrictNoise  = new SimplexNoise(seed + 3333);
        ElevationNoise = new SimplexNoise(seed + 4444);
        MoistureNoise  = new SimplexNoise(seed + 5555);

        BiomeMapper  = new BiomeMapper(this);
        RoadNetwork  = new RoadNetworkGenerator(this);
        _generator   = new ChunkGenerator(this);
    }

    /// <summary>Returns chunk at (cx, cy), generating and caching it if needed.</summary>
    public Chunk GetChunk(int cx, int cy)
    {
        long key = PackKey(cx, cy);
        if (_chunks.TryGetValue(key, out var existing)) return existing;

        var chunk = new Chunk(cx, cy);
        _chunks[key] = chunk;
        _generator.Generate(chunk);
        return chunk;
    }

    public Tile GetTile(int worldX, int worldY, int z)
    {
        DivMod(worldX, Chunk.Size, out int cx, out int lx);
        DivMod(worldY, Chunk.Size, out int cy, out int ly);
        return GetChunk(cx, cy).GetTile(lx, ly, z);
    }

    public void SetTile(int worldX, int worldY, int z, Tile tile)
    {
        DivMod(worldX, Chunk.Size, out int cx, out int lx);
        DivMod(worldY, Chunk.Size, out int cy, out int ly);
        GetChunk(cx, cy).SetTile(lx, ly, z, tile);
    }

    /// <summary>
    /// Direct reference to the tile at global coords. Use with care — the caller
    /// can mutate flags/damage/ObjectId in place without the world knowing.
    /// </summary>
    public ref Tile RefTile(int worldX, int worldY, int z)
    {
        DivMod(worldX, Chunk.Size, out int cx, out int lx);
        DivMod(worldY, Chunk.Size, out int cy, out int ly);
        return ref GetChunk(cx, cy).RefTile(lx, ly, z);
    }

    public Biome GetBiomeAt(int worldX, int worldY)
    {
        DivMod(worldX, Chunk.Size, out int cx, out _);
        DivMod(worldY, Chunk.Size, out int cy, out _);
        return BiomeMapper.BiomeAt(cx, cy);
    }

    /// <summary>Resolve the WorldObject at a global tile coordinate, if any.</summary>
    public WorldObject? GetObjectAt(int worldX, int worldY, int z)
    {
        DivMod(worldX, Chunk.Size, out int cx, out int lx);
        DivMod(worldY, Chunk.Size, out int cy, out int ly);
        return GetChunk(cx, cy).GetObjectAt(lx, ly, z);
    }

    /// <summary>Return ground items at a global tile coordinate (or null if none).</summary>
    public IReadOnlyList<Item>? GetItemsAt(int worldX, int worldY, int z)
    {
        DivMod(worldX, Chunk.Size, out int cx, out int lx);
        DivMod(worldY, Chunk.Size, out int cy, out int ly);
        return GetChunk(cx, cy).GetItems(lx, ly, z);
    }

    public void RemoveItemAt(int worldX, int worldY, int z, Item item)
    {
        DivMod(worldX, Chunk.Size, out int cx, out int lx);
        DivMod(worldY, Chunk.Size, out int cy, out int ly);
        GetChunk(cx, cy).RemoveItem(lx, ly, z, item);
    }

    public void AddItemAt(int worldX, int worldY, int z, Item item)
    {
        DivMod(worldX, Chunk.Size, out int cx, out int lx);
        DivMod(worldY, Chunk.Size, out int cy, out int ly);
        GetChunk(cx, cy).AddItem(lx, ly, z, item);
    }

    /// <summary>
    /// Find a reasonable player spawn point near the origin.
    /// Walks outward from (0,0) looking for a walkable non-road tile.
    /// </summary>
    public (int x, int y) FindSpawn()
    {
        for (int r = 0; r < 64; r++)
        {
            for (int dy = -r; dy <= r; dy++)
            {
                for (int dx = -r; dx <= r; dx++)
                {
                    if (Math.Abs(dx) != r && Math.Abs(dy) != r) continue;
                    var t = GetTile(dx, dy, 0);
                    if (!t.IsBlocked && !t.IsWater && !t.IsRoad) return (dx, dy);
                }
            }
        }
        return (0, 0);
    }

    private static void DivMod(int v, int m, out int q, out int r)
    {
        q = v / m;
        r = v % m;
        if (r < 0) { r += m; q -= 1; }
    }

    private static long PackKey(int cx, int cy)
        => ((long)cx << 32) | (uint)cy;
}
