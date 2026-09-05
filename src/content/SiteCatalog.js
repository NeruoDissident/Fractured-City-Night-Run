/**
 * SiteCatalog - interior "site" profiles for the first-person crawler
 *
 * A profile is keyed by the overworld zone id it replaces. When a zone id has a
 * profile, ZoneGenerator builds an interior with InteriorGenerator instead of a
 * street map, and the player drops in at the site's entrance.
 *
 * Profile shape:
 *   name        display name, used for the exit tile and the location panel
 *   width/height   footprint of every level, in tiles. Keep these small enough
 *                  that a floor can be learned: 36-52 reads well in first person.
 *   levels      ordered list of floors. z 0 is the ground floor and is the only
 *               one that gets an entrance; the stair core links the rest.
 *
 * Level shape:
 *   z             floor index (negative is below ground)
 *   name          shown on corridor tiles and wall names
 *   layout        'spine' | 'bsp' | 'ring'  (see InteriorGenerator)
 *   wall          key into ZoneTiles for this floor's walls
 *   corridor      key into ZoneTiles for corridor floor
 *   doorType      key into Door.js types
 *   lockChance    0-1, chance a given door starts locked (locks are smash-only)
 *   roomTypes     weighted list of { type, weight, label? }. `type` must be a
 *                 FURNITURE_LOOT key so room-aware loot and furniture work.
 *   light*        emergency lighting. corridorLightChance keeps corridors
 *                 navigable without a lamp; roomLightChance stays low so a
 *                 carried light still earns its weight indoors.
 *
 * EXPANSION POINTS:
 * - Set pieces per site (a vault, a server cage, a flooded level)
 * - Per-level encounter budgets once the NPC roster exists
 * - Sites that share an entrance with a street zone rather than replacing it
 */

import { CORNER_BLOCK_FRONTS, MARKET_FRONTS, NEON_FRONTS, SLICE_FRONTS } from './StorefrontCatalog.js';

const OFFICE_ROOMS = [
    { type: 'office', weight: 55 },
    { type: 'office_reception', weight: 10 },
    { type: 'commercial_backroom', weight: 15, label: 'Store Room' },
    { type: 'residential_bathroom', weight: 10, label: 'Washroom' },
    { type: 'residential_kitchen', weight: 10, label: 'Break Room' }
];

const APARTMENT_ROOMS = [
    { type: 'residential_living', weight: 26 },
    { type: 'residential_bedroom', weight: 30 },
    { type: 'residential_kitchen', weight: 22 },
    { type: 'residential_bathroom', weight: 22 }
];

const CLINIC_ROOMS = [
    { type: 'medical_exam', weight: 40 },
    { type: 'medical_storage', weight: 20 },
    { type: 'medical_store', weight: 15 },
    { type: 'medical_waiting', weight: 10 },
    { type: 'office', weight: 15 }
];

const RETAIL_ROOMS = [
    { type: 'commercial_store', weight: 55 },
    { type: 'commercial_backroom', weight: 25 },
    { type: 'residential_bathroom', weight: 10, label: 'Washroom' },
    { type: 'office', weight: 10 }
];

const SERVICE_ROOMS = [
    { type: 'garage_bay', weight: 35 },
    { type: 'commercial_backroom', weight: 35, label: 'Storage' },
    { type: 'office', weight: 15, label: 'Foreman Office' },
    { type: 'medical_storage', weight: 15, label: 'Supply Cage' }
];

// Shorthand for the two sublevel flavours most sites share.
const utilitySublevel = (z, name) => ({
    z,
    name,
    layout: 'bsp',
    wall: 'concreteWall',
    corridor: 'serviceCorridor',
    doorType: 'metal',
    lockChance: 0.2,
    roomTypes: SERVICE_ROOMS,
    lightColor: '#8fd0ff',
    lightRadius: 5,
    lightIntensity: 0.6,
    corridorLightChance: 0.55,   // failing strip lights: long dark stretches
    roomLightChance: 0.15,
    lightSpacing: 6
});

