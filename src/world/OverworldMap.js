// Terrain-first overworld map.
//
// The rest of the game still expects each tile to expose:
//   biome, threatLevel, zone, seed, explored
// This generator adds geography on top of that contract:
//   terrain, water, region, tags, road, settlement, landmark, playBiome

const BIOME_VISUALS = {
    ocean:             { glyph: '~', color: '#2255aa', name: 'Ocean' },
    lake:              { glyph: '~', color: '#3377cc', name: 'Lake' },
    river:             { glyph: '=', color: '#44aaff', name: 'River' },
    coast:             { glyph: ';', color: '#c8b36a', name: 'Coast' },
    wetland:           { glyph: '"', color: '#448877', name: 'Wetland' },
    urban_core:        { glyph: '#', color: '#aaaaaa', name: 'Urban Core' },
    suburbs:           { glyph: '"', color: '#66aa44', name: 'Suburbs' },
    industrial:        { glyph: '%', color: '#887766', name: 'Industrial' },
    rich_neighborhood: { glyph: 'O', color: '#ddaa00', name: 'Upper City' },
    ruins:             { glyph: 'x', color: '#886644', name: 'Ruins' },
    rural:             { glyph: ',', color: '#558833', name: 'Rural' },
    forest:            { glyph: 'T', color: '#226622', name: 'Overgrowth' },
    road:              { glyph: '+', color: '#777777', name: 'Road' },
    bridge:            { glyph: '+', color: '#ddddaa', name: 'Bridge' },
};

const FALLBACK_VISUAL = { glyph: '.', color: '#555555', name: 'Unknown' };

