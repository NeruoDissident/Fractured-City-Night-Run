// Room-type loot tables for building-aware item spawning
// Each room type defines weighted item pools and spawn density
// Items reference family IDs from ContentManager.loadItemFamilies()

export const ROOM_LOOT_TABLES = {
    // === RESIDENTIAL ===
    
    residential_living: {
        name: 'Living Room',
        spawnChance: 0.6,       // chance per floor tile to attempt spawn
        maxItems: 3,            // max items per room
        pools: [
            { familyId: 'can_sealed',     weight: 15 },
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'battery',        weight: 10 },
            { familyId: 'coat',           weight: 5 },
            { familyId: 'pants',          weight: 5 },
            { familyId: 'backpack',       weight: 3 },
            { familyId: 'strap',          weight: 8 },
            { familyId: 'pipe',           weight: 4 }
        ]
    },
    
    residential_bedroom: {
        name: 'Bedroom',
        spawnChance: 0.5,
        maxItems: 2,
        pools: [
            { familyId: 'coat',           weight: 10 },
            { familyId: 'pants',          weight: 10 },
            { familyId: 'trenchcoat',     weight: 5 },
            { familyId: 'backpack',       weight: 5 },
            { familyId: 'medkit',         weight: 3 },
            { familyId: 'battery',        weight: 8 },
            { familyId: 'shiv',           weight: 4 },
            { familyId: 'knife',          weight: 2 }
        ]
    },
    
    residential_kitchen: {
        name: 'Kitchen',
        spawnChance: 0.7,
        maxItems: 4,
        pools: [
            { familyId: 'can_sealed',     weight: 25 },
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'knife',          weight: 8 },
            { familyId: 'canteen',        weight: 5 },
            { familyId: 'pipe',           weight: 3 }
        ]
    },
    
    residential_bathroom: {
        name: 'Bathroom',
        spawnChance: 0.5,
        maxItems: 2,
        pools: [
            { familyId: 'medkit',         weight: 20 },
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'strap',          weight: 5 },
            { familyId: 'pipe',           weight: 8 }
        ]
    },
    
    // === COMMERCIAL ===
    
    commercial_store: {
        name: 'Store Floor',
        spawnChance: 0.5,
        maxItems: 5,
        pools: [
            { familyId: 'can_sealed',     weight: 20 },
            { familyId: 'bottle_sealed',  weight: 20 },
            { familyId: 'battery',        weight: 10 },
            { familyId: 'medkit',         weight: 5 },
            { familyId: 'coat',           weight: 5 },
            { familyId: 'pants',          weight: 5 },
            { familyId: 'backpack',       weight: 3 },
            { familyId: 'canteen',        weight: 3 }
        ]
    },
    
    commercial_backroom: {
        name: 'Back Room',
        spawnChance: 0.7,
        maxItems: 4,
        pools: [
            { familyId: 'can_sealed',     weight: 15 },
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'pipe',           weight: 10 },
            { familyId: 'strap',          weight: 10 },
            { familyId: 'battery',        weight: 8 },
            { familyId: 'knife',          weight: 5 },
            { familyId: 'medkit',         weight: 5 }
        ]
    },
    
    // === OFFICE ===
    
    office: {
        name: 'Office',
        spawnChance: 0.4,
        maxItems: 2,
        pools: [
            { familyId: 'battery',        weight: 15 },
            { familyId: 'bottle_sealed',  weight: 10 },
            { familyId: 'strap',          weight: 8 },
            { familyId: 'shiv',           weight: 5 },
            { familyId: 'medkit',         weight: 3 },
            { familyId: 'coat',           weight: 5 },
            { familyId: 'backpack',       weight: 3 }
        ]
    },
    
    office_reception: {
        name: 'Reception',
        spawnChance: 0.5,
        maxItems: 3,
        pools: [
            { familyId: 'battery',        weight: 12 },
            { familyId: 'bottle_sealed',  weight: 12 },
            { familyId: 'can_sealed',     weight: 8 },
            { familyId: 'medkit',         weight: 5 },
            { familyId: 'coat',           weight: 5 },
            { familyId: 'pants',          weight: 5 },
            { familyId: 'backpack',       weight: 4 },
            { familyId: 'pipe',           weight: 6 }
        ]
    },
    
    // === MEDICAL ===
    
    medical_store: {
        name: 'Pharmacy Counter',
        spawnChance: 0.6,
        maxItems: 4,
        pools: [
            { familyId: 'medkit',         weight: 30 },
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'battery',        weight: 8 },
            { familyId: 'can_sealed',     weight: 5 }
        ]
    },
    
    medical_storage: {
        name: 'Medical Storage',
        spawnChance: 0.7,
        maxItems: 5,
        pools: [
            { familyId: 'medkit',         weight: 40 },
            { familyId: 'bottle_sealed',  weight: 10 },
            { familyId: 'battery',        weight: 8 },
            { familyId: 'backpack',       weight: 3 }
        ]
    },
    
    medical_waiting: {
        name: 'Waiting Room',
        spawnChance: 0.3,
        maxItems: 2,
        pools: [
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'can_sealed',     weight: 10 },
            { familyId: 'coat',           weight: 8 },
            { familyId: 'pants',          weight: 5 },
            { familyId: 'backpack',       weight: 5 },
            { familyId: 'battery',        weight: 5 }
        ]
    },
    
    medical_exam: {
        name: 'Exam Room',
        spawnChance: 0.5,
        maxItems: 3,
        pools: [
            { familyId: 'medkit',         weight: 25 },
            { familyId: 'bottle_sealed',  weight: 10 },
            { familyId: 'knife',          weight: 5 },
            { familyId: 'battery',        weight: 8 },
            { familyId: 'strap',          weight: 5 }
        ]
    },
    
    // === GARAGE / INDUSTRIAL ===
    
    garage_bay: {
        name: 'Garage Bay',
        spawnChance: 0.4,
        maxItems: 3,
        pools: [
            { familyId: 'pipe',           weight: 20 },
            { familyId: 'strap',          weight: 12 },
            { familyId: 'battery',        weight: 10 },
            { familyId: 'can_sealed',     weight: 5 },
            { familyId: 'bottle_sealed',  weight: 5 }
        ]
    },
    
    garage_tools: {
        name: 'Tool Room',
        spawnChance: 0.7,
        maxItems: 4,
        pools: [
            { familyId: 'pipe',           weight: 20 },
            { familyId: 'knife',          weight: 10 },
            { familyId: 'shiv',           weight: 8 },
            { familyId: 'strap',          weight: 15 },
            { familyId: 'battery',        weight: 12 }
        ]
    },
    
    // === WAREHOUSE ===
    
    warehouse_floor: {
        name: 'Warehouse Floor',
        spawnChance: 0.15,
        maxItems: 6,
        pools: [
            { familyId: 'can_sealed',     weight: 15 },
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'pipe',           weight: 10 },
            { familyId: 'strap',          weight: 10 },
            { familyId: 'battery',        weight: 8 },
            { familyId: 'backpack',       weight: 3 },
            { familyId: 'coat',           weight: 3 }
        ]
    },
    
    warehouse_storage: {
        name: 'Storage Bay',
        spawnChance: 0.6,
        maxItems: 5,
        pools: [
            { familyId: 'can_sealed',     weight: 20 },
            { familyId: 'bottle_sealed',  weight: 15 },
            { familyId: 'pipe',           weight: 10 },
            { familyId: 'strap',          weight: 10 },
            { familyId: 'battery',        weight: 10 },
            { familyId: 'medkit',         weight: 5 },
            { familyId: 'backpack',       weight: 5 },
            { familyId: 'canteen',        weight: 3 }
        ]
    }
};

