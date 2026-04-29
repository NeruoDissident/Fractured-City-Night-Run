using Nightrun.Core;
using Nightrun.World;

namespace Nightrun.WorldGen;

public enum RoadClass : byte
{
    Highway,    // 6 tiles wide, every ~8 chunks
    Arterial,   // 4 tiles wide, every ~3 chunks
    Side,       // 2 tiles wide, per-block within a chunk
    Alley,      // 1 tile wide, narrow back passages
}

/// <summary>
/// A single straight road in local chunk coordinates.
/// Orientation is either Horizontal (along X, at a fixed Y) or Vertical.
/// </summary>
public readonly struct RoadSegment
{
    public readonly bool Horizontal;
    public readonly int Offset;      // Y if horizontal, X if vertical (local to chunk)
    public readonly int Start;       // local start coord along the axis
    public readonly int End;         // local end coord
    public readonly int Width;
    public readonly RoadClass Class;

    public RoadSegment(bool horizontal, int offset, int start, int end, int width, RoadClass cls)
    {
        Horizontal = horizontal; Offset = offset; Start = start; End = end; Width = width; Class = cls;
    }
}

/// <summary>
/// Deterministic GLOBAL road network. Given a chunk coordinate, computes
/// every road segment that passes through it — highways, arterials, and
/// per-chunk side streets — such that roads align seamlessly across boundaries.
///
/// Because the algorithm is a pure function of (cx, cy, seed), two adjacent
/// chunks agree on every through-road without any edge-matching hacks.
/// </summary>
public sealed class RoadNetworkGenerator
{
    private const int HighwaySpacing = 10;   // chunks between parallel highways
    private const int ArterialSpacing = 3;   // chunks between parallel arterials
    private const int HighwayWidth = 6;
    private const int ArterialWidth = 4;
    private const int SideWidth = 2;

    private readonly WorldManager _world;

    public RoadNetworkGenerator(WorldManager world) { _world = world; }

    /// <summary>
    /// Returns all road segments passing through the given chunk,
    /// in LOCAL chunk coordinates.
    /// </summary>
    public List<RoadSegment> SegmentsFor(Chunk chunk)
    {
        var list = new List<RoadSegment>(8);
        if (!chunk.Biome.HasRoads()) return list;

        int S = Chunk.Size;
        int wx0 = chunk.Cx * S;
        int wy0 = chunk.Cy * S;

        // === Horizontal highways (lines at constant world-Y) ===
        foreach (int worldY in HighwaysInRange(wy0, wy0 + S - 1, horizontal: true))
        {
            int localY = worldY - wy0;
            list.Add(new RoadSegment(true, localY, 0, S - 1, HighwayWidth, RoadClass.Highway));
        }

        // === Vertical highways ===
        foreach (int worldX in HighwaysInRange(wx0, wx0 + S - 1, horizontal: false))
        {
            int localX = worldX - wx0;
            list.Add(new RoadSegment(false, localX, 0, S - 1, HighwayWidth, RoadClass.Highway));
        }

        // === Arterials ===
        foreach (int worldY in ArterialsInRange(wy0, wy0 + S - 1, horizontal: true))
        {
            int localY = worldY - wy0;
            // Skip if a highway already occupies this row
            if (list.Any(r => r.Horizontal && Math.Abs(r.Offset - localY) < HighwayWidth)) continue;
            list.Add(new RoadSegment(true, localY, 0, S - 1, ArterialWidth, RoadClass.Arterial));
        }
        foreach (int worldX in ArterialsInRange(wx0, wx0 + S - 1, horizontal: false))
        {
            int localX = worldX - wx0;
            if (list.Any(r => !r.Horizontal && Math.Abs(r.Offset - localX) < HighwayWidth)) continue;
            list.Add(new RoadSegment(false, localX, 0, S - 1, ArterialWidth, RoadClass.Arterial));
        }

        // === Per-chunk side streets (only in buildable biomes with no highway) ===
        if (chunk.Biome.HasBuildings())
        {
            AddSideStreets(chunk, list);
        }

        return list;
    }

