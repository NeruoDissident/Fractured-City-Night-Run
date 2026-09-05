/**
 * DistrictCatalog - the travel graph for a run
 *
 * A district is the set of places you can reach from the hub and the routes
 * between them. It replaces the tile overworld as the travel surface (see
 * REDESIGN_BRIEF.md, Phase 1). The tile grid still exists as a debug/region
 * map, but the player moves along these edges.
 *
 * Node shape:
 *   id        graph id, also the zone-cache key
 *   name      display name
 *   zone      zone template id (ZONE_POOLS / SiteCatalog / HUB_ZONE)
 *   kind      'hub' | 'site' | 'block'
 *   threat    1-5, shown on the travel screen
 *   pos       [x, y] in 0..1 canvas units for the travel screen
 *   blurb     one line for the travel panel
 *
 * Route shape (undirected):
 *   a, b      node ids
 *   name      what the walk is called
 *   turns     travel time in turns (1 turn = 1 minute)
 *   danger    0..1 base chance that the trip goes loud (night multiplies it)
 *   desc      one line
 *   lock      optional { flag, reason }: passable once game.flags[flag] is set
 *
 * Route model decision (REDESIGN_BRIEF.md section 6): mixed, leaning
 * abstract. In Phase 1 every route is abstract: time, drain, and a danger
 * roll. Phase 2 adds slices for loud rolls and promotes a few routes near the
 * hub to walkable blocks. Nothing here needs to change for that; a route gains
 * a `slice` or `walkable` field.
 *
 * EXPANSION POINTS:
 * - Per-entrance routes (front door vs service door vs fire escape)
 * - Faction state modifying danger or locks
 * - Multiple districts joined by the region map
 */

