/**
 * InteriorGenerator - multi-floor interior "sites" for the first-person crawler
 *
 * A *site* is a building you drop into from the overworld: a stack of floors
 * carved out of solid rock, joined by a stair core that runs the full height,
 * with one entrance on the ground floor that leads back out.
 *
 * Geometry is built on a working grid of cell kinds first, then painted onto the
 * ZoneCanvas. Keeping the two steps apart makes connectivity and door placement
 * easy to reason about, and means a layout can be checked without touching tiles.
 *
 * Layouts (see LAYOUTS below):
 *   spine - one corridor with rooms down both sides. Offices, wards, apartments.
 *   bsp   - recursive subdivision, irregular rooms and L-corridors. Sublevels.
 *   ring  - corridor loop with rooms inside and out. Malls, atriums.
 *
 * The generator never spawns NPCs; the roster is still placeholder (see
 * CLAUDE.md). Use F9 / game.debugSpawn() to put something in front of you.
 *
 * EXPANSION POINTS:
 * - More layouts (radial, warehouse aisles, flooded sublevel)
 * - Keyed doors once a key system exists; today locks are smash-only
 * - Per-site set pieces (a vault, a server cage, a collapsed floor)
 * - Encounter/loot budgets per level once the run flow is defined
 */

import { ZoneTiles, stairsTile, siteExitTile } from './ZoneTiles.js';

// ── Working grid cell kinds ────────────────────────────────────────────────────
const SOLID = 0;
const ROOM = 1;
const CORRIDOR = 2;
const DOOR = 3;
const STAIRS = 4;
const EXIT = 5;

const OPEN_KINDS = new Set([ROOM, CORRIDOR, DOOR, STAIRS, EXIT]);

// ── Room presentation ──────────────────────────────────────────────────────────

const ROOM_FLOOR = {
    office: 'carpet',
    office_reception: 'lobbyFloor',
    commercial_store: 'storeFloor',
    commercial_backroom: 'stockFloor',
    medical_exam: 'tileFloor',
    medical_storage: 'stockFloor',
    medical_waiting: 'lobbyFloor',
    medical_store: 'tileFloor',
    residential_bedroom: 'carpet',
    residential_kitchen: 'tileFloor',
    residential_bathroom: 'bathroomFloor',
    residential_living: 'carpet',
    garage_bay: 'garageFloor'
};

const ROOM_LABEL = {
    office: 'Office',
    office_reception: 'Reception',
    commercial_store: 'Shop Floor',
    commercial_backroom: 'Stockroom',
    medical_exam: 'Exam Room',
    medical_storage: 'Medical Storage',
    medical_waiting: 'Waiting Room',
    medical_store: 'Dispensary',
    residential_bedroom: 'Bedroom',
    residential_kitchen: 'Kitchen',
    residential_bathroom: 'Washroom',
    residential_living: 'Living Room',
    garage_bay: 'Service Bay'
};

// Furniture candidates per room type. Placed along walls, never blocking a door.
const ROOM_FURNITURE = {
    office: ['table', 'chair', 'filing_cabinet', 'terminal', 'chair'],
    office_reception: ['counter', 'chair', 'table', 'filing_cabinet'],
    commercial_store: ['shelf', 'shelf', 'counter', 'crate'],
    commercial_backroom: ['crate', 'shelf', 'locker', 'crate'],
    medical_exam: ['bed', 'cabinet', 'sink', 'chair'],
    medical_storage: ['cabinet', 'shelf', 'crate'],
    medical_waiting: ['chair', 'chair', 'table', 'counter'],
    medical_store: ['cabinet', 'shelf', 'counter'],
    residential_bedroom: ['bed', 'dresser', 'locker'],
    residential_kitchen: ['stove', 'cabinet', 'sink', 'table'],
    residential_bathroom: ['toilet', 'sink', 'shower'],
    residential_living: ['couch', 'table', 'chair', 'shelf'],
    garage_bay: ['workbench', 'crate', 'locker', 'shelf']
};

// ── Small helpers ──────────────────────────────────────────────────────────────

const idx = (W, x, y) => y * W + x;
const sign = n => (n > 0 ? 1 : n < 0 ? -1 : 0);
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
}