// Each entry: { id, name, width, height, weight, faction, purpose, threatMod,
//               keyFeature, npcSignature[], tags[] }
const ZONE_POOLS = {
    ocean: [
        { id: 'open_water', name: 'Open Water', width: 80, height: 80, weight: 60,
          faction: 'none', purpose: 'travel', threatMod: 0, keyFeature: 'water',
          npcSignature: [], tags: ['water', 'open'] },
        { id: 'wreck_marker', name: 'Wreck Marker', width: 96, height: 80, weight: 20,
          faction: 'scavengers', purpose: 'salvage', threatMod: 1, keyFeature: 'machinery_loot_cache',
          npcSignature: ['scavenger'], tags: ['water', 'wreck', 'salvage'] },
    ],
    lake: [
        { id: 'lake_shore', name: 'Lake Shore', width: 100, height: 80, weight: 50,
          faction: 'independent', purpose: 'scavenge', threatMod: -1, keyFeature: 'lake',
          npcSignature: ['survivor', 'drifter'], tags: ['water', 'shore'] },
        { id: 'flooded_camp', name: 'Flooded Camp', width: 96, height: 96, weight: 25,
          faction: 'scavengers', purpose: 'scavenge', threatMod: 0, keyFeature: 'stash',
          npcSignature: ['scavenger'], tags: ['water', 'camp'] },
    ],
    river: [
        { id: 'river_crossing', name: 'River Crossing', width: 100, height: 80, weight: 40,
          faction: 'independent', purpose: 'travel', threatMod: 0, keyFeature: 'bridge',
          npcSignature: ['survivor'], tags: ['river', 'bridge'] },
        { id: 'toll_bridge', name: 'Toll Bridge', width: 100, height: 70, weight: 25,
          faction: 'gangers', purpose: 'clear_hostiles', threatMod: 1, keyFeature: 'gang_stash',
          npcSignature: ['ganger', 'brute'], tags: ['river', 'bridge', 'toll'] },
    ],
    coast: [
        { id: 'coastal_road', name: 'Coastal Road', width: 120, height: 80, weight: 35,
          faction: 'independent', purpose: 'travel', threatMod: 0, keyFeature: 'stash',
          npcSignature: ['survivor', 'scavenger'], tags: ['coast', 'road'] },
        { id: 'marina_ruins', name: 'Marina Ruins', width: 120, height: 100, weight: 20,
          faction: 'smugglers', purpose: 'salvage', threatMod: 1, keyFeature: 'smuggler_den',
          npcSignature: ['smuggler', 'trader'], tags: ['coast', 'boat', 'salvage'] },
    ],
    urban_core: [
        { id: 'urban_corner_store', name: 'Corner Store Block', width: 128, height: 128, weight: 40,
          faction: 'independent', purpose: 'scavenge', threatMod: 0, keyFeature: 'market_stalls',
          npcSignature: ['survivor', 'scavenger'], tags: ['urban', 'retail', 'food'] },
        { id: 'urban_market_corner', name: 'Market Corner', width: 128, height: 128, weight: 30,
          faction: 'independent', purpose: 'scavenge', threatMod: 0, keyFeature: 'street_market',
          npcSignature: ['survivor', 'drifter', 'scavenger'], tags: ['urban', 'retail', 'medical'] },
        { id: 'neon_row', name: 'Neon Row', width: 80, height: 60, weight: 25,
          faction: 'independent', purpose: 'trade', threatMod: 0, keyFeature: 'market_stalls',
          npcSignature: ['trader', 'fixer'], tags: ['urban', 'market'] },
        { id: 'kiroshi_hub', name: 'Kiroshi Data Hub', width: 80, height: 120, weight: 15,
          faction: 'corporates', purpose: 'hack', threatMod: 1, keyFeature: 'server_vault',
          npcSignature: ['corpo_netrunner', 'corpo_guard'], tags: ['urban', 'corporate', 'technical'] },
        { id: 'shopping_strip', name: 'Dead Mall', width: 96, height: 80, weight: 20,
          faction: 'gangers', purpose: 'clear_hostiles', threatMod: 0, keyFeature: 'gang_stash',
          npcSignature: ['ganger', 'brute'], tags: ['urban', 'retail', 'mall'] },
    ],
    suburbs: [
        { id: 'marrow_row', name: 'Marrow Row', width: 100, height: 80, weight: 35,
          faction: 'scavengers', purpose: 'scavenge', threatMod: 0, keyFeature: 'stash',
          npcSignature: ['scavenger', 'survivor'], tags: ['suburb', 'residential'] },
        { id: 'safehouse_block', name: 'Safehouse Block', width: 90, height: 70, weight: 20,
          faction: 'independent', purpose: 'trade', threatMod: -1, keyFeature: 'safehouse',
          npcSignature: ['trader', 'survivor'], tags: ['suburb', 'safehouse'] },
        { id: 'overgrown_park', name: 'Tangled Park', width: 120, height: 120, weight: 20,
          faction: 'independent', purpose: 'explore', threatMod: -1, keyFeature: 'lake',
          npcSignature: ['survivor', 'drifter'], tags: ['suburb', 'park'] },
    ],
    industrial: [
        { id: 'henderson_plant', name: 'Henderson Plant', width: 140, height: 120, weight: 35,
          faction: 'scavengers', purpose: 'salvage', threatMod: 0, keyFeature: 'machinery_loot_cache',
          npcSignature: ['scavenger', 'survivor'], tags: ['industrial', 'salvage'] },
        { id: 'the_yards', name: 'The Yards', width: 160, height: 100, weight: 25,
          faction: 'smugglers', purpose: 'trade', threatMod: 0, keyFeature: 'smuggler_den',
          npcSignature: ['smuggler', 'trader'], tags: ['industrial', 'yard'] },
        { id: 'tank_farm', name: 'Tank Farm', width: 100, height: 100, weight: 20,
          faction: 'independent', purpose: 'scavenge', threatMod: 0, keyFeature: 'chemical_stash',
          npcSignature: ['scavenger'], tags: ['industrial', 'fuel'] },
    ],
    rich_neighborhood: [
        { id: 'aurora_clinic', name: 'Aurora Clinic', width: 80, height: 100, weight: 30,
          faction: 'corporates', purpose: 'salvage', threatMod: 0, keyFeature: 'medical_cache',
          npcSignature: ['corpo_guard', 'survivor'], tags: ['medical', 'corporate'] },
        { id: 'the_terraces', name: 'The Terraces', width: 120, height: 120, weight: 25,
          faction: 'moguls', purpose: 'loot_heist', threatMod: 1, keyFeature: 'vault',
          npcSignature: ['mogul_guard', 'mogul_boss'], tags: ['rich', 'vault'] },
    ],
    ruins: [
        { id: 'old_town_hall', name: 'Old Town Hall', width: 80, height: 80, weight: 25,
          faction: 'independent', purpose: 'hack', threatMod: 0, keyFeature: 'archives',
          npcSignature: ['netrunner', 'scavenger'], tags: ['ruins', 'civic'] },
        { id: 'collapsed_mall', name: 'Collapsed Mall', width: 140, height: 100, weight: 25,
          faction: 'scavengers', purpose: 'scavenge', threatMod: 0, keyFeature: 'stash',
          npcSignature: ['scavenger', 'survivor'], tags: ['ruins', 'retail'] },
        { id: 'metro_depths', name: 'Metro Depths', width: 80, height: 160, weight: 15,
          faction: 'ferals', purpose: 'explore', threatMod: 1, keyFeature: 'echo_fragment',
          npcSignature: ['feral'], tags: ['ruins', 'echo', 'underground'] },
    ],
    rural: [
        { id: 'abandoned_farm', name: 'Abandoned Farm', width: 120, height: 100, weight: 35,
          faction: 'independent', purpose: 'scavenge', threatMod: -1, keyFeature: 'stash',
          npcSignature: ['scavenger', 'survivor'], tags: ['rural', 'farm'] },
        { id: 'highway_overlook', name: 'Highway Overlook', width: 100, height: 60, weight: 20,
          faction: 'smugglers', purpose: 'trade', threatMod: 0, keyFeature: 'smuggler_den',
          npcSignature: ['smuggler', 'trader'], tags: ['rural', 'road'] },
    ],
    forest: [
        { id: 'greenhold', name: 'Greenhold', width: 120, height: 120, weight: 35,
          faction: 'independent', purpose: 'explore', threatMod: -1, keyFeature: 'lake',
          npcSignature: ['survivor', 'drifter'], tags: ['forest', 'camp'] },
        { id: 'logging_camp', name: 'Logging Camp', width: 100, height: 80, weight: 20,
          faction: 'scavengers', purpose: 'salvage', threatMod: 0, keyFeature: 'machinery_loot_cache',
          npcSignature: ['scavenger'], tags: ['forest', 'salvage'] },
    ],
};

