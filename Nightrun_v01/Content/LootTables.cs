using Nightrun.Core;

namespace Nightrun.Content;

/// <summary>
/// Entry in a weighted loot pool. Either a familyId (a full item) or a
/// componentId (a raw crafting material). Both resolve via ItemCatalog.
/// </summary>
public readonly record struct LootEntry(string Id, int Weight, bool IsComponent);

public sealed class RoomLootTable
{
    public required string RoomType;
    public required double SpawnChance;    // per floor-tile chance to attempt a spawn
    public required int MaxItems;          // cap per room
    public required LootEntry[] Pool;
    public int TotalWeight;

    public RoomLootTable Finish()
    {
        TotalWeight = 0;
        foreach (var e in Pool) TotalWeight += e.Weight;
        return this;
    }
}

public static class LootTables
{
    public static readonly Dictionary<string, RoomLootTable> Rooms = Build();

    public static readonly RoomLootTable Outdoor = new RoomLootTable
    {
        RoomType = "outdoor",
        SpawnChance = 0.02,
        MaxItems = int.MaxValue,
        Pool = new LootEntry[]
        {
            new("pipe", 15, false),
            new("shiv", 10, false),
            new("strap", 10, false),
            new("battery", 8, false),
            new("can_sealed", 8, false),
            new("bottle_sealed", 8, false),
            new("medkit", 3, false),
            new("coat", 3, false),
            new("pants", 3, false),
            new("stone", 12, true),
            new("wood_piece", 10, true),
            new("glass_shard", 8, true),
            new("scrap_metal_shard", 6, true),
            new("bone_shard", 3, true),
        },
    }.Finish();

    /// <summary>Roll one item from a loot table. Returns null if pool rolled nothing usable.</summary>
    public static Item? Roll(RoomLootTable table, RNG rng)
    {
        if (table.TotalWeight <= 0) return null;
        int r = rng.Range(0, table.TotalWeight);
        foreach (var e in table.Pool)
        {
            r -= e.Weight;
            if (r < 0)
            {
                return e.IsComponent
                    ? ItemCatalog.CreateByComponent(e.Id)
                    : ItemCatalog.CreateByFamily(e.Id);
            }
        }
        var last = table.Pool[^1];
        return last.IsComponent
            ? ItemCatalog.CreateByComponent(last.Id)
            : ItemCatalog.CreateByFamily(last.Id);
    }

    // -----------------------------------------------------------------
    // Per-room loot tables. Keys match prefab lootZone types.