function weightedPick(rng, entries) {
    const total = entries.reduce((sum, e) => sum + (e.weight || 1), 0);
    let roll = rng() * total;
    for (const e of entries) {
        roll -= (e.weight || 1);
        if (roll <= 0) return e;
    }
    return entries[entries.length - 1];
}

function shuffle(rng, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ── Grid construction ──────────────────────────────────────────────────────────

class LevelGrid {
    constructor(width, height) {
        this.W = width;
        this.H = height;
        this.cells = new Uint8Array(width * height); // SOLID everywhere
        this.rooms = [];
    }

    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.W && y < this.H;
    }

    get(x, y) {
        return this.inBounds(x, y) ? this.cells[idx(this.W, x, y)] : SOLID;
    }

    set(x, y, kind) {
        if (this.inBounds(x, y)) this.cells[idx(this.W, x, y)] = kind;
    }

    isOpen(x, y) {
        return OPEN_KINDS.has(this.get(x, y));
    }

    carveRoom(x, y, w, h, meta = {}) {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ROOM);
        }
        const room = { x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), ...meta };
        this.rooms.push(room);
        return room;
    }

    /** Cells of an L-shaped path from a to b, inclusive of both ends. */
    static lPath(a, b, horizontalFirst) {
        const pts = [];
        let x = a.x;
        let y = a.y;
        const stepX = () => { while (x !== b.x) { pts.push({ x, y }); x += sign(b.x - x); } };
        const stepY = () => { while (y !== b.y) { pts.push({ x, y }); y += sign(b.y - y); } };
        if (horizontalFirst) { stepX(); stepY(); } else { stepY(); stepX(); }
        pts.push({ x: b.x, y: b.y });
        return pts;
    }

    /**
     * Carve a corridor along a path, leaving the origin room, and stopping at the
     * first room it reaches. The cells where it crosses a room boundary become
     * doorways.
     */
    carvePath(pts) {
        let i = 0;
        // Walk out of whatever room we started in without carving it.
        while (i < pts.length && this.get(pts[i].x, pts[i].y) === ROOM) i++;
        if (i === 0) i = 0; // started outside a room; nothing to skip
        let leftRoom = i > 0;

        for (; i < pts.length; i++) {
            const { x, y } = pts[i];
            const kind = this.get(x, y);

            if (kind === ROOM) {
                // Arrived at a room: the cell we came from becomes its doorway.
                const prev = pts[i - 1];
                if (prev && this.get(prev.x, prev.y) === CORRIDOR) this.set(prev.x, prev.y, DOOR);
                return;
            }

            if (kind === SOLID) {
                // First cell after stepping out of a room is that room's doorway.
                this.set(x, y, leftRoom ? DOOR : CORRIDOR);
                leftRoom = false;
            }
            // CORRIDOR / DOOR / STAIRS: pass straight through
        }
    }

    /** Every open cell reachable from a starting point, as a Set of indices. */
    floodFrom(sx, sy) {
        const seen = new Set();
        if (!this.isOpen(sx, sy)) return seen;
        const queue = [{ x: sx, y: sy }];
        seen.add(idx(this.W, sx, sy));
        for (let head = 0; head < queue.length; head++) {
            const { x, y } = queue[head];
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const nx = x + dx;
                const ny = y + dy;
                const key = idx(this.W, nx, ny);
                if (seen.has(key) || !this.inBounds(nx, ny) || !this.isOpen(nx, ny)) continue;
                seen.add(key);
                queue.push({ x: nx, y: ny });
            }
        }
        return seen;
    }
}

// ── Layouts ────────────────────────────────────────────────────────────────────

// Hard ceiling on any room dimension. Crawler rooms have to be small enough to
// read in one glance; anything much past this stops feeling like a room at all.
const MAX_ROOM_SPAN = 8;
const MIN_ROOM_SPAN = 3;

/** True when every cell of a rect is still untouched rock. */
function areaIsSolid(grid, x, y, w, h) {
    for (let yy = y; yy < y + h; yy++) {
        for (let xx = x; xx < x + w; xx++) {
            if (!grid.inBounds(xx, yy) || grid.get(xx, yy) !== SOLID) return false;
        }
    }
    return true;
}