export const SITE_PROFILES = {
    kiroshi_hub: {
        name: 'Kiroshi Data Hub',
        width: 44,
        height: 38,
        levels: [
            {
                z: 0,
                name: 'Atrium',
                layout: 'ring',
                wall: 'concreteWall',
                corridor: 'lobbyFloor',
                doorType: 'glass',
                lockChance: 0.1,
                roomTypes: [
                    { type: 'office_reception', weight: 30 },
                    { type: 'office', weight: 40 },
                    { type: 'commercial_store', weight: 15, label: 'Concession' },
                    { type: 'residential_bathroom', weight: 15, label: 'Washroom' }
                ],
                lightColor: '#bfe4ff',
                lightRadius: 7,
                lightIntensity: 0.9,
                corridorLightChance: 0.95,
                roomLightChance: 0.45,
                lightSpacing: 5
            },
            {
                z: 1,
                name: 'Office Floor',
                layout: 'spine',
                wall: 'partitionWall',
                corridor: 'carpet',
                doorType: 'security',
                lockChance: 0.3,
                roomTypes: OFFICE_ROOMS,
                lightColor: '#cfe0ff',
                lightRadius: 6,
                lightIntensity: 0.8,
                corridorLightChance: 0.85,
                roomLightChance: 0.35,
                lightSpacing: 5
            },
            {
                ...utilitySublevel(-1, 'Server Sublevel'),
                doorType: 'security',
                lockChance: 0.35,
                lightColor: '#7fffd0',
                roomTypes: [
                    { type: 'office', weight: 30, label: 'Server Room' },
                    { type: 'commercial_backroom', weight: 40, label: 'Cable Vault' },
                    { type: 'garage_bay', weight: 30, label: 'Plant Room' }
                ]
            }
        ]
    },

    aurora_clinic: {
        name: 'Aurora Clinic',
        width: 42,
        height: 34,
        levels: [
            {
                z: 0,
                name: 'Clinic Floor',
                layout: 'spine',
                wall: 'interiorWall',
                corridor: 'tileFloor',
                doorType: 'wood_basic',
                lockChance: 0.12,
                roomTypes: CLINIC_ROOMS,
                lightColor: '#e8f4ff',
                lightRadius: 7,
                lightIntensity: 0.95,
                corridorLightChance: 0.95,
                roomLightChance: 0.5,
                lightSpacing: 5
            },
            {
                z: 1,
                name: 'Ward',
                layout: 'spine',
                wall: 'interiorWall',
                corridor: 'tileFloor',
                doorType: 'wood_basic',
                lockChance: 0.18,
                roomTypes: CLINIC_ROOMS,
                lightColor: '#dfeeff',
                lightRadius: 6,
                lightIntensity: 0.8,
                corridorLightChance: 0.8,
                roomLightChance: 0.3,
                lightSpacing: 5
            },
            utilitySublevel(-1, 'Clinic Basement')
        ]
    },

    old_town_hall: {
        name: 'Old Town Hall',
        width: 44,
        height: 36,
        levels: [
            {
                z: 0,
                name: 'Public Hall',
                layout: 'ring',
                wall: 'concreteWall',
                corridor: 'lobbyFloor',
                doorType: 'wood_reinforced',
                lockChance: 0.15,
                roomTypes: OFFICE_ROOMS,
                lightColor: '#ffd9a0',
                lightRadius: 7,
                lightIntensity: 0.85,
                corridorLightChance: 0.9,
                roomLightChance: 0.4,
                lightSpacing: 5
            },
            {
                z: 1,
                name: 'Records Floor',
                layout: 'spine',
                wall: 'partitionWall',
                corridor: 'carpet',
                doorType: 'wood_basic',
                lockChance: 0.25,
                roomTypes: OFFICE_ROOMS,
                lightColor: '#ffcf90',
                lightRadius: 6,
                lightIntensity: 0.75,
                corridorLightChance: 0.75,
                roomLightChance: 0.3,
                lightSpacing: 5
            },
            utilitySublevel(-1, 'Hall Basement')
        ]
    },

    shopping_strip: {
        name: 'Dead Mall',
        width: 52,
        height: 44,
        levels: [
            {
                z: 0,
                name: 'Mall Concourse',
                layout: 'ring',
                wall: 'partitionWall',
                corridor: 'mallFloor',
                doorType: 'glass',
                lockChance: 0.2,
                roomTypes: RETAIL_ROOMS,
                lightColor: '#ffc9e0',
                lightRadius: 7,
                lightIntensity: 0.85,
                corridorLightChance: 0.85,
                roomLightChance: 0.4,
                lightSpacing: 5
            },
            {
                z: 1,
                name: 'Upper Concourse',
                layout: 'ring',
                wall: 'partitionWall',
                corridor: 'mallFloor',
                doorType: 'glass',
                lockChance: 0.25,
                roomTypes: RETAIL_ROOMS,
                lightColor: '#ffb8d4',
                lightRadius: 6,
                lightIntensity: 0.7,
                corridorLightChance: 0.65,
                roomLightChance: 0.25,
                lightSpacing: 6
            },
            utilitySublevel(-1, 'Service Level')
        ]
    },

    henderson_plant: {
        name: 'Henderson Plant',
        width: 46,
        height: 40,
        levels: [
            {
                z: 0,
                name: 'Plant Floor',
                layout: 'bsp',
                wall: 'metalWall',
                corridor: 'grating',
                doorType: 'metal',
                lockChance: 0.22,
                roomTypes: SERVICE_ROOMS,
                lightColor: '#ffcf7a',
                lightRadius: 6,
                lightIntensity: 0.8,
                corridorLightChance: 0.8,
                roomLightChance: 0.3,
                lightSpacing: 5
            },
            utilitySublevel(-1, 'Pump Level'),
            utilitySublevel(-2, 'Deep Maintenance')
        ]
    },

    marrow_row: {
        name: 'Marrow Row Walk-Up',
        width: 40,
        height: 34,
        levels: [
            {
                z: 0,
                name: 'Ground Flats',
                layout: 'spine',
                wall: 'interiorWall',
                corridor: 'corridor',
                doorType: 'wood_basic',
                lockChance: 0.3,
                roomTypes: APARTMENT_ROOMS,
                lightColor: '#ffcb8a',
                lightRadius: 6,
                lightIntensity: 0.8,
                corridorLightChance: 0.85,
                roomLightChance: 0.3,
                lightSpacing: 5
            },
            {
                z: 1,
                name: 'Upper Flats',
                layout: 'spine',
                wall: 'interiorWall',
                corridor: 'corridor',
                doorType: 'wood_basic',
                lockChance: 0.35,
                roomTypes: APARTMENT_ROOMS,
                lightColor: '#ffbe74',
                lightRadius: 6,
                lightIntensity: 0.7,
                corridorLightChance: 0.7,
                roomLightChance: 0.25,
                lightSpacing: 5
            },
            utilitySublevel(-1, 'Boiler Room')
        ]
    }
};

