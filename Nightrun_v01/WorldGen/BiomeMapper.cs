using Nightrun.Core;
using Nightrun.World;

namespace Nightrun.WorldGen;

/// <summary>
/// Global, deterministic biome + district assignment per chunk coordinate.
/// Pure function of (cx, cy, seed) — no state, trivially parallelizable.
///
/// Algorithm (ported & extended from JS version):
///   1. Distance from origin → urban-to-wilderness gradient.
///   2. Low-frequency simplex warps the gradient so boundaries are organic blobs.
///   3. A second "variety" noise picks sub-biomes within each ring.
///   4. A separate "water" noise layer cuts in lakes/ocean/rivers at any distance.
///   5. District noise clusters adjacent same-biome chunks into coherent neighborhoods.
/// </summary>
public sealed class BiomeMapper
{
    private readonly WorldManager _world;

    public BiomeMapper(WorldManager world) { _world = world; }

    public Biome BiomeAt(int cx, int cy)
    {
        // --- Water features first: take priority over land biomes ---

        // Ocean — a massive low-frequency blob. Only reachable far from origin.
        double oceanField = _world.ElevationNoise.FBM(cx * 0.04, cy * 0.04, 3);
        double oceanEdge = 0.35 - Math.Min(1.0, DistFromOrigin(cx, cy) / 30.0) * 0.2;
        if (oceanField > oceanEdge && DistFromOrigin(cx, cy) > 12) return Biome.Ocean;

        // Lakes — medium-frequency noise pockets, rarer near origin
        double lakeField = _world.MoistureNoise.Sample(cx * 0.22, cy * 0.22);
        double lakeCutoff = 0.72 - Math.Max(0, DistFromOrigin(cx, cy) - 6) * 0.015;
        if (lakeField > lakeCutoff) return Biome.Lake;

        // Rivers — ridge noise creates meandering lines
        double rv = Math.Abs(_world.MoistureNoise.Sample(cx * 0.15, cy * 0.15));
        if (rv < 0.04 && DistFromOrigin(cx, cy) > 3) return Biome.River;

        // --- Land biomes: concentric gradient with noise warp ---

        double dist = DistFromOrigin(cx, cy);
        double warp = _world.BiomeNoise.Sample(cx * 0.18, cy * 0.18) * 2.0;
        double d = dist + warp;

        double v = _world.VarietyNoise.Sample(cx * 0.25, cy * 0.25); // [-1, 1]

        // Coast: any land chunk adjacent to ocean/lake shows up as coast
        if (NearWater(cx, cy)) return Biome.Coast;

        if (d < 2.0) return Biome.UrbanCore;
        if (d < 4.5)
        {
            if (v < -0.35) return Biome.Industrial;
            if (v <  0.25) return Biome.UrbanCore;
            return Biome.Suburbs;
        }
        if (d < 8.0)
        {
            if (v < -0.5) return Biome.Industrial;
            if (v < -0.1) return Biome.Ruins;
            if (v <  0.35) return Biome.Suburbs;
            return Biome.RichNeighborhood;
        }
        if (d < 14.0) return v < -0.15 ? Biome.Forest : Biome.Rural;
        return Biome.Forest;
    }

    public District DistrictAt(int cx, int cy, Biome biome)
    {
        double d = _world.DistrictNoise.Sample(cx * 0.35, cy * 0.35);
        // Use hashed coord roll so POI selection is stable per-chunk
        double poi = (Core.RNG.HashCoords(cx, cy, _world.Seed + 7777) / (double)uint.MaxValue);

        return biome switch
        {
            Biome.UrbanCore when poi < 0.06         => District.Plaza,
            Biome.UrbanCore when d < -0.2           => District.Downtown,
            Biome.UrbanCore when d <  0.3           => District.Shopping,
            Biome.UrbanCore when d <  0.6           => District.Downtown,
            Biome.UrbanCore                         => District.Slum,

            Biome.Suburbs when poi < 0.05           => District.Park,
            Biome.Suburbs                           => District.Residential,

            Biome.Industrial when d < -0.2          => District.FactoryCluster,
            Biome.Industrial when d <  0.3          => District.WarehouseDistrict,
            Biome.Industrial                        => District.RailYard,

            Biome.RichNeighborhood when poi < 0.08  => District.GolfCourse,
            Biome.RichNeighborhood when d < 0.2     => District.Mansion,
            Biome.RichNeighborhood                  => District.Residential,

            Biome.Ruins                             => District.None,
            Biome.Rural                             => District.RuralFarm,
            Biome.Forest when d < 0.2               => District.Woodland,
            Biome.Forest                            => District.DeepForest,
            Biome.Coast                             => District.Beach,
            Biome.Ocean                             => District.OceanDeep,
            Biome.Lake                              => District.LakeShore,
            Biome.River                             => District.RiverBank,
            _                                       => District.None,
        };
    }

    private static double DistFromOrigin(int cx, int cy) => Math.Sqrt(cx * cx + cy * cy);

    private bool NearWater(int cx, int cy)
    {
        // Check 4 cardinal neighbors without infinite recursion (don't call BiomeAt)
        // Use raw noise fields directly.
        for (int dx = -1; dx <= 1; dx++)
        for (int dy = -1; dy <= 1; dy++)
        {
            if (dx == 0 && dy == 0) continue;
            int nx = cx + dx, ny = cy + dy;
            double ocean = _world.ElevationNoise.FBM(nx * 0.04, ny * 0.04, 3);
            double oceanEdge = 0.35 - Math.Min(1.0, DistFromOrigin(nx, ny) / 30.0) * 0.2;
            if (ocean > oceanEdge && DistFromOrigin(nx, ny) > 12) return true;

            double lake = _world.MoistureNoise.Sample(nx * 0.22, ny * 0.22);
            double lakeCutoff = 0.72 - Math.Max(0, DistFromOrigin(nx, ny) - 6) * 0.015;
            if (lake > lakeCutoff) return true;
        }
        return false;
    }
}
