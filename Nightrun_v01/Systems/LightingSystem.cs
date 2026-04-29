using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.World;

namespace Nightrun.Systems;

/// <summary>
/// Per-turn lighting solver. Every compute pass rebuilds a dictionary of
/// <c>(x, y) → brightness (0..255)</c> by emitting light from the player's
/// lit gear, any lit items on their tile, and nearby static sources like
/// streetlights. Light falls off quadratically with distance and is blocked
/// by sight-blocking tiles via a simple Bresenham LOS check. Mirrors the
/// conceptual shape of the JS <c>LightingSystem</c> while staying light-
/// weight enough to call on every player action.
/// </summary>
public sealed class LightingSystem
{
    private readonly IWorldMap _world;
    private readonly Dictionary<long, byte> _lightMap = new();

    public LightingSystem(IWorldMap world) { _world = world; }

    public IReadOnlyDictionary<long, byte> LightMap => _lightMap;

    /// <summary>Returns 0..255 brightness at (<paramref name="x"/>, <paramref name="y"/>).</summary>
    public byte GetLight(int x, int y)
        => _lightMap.TryGetValue(Pack(x, y), out var v) ? v : (byte)0;

    /// <summary>Light threshold above which a tile counts as "lit" for FOV.</summary>
    public const byte LitThreshold = 32;

    /// <summary>
    /// Rebuild the light map for the current frame. Cheap enough to run on
    /// every player action — most pressure comes from the streetlight scan,
    /// which is bounded to a box around the player.
    /// </summary>
    public void Compute(Player p, TimeSystem time)
    {
        _lightMap.Clear();

        // 1. Player-carried lights (equipped + anything reachable that's lit).
        foreach (var (_, eq) in p.Equipment.All())
            EmitFromItem(eq, p.X, p.Y, p.Z);
        foreach (var it in p.Inventory.EnumerateReachableItems())
            EmitFromItem(it, p.X, p.Y, p.Z);

        // 2. Ground items on the player's tile.
        var ground = _world.GetItemsAt(p.X, p.Y, p.Z);
        if (ground != null)
            foreach (var it in ground) EmitFromItem(it, p.X, p.Y, p.Z);

        // 3. Static lights: streetlights only come on at night / twilight.
        if (time.Phase != TimeOfDay.Day)
            EmitStaticLights(p.X, p.Y, p.Z);
    }

    private void EmitFromItem(Item it, int px, int py, int pz)
    {
        if (!it.IsLit) return;
        if (it.LightRadius <= 0) return;
        if (it.RequiresFuel && it.LightFuel <= 0) return;
        EmitRadial(px, py, pz, it.LightRadius, 255);
    }

    private void EmitStaticLights(int px, int py, int pz)
    {
        // Scan a box slightly larger than the FOV to catch streetlights we
        // might only see peripherally. 24 tiles is roughly two in-town blocks.
        const int scan = 24;
        const int lampRadius = 6;

        for (int y = py - scan; y <= py + scan; y++)
        {
            for (int x = px - scan; x <= px + scan; x++)
            {
                var t = _world.GetTile(x, y, pz);
                if (t.Type != TileType.Streetlight) continue;
                // Streetlights are broken when Damage > 200 — leave them dark.
                if (t.Damage > 200) continue;
                EmitRadial(x, y, pz, lampRadius, 220);
            }
        }
    }

    /// <summary>
    /// Stamp a radial light onto the map. <paramref name="maxBrightness"/> is
    /// the value at the source tile; every other tile gets
    /// <c>max * (1 - (d / radius))^2</c>, clamped. Tiles occluded by walls
    /// are skipped so light does not leak through solid geometry.
    /// </summary>
    private void EmitRadial(int sx, int sy, int sz, int radius, int maxBrightness)
    {
        int r2 = radius * radius;
        for (int y = sy - radius; y <= sy + radius; y++)
        {
            for (int x = sx - radius; x <= sx + radius; x++)
            {
                int dx = x - sx;
                int dy = y - sy;
                int d2 = dx * dx + dy * dy;
                if (d2 > r2) continue;

                if (!HasLineOfSight(sx, sy, x, y, sz)) continue;

                double d = Math.Sqrt(d2);
                double falloff = 1.0 - (d / radius);
                falloff = Math.Max(0, falloff);
                falloff *= falloff;     // quadratic

                int b = (int)(maxBrightness * falloff);
                if (b <= 0) continue;

                long key = Pack(x, y);
                if (_lightMap.TryGetValue(key, out var existing))
                {
                    if (b > existing) _lightMap[key] = (byte)b;
                }
                else
                {
                    _lightMap[key] = (byte)b;
                }
            }
        }
    }

    /// <summary>
    /// Bresenham LOS from (x0,y0) to (x1,y1). Returns false when an
    /// intermediate tile blocks sight. Endpoints are treated as transparent
    /// so walls light up their own faces, mirroring the JS behavior.
    /// </summary>
    private bool HasLineOfSight(int x0, int y0, int x1, int y1, int z)
    {
        if (x0 == x1 && y0 == y1) return true;
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

    public static long Pack(int x, int y) => ((long)x << 32) | (uint)y;

    /// <summary>
    /// Decrement fuel on every lit item the player is carrying. Called by
    /// <see cref="Core.Game"/> on each turn tick; items whose fuel hits zero
    /// auto-extinguish.
    /// </summary>
    public static void TickFuel(Player p, Action<string> log)
    {
        void TryTick(Item it)
        {
            if (!it.IsLit || !it.RequiresFuel) return;
            if (it.LightFuel <= 0) { it.IsLit = false; return; }
            it.LightFuel--;
            if (it.LightFuel == 0)
            {
                it.IsLit = false;
                log?.Invoke($"Your {it.Name} flickers out.");
            }
            else if (it.LightFuel == 25 && it.MaxLightFuel > 50)
            {
                log?.Invoke($"Your {it.Name} is running low.");
            }
        }

        foreach (var (_, eq) in p.Equipment.All()) TryTick(eq);
        foreach (var it in p.Inventory.EnumerateReachableItems()) TryTick(it);
    }
}
