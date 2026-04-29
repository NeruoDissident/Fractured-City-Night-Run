import { Chunk } from './Chunk.js';

// ─── Biome visual representation on the overworld map ────────────────────────
const BIOME_VISUALS = {
    urban_core:        { glyph: '#',  color: '#aaaaaa', name: 'Urban Core' },
    suburbs:           { glyph: '"',  color: '#66aa44', name: 'Suburbs' },
    industrial:        { glyph: '%',  color: '#887766', name: 'Industrial' },
    rich_neighborhood: { glyph: '\u03a9', color: '#ddaa00', name: 'Upper City' },
    ruins:             { glyph: 'x',  color: '#886644', name: 'Ruins' },
    rural:             { glyph: ',',  color: '#558833', name: 'Rural' },
    forest:            { glyph: 'T',  color: '#226622', name: 'Overgrowth' },
};

const FALLBACK_VISUAL = { glyph: '.', color: '#555555', name: 'Unknown' };

// ─── Zone type pools per biome ────────────────────────────────────────────────
// Each entry: { id, name, width, height, weight }
const ZONE_POOLS = {
    urban_core: [
        { id: 'street_block',    name: 'City Street',       width: 96,  height: 96,  weight: 35 },
        { id: 'apartments',      name: 'Apartment Block',   width: 128, height: 96,  weight: 30 },
        { id: 'shopping_strip',  name: 'Corner Strip',      width: 96,  height: 80,  weight: 20 },
        { id: 'shopping_mall',   name: 'Shopping Mall',     width: 220, height: 180, weight: 10 },
        { id: 'corporate_tower', name: 'Corporate Tower',   width: 96,  height: 220, weight:  5 },
    ],
    suburbs: [
        { id: 'residential',     name: 'Residential Block', width: 128, height: 96,  weight: 50 },
        { id: 'street_block',    name: 'Suburb Street',     width: 96,  height: 96,  weight: 30 },
        { id: 'park',            name: 'Overgrown Park',    width: 128, height: 128, weight: 20 },
    ],
    industrial: [
        { id: 'warehouse',       name: 'Warehouse District',width: 160, height: 128, weight: 40 },
        { id: 'factory_floor',   name: 'Factory Floor',     width: 160, height: 160, weight: 30 },
        { id: 'rail_yard',       name: 'Rail Yard',         width: 192, height: 128, weight: 20 },
        { id: 'street_block',    name: 'Industrial Street', width: 96,  height: 96,  weight: 10 },
    ],
    rich_neighborhood: [
        { id: 'residential',     name: 'Executive Block',   width: 128, height: 128, weight: 40 },
        { id: 'corporate_tower', name: 'Corp Tower',        width: 96,  height: 220, weight: 30 },
        { id: 'park',            name: 'Manicured Park',    width: 128, height: 128, weight: 30 },
    ],
    ruins: [
        { id: 'collapsed',       name: 'Collapsed District',width: 128, height: 128, weight: 50 },
        { id: 'street_block',    name: 'Ruin Street',       width: 96,  height: 96,  weight: 30 },
        { id: 'apartments',      name: 'Ruined Block',      width: 128, height: 96,  weight: 20 },
    ],
    rural: [
        { id: 'wasteland',       name: 'Open Wasteland',    width: 160, height: 160, weight: 50 },
        { id: 'residential',     name: 'Rural Settlement',  width: 128, height: 96,  weight: 30 },
        { id: 'park',            name: 'Scrubland',         width: 160, height: 128, weight: 20 },
    ],
    forest: [
        { id: 'forest',          name: 'Deep Forest',       width: 160, height: 160, weight: 60 },
        { id: 'wasteland',       name: 'Forest Clearing',   width: 128, height: 128, weight: 40 },
    ],
};

const FALLBACK_ZONE = { id: 'street_block', name: 'Ruins', width: 96, height: 96 };

// ─── Threat level: base per biome + ring distance modifier ───────────────────
function computeThreat(biome, col, row, cols, rows) {
    const cx = col - Math.floor(cols / 2);
    const cy = row - Math.floor(rows / 2);
    const dist = Math.max(Math.abs(cx), Math.abs(cy)); // Chebyshev
    const ring = dist < 4 ? 0 : dist < 8 ? 1 : dist < 14 ? 2 : dist < 20 ? 3 : 4;

    const base = {
        urban_core: 2, suburbs: 1, industrial: 3,
        rich_neighborhood: 2, ruins: 3, rural: 1, forest: 2,
    }[biome] ?? 2;

    return Math.min(5, Math.max(1, base + ring));
}