/**
 * Carve a run of rooms alongside a corridor.
 * Rooms grow away from `doorAt`, so each one touches the wall its door sits in,
 * and each gets a single doorway onto the corridor. Slots already occupied (by a
 * cross-corridor, say) are skipped rather than overwritten.
 *
 * axis 'x': rooms run left to right, depth is vertical.
 * axis 'y': rooms run top to bottom, depth is horizontal.
 */
function carveRoomStrip(grid, rng, o) {
    const depthAvailable = Math.min(o.depthTo - o.depthFrom + 1, MAX_ROOM_SPAN);
    if (depthAvailable < MIN_ROOM_SPAN) return;

    const minLen = o.minLen || MIN_ROOM_SPAN;
    const maxLen = Math.min(o.maxLen || MAX_ROOM_SPAN, MAX_ROOM_SPAN);
    let along = o.alongFrom;

    while (along + minLen - 1 <= o.alongTo) {
        const room = Math.min(maxLen, o.alongTo - along + 1);
        if (room < minLen) break;
        const len = minLen + Math.floor(rng() * (room - minLen + 1));
        const depth = minLen + Math.floor(rng() * (depthAvailable - minLen + 1));

        // Hug the side the door is on so the doorway opens straight into the room.
        let depthFrom;
        if (o.doorAt < o.depthFrom) depthFrom = o.depthFrom;
        else depthFrom = o.depthTo - depth + 1;

        const rect = o.axis === 'x'
            ? { x: along, y: depthFrom, w: len, h: depth }
            : { x: depthFrom, y: along, w: depth, h: len };

        if (!areaIsSolid(grid, rect.x, rect.y, rect.w, rect.h)) {
            along += 1; // slide past whatever is in the way
            continue;
        }

        grid.carveRoom(rect.x, rect.y, rect.w, rect.h);
        const doorAlong = along + Math.floor(rng() * len);
        if (o.axis === 'x') {
            if (grid.get(doorAlong, o.doorAt) === SOLID) grid.set(doorAlong, o.doorAt, DOOR);
        } else if (grid.get(o.doorAt, doorAlong) === SOLID) {
            grid.set(o.doorAt, doorAlong, DOOR);
        }

        along += len + 1; // party wall between neighbours
    }
}

/**
 * Fill a rectangle with parallel corridors and rooms off both sides of each -
 * the ordinary floor plan of an office, ward, or block of flats.
 *
 * Corridors are carved first (including the cross-links that tie them into a
 * loop) so the room strips can slide around them.
 *
 * @returns {{lines: number[], horizontal: boolean}} the corridor positions
 */
function corridorGrid(grid, rng, rect, opts = {}) {
    const bandDepth = opts.bandDepth || 6;
    const horizontal = opts.horizontal ?? (rect.w >= rect.h);

    const alongFrom = horizontal ? rect.x : rect.y;
    const alongTo = horizontal ? rect.x + rect.w - 1 : rect.y + rect.h - 1;
    const crossFrom = horizontal ? rect.y : rect.x;
    const crossTo = horizontal ? rect.y + rect.h - 1 : rect.x + rect.w - 1;
    const span = crossTo - crossFrom + 1;
    if (span < 5 || alongTo - alongFrom < 4) return { lines: [], horizontal };

    // One corridor per ~2 room bands, so rooms stay shallow whatever the size.
    const count = clamp(Math.round(span / (bandDepth * 2 + 2)), 1, 3);
    const lines = [];
    for (let i = 0; i < count; i++) {
        lines.push(Math.round(crossFrom + ((span - 1) * (i + 1)) / (count + 1)));
    }

    const put = (along, cross) => {
        if (horizontal) grid.set(along, cross, CORRIDOR);
        else grid.set(cross, along, CORRIDOR);
    };

    for (const line of lines) {
        for (let a = alongFrom; a <= alongTo; a++) put(a, line);
    }

    // Cross-links, so parallel corridors form a loop instead of dead ends.
    if (lines.length > 1) {
        const links = 1 + (rng() < 0.6 ? 1 : 0);
        for (let k = 0; k < links; k++) {
            const a = alongFrom + 1 + Math.floor(rng() * Math.max(1, alongTo - alongFrom - 1));
            for (let c = lines[0]; c <= lines[lines.length - 1]; c++) put(a, c);
        }
    }

    // Rooms in the bands between corridors, split down the middle of each band.
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const bandStart = i === 0 ? crossFrom : Math.floor((lines[i - 1] + line) / 2) + 1;
        const bandEnd = i === lines.length - 1 ? crossTo : Math.floor((line + lines[i + 1]) / 2);
        const axis = horizontal ? 'x' : 'y';
        carveRoomStrip(grid, rng, { axis, alongFrom, alongTo, depthFrom: bandStart, depthTo: line - 2, doorAt: line - 1, maxLen: opts.maxLen });
        carveRoomStrip(grid, rng, { axis, alongFrom, alongTo, depthFrom: line + 2, depthTo: bandEnd, doorAt: line + 1, maxLen: opts.maxLen });
    }

    return { lines, horizontal };
}

