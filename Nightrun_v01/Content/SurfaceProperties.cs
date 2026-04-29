using Nightrun.World;

namespace Nightrun.Content;

/// <summary>
/// Crafting-time virtual components sourced from the tile the player is
/// standing on. Concrete floors supply a grinding surface, bedrock hands out
/// hammering support, and so on. The crafting system wraps the matching
/// entry in an <see cref="Item"/> flagged <see cref="Item.IsSurface"/> so
/// property-based recipe requirements can consume it — but the infinite
/// quantity flag guarantees it's never removed from the pool.
///
/// Mirrors <c>SURFACE_PROPERTIES</c> in the JS CraftingSystem.
/// </summary>
public static class SurfaceProperties
{
    private static readonly Dictionary<TileType, (string Name, Dictionary<string, int> Props)> Table = new()
    {
        [TileType.Concrete]        = ("Concrete",         new() { ["grinding"] = 2, ["hammering"] = 1 }),
        [TileType.CrackedConcrete] = ("Cracked Concrete", new() { ["grinding"] = 2, ["hammering"] = 1 }),
        [TileType.Sidewalk]        = ("Sidewalk",         new() { ["grinding"] = 1, ["hammering"] = 1 }),
        [TileType.Asphalt]         = ("Asphalt",          new() { ["grinding"] = 1 }),
        [TileType.Road]            = ("Road",             new() { ["grinding"] = 1 }),
        [TileType.Highway]         = ("Highway",          new() { ["grinding"] = 1 }),
        [TileType.Rock]            = ("Rock",             new() { ["grinding"] = 2, ["hammering"] = 1, ["blunt"] = 1 }),
        [TileType.SolidRock]       = ("Bedrock",          new() { ["grinding"] = 2, ["hammering"] = 1 }),
        [TileType.Gravel]          = ("Gravel",           new() { ["grinding"] = 1 }),
        [TileType.BrickWall]       = ("Brick Wall",       new() { ["grinding"] = 2, ["hammering"] = 1 }),
        [TileType.ConcreteWall]    = ("Concrete Wall",    new() { ["grinding"] = 2, ["hammering"] = 1 }),
        [TileType.MetalWall]       = ("Metal Wall",       new() { ["hammering"] = 2 }),
        [TileType.WoodFloor]       = ("Wood Floor",       new() { ["hammering"] = 1 }),
        [TileType.TileFloor]       = ("Tile Floor",       new() { ["grinding"] = 1 }),
    };

    /// <summary>
    /// Returns the virtual surface component for <paramref name="tile"/>, or
    /// null if standing on this tile grants no crafting support. The returned
    /// item is a fresh instance every call — callers own it.
    /// </summary>
    public static Item? CreateFor(TileType tile)
    {
        if (!Table.TryGetValue(tile, out var entry)) return null;

        return new Item
        {
            FamilyId    = "__surface__",
            ComponentId = "__surface__",
            Name        = entry.Name + " (surface)",
            Glyph       = '.',
            Fg          = 244,
            Weight      = 0,
            Volume      = 0,
            Quantity    = 999,
            Stackable   = false,
            Category    = "component",
            IsComponent = true,
            IsSurface   = true,
            Tags        = new List<string> { "component", "surface" },
            Properties  = new Dictionary<string, int>(entry.Props),
        };
    }
}
