using Nightrun.Content;
using Nightrun.Core;
using Nightrun.Entities;
using Nightrun.World;

namespace Nightrun.WorldGen;

/// <summary>
/// Single entry point that turns an empty Chunk into a fully generated one.
/// Pipeline (each stage is independent and swappable):
///   1. Assign biome + district
///   2. Fill underground (z=-1) with solid rock
///   3. Fill surface (z=0) with terrain (biome-aware + blending)
///   4. Compute global road segments passing through the chunk
///   5. Stamp roads onto terrain
///   6. Detect building blocks between roads
///   7. Fill blocks with buildings (biome-appropriate)
///   8. Decorate with natural features (trees, rocks, etc.)
/// </summary>
public sealed class ChunkGenerator
{
    private readonly WorldManager _world;
    private readonly TerrainGenerator _terrain;
    private readonly BuildingPlacer _buildings;

    public ChunkGenerator(WorldManager world)
    {
        _world = world;
        _terrain = new TerrainGenerator(world);
        _buildings = new BuildingPlacer(world);
    }

    public void Generate(Chunk chunk)
    {
        var rng = new RNG(RNG.HashCoords(chunk.Cx, chunk.Cy, _world.Seed));

        chunk.Biome    = _world.BiomeMapper.BiomeAt(chunk.Cx, chunk.Cy);
        chunk.District = _world.BiomeMapper.DistrictAt(chunk.Cx, chunk.Cy, chunk.Biome);

        // Underground layer — solid rock by default
        chunk.FillLevel(-1, TileType.SolidRock);

        // Surface terrain
        _terrain.Generate(chunk, rng);

        // Roads (deterministic global grid)
        var roads = _world.RoadNetwork.SegmentsFor(chunk);
        StampRoads(chunk, roads, rng);

        // Buildings on detected blocks
        if (chunk.Biome.HasBuildings())
        {
            var blocks = BlockDetector.Detect(roads);
            foreach (var block in blocks)
                _buildings.FillBlock(chunk, block, roads, rng);
        }

        // Natural decorations — trees, rocks — respecting what's already placed
        Decorate(chunk, rng);

        // Scatter small outdoor loot on untagged open tiles
        ScatterOutdoorLoot(chunk, rng);

        // Spawn hostile / wandering NPCs based on biome
        SpawnNpcs(chunk, rng);

        chunk.Generated = true;
    }

    // ---------------------------------------------------------------------
    // NPC spawning

    /// <summary>
    /// One entry in a chunk's NPC spawn table — <see cref="TypeKey"/> matches
    /// <see cref="NpcTypes.All"/>. Weights are relative; rolled via weighted pick.
    /// </summary>
    private readonly record struct NpcSpawn(int Weight, string TypeKey);

    private static readonly NpcSpawn[] UrbanTable =
    {
        new(40, "raider"),
        new(25, "armed_raider"),
        new(20, "scavenger"),
        new(10, "brute"),
        new( 5, "stalker"),
    };
    private static readonly NpcSpawn[] SuburbTable =
    {
        new(45, "scavenger"),
        new(30, "raider"),
        new(15, "armed_raider"),
        new(10, "stalker"),
    };
    private static readonly NpcSpawn[] RuinsTable =
    {
        new(40, "scavenger"),
        new(35, "raider"),
        new(15, "brute"),
        new(10, "armed_raider"),
    };
    private static readonly NpcSpawn[] RuralTable =
    {
        new(70, "scavenger"),
        new(20, "raider"),
        new(10, "stalker"),
    };
    private static readonly NpcSpawn[] ForestTable =
    {
        new(60, "stalker"),
        new(40, "scavenger"),
    };
    private static readonly NpcSpawn[] CoastTable =
    {
        new(80, "scavenger"),
        new(20, "raider"),
    };
    private static readonly NpcSpawn[] RichTable =
    {
        new(55, "armed_raider"),
        new(25, "scavenger"),
        new(15, "raider"),
        new( 5, "brute"),
    };

    /// <summary>
    /// (minCount, maxCount) per biome. rng.Range(min, max+1) guarantees at
    /// least <c>min</c> NPCs per chunk in hostile biomes.
    /// </summary>
    private static (int minCount, int maxCount, NpcSpawn[] table) SpawnProfileFor(Biome b) => b switch
    {
        Biome.UrbanCore        => (2, 5, UrbanTable),
        Biome.Suburbs          => (1, 3, SuburbTable),
        Biome.Ruins            => (3, 6, RuinsTable),
        Biome.Rural            => (0, 2, RuralTable),
        Biome.Forest           => (0, 2, ForestTable),
        Biome.Coast            => (0, 1, CoastTable),
        Biome.RichNeighborhood => (1, 3, RichTable),
        _                      => (0, 0, Array.Empty<NpcSpawn>()),
    };

