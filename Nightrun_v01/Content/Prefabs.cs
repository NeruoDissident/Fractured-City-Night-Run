using Nightrun.Core;
using Nightrun.World;

namespace Nightrun.Content;

/// <summary>
/// A rectangular zone within a prefab tagged with a roomType for loot spawning.
/// </summary>
public readonly record struct LootZone(int X, int Y, int W, int H, string RoomType);

/// <summary>
/// A furniture placement spec inside a prefab. Coordinates are local to prefab origin.
/// </summary>
public readonly record struct FurnitureSpawn(FurnitureKind Kind, int X, int Y);

public sealed class BuildingPrefab
{
    public required string Id;
    public required string Name;
    public required int Width;
    public required int Height;
    public required Biome[] Biomes;
    public required string[] Layout;        // rows of ASCII — # | - . + d _ < >
    public required LootZone[] LootZones;
    public required FurnitureSpawn[] FurnitureSpawns;
    public double LockChance = 0.5;
    public bool HasUpstairs = false;
    public bool HasBasement = false;
}

/// <summary>
/// Orientation for prefab placement. 'Bottom' is the natural authoring orientation —
/// the door sits on the bottom row. Other values rotate/flip the prefab so the
/// door faces the requested side.
/// </summary>
public enum DoorSide : byte { Top, Right, Bottom, Left }

/// <summary>
/// Registry of all building prefabs. Ported 1:1 from JS BUILDING_PREFABS.
/// </summary>
public static class Prefabs
{
    // Initialized in the static ctor so the private Biome[] arrays below
    // are guaranteed to be populated first (static field initializers run
    // in textual order, which bites if you reference later fields early).
    public static readonly BuildingPrefab[] All;

    static Prefabs()
    {
        All = BuildAll();
    }

    /// <summary>
    /// Pick a prefab that fits within (width, height), matches the biome, and is
    /// close enough in size to use the full block. Returns null if no match.
    /// </summary>
    public static BuildingPrefab? FindMatching(int width, int height, Biome biome, RNG rng)
    {
        int tolW = width  >= 24 ? 8 : width  >= 16 ? 6 : 4;
        int tolH = height >= 24 ? 8 : height >= 16 ? 6 : 4;

        var candidates = new List<BuildingPrefab>();
        foreach (var p in All)
        {
            bool biomeOk = false;
            foreach (var b in p.Biomes) { if (b == biome) { biomeOk = true; break; } }
            if (!biomeOk) continue;
            if (p.Width > width || p.Height > height) continue;
            if (p.Width < width - tolW || p.Height < height - tolH) continue;
            candidates.Add(p);
        }
        if (candidates.Count == 0) return null;

        // Prefer larger prefabs — sort by area descending and pick from top few
        candidates.Sort((a, b) => (b.Width * b.Height) - (a.Width * a.Height));
        int pool = Math.Min(candidates.Count, 3);
        return candidates[rng.Range(0, pool)];
    }

