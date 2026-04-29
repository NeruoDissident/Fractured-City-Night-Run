namespace Nightrun.Core;

/// <summary>
/// 2D Simplex noise — deterministic from a seed.
/// Produces smooth [-1, 1] output for continuous spatial fields
/// (biome warping, terrain elevation, moisture, etc.).
/// </summary>
public sealed class SimplexNoise
{
    private static readonly int[,] Grad2 = new int[,]
    {
        { 1, 1 }, { -1, 1 }, { 1, -1 }, { -1, -1 },
        { 1, 0 }, { -1, 0 }, { 1, 0 },  { -1, 0 },
        { 0, 1 }, { 0, -1 }, { 0, 1 },  { 0, -1 }
    };

    private readonly byte[] _perm = new byte[512];

    public SimplexNoise(uint seed)
    {
        // Build permutation table deterministically from seed
        var p = new byte[256];
        for (int i = 0; i < 256; i++) p[i] = (byte)i;

        var rng = new RNG(seed);
        for (int i = 255; i > 0; i--)
        {
            int j = (int)(rng.NextUInt() % (uint)(i + 1));
            (p[i], p[j]) = (p[j], p[i]);
        }

        for (int i = 0; i < 512; i++) _perm[i] = p[i & 255];
    }

    public double Sample(double x, double y)
    {
        const double F2 = 0.3660254037844386;  // (sqrt(3) - 1) / 2
        const double G2 = 0.21132486540518713; // (3 - sqrt(3)) / 6

        double s = (x + y) * F2;
        int i = FastFloor(x + s);
        int j = FastFloor(y + s);

        double t = (i + j) * G2;
        double X0 = i - t;
        double Y0 = j - t;
        double x0 = x - X0;
        double y0 = y - Y0;

        int i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; }
        else { i1 = 0; j1 = 1; }

        double x1 = x0 - i1 + G2;
        double y1 = y0 - j1 + G2;
        double x2 = x0 - 1.0 + 2.0 * G2;
        double y2 = y0 - 1.0 + 2.0 * G2;

        int ii = i & 255;
        int jj = j & 255;

        int gi0 = _perm[ii + _perm[jj]] % 12;
        int gi1 = _perm[ii + i1 + _perm[jj + j1]] % 12;
        int gi2 = _perm[ii + 1 + _perm[jj + 1]] % 12;

        double n0 = Contrib(x0, y0, gi0);
        double n1 = Contrib(x1, y1, gi1);
        double n2 = Contrib(x2, y2, gi2);

        return 70.0 * (n0 + n1 + n2); // ≈ [-1, 1]
    }

    /// <summary>Fractal Brownian Motion — layered noise for richer terrain.</summary>
    public double FBM(double x, double y, int octaves, double lacunarity = 2.0, double gain = 0.5)
    {
        double sum = 0;
        double amp = 1;
        double freq = 1;
        double norm = 0;
        for (int i = 0; i < octaves; i++)
        {
            sum += Sample(x * freq, y * freq) * amp;
            norm += amp;
            amp *= gain;
            freq *= lacunarity;
        }
        return sum / norm;
    }

    private static double Contrib(double x, double y, int gi)
    {
        double t = 0.5 - x * x - y * y;
        if (t < 0) return 0;
        t *= t;
        return t * t * (Grad2[gi, 0] * x + Grad2[gi, 1] * y);
    }

    private static int FastFloor(double v) => v >= 0 ? (int)v : (int)v - 1;
}
