namespace Nightrun.World;

/// <summary>
/// A single tile. Struct (value type) — millions of these exist, so we keep it
/// small and cache-friendly. 8 bytes total.
/// Per-tile overrides (variation, damage) layer on top of the TileCatalog defaults.
/// </summary>
public struct Tile
{
    public TileType Type;      // 2 bytes
    public TileFlags Flags;    // 2 bytes — copied from catalog, may be mutated (e.g. open door)
    public byte Variant;       // 1 byte — cosmetic variation (0 = default)
    public byte Damage;        // 1 byte — 0=pristine, 255=destroyed
    public ushort ObjectId;    // 2 bytes — index into world-object table (0 = none)

    public Tile(TileType type)
    {
        Type = type;
        Flags = TileCatalog.Get(type).Flags;
        Variant = 0;
        Damage = 0;
        ObjectId = 0;
    }

    public readonly bool IsBlocked     => (Flags & TileFlags.Blocked) != 0;
    public readonly bool BlocksSight   => (Flags & TileFlags.BlocksSight) != 0;
    public readonly bool IsWall        => (Flags & TileFlags.IsWall) != 0;
    public readonly bool IsRoad        => (Flags & TileFlags.IsRoad) != 0;
    public readonly bool IsDoor        => (Flags & TileFlags.IsDoor) != 0;
    public readonly bool IsWater       => (Flags & TileFlags.IsWater) != 0;
    public readonly bool IsReserved    => (Flags & TileFlags.Reserved) != 0;
    public readonly bool IsInteractable=> (Flags & TileFlags.Interactable) != 0;

    public static readonly Tile Empty = new(TileType.None);
}
