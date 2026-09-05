/**
 * StorefrontCatalog - room presets for street blocks
 *
 * A storefront is a room off a street with its own interior: a bodega has
 * shelves and a counter, a pawn shop has cages and a bench, a clinic front has
 * an exam bed. These presets plug into the interior generator's room-type
 * entries: `type` keys FURNITURE_LOOT (so room-aware loot keeps working),
 * `label` names the room, `floor` picks the tile, `furniture` is the wall
 * furniture pool, `doorType` and `lightColor` dress the front.
 *
 * Replaces the hand-placed buildings that used to live in UrbanFragments.js.
 *
 * EXPANSION POINTS:
 * - Signs and awnings as billboard props on the street cell outside the door
 * - Occupants per storefront once the roster exists (a clerk, a sleeper)
 * - Back rooms behind shopfronts joined by an interior door
 */

export const STOREFRONTS = {
    bodega: {
        type: 'commercial_store', label: 'Bodega', floor: 'storeFloor', doorType: 'glass',
        furniture: ['shelf', 'shelf', 'shelf', 'counter', 'cabinet'], lightColor: '#ffe2a8'
    },
    grocer: {
        type: 'commercial_store', label: 'Corner Grocer', floor: 'storeFloor', doorType: 'glass',
        furniture: ['shelf', 'shelf', 'counter', 'crate', 'cabinet'], lightColor: '#ffe2a8'
    },
    pawn: {
        type: 'garage_tools', label: 'Pawn and Repair', floor: 'garageFloor', doorType: 'metal',
        furniture: ['shelf', 'locker', 'counter', 'workbench', 'shelf'], lightColor: '#d8d0b0'
    },
    laundromat: {
        type: 'commercial_store', label: 'Coin Laundry', floor: 'tileFloor', doorType: 'glass',
        furniture: ['cabinet', 'cabinet', 'cabinet', 'table', 'chair'], lightColor: '#cfe8ff'
    },
    gas_kiosk: {
        type: 'garage_bay', label: 'Gas Kiosk', floor: 'storeFloor', doorType: 'glass',
        furniture: ['counter', 'terminal', 'shelf', 'crate'], lightColor: '#ffd070'
    },
    street_clinic: {
        type: 'medical_store', label: 'Street Clinic', floor: 'tileFloor', doorType: 'wood_basic',
        furniture: ['cabinet', 'bed', 'sink', 'chair', 'counter'], lightColor: '#e8f4ff'
    },
    bar: {
        type: 'residential_kitchen', label: 'Glow Bar', floor: 'neonFloor', doorType: 'glass',
        furniture: ['counter', 'table', 'chair', 'chair', 'stove'], lightColor: '#ff66cc'
    },
    noodle_stall: {
        type: 'residential_kitchen', label: 'Noodle Stall', floor: 'storeFloor', doorType: 'wood_basic',
        furniture: ['counter', 'stove', 'table', 'chair', 'shelf'], lightColor: '#ffb070'
    },
    parts_cage: {
        type: 'garage_tools', label: 'Parts Cage', floor: 'garageFloor', doorType: 'metal',
        furniture: ['locker', 'shelf', 'workbench', 'crate', 'shelf'], lightColor: '#a8ffd0'
    },
    stockroom: {
        type: 'commercial_backroom', label: 'Stockroom', floor: 'stockFloor', doorType: 'metal',
        furniture: ['crate', 'shelf', 'crate', 'locker'], lightColor: '#d8d0b0'
    },
    flat: {
        type: 'residential_living', label: 'Ground Flat', floor: 'carpet', doorType: 'wood_basic',
        furniture: ['couch', 'table', 'shelf', 'chair', 'cabinet'], lightColor: '#ffcb8a'
    },
    squat: {
        type: 'residential_bedroom', label: 'Squat', floor: 'breakFloor', doorType: 'wood_basic',
        furniture: ['bed', 'crate', 'chair', 'locker'], lightColor: '#c0a880'
    },
    office_front: {
        type: 'office', label: 'Shuttered Office', floor: 'carpet', doorType: 'security',
        furniture: ['table', 'chair', 'filing_cabinet', 'terminal'], lightColor: '#cfe0ff'
    },
    utility: {
        type: 'garage_bay', label: 'Utility Room', floor: 'garageFloor', doorType: 'metal',
        furniture: ['locker', 'crate', 'workbench'], lightColor: '#8fd0ff'
    }
};

/** Turn a list of { id, weight } into generator room-type entries. */
export function storefrontRooms(entries) {
    return entries.map(e => {
        const p = STOREFRONTS[e.id];
        if (!p) throw new Error(`Unknown storefront preset: ${e.id}`);
        return { weight: e.weight || 1, ...p, presetId: e.id };
    });
}

// Ready-made mixes for the block profiles.
export const CORNER_BLOCK_FRONTS = storefrontRooms([
    { id: 'grocer', weight: 20 }, { id: 'gas_kiosk', weight: 12 }, { id: 'laundromat', weight: 14 },
    { id: 'pawn', weight: 14 }, { id: 'stockroom', weight: 14 }, { id: 'flat', weight: 12 },
    { id: 'squat', weight: 8 }, { id: 'utility', weight: 6 }
]);

export const MARKET_FRONTS = storefrontRooms([
    { id: 'bodega', weight: 22 }, { id: 'street_clinic', weight: 14 }, { id: 'noodle_stall', weight: 14 },
    { id: 'laundromat', weight: 10 }, { id: 'pawn', weight: 10 }, { id: 'stockroom', weight: 14 },
    { id: 'flat', weight: 10 }, { id: 'office_front', weight: 6 }
]);

export const NEON_FRONTS = storefrontRooms([
    { id: 'bar', weight: 18 }, { id: 'noodle_stall', weight: 18 }, { id: 'parts_cage', weight: 16 },
    { id: 'bodega', weight: 12 }, { id: 'squat', weight: 12 }, { id: 'stockroom', weight: 12 },
    { id: 'office_front', weight: 6 }, { id: 'utility', weight: 6 }
]);

// Slices are one screen of street: mostly closed fronts, the odd open one.
export const SLICE_FRONTS = storefrontRooms([
    { id: 'stockroom', weight: 24 }, { id: 'squat', weight: 20 }, { id: 'utility', weight: 18 },
    { id: 'bodega', weight: 12 }, { id: 'flat', weight: 12 }, { id: 'pawn', weight: 8 }, { id: 'office_front', weight: 6 }
]);
