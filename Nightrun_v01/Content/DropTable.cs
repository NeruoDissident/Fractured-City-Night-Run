namespace Nightrun.Content;

/// <summary>
/// Single entry in a drop table. <see cref="MinQ"/>/<see cref="MaxQ"/> are the
/// inclusive quantity range; <see cref="MinQual"/>/<see cref="MaxQual"/> are
/// the 0..100 quality range. Ported from JS
/// <c>{ name, quantity: [min,max], quality: [min,max] }</c>.
/// </summary>
public readonly record struct DropMaterial(
    string Name, int MinQ, int MaxQ, int MinQual, int MaxQual);

/// <summary>
/// Drop table attached to a world object. <see cref="DisassembleTool"/> is the
/// required tool tag for careful disassembly — null means the object can only
/// be smashed (no clean yield).
/// </summary>
public sealed class DropTable
{
    public required DropMaterial[] Materials;
    public string? DisassembleTool;
}

/// <summary>
/// Mapping of drop-table display names to item-family ids in
/// <see cref="ItemCatalog"/>. Mirrors <c>DROP_NAME_TO_COMPONENT</c> in JS
/// <c>WorldObjectSystem.dropMaterials</c>.
/// </summary>
public static class DropNameMap
{
    private static readonly Dictionary<string, string> Map = new()
    {
        ["Glass Shards"] = "glass_shard",
        ["Glass Shard"]  = "glass_shard",
        ["Metal Scraps"] = "scrap_metal_shard",
        ["Metal Shard"]  = "scrap_metal_shard",
        ["Steel Plate"]  = "scrap_metal_shard",
        ["Wood Plank"]   = "wood_plank",
        ["Wood Piece"]   = "wood_piece",
        ["Nails"]        = "nail",
        ["Nail"]         = "nail",
        ["Screws"]       = "screw",
        ["Screw"]        = "screw",
        ["Fabric Panel"] = "fabric_panel",
        ["Pipe"]         = "metal_tube",
        ["Bone Shard"]   = "bone_shard",
        ["Rubber Piece"] = "rubber_piece",
        ["Duct Tape"]    = "duct_tape",
        ["Cloth Wrap"]   = "cloth_wrap",
        ["Stone"]        = "stone",
    };

    public static string? FamilyIdFor(string displayName)
        => Map.TryGetValue(displayName, out var id) ? id : null;
}

/// <summary>
/// Static drop-table lookups for world objects. Port of the per-type
/// <c>dropTable</c> fields in JS <c>FURNITURE_TYPES</c> and <c>DOOR_TYPES</c>.
/// </summary>
public static class DropTableCatalog
{
    private static readonly Dictionary<FurnitureKind, DropTable> Furniture = new()
    {
        [FurnitureKind.Cabinet] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 2, 3, 60, 90),
                new DropMaterial("Nails",      2, 4, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Dresser] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 2, 4, 60, 85),
                new DropMaterial("Nails",      2, 3, 70, 100),
                new DropMaterial("Screws",     1, 2, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Shelf] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 1, 2, 60, 90),
                new DropMaterial("Screws",     1, 2, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Locker] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Metal Scraps", 2, 3, 70, 90),
                new DropMaterial("Screws",       1, 2, 70, 100),
            },
            DisassembleTool = "crowbar",
        },
        [FurnitureKind.Crate] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 2, 3, 50, 80),
                new DropMaterial("Nails",      1, 2, 60, 90),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.FilingCabinet] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Metal Scraps", 2, 3, 70, 90),
                new DropMaterial("Screws",       1, 2, 70, 100),
            },
            DisassembleTool = "crowbar",
        },
        [FurnitureKind.Table] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 2, 3, 60, 90),
                new DropMaterial("Nails",      2, 3, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Chair] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 1, 2, 60, 85),
                new DropMaterial("Nails",      1, 2, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Couch] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank",   1, 2, 50, 80),
                new DropMaterial("Fabric Panel", 2, 3, 40, 70),
                new DropMaterial("Nails",        1, 2, 60, 90),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Bed] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank",   2, 3, 60, 85),
                new DropMaterial("Fabric Panel", 1, 2, 40, 70),
                new DropMaterial("Nails",        1, 2, 60, 90),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Sink] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Metal Scraps", 1, 2, 60, 85),
                new DropMaterial("Pipe",         1, 1, 50, 80),
            },
            DisassembleTool = "crowbar",
        },
        [FurnitureKind.Counter] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 2, 3, 60, 90),
                new DropMaterial("Nails",      2, 3, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [FurnitureKind.Stove] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Metal Scraps", 3, 5, 60, 85),
                new DropMaterial("Screws",       2, 3, 70, 100),
            },
            DisassembleTool = "crowbar",
        },
        [FurnitureKind.Toilet] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Metal Scraps", 1, 2, 50, 75),
                new DropMaterial("Pipe",         1, 1, 40, 70),
            },
            DisassembleTool = "crowbar",
        },
        [FurnitureKind.Shower] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Pipe",         1, 2, 50, 80),
                new DropMaterial("Metal Scraps", 1, 1, 50, 75),
            },
            DisassembleTool = "crowbar",
        },
        [FurnitureKind.Workbench] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank",   3, 4, 70, 95),
                new DropMaterial("Nails",        3, 5, 70, 100),
                new DropMaterial("Metal Scraps", 1, 2, 60, 85),
            },
            DisassembleTool = "screwdriver",
        },
    };

    private static readonly Dictionary<DoorMaterial, DropTable> Doors = new()
    {
        [DoorMaterial.WoodBasic] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank", 2, 3, 60, 90),
                new DropMaterial("Nails",      1, 2, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [DoorMaterial.WoodReinforced] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Wood Plank",   3, 4, 70, 95),
                new DropMaterial("Metal Scraps", 1, 2, 60, 80),
                new DropMaterial("Screws",       2, 4, 70, 100),
            },
            DisassembleTool = "screwdriver",
        },
        [DoorMaterial.Metal] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Metal Scraps", 3, 4, 70, 90),
                new DropMaterial("Screws",       2, 3, 70, 100),
            },
            DisassembleTool = "crowbar",
        },
        [DoorMaterial.Glass] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Glass Shards", 1, 3, 40, 70),
            },
            // No disassembleTool in JS — glass is smash-only.
            DisassembleTool = null,
        },
        [DoorMaterial.Security] = new()
        {
            Materials = new[]
            {
                new DropMaterial("Metal Scraps", 2, 4, 60, 85),
                new DropMaterial("Steel Plate",  1, 1, 70, 90),
            },
            DisassembleTool = "crowbar",
        },
    };

    public static DropTable? For(Furniture f) => Furniture.TryGetValue(f.Kind, out var t) ? t : null;
    public static DropTable? For(Door d)      => Doors.TryGetValue(d.MaterialType, out var t) ? t : null;

    public static DropTable? For(WorldObject o) => o switch
    {
        Furniture f => For(f),
        Door d      => For(d),
        _           => null,
    };
}
