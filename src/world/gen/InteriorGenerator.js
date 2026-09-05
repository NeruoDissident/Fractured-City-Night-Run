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
 *   block - a street. Wide corridor under the sky, storefront rooms off both
 *           sides, dead-end alleys with back doors, an exit at each end. The
 *           same invariants as a floor: the city is a dungeon with sky.
 *
 * A level with `sky: true` paints its corridors as exterior tiles (sky above,
 * daylight on them) while its rooms stay interior. Doors that face the sky get
 * a daylight source so shop interiors are lit by the street during the day.
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
import { FURNITURE_LOOT } from '../objects/Furniture.js';

// ── Working grid cell kinds ────────────────────────────────────────────────────
const SOLID = 0;
const ROOM = 1;
const CORRIDOR = 2;
const DOOR = 3;
const STAIRS = 4;
const EXIT = 5;
// Margin kept clear around the stair core while layouts run. Solid as far as
// room placement is concerned, but corridors may still be carved through it.
const RESERVED = 6;

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
        this.owner = new Int16Array(width * height).fill(-1); // room index per ROOM cell
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

    /** Lay corridor floor, but only into rock: rooms and the stairwell are never trampled. */
    carveHall(x, y) {
        const kind = this.get(x, y);
        if (kind === SOLID || kind === RESERVED) this.set(x, y, CORRIDOR);
    }

    carveRoom(x, y, w, h, meta = {}) {
        const id = this.rooms.length;
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
                this.set(xx, yy, ROOM);
                if (this.inBounds(xx, yy)) this.owner[idx(this.W, xx, yy)] = id;
            }
        }
        const room = { id, x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), ...meta };
        this.rooms.push(room);
        return room;
    }

    roomIdAt(x, y) {
        return this.inBounds(x, y) && this.get(x, y) === ROOM ? this.owner[idx(this.W, x, y)] : -1;
    }

    /**
     * True when a cell touches the interior of any room other than `allowId`.
     * A corridor must never run along a room like this: a room with no wall on
     * one side stops being a room. Doorways are the only sanctioned contact.
     */
    isBesideRoom(x, y, allowId = -1) {
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const id = this.roomIdAt(x + dx, y + dy);
            if (id !== -1 && id !== allowId) return true;
        }
        return false;
    }

    /** Cells in the one-cell ring just outside a room. */
    ringOf(room) {
        const cells = [];
        for (let x = room.x; x < room.x + room.w; x++) {
            cells.push({ x, y: room.y - 1 }, { x, y: room.y + room.h });
        }
        for (let y = room.y; y < room.y + room.h; y++) {
            cells.push({ x: room.x - 1, y }, { x: room.x + room.w, y });
        }
        return cells.filter(c => c.x >= 1 && c.y >= 1 && c.x <= this.W - 2 && c.y <= this.H - 2);
    }

    /**
     * Breadth-first corridor route. Never passes beside a room, so it cannot
     * leave a room open on one side; it may reuse existing corridors and doors.
     * @param {Array<{x,y}>} starts  cells to begin from (always allowed)
     * @param {(x,y)=>boolean} isGoal
     * Start cells are always admitted (they sit in the origin room's wall ring);
     * every later cell must be clear of all rooms, the origin included, or the
     * route would run along the origin's own wall.
     * @returns {Array<{x,y}>|null}
     */
    bfsCorridor(starts, isGoal) {
        const prev = new Map();
        const queue = [];
        for (const c of starts) {
            const k = idx(this.W, c.x, c.y);
            if (prev.has(k)) continue;
            prev.set(k, -1);
            queue.push(c);
        }
        const allowed = (x, y) => {
            if (x < 1 || y < 1 || x > this.W - 2 || y > this.H - 2) return false;
            const kind = this.get(x, y);
            if (kind === CORRIDOR || kind === DOOR) return true;
            if (kind === SOLID || kind === RESERVED) return !this.isBesideRoom(x, y);
            return false;
        };
        for (let head = 0; head < queue.length; head++) {
            const c = queue[head];
            if (isGoal(c.x, c.y)) {
                const path = [];
                let k = idx(this.W, c.x, c.y);
                while (k !== -1) {
                    const x = k % this.W;
                    path.push({ x, y: (k - x) / this.W });
                    k = prev.get(k);
                }
                return path.reverse();
            }
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const nx = c.x + dx;
                const ny = c.y + dy;
                const k = idx(this.W, nx, ny);
                if (prev.has(k)) continue;
                if (!isGoal(nx, ny) && !allowed(nx, ny)) continue;
                prev.set(k, idx(this.W, c.x, c.y));
                queue.push({ x: nx, y: ny });
            }
        }
        return null;
    }

    /** Carve a BFS route: solid cells become corridor, the two ends become doorways. */
    carveRoute(path) {
        if (!path || !path.length) return;
        for (const { x, y } of path) {
            const kind = this.get(x, y);
            if (kind === SOLID || kind === RESERVED) this.set(x, y, CORRIDOR);
        }
        const ends = path.length === 1 ? [path[0]] : [path[0], path[path.length - 1]];
        for (const { x, y } of ends) {
            if (this.get(x, y) === CORRIDOR && this.isBesideRoom(x, y)) this.set(x, y, DOOR);
        }
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

        // Check the rect plus a one-cell ring, so every room keeps a wall on all
        // sides. Without this a room can sit flush against a cross-corridor and
        // read as open on that side.
        if (!areaIsSolid(grid, rect.x - 1, rect.y - 1, rect.w + 2, rect.h + 2)) {
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
        if (horizontal) grid.carveHall(along, cross);
        else grid.carveHall(cross, along);
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

    // Rooms in the bands between corridors. A band deep enough for two facing
    // strips gets both with a shared party wall; a thin band goes wholly to one
    // side (alternating), rather than being left as dead rock.
    const axis = horizontal ? 'x' : 'y';
    const strip = (depthFrom, depthTo, doorAt) =>
        carveRoomStrip(grid, rng, { axis, alongFrom, alongTo, depthFrom, depthTo, doorAt, maxLen: opts.maxLen });

    // Outer bands: everything from the edge to the first/last corridor.
    strip(crossFrom, lines[0] - 2, lines[0] - 1);
    strip(lines[lines.length - 1] + 2, crossTo, lines[lines.length - 1] + 1);

    for (let i = 0; i + 1 < lines.length; i++) {
        const a = lines[i];
        const b = lines[i + 1];
        const from = a + 2;
        const to = b - 2;
        const size = to - from + 1;
        if (size < MIN_ROOM_SPAN) continue;
        if (size >= MIN_ROOM_SPAN * 2 + 1) {
            const lower = Math.floor((size - 1) / 2);      // rows for the strip below a
            strip(from, from + lower - 1, a + 1);            // wall row sits at from + lower
            strip(from + lower + 1, to, b - 1);
        } else if (i % 2 === 0) {
            strip(from, to, a + 1);
        } else {
            strip(from, to, b - 1);
        }
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
    const MIN = 8; // leaf must hold a 3-wide room plus two cells of padding each side
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

    // Two cells of padding per leaf: neighbouring rooms then sit four apart,
    // which is what a wall + hall + wall needs. One cell leaves a gap a corridor
    // can only fill by running along a room, which is exactly what we forbid.
    const PAD = 2;
    for (const leaf of leaves) {
        const w = clamp(leaf.w - PAD * 2, MIN_ROOM_SPAN, MAX_ROOM_SPAN);
        const h = clamp(leaf.h - PAD * 2, MIN_ROOM_SPAN, MAX_ROOM_SPAN);
        if (leaf.w - PAD * 2 < MIN_ROOM_SPAN || leaf.h - PAD * 2 < MIN_ROOM_SPAN) continue;
        const x = leaf.x + PAD + Math.floor(rng() * (leaf.w - PAD * 2 - w + 1));
        const y = leaf.y + PAD + Math.floor(rng() * (leaf.h - PAD * 2 - h + 1));
        if (!areaIsSolid(grid, x - 1, y - 1, w + 2, h + 2)) continue; // keeps clear of the stair core
        grid.carveRoom(x, y, w, h);
    }

    // Chain the rooms, then add a couple of loops so it is not a pure tree.
    const rooms = grid.rooms.filter(r => !r.isStairCore);
    for (let i = 1; i < rooms.length; i++) connectRooms(grid, rooms[i - 1], rooms[i]);
    for (let i = 0; i < Math.min(2, Math.max(0, rooms.length - 3)); i++) {
        const a = pick(rng, rooms);
        const b = pick(rng, rooms);
        if (a !== b) connectRooms(grid, a, b);
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

    for (let x = x0; x <= x1; x++) { grid.carveHall(x, y0); grid.carveHall(x, y1); }
    for (let y = y0; y <= y1; y++) { grid.carveHall(x0, y); grid.carveHall(x1, y); }

    // Entry spur from the outside wall through the shop band to the ring.
    const side = pick(rng, ['south', 'north', 'east', 'west']);
    let entry;
    if (side === 'north') {
        const x = clamp(x0 + 2 + Math.floor(rng() * (x1 - x0 - 3)), x0 + 1, x1 - 1);
        for (let y = 1; y < y0; y++) grid.carveHall(x, y);
        entry = { x, y: 0, facing: 'south' };
    } else if (side === 'south') {
        const x = clamp(x0 + 2 + Math.floor(rng() * (x1 - x0 - 3)), x0 + 1, x1 - 1);
        for (let y = y1 + 1; y <= H - 2; y++) grid.carveHall(x, y);
        entry = { x, y: H - 1, facing: 'north' };
    } else if (side === 'west') {
        const y = clamp(y0 + 2 + Math.floor(rng() * (y1 - y0 - 3)), y0 + 1, y1 - 1);
        for (let x = 1; x < x0; x++) grid.carveHall(x, y);
        entry = { x: 0, y, facing: 'east' };
    } else {
        const y = clamp(y0 + 2 + Math.floor(rng() * (y1 - y0 - 3)), y0 + 1, y1 - 1);
        for (let x = x1 + 1; x <= W - 2; x++) grid.carveHall(x, y);
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
                for (let x = x0; x < core.x; x++) grid.carveHall(x, line);
                for (let x = core.x + core.w; x <= x1; x++) grid.carveHall(x, line);
            } else {
                for (let y = y0; y < core.y; y++) grid.carveHall(line, y);
                for (let y = core.y + core.h; y <= y1; y++) grid.carveHall(line, y);
            }
        }
    }

    return [entry];
}

/**
 * A street block. One wide street wall to wall (exits at both ends), an
 * optional cross street, one-wide dead-end alleys, and storefront rooms off
 * every hall. Level options: streetWidth (3), cross ('T' | 'full' | false),
 * alleys (2), minFront / maxFront (room length along the street).
 */
function layoutBlock(grid, rng, level = {}) {
    const { W, H } = grid;
    const sw = clamp(level.streetWidth || 3, 1, 5);
    const exits = [];
    grid.alleyCells = new Set();
    grid.lamps = [];

    // Main street: a horizontal band through the middle, wall to wall.
    const minY = 1 + MIN_ROOM_SPAN + 1;
    const maxY = H - 2 - sw - MIN_ROOM_SPAN - 1;
    const y0 = clamp(Math.floor((H - sw) / 2 + (rng() - 0.5) * H * 0.2), minY, Math.max(minY, maxY));
    for (let x = 1; x <= W - 2; x++) for (let k = 0; k < sw; k++) grid.carveHall(x, y0 + k);
    const midY = y0 + (sw >> 1);
    exits.push({ x: 0, y: midY, facing: 'east', side: 'west' });
    exits.push({ x: W - 1, y: midY, facing: 'west', side: 'east' });
    for (let x = 3; x <= W - 4; x += level.lightSpacing || 7) grid.lamps.push({ x, y: midY });

    // Cross street: a vertical band making a T or a crossroads.
    let cx0 = -1;
    if (level.cross && W >= 28) {
        cx0 = clamp(Math.floor(W * (0.35 + rng() * 0.3)), 1 + MIN_ROOM_SPAN + 1, W - 2 - sw - MIN_ROOM_SPAN - 1);
        const dir = level.cross === 'full' ? 'both' : pick(rng, ['north', 'south', 'both']);
        const yFrom = dir === 'south' ? y0 : 1;
        const yTo = dir === 'north' ? y0 + sw - 1 : H - 2;
        for (let y = yFrom; y <= yTo; y++) for (let k = 0; k < sw; k++) grid.carveHall(cx0 + k, y);
        const midX = cx0 + (sw >> 1);
        if (yFrom === 1) exits.push({ x: midX, y: 0, facing: 'south', side: 'north' });
        if (yTo === H - 2) exits.push({ x: midX, y: H - 1, facing: 'north', side: 'south' });
        for (let y = 3; y <= H - 4; y += level.lightSpacing || 7) {
            if (y >= yFrom && y <= yTo && Math.abs(y - midY) > 2) grid.lamps.push({ x: midX, y });
        }
    }

    // Alleys: one wide, off the street, dead ends. Back doors open onto them.
    const alleys = [];
    const alleyCount = level.alleys ?? 2;
    for (let i = 0; i < alleyCount * 4 && alleys.length < alleyCount; i++) {
        const x = 3 + Math.floor(rng() * (W - 6));
        if (cx0 !== -1 && Math.abs(x - cx0) < sw + 4) continue;
        if (alleys.some(a => Math.abs(a.x - x) < 8)) continue;
        const north = rng() < 0.5;
        const room = north ? y0 - 2 : H - 2 - (y0 + sw);
        if (room < 5) continue;
        const len = 4 + Math.floor(rng() * Math.max(1, Math.min(9, room - 2) - 3));
        const cells = [];
        for (let k = 1; k <= len; k++) {
            const y = north ? y0 - k : y0 + sw - 1 + k;
            if (y < 1 || y > H - 2) break;
            grid.carveHall(x, y);
            grid.alleyCells.add(idx(W, x, y));
            cells.push({ x, y });
        }
        if (cells.length) alleys.push({ x, north, from: cells[0].y, to: cells[cells.length - 1].y });
    }

    // Storefronts: rooms off both sides of the main street, doors onto it.
    const front = { minLen: level.minFront || 4, maxLen: level.maxFront || MAX_ROOM_SPAN };
    carveRoomStrip(grid, rng, { axis: 'x', alongFrom: 1, alongTo: W - 2,
        depthFrom: Math.max(1, y0 - 1 - MAX_ROOM_SPAN), depthTo: y0 - 2, doorAt: y0 - 1, ...front });
    carveRoomStrip(grid, rng, { axis: 'x', alongFrom: 1, alongTo: W - 2,
        depthFrom: y0 + sw + 1, depthTo: Math.min(H - 2, y0 + sw + MAX_ROOM_SPAN), doorAt: y0 + sw, ...front });

    // Fronts along the cross street, both sides, above and below the main street.
    if (cx0 !== -1) {
        const spans = [[1, y0 - 2], [y0 + sw + 1, H - 2]];
        for (const [from, to] of spans) {
            if (to - from + 1 < MIN_ROOM_SPAN) continue;
            carveRoomStrip(grid, rng, { axis: 'y', alongFrom: from, alongTo: to,
                depthFrom: Math.max(1, cx0 - 1 - MAX_ROOM_SPAN), depthTo: cx0 - 2, doorAt: cx0 - 1, minLen: 3, maxLen: 6 });
            carveRoomStrip(grid, rng, { axis: 'y', alongFrom: from, alongTo: to,
                depthFrom: cx0 + sw + 1, depthTo: Math.min(W - 2, cx0 + sw + MAX_ROOM_SPAN), doorAt: cx0 + sw, minLen: 3, maxLen: 6 });
        }
    }

    // Back rooms off the alleys.
    for (const a of alleys) {
        const from = Math.min(a.from, a.to);
        const to = Math.max(a.from, a.to);
        carveRoomStrip(grid, rng, { axis: 'y', alongFrom: from, alongTo: to,
            depthFrom: Math.max(1, a.x - 1 - 5), depthTo: a.x - 2, doorAt: a.x - 1, minLen: 3, maxLen: 5 });
        carveRoomStrip(grid, rng, { axis: 'y', alongFrom: from, alongTo: to,
            depthFrom: a.x + 2, depthTo: Math.min(W - 2, a.x + 1 + 5), doorAt: a.x + 1, minLen: 3, maxLen: 5 });
    }

    return exits;
}

const LAYOUTS = { spine: layoutSpine, bsp: layoutBsp, ring: layoutRing, block: layoutBlock };

// ── Level assembly ─────────────────────────────────────────────────────────────

/**
 * Join two rooms with a corridor that never grazes a third room. Falls back to
 * a blunt L-shaped cut only if no such route exists.
 */
function connectRooms(grid, a, b) {
    const starts = grid.ringOf(a).filter(c => {
        const k = grid.get(c.x, c.y);
        return (k === SOLID || k === DOOR) && !grid.isBesideRoom(c.x, c.y, a.id);
    });
    const goal = (x, y) => {
        const k = grid.get(x, y);
        if (k !== SOLID && k !== DOOR) return false;
        let touchesB = false;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const id = grid.roomIdAt(x + dx, y + dy);
            if (id === b.id) touchesB = true;
            else if (id !== -1 && id !== a.id) return false;
        }
        return touchesB;
    };
    const path = grid.bfsCorridor(starts, goal);
    // A route shorter than door-hall-door would be a doorway with rooms on both
    // sides and no hall; leave those pairs for the hall network to pick up.
    if (path && path.length >= 3) grid.carveRoute(path);
}

