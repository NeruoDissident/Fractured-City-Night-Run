namespace Nightrun.World;

/// <summary>
/// Macro-biome — determines the general character of a chunk.
/// Urban → wilderness gradient, organized concentrically from the world origin
/// with noise-based warping for organic boundaries.
/// </summary>
public enum Biome : byte
{
    UrbanCore,          // downtown highrises, dense streets
    Suburbs,            // residential sprawl
    Industrial,         // warehouses, factories, rail yards
    RichNeighborhood,   // mansions, gated blocks, parks
    Ruins,              // collapsed buildings, overgrowth
    Rural,              // farms, scattered houses
    Forest,             // deep woods
    Coast,              // beach / shoreline
    Ocean,              // open water
    Lake,               // inland water body
    River,              // flowing water
}

/// <summary>
/// Sub-biome flavor — per-chunk modifier within a biome. Lets one biome have
/// multiple neighborhood types (e.g. urban_core → downtown, shopping, plaza).
/// </summary>
public enum District : byte
{
    None,
    Downtown,
    Shopping,
    Plaza,
    Residential,
    Slum,
    FactoryCluster,
    WarehouseDistrict,
    RailYard,
    Mansion,
    GolfCourse,
    Park,
    RuralFarm,
    Woodland,
    DeepForest,
    Beach,
    OceanDeep,
    LakeShore,
    RiverBank,
}

public static class BiomeExtensions
{
    /// <summary>Default ground tile to fill empty land with.</summary>
    public static TileType DefaultGround(this Biome b) => b switch
    {
        Biome.UrbanCore        => TileType.Concrete,
        Biome.Suburbs          => TileType.Grass,
        Biome.Industrial       => TileType.Gravel,
        Biome.RichNeighborhood => TileType.Grass,
        Biome.Ruins            => TileType.CrackedConcrete,
        Biome.Rural            => TileType.Grass,
        Biome.Forest           => TileType.Grass,
        Biome.Coast            => TileType.Sand,
        Biome.Ocean            => TileType.Water,
        Biome.Lake             => TileType.Water,
        Biome.River            => TileType.Water,
        _                      => TileType.Dirt,
    };

    /// <summary>Whether this biome supports road generation at all.</summary>
    public static bool HasRoads(this Biome b) => b switch
    {
        Biome.Ocean or Biome.Lake or Biome.River => false,
        _ => true,
    };

    /// <summary>Whether this biome supports building placement.</summary>
    public static bool HasBuildings(this Biome b) => b switch
    {
        Biome.UrbanCore or Biome.Suburbs or Biome.Industrial
            or Biome.RichNeighborhood or Biome.Ruins or Biome.Rural => true,
        _ => false,
    };
}