    /// <summary>
    /// Return an oriented copy of the prefab so its door faces <paramref name="side"/>.
    /// If side == Bottom, returns the prefab unchanged.
    /// </summary>
    public static BuildingPrefab Orient(BuildingPrefab p, DoorSide side)
    {
        if (side == DoorSide.Bottom) return p;

        int W = p.Width, H = p.Height;
        string[] layout;
        int newW, newH;
        Func<LootZone, LootZone> mapLZ;
        Func<FurnitureSpawn, FurnitureSpawn> mapFS;

        static char SwapWall(char c) => c switch { '|' => '-', '-' => '|', _ => c };

        switch (side)
        {
            case DoorSide.Top:
                newW = W; newH = H;
                layout = new string[H];
                for (int i = 0; i < H; i++) layout[i] = p.Layout[H - 1 - i];
                mapLZ = z => new LootZone(z.X, H - z.Y - z.H, z.W, z.H, z.RoomType);
                mapFS = f => new FurnitureSpawn(f.Kind, f.X, H - 1 - f.Y);
                break;

            case DoorSide.Right:
                // Rotate 90° CCW so bottom→right
                newW = H; newH = W;
                layout = new string[W];
                for (int r = 0; r < W; r++)
                {
                    var buf = new char[H];
                    for (int c = 0; c < H; c++) buf[c] = SwapWall(p.Layout[c][W - 1 - r]);
                    layout[r] = new string(buf);
                }
                mapLZ = z => new LootZone(z.Y, W - z.X - z.W, z.H, z.W, z.RoomType);
                mapFS = f => new FurnitureSpawn(f.Kind, f.Y, W - 1 - f.X);
                break;

            case DoorSide.Left:
                // Rotate 90° CW so bottom→left
                newW = H; newH = W;
                layout = new string[W];
                for (int r = 0; r < W; r++)
                {
                    var buf = new char[H];
                    for (int c = 0; c < H; c++) buf[c] = SwapWall(p.Layout[H - 1 - c][r]);
                    layout[r] = new string(buf);
                }
                mapLZ = z => new LootZone(H - z.Y - z.H, z.X, z.H, z.W, z.RoomType);
                mapFS = f => new FurnitureSpawn(f.Kind, H - 1 - f.Y, f.X);
                break;

            default:
                return p;
        }

        var lz = new LootZone[p.LootZones.Length];
        for (int i = 0; i < lz.Length; i++) lz[i] = mapLZ(p.LootZones[i]);
        var fs = new FurnitureSpawn[p.FurnitureSpawns.Length];
        for (int i = 0; i < fs.Length; i++) fs[i] = mapFS(p.FurnitureSpawns[i]);

        return new BuildingPrefab
        {
            Id = p.Id, Name = p.Name,
            Width = newW, Height = newH,
            Layout = layout,
            Biomes = p.Biomes,
            LootZones = lz,
            FurnitureSpawns = fs,
            LockChance = p.LockChance,
            HasUpstairs = p.HasUpstairs,
            HasBasement = p.HasBasement,
        };
    }

    // --------------------------------------------------------------------
    // Shorthand helpers for building the registry

    private static FurnitureSpawn F(FurnitureKind k, int x, int y) => new(k, x, y);
    private static LootZone Z(int x, int y, int w, int h, string t) => new(x, y, w, h, t);

    private const FurnitureKind Cab = FurnitureKind.Cabinet,
                                Dre = FurnitureKind.Dresser,
                                Shf = FurnitureKind.Shelf,
                                Loc = FurnitureKind.Locker,
                                Crt = FurnitureKind.Crate,
                                Fil = FurnitureKind.FilingCabinet,
                                Tbl = FurnitureKind.Table,
                                Chr = FurnitureKind.Chair,
                                Cch = FurnitureKind.Couch,
                                Bed = FurnitureKind.Bed,
                                Snk = FurnitureKind.Sink,
                                Cnt = FurnitureKind.Counter,
                                Stv = FurnitureKind.Stove,
                                Toi = FurnitureKind.Toilet,
                                Shw = FurnitureKind.Shower,
                                Wkb = FurnitureKind.Workbench;

    private static readonly Biome[] BUrbanSub     = { Biome.UrbanCore, Biome.Suburbs };
    private static readonly Biome[] BUrban        = { Biome.UrbanCore };
    private static readonly Biome[] BUrbanSubInd  = { Biome.UrbanCore, Biome.Suburbs, Biome.Industrial };
    private static readonly Biome[] BUrbanInd     = { Biome.UrbanCore, Biome.Industrial };
    private static readonly Biome[] BSubRural     = { Biome.Suburbs, Biome.Rural };
    private static readonly Biome[] BSubRurRich   = { Biome.Suburbs, Biome.Rural, Biome.RichNeighborhood };
    private static readonly Biome[] BSubRich      = { Biome.Suburbs, Biome.RichNeighborhood };
    private static readonly Biome[] BSubRurInd    = { Biome.Suburbs, Biome.Rural, Biome.Industrial };
    private static readonly Biome[] BIndUrban     = { Biome.Industrial, Biome.UrbanCore };
    private static readonly Biome[] BRich         = { Biome.RichNeighborhood };
    private static readonly Biome[] BUrbanRuinInd = { Biome.UrbanCore, Biome.Ruins, Biome.Industrial };
    private static readonly Biome[] BSubUrbanRichRural = { Biome.Suburbs, Biome.UrbanCore, Biome.RichNeighborhood, Biome.Rural };
    private static readonly Biome[] BSubUrbRichMix     = { Biome.UrbanCore, Biome.Suburbs, Biome.RichNeighborhood };
    private static readonly Biome[] BUrbIndRich        = { Biome.UrbanCore, Biome.Industrial, Biome.RichNeighborhood };