/**
 * Claim the stair core's footprint before the layout runs: the core itself plus
 * a one-cell margin. Rooms treat the margin as off-limits; corridors may cross it.
 */
function reserveStairCore(grid, core) {
    const { x, y, size } = core;
    for (let yy = y - 1; yy <= y + size; yy++) {
        for (let xx = x - 1; xx <= x + size; xx++) {
            if (grid.get(xx, yy) === SOLID) grid.set(xx, yy, RESERVED);
        }
    }
    grid.carveRoom(x, y, size, size, { isStairCore: true, type: null, name: 'Stairwell' });
    const cx = x + (size >> 1);
    const cy = y + (size >> 1);
    grid.set(cx, cy, STAIRS);
    return { cx, cy };
}

/** After the layout: turn the margin back to rock and make sure the core has a way out. */
function finalizeStairCore(grid, core, stair, hasAbove, hasBelow) {
    for (let i = 0; i < grid.cells.length; i++) {
        if (grid.cells[i] === RESERVED) grid.cells[i] = SOLID;
    }
    const room = grid.rooms.find(r => r.isStairCore);
    const ring = grid.ringOf(room);
    const alreadyOpen = ring.some(c => grid.get(c.x, c.y) === CORRIDOR || grid.get(c.x, c.y) === DOOR);
    if (!alreadyOpen) {
        const starts = ring.filter(c => grid.get(c.x, c.y) === SOLID && !grid.isBesideRoom(c.x, c.y, room.id));
        const path = grid.bfsCorridor(starts, (x, y) => grid.get(x, y) === CORRIDOR);
        if (path) grid.carveRoute(path);
        else {
            // Last resort: cut straight to the nearest corridor.
            let best = null;
            let bestDist = Infinity;
            for (let yy = 1; yy < grid.H - 1; yy++) {
                for (let xx = 1; xx < grid.W - 1; xx++) {
                    if (grid.get(xx, yy) !== CORRIDOR) continue;
                    const dist = Math.abs(xx - stair.cx) + Math.abs(yy - stair.cy);
                    if (dist < bestDist) { bestDist = dist; best = { x: xx, y: yy }; }
                }
            }
            if (best) grid.carvePath(LevelGrid.lPath({ x: stair.cx, y: stair.cy }, best, true));
        }
    }
    return { cx: stair.cx, cy: stair.cy, hasAbove, hasBelow };
}

