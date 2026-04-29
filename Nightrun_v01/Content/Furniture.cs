namespace Nightrun.Content;

public enum FurnitureKind : byte
{
    Cabinet, Dresser, Shelf, Locker, Crate, FilingCabinet,
    Table, Chair, Couch, Bed, Sink, Counter, Stove, Toilet, Shower, Workbench,
}

/// <summary>
/// Static definition of a furniture type — visual + physical properties.
/// Mirrors JS FURNITURE_TYPES, with pockets flattened to a simple capacity list.
/// </summary>
public sealed class FurnitureDef
{
    public required string Name;
    public required FurnitureKind Kind;
    public required char Glyph;
    public required byte Fg;
    public byte Bg = 236;
    public required int HP;
    public required double Durability;
    public required string Material;
    public required bool Blocked;
    public bool BlocksVision = false;
    public bool IsContainer = false;
    public PocketSpec[] Pockets = Array.Empty<PocketSpec>();
}

public static class FurnitureCatalog
{
    private static readonly Dictionary<FurnitureKind, FurnitureDef> Defs = Build();

    public static FurnitureDef Get(FurnitureKind k) => Defs[k];
    public static bool TryGet(string name, out FurnitureKind k)
    {
        switch (name)
        {
            case "cabinet":        k = FurnitureKind.Cabinet;       return true;
            case "dresser":        k = FurnitureKind.Dresser;       return true;
            case "shelf":          k = FurnitureKind.Shelf;         return true;
            case "locker":         k = FurnitureKind.Locker;        return true;
            case "crate":          k = FurnitureKind.Crate;         return true;
            case "filing_cabinet": k = FurnitureKind.FilingCabinet; return true;
            case "table":          k = FurnitureKind.Table;         return true;
            case "chair":          k = FurnitureKind.Chair;         return true;
            case "couch":          k = FurnitureKind.Couch;         return true;
            case "bed":            k = FurnitureKind.Bed;           return true;
            case "sink":           k = FurnitureKind.Sink;          return true;
            case "counter":        k = FurnitureKind.Counter;       return true;
            case "stove":          k = FurnitureKind.Stove;         return true;
            case "toilet":         k = FurnitureKind.Toilet;        return true;
            case "shower":         k = FurnitureKind.Shower;        return true;
            case "workbench":      k = FurnitureKind.Workbench;     return true;
        }
        k = default;
        return false;
    }