// ─── Simple seeded PRNG (mulberry32) ─────────────────────────────────────────
function mulberry32(seed) {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function hashCoords(col, row, worldSeed) {
    let h = worldSeed | 0;
    h = Math.imul(h ^ col, 0x9E3779B9);
    h = Math.imul(h ^ row, 0x85EBCA6B);
    return (h ^ (h >>> 13)) >>> 0;
}

// ─── Weighted random pick from a pool ────────────────────────────────────────
function pickWeighted(pool, rng) {
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = rng * total;
    for (const entry of pool) {
        roll -= entry.weight;
        if (roll <= 0) return entry;
    }
    return pool[pool.length - 1];
}

// ─── OverworldTile ────────────────────────────────────────────────────────────
class OverworldTile {
    constructor(biome, threatLevel, zone, seed) {
        this.biome       = biome;
        this.threatLevel = threatLevel;
        this.zone        = zone;   // { id, name, width, height }
        this.seed        = seed;   // deterministic zone generation seed
        this.explored    = false;  // player has visited
        this.cleared     = false;  // all hostiles defeated (future)
        this.type        = 'zone'; // 'zone' | 'town' (future)
    }
}

// ─── OverworldMap ─────────────────────────────────────────────────────────────
export class OverworldMap {
    constructor(worldSeed) {
        this.worldSeed = worldSeed;
        this.cols      = 60;
        this.rows      = 40;

        // Fog of war: Infinity = fully visible (testing default)
        // Set to a number to limit revealed radius around explored tiles
        this.visionRadius = Infinity;

        // Player position on the overworld grid
        this.cursorCol = Math.floor(this.cols / 2);
        this.cursorRow = Math.floor(this.rows / 2);

        this.tiles = [];
        this._generate();

        // Starting tile is always explored
        this.tiles[this.cursorRow][this.cursorCol].explored = true;
    }

    _generate() {
        for (let row = 0; row < this.rows; row++) {
            this.tiles[row] = [];
            for (let col = 0; col < this.cols; col++) {
                // Map overworld coords to chunk coords (center = 0,0)
                const cx = col - Math.floor(this.cols / 2);
                const cy = row - Math.floor(this.rows / 2);

                const biome      = Chunk.computeBiome(cx, cy, this.worldSeed);
                const threat     = computeThreat(biome, col, row, this.cols, this.rows);
                const tileSeed   = hashCoords(col, row, this.worldSeed);
                const pool       = ZONE_POOLS[biome] || [FALLBACK_ZONE];
                const zone       = pickWeighted(pool, mulberry32(tileSeed));
                this.tiles[row][col] = new OverworldTile(biome, threat, zone, tileSeed);
            }
        }
    }

    getTile(col, row) {
        if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return null;
        return this.tiles[row][col];
    }

    getCurrentTile() {
        return this.getTile(this.cursorCol, this.cursorRow);
    }

    // Move cursor — returns true if moved
    moveCursor(dcol, drow) {
        const nc = this.cursorCol + dcol;
        const nr = this.cursorRow + drow;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) return false;
        this.cursorCol = nc;
        this.cursorRow = nr;
        return true;
    }

    // Mark current cursor tile (or specific tile) as explored
    markExplored(col = this.cursorCol, row = this.cursorRow) {
        const tile = this.getTile(col, row);
        if (tile) tile.explored = true;
    }

    // Whether a tile should be visible given current visionRadius
    isVisible(col, row) {
        if (this.visionRadius === Infinity) return true;
        const dc = col - this.cursorCol;
        const dr = row - this.cursorRow;
        return Math.sqrt(dc * dc + dr * dr) <= this.visionRadius;
    }

    // ── Rendering data ────────────────────────────────────────────────────────

    static getBiomeVisual(biome) {
        return BIOME_VISUALS[biome] || FALLBACK_VISUAL;
    }

    static getThreatColor(threat) {
        return ['#448844', '#888844', '#aa7722', '#cc4422', '#ff2222'][threat - 1] || '#888888';
    }

    static getThreatStars(threat) {
        return '★'.repeat(threat) + '☆'.repeat(5 - threat);
    }
}