/** Kept for reference; superseded by reserveStairCore + finalizeStairCore. */
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

    // Route inward to the nearest corridor without running along a room.
    const step = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing];
    const first = { x: x + step[0], y: y + step[1] };
    const isHall = (cx, cy) => { const k = grid.get(cx, cy); return k === CORRIDOR || k === DOOR; };
    let path = grid.bfsCorridor([first], isHall);
    if (!path) {
        // No corridor reachable cleanly; settle for a doorway into a room.
        path = grid.bfsCorridor([first], (cx, cy) => grid.get(cx, cy) === SOLID && grid.isBesideRoom(cx, cy));
    }
    if (path) {
        for (const c of path) if (grid.get(c.x, c.y) === SOLID || grid.get(c.x, c.y) === RESERVED) grid.set(c.x, c.y, CORRIDOR);
        const last = path[path.length - 1];
        if (grid.get(last.x, last.y) === CORRIDOR && grid.isBesideRoom(last.x, last.y)) grid.set(last.x, last.y, DOOR);
    } else {
        // Tunnel straight in as a last resort.
        let cx = first.x;
        let cy = first.y;
        for (let i = 0; i < Math.max(W, H); i++) {
            if (cx < 1 || cy < 1 || cx > W - 2 || cy > H - 2) break;
            if (grid.get(cx, cy) !== SOLID) break;
            grid.set(cx, cy, CORRIDOR);
            cx += step[0];
            cy += step[1];
        }
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
            // Route from the room's own wall ring to any reachable hall cell, or to
            // a wall cell of a reachable room (which becomes a connecting door).
            const starts = grid.ringOf(room).filter(c => {
                const k = grid.get(c.x, c.y);
                return (k === SOLID || k === DOOR) && !grid.isBesideRoom(c.x, c.y, room.id);
            });
            // Only a reachable hall counts as a goal. A door straight into another
            // room would leave a doorway with no hall on either side, which the
            // hall-connectivity pass then has to cut into with a blunt corridor.
            const goal = (x, y) => {
                const k = grid.get(x, y);
                return (k === CORRIDOR || k === DOOR || k === STAIRS) && reachable.has(idx(grid.W, x, y));
            };
            const path = grid.bfsCorridor(starts, goal);
            if (path) {
                grid.carveRoute(path);
                continue;
            }
            // Blunt fallback so a floor can never be left with an unreachable room.
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

/**
 * The halls must form one connected network on their own. Room-to-room links
 * (the BSP chain especially) can leave the only route between two wings running
 * through a room's interior, and a chair in that room then cuts the floor in
 * half. Rooms hang off halls; they are never the way through.
 */
function ensureHallsConnected(grid, from) {
    const core = grid.rooms.find(r => r.isStairCore);
    const isHall = k => k === CORRIDOR || k === DOOR || k === EXIT || k === STAIRS;
    const passable = (x, y) => {
        const k = grid.get(x, y);
        if (isHall(k)) return true;
        return k === ROOM && core && grid.roomIdAt(x, y) === core.id;
    };
    const flood = (sx, sy, stop = null) => {
        const seen = new Set();
        if (!passable(sx, sy)) return seen;
        const queue = [{ x: sx, y: sy }];
        seen.add(idx(grid.W, sx, sy));
        for (let head = 0; head < queue.length; head++) {
            const { x, y } = queue[head];
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const nx = x + dx;
                const ny = y + dy;
                const k = idx(grid.W, nx, ny);
                if (seen.has(k) || !grid.inBounds(nx, ny) || !passable(nx, ny)) continue;
                if (stop && stop.has(k)) continue;
                seen.add(k);
                queue.push({ x: nx, y: ny });
            }
        }
        return seen;
    };

    for (let attempt = 0; attempt < 12; attempt++) {
        const reach = flood(from.x, from.y);
        let stranded = null;
        for (let y = 1; y < grid.H - 1 && !stranded; y++) {
            for (let x = 1; x < grid.W - 1; x++) {
                if (isHall(grid.get(x, y)) && !reach.has(idx(grid.W, x, y))) { stranded = { x, y }; break; }
            }
        }
        if (!stranded) return;

        const component = flood(stranded.x, stranded.y, reach);
        const starts = [];
        for (const k of component) {
            const x = k % grid.W;
            starts.push({ x, y: (k - x) / grid.W });
        }
        const path = grid.bfsCorridor(starts, (x, y) => reach.has(idx(grid.W, x, y)));
        if (path) {
            grid.carveRoute(path);
            continue;
        }
        // Blunt fallback: straight cut from the pocket to the nearest reached hall.
        let best = null;
        let bestDist = Infinity;
        for (const k of reach) {
            const x = k % grid.W;
            const y = (k - x) / grid.W;
            const d = Math.abs(x - stranded.x) + Math.abs(y - stranded.y);
            if (d < bestDist) { bestDist = d; best = { x, y }; }
        }
        if (!best) return;
        grid.carvePath(LevelGrid.lPath(stranded, best, Math.abs(best.x - stranded.x) > Math.abs(best.y - stranded.y)));
    }
}