    // ---------------------------------------------------------------------
    // Highway indices N map to world coordinates via:
    //   worldCoord = N * (HighwaySpacing * Chunk.Size) + noiseJitter(N) * jitterAmount
    // Returns all world coords in [lo, hi].
    private IEnumerable<int> HighwaysInRange(int lo, int hi, bool horizontal)
    {
        int spacing = HighwaySpacing * Chunk.Size;
        int nLo = (int)Math.Floor((lo - spacing) / (double)spacing);
        int nHi = (int)Math.Ceiling((hi + spacing) / (double)spacing);
        uint axisSeed = _world.Seed ^ (horizontal ? 0xA0A0A0A0u : 0xB0B0B0B0u);

        for (int n = nLo; n <= nHi; n++)
        {
            // Deterministic jitter so highways aren't perfectly regular
            double jn = (RNG.HashCoords(n, 0, axisSeed) / (double)uint.MaxValue) - 0.5;
            int worldCoord = n * spacing + (int)(jn * spacing * 0.25);
            if (worldCoord >= lo && worldCoord <= hi) yield return worldCoord;
        }
    }

    private IEnumerable<int> ArterialsInRange(int lo, int hi, bool horizontal)
    {
        int spacing = ArterialSpacing * Chunk.Size;
        int nLo = (int)Math.Floor((lo - spacing) / (double)spacing);
        int nHi = (int)Math.Ceiling((hi + spacing) / (double)spacing);
        uint axisSeed = _world.Seed ^ (horizontal ? 0xC0C0C0C0u : 0xD0D0D0D0u);

        for (int n = nLo; n <= nHi; n++)
        {
            double jn = (RNG.HashCoords(n, 0, axisSeed) / (double)uint.MaxValue) - 0.5;
            int worldCoord = n * spacing + (int)(jn * spacing * 0.5);
            if (worldCoord >= lo && worldCoord <= hi) yield return worldCoord;
        }
    }

    // ---------------------------------------------------------------------
    // Side streets are per-chunk and subdivide the space between through-roads
    // into buildable blocks. They start from an interior edge and extend only
    // within the chunk so they don't fight cross-chunk alignment.
    private void AddSideStreets(Chunk chunk, List<RoadSegment> list)
    {
        int S = Chunk.Size;
        var rng = new RNG(RNG.HashCoords(chunk.Cx, chunk.Cy, _world.Seed + 9001));

        // Gather existing through-road Y/X positions so we can fill gaps
        var horizY = list.Where(r => r.Horizontal).Select(r => r.Offset).OrderBy(v => v).ToList();
        var vertX  = list.Where(r => !r.Horizontal).Select(r => r.Offset).OrderBy(v => v).ToList();

        // Add chunk edges as virtual road boundaries for gap calculation
        horizY.Insert(0, -1); horizY.Add(S);
        vertX.Insert(0, -1);  vertX.Add(S);

        int targetGap = chunk.Biome switch
        {
            Biome.UrbanCore        => 12,
            Biome.Suburbs          => 18,
            Biome.RichNeighborhood => 22,
            Biome.Industrial       => 24,
            Biome.Ruins            => 30,
            Biome.Rural            => 40,
            _                      => 20,
        };

        // Horizontal side streets between each pair of horizontal through-roads
        for (int i = 0; i < horizY.Count - 1; i++)
        {
            int a = horizY[i], b = horizY[i + 1];
            int gap = b - a;
            if (gap < targetGap + 6) continue;
            int count = gap / targetGap;
            for (int k = 1; k <= count; k++)
            {
                int y = a + (gap * k) / (count + 1) + rng.Range(-2, 3);
                if (y > 1 && y < S - 2) list.Add(new RoadSegment(true, y, 0, S - 1, SideWidth, RoadClass.Side));
            }
        }

        for (int i = 0; i < vertX.Count - 1; i++)
        {
            int a = vertX[i], b = vertX[i + 1];
            int gap = b - a;
            if (gap < targetGap + 6) continue;
            int count = gap / targetGap;
            for (int k = 1; k <= count; k++)
            {
                int x = a + (gap * k) / (count + 1) + rng.Range(-2, 3);
                if (x > 1 && x < S - 2) list.Add(new RoadSegment(false, x, 0, S - 1, SideWidth, RoadClass.Side));
            }
        }
    }
}
