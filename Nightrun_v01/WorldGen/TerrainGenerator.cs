using Nightrun.Core;
using Nightrun.World;

namespace Nightrun.WorldGen;

/// <summary>
/// Fills a chunk's surface (z=0) with base ground tiles according to its biome,
/// blending gradually with neighbor biomes at chunk edges so transitions don't
/// look like wallpaper seams.
/// </summary>
public sealed class TerrainGenerator
{
    private const int BlendZone = 12; // tiles near edge where blending occurs

    private readonly WorldManager _world;

    public TerrainGenerator(WorldManager world) { _world = world; }

    public void Generate(Chunk chunk, RNG rng)
    {
        int S = Chunk.Size;
        var biome = chunk.Biome;

        // Sample neighbor biomes once
        Biome bTop    = _world.BiomeMapper.BiomeAt(chunk.Cx,     chunk.Cy - 1);
        Biome bBottom = _world.BiomeMapper.BiomeAt(chunk.Cx,     chunk.Cy + 1);
        Biome bLeft   = _world.BiomeMapper.BiomeAt(chunk.Cx - 1, chunk.Cy);
        Biome bRight  = _world.BiomeMapper.BiomeAt(chunk.Cx + 1, chunk.Cy);

        for (int y = 0; y < S; y++)
        {
            for (int x = 0; x < S; x++)
            {
                Biome effective = biome;

                // Pick the strongest "different-neighbor" pull toward an edge
                int dTop = y;
                int dBot = S - 1 - y;
                int dLft = x;
                int dRgt = S - 1 - x;

                double bestPull = 0;
                Biome bestBiome = biome;

                TryPull(bTop,    dTop, biome, ref bestPull, ref bestBiome);
                TryPull(bBottom, dBot, biome, ref bestPull, ref bestBiome);
                TryPull(bLeft,   dLft, biome, ref bestPull, ref bestBiome);
                TryPull(bRight,  dRgt, biome, ref bestPull, ref bestBiome);

                if (bestPull > 0 && rng.Chance(bestPull * 0.55))
                    effective = bestBiome;

                chunk.SetTile(x, y, 0, PickGroundTile(effective, x, y, chunk, rng));
            }
        }
    }

    private static void TryPull(Biome neighbor, int dist, Biome self,
                                ref double bestPull, ref Biome bestBiome)
    {
        if (neighbor == self || dist >= BlendZone) return;
        double pull = 1.0 - dist / (double)BlendZone;
        if (pull > bestPull) { bestPull = pull; bestBiome = neighbor; }
    }

    private Tile PickGroundTile(Biome biome, int lx, int ly, Chunk chunk, RNG rng)
    {
        // Sample elevation/moisture for texture variety within the same biome
        double elev = _world.ElevationNoise.FBM(
            (chunk.Cx * Chunk.Size + lx) * 0.04,
            (chunk.Cy * Chunk.Size + ly) * 0.04, 2);
        double moist = _world.MoistureNoise.Sample(
            (chunk.Cx * Chunk.Size + lx) * 0.08,
            (chunk.Cy * Chunk.Size + ly) * 0.08);

        TileType t = biome switch
        {
            Biome.Forest =>
                moist > 0.5  ? TileType.TallGrass :
                moist < -0.4 ? TileType.Dirt      : TileType.Grass,

            Biome.Suburbs =>
                moist < -0.5 ? TileType.Dirt : TileType.Grass,

            Biome.RichNeighborhood =>
                moist > 0.3  ? TileType.TallGrass : TileType.Grass,

            Biome.Rural =>
                moist > 0.4  ? TileType.TallGrass :
                moist < -0.4 ? TileType.Dirt      : TileType.Grass,

            Biome.Industrial =>
                rng.Chance(0.15) ? TileType.Asphalt : TileType.Gravel,

            Biome.UrbanCore =>
                rng.Chance(0.05) ? TileType.CrackedConcrete : TileType.Concrete,

            Biome.Ruins =>
                rng.Chance(0.3) ? TileType.Rubble : TileType.CrackedConcrete,

            Biome.Coast => moist > 0.3 ? TileType.Grass : TileType.Sand,

            Biome.Ocean => TileType.Water,
            Biome.Lake  => TileType.Water,
            Biome.River => TileType.Water,

            _ => biome.DefaultGround(),
        };

        return new Tile(t);
    }
}