/** Corridors with rooms off both sides. Offices, wards, blocks of flats. */
function layoutSpine(grid, rng) {
    const { lines, horizontal } = corridorGrid(grid, rng, { x: 1, y: 1, w: grid.W - 2, h: grid.H - 2 });

    // A corridor runs wall to wall, so both of its ends make a natural doorway.
    const entries = [];
    for (const line of lines) {
        if (horizontal) {
            entries.push({ x: 0, y: line, facing: 'east' });
            entries.push({ x: grid.W - 1, y: line, facing: 'west' });
        } else {
            entries.push({ x: line, y: 0, facing: 'south' });
            entries.push({ x: line, y: grid.H - 1, facing: 'north' });
        }
    }
    return entries;
}

/** Recursive subdivision: irregular rooms joined by L-corridors. Sublevels. */
function layoutBsp(grid, rng) {
    const MIN = 7;
    const leaves = [];

    const split = (r, depth) => {
        const canSplitH = r.h >= MIN * 2;
        const canSplitV = r.w >= MIN * 2;
        if (depth >= 6 || (!canSplitH && !canSplitV)) {
            leaves.push(r);
            return;
        }
        let horizontal;
        if (canSplitH && canSplitV) horizontal = r.h === r.w ? rng() < 0.5 : r.h > r.w;
        else horizontal = canSplitH;

        if (horizontal) {
            const cut = MIN + Math.floor(rng() * (r.h - 2 * MIN + 1));
            split({ x: r.x, y: r.y, w: r.w, h: cut }, depth + 1);
            split({ x: r.x, y: r.y + cut, w: r.w, h: r.h - cut }, depth + 1);
        } else {
            const cut = MIN + Math.floor(rng() * (r.w - 2 * MIN + 1));
            split({ x: r.x, y: r.y, w: cut, h: r.h }, depth + 1);
            split({ x: r.x + cut, y: r.y, w: r.w - cut, h: r.h }, depth + 1);
        }
    };
    split({ x: 1, y: 1, w: grid.W - 2, h: grid.H - 2 }, 0);

    for (const leaf of leaves) {
        const w = clamp(leaf.w - 2, MIN_ROOM_SPAN, MAX_ROOM_SPAN);
        const h = clamp(leaf.h - 2, MIN_ROOM_SPAN, MAX_ROOM_SPAN);
        if (leaf.w - 2 < MIN_ROOM_SPAN || leaf.h - 2 < MIN_ROOM_SPAN) continue;
        const x = leaf.x + 1 + Math.floor(rng() * (leaf.w - 2 - w + 1));
        const y = leaf.y + 1 + Math.floor(rng() * (leaf.h - 2 - h + 1));
        grid.carveRoom(x, y, w, h);
    }

    // Chain the rooms, then add a couple of loops so it is not a pure tree.
    const rooms = grid.rooms;
    for (let i = 1; i < rooms.length; i++) {
        const a = rooms[i - 1];
        const b = rooms[i];
        grid.carvePath(LevelGrid.lPath({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy }, rng() < 0.5));
    }
    for (let i = 0; i < Math.min(2, Math.max(0, rooms.length - 3)); i++) {
        const a = pick(rng, rooms);
        const b = pick(rng, rooms);
        if (a !== b) grid.carvePath(LevelGrid.lPath({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy }, rng() < 0.5));
    }

    // Entrances: punch a stub from the edge to the nearest carved cell.
    return [];
}

