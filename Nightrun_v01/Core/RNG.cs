namespace Nightrun.Core;

/// <summary>
/// Deterministic seeded PRNG. Mulberry32 algorithm — fast, good distribution,
/// identical output to the JS version so world seeds are portable.
/// </summary>
public sealed class RNG
{
    private uint _state;

    public RNG(uint seed)
    {
        _state = seed == 0 ? 1u : seed;
    }

    public uint NextUInt()
    {
        _state = unchecked(_state + 0x6D2B79F5u);
        uint t = _state;
        t = unchecked((t ^ (t >> 15)) * (t | 1u));
        t ^= unchecked(t + ((t ^ (t >> 7)) * (t | 61u)));
        return t ^ (t >> 14);
    }

    /// <summary>Uniform double in [0, 1).</summary>
    public double NextDouble() => NextUInt() / 4294967296.0;

    /// <summary>Uniform int in [min, max).</summary>
    public int Range(int minInclusive, int maxExclusive)
    {
        if (maxExclusive <= minInclusive) return minInclusive;
        int span = maxExclusive - minInclusive;
        return minInclusive + (int)(NextDouble() * span);
    }

    /// <summary>Chance check: true with probability p in [0,1].</summary>
    public bool Chance(double p) => NextDouble() < p;

    public T Pick<T>(IReadOnlyList<T> list) => list[Range(0, list.Count)];

    /// <summary>
    /// Deterministic 32-bit hash of 2 ints + a seed. Used to derive per-chunk seeds.
    /// </summary>
    public static uint HashCoords(int x, int y, uint seed)
    {
        unchecked
        {
            uint h = seed;
            h ^= (uint)x * 0x9E3779B1u;
            h = (h << 13) | (h >> 19);
            h ^= (uint)y * 0x85EBCA77u;
            h = (h << 17) | (h >> 15);
            h *= 0xC2B2AE3Du;
            h ^= h >> 16;
            return h == 0 ? 1u : h;
        }
    }
}