    // --------------------------------------------------------------------

    private static BuildingPrefab[] BuildAll()
    {
        var list = new List<BuildingPrefab>();

        // 10x8 studio apartment
        list.Add(new BuildingPrefab
        {
            Id = "studio_apartment", Name = "Studio Apartment",
            Width = 10, Height = 8, Biomes = BUrbanSub,
            Layout = new[]
            {
                "##########",
                "#...|....#",
                "#...d....#",
                "#...|....#",
                "#........#",
                "#........#",
                "#........#",
                "####+#####",
            },
            LootZones = new[]
            {
                Z(1,1,3,3,"residential_bathroom"),
                Z(5,1,4,3,"residential_kitchen"),
                Z(1,4,8,3,"residential_living"),
            },
            FurnitureSpawns = new[]
            {
                F(Toi,1,1), F(Snk,2,1), F(Cnt,5,1), F(Stv,7,1), F(Cab,8,1),
                F(Cch,2,5), F(Tbl,5,5), F(Shf,7,6),
            },
            LockChance = 0.5,
        });

        // 12x10 corner store
        list.Add(new BuildingPrefab
        {
            Id = "corner_store", Name = "Corner Store",
            Width = 12, Height = 10, Biomes = BUrbanSubInd,
            Layout = new[]
            {
                "############",
                "#..........#",
                "#..........#",
                "#----d-----#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#####+######",
            },
            LootZones = new[]
            {
                Z(1,1,10,2,"commercial_backroom"),
                Z(1,4,10,5,"commercial_store"),
            },
            FurnitureSpawns = new[]
            {
                F(Shf,1,1), F(Crt,5,1), F(Crt,8,2),
                F(Shf,1,5), F(Shf,1,6), F(Shf,1,7),
                F(Shf,5,5), F(Shf,5,6), F(Shf,5,7),
                F(Cnt,8,4),
            },
            LockChance = 0.7, HasBasement = true,
        });

        // 16x14 two-bedroom apartment
        list.Add(new BuildingPrefab
        {
            Id = "two_bedroom_apartment", Name = "2BR Apartment",
            Width = 16, Height = 14, Biomes = BUrbanSub,
            Layout = new[]
            {
                "################",
                "#......|.......#",
                "#......|.......#",
                "#......|.......#",
                "#......d.......#",
                "#---d--|--d----#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#----|---d-----#",
                "#....d.........#",
                "#....|.........#",
                "#######+########",
            },
            LootZones = new[]
            {
                Z(1,1,6,4,"residential_bedroom"),
                Z(8,1,7,4,"residential_bedroom"),
                Z(1,6,14,4,"residential_living"),
                Z(1,10,4,3,"residential_bathroom"),
                Z(6,10,9,3,"residential_kitchen"),
            },
            FurnitureSpawns = new[]
            {
                F(Bed,1,1),  F(Dre,4,1), F(Bed,8,1), F(Dre,12,1),
                F(Cch,3,7),  F(Tbl,6,7), F(Shf,10,6), F(Cab,13,6),
                F(Toi,1,11), F(Snk,2,11), F(Cnt,6,11), F(Stv,8,11),
                F(Cab,10,10), F(Cab,13,10),
            },
            LockChance = 0.5,
        });

        // 14x14 small office
        list.Add(new BuildingPrefab
        {
            Id = "small_office", Name = "Small Office",
            Width = 14, Height = 14, Biomes = BUrbanInd,
            Layout = new[]
            {
                "##############",
                "#............#",
                "#............#",
                "#............#",
                "#----d-------#",
                "#............#",
                "#............#",
                "#............#",
                "#............#",
                "#-------d----#",
                "#............#",
                "#............#",
                "#............#",
                "######+#######",
            },
            LootZones = new[]
            {
                Z(1,1,12,3,"office"),
                Z(1,5,12,4,"office_reception"),
                Z(1,10,12,3,"office"),
            },
            FurnitureSpawns = new[]
            {
                F(Tbl,3,1), F(Chr,4,2), F(Fil,10,1),
                F(Tbl,5,6), F(Chr,6,7), F(Chr,3,6), F(Fil,1,5),
                F(Tbl,3,11), F(Chr,4,11), F(Fil,10,10),
            },
            LockChance = 0.6, HasUpstairs = true,
        });

        // 10x10 pharmacy
        list.Add(new BuildingPrefab
        {
            Id = "pharmacy", Name = "Pharmacy",
            Width = 10, Height = 10, Biomes = BUrbanSub,
            Layout = new[]
            {
                "##########",
                "#........#",
                "#........#",
                "#........#",
                "#---d----#",
                "#........#",
                "#........#",
                "#........#",
                "#........#",
                "####+#####",
            },
            LootZones = new[]
            {
                Z(1,1,8,3,"medical_storage"),
                Z(1,5,8,4,"medical_store"),
            },
            FurnitureSpawns = new[]
            {
                F(Cab,1,1), F(Cab,3,1), F(Shf,6,2), F(Cab,8,2),
                F(Cnt,7,5), F(Shf,1,6), F(Shf,1,7), F(Shf,4,6), F(Shf,4,7),
            },
            LockChance = 0.8,
        });

        // 12x10 garage
        list.Add(new BuildingPrefab
        {
            Id = "garage", Name = "Garage",
            Width = 12, Height = 10, Biomes = BSubRurInd,
            Layout = new[]
            {
                "############",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..|---d---#",
                "#..|.......#",
                "#####+######",
            },
            LootZones = new[]
            {
                Z(1,1,10,6,"garage_bay"),
                Z(4,7,7,2,"garage_tools"),
            },
            FurnitureSpawns = new[]
            {
                F(Wkb,1,1), F(Loc,9,1), F(Crt,5,3),
                F(Shf,4,8), F(Wkb,7,8), F(Loc,10,8),
            },
            LockChance = 0.4,
        });

        // 16x14 clinic
        list.Add(new BuildingPrefab
        {
            Id = "clinic", Name = "Clinic",
            Width = 16, Height = 14, Biomes = BUrbanSub,
            Layout = new[]
            {
                "################",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#---d----d-----#",
                "#.....|........#",
                "#.....|........#",
                "#.....|........#",
                "#---d-|--d-----#",
                "#.....|........#",
                "#.....|........#",
                "#.....|........#",
                "#######+########",
            },
            LootZones = new[]
            {
                Z(1,1,14,4,"medical_waiting"),
                Z(1,6,5,3,"medical_exam"),
                Z(7,6,8,3,"medical_exam"),
                Z(1,10,5,3,"medical_storage"),
                Z(7,10,8,3,"medical_exam"),
            },
            FurnitureSpawns = new[]
            {
                F(Chr,2,1), F(Chr,4,1), F(Chr,6,1), F(Cnt,12,1), F(Cab,14,1),
                F(Tbl,2,7), F(Cab,4,6), F(Tbl,9,7), F(Cab,12,6),
                F(Cab,1,11), F(Shf,3,11), F(Cab,4,10),
                F(Tbl,9,11), F(Cab,12,10),
            },
            LockChance = 0.7, HasBasement = true,
        });

        // 20x20 warehouse
        list.Add(new BuildingPrefab
        {
            Id = "warehouse", Name = "Warehouse",
            Width = 20, Height = 20, Biomes = BIndUrban,
            Layout = new[]
            {
                "####################",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#------d-----------#",
                "#......|...........#",
                "#......|...........#",
                "#---d--|-----d-----#",
                "#......|...........#",
                "#......|...........#",
                "#......|...........#",
                "#########+##########",
            },
            LootZones = new[]
            {
                Z(1,1,18,11,"warehouse_floor"),
                Z(1,13,6,2,"office"),
                Z(8,13,11,2,"warehouse_storage"),
                Z(1,16,6,3,"office"),
                Z(8,16,11,3,"warehouse_storage"),
            },
            FurnitureSpawns = new[]
            {
                F(Crt,3,2), F(Crt,5,2), F(Crt,3,5),
                F(Crt,10,3), F(Crt,14,3), F(Shf,16,5), F(Shf,16,7), F(Crt,10,8),
                F(Tbl,2,13), F(Fil,5,13), F(Shf,8,13), F(Crt,12,13), F(Crt,16,13),
                F(Tbl,2,17), F(Chr,3,17), F(Fil,5,16), F(Shf,8,17), F(Crt,12,17), F(Crt,16,17),
            },
            LockChance = 0.6, HasBasement = true,
        });

        // 10x10 suburban house
        list.Add(new BuildingPrefab
        {
            Id = "suburban_house", Name = "Suburban House",
            Width = 10, Height = 10, Biomes = BSubRurRich,
            Layout = new[]
            {
                "##########",
                "#....|...#",
                "#....|...#",
                "#....d...#",
                "#---d----#",
                "#........#",
                "#........#",
                "#.|--d---#",
                "#.d......#",
                "####+#####",
            },
            LootZones = new[]
            {
                Z(1,1,4,3,"residential_bedroom"),
                Z(6,1,3,3,"residential_bathroom"),
                Z(1,5,8,2,"residential_living"),
                Z(1,7,1,2,"residential_bathroom"),
                Z(3,7,6,2,"residential_kitchen"),
            },
            FurnitureSpawns = new[]
            {
                F(Bed,1,1), F(Dre,3,1), F(Toi,6,1), F(Snk,8,1),
                F(Cch,2,5), F(Tbl,5,5), F(Shf,8,5),
                F(Cnt,3,8), F(Stv,5,8), F(Cab,7,7),
            },
            LockChance = 0.5, HasUpstairs = true, HasBasement = true,
        });

        // 20x14 ranch house
        list.Add(new BuildingPrefab
        {
            Id = "ranch_house", Name = "Ranch House",
            Width = 20, Height = 14, Biomes = BSubRurRich,
            Layout = new[]
            {
                "####################",
                "#........|..|......#",
                "#........|..|......#",
                "#........d..|......#",
                "#........|..d......#",
                "#---d----|--|--d---#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#........|---d-----#",
                "#........d.........#",
                "#........|.........#",
                "#########+##########",
            },
            LootZones = new[]
            {
                Z(1,1,8,4,"residential_bedroom"),
                Z(11,1,2,4,"residential_bathroom"),
                Z(14,1,5,4,"residential_bedroom"),
                Z(1,6,18,4,"residential_living"),
                Z(1,10,8,3,"residential_kitchen"),
                Z(10,10,9,3,"residential_living"),
            },
            FurnitureSpawns = new[]
            {
                F(Bed,1,1), F(Dre,4,1), F(Cab,7,2),
                F(Toi,11,1), F(Snk,12,1), F(Shw,11,3),
                F(Bed,14,1), F(Dre,17,1),
                F(Cch,3,7), F(Cch,7,7), F(Tbl,5,8), F(Shf,12,6), F(Shf,16,6),
                F(Cnt,1,11), F(Stv,3,11), F(Snk,5,10), F(Cab,7,10),
                F(Tbl,12,11), F(Chr,13,12), F(Chr,11,12), F(Shf,17,11),
            },
            LockChance = 0.5, HasBasement = true,
        });

        // 16x16 two-story home
        list.Add(new BuildingPrefab
        {
            Id = "two_story_home", Name = "Two-Story Home",
            Width = 16, Height = 16, Biomes = BSubRich,
            Layout = new[]
            {
                "################",
                "#......|.......#",
                "#......|.......#",
                "#......d.......#",
                "#......|.......#",
                "#--d---|--d----#",
                "#......|.......#",
                "#......d.......#",
                "#......|..|--d-#",
                "#......|..|....#",
                "#---d--|--d----#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#######+########",
            },
            LootZones = new[]
            {
                Z(1,1,6,4,"residential_bedroom"),
                Z(8,1,7,4,"residential_bedroom"),
                Z(1,6,6,4,"residential_bedroom"),
                Z(8,6,7,2,"residential_living"),
                Z(11,8,4,2,"residential_bathroom"),
                Z(1,11,14,4,"residential_living"),
            },
            FurnitureSpawns = new[]
            {
                F(Bed,1,1), F(Dre,4,1), F(Bed,8,1), F(Dre,12,1), F(Cab,14,2),
                F(Bed,1,6), F(Dre,4,6), F(Shf,1,8),
                F(Toi,11,8), F(Snk,13,8), F(Shw,14,9),
                F(Cch,3,12), F(Tbl,6,12), F(Shf,10,11),
                F(Cnt,1,14), F(Stv,3,14), F(Snk,5,14), F(Cab,7,14),
                F(Tbl,11,13), F(Chr,12,14), F(Chr,10,14),
            },
            LockChance = 0.5, HasUpstairs = true, HasBasement = true,
        });

        // 14x12 restaurant
        list.Add(new BuildingPrefab
        {
            Id = "restaurant", Name = "Restaurant",
            Width = 14, Height = 12, Biomes = BSubUrbRichMix,
            Layout = new[]
            {
                "##############",
                "#..|---d-----#",
                "#..d.........#",
                "#............#",
                "#............#",
                "#----d--d----#",
                "#............#",
                "#............#",
                "#............#",
                "#............#",
                "#............#",
                "#######+######",
            },
            LootZones = new[]
            {
                Z(1,1,2,2,"residential_bathroom"),
                Z(4,1,9,2,"commercial_backroom"),
                Z(1,3,12,2,"residential_kitchen"),
                Z(1,6,12,5,"commercial_store"),
            },
            FurnitureSpawns = new[]
            {
                F(Toi,1,1), F(Crt,5,1), F(Shf,8,1),
                F(Cnt,4,3), F(Stv,7,3), F(Stv,9,3), F(Snk,11,4),
                F(Tbl,2,7), F(Chr,1,8), F(Chr,3,8),
                F(Tbl,6,7), F(Chr,5,8), F(Chr,7,8),
                F(Tbl,10,7), F(Chr,9,8), F(Chr,11,8),
                F(Tbl,2,10), F(Tbl,6,10), F(Tbl,10,10),
            },
            LockChance = 0.4, HasBasement = true,
        });

        // 14x14 gas station
        list.Add(new BuildingPrefab
        {
            Id = "gas_station", Name = "Gas Station",
            Width = 14, Height = 14, Biomes = BSubRurInd,
            Layout = new[]
            {
                "##############",
                "#............#",
                "#............#",
                "#............#",
                "#............#",
                "#------d-----#",
                "#............#",
                "#............#",
                "#............#",
                "#----d--d----#",
                "#............#",
                "#............#",
                "#............#",
                "######+#######",
            },
            LootZones = new[]
            {
                Z(1,1,12,4,"garage_bay"),
                Z(1,6,12,3,"commercial_backroom"),
                Z(1,10,12,3,"commercial_store"),
            },
            FurnitureSpawns = new[]
            {
                F(Wkb,1,1), F(Crt,5,2), F(Loc,10,1),
                F(Shf,1,6), F(Crt,5,7), F(Crt,8,7), F(Loc,11,6),
                F(Shf,1,10), F(Shf,3,10), F(Shf,6,10), F(Cnt,10,11),
            },
            LockChance = 0.5,
        });

        // 8x8 slum shack
        list.Add(new BuildingPrefab
        {
            Id = "slum_shack", Name = "Slum Shack",
            Width = 8, Height = 8, Biomes = BUrbanRuinInd,
            Layout = new[]
            {
                "########",
                "#......#",
                "#......#",
                "#......#",
                "#......#",
                "#......#",
                "#......#",
                "###+####",
            },
            LootZones = new[]
            {
                Z(1,1,6,6,"residential_living"),
            },
            FurnitureSpawns = new[]
            {
                F(Bed,1,1), F(Crt,4,1), F(Tbl,1,4), F(Shf,5,5),
            },
            LockChance = 0.2,
        });

        // 16x16 church
        list.Add(new BuildingPrefab
        {
            Id = "church", Name = "Church",
            Width = 16, Height = 16, Biomes = BSubUrbanRichRural,
            Layout = new[]
            {
                "################",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#..............#",
                "#---d----d-----#",
                "#......|.......#",
                "#......d.......#",
                "#..............#",
                "#..............#",
                "#######+########",
            },
            LootZones = new[]
            {
                Z(1,1,14,9,"residential_living"),
                Z(1,11,6,2,"office"),
                Z(8,11,7,2,"commercial_backroom"),
                Z(1,14,14,1,"residential_living"),
            },
            FurnitureSpawns = new[]
            {
                F(Chr,3,2),  F(Chr,3,4),  F(Chr,3,6),  F(Chr,3,8),
                F(Chr,8,2),  F(Chr,8,4),  F(Chr,8,6),  F(Chr,8,8),
                F(Chr,12,2), F(Chr,12,4), F(Chr,12,6), F(Chr,12,8),
                F(Tbl,2,12), F(Shf,5,11), F(Cab,9,11), F(Crt,13,12),
            },
            LockChance = 0.3, HasUpstairs = true, HasBasement = true,
        });

        // 20x16 mansion
        list.Add(new BuildingPrefab
        {
            Id = "mansion", Name = "Mansion",
            Width = 20, Height = 16, Biomes = BRich,
            Layout = new[]
            {
                "####################",
                "#........|.........#",
                "#........|.........#",
                "#........d.........#",
                "#---d----|----d----#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#---d----|----d----#",
                "#........d.........#",
                "#........|.........#",
                "#........|.........#",
                "#---d----|----d----#",
                "#........|.........#",
                "#########+##########",
            },
            LootZones = new[]
            {
                Z(1,1,8,3,"residential_bedroom"),
                Z(10,1,9,3,"residential_bedroom"),
                Z(1,5,18,4,"residential_living"),
                Z(1,10,8,3,"residential_kitchen"),
                Z(10,10,9,3,"residential_living"),
                Z(1,14,8,1,"residential_bathroom"),
                Z(10,14,9,1,"residential_bathroom"),
            },
            FurnitureSpawns = new[]
            {
                F(Bed,2,1), F(Dre,5,1), F(Cab,7,2),
                F(Bed,11,1), F(Dre,15,1), F(Cab,17,2),
                F(Cch,3,6), F(Cch,8,6), F(Tbl,6,7),
                F(Shf,14,5), F(Shf,17,5),
                F(Cnt,1,11), F(Stv,3,11), F(Snk,5,10), F(Cab,7,10),
                F(Tbl,11,11), F(Shf,15,11),
                F(Toi,1,14), F(Snk,3,14), F(Shw,6,14),
                F(Toi,10,14), F(Snk,13,14),
            },
            LockChance = 0.7, HasUpstairs = true, HasBasement = true,
        });

        // 12x10 convenience store
        list.Add(new BuildingPrefab
        {
            Id = "convenience_store", Name = "Convenience Store",
            Width = 12, Height = 10, Biomes = BUrbanSubInd,
            Layout = new[]
            {
                "############",
                "#..........#",
                "#..........#",
                "#----d-----#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#####+######",
            },
            LootZones = new[]
            {
                Z(1,1,10,2,"commercial_backroom"),
                Z(1,4,10,5,"commercial_store"),
            },
            FurnitureSpawns = new[]
            {
                F(Crt,2,1), F(Shf,5,1), F(Crt,9,2),
                F(Cnt,9,4),
                F(Shf,2,5), F(Shf,2,6), F(Shf,2,7),
                F(Shf,5,5), F(Shf,5,6), F(Shf,5,7),
                F(Shf,8,5), F(Shf,8,6),
            },
            LockChance = 0.5,
        });

        // 10x8 guard post
        list.Add(new BuildingPrefab
        {
            Id = "guard_post", Name = "Guard Post",
            Width = 10, Height = 8, Biomes = BUrbIndRich,
            Layout = new[]
            {
                "##########",
                "#...|....#",
                "#...|....#",
                "#...d....#",
                "#........#",
                "#........#",
                "#........#",
                "####+#####",
            },
            LootZones = new[]
            {
                Z(1,1,3,3,"office"),
                Z(5,1,4,3,"warehouse_storage"),
                Z(1,4,8,3,"office"),
            },
            FurnitureSpawns = new[]
            {
                F(Tbl,1,1), F(Chr,2,2), F(Loc,5,1), F(Loc,7,1),
                F(Fil,1,5), F(Tbl,4,5), F(Chr,5,5), F(Loc,8,5),
            },
            LockChance = 0.8,
        });

        // 12x12 bar
        list.Add(new BuildingPrefab
        {
            Id = "bar", Name = "Bar",
            Width = 12, Height = 12, Biomes = BUrbanSubInd,
            Layout = new[]
            {
                "############",
                "#..........#",
                "#..........#",
                "#..........#",
                "#----d-----#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#..........#",
                "#####+######",
            },
            LootZones = new[]
            {
                Z(1,1,10,3,"commercial_backroom"),
                Z(1,5,10,6,"commercial_store"),
            },
            FurnitureSpawns = new[]
            {
                F(Crt,2,1), F(Shf,5,1), F(Crt,8,2),
                F(Cnt,1,5), F(Cnt,3,5), F(Cnt,5,5), F(Cnt,7,5),
                F(Shf,9,6),
                F(Tbl,1,8), F(Chr,2,9), F(Tbl,5,8), F(Chr,6,9), F(Tbl,9,8),
            },
            LockChance = 0.4, HasBasement = true,
        });

        // 20x18 large apartment
        list.Add(new BuildingPrefab
        {
            Id = "large_apartment", Name = "Large Apartment",
            Width = 20, Height = 18, Biomes = BUrbanSub,
            Layout = new[]
            {
                "####################",
                "#........|.........#",
                "#........|.........#",
                "#........|.........#",
                "#........d.........#",
                "#---d----|----d----#",
                "#..................#",
                "#..................#",
                "#..................#",
                "#---d----|----d----#",
                "#........d.........#",
                "#........|.........#",
                "#........|.........#",
                "#........|.........#",
                "#---d----|----d----#",
                "#........|.........#",
                "#........|.........#",
                "#########+##########",
            },
            LootZones = new[]
            {
                Z(1,1,8,4,"residential_bedroom"),
                Z(10,1,9,4,"residential_bedroom"),
                Z(1,6,18,3,"residential_living"),
                Z(1,10,8,4,"residential_kitchen"),
                Z(10,10,9,4,"residential_kitchen"),
                Z(1,15,8,2,"residential_bathroom"),
                Z(10,15,9,2,"residential_bathroom"),
            },
            FurnitureSpawns = new[]
            {
                F(Bed,1,1), F(Dre,5,1), F(Cab,7,2),
                F(Bed,10,1), F(Dre,15,1), F(Cab,17,2),
                F(Cch,4,7), F(Tbl,8,7), F(Shf,14,6), F(Cab,17,6),
                F(Cnt,1,11), F(Stv,3,11), F(Cab,5,10), F(Snk,7,10),
                F(Cnt,10,11), F(Stv,13,11), F(Cab,15,10), F(Snk,17,10),
                F(Toi,1,15), F(Snk,3,15), F(Shw,6,15),
                F(Toi,10,15), F(Snk,13,15), F(Shw,16,15),
            },
            LockChance = 0.5, HasUpstairs = true, HasBasement = true,
        });

        return list.ToArray();
    }
}