/** A corridor loop with shops in the outer band and a subdivided core. */
function layoutRing(grid, rng) {
    const { W, H } = grid;
    const inset = 7;
    const x0 = inset;
    const y0 = inset;
    const x1 = W - 1 - inset;
    const y1 = H - 1 - inset;

    if (x1 - x0 < 9 || y1 - y0 < 9) return layoutSpine(grid, rng);

    for (let x = x0; x <= x1; x++) { grid.set(x, y0, CORRIDOR); grid.set(x, y1, CORRIDOR); }
    for (let y = y0; y <= y1; y++) { grid.set(x0, y, CORRIDOR); grid.set(x1, y, CORRIDOR); }

    // Entry spur from the outside wall through the shop band to the ring.
    const side = pick(rng, ['south', 'north', 'east', 'west']);
    let entry;
    if (side === 'north') {
        const x = clamp(x0 + 2 + Math.floor(rng() * (x1 - x0 - 3)), x0 + 1, x1 - 1);
        for (let y = 1; y < y0; y++) grid.set(x, y, CORRIDOR);
        entry = { x, y: 0, facing: 'south' };
    } else if (side === 'south') {
        const x = clamp(x0 + 2 + Math.floor(rng() * (x1 - x0 - 3)), x0 + 1, x1 - 1);
        for (let y = y1 + 1; y <= H - 2; y++) grid.set(x, y, CORRIDOR);
        entry = { x, y: H - 1, facing: 'north' };
    } else if (side === 'west') {
        const y = clamp(y0 + 2 + Math.floor(rng() * (y1 - y0 - 3)), y0 + 1, y1 - 1);
        for (let x = 1; x < x0; x++) grid.set(x, y, CORRIDOR);
        entry = { x: 0, y, facing: 'east' };
    } else {
        const y = clamp(y0 + 2 + Math.floor(rng() * (y1 - y0 - 3)), y0 + 1, y1 - 1);
        for (let x = x1 + 1; x <= W - 2; x++) grid.set(x, y, CORRIDOR);
        entry = { x: W - 1, y, facing: 'west' };
    }

    // Shop band between the ring and the outer wall, on all four sides.
    carveRoomStrip(grid, rng, { axis: 'x', alongFrom: 1, alongTo: W - 2, depthFrom: 1, depthTo: y0 - 2, doorAt: y0 - 1 });
    carveRoomStrip(grid, rng, { axis: 'x', alongFrom: 1, alongTo: W - 2, depthFrom: y1 + 2, depthTo: H - 2, doorAt: y1 + 1 });
    carveRoomStrip(grid, rng, { axis: 'y', alongFrom: y0 + 2, alongTo: y1 - 2, depthFrom: 1, depthTo: x0 - 2, doorAt: x0 - 1 });
    carveRoomStrip(grid, rng, { axis: 'y', alongFrom: y0 + 2, alongTo: y1 - 2, depthFrom: x1 + 2, depthTo: W - 2, doorAt: x1 + 1 });

    // Core: its own little corridor grid, tied into the ring at both ends.
    const core = { x: x0 + 2, y: y0 + 2, w: x1 - x0 - 3, h: y1 - y0 - 3 };
    if (core.w >= 5 && core.h >= 5) {
        const { lines, horizontal } = corridorGrid(grid, rng, core, { bandDepth: 5 });
        for (const line of lines) {
            if (horizontal) {
                for (let x = x0; x < core.x; x++) grid.set(x, line, CORRIDOR);
                for (let x = core.x + core.w; x <= x1; x++) grid.set(x, line, CORRIDOR);
            } else {
                for (let y = y0; y < core.y; y++) grid.set(line, y, CORRIDOR);
                for (let y = core.y + core.h; y <= y1; y++) grid.set(line, y, CORRIDOR);
            }
        }
    }

    return [entry];
}

