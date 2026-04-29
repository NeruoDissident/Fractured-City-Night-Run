using Nightrun.World;

namespace Nightrun.WorldGen;

/// <summary>
/// A rectangular buildable zone bounded by roads (or chunk edges).
/// Coordinates are LOCAL to the chunk.
/// </summary>
public readonly struct Block
{
    public readonly int X, Y, W, H;
    public Block(int x, int y, int w, int h) { X = x; Y = y; W = w; H = h; }
    public int Right  => X + W - 1;
    public int Bottom => Y + H - 1;
    public int Area   => W * H;
}

/// <summary>
/// Partitions a chunk into rectangular blocks using the set of road segments
/// passing through it. Each block is a rectangle with no road running through
/// its interior — perfect for building placement.
/// </summary>
public static class BlockDetector
{
    public static List<Block> Detect(List<RoadSegment> segments)
    {
        int S = Chunk.Size;

        // Collect unique Y cut-lines from horizontal roads (each road
        // occupies a strip [offset - width/2, offset + width/2]).
        var yCuts = new SortedSet<int> { 0, S };
        var xCuts = new SortedSet<int> { 0, S };

        foreach (var r in segments)
        {
            int half = r.Width / 2 + 1; // +1 buffer so buildings don't touch asphalt
            if (r.Horizontal)
            {
                yCuts.Add(Math.Clamp(r.Offset - half, 0, S));
                yCuts.Add(Math.Clamp(r.Offset + half, 0, S));
            }
            else
            {
                xCuts.Add(Math.Clamp(r.Offset - half, 0, S));
                xCuts.Add(Math.Clamp(r.Offset + half, 0, S));
            }
        }

        var ys = yCuts.ToList();
        var xs = xCuts.ToList();
        var blocks = new List<Block>();

        for (int yi = 0; yi < ys.Count - 1; yi++)
        {
            int y0 = ys[yi], y1 = ys[yi + 1];
            if (y1 - y0 < 4) continue;

            for (int xi = 0; xi < xs.Count - 1; xi++)
            {
                int x0 = xs[xi], x1 = xs[xi + 1];
                if (x1 - x0 < 4) continue;

                // Skip rectangles that correspond to a road strip
                if (IsRoadStrip(x0, y0, x1 - x0, y1 - y0, segments)) continue;

                blocks.Add(new Block(x0, y0, x1 - x0, y1 - y0));
            }
        }

        return blocks;
    }

    private static bool IsRoadStrip(int x, int y, int w, int h, List<RoadSegment> segments)
    {
        // A strip is a road if its center lies within any road's occupied band
        int cx = x + w / 2;
        int cy = y + h / 2;
        foreach (var r in segments)
        {
            int half = r.Width / 2 + 1;
            if (r.Horizontal && Math.Abs(cy - r.Offset) < half) return true;
            if (!r.Horizontal && Math.Abs(cx - r.Offset) < half) return true;
        }
        return false;
    }
}