/**
 * Safety net after routing: if a room edge still touches a hall (or another
 * room) with nothing between, pull that edge in by one cell so it becomes wall.
 * Doorways on the pulled edge would lead into the new wall, so they revert to
 * hall and ensureConnected gives the room a proper door again.
 * Rooms already at the minimum size are left alone and show up in the audit.
 */
function sealRoomEdges(grid) {
    let changed = false;
    for (const room of grid.rooms) {
        if (room.isStairCore) continue;
        const touches = (x, y) => {
            const k = grid.get(x, y);
            if (k === CORRIDOR || k === STAIRS || k === EXIT) return true;
            return k === ROOM && grid.roomIdAt(x, y) !== room.id;
        };
        const edges = [
            { side: 'top', ring: () => Array.from({ length: room.w }, (_, i) => ({ x: room.x + i, y: room.y - 1 })), shrink: () => { room.y += 1; room.h -= 1; }, dim: 'h', cells: () => Array.from({ length: room.w }, (_, i) => ({ x: room.x + i, y: room.y })) },
            { side: 'bottom', ring: () => Array.from({ length: room.w }, (_, i) => ({ x: room.x + i, y: room.y + room.h })), shrink: () => { room.h -= 1; }, dim: 'h', cells: () => Array.from({ length: room.w }, (_, i) => ({ x: room.x + i, y: room.y + room.h - 1 })) },
            { side: 'left', ring: () => Array.from({ length: room.h }, (_, i) => ({ x: room.x - 1, y: room.y + i })), shrink: () => { room.x += 1; room.w -= 1; }, dim: 'w', cells: () => Array.from({ length: room.h }, (_, i) => ({ x: room.x, y: room.y + i })) },
            { side: 'right', ring: () => Array.from({ length: room.h }, (_, i) => ({ x: room.x + room.w, y: room.y + i })), shrink: () => { room.w -= 1; }, dim: 'w', cells: () => Array.from({ length: room.h }, (_, i) => ({ x: room.x + room.w - 1, y: room.y + i })) }
        ];
        for (const edge of edges) {
            const ring = edge.ring();
            if (!ring.some(c => touches(c.x, c.y))) continue;
            if (room[edge.dim] - 1 < MIN_ROOM_SPAN) continue;
            for (const c of edge.cells()) {
                grid.set(c.x, c.y, SOLID);
                if (grid.inBounds(c.x, c.y)) grid.owner[idx(grid.W, c.x, c.y)] = -1;
            }
            for (const c of ring) if (grid.get(c.x, c.y) === DOOR) grid.set(c.x, c.y, CORRIDOR);
            edge.shrink();
            room.cx = room.x + (room.w >> 1);
            room.cy = room.y + (room.h >> 1);
            changed = true;
        }
    }
    return changed;
}