const FALLBACK_ZONE = { id: 'wilds', name: 'Empty Lot', width: 96, height: 96, weight: 1, faction: 'none', purpose: 'travel', tags: ['wild'] };

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function hashCoords(col, row, worldSeed) {
    let h = worldSeed | 0;
    h = Math.imul(h ^ (col + 0x9E3779B9), 0x85EBCA6B);
    h = Math.imul(h ^ (row + 0xC2B2AE35), 0x27D4EB2F);
    return (h ^ (h >>> 13)) >>> 0;
}

function valueNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const smooth = (t) => t * t * (3 - 2 * t);
    const sx = smooth(fx);
    const sy = smooth(fy);
    const sample = (ix, iy) => mulberry32(hashCoords(ix, iy, seed))();
    const a = sample(x0, y0);
    const b = sample(x0 + 1, y0);
    const c = sample(x0, y0 + 1);
    const d = sample(x0 + 1, y0 + 1);
    const ab = a + (b - a) * sx;
    const cd = c + (d - c) * sx;
    return ab + (cd - ab) * sy;
}

function fbm(x, y, seed) {
    let value = 0;
    let amp = 0.55;
    let freq = 1;
    let total = 0;
    for (let i = 0; i < 4; i++) {
        value += valueNoise(x * freq, y * freq, seed + i * 1013) * amp;
        total += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return value / total;
}

function pickWeighted(pool, rng) {
    const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
    let roll = rng() * total;
    for (const entry of pool) {
        roll -= entry.weight || 1;
        if (roll <= 0) return entry;
    }
    return pool[pool.length - 1];
}

function distanceToSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    const cx = ax + t * vx;
    const cy = ay + t * vy;
    const dx = px - cx;
    const dy = py - cy;
    return Math.sqrt(dx * dx + dy * dy);
}

