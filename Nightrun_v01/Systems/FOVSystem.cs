using Nightrun.World;

namespace Nightrun.Systems;

/// <summary>
/// Recursive shadowcasting field-of-view. Produces a set of visible world
/// tile coordinates around an origin, occluded by any tile with BlocksSight.
/// </summary>
public sealed class FOVSystem
{
    // 8 octants — (xx, xy, yx, yy) transforms from octant-space to world-space
    private static readonly int[,] Octants =
    {
        { 1, 0, 0, 1 }, { 0, 1, 1, 0 }, { 0,-1, 1, 0 }, {-1, 0, 0, 1 },
        {-1, 0, 0,-1 }, { 0,-1,-1, 0 }, { 0, 1,-1, 0 }, { 1, 0, 0,-1 },
    };

    private readonly IWorldMap _world;
    private readonly HashSet<long> _visible = new();

    public FOVSystem(IWorldMap world) { _world = world; }

    public IReadOnlySet<long> Visible => _visible;

    public bool IsVisible(int x, int y) => _visible.Contains(Pack(x, y));

    /// <summary>
    /// Force a tile into the visible set. Used by the lighting layer to
    /// admit tiles that were outside the raw ambient-radius FOV but are
    /// illuminated and directly in line of sight from the player.
    /// </summary>
    public void AddVisible(int x, int y) => _visible.Add(Pack(x, y));

    public void Compute(int ox, int oy, int oz, int radius)
    {
        _visible.Clear();
        _visible.Add(Pack(ox, oy));

        for (int octant = 0; octant < 8; octant++)
        {
            CastLight(ox, oy, oz, radius, 1, 1.0, 0.0,
                Octants[octant, 0], Octants[octant, 1],
                Octants[octant, 2], Octants[octant, 3]);
        }
    }

    private void CastLight(int ox, int oy, int oz, int radius,
                           int row, double startSlope, double endSlope,
                           int xx, int xy, int yx, int yy)
    {
        if (startSlope < endSlope) return;
        double nextStart = startSlope;

        for (int i = row; i <= radius; i++)
        {
            bool blocked = false;
            int dx = -i - 1;
            int dy = -i;

            while (dx <= 0)
            {
                dx++;
                int mx = ox + dx * xx + dy * xy;
                int my = oy + dx * yx + dy * yy;
                double leftSlope  = (dx - 0.5) / (dy + 0.5);
                double rightSlope = (dx + 0.5) / (dy - 0.5);

                if (startSlope < rightSlope) continue;
                if (endSlope   > leftSlope)  break;

                if (dx * dx + dy * dy <= radius * radius)
                    _visible.Add(Pack(mx, my));

                var t = _world.GetTile(mx, my, oz);
                if (blocked)
                {
                    if (t.BlocksSight)
                    {
                        nextStart = rightSlope;
                        continue;
                    }
                    blocked = false;
                    startSlope = nextStart;
                }
                else if (t.BlocksSight && i < radius)
                {
                    blocked = true;
                    CastLight(ox, oy, oz, radius, i + 1, startSlope, leftSlope, xx, xy, yx, yy);
                    nextStart = rightSlope;
                }
            }
            if (blocked) break;
        }
    }

    public static long Pack(int x, int y) => ((long)x << 32) | (uint)y;

    /// <summary>
    /// Bresenham-style line-of-sight check between two tiles on the same
    /// Z-level. Returns false if any intermediate tile has <c>BlocksSight</c>.
    /// Endpoints do not themselves block. Used by NPC vision so NPCs can see
    /// the player independently of the player's FOV.
    /// </summary>
    public bool HasLineOfSight(int x0, int y0, int x1, int y1, int z)
    {
        int dx = Math.Abs(x1 - x0);
        int dy = Math.Abs(y1 - y0);
        int sx = x0 < x1 ? 1 : -1;
        int sy = y0 < y1 ? 1 : -1;
        int err = dx - dy;

        int cx = x0, cy = y0;
        while (cx != x1 || cy != y1)
        {
            int e2 = err * 2;
            if (e2 > -dy) { err -= dy; cx += sx; }
            if (e2 <  dx) { err += dx; cy += sy; }
            if (cx == x1 && cy == y1) return true;
            var t = _world.GetTile(cx, cy, z);
            if (t.BlocksSight) return false;
        }
        return true;
    }
}