// Roll a weighted random item from a pool
export function rollLootPool(pool) {
    const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    
    for (const entry of pool) {
        roll -= entry.weight;
        if (roll <= 0) {
            return entry.familyId;
        }
    }
    
    // Fallback to last entry
    return pool[pool.length - 1].familyId;
}

// Generate items for a specific room type
// Returns array of { familyId, x, y } objects
export function generateRoomLoot(roomType, floorTiles) {
    const table = ROOM_LOOT_TABLES[roomType];
    if (!table || !floorTiles.length) return [];
    
    const results = [];
    let itemCount = 0;
    
    // Shuffle floor tiles so items aren't always in the same spot
    const shuffled = [...floorTiles].sort(() => Math.random() - 0.5);
    
    for (const tile of shuffled) {
        if (itemCount >= table.maxItems) break;
        if (Math.random() > table.spawnChance) continue;
        
        const familyId = rollLootPool(table.pools);
        results.push({ familyId, x: tile.x, y: tile.y });
        itemCount++;
    }
    
    return results;
}

// Fallback loot for tiles without a roomType (outdoor, hallways, etc.)
export const OUTDOOR_LOOT = {
    spawnChance: 0.02,  // very low per-tile chance
    pools: [
        { familyId: 'pipe',           weight: 15 },
        { familyId: 'shiv',           weight: 10 },
        { familyId: 'strap',          weight: 10 },
        { familyId: 'battery',        weight: 8 },
        { familyId: 'can_sealed',     weight: 8 },
        { familyId: 'bottle_sealed',  weight: 8 },
        { familyId: 'medkit',         weight: 3 },
        { familyId: 'coat',           weight: 3 },
        { familyId: 'pants',          weight: 3 }
    ]
};