    private void SpawnNpcs(Chunk chunk, RNG rng)
    {
        // Safety buffer — only the player's spawn chunk is NPC-free.
        if (chunk.Cx == 0 && chunk.Cy == 0) return;

        var (minCount, maxCount, table) = SpawnProfileFor(chunk.Biome);
        if (maxCount <= 0 || table.Length == 0) return;

        int count = rng.Range(minCount, maxCount + 1);
        int S = Chunk.Size;

        for (int i = 0; i < count; i++)
        {
            string typeKey = PickNpcType(table, rng);
            if (!NpcTypes.All.TryGetValue(typeKey, out var profile)) continue;

            // Find a walkable tile — up to 30 tries then give up.
            for (int tries = 0; tries < 30; tries++)
            {
                int lx = rng.Range(0, S);
                int ly = rng.Range(0, S);
                var t = chunk.GetTile(lx, ly, 0);
                if (t.IsBlocked || t.IsWater || t.IsRoad) continue;
                if (t.IsWall || t.IsDoor) continue;

                int wx = chunk.Cx * S + lx;
                int wy = chunk.Cy * S + ly;
                if (_world.GetNpcAt(wx, wy, 0) != null) continue;

                var perNpcRng = new Random(unchecked((int)rng.NextUInt()));
                var npc = new Npc(profile, wx, wy, 0, perNpcRng);
                _world.AddNpc(npc);
                break;
            }
        }
    }

    private static string PickNpcType(NpcSpawn[] table, RNG rng)
    {
        int total = 0;
        foreach (var e in table) total += e.Weight;
        int roll = rng.Range(0, total);
        foreach (var e in table)
        {
            roll -= e.Weight;
            if (roll < 0) return e.TypeKey;
        }
        return table[^1].TypeKey;
    }

    /// <summary>
    /// Very low-density per-tile loot drop on open outdoor terrain — grass, dirt,
    /// concrete, sidewalks. Skips interiors (prefab floors) since those are
    /// already covered by room loot tables.
    /// </summary>
    private static void ScatterOutdoorLoot(Chunk chunk, RNG rng)
    {
        int S = Chunk.Size;
        var table = LootTables.Outdoor;
        for (int y = 0; y < S; y++)
        for (int x = 0; x < S; x++)
        {
            var t = chunk.GetTile(x, y, 0);
            if (t.IsBlocked || t.IsRoad || t.IsWater) continue;
            if (t.IsWall || t.IsDoor) continue;
            if (t.ObjectId != 0) continue;
            // Skip prefab interior floors — they have their own loot
            if (t.Type == TileType.WoodFloor || t.Type == TileType.TileFloor
                || t.Type == TileType.Floor) continue;

            if (!rng.Chance(table.SpawnChance)) continue;
            var item = LootTables.Roll(table, rng);
            if (item != null) chunk.AddItem(x, y, 0, item);
        }
    }

    // ---------------------------------------------------------------------

    private void StampRoads(Chunk chunk, List<RoadSegment> segments, RNG rng)
    {
        int S = Chunk.Size;
        foreach (var seg in segments)
        {
            int half = seg.Width / 2;
            int halfUp = (seg.Width - 1) / 2;

            TileType road = seg.Class switch
            {
                RoadClass.Highway  => TileType.Highway,
                RoadClass.Arterial => TileType.Road,
                RoadClass.Side     => TileType.Road,
                RoadClass.Alley    => TileType.Alley,
                _                  => TileType.Road,
            };

            if (seg.Horizontal)
            {
                for (int x = seg.Start; x <= seg.End; x++)
                {
                    for (int dy = -half; dy <= halfUp; dy++)
                    {
                        int y = seg.Offset + dy;
                        if (y < 0 || y >= S) continue;
                        chunk.SetTile(x, y, 0, new Tile(road));
                    }
                    // Center line for highways/arterials
                    if (seg.Class <= RoadClass.Arterial && (x - seg.Start) % 4 == 0)
                    {
                        int cy = seg.Offset;
                        if (cy >= 0 && cy < S)
                        {
                            var line = seg.Class == RoadClass.Highway
                                ? TileType.HighwayLine : TileType.RoadLine;
                            chunk.SetTile(x, cy, 0, new Tile(line));
                        }
                    }
                }
                // Sidewalks on both sides for wider roads in urban biomes
                if (chunk.Biome == Biome.UrbanCore || chunk.Biome == Biome.Suburbs)
                {
                    PaintSidewalkH(chunk, seg);
                }
            }
            else
            {
                for (int y = seg.Start; y <= seg.End; y++)
                {
                    for (int dx = -half; dx <= halfUp; dx++)
                    {
                        int x = seg.Offset + dx;
                        if (x < 0 || x >= S) continue;
                        chunk.SetTile(x, y, 0, new Tile(road));
                    }
                    if (seg.Class <= RoadClass.Arterial && (y - seg.Start) % 4 == 0)
                    {
                        int cx = seg.Offset;
                        if (cx >= 0 && cx < S)
                        {
                            var line = seg.Class == RoadClass.Highway
                                ? TileType.HighwayLine : TileType.RoadLine;
                            chunk.SetTile(cx, y, 0, new Tile(line));
                        }
                    }
                }
                if (chunk.Biome == Biome.UrbanCore || chunk.Biome == Biome.Suburbs)
                {
                    PaintSidewalkV(chunk, seg);
                }
            }
        }
    }