function computeThreat(biome, terrain, distanceFromCity, road) {
    if (terrain === 'ocean' || terrain === 'lake') return 1;
    const base = {
        urban_core: 2, suburbs: 1, industrial: 3,
        rich_neighborhood: 2, ruins: 3, rural: 1, forest: 2,
        coast: 2, river: 2, wetland: 2,
    }[biome] ?? 2;
    const remote = distanceFromCity > 35 ? 2 : distanceFromCity > 22 ? 1 : 0;
    const roadMod = road ? -1 : 0;
    return Math.min(5, Math.max(1, base + remote + roadMod));
}

class OverworldTile {
    constructor(data) {
        Object.assign(this, data);
        this.explored = false;
        this.cleared = false;
        this.type = data.type || 'zone';
    }
}

export class OverworldMap {
    constructor(worldSeed) {
        this.worldSeed = worldSeed;
        this.seed = worldSeed;
        this.cols = 160;
        this.rows = 100;
        this.visionRadius = Infinity;
        this.cursorCol = Math.floor(this.cols / 2);
        this.cursorRow = Math.floor(this.rows / 2);
        this.tiles = [];
        this._cities = this._makeCityAnchors();
        this._rivers = this._makeRivers();
        this._roads = [];
        this._generate();
        this.tiles[this.cursorRow][this.cursorCol].explored = true;
    }

    _makeCityAnchors() {
        return [
            { id: 'fractured_city', name: 'Fractured City', col: Math.floor(this.cols * 0.50), row: Math.floor(this.rows * 0.50), radius: 18, kind: 'city' },
            { id: 'south_mills', name: 'South Mills', col: Math.floor(this.cols * 0.37), row: Math.floor(this.rows * 0.68), radius: 9, kind: 'industrial' },
            { id: 'lake_town', name: 'Lake Town', col: Math.floor(this.cols * 0.65), row: Math.floor(this.rows * 0.36), radius: 8, kind: 'settlement' },
            { id: 'coast_yards', name: 'Coast Yards', col: Math.floor(this.cols * 0.24), row: Math.floor(this.rows * 0.46), radius: 8, kind: 'port' },
        ];
    }

    _makeRivers() {
        return [
            [
                { col: Math.floor(this.cols * 0.72), row: 5 },
                { col: Math.floor(this.cols * 0.66), row: 26 },
                { col: Math.floor(this.cols * 0.58), row: 44 },
                { col: Math.floor(this.cols * 0.48), row: 60 },
                { col: Math.floor(this.cols * 0.32), row: 76 },
                { col: Math.floor(this.cols * 0.16), row: 94 },
            ],
            [
                { col: Math.floor(this.cols * 0.46), row: 2 },
                { col: Math.floor(this.cols * 0.50), row: 20 },
                { col: Math.floor(this.cols * 0.52), row: 42 },
                { col: Math.floor(this.cols * 0.50), row: 58 },
                { col: Math.floor(this.cols * 0.43), row: 78 },
                { col: Math.floor(this.cols * 0.38), row: 98 },
            ],
        ];
    }