const LAYOUTS = { spine: layoutSpine, bsp: layoutBsp, ring: layoutRing };

// ── Level assembly ─────────────────────────────────────────────────────────────

/** Carve the stair core, which occupies the same footprint on every level. */
function carveStairCore(grid, core, level, hasAbove, hasBelow) {
    const { x, y, size } = core;
    grid.carveRoom(x, y, size, size, { isStairCore: true, type: null, name: 'Stairwell' });
    const cx = x + (size >> 1);
    const cy = y + (size >> 1);
    grid.set(cx, cy, STAIRS);

    // Join the core to the nearest corridor so it is never marooned.
    let best = null;
    let bestDist = Infinity;
    for (let yy = 1; yy < grid.H - 1; yy++) {
        for (let xx = 1; xx < grid.W - 1; xx++) {
            if (grid.get(xx, yy) !== CORRIDOR) continue;
            const dist = Math.abs(xx - cx) + Math.abs(yy - cy);
            if (dist < bestDist) { bestDist = dist; best = { x: xx, y: yy }; }
        }
    }
    if (best) grid.carvePath(LevelGrid.lPath({ x: cx, y: cy }, best, Math.abs(best.x - cx) > Math.abs(best.y - cy)));
    return { cx, cy, hasAbove, hasBelow };
}

/**
 * Carve the way in and out, on the ground floor only.
 * Layouts hand back perimeter spots that already back onto a corridor; if none
 * do, fall back to boring straight through from the middle of a wall.
 */
function carveEntrance(grid, rng, candidates) {
    const { W, H } = grid;
    const usable = (candidates || []).filter(c => {
        const step = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[c.facing];
        return grid.isOpen(c.x + step[0], c.y + step[1]);
    });

    if (usable.length) {
        const spot = pick(rng, usable);
        grid.set(spot.x, spot.y, EXIT);
        return spot;
    }

    const side = pick(rng, ['south', 'north', 'east', 'west']);
    let x;
    let y;
    let facing;
    if (side === 'south') { x = Math.floor(W / 2); y = H - 1; facing = 'north'; }
    else if (side === 'north') { x = Math.floor(W / 2); y = 0; facing = 'south'; }
    else if (side === 'east') { x = W - 1; y = Math.floor(H / 2); facing = 'west'; }
    else { x = 0; y = Math.floor(H / 2); facing = 'east'; }

    grid.set(x, y, EXIT);

    // Tunnel inward until we meet the layout.
    const step = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
    let cx = x + step[0];
    let cy = y + step[1];
    for (let i = 0; i < Math.max(W, H); i++) {
        if (cx < 1 || cy < 1 || cx > W - 2 || cy > H - 2) break;
        const kind = grid.get(cx, cy);
        if (kind !== SOLID) break;
        grid.set(cx, cy, CORRIDOR);
        cx += step[0];
        cy += step[1];
    }
    return { x, y, facing };
}

/** Carve corridors to anything the flood fill cannot reach. */
function ensureConnected(grid, from) {
    for (let attempt = 0; attempt < 6; attempt++) {
        const reachable = grid.floodFrom(from.x, from.y);
        if (reachable.size === 0) return;

        const stranded = grid.rooms.filter(r => !reachable.has(idx(grid.W, r.cx, r.cy)));
        if (stranded.length === 0) return;

        for (const room of stranded) {
            // Nearest reachable open cell, by Manhattan distance.
            let best = null;
            let bestDist = Infinity;
            for (const key of reachable) {
                const x = key % grid.W;
                const y = (key - x) / grid.W;
                const dist = Math.abs(x - room.cx) + Math.abs(y - room.cy);
                if (dist < bestDist) { bestDist = dist; best = { x, y }; }
            }
            if (!best) return;
            grid.carvePath(LevelGrid.lPath({ x: room.cx, y: room.cy }, best, Math.abs(best.x - room.cx) > Math.abs(best.y - room.cy)));
        }
    }
}