// ── Street blocks ─────────────────────────────────────────────────────────────
// A block is a single sky level: a street wall to wall with exits at both
// ends, storefront rooms off it, dead-end alleys with back doors. Same
// generator, same invariants; `sky` paints the halls as exterior.

const blockLevel = (name, opts) => ({
    z: 0,
    name,
    layout: 'block',
    sky: true,
    exits: 'all',
    streetWidth: 3,
    cross: 'T',
    alleys: 2,
    lockChance: 0.15,
    lightRadius: 6,
    lightIntensity: 0.7,
    corridorLightChance: 0.65,
    roomLightChance: 0.35,
    lightSpacing: 7,
    floorLootChance: 0.5,
    ...opts
});

Object.assign(SITE_PROFILES, {
    urban_corner_store: {
        name: 'Corner Store Block',
        block: true,
        width: 48,
        height: 30,
        levels: [blockLevel('Corner Street', {
            wall: 'brickFacade', corridor: 'street', alley: 'alleyFloor', doorType: 'glass',
            roomTypes: CORNER_BLOCK_FRONTS, lightColor: '#ffb060'
        })]
    },
    urban_market_corner: {
        name: 'Market Corner',
        block: true,
        width: 48,
        height: 30,
        levels: [blockLevel('Market Street', {
            wall: 'concreteFacade', corridor: 'marketPaving', alley: 'alleyFloor', doorType: 'glass',
            cross: 'full', streetWidth: 4, alleys: 1,
            roomTypes: MARKET_FRONTS, lightColor: '#ffd9a0', corridorLightChance: 0.75
        })]
    },
    neon_row: {
        name: 'Neon Row',
        block: true,
        width: 44,
        height: 26,
        levels: [blockLevel('Neon Row', {
            wall: 'neonFacade', corridor: 'neonStreet', alley: 'alleyFloor', doorType: 'glass',
            cross: false, alleys: 2,
            roomTypes: NEON_FRONTS, lightColor: '#ff66cc', corridorLightChance: 0.85, roomLightChance: 0.5
        })]
    },

    metro_depths: {
        name: 'Metro Depths',
        width: 44,
        height: 36,
        levels: [
            {
                z: 0,
                name: 'Station Concourse',
                layout: 'ring',
                wall: 'concreteWall',
                corridor: 'tileFloor',
                doorType: 'metal',
                lockChance: 0.25,
                roomTypes: [
                    { type: 'commercial_store', weight: 30, label: 'Kiosk' },
                    { type: 'office', weight: 25, label: 'Ticket Office' },
                    { type: 'commercial_backroom', weight: 25, label: 'Store Room' },
                    { type: 'residential_bathroom', weight: 20, label: 'Public Washroom' }
                ],
                lightColor: '#9fe8ff',
                lightRadius: 6,
                lightIntensity: 0.6,
                corridorLightChance: 0.45,
                roomLightChance: 0.15,
                lightSpacing: 6
            },
            {
                ...utilitySublevel(-1, 'Platform Level'),
                lightColor: '#7fd0ff',
                corridorLightChance: 0.35,
                roomTypes: [
                    { type: 'garage_bay', weight: 35, label: 'Pump Room' },
                    { type: 'commercial_backroom', weight: 35, label: 'Maintenance Store' },
                    { type: 'office', weight: 30, label: 'Signal Box' }
                ]
            }
        ]
    }
});

