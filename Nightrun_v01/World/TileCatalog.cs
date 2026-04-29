namespace Nightrun.World;

/// <summary>
/// Visual + flag definition for every TileType.
/// Central registry so renderers and logic share the same source of truth.
/// </summary>
public readonly struct TileDef
{
    public readonly char Glyph;
    public readonly byte Fg;      // ANSI 256 color
    public readonly byte Bg;      // ANSI 256 color
    public readonly TileFlags Flags;
    public readonly string Name;

    public TileDef(char glyph, byte fg, byte bg, TileFlags flags, string name)
    {
        Glyph = glyph; Fg = fg; Bg = bg; Flags = flags; Name = name;
    }
}

public static class TileCatalog
{
    // ANSI 256-color palette indices (https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit)
    // Kept as constants for readability at the call site.
    private const byte BLACK = 0, DARK_GRAY = 236, MID_GRAY = 240, GRAY = 244, LIGHT_GRAY = 250, WHITE = 255;
    private const byte DARK_GREEN = 22, GREEN = 28, BRIGHT_GREEN = 34, PINE = 23;
    private const byte DARK_BROWN = 94, BROWN = 130, TAN = 179, SAND = 222;
    private const byte DARK_BLUE = 18, BLUE = 25, SHALLOW_BLUE = 31;
    private const byte RED = 124, ORANGE = 208, YELLOW = 226;
    private const byte NIGHT_BG = 232;     // near-black for ambient
    private const byte ASPHALT_BG = 234;
    private const byte CONCRETE_BG = 238;
    private const byte GRASS_BG = 22;

    private static readonly TileDef[] Defs;