    _nearestCity(col, row) {
        let best = null;
        let bestDist = Infinity;
        for (const city of this._cities) {
            const dx = col - city.col;
            const dy = row - city.row;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < bestDist) {
                best = city;
                bestDist = dist;
            }
        }
        return { city: best, dist: bestDist };
    }

    _distanceToRiver(col, row) {
        let best = Infinity;
        for (const river of this._rivers) {
            for (let i = 0; i < river.length - 1; i++) {
                const a = river[i];
                const b = river[i + 1];
                best = Math.min(best, distanceToSegment(col, row, a.col, a.row, b.col, b.row));
            }
        }
        return best;
    }

    _isRoad(col, row) {
        for (const city of this._cities.slice(1)) {
            const main = this._cities[0];
            if (distanceToSegment(col, row, main.col, main.row, city.col, city.row) <= 0.75) return true;
        }
        return false;
    }

    _classify(col, row) {
        const nx = col / (this.cols - 1);
        const ny = row / (this.rows - 1);
        const elevation = fbm(nx * 5.2, ny * 4.4, this.worldSeed) - (0.34 - nx * 0.22);
        const moisture = fbm(nx * 7.0 + 20, ny * 7.0 - 11, this.worldSeed + 77);
        const riverDist = this._distanceToRiver(col, row);
        const { city, dist } = this._nearestCity(col, row);
        const road = this._isRoad(col, row);

        let terrain = 'land';
        let water = null;
        let biome = 'rural';
        let region = 'wilds';
        const tags = [];

        if (elevation < 0.32) {
            terrain = 'ocean';
            water = 'salt';
            biome = 'ocean';
            tags.push('water', 'ocean');
        } else if (elevation < 0.38) {
            terrain = 'coast';
            biome = 'coast';
            tags.push('coast');
        }

        // Major settlements are allowed to bend geography: the map should not
        // spawn the hub in open water even when the coastline noise cuts inland.
        if (dist <= city.radius + 5 && terrain === 'ocean') {
            terrain = 'coast';
            water = null;
            biome = 'coast';
            tags.length = 0;
            tags.push('coast');
        }

        const lakeNoise = fbm(nx * 9.5 - 3, ny * 9.5 + 8, this.worldSeed + 131);
        if (terrain === 'land' && lakeNoise > 0.76 && moisture > 0.54 && dist > 10) {
            terrain = 'lake';
            water = 'fresh';
            biome = 'lake';
            tags.push('water', 'lake');
        }

        if (terrain === 'land' && riverDist <= 0.7) {
            terrain = 'river';
            water = 'fresh';
            biome = 'river';
            tags.push('water', 'river');
        } else if (terrain === 'land' && riverDist <= 2.0 && moisture > 0.48) {
            terrain = 'wetland';
            biome = 'wetland';
            tags.push('wetland', 'river');
        }

        // The city core should read as city, not as a water feature. Rivers and
        // coastlines can still cut through outer districts.
        if (dist <= city.radius * 0.35) {
            terrain = 'land';
            water = null;
            for (const tag of ['water', 'ocean', 'lake', 'river', 'wetland', 'coast']) {
                const idx = tags.indexOf(tag);
                if (idx !== -1) tags.splice(idx, 1);
            }
        }

        if (terrain === 'land' || terrain === 'wetland' || terrain === 'coast') {
            if (dist <= city.radius) {
                region = city.id;
                if (city.kind === 'industrial' || (city.kind === 'port' && dist < city.radius * 0.7)) biome = 'industrial';
                else if (city.kind === 'settlement') biome = dist < city.radius * 0.45 ? 'suburbs' : 'rural';
                else if (dist < city.radius * 0.35) biome = 'urban_core';
                else if (dist < city.radius * 0.58) biome = 'suburbs';
                else biome = moisture > 0.55 ? 'ruins' : 'industrial';
                tags.push('settled', city.kind);
            } else if (dist < city.radius + 9) {
                biome = moisture > 0.55 ? 'ruins' : 'suburbs';
                tags.push('outskirts');
            } else if (moisture > 0.62) {
                biome = 'forest';
            } else {
                biome = 'rural';
            }
        }

        if (road && terrain !== 'ocean' && terrain !== 'lake') {
            tags.push('road');
        }

        return { terrain, water, biome, region, tags, city, distanceFromCity: dist, road };
    }

    _generate() {
        for (let row = 0; row < this.rows; row++) {
            this.tiles[row] = [];
            for (let col = 0; col < this.cols; col++) {
                const tileSeed = hashCoords(col, row, this.worldSeed);
                const rng = mulberry32(tileSeed);
                const geo = this._classify(col, row);
                const zoneBiome = geo.biome;
                const pool = ZONE_POOLS[zoneBiome] || ZONE_POOLS[geo.terrain] || ZONE_POOLS.rural || [FALLBACK_ZONE];
                const zone = { ...pickWeighted(pool, rng) };

                if (geo.road && geo.terrain === 'river') {
                    zone.id = 'road_bridge';
                    zone.name = 'Road Bridge';
                    zone.keyFeature = 'bridge';
                    zone.tags = ['road', 'river', 'bridge'];
                    zone.faction = 'independent';
                    zone.purpose = 'travel';
                }

                const threat = computeThreat(zoneBiome, geo.terrain, geo.distanceFromCity, geo.road);
                const type = geo.tags.includes('settled') ? 'settlement' :
                    geo.terrain === 'ocean' || geo.terrain === 'lake' || geo.terrain === 'river' ? 'water' :
                    geo.road ? 'roadside' : 'wild';

                this.tiles[row][col] = new OverworldTile({
                    col,
                    row,
                    biome: zoneBiome,
                    playBiome: ['ocean', 'lake', 'river', 'coast', 'wetland'].includes(zoneBiome) ? 'rural' : zoneBiome,
                    terrain: geo.terrain,
                    water: geo.water,
                    region: geo.region,
                    tags: [...new Set([...(geo.tags || []), ...(zone.tags || [])])],
                    road: geo.road,
                    settlement: geo.tags.includes('settled') ? geo.city?.name : null,
                    landmark: null,
                    threatLevel: threat,
                    zone,
                    seed: tileSeed,
                    type,
                });
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

    moveCursor(dcol, drow) {
        const nc = this.cursorCol + dcol;
        const nr = this.cursorRow + drow;
        if (nc < 0 || nc >= this.cols || nr < 0 || nr >= this.rows) return false;
        this.cursorCol = nc;
        this.cursorRow = nr;
        return true;
    }

    markExplored(col = this.cursorCol, row = this.cursorRow) {
        const tile = this.getTile(col, row);
        if (tile) tile.explored = true;
    }

    isVisible(col, row) {
        if (this.visionRadius === Infinity) return true;
        const dc = col - this.cursorCol;
        const dr = row - this.cursorRow;
        return Math.sqrt(dc * dc + dr * dr) <= this.visionRadius;
    }

    static getBiomeVisual(biome) {
        return BIOME_VISUALS[biome] || FALLBACK_VISUAL;
    }

    static getTileVisual(tile) {
        if (!tile) return FALLBACK_VISUAL;
        if (tile.road && tile.terrain === 'river') return BIOME_VISUALS.bridge;
        if (tile.road && tile.terrain !== 'ocean' && tile.terrain !== 'lake') return BIOME_VISUALS.road;
        return BIOME_VISUALS[tile.biome] || BIOME_VISUALS[tile.terrain] || FALLBACK_VISUAL;
    }

    static getThreatColor(threat) {
        return ['#448844', '#888844', '#aa7722', '#cc4422', '#ff2222'][threat - 1] || '#888888';
    }

    static getThreatStars(threat) {
        return '*'.repeat(threat) + '.'.repeat(5 - threat);
    }
}
