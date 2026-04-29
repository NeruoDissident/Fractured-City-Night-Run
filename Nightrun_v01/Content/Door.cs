using Nightrun.World;

namespace Nightrun.Content;

/// <summary>
/// Visual + structural properties of a door type.
/// Ported from JS DOOR_TYPES. Drop tables will be hooked up in Phase 2.
/// </summary>
public readonly record struct DoorDef(
    string Name, string Material, int HP, double Durability,
    byte Fg, byte Bg);

public enum DoorMaterial : byte
{
    WoodBasic,
    WoodReinforced,
    Metal,
    Glass,
    Security,
}

public static class DoorCatalog
{
    // ANSI 256 color indices (approximate from JS hex codes)
    public static readonly DoorDef WoodBasic      = new("Wooden Door",     "wood",  50, 1.0, 179, 236);
    public static readonly DoorDef WoodReinforced = new("Reinforced Door", "wood",  80, 1.3, 137, 236);
    public static readonly DoorDef Metal          = new("Metal Door",      "metal",100, 2.0, 244, 236);
    public static readonly DoorDef Glass          = new("Glass Door",      "glass", 30, 0.5, 153, 236);
    public static readonly DoorDef Security       = new("Security Door",   "metal",150, 2.5, 240, 236);

    public static DoorDef Get(DoorMaterial m) => m switch
    {
        DoorMaterial.WoodReinforced => WoodReinforced,
        DoorMaterial.Metal          => Metal,
        DoorMaterial.Glass          => Glass,
        DoorMaterial.Security       => Security,
        _                           => WoodBasic,
    };

    /// <summary>Which door material is used per biome for exterior and interior doors.</summary>
    public static (DoorMaterial exterior, DoorMaterial interior) ForBiome(Biome b) => b switch
    {
        Biome.UrbanCore        => (DoorMaterial.Glass,          DoorMaterial.WoodBasic),
        Biome.Industrial       => (DoorMaterial.Metal,          DoorMaterial.WoodBasic),
        Biome.RichNeighborhood => (DoorMaterial.WoodReinforced, DoorMaterial.WoodBasic),
        _                      => (DoorMaterial.WoodBasic,      DoorMaterial.WoodBasic),
    };
}

/// <summary>
/// A door in the world. Holds state (open/locked/hp) and points back to its tile.
/// The underlying Tile.Type is DoorClosed or DoorOpen — that's what the renderer draws.
/// </summary>
public sealed class Door : WorldObject
{
    public DoorMaterial MaterialType;
    public bool Open;
    public bool Locked;
    public bool Barricaded;
    public bool Exterior;

    public static Door Create(DoorMaterial material, int lx, int ly, int lz,
                              bool exterior, bool locked = false)
    {
        var def = DoorCatalog.Get(material);
        return new Door
        {
            MaterialType = material,
            Name         = def.Name,
            Material     = def.Material,
            HP           = def.HP,
            MaxHP        = def.HP,
            Durability   = def.Durability,
            Fg           = def.Fg,
            Bg           = def.Bg,
            X            = lx,
            Y            = ly,
            Z            = lz,
            Open         = false,
            Locked       = locked,
            Exterior     = exterior,
            Glyph        = '+',
            Blocked      = true,
            BlocksVision = true,
        };
    }

    /// <summary>Sync glyph/blocking to current state so renderer stays consistent.</summary>
    public void UpdateVisuals(ref Tile tile)
    {
        if (IsDestroyed)
        {
            Glyph = '/';
            Blocked = false;
            BlocksVision = false;
            tile.Type  = TileType.DoorOpen;
            tile.Flags = TileCatalog.Get(TileType.DoorOpen).Flags & ~TileFlags.BlocksSight;
            return;
        }
        if (Barricaded)
        {
            Glyph = '#';
            Blocked = true;
            BlocksVision = true;
            tile.Type  = TileType.DoorClosed;
            tile.Flags = TileCatalog.Get(TileType.DoorClosed).Flags;
            return;
        }
        if (Open)
        {
            Glyph = '\'';
            Blocked = false;
            BlocksVision = false;
            tile.Type  = TileType.DoorOpen;
            tile.Flags = TileCatalog.Get(TileType.DoorOpen).Flags;
        }
        else
        {
            Glyph = '+';
            Blocked = true;
            BlocksVision = true;
            tile.Type  = TileType.DoorClosed;
            tile.Flags = TileCatalog.Get(TileType.DoorClosed).Flags;
        }
    }
}