/** Give every room a type, a display name, and its loot keying. */
function assignRoomTypes(grid, level, rng) {
    const counts = {};
    for (const room of grid.rooms) {
        if (room.isStairCore) continue;
        const choice = weightedPick(rng, level.roomTypes);
        room.type = choice.type;
        room.preset = choice; // may carry floor / furniture / doorType / lightColor
        const label = choice.label || ROOM_LABEL[choice.type] || 'Room';
        counts[label] = (counts[label] || 0) + 1;
        room.name = counts[label] > 1 ? `${label} ${counts[label]}` : label;
    }
}

/**
 * Count room cells that touch a hall or another room with nothing between them.
 * Zero is the invariant every generated floor must satisfy; anything else means a
 * room is open on one side. Exposed on world.siteAudit for tests.
 */
export function countRoomLeaks(grid) {
    let leaks = 0;
    for (let y = 1; y < grid.H - 1; y++) {
        for (let x = 1; x < grid.W - 1; x++) {
            const id = grid.roomIdAt(x, y);
            if (id === -1 || grid.rooms[id]?.isStairCore) continue;
            for (const [dx, dy] of [[1, 0], [0, 1]]) {
                const k = grid.get(x + dx, y + dy);
                if (k === CORRIDOR || k === STAIRS || k === EXIT) leaks++;
                else if (k === ROOM) {
                    const other = grid.roomIdAt(x + dx, y + dy);
                    if (other !== id) leaks++;
                }
            }
        }
    }
    return leaks;
}

