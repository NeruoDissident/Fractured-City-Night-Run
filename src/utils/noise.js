// 2D Simplex Noise — adapted from Stefan Gustavson's public-domain implementation
// Returns values in [-1, 1] for any (x, y) input, deterministic for a given seed.

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

// Gradient vectors for 2D
const GRAD = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [0, 1], [0, -1]
];

function buildPermutation(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Fisher-Yates shuffle seeded by a simple LCG
    let s = seed | 0;
    for (let i = 255; i > 0; i--) {
        s = Math.imul(s, 1664525) + 1013904223 | 0;
        const j = ((s >>> 0) % (i + 1));
        const tmp = p[i];
        p[i] = p[j];
        p[j] = tmp;
    }

    // Double the table so we can index without masking twice
    const perm = new Uint8Array(512);
    const permMod8 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        perm[i] = p[i & 255];
        permMod8[i] = perm[i] & 7;
    }
    return { perm, permMod8 };
}

function dot2(g, x, y) {
    return g[0] * x + g[1] * y;
}

export function createNoise2D(seed) {
    const { perm, permMod8 } = buildPermutation(seed);

    return function noise2D(xin, yin) {
        // Skew input space to determine which simplex cell we're in
        const s = (xin + yin) * F2;
        const i = Math.floor(xin + s);
        const j = Math.floor(yin + s);

        const t = (i + j) * G2;
        const X0 = i - t;
        const Y0 = j - t;
        const x0 = xin - X0;
        const y0 = yin - Y0;

        // Determine which simplex we're in
        let i1, j1;
        if (x0 > y0) { i1 = 1; j1 = 0; }
        else { i1 = 0; j1 = 1; }

        const x1 = x0 - i1 + G2;
        const y1 = y0 - j1 + G2;
        const x2 = x0 - 1.0 + 2.0 * G2;
        const y2 = y0 - 1.0 + 2.0 * G2;

        const ii = i & 255;
        const jj = j & 255;

        // Calculate contribution from each corner
        let n0 = 0, n1 = 0, n2 = 0;

        let t0 = 0.5 - x0 * x0 - y0 * y0;
        if (t0 >= 0) {
            t0 *= t0;
            const gi0 = permMod8[ii + perm[jj]];
            n0 = t0 * t0 * dot2(GRAD[gi0], x0, y0);
        }

        let t1 = 0.5 - x1 * x1 - y1 * y1;
        if (t1 >= 0) {
            t1 *= t1;
            const gi1 = permMod8[ii + i1 + perm[jj + j1]];
            n1 = t1 * t1 * dot2(GRAD[gi1], x1, y1);
        }

        let t2 = 0.5 - x2 * x2 - y2 * y2;
        if (t2 >= 0) {
            t2 *= t2;
            const gi2 = permMod8[ii + 1 + perm[jj + 1]];
            n2 = t2 * t2 * dot2(GRAD[gi2], x2, y2);
        }

        // Scale to [-1, 1]
        return 70.0 * (n0 + n1 + n2);
    };
}