    private static void PaintSidewalkH(Chunk chunk, RoadSegment seg)
    {
        int edgeOffset = seg.Width / 2 + 1;
        int S = Chunk.Size;
        for (int x = seg.Start; x <= seg.End; x++)
        {
            foreach (int dy in new[] { -edgeOffset, edgeOffset })
            {
                int y = seg.Offset + dy;
                if (y >= 0 && y < S)
                {
                    var t = chunk.GetTile(x, y, 0);
                    if (!t.IsRoad && !t.IsWall) chunk.SetTile(x, y, 0, new Tile(TileType.Sidewalk));
                }
            }
            // Streetlights: every 12 world tiles along one side of the road.
            // Deterministic on global X so neighbouring chunks line up.
            int gx = chunk.Cx * Chunk.Size + x;
            if (gx % 12 == 0)
            {
                int y = seg.Offset + edgeOffset;
                if (y >= 0 && y < S)
                {
                    var t = chunk.GetTile(x, y, 0);
                    if (t.Type == TileType.Sidewalk)
                        chunk.SetTile(x, y, 0, new Tile(TileType.Streetlight));
                }
            }
        }
    }

    private static void PaintSidewalkV(Chunk chunk, RoadSegment seg)
    {
        int edgeOffset = seg.Width / 2 + 1;
        int S = Chunk.Size;
        for (int y = seg.Start; y <= seg.End; y++)
        {
            foreach (int dx in new[] { -edgeOffset, edgeOffset })
            {
                int x = seg.Offset + dx;
                if (x >= 0 && x < S)
                {
                    var t = chunk.GetTile(x, y, 0);
                    if (!t.IsRoad && !t.IsWall) chunk.SetTile(x, y, 0, new Tile(TileType.Sidewalk));
                }
            }
            int gy = chunk.Cy * Chunk.Size + y;
            if (gy % 12 == 0)
            {
                int x = seg.Offset + edgeOffset;
                if (x >= 0 && x < S)
                {
                    var t = chunk.GetTile(x, y, 0);
                    if (t.Type == TileType.Sidewalk)
                        chunk.SetTile(x, y, 0, new Tile(TileType.Streetlight));
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Natural decorations. Only placed on open ground — not roads, not walls,
    // not water. Frequency varies by biome.
    private void Decorate(Chunk chunk, RNG rng)
    {
        int S = Chunk.Size;
        var biome = chunk.Biome;

        double treeChance = biome switch
        {
            Biome.Forest           => 0.35,
            Biome.Rural            => 0.05,
            Biome.Suburbs          => 0.02,
            Biome.RichNeighborhood => 0.03,
            Biome.Ruins            => 0.04,
            Biome.Coast            => 0.01,
            _                      => 0.0,
        };

        double rockChance = biome switch
        {
            Biome.Forest => 0.02,
            Biome.Rural  => 0.01,
            Biome.Coast  => 0.02,
            Biome.Ruins  => 0.04,
            _            => 0.0,
        };

        for (int y = 0; y < S; y++)
        for (int x = 0; x < S; x++)
        {
            var t = chunk.GetTile(x, y, 0);
            if (t.IsBlocked || t.IsRoad || t.IsWater) continue;
            if (t.Type == TileType.Sidewalk) continue;

            if (rng.Chance(treeChance))
            {
                var tree = (biome == Biome.Forest && rng.Chance(0.5))
                    ? TileType.PineTree : TileType.Tree;
                chunk.SetTile(x, y, 0, new Tile(tree));
            }
            else if (rng.Chance(rockChance))
            {
                chunk.SetTile(x, y, 0, new Tile(TileType.Rock));
            }
        }
    }
}