export const DISTRICT = {
    id: 'downstairs_blocks',
    name: 'The Downstairs Blocks',
    nodes: {
        hub: {
            name: 'Downstairs', zone: 'safe_hub', kind: 'hub', threat: 1, pos: [0.50, 0.52],
            blurb: 'Home. Fenced yard, crew bunks, the stash.'
        },
        corner_block: {
            name: 'Corner Store Block', zone: 'urban_corner_store', kind: 'block', threat: 1, pos: [0.20, 0.52],
            blurb: 'Grocer, gas kiosk, laundry, pawn shop. Picked over but not empty.'
        },
        market: {
            name: 'Market Corner', zone: 'urban_market_corner', kind: 'block', threat: 2, pos: [0.50, 0.24],
            blurb: 'Street market and a clinic front. Busy by day, not by night.'
        },
        neon_row: {
            name: 'Neon Row', zone: 'neon_row', kind: 'block', threat: 2, pos: [0.80, 0.52],
            blurb: 'Food stall, parts cage, a bar that still has power.'
        },
        clinic: {
            name: 'Aurora Clinic', zone: 'aurora_clinic', kind: 'site', threat: 2, pos: [0.22, 0.18],
            blurb: 'Two floors and a basement. Meds if the cabinets are still stocked.'
        },
        marrow: {
            name: 'Marrow Row Walk-Up', zone: 'marrow_row', kind: 'site', threat: 2, pos: [0.72, 0.14],
            blurb: 'Flats over flats. Somebody still lives in some of them.'
        },
        kiroshi: {
            name: 'Kiroshi Data Hub', zone: 'kiroshi_hub', kind: 'site', threat: 3, pos: [0.96, 0.30],
            blurb: 'Corporate atrium, offices, a server sublevel. Locked doors.'
        },
        dead_mall: {
            name: 'Dead Mall', zone: 'shopping_strip', kind: 'site', threat: 3, pos: [0.04, 0.70],
            blurb: 'Two concourses and a service level. Held by someone.'
        },
        town_hall: {
            name: 'Old Town Hall', zone: 'old_town_hall', kind: 'site', threat: 2, pos: [0.50, 0.82],
            blurb: 'Public hall, records floor, basement. Paper everywhere.'
        },
        henderson: {
            name: 'Henderson Plant', zone: 'henderson_plant', kind: 'site', threat: 3, pos: [0.88, 0.82],
            blurb: 'Machine hall over two maintenance levels. Parts, if you can carry them.'
        },
        metro: {
            name: 'Metro Depths', zone: 'metro_depths', kind: 'site', threat: 4, pos: [0.30, 0.96],
            blurb: 'The line under the district. Flooded at the landing.'
        },
        marina: {
            name: 'Marina Ruins', zone: 'marina_ruins', kind: 'site', threat: 3, pos: [0.02, 0.96],
            blurb: 'Broken docks, half a boat. The way out, one day.'
        }
    },
    routes: [
        { a: 'hub', b: 'corner_block', name: 'Fence Line', turns: 20, danger: 0.05,
          desc: 'Along the yard fence to the corner. You can see the gate the whole way.' },
        { a: 'hub', b: 'market', name: 'Market Walk', turns: 30, danger: 0.10,
          desc: 'Two blocks north past shuttered fronts to the market.' },
        { a: 'hub', b: 'neon_row', name: 'Under the Signs', turns: 30, danger: 0.15,
          desc: 'East under the dead neon. Lit in patches.' },
        { a: 'hub', b: 'town_hall', name: 'Civic Steps', turns: 40, danger: 0.20,
          desc: 'South across the plaza. Wide open.' },
        { a: 'corner_block', b: 'market', name: 'Bodega Alley', turns: 25, danger: 0.12,
          desc: 'Behind the grocer, through the bins, out at the market.' },
        { a: 'corner_block', b: 'dead_mall', name: 'Parking Structure', turns: 45, danger: 0.35,
          desc: 'Up through the ramps. Echoes carry.' },
        { a: 'market', b: 'clinic', name: 'Clinic Steps', turns: 25, danger: 0.12,
          desc: 'Past the street clinic to the real one.' },
        { a: 'market', b: 'marrow', name: 'Laundry Cut', turns: 30, danger: 0.15,
          desc: 'Between the laundromat and the flats.' },
        { a: 'neon_row', b: 'marrow', name: 'Back Stairs', turns: 25, danger: 0.15,
          desc: 'Fire stairs behind the bar.' },
        { a: 'neon_row', b: 'kiroshi', name: 'Corporate Frontage', turns: 40, danger: 0.25,
          desc: 'Glass and cameras. Some of them still work.' },
        { a: 'neon_row', b: 'henderson', name: 'Rail Spur', turns: 60, danger: 0.30,
          desc: 'Follow the dead rails out to the plant.' },
        { a: 'town_hall', b: 'henderson', name: 'Service Road', turns: 50, danger: 0.25,
          desc: 'Behind the hall, along the culvert.' },
        { a: 'town_hall', b: 'metro', name: 'Metro Stairwell', turns: 20, danger: 0.30,
          desc: 'Down from the plaza.',
          lock: { flag: 'pumps_fixed', reason: 'Flooded to the landing. Someone has to get the pumps running.' } },
        { a: 'dead_mall', b: 'marina', name: 'Coast Road', turns: 60, danger: 0.30,
          desc: 'West past the mall to the water.',
          lock: { flag: 'coast_road_open', reason: 'Barricaded by whoever holds the mall.' } }
    ]
};

export const HUB_NODE_ID = 'hub';

export function getNode(id, district = DISTRICT) {
    return district.nodes[id] ? { id, ...district.nodes[id] } : null;
}

/** Routes touching a node, each with the far end resolved. Catalog order. */
export function routesFrom(nodeId, district = DISTRICT) {
    const out = [];
    for (const r of district.routes) {
        if (r.a !== nodeId && r.b !== nodeId) continue;
        const destId = r.a === nodeId ? r.b : r.a;
        out.push({ route: r, dest: getNode(destId, district) });
    }
    return out;
}

/** Plain-language read of an effective danger chance. */
export function dangerLabel(p) {
    if (p < 0.08) return { text: 'Quiet', color: '#44cc66' };
    if (p < 0.18) return { text: 'Uneasy', color: '#cccc44' };
    if (p < 0.32) return { text: 'Risky', color: '#ff9933' };
    return { text: 'Bad idea', color: '#ff4444' };
}

/** Night makes every route worse; dusk and dawn a little. */
export function dangerMultiplier(timeSystem) {
    if (!timeSystem) return 1;
    if (timeSystem.isNight()) return 1.6;
    if (timeSystem.isDark()) return 1.25;
    return 1;
}