/** Give every room a type, a display name, and its loot keying. */
function assignRoomTypes(grid, level, rng) {
    const counts = {};
    for (const room of grid.rooms) {
        if (room.isStairCore) continue;
        const choice = weightedPick(rng, level.roomTypes);
        room.type = choice.type;
        const label = choice.label || ROOM_LABEL[choice.type] || 'Room';
        counts[label] = (counts[label] || 0) + 1;
        room.name = counts[label] > 1 ? `${label} ${counts[label]}` : label;
    }
}

// ── Painting ───────────────────────────────────────────────────────────────────

function paintLevel(canvas, profile, level, grid, stair, entrance, lights) {
    canvas.z = level.z;
    const wallTile = ZoneTiles[level.wall] || ZoneTiles.interiorWall;
    const corridorTile = ZoneTiles[level.corridor] || ZoneTiles.corridor;

    // Room lookup per cell, so floors and names come out right.
    const roomAt = new Array(grid.W * grid.H).fill(null);
    for (const room of grid.rooms) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                if (grid.inBounds(x, y)) roomAt[idx(grid.W, x, y)] = room;
            }
        }
    }

    // 1. Floors, walls, stairs, exit
    for (let y = 0; y < grid.H; y++) {
        for (let x = 0; x < grid.W; x++) {
            const kind = grid.get(x, y);

            if (kind === SOLID) {
                // Only face the walls that someone can actually see.
                let touchesOpen = false;
                for (let dy = -1; dy <= 1 && !touchesOpen; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (grid.isOpen(x + dx, y + dy)) { touchesOpen = true; break; }
                    }
                }
                if (touchesOpen) canvas.set(x, y, wallTile, { name: `${level.name} Wall` });
                continue;
            }

            if (kind === STAIRS) {
                canvas.set(x, y, stairsTile(stair.hasAbove, stair.hasBelow, 'Stairwell'));
                continue;
            }

            if (kind === EXIT) {
                canvas.set(x, y, siteExitTile(`Exit — ${profile.name}`));
                continue;
            }

            const room = roomAt[idx(grid.W, x, y)];
            if (kind === ROOM && room && !room.isStairCore) {
                const floor = ZoneTiles[ROOM_FLOOR[room.type]] || corridorTile;
                canvas.set(x, y, floor, { name: room.name, roomType: room.type });
            } else if (kind === ROOM && room?.isStairCore) {
                canvas.set(x, y, ZoneTiles.stairwellFloor, { name: 'Stairwell' });
            } else {
                // Some floor tiles carry a roomType of their own (mallFloor is
                // tagged retail); a corridor is not a room, so clear it.
                canvas.set(x, y, corridorTile, { name: level.name, roomType: null });
            }
        }
    }

    // 2. Doors (as world objects, so they open, lock, and smash)
    for (let y = 0; y < grid.H; y++) {
        for (let x = 0; x < grid.W; x++) {
            if (grid.get(x, y) !== DOOR) continue;
            const room = roomAt[idx(grid.W, x, y)];
            const locked = canvas.rng() < (level.lockChance || 0);
            canvas.placeDoor(level.doorType || 'wood_basic', x, y, {
                locked,
                open: !locked && canvas.rng() < 0.35,
                name: room?.name ? `${room.name} Door` : `${level.name} Door`,
                roomType: room?.type
            });
        }
    }

    // 3. Furniture, hugging walls and never sealing a doorway
    for (const room of grid.rooms) {
        if (room.isStairCore || !room.type) continue;
        const options = ROOM_FURNITURE[room.type];
        if (!options || !options.length) continue;

        const area = room.w * room.h;
        const budget = clamp(Math.floor(area / 6), 1, 5);
        const cells = [];
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                // Keep the tiles beside a doorway clear so the room stays enterable.
                let besideDoor = false;
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    if (grid.get(x + dx, y + dy) === DOOR) { besideDoor = true; break; }
                }
                if (besideDoor) continue;
                const againstWall = x === room.x || y === room.y || x === room.x + room.w - 1 || y === room.y + room.h - 1;
                cells.push({ x, y, againstWall });
            }
        }
        shuffle(canvas.rng, cells);
        cells.sort((a, b) => Number(b.againstWall) - Number(a.againstWall));

        for (let i = 0; i < Math.min(budget, cells.length); i++) {
            const cell = cells[i];
            canvas.placeFurniture(pick(canvas.rng, options), cell.x, cell.y, room.type);
        }
    }

    // 4. Emergency lighting. Corridors stay lit enough to navigate without a
    //    lamp; rooms are mostly dark, so a light source is still worth carrying.
    const corridorChance = level.corridorLightChance ?? 0.9;
    const roomChance = level.roomLightChance ?? 0.3;
    const spacing = level.lightSpacing || 5;
    for (let y = 1; y < grid.H - 1; y++) {
        for (let x = 1; x < grid.W - 1; x++) {
            const kind = grid.get(x, y);
            const room = roomAt[idx(grid.W, x, y)];
            const isCorridorLight = kind === CORRIDOR && (x + y) % spacing === 0;
            const isRoomLight = kind === ROOM && room && !room.isStairCore && x === room.cx && y === room.cy;
            if (!isCorridorLight && !isRoomLight) continue;
            if (canvas.rng() > (isCorridorLight ? corridorChance : roomChance)) continue;
            lights.push({
                x,
                y,
                z: level.z,
                radius: level.lightRadius || 6,
                intensity: isCorridorLight
                    ? (level.lightIntensity || 0.85)
                    : (level.lightIntensity || 0.85) * 0.7,
                color: level.lightColor || '#ffd9a0'
            });
        }
    }

    // The stairwell always has a light so you can find your way back to it.
    lights.push({ x: stair.cx, y: stair.cy, z: level.z, radius: 4, intensity: 0.8, color: level.lightColor || '#9fe8ff' });
    if (entrance) {
        lights.push({ x: entrance.x, y: entrance.y, z: level.z, radius: 4, intensity: 0.9, color: '#a8ffc0' });
    }
}