    static TileCatalog()
    {
        var count = Enum.GetValues<TileType>().Length;
        Defs = new TileDef[count];

        // Default fallback
        for (int i = 0; i < count; i++)
            Defs[i] = new TileDef('?', RED, BLACK, TileFlags.None, "?");

        Set(TileType.None,           ' ', BLACK,        BLACK,       TileFlags.None, "void");

        // Ground
        Set(TileType.Grass,          '.', BRIGHT_GREEN, GRASS_BG,    TileFlags.IsNatural, "grass");
        Set(TileType.TallGrass,      '"', GREEN,        GRASS_BG,    TileFlags.IsNatural, "tall grass");
        Set(TileType.Dirt,           '.', BROWN,        NIGHT_BG,    TileFlags.None, "dirt");
        Set(TileType.Mud,            ',', DARK_BROWN,   NIGHT_BG,    TileFlags.None, "mud");
        Set(TileType.Sand,           '.', SAND,         NIGHT_BG,    TileFlags.None, "sand");
        Set(TileType.Gravel,         ',', GRAY,         NIGHT_BG,    TileFlags.None, "gravel");
        Set(TileType.Concrete,       '.', LIGHT_GRAY,   CONCRETE_BG, TileFlags.None, "concrete");
        Set(TileType.CrackedConcrete,',', GRAY,         CONCRETE_BG, TileFlags.None, "cracked concrete");
        Set(TileType.Asphalt,        '.', MID_GRAY,     ASPHALT_BG,  TileFlags.None, "asphalt");
        Set(TileType.Sidewalk,       '.', LIGHT_GRAY,   CONCRETE_BG, TileFlags.None, "sidewalk");

        // Water
        Set(TileType.Water,          '~', BLUE,         DARK_BLUE,   TileFlags.Blocked | TileFlags.IsWater, "water");
        Set(TileType.ShallowWater,   '~', SHALLOW_BLUE, DARK_BLUE,   TileFlags.IsWater, "shallow water");
        Set(TileType.Shore,          ',', SAND,         NIGHT_BG,    TileFlags.None, "shore");

        // Walls — ▓ gives a solid filled look vs bare floor
        Set(TileType.BrickWall,      '\u2593', BROWN,        NIGHT_BG,    TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsWall, "brick wall");
        Set(TileType.ConcreteWall,   '\u2593', LIGHT_GRAY,   CONCRETE_BG, TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsWall, "concrete wall");
        Set(TileType.WoodWall,       '\u2593', TAN,          NIGHT_BG,    TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsWall, "wood wall");
        Set(TileType.MetalWall,      '\u2593', GRAY,         NIGHT_BG,    TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsWall, "metal wall");
        Set(TileType.RustedMetal,    '\u2593', ORANGE,       NIGHT_BG,    TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsWall, "rusted metal");

        // Floors
        Set(TileType.Floor,          '.', LIGHT_GRAY,   ASPHALT_BG,  TileFlags.None, "floor");
        Set(TileType.WoodFloor,      '.', TAN,          NIGHT_BG,    TileFlags.None, "wood floor");
        Set(TileType.TileFloor,      '.', WHITE,        CONCRETE_BG, TileFlags.None, "tile floor");

        // Doors — bright yellow-green so they pop against walls
        Set(TileType.DoorClosed,     '+', 190,          NIGHT_BG,    TileFlags.BlocksSight | TileFlags.IsDoor | TileFlags.Interactable, "closed door");
        Set(TileType.DoorOpen,       '/', 148,          NIGHT_BG,    TileFlags.IsDoor | TileFlags.Interactable, "open door");
        // Window — ▒ medium shade, blue-tinted, permeable to sight
        Set(TileType.Window,         '\u2592', SHALLOW_BLUE, NIGHT_BG,    TileFlags.Blocked | TileFlags.IsWall, "window");

        // Roads
        Set(TileType.Highway,        '=', LIGHT_GRAY,   ASPHALT_BG,  TileFlags.IsRoad, "highway");
        Set(TileType.HighwayLine,    '-', YELLOW,       ASPHALT_BG,  TileFlags.IsRoad, "highway line");
        Set(TileType.Road,           '.', MID_GRAY,     ASPHALT_BG,  TileFlags.IsRoad, "road");
        Set(TileType.RoadLine,       '-', YELLOW,       ASPHALT_BG,  TileFlags.IsRoad, "road line");
        Set(TileType.Alley,          '.', DARK_GRAY,    NIGHT_BG,    TileFlags.IsRoad, "alley");

        // Nature
        Set(TileType.Tree,           'T', DARK_GREEN,   GRASS_BG,    TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsNatural, "tree");
        Set(TileType.PineTree,       'A', PINE,         GRASS_BG,    TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsNatural, "pine tree");
        Set(TileType.Bush,           '%', GREEN,        GRASS_BG,    TileFlags.BlocksSight | TileFlags.IsNatural, "bush");
        Set(TileType.Rock,           '*', GRAY,         NIGHT_BG,    TileFlags.Blocked | TileFlags.IsNatural, "rock");
        Set(TileType.Stump,          'o', DARK_BROWN,   GRASS_BG,    TileFlags.IsNatural, "stump");

        // Urban objects
        Set(TileType.Streetlight,    'i', YELLOW,       CONCRETE_BG, TileFlags.Blocked, "streetlight");
        Set(TileType.Bench,          'n', TAN,          CONCRETE_BG, TileFlags.Blocked, "bench");
        Set(TileType.Fence,          '|', GRAY,         GRASS_BG,    TileFlags.BlocksSight | TileFlags.IsWall, "fence");
        Set(TileType.Rubble,         '%', GRAY,         NIGHT_BG,    TileFlags.None, "rubble");
        Set(TileType.Trash,          '&', DARK_BROWN,   NIGHT_BG,    TileFlags.None, "trash");
        Set(TileType.Barrier,        'H', ORANGE,       ASPHALT_BG,  TileFlags.Blocked, "barrier");

        // Underground
        Set(TileType.SolidRock,      '\u2593', DARK_GRAY,    BLACK,       TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsWall, "solid rock");
        Set(TileType.SewerFloor,     '.', GRAY,         BLACK,       TileFlags.None, "sewer floor");
        Set(TileType.SewerWall,      '\u2593', DARK_GRAY,    BLACK,       TileFlags.Blocked | TileFlags.BlocksSight | TileFlags.IsWall, "sewer wall");
        // Interactable vertical-travel: bright cyan so player can always spot them
        Set(TileType.Manhole,        'O', 51,           ASPHALT_BG,  TileFlags.Interactable | TileFlags.CanDescend, "manhole");
        Set(TileType.Ladder,         'H', 51,           BLACK,       TileFlags.Interactable | TileFlags.CanAscend, "ladder");

        // Stairs — bright cyan
        Set(TileType.StairsUp,       '<', 51,           CONCRETE_BG, TileFlags.Interactable | TileFlags.CanAscend, "stairs up");
        Set(TileType.StairsDown,     '>', 51,           CONCRETE_BG, TileFlags.Interactable | TileFlags.CanDescend, "stairs down");
    }

    private static void Set(TileType t, char glyph, byte fg, byte bg, TileFlags flags, string name)
        => Defs[(int)t] = new TileDef(glyph, fg, bg, flags, name);

    public static TileDef Get(TileType t) => Defs[(int)t];
}