    private static Dictionary<FurnitureKind, FurnitureDef> Build()
    {
        var d = new Dictionary<FurnitureKind, FurnitureDef>();

        // === STORAGE ===
        d[FurnitureKind.Cabinet] = new FurnitureDef
        {
            Name = "Cabinet", Kind = FurnitureKind.Cabinet, Glyph = '¤', Fg = 136,
            HP = 40, Durability = 1.0, Material = "wood",
            Blocked = true, IsContainer = true,
            Pockets = new[]
            {
                new PocketSpec("Upper Shelf", 5000, 8000),
                new PocketSpec("Lower Shelf", 5000, 8000),
            },
        };
        d[FurnitureKind.Dresser] = new FurnitureDef
        {
            Name = "Dresser", Kind = FurnitureKind.Dresser, Glyph = '¤', Fg = 130,
            HP = 45, Durability = 1.0, Material = "wood",
            Blocked = true, IsContainer = true,
            Pockets = new[]
            {
                new PocketSpec("Top Drawer",    3000, 4000),
                new PocketSpec("Middle Drawer", 4000, 6000),
                new PocketSpec("Bottom Drawer", 5000, 8000),
            },
        };
        d[FurnitureKind.Shelf] = new FurnitureDef
        {
            Name = "Shelf", Kind = FurnitureKind.Shelf, Glyph = '=', Fg = 180,
            HP = 25, Durability = 0.8, Material = "wood",
            Blocked = false, IsContainer = true,
            Pockets = new[] { new PocketSpec("Shelf", 6000, 10000) },
        };
        d[FurnitureKind.Locker] = new FurnitureDef
        {
            Name = "Locker", Kind = FurnitureKind.Locker, Glyph = '¤', Fg = 244,
            HP = 60, Durability = 1.5, Material = "metal",
            Blocked = true, IsContainer = true,
            Pockets = new[] { new PocketSpec("Locker", 8000, 12000) },
        };
        d[FurnitureKind.Crate] = new FurnitureDef
        {
            Name = "Crate", Kind = FurnitureKind.Crate, Glyph = '¤', Fg = 180,
            HP = 20, Durability = 0.7, Material = "wood",
            Blocked = true, IsContainer = true,
            Pockets = new[] { new PocketSpec("Inside", 10000, 15000) },
        };
        d[FurnitureKind.FilingCabinet] = new FurnitureDef
        {
            Name = "Filing Cabinet", Kind = FurnitureKind.FilingCabinet, Glyph = '¤', Fg = 242,
            HP = 50, Durability = 1.3, Material = "metal",
            Blocked = true, IsContainer = true,
            Pockets = new[]
            {
                new PocketSpec("Top Drawer",    3000, 4000),
                new PocketSpec("Bottom Drawer", 3000, 4000),
            },
        };

        // === NON-STORAGE ===
        d[FurnitureKind.Table] = new FurnitureDef
        {
            Name = "Table", Kind = FurnitureKind.Table, Glyph = 'T', Fg = 136,
            HP = 35, Durability = 1.0, Material = "wood", Blocked = true,
        };
        d[FurnitureKind.Chair] = new FurnitureDef
        {
            Name = "Chair", Kind = FurnitureKind.Chair, Glyph = 'h', Fg = 136,
            HP = 20, Durability = 0.8, Material = "wood", Blocked = false,
        };
        d[FurnitureKind.Couch] = new FurnitureDef
        {
            Name = "Couch", Kind = FurnitureKind.Couch, Glyph = '=', Fg = 94,
            HP = 40, Durability = 1.0, Material = "wood", Blocked = true,
        };
        d[FurnitureKind.Bed] = new FurnitureDef
        {
            Name = "Bed", Kind = FurnitureKind.Bed, Glyph = '=', Fg = 67,
            HP = 35, Durability = 1.0, Material = "wood", Blocked = true,
        };
        d[FurnitureKind.Sink] = new FurnitureDef
        {
            Name = "Sink", Kind = FurnitureKind.Sink, Glyph = 'U', Fg = 153,
            HP = 50, Durability = 1.5, Material = "metal", Blocked = true,
        };
        d[FurnitureKind.Counter] = new FurnitureDef
        {
            Name = "Counter", Kind = FurnitureKind.Counter, Glyph = '=', Fg = 248,
            HP = 45, Durability = 1.2, Material = "wood", Blocked = true,
            IsContainer = true,
            Pockets = new[] { new PocketSpec("Under Counter", 6000, 10000) },
        };
        d[FurnitureKind.Stove] = new FurnitureDef
        {
            Name = "Stove", Kind = FurnitureKind.Stove, Glyph = '&', Fg = 240,
            HP = 80, Durability = 2.0, Material = "metal", Blocked = true,
        };
        d[FurnitureKind.Toilet] = new FurnitureDef
        {
            Name = "Toilet", Kind = FurnitureKind.Toilet, Glyph = 'o', Fg = 253,
            HP = 40, Durability = 1.3, Material = "metal", Blocked = true,
        };
        d[FurnitureKind.Shower] = new FurnitureDef
        {
            Name = "Shower", Kind = FurnitureKind.Shower, Glyph = '~', Fg = 152,
            HP = 30, Durability = 1.0, Material = "metal", Blocked = false,
        };
        d[FurnitureKind.Workbench] = new FurnitureDef
        {
            Name = "Workbench", Kind = FurnitureKind.Workbench, Glyph = 'T', Fg = 137,
            HP = 50, Durability = 1.3, Material = "wood", Blocked = true,
            IsContainer = true,
            Pockets = new[]
            {
                new PocketSpec("Workbench Surface", 8000, 12000),
                new PocketSpec("Tool Drawer",       4000,  5000),
            },
        };

        return d;
    }
}

/// <summary>
/// A runtime furniture instance — a piece of interactive world geometry.
/// Storage furniture holds Items inside its pockets.
/// </summary>
public sealed class Furniture : WorldObject
{
    public FurnitureKind Kind;
    public bool IsContainer;
    public bool Searched;
    public Pocket[] Pockets = Array.Empty<Pocket>();

    public static Furniture Create(FurnitureKind kind, int lx, int ly, int lz)
    {
        var def = FurnitureCatalog.Get(kind);
        var f = new Furniture
        {
            Kind         = kind,
            Name         = def.Name,
            Material     = def.Material,
            HP           = def.HP,
            MaxHP        = def.HP,
            Durability   = def.Durability,
            Glyph        = def.Glyph,
            Fg           = def.Fg,
            Bg           = def.Bg,
            Blocked      = def.Blocked,
            BlocksVision = def.BlocksVision,
            IsContainer  = def.IsContainer,
            X            = lx,
            Y            = ly,
            Z            = lz,
        };
        if (def.IsContainer)
        {
            f.Pockets = new Pocket[def.Pockets.Length];
            for (int i = 0; i < def.Pockets.Length; i++)
                f.Pockets[i] = new Pocket(def.Pockets[i]);
        }
        return f;
    }

    public int CountItems()
    {
        int n = 0;
        foreach (var p in Pockets) n += p.Contents.Count;
        return n;
    }
}
