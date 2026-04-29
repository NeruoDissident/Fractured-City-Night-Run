namespace Nightrun.World;

/// <summary>
/// Every kind of tile in the world. Enum not strings — catch typos at compile time.
/// Add new tile types here and update <see cref="TileCatalog"/> to define their visuals.
/// </summary>
public enum TileType : ushort
{
    None = 0,

    // === Ground ===
    Grass,
    TallGrass,
    Dirt,
    Mud,
    Sand,
    Gravel,
    Concrete,
    CrackedConcrete,
    Asphalt,
    Sidewalk,

    // === Water ===
    Water,
    ShallowWater,
    Shore,

    // === Walls & structures ===
    BrickWall,
    ConcreteWall,
    WoodWall,
    MetalWall,
    RustedMetal,
    Floor,
    WoodFloor,
    TileFloor,

    // === Doors & openings ===
    DoorClosed,
    DoorOpen,
    Window,

    // === Roads ===
    Highway,
    HighwayLine,
    Road,
    RoadLine,
    Alley,

    // === Natural features ===
    Tree,
    PineTree,
    Bush,
    Rock,
    Stump,

    // === Urban objects ===
    Streetlight,
    Bench,
    Fence,
    Rubble,
    Trash,
    Barrier,

    // === Underground ===
    SolidRock,
    SewerFloor,
    SewerWall,
    Manhole,
    Ladder,

    // === Stairs ===
    StairsUp,
    StairsDown,
}

[Flags]
public enum TileFlags : ushort
{
    None         = 0,
    Blocked      = 1 << 0,   // impassable
    BlocksSight  = 1 << 1,   // blocks FOV
    IsWall       = 1 << 2,
    IsRoad       = 1 << 3,
    IsDoor       = 1 << 4,
    IsWater      = 1 << 5,
    IsNatural    = 1 << 6,   // tree, rock, grass
    Interactable = 1 << 7,   // manhole, ladder, stairs
    CanAscend    = 1 << 8,
    CanDescend   = 1 << 9,
    Reserved     = 1 << 10,  // generator marker: "don't build here"
}
