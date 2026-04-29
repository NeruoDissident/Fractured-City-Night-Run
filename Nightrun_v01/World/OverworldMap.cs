using Nightrun.World;

namespace Nightrun.World;

/// <summary>
/// A single tile on the overworld grid. One tile = one droppable zone.
/// </summary>
public sealed class OverworldTile
{
    public Biome   Biome;
    public int     ThreatLevel;   // 1–5, derived from biome + distance from origin
    public string  ZoneId;        // key into ZoneCatalog
    public uint    ZoneSeed;      // deterministic seed for this tile's zone map
    public bool    Explored;      // player has visited this tile
    public bool    Cleared;       // all hostiles killed (future use)

    public OverworldTile(Biome biome, int threat, string zoneId, uint zoneSeed)
    {
        Biome       = biome;
        ThreatLevel = threat;
        ZoneId      = zoneId;
        ZoneSeed    = zoneSeed;
    }
}

/// <summary>
/// Coarse-resolution world grid built by sampling <see cref="WorldManager"/>
/// at one-chunk-per-tile resolution. The overworld is a fixed window centred
/// on the world origin so the same seed always produces the same map.
/// </summary>
public sealed class OverworldMap
{
    // Grid dimensions in overworld tiles.
    public const int Cols = 60;
    public const int Rows = 36;

    // Offset so that overworld tile (0,0) maps to chunk (-Cols/2, -Rows/2).
    private const int OriginChunkX = -(Cols / 2);
    private const int OriginChunkY = -(Rows / 2);

    private readonly OverworldTile[,] _tiles = new OverworldTile[Cols, Rows];

    /// <summary>Player cursor position on the overworld grid.</summary>
    public int CursorX { get; set; } = Cols / 2;
    public int CursorY { get; set; } = Rows / 2;

    public OverworldTile this[int col, int row] => _tiles[col, row];

    // ──────────────────────────────────────────────────────────────────
    // Construction

    public static OverworldMap Build(WorldManager world)
    {
        var map = new OverworldMap();
        for (int row = 0; row < Rows; row++)
        {
            for (int col = 0; col < Cols; col++)
            {
                int cx = OriginChunkX + col;
                int cy = OriginChunkY + row;

                var biome   = world.BiomeMapper.BiomeAt(cx, cy);
                int threat  = ThreatFor(biome, cx, cy);
                string zid  = ZoneIdFor(biome, threat);
                uint   seed = world.Seed ^ (uint)(cx * 73856093 ^ cy * 19349663);

                map._tiles[col, row] = new OverworldTile(biome, threat, zid, seed);
            }
        }
        // Mark origin tile explored so the player can see where they start.
        map._tiles[Cols / 2, Rows / 2].Explored = true;
        return map;
    }

    // ──────────────────────────────────────────────────────────────────
    // Helpers

    /// <summary>Threat 1–5 based on biome danger + distance ring.</summary>
    private static int ThreatFor(Biome biome, int cx, int cy)
    {
        int dist = Math.Max(Math.Abs(cx), Math.Abs(cy));   // Chebyshev distance
        int ring = dist switch { < 4 => 0, < 8 => 1, < 14 => 2, < 20 => 3, _ => 4 };

        int baseThreat = biome switch
        {
            Biome.UrbanCore        => 2,
            Biome.Suburbs          => 1,
            Biome.Industrial       => 3,
            Biome.RichNeighborhood => 2,
            Biome.Ruins            => 3,
            Biome.Rural            => 1,
            Biome.Forest           => 2,
            Biome.Coast            => 1,
            Biome.Ocean or Biome.Lake or Biome.River => 1,
            _                      => 2,
        };

        return Math.Clamp(baseThreat + ring, 1, 5);
    }

    /// <summary>
    /// Maps a biome (+ threat band) to the <see cref="ZoneProfile"/> id that
    /// best represents it. Returns the fallback "urban_ruins" if nothing matches.
    /// </summary>
    public static string ZoneIdFor(Biome biome, int threat) => biome switch
    {
        // Sewer and Subway are underground — never spawned directly from overworld.
        Biome.UrbanCore        => threat >= 4 ? "corporate_tower" : "urban_ruins",
        Biome.Suburbs          => "suburbs",
        Biome.Industrial       => "industrial",
        Biome.RichNeighborhood => threat >= 4 ? "corporate_tower" : "corp_residential",
        Biome.Ruins            => "collapsed_district",
        Biome.Rural            => "wasteland",
        Biome.Forest           => "forest",
        Biome.Coast            => "waterfront",
        Biome.Ocean            => "waterfront",
        Biome.Lake             => "waterfront",
        Biome.River            => "waterfront",
        _                      => "urban_ruins",
    };

    /// <summary>
    /// Visual glyph + colors for this biome on the overworld.
    /// Returns (glyph, fg256, bg256).
    /// </summary>
    public static (char Glyph, byte Fg, byte Bg) BiomeVisual(Biome b) => b switch
    {
        Biome.UrbanCore        => ('#', 250, 236),
        Biome.Suburbs          => ('"',  34, 22),
        Biome.Industrial       => ('%', 244, 235),
        Biome.RichNeighborhood => ('\u03a9', 220, 22),  // Ω gold — corporate enclave
        Biome.Ruins            => ('x', 130, 234),
        Biome.Rural            => (',',  28, 22),
        Biome.Forest           => ('T',  22, 22),
        Biome.Coast            => ('s', 222, 58),
        Biome.Ocean            => ('~',  25, 18),
        Biome.Lake             => ('~',  31, 18),
        Biome.River            => ('~',  39, 18),
        _                      => ('.', 244, 234),
    };

    /// <summary>Human-readable biome name for the sidebar.</summary>
    public static string BiomeName(Biome b) => b switch
    {
        Biome.UrbanCore        => "Urban Core",
        Biome.Suburbs          => "Suburbs",
        Biome.Industrial       => "Industrial",
        Biome.RichNeighborhood => "Upper City",
        Biome.Ruins            => "Ruins",
        Biome.Rural            => "Rural",
        Biome.Forest           => "Forest",
        Biome.Coast            => "Coast",
        Biome.Ocean            => "Ocean",
        Biome.Lake             => "Lake",
        Biome.River            => "River",
        _                      => "Unknown",
    };
}