// ── Route slices ─────────────────────────────────────────────────────────────
// One screen of street between two places. Exits at both ends lead to the
// route's two endpoints (Game tags them). Walkable routes always use theirs;
// abstract routes only when a trip goes loud.
export const SLICE_PROFILES = {
    slice_street: {
        name: 'Street',
        block: true,
        slice: true,
        width: 30,
        height: 16,
        levels: [blockLevel('Street', {
            wall: 'brickFacade', corridor: 'street', alley: 'alleyFloor', doorType: 'metal',
            cross: false, alleys: 1, minFront: 3, maxFront: 6,
            roomTypes: SLICE_FRONTS, lightColor: '#ffb060', corridorLightChance: 0.5, roomLightChance: 0.2, floorLootChance: 0.3
        })]
    },
    slice_alley: {
        name: 'Alley',
        block: true,
        slice: true,
        width: 30,
        height: 14,
        levels: [blockLevel('Alley', {
            wall: 'concreteFacade', corridor: 'alleyFloor', alley: 'alleyFloor', doorType: 'metal',
            streetWidth: 2, cross: false, alleys: 1, minFront: 3, maxFront: 5, lockChance: 0.4,
            roomTypes: SLICE_FRONTS, lightColor: '#ffcf8a', corridorLightChance: 0.3, roomLightChance: 0.15, floorLootChance: 0.3
        })]
    },
    slice_underpass: {
        name: 'Underpass',
        block: true,
        slice: true,
        width: 30,
        height: 14,
        levels: [blockLevel('Underpass', {
            sky: false, wall: 'concreteWall', corridor: 'underpass', alley: 'serviceCorridor', doorType: 'metal',
            streetWidth: 3, cross: false, alleys: 1, minFront: 3, maxFront: 5, lockChance: 0.35,
            roomTypes: SLICE_FRONTS, lightColor: '#8fd0ff', lightRadius: 5, lightIntensity: 0.6,
            corridorLightChance: 0.5, roomLightChance: 0.1, lightSpacing: 6, floorLootChance: 0.25
        })]
    },
    slice_lot: {
        name: 'Open Lot',
        block: true,
        slice: true,
        width: 32,
        height: 18,
        levels: [blockLevel('Lot', {
            wall: 'concreteFacade', corridor: 'street', alley: 'alleyFloor', doorType: 'metal',
            streetWidth: 5, cross: false, alleys: 0, minFront: 3, maxFront: 6,
            roomTypes: SLICE_FRONTS, lightColor: '#ffb060', corridorLightChance: 0.4, roomLightChance: 0.2, floorLootChance: 0.3
        })]
    }
};

/** Profile for a slice kind ('street' | 'alley' | 'underpass' | 'lot'). */
export function getSliceProfile(kind) {
    return SLICE_PROFILES[`slice_${kind}`] || SLICE_PROFILES.slice_alley;
}

// Zone ids that reuse another site's profile.
const ALIASES = {
    collapsed_mall: 'shopping_strip',
    the_yards: 'henderson_plant',
    tank_farm: 'henderson_plant',
    safehouse_block: 'marrow_row',
    the_terraces: 'marrow_row'
};

/** Profile for an overworld zone id, or null if that zone is not a site. */
export function getSiteProfile(zoneId) {
    if (!zoneId) return null;
    const key = ALIASES[zoneId] || zoneId;
    return SITE_PROFILES[key] || SLICE_PROFILES[key] || null;
}