// ── Painting ───────────────────────────────────────────────────────────────────

function paintLevel(canvas, profile, level, grid, stair, entrance, lights) {
    canvas.z = level.z;
    const wallTile = ZoneTiles[level.wall] || ZoneTiles.interiorWall;
    const corridorTile = ZoneTiles[level.corridor] || ZoneTiles.corridor;
    const alleyTile = ZoneTiles[level.alley] || corridorTile;
    const sky = !!level.sky;

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

            if (kind === STAIRS && stair) {
                canvas.set(x, y, stairsTile(stair.hasAbove, stair.hasBelow, 'Stairwell'));
                continue;
            }

            if (kind === EXIT) {
                canvas.set(x, y, siteExitTile(`Exit — ${profile.name}`, { isExterior: sky }));
                continue;
            }

            const room = roomAt[idx(grid.W, x, y)];
            if (kind === ROOM && room && !room.isStairCore) {
                const floorKey = room.preset?.floor || ROOM_FLOOR[room.type];
                const floor = ZoneTiles[floorKey] || ZoneTiles.corridor;
                canvas.set(x, y, floor, { name: room.name, roomType: room.type, isExterior: false });
            } else if (kind === ROOM && room?.isStairCore) {
                canvas.set(x, y, ZoneTiles.stairwellFloor, { name: 'Stairwell' });
            } else if (grid.alleyCells && grid.alleyCells.has(idx(grid.W, x, y))) {
                canvas.set(x, y, alleyTile, { name: `${level.name} Alley`, roomType: null });
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
            // A doorway sits in a room's wall ring, so find the room it serves.
            let room = roomAt[idx(grid.W, x, y)];
            if (!room) {
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    const r = roomAt[idx(grid.W, x + dx, y + dy)];
                    if (r && !r.isStairCore) { room = r; break; }
                }
            }
            const locked = canvas.rng() < (level.lockChance || 0);
            canvas.placeDoor(room?.preset?.doorType || level.doorType || 'wood_basic', x, y, {
                locked,
                open: !locked && canvas.rng() < 0.35,
                name: room?.name ? `${room.name} Door` : `${level.name} Door`,
                roomType: room?.type
            });
            // Daylight leaks in through any door that faces the sky.
            if (sky) {
                let facesSky = false;
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    const k = grid.get(x + dx, y + dy);
                    if (k === CORRIDOR || k === EXIT) { facesSky = true; break; }
                }
                if (facesSky) lights.push({ x, y, z: level.z, radius: 5, intensity: 0.9, daylight: true });
            }
        }
    }

    // 3. Furniture, hugging walls and never sealing a doorway
    for (const room of grid.rooms) {
        if (room.isStairCore || !room.type) continue;
        const options = room.preset?.furniture || ROOM_FURNITURE[room.type];
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

        // Every piece is assumed to block. A piece is only placed if the room's
        // remaining free cells stay one connected region that includes every
        // cell just inside a doorway, so no door can be cut off from another.
        const inRoom = (x, y) => x >= room.x && x < room.x + room.w && y >= room.y && y < room.y + room.h;
        const blocked = new Set();
        const entries = [];
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    if (grid.get(x + dx, y + dy) === DOOR) { entries.push({ x, y }); break; }
                }
            }
        }
        const staysConnected = () => {
            const free = [];
            for (let y = room.y; y < room.y + room.h; y++) {
                for (let x = room.x; x < room.x + room.w; x++) {
                    if (!blocked.has(idx(grid.W, x, y))) free.push({ x, y });
                }
            }
            if (!free.length) return false;
            const origin = entries.find(e => !blocked.has(idx(grid.W, e.x, e.y))) || free[0];
            const seen = new Set([idx(grid.W, origin.x, origin.y)]);
            const queue = [origin];
            for (let head = 0; head < queue.length; head++) {
                const { x, y } = queue[head];
                for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                    const nx = x + dx;
                    const ny = y + dy;
                    const k = idx(grid.W, nx, ny);
                    if (seen.has(k) || !inRoom(nx, ny) || blocked.has(k)) continue;
                    seen.add(k);
                    queue.push({ x: nx, y: ny });
                }
            }
            if (seen.size !== free.length) return false;
            return entries.every(e => blocked.has(idx(grid.W, e.x, e.y)) || seen.has(idx(grid.W, e.x, e.y)));
        };

        let placed = 0;
        for (const cell of cells) {
            if (placed >= budget) break;
            const key = idx(grid.W, cell.x, cell.y);
            blocked.add(key);
            if (!staysConnected()) { blocked.delete(key); continue; }
            canvas.placeFurniture(pick(canvas.rng, options), cell.x, cell.y, room.type);
            placed++;
        }
    }

    // 3b. Floor loot. A few items on the floor so a room reads from the
    //     doorway and the floor is not just a set of cupboards to open.
    const lootChance = level.floorLootChance ?? 0.4;
    const content = canvas.world.game?.content;
    if (content) {
        for (const room of grid.rooms) {
            if (room.isStairCore || !room.type) continue;
            const table = FURNITURE_LOOT[room.type];
            if (!table) continue;
            if (canvas.rng() > lootChance) continue;
            const pool = [];
            for (const furn of Object.values(table)) {
                for (const entry of furn.pools || []) if (entry.familyId) pool.push(entry);
            }
            if (!pool.length) continue;
            const count = 1 + (canvas.rng() < 0.35 ? 1 : 0);
            for (let n = 0; n < count; n++) {
                // Free floor cell, not beside a door, not under furniture.
                let spot = null;
                for (let attempt = 0; attempt < 12 && !spot; attempt++) {
                    const x = room.x + Math.floor(canvas.rng() * room.w);
                    const y = room.y + Math.floor(canvas.rng() * room.h);
                    const t = canvas.get(x, y);
                    if (!t || t.blocked || t.worldObjectId) continue;
                    let besideDoor = false;
                    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                        if (grid.get(x + dx, y + dy) === DOOR) { besideDoor = true; break; }
                    }
                    if (besideDoor) continue;
                    spot = { x, y };
                }
                if (!spot) break;
                const item = content.createItem(weightedPick(canvas.rng, pool).familyId);
                if (item) canvas.placeItem(item, spot.x, spot.y);
            }
        }
    }

    // 4. Emergency lighting. Corridors stay lit enough to navigate without a
    //    lamp; rooms are mostly dark, so a light source is still worth carrying.
    //    On a sky level the corridor lights are streetlamps along the kerb.
    const corridorChance = level.corridorLightChance ?? 0.9;
    const roomChance = level.roomLightChance ?? 0.3;
    const spacing = level.lightSpacing || 5;
    const lampSet = grid.lamps ? new Set(grid.lamps.map(l => idx(grid.W, l.x, l.y))) : null;
    for (let y = 1; y < grid.H - 1; y++) {
        for (let x = 1; x < grid.W - 1; x++) {
            const kind = grid.get(x, y);
            const room = roomAt[idx(grid.W, x, y)];
            const isCorridorLight = kind === CORRIDOR && (lampSet ? lampSet.has(idx(grid.W, x, y)) : (x + y) % spacing === 0);
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
                color: (isRoomLight && room.preset?.lightColor) || level.lightColor || '#ffd9a0'
            });
        }
    }

    // The stairwell always has a light so you can find your way back to it.
    if (stair) {
        lights.push({ x: stair.cx, y: stair.cy, z: level.z, radius: 4, intensity: 0.8, color: level.lightColor || '#9fe8ff' });
    }
    // Every exit is marked, and on the ground floor daylight comes in through it.
    for (const e of (grid.exits || (entrance ? [entrance] : []))) {
        lights.push({ x: e.x, y: e.y, z: level.z, radius: 4, intensity: 0.9, color: '#a8ffc0' });
        if (level.z === 0 && !sky) lights.push({ x: e.x, y: e.y, z: level.z, radius: 5, intensity: 0.8, daylight: true });
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
    // A single-level site (a street block, a slice) has no stairwell.
    const hasCore = levels.length > 1 && profile.stairs !== false;
    const coreSize = 3;
    const core = {
        size: coreSize,
        x: clamp(Math.floor(W * (0.3 + rng() * 0.4)), 3, W - coreSize - 4),
        y: clamp(Math.floor(H * (0.3 + rng() * 0.4)), 3, H - coreSize - 4)
    };

    let entrance = null;
    const allExits = [];

    const audit = [];
    const debugGrids = [];

    for (const level of levels) {
        const grid = new LevelGrid(W, H);

        // Claim the stairwell first so the layout builds around it instead of
        // being cut open by it afterwards.
        const stairPos = hasCore ? reserveStairCore(grid, core) : null;
        const entryCandidates = (LAYOUTS[level.layout] || layoutBsp)(grid, rng, level) || [];
        const stair = hasCore
            ? finalizeStairCore(grid, core, stairPos, zList.includes(level.z + 1), zList.includes(level.z - 1))
            : null;

        // Exits. A site has one; a block or slice keeps every street end.
        let levelExits = [];
        if (level.z === 0) {
            if (level.exits === 'all' && entryCandidates.length) {
                for (const c of entryCandidates) {
                    const step = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[c.facing];
                    if (!grid.isOpen(c.x + step[0], c.y + step[1])) continue;
                    grid.set(c.x, c.y, EXIT);
                    levelExits.push(c);
                }
            }
            if (!levelExits.length) levelExits = [carveEntrance(grid, rng, entryCandidates)];
            entrance = levelExits[0];
            allExits.push(...levelExits.map(e => ({ ...e, z: level.z })));
        }
        grid.exits = levelExits;

        // Connectivity origin: the stairwell, or failing that the first hall cell.
        let origin = stair ? { x: stair.cx, y: stair.cy } : null;
        if (!origin) {
            outer: for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
                if (grid.get(x, y) === CORRIDOR) { origin = { x, y }; break outer; }
            }
        }
        if (origin) {
            ensureConnected(grid, origin);
            ensureHallsConnected(grid, origin);
            // Routing can still be forced into a blunt cut on a cramped floor; wall
            // those edges back off and reconnect, twice at most.
            for (let pass = 0; pass < 2 && sealRoomEdges(grid); pass++) {
                ensureConnected(grid, origin);
                ensureHallsConnected(grid, origin);
            }
        }
        assignRoomTypes(grid, level, rng);
        audit.push({ z: level.z, leaks: countRoomLeaks(grid), rooms: grid.rooms.length - (hasCore ? 1 : 0) });
        paintLevel(canvas, profile, level, grid, stair, entrance, lights);
        debugGrids.push({ z: level.z, W, H, cells: Array.from(grid.cells) });
    }
    world.siteAudit = audit;
    world.siteDebugGrids = debugGrids; // cell kinds per level, for tests only

    canvas.z = 0;
    world.staticLights = lights;
    world.isInterior = true;
    world.isBlock = !!profile.block;
    world.siteName = profile.name;
    world.siteExits = allExits;

    if (entrance) {
        const step = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[entrance.facing];
        world.spawnPoint = { x: entrance.x + step[0], y: entrance.y + step[1] };
        world.spawnFacing = entrance.facing;
        world.siteExit = { x: entrance.x, y: entrance.y, z: 0 };
    } else {
        world.spawnPoint = { x: core.x + 1, y: core.y + 1 };
    }
}