    private static Dictionary<string, RoomLootTable> Build()
    {
        var d = new Dictionary<string, RoomLootTable>();

        d["residential_living"] = new RoomLootTable
        {
            RoomType = "residential_living", SpawnChance = 0.06, MaxItems = 3,
            Pool = new LootEntry[]
            {
                new("can_sealed",    15, false), new("bottle_sealed", 15, false),
                new("battery",       10, false), new("coat",           5, false),
                new("pants",          5, false), new("backpack",       3, false),
                new("strap",          8, false), new("pipe",           4, false),
                new("flashlight",     2, false), new("lantern",        1, false),
                new("glass_shard",    6, true),  new("cloth_wrap",     5, true),
                new("duct_tape",      3, true),  new("fabric_panel",   4, true),
                new("thread",         3, true),  new("zipper",         2, true),
            },
        }.Finish();

        d["residential_bedroom"] = new RoomLootTable
        {
            RoomType = "residential_bedroom", SpawnChance = 0.05, MaxItems = 2,
            Pool = new LootEntry[]
            {
                new("coat",          10, false), new("pants",       10, false),
                new("trenchcoat",     5, false), new("backpack",     5, false),
                new("medkit",         3, false), new("battery",      8, false),
                new("shiv",           4, false), new("knife",        2, false),
                new("flashlight",     2, false),
                new("fabric_panel",   5, true),  new("thread",       4, true),
                new("cloth_wrap",     4, true),  new("buckle",       2, true),
                new("leather_piece",  2, true),
            },
        }.Finish();

        d["residential_kitchen"] = new RoomLootTable
        {
            RoomType = "residential_kitchen", SpawnChance = 0.07, MaxItems = 4,
            Pool = new LootEntry[]
            {
                new("can_sealed",    25, false), new("bottle_sealed", 15, false),
                new("knife",          8, false), new("canteen",        5, false),
                new("pipe",           3, false), new("can_opener",     4, false),
                new("glass_shard",    5, true),  new("scrap_metal_shard", 4, true),
            },
        }.Finish();

        d["residential_bathroom"] = new RoomLootTable
        {
            RoomType = "residential_bathroom", SpawnChance = 0.05, MaxItems = 2,
            Pool = new LootEntry[]
            {
                new("medkit",        20, false), new("bottle_sealed", 15, false),
                new("strap",          5, false), new("pipe",           8, false),
            },
        }.Finish();

        d["commercial_store"] = new RoomLootTable
        {
            RoomType = "commercial_store", SpawnChance = 0.05, MaxItems = 5,
            Pool = new LootEntry[]
            {
                new("can_sealed",   20, false), new("bottle_sealed", 20, false),
                new("battery",      10, false), new("medkit",         5, false),
                new("coat",          5, false), new("pants",          5, false),
                new("backpack",      3, false), new("canteen",        3, false),
                new("flashlight",    3, false), new("lantern",        2, false),
                new("can_opener",    3, false),
                new("fabric_panel",  4, true),  new("thread",         3, true),
                new("zipper",        2, true),  new("buckle",         2, true),
                new("duct_tape",     3, true),
            },
        }.Finish();

        d["commercial_backroom"] = new RoomLootTable
        {
            RoomType = "commercial_backroom", SpawnChance = 0.07, MaxItems = 4,
            Pool = new LootEntry[]
            {
                new("can_sealed",        15, false), new("bottle_sealed",   15, false),
                new("pipe",              10, false), new("strap",            10, false),
                new("battery",            8, false), new("knife",             5, false),
                new("medkit",             5, false), new("lantern_fuel",      3, false),
                new("can_opener",         3, false),
                new("scrap_metal_shard",  5, true),  new("wire",              4, true),
                new("rivet",              4, true),  new("screw",             3, true),
                new("rubber_piece",       3, true),
            },
        }.Finish();

        d["commercial_storage"] = new RoomLootTable
        {
            RoomType = "commercial_storage", SpawnChance = 0.07, MaxItems = 4,
            Pool = new LootEntry[]
            {
                new("can_sealed",        15, false), new("bottle_sealed",   15, false),
                new("pipe",              10, false), new("strap",            10, false),
                new("battery",            8, false),
                new("scrap_metal_shard",  5, true),  new("wire",              4, true),
                new("rivet",              3, true),  new("screw",             3, true),
                new("duct_tape",          4, true),
            },
        }.Finish();

        d["commercial_office"] = new RoomLootTable
        {
            RoomType = "commercial_office", SpawnChance = 0.04, MaxItems = 2,
            Pool = new LootEntry[]
            {
                new("battery",       15, false), new("bottle_sealed", 10, false),
                new("strap",          8, false), new("shiv",           5, false),
                new("medkit",         3, false), new("coat",           5, false),
                new("backpack",       3, false),
            },
        }.Finish();

        d["office"] = new RoomLootTable
        {
            RoomType = "office", SpawnChance = 0.04, MaxItems = 2,
            Pool = new LootEntry[]
            {
                new("battery",    15, false), new("bottle_sealed", 10, false),
                new("strap",       8, false), new("shiv",           5, false),
                new("medkit",      3, false), new("coat",           5, false),
                new("backpack",    3, false),
            },
        }.Finish();

        d["office_reception"] = new RoomLootTable
        {
            RoomType = "office_reception", SpawnChance = 0.05, MaxItems = 3,
            Pool = new LootEntry[]
            {
                new("battery",      12, false), new("bottle_sealed", 12, false),
                new("can_sealed",    8, false), new("medkit",         5, false),
                new("coat",          5, false), new("pants",          5, false),
                new("backpack",      4, false), new("pipe",           6, false),
            },
        }.Finish();

        d["medical_store"] = new RoomLootTable
        {
            RoomType = "medical_store", SpawnChance = 0.06, MaxItems = 4,
            Pool = new LootEntry[]
            {
                new("medkit",        30, false), new("bottle_sealed", 15, false),
                new("battery",        8, false), new("can_sealed",     5, false),
            },
        }.Finish();

        d["medical_storage"] = new RoomLootTable
        {
            RoomType = "medical_storage", SpawnChance = 0.07, MaxItems = 5,
            Pool = new LootEntry[]
            {
                new("medkit",        40, false), new("bottle_sealed", 10, false),
                new("battery",        8, false), new("backpack",       3, false),
            },
        }.Finish();

        d["medical_waiting"] = new RoomLootTable
        {
            RoomType = "medical_waiting", SpawnChance = 0.03, MaxItems = 2,
            Pool = new LootEntry[]
            {
                new("bottle_sealed", 15, false), new("can_sealed",    10, false),
                new("coat",           8, false), new("pants",          5, false),
                new("backpack",       5, false), new("battery",        5, false),
            },
        }.Finish();

        d["medical_exam"] = new RoomLootTable
        {
            RoomType = "medical_exam", SpawnChance = 0.05, MaxItems = 3,
            Pool = new LootEntry[]
            {
                new("medkit",        25, false), new("bottle_sealed", 10, false),
                new("knife",          5, false), new("battery",        8, false),
                new("strap",          5, false),
            },
        }.Finish();

        d["garage_bay"] = new RoomLootTable
        {
            RoomType = "garage_bay", SpawnChance = 0.04, MaxItems = 3,
            Pool = new LootEntry[]
            {
                new("pipe",              20, false), new("strap",           12, false),
                new("battery",           10, false), new("can_sealed",       5, false),
                new("bottle_sealed",      5, false), new("flashlight",       3, false),
                new("lantern_fuel",       4, false),
                new("scrap_metal_shard", 10, true),  new("nail",             8, true),
                new("wire",               6, true),  new("duct_tape",        6, true),
                new("wood_piece",         8, true),  new("wood_plank",       5, true),
                new("rubber_piece",       5, true),  new("rivet",            5, true),
                new("screw",              4, true),  new("carbon_rod",       2, true),
                new("electrolyte_paste",  2, true),
            },
        }.Finish();

        d["garage_tools"] = new RoomLootTable
        {
            RoomType = "garage_tools", SpawnChance = 0.07, MaxItems = 4,
            Pool = new LootEntry[]
            {
                new("pipe",              20, false), new("knife",           10, false),
                new("shiv",               8, false), new("strap",           15, false),
                new("battery",           12, false), new("flashlight",       4, false),
                new("lantern",            2, false), new("lantern_fuel",     3, false),
                new("can_opener",         3, false),
                new("scrap_metal_shard",  8, true),  new("nail",            10, true),
                new("wire",               8, true),  new("duct_tape",        8, true),
                new("wood_piece",         5, true),  new("wood_plank",       6, true),
                new("rivet",              6, true),  new("screw",            6, true),
                new("rubber_piece",       4, true),  new("carbon_rod",       3, true),
                new("electrolyte_paste",  2, true),
            },
        }.Finish();

        d["warehouse_floor"] = new RoomLootTable
        {
            RoomType = "warehouse_floor", SpawnChance = 0.015, MaxItems = 6,
            Pool = new LootEntry[]
            {
                new("can_sealed",        15, false), new("bottle_sealed",   15, false),
                new("pipe",              10, false), new("strap",           10, false),
                new("battery",            8, false), new("backpack",         3, false),
                new("coat",               3, false),
                new("scrap_metal_shard",  8, true),  new("wood_piece",       8, true),
                new("wood_plank",         6, true),  new("nail",             6, true),
                new("wire",               5, true),  new("rivet",            4, true),
                new("screw",              4, true),  new("rubber_piece",     3, true),
                new("fabric_panel",       3, true),
            },
        }.Finish();

        d["warehouse_storage"] = new RoomLootTable
        {
            RoomType = "warehouse_storage", SpawnChance = 0.06, MaxItems = 5,
            Pool = new LootEntry[]
            {
                new("can_sealed",        20, false), new("bottle_sealed",   15, false),
                new("pipe",              10, false), new("strap",            10, false),
                new("battery",           10, false), new("medkit",            5, false),
                new("backpack",           5, false), new("canteen",           3, false),
                new("flashlight",         2, false), new("lantern",           2, false),
                new("lantern_fuel",       3, false),
                new("scrap_metal_shard",  6, true),  new("wire",              5, true),
                new("rivet",              4, true),  new("screw",             4, true),
                new("fabric_panel",       4, true),  new("rubber_piece",      3, true),
                new("carbon_rod",         2, true),  new("electrolyte_paste", 2, true),
            },
        }.Finish();

        return d;
    }
}