// ── Entry point ────────────────────────────────────────────────────────────────

/**
 * Build a whole site into the world behind `canvas`.
 * @param {ZoneCanvas} canvas
 * @param {object} profile - see SiteCatalog.js
 */
export function generateSite(canvas, profile) {
    const rng = canvas.rng;
    const world = canvas.world;
    const W = canvas.width;
    const H = canvas.height;

    const lights = [];
    const levels = profile.levels;
    const zList = levels.map(l => l.z);

    // The stair core runs the full height, so its footprint is chosen once.
    const coreSize = 3;
    const core = {
        size: coreSize,
        x: clamp(Math.floor(W * (0.3 + rng() * 0.4)), 3, W - coreSize - 4),
        y: clamp(Math.floor(H * (0.3 + rng() * 0.4)), 3, H - coreSize - 4)
    };

    let entrance = null;

    for (const level of levels) {
        const grid = new LevelGrid(W, H);
        const entryCandidates = (LAYOUTS[level.layout] || layoutBsp)(grid, rng) || [];

        // The core overwrites whatever the layout put there; fully covered rooms go.
        grid.rooms = grid.rooms.filter(r => !(
            r.x >= core.x && r.y >= core.y &&
            r.x + r.w <= core.x + coreSize && r.y + r.h <= core.y + coreSize
        ));
        const stair = carveStairCore(
            grid, core, level,
            zList.includes(level.z + 1),
            zList.includes(level.z - 1)
        );

        const levelEntrance = level.z === 0 ? carveEntrance(grid, rng, entryCandidates) : null;
        if (levelEntrance) entrance = levelEntrance;

        ensureConnected(grid, { x: stair.cx, y: stair.cy });
        assignRoomTypes(grid, level, rng);
        paintLevel(canvas, profile, level, grid, stair, levelEntrance, lights);
    }

    canvas.z = 0;
    world.staticLights = lights;
    world.isInterior = true;
    world.siteName = profile.name;

    if (entrance) {
        const step = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[entrance.facing];
        world.spawnPoint = { x: entrance.x + step[0], y: entrance.y + step[1] };
        world.spawnFacing = entrance.facing;
        world.siteExit = { x: entrance.x, y: entrance.y, z: 0 };
    } else {
        world.spawnPoint = { x: core.x + 1, y: core.y + 1 };
    }
}
