// Building Prefab Definitions
// Legend:
// # = exterior wall
// | = interior wall (vertical)
// - = interior wall (horizontal)
// . = floor
// + = exterior door (WorldObject via createDoor)
// d = interior door (WorldObject via createDoor, always unlocked)
// _ = open floor next to door (for double-wide entrances)
// < = stairs up
// > = stairs down
// ~ = no tile (skip, leave terrain as-is)

// Door type to use per biome
export const BIOME_DOOR_TYPES = {
    urban_core: { exterior: 'glass', interior: 'wood_basic' },
    suburbs: { exterior: 'wood_basic', interior: 'wood_basic' },
    industrial: { exterior: 'metal', interior: 'wood_basic' },
    rich_neighborhood: { exterior: 'wood_reinforced', interior: 'wood_basic' },
    rural: { exterior: 'wood_basic', interior: 'wood_basic' },
    forest: { exterior: 'wood_basic', interior: 'wood_basic' },
    ruins: { exterior: 'wood_basic', interior: 'wood_basic' }
};

export const BUILDING_PREFABS = {
    // ===== SMALL BUILDINGS (8-12 tiles) =====
    
    // 10x8 studio: open plan with bathroom in corner
    // All rooms accessible from main space via 'd' doors
    studio_apartment: {
        id: "studio_apartment",
        name: "Studio Apartment",
        size: "small",
        width: 10,
        height: 8,
        biomes: ["urban_core", "suburbs"],
        clusterType: "apartment",
        layout: [
            "##########",
            "#...|....#",
            "#...d....#",
            "#...|....#",
            "#........#",
            "#........#",
            "#........#",
            "####+#####"
        ],
        lootZones: [
            { x: 1, y: 1, w: 3, h: 3, type: 'residential_bathroom' },
            { x: 5, y: 1, w: 4, h: 3, type: 'residential_kitchen' },
            { x: 1, y: 4, w: 8, h: 3, type: 'residential_living' }
        ],
        furnitureSpawns: [
            { type: 'toilet', x: 1, y: 1 },
            { type: 'sink', x: 2, y: 1 },
            { type: 'counter', x: 5, y: 1 },
            { type: 'stove', x: 7, y: 1 },
            { type: 'cabinet', x: 8, y: 1 },
            { type: 'couch', x: 2, y: 5 },
            { type: 'table', x: 5, y: 5 },
            { type: 'shelf', x: 7, y: 6 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.5,
            description: "Small studio with bathroom and kitchenette"
        }
    },

    // 12x10 corner store: shop floor with back room behind counter
    corner_store: {
        id: "corner_store",
        name: "Corner Store",
        size: "small",
        width: 12,
        height: 10,
        biomes: ["urban_core", "suburbs", "industrial"],
        clusterType: "commercial",
        layout: [
            "############",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#----d-----#",
            "#..........#",
            "#..........#",
            "#####+######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 10, h: 5, type: 'commercial_store' },
            { x: 1, y: 7, w: 10, h: 2, type: 'commercial_backroom' }
        ],
        furnitureSpawns: [
            { type: 'shelf', x: 1, y: 1 },
            { type: 'shelf', x: 1, y: 2 },
            { type: 'shelf', x: 1, y: 3 },
            { type: 'shelf', x: 5, y: 1 },
            { type: 'shelf', x: 5, y: 2 },
            { type: 'shelf', x: 5, y: 3 },
            { type: 'counter', x: 8, y: 5 },
            { type: 'shelf', x: 1, y: 7 },
            { type: 'crate', x: 5, y: 7 },
            { type: 'crate', x: 8, y: 8 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: true,
            lockChance: 0.7,
            description: "Small retail store with back room"
        }
    },

    // ===== MEDIUM BUILDINGS (14-18 tiles) =====
    
    // 16x14 two-bedroom: bedrooms top, living middle, kitchen/bath bottom
    two_bedroom_apartment: {
        id: "two_bedroom_apartment",
        name: "2BR Apartment",
        size: "medium",
        width: 16,
        height: 14,
        biomes: ["urban_core", "suburbs"],
        clusterType: "apartment",
        layout: [
            "################",
            "#......|.......#",
            "#......|.......#",
            "#......|.......#",
            "#......d.......#",
            "#---d--|--d----#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#....|---d-----#",
            "#....d.........#",
            "#....|.........#",
            "#######+########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 6, h: 4, type: 'residential_bedroom' },
            { x: 8, y: 1, w: 7, h: 4, type: 'residential_bedroom' },
            { x: 1, y: 6, w: 14, h: 4, type: 'residential_living' },
            { x: 1, y: 10, w: 4, h: 3, type: 'residential_bathroom' },
            { x: 6, y: 10, w: 9, h: 3, type: 'residential_kitchen' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 1, y: 1 },
            { type: 'dresser', x: 4, y: 1 },
            { type: 'bed', x: 8, y: 1 },
            { type: 'dresser', x: 12, y: 1 },
            { type: 'couch', x: 3, y: 7 },
            { type: 'table', x: 6, y: 7 },
            { type: 'shelf', x: 10, y: 6 },
            { type: 'cabinet', x: 13, y: 6 },
            { type: 'toilet', x: 1, y: 11 },
            { type: 'sink', x: 2, y: 11 },
            { type: 'counter', x: 6, y: 11 },
            { type: 'stove', x: 8, y: 11 },
            { type: 'cabinet', x: 10, y: 10 },
            { type: 'cabinet', x: 13, y: 10 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.5,
            description: "Two bedroom apartment with living room, kitchen, and bathroom"
        }
    },

    // 14x14 small office: two offices flanking a reception area
    small_office: {
        id: "small_office",
        name: "Small Office",
        size: "medium",
        width: 14,
        height: 14,
        biomes: ["urban_core", "industrial"],
        clusterType: "office",
        layout: [
            "##############",
            "#............#",
            "#............#",
            "#............#",
            "#----d-------#",
            "#............#",
            "#............#",
            "#............#",
            "#............#",
            "#-------d----#",
            "#............#",
            "#............#",
            "#............#",
            "######+#######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 12, h: 3, type: 'office' },
            { x: 1, y: 5, w: 12, h: 4, type: 'office_reception' },
            { x: 1, y: 10, w: 12, h: 3, type: 'office' }
        ],
        furnitureSpawns: [
            { type: 'table', x: 3, y: 1 },
            { type: 'chair', x: 4, y: 2 },
            { type: 'filing_cabinet', x: 10, y: 1 },
            { type: 'table', x: 5, y: 6 },
            { type: 'chair', x: 6, y: 7 },
            { type: 'chair', x: 3, y: 6 },
            { type: 'filing_cabinet', x: 1, y: 5 },
            { type: 'table', x: 3, y: 11 },
            { type: 'chair', x: 4, y: 11 },
            { type: 'filing_cabinet', x: 10, y: 10 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: false,
            lockChance: 0.6,
            description: "Small office with reception and two private offices"
        }
    },

    // 10x10 pharmacy: counter area with locked back storage
    pharmacy: {
        id: "pharmacy",
        name: "Pharmacy",
        size: "small",
        width: 10,
        height: 10,
        biomes: ["urban_core", "suburbs"],
        clusterType: "commercial",
        layout: [
            "##########",
            "#........#",
            "#........#",
            "#........#",
            "#........#",
            "#---d----#",
            "#........#",
            "#........#",
            "#........#",
            "####+#####"
        ],
        lootZones: [
            { x: 1, y: 1, w: 8, h: 4, type: 'medical_store' },
            { x: 1, y: 6, w: 8, h: 3, type: 'medical_storage' }
        ],
        furnitureSpawns: [
            { type: 'shelf', x: 1, y: 1 },
            { type: 'shelf', x: 1, y: 2 },
            { type: 'shelf', x: 4, y: 1 },
            { type: 'shelf', x: 4, y: 2 },
            { type: 'counter', x: 7, y: 4 },
            { type: 'cabinet', x: 1, y: 6 },
            { type: 'cabinet', x: 3, y: 6 },
            { type: 'shelf', x: 6, y: 7 },
            { type: 'cabinet', x: 8, y: 7 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.8,
            description: "Small pharmacy with locked back storage"
        }
    },

    // 12x10 garage: open bay with tool room
    garage: {
        id: "garage",
        name: "Garage",
        size: "small",
        width: 12,
        height: 10,
        biomes: ["suburbs", "industrial", "rural"],
        clusterType: "industrial",
        layout: [
            "############",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..|---d---#",
            "#..|.......#",
            "#####+######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 10, h: 6, type: 'garage_bay' },
            { x: 4, y: 7, w: 7, h: 2, type: 'garage_tools' }
        ],
        furnitureSpawns: [
            { type: 'workbench', x: 1, y: 1 },
            { type: 'locker', x: 9, y: 1 },
            { type: 'crate', x: 5, y: 3 },
            { type: 'shelf', x: 4, y: 8 },
            { type: 'workbench', x: 7, y: 8 },
            { type: 'locker', x: 10, y: 8 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.4,
            description: "Garage with open bay and tool storage"
        }
    },

    // 16x14 clinic: waiting room, exam rooms, supply closet
    clinic: {
        id: "clinic",
        name: "Clinic",
        size: "medium",
        width: 16,
        height: 14,
        biomes: ["urban_core", "suburbs"],
        clusterType: "commercial",
        layout: [
            "################",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#---d----d-----#",
            "#.....|........#",
            "#.....|........#",
            "#.....|........#",
            "#---d-|--d-----#",
            "#.....|........#",
            "#.....|........#",
            "#.....|........#",
            "#######+########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 14, h: 4, type: 'medical_waiting' },
            { x: 1, y: 6, w: 5, h: 3, type: 'medical_exam' },
            { x: 7, y: 6, w: 8, h: 3, type: 'medical_exam' },
            { x: 1, y: 10, w: 5, h: 3, type: 'medical_storage' },
            { x: 7, y: 10, w: 8, h: 3, type: 'medical_exam' }
        ],
        furnitureSpawns: [
            { type: 'chair', x: 2, y: 1 },
            { type: 'chair', x: 4, y: 1 },
            { type: 'chair', x: 6, y: 1 },
            { type: 'counter', x: 12, y: 1 },
            { type: 'cabinet', x: 14, y: 1 },
            { type: 'table', x: 2, y: 7 },
            { type: 'cabinet', x: 4, y: 6 },
            { type: 'table', x: 9, y: 7 },
            { type: 'cabinet', x: 12, y: 6 },
            { type: 'cabinet', x: 1, y: 11 },
            { type: 'shelf', x: 3, y: 11 },
            { type: 'cabinet', x: 4, y: 10 },
            { type: 'table', x: 9, y: 11 },
            { type: 'cabinet', x: 12, y: 10 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: true,
            lockChance: 0.7,
            description: "Small clinic with exam rooms and supply storage"
        }
    },

    // ===== LARGE BUILDINGS (20-24 tiles) =====

    // 20x20 warehouse: large open floor with offices and storage
    warehouse: {
        id: "warehouse",
        name: "Warehouse",
        size: "large",
        width: 20,
        height: 20,
        biomes: ["industrial", "urban_core"],
        clusterType: "industrial",
        layout: [
            "####################",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#------d-----------#",
            "#......|...........#",
            "#......|...........#",
            "#---d--|-----d-----#",
            "#......|...........#",
            "#......|...........#",
            "#......|...........#",
            "#########+##########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 18, h: 11, type: 'warehouse_floor' },
            { x: 1, y: 13, w: 6, h: 2, type: 'office' },
            { x: 8, y: 13, w: 11, h: 2, type: 'warehouse_storage' },
            { x: 1, y: 16, w: 6, h: 3, type: 'office' },
            { x: 8, y: 16, w: 11, h: 3, type: 'warehouse_storage' }
        ],
        furnitureSpawns: [
            { type: 'crate', x: 3, y: 2 },
            { type: 'crate', x: 5, y: 2 },
            { type: 'crate', x: 3, y: 5 },
            { type: 'crate', x: 10, y: 3 },
            { type: 'crate', x: 14, y: 3 },
            { type: 'shelf', x: 16, y: 5 },
            { type: 'shelf', x: 16, y: 7 },
            { type: 'crate', x: 10, y: 8 },
            { type: 'table', x: 2, y: 13 },
            { type: 'filing_cabinet', x: 5, y: 13 },
            { type: 'shelf', x: 8, y: 13 },
            { type: 'crate', x: 12, y: 13 },
            { type: 'crate', x: 16, y: 13 },
            { type: 'table', x: 2, y: 17 },
            { type: 'chair', x: 3, y: 17 },
            { type: 'filing_cabinet', x: 5, y: 16 },
            { type: 'shelf', x: 8, y: 17 },
            { type: 'crate', x: 12, y: 17 },
            { type: 'crate', x: 16, y: 17 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: true,
            lockChance: 0.6,
            description: "Large warehouse with office section and storage bays"
        }
    },

    // 20x18 large apartment: 4 units around a central hallway
    large_apartment: {
        id: "large_apartment",
        name: "Large Apartment",
        size: "large",
        width: 20,
        height: 18,
        biomes: ["urban_core", "suburbs"],
        clusterType: "apartment",
        layout: [
            "####################",
            "#........|.........#",
            "#........|.........#",
            "#........|.........#",
            "#........d.........#",
            "#---d----|----d----#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#---d----|----d----#",
            "#........d.........#",
            "#........|.........#",
            "#........|.........#",
            "#........|.........#",
            "#---d----|----d----#",
            "#........|.........#",
            "#........|.........#",
            "#########+##########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 8, h: 4, type: 'residential_bedroom' },
            { x: 10, y: 1, w: 9, h: 4, type: 'residential_bedroom' },
            { x: 1, y: 6, w: 18, h: 3, type: 'residential_living' },
            { x: 1, y: 10, w: 8, h: 4, type: 'residential_kitchen' },
            { x: 10, y: 10, w: 9, h: 4, type: 'residential_kitchen' },
            { x: 1, y: 15, w: 8, h: 2, type: 'residential_bathroom' },
            { x: 10, y: 15, w: 9, h: 2, type: 'residential_bathroom' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 1, y: 1 },
            { type: 'dresser', x: 5, y: 1 },
            { type: 'cabinet', x: 7, y: 2 },
            { type: 'bed', x: 10, y: 1 },
            { type: 'dresser', x: 15, y: 1 },
            { type: 'cabinet', x: 17, y: 2 },
            { type: 'couch', x: 4, y: 7 },
            { type: 'table', x: 8, y: 7 },
            { type: 'shelf', x: 14, y: 6 },
            { type: 'cabinet', x: 17, y: 6 },
            { type: 'counter', x: 1, y: 11 },
            { type: 'stove', x: 3, y: 11 },
            { type: 'cabinet', x: 5, y: 10 },
            { type: 'sink', x: 7, y: 10 },
            { type: 'counter', x: 10, y: 11 },
            { type: 'stove', x: 13, y: 11 },
            { type: 'cabinet', x: 15, y: 10 },
            { type: 'sink', x: 17, y: 10 },
            { type: 'toilet', x: 1, y: 15 },
            { type: 'sink', x: 3, y: 15 },
            { type: 'shower', x: 6, y: 15 },
            { type: 'toilet', x: 10, y: 15 },
            { type: 'sink', x: 13, y: 15 },
            { type: 'shower', x: 16, y: 15 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.5,
            description: "Large apartment building with multiple rooms"
        }
    }
};

// Helper function to get prefabs by size
export function getPrefabsBySize(size) {
    return Object.values(BUILDING_PREFABS).filter(prefab => prefab.size === size);
}

// Helper function to get prefabs by biome
export function getPrefabsByBiome(biome) {
    return Object.values(BUILDING_PREFABS).filter(prefab => 
        prefab.biomes.includes(biome)
    );
}

// Helper function to get prefabs by cluster type
export function getPrefabsByCluster(clusterType) {
    return Object.values(BUILDING_PREFABS).filter(prefab => 
        prefab.clusterType === clusterType
    );
}

// Get a matching prefab for the given size range, biome, and door side
// doorSide param kept for API compatibility but no longer restricts matching
// All prefabs have doors on bottom row - player walks around to find entrance
export function findMatchingPrefab(width, height, biome, doorSide = 2) {
    const candidates = Object.values(BUILDING_PREFABS).filter(prefab => {
        // Check biome match
        if (!prefab.biomes.includes(biome)) return false;
        // Check size match (prefab must fit within the allocated space)
        if (prefab.width > width || prefab.height > height) return false;
        // Don't use a prefab much smaller than the space
        if (prefab.width < width - 4 || prefab.height < height - 4) return false;
        return true;
    });
    
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
}