/// <summary>
/// Furniture storage pre-population. Keyed by room-type → furniture kind.
/// A subset of the JS FURNITURE_LOOT; adds flavor inside containers.
/// </summary>
public static class FurnitureLoot
{
    private static readonly Dictionary<(string room, FurnitureKind kind), RoomLootTable> Tables = Build();

    public static RoomLootTable? Get(string roomType, FurnitureKind kind)
        => Tables.TryGetValue((roomType, kind), out var t) ? t : null;

    public static void Populate(Furniture furn, string roomType, RNG rng)
    {
        if (!furn.IsContainer || furn.Pockets.Length == 0) return;
        var table = Get(roomType, furn.Kind);
        if (table == null) return;

        for (int i = 0; i < table.MaxItems; i++)
        {
            if (!rng.Chance(table.SpawnChance)) continue;
            var item = LootTables.Roll(table, rng);
            if (item == null) continue;
            var pocket = furn.Pockets[rng.Range(0, furn.Pockets.Length)];
            pocket.TryAdd(item);
        }
    }

    private static Dictionary<(string, FurnitureKind), RoomLootTable> Build()
    {
        var d = new Dictionary<(string, FurnitureKind), RoomLootTable>();

        void Add(string room, FurnitureKind kind, double chance, int max, LootEntry[] pool)
            => d[(room, kind)] = new RoomLootTable
            {
                RoomType = room, SpawnChance = chance, MaxItems = max, Pool = pool,
            }.Finish();

        Add("residential_kitchen", FurnitureKind.Cabinet, 0.7, 3, new LootEntry[]
        {
            new("can_sealed", 30, false), new("bottle_sealed", 20, false),
            new("knife", 8, false),       new("canteen", 5, false),
        });
        Add("residential_kitchen", FurnitureKind.Counter, 0.5, 2, new LootEntry[]
        {
            new("can_sealed", 25, false), new("bottle_sealed", 20, false),
            new("knife", 10, false),
        });
        Add("residential_bathroom", FurnitureKind.Cabinet, 0.6, 2, new LootEntry[]
        {
            new("medkit", 30, false), new("bottle_sealed", 15, false), new("strap", 8, false),
        });
        Add("residential_bedroom", FurnitureKind.Dresser, 0.6, 3, new LootEntry[]
        {
            new("coat",           15, false), new("pants",          15, false),
            new("trenchcoat",      5, false), new("strap",           8, false),
            new("battery",        10, false),
            new("fabric_panel",    6, true),  new("thread",          4, true),
            new("cloth_wrap",      4, true),  new("leather_piece",   3, true),
        });
        Add("residential_living", FurnitureKind.Cabinet, 0.5, 2, new LootEntry[]
        {
            new("battery", 15, false), new("can_sealed", 15, false),
            new("bottle_sealed", 15, false), new("strap", 8, false),
        });
        Add("residential_living", FurnitureKind.Shelf, 0.4, 2, new LootEntry[]
        {
            new("battery", 15, false), new("bottle_sealed", 10, false), new("can_sealed", 10, false),
        });
        Add("commercial_store", FurnitureKind.Shelf, 0.7, 3, new LootEntry[]
        {
            new("can_sealed", 25, false), new("bottle_sealed", 25, false),
            new("battery", 10, false), new("medkit", 5, false),
        });
        Add("commercial_store", FurnitureKind.Counter, 0.5, 2, new LootEntry[]
        {
            new("battery", 15, false), new("can_sealed", 10, false), new("knife", 5, false),
        });
        Add("commercial_backroom", FurnitureKind.Shelf, 0.7, 3, new LootEntry[]
        {
            new("can_sealed", 20, false), new("bottle_sealed", 20, false),
            new("pipe", 10, false), new("strap", 10, false),
        });
        Add("commercial_backroom", FurnitureKind.Crate, 0.6, 3, new LootEntry[]
        {
            new("can_sealed", 20, false), new("bottle_sealed", 15, false),
            new("battery", 10, false), new("pipe", 10, false),
        });
        Add("office", FurnitureKind.FilingCabinet, 0.4, 2, new LootEntry[]
        {
            new("battery", 15, false), new("strap", 8, false), new("shiv", 5, false),
        });
        Add("medical_store", FurnitureKind.Cabinet, 0.7, 3, new LootEntry[]
        {
            new("medkit", 40, false), new("bottle_sealed", 15, false),
        });
        Add("medical_store", FurnitureKind.Shelf, 0.6, 3, new LootEntry[]
        {
            new("medkit", 35, false), new("bottle_sealed", 15, false), new("battery", 8, false),
        });
        Add("medical_storage", FurnitureKind.Cabinet, 0.8, 4, new LootEntry[]
        {
            new("medkit", 45, false), new("bottle_sealed", 10, false),
        });
        Add("medical_storage", FurnitureKind.Shelf, 0.7, 3, new LootEntry[]
        {
            new("medkit", 40, false), new("battery", 10, false),
        });
        Add("medical_exam", FurnitureKind.Cabinet, 0.6, 2, new LootEntry[]
        {
            new("medkit", 30, false), new("bottle_sealed", 10, false), new("knife", 5, false),
        });
        Add("garage_bay", FurnitureKind.Workbench, 0.6, 3, new LootEntry[]
        {
            new("pipe", 20, false), new("strap", 15, false), new("battery", 10, false),
        });
        Add("garage_bay", FurnitureKind.Locker, 0.5, 2, new LootEntry[]
        {
            new("coat", 10, false), new("pants", 10, false),
            new("pipe", 8, false), new("strap", 8, false),
        });
        Add("garage_tools", FurnitureKind.Workbench, 0.7, 4, new LootEntry[]
        {
            new("pipe", 20, false), new("knife", 10, false),
            new("strap", 15, false), new("battery", 12, false),
        });
        Add("garage_tools", FurnitureKind.Shelf, 0.6, 3, new LootEntry[]
        {
            new("pipe", 15, false), new("strap", 15, false), new("battery", 10, false),
        });
        Add("warehouse_floor", FurnitureKind.Crate, 0.5, 3, new LootEntry[]
        {
            new("can_sealed", 15, false), new("bottle_sealed", 15, false),
            new("pipe", 10, false), new("strap", 10, false),
        });
        Add("warehouse_storage", FurnitureKind.Crate, 0.7, 4, new LootEntry[]
        {
            new("can_sealed", 20, false), new("bottle_sealed", 15, false),
            new("pipe", 10, false), new("strap", 10, false), new("medkit", 5, false),
        });
        Add("warehouse_storage", FurnitureKind.Shelf, 0.6, 3, new LootEntry[]
        {
            new("can_sealed", 20, false), new("bottle_sealed", 15, false), new("battery", 10, false),
        });

        return d;
    }
}
