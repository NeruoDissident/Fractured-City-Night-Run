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

    // 12x10 corner store: backroom at top, shop floor near entrance at bottom
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
            "#----d-----#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#####+######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 10, h: 2, type: 'commercial_backroom' },
            { x: 1, y: 4, w: 10, h: 5, type: 'commercial_store' }
        ],
        furnitureSpawns: [
            { type: 'shelf', x: 1, y: 1 },
            { type: 'crate', x: 5, y: 1 },
            { type: 'crate', x: 8, y: 2 },
            { type: 'shelf', x: 1, y: 5 },
            { type: 'shelf', x: 1, y: 6 },
            { type: 'shelf', x: 1, y: 7 },
            { type: 'shelf', x: 5, y: 5 },
            { type: 'shelf', x: 5, y: 6 },
            { type: 'shelf', x: 5, y: 7 },
            { type: 'counter', x: 8, y: 4 }
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

    // 10x10 pharmacy: locked storage at top, store floor near entrance at bottom
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
            "#---d----#",
            "#........#",
            "#........#",
            "#........#",
            "#........#",
            "####+#####"
        ],
        lootZones: [
            { x: 1, y: 1, w: 8, h: 3, type: 'medical_storage' },
            { x: 1, y: 5, w: 8, h: 4, type: 'medical_store' }
        ],
        furnitureSpawns: [
            { type: 'cabinet', x: 1, y: 1 },
            { type: 'cabinet', x: 3, y: 1 },
            { type: 'shelf', x: 6, y: 2 },
            { type: 'cabinet', x: 8, y: 2 },
            { type: 'counter', x: 7, y: 5 },
            { type: 'shelf', x: 1, y: 6 },
            { type: 'shelf', x: 1, y: 7 },
            { type: 'shelf', x: 4, y: 6 },
            { type: 'shelf', x: 4, y: 7 }
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

    // ===== NEW DISTRICT PREFABS =====

    // 10x10 suburban house: living room + bedroom + bathroom
    suburban_house: {
        id: "suburban_house",
        name: "Suburban House",
        size: "small",
        width: 10,
        height: 10,
        biomes: ["suburbs", "rural", "rich_neighborhood"],
        clusterType: "residential",
        layout: [
            "##########",
            "#....|...#",
            "#....|...#",
            "#....d...#",
            "#---d----#",
            "#........#",
            "#........#",
            "#.|--d---#",
            "#.d......#",
            "####+#####"
        ],
        lootZones: [
            { x: 1, y: 1, w: 4, h: 3, type: 'residential_bedroom' },
            { x: 6, y: 1, w: 3, h: 3, type: 'residential_bathroom' },
            { x: 1, y: 5, w: 8, h: 2, type: 'residential_living' },
            { x: 1, y: 7, w: 1, h: 2, type: 'residential_bathroom' },
            { x: 3, y: 7, w: 6, h: 2, type: 'residential_kitchen' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 1, y: 1 },
            { type: 'dresser', x: 3, y: 1 },
            { type: 'toilet', x: 6, y: 1 },
            { type: 'sink', x: 8, y: 1 },
            { type: 'couch', x: 2, y: 5 },
            { type: 'table', x: 5, y: 5 },
            { type: 'shelf', x: 8, y: 5 },
            { type: 'counter', x: 3, y: 8 },
            { type: 'stove', x: 5, y: 8 },
            { type: 'cabinet', x: 7, y: 7 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.5,
            description: "Small suburban home"
        }
    },

    // 20x14 ranch house: open floor plan with separate bedroom wing
    ranch_house: {
        id: "ranch_house",
        name: "Ranch House",
        size: "large",
        width: 20,
        height: 14,
        biomes: ["suburbs", "rural", "rich_neighborhood"],
        clusterType: "residential",
        layout: [
            "####################",
            "#........|..|......#",
            "#........|..|......#",
            "#........d..|......#",
            "#........|..d......#",
            "#---d----|--|--d---#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#........|---d-----#",
            "#........d.........#",
            "#........|.........#",
            "#########+##########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 8, h: 4, type: 'residential_bedroom' },
            { x: 11, y: 1, w: 2, h: 4, type: 'residential_bathroom' },
            { x: 14, y: 1, w: 5, h: 4, type: 'residential_bedroom' },
            { x: 1, y: 6, w: 18, h: 4, type: 'residential_living' },
            { x: 1, y: 10, w: 8, h: 3, type: 'residential_kitchen' },
            { x: 10, y: 10, w: 9, h: 3, type: 'residential_living' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 1, y: 1 },
            { type: 'dresser', x: 4, y: 1 },
            { type: 'cabinet', x: 7, y: 2 },
            { type: 'toilet', x: 11, y: 1 },
            { type: 'sink', x: 12, y: 1 },
            { type: 'shower', x: 11, y: 3 },
            { type: 'bed', x: 14, y: 1 },
            { type: 'dresser', x: 17, y: 1 },
            { type: 'couch', x: 3, y: 7 },
            { type: 'couch', x: 7, y: 7 },
            { type: 'table', x: 5, y: 8 },
            { type: 'shelf', x: 12, y: 6 },
            { type: 'shelf', x: 16, y: 6 },
            { type: 'counter', x: 1, y: 11 },
            { type: 'stove', x: 3, y: 11 },
            { type: 'sink', x: 5, y: 10 },
            { type: 'cabinet', x: 7, y: 10 },
            { type: 'table', x: 12, y: 11 },
            { type: 'chair', x: 13, y: 12 },
            { type: 'chair', x: 11, y: 12 },
            { type: 'shelf', x: 17, y: 11 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: true,
            lockChance: 0.5,
            description: "Spacious ranch-style home with bedroom wing"
        }
    },

    // 16x16 two-story home: bedrooms and bath upstairs feel, living/kitchen/dining down
    two_story_home: {
        id: "two_story_home",
        name: "Two-Story Home",
        size: "large",
        width: 16,
        height: 16,
        biomes: ["suburbs", "rich_neighborhood"],
        clusterType: "residential",
        layout: [
            "################",
            "#......|.......#",
            "#......|.......#",
            "#......d.......#",
            "#......|.......#",
            "#--d---|--d----#",
            "#......|.......#",
            "#......d.......#",
            "#......|..|--d-#",
            "#......|..|....#",
            "#---d--|--d----#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#######+########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 6, h: 4, type: 'residential_bedroom' },
            { x: 8, y: 1, w: 7, h: 4, type: 'residential_bedroom' },
            { x: 1, y: 6, w: 6, h: 4, type: 'residential_bedroom' },
            { x: 8, y: 6, w: 2, h: 4, type: 'residential_living' },
            { x: 11, y: 8, w: 4, h: 2, type: 'residential_bathroom' },
            { x: 8, y: 6, w: 7, h: 2, type: 'residential_living' },
            { x: 1, y: 11, w: 14, h: 4, type: 'residential_living' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 1, y: 1 },
            { type: 'dresser', x: 4, y: 1 },
            { type: 'bed', x: 8, y: 1 },
            { type: 'dresser', x: 12, y: 1 },
            { type: 'cabinet', x: 14, y: 2 },
            { type: 'bed', x: 1, y: 6 },
            { type: 'dresser', x: 4, y: 6 },
            { type: 'shelf', x: 1, y: 8 },
            { type: 'toilet', x: 11, y: 8 },
            { type: 'sink', x: 13, y: 8 },
            { type: 'shower', x: 14, y: 9 },
            { type: 'couch', x: 3, y: 12 },
            { type: 'table', x: 6, y: 12 },
            { type: 'shelf', x: 10, y: 11 },
            { type: 'counter', x: 1, y: 14 },
            { type: 'stove', x: 3, y: 14 },
            { type: 'sink', x: 5, y: 14 },
            { type: 'cabinet', x: 7, y: 14 },
            { type: 'table', x: 11, y: 13 },
            { type: 'chair', x: 12, y: 14 },
            { type: 'chair', x: 10, y: 14 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.5,
            description: "Two-story family home with bedrooms, bath, and open living area"
        }
    },

    // 28x12 townhouse row: 3 connected units sharing walls
    townhouse_row: {
        id: "townhouse_row",
        name: "Townhouse Row",
        size: "xlarge",
        width: 28,
        height: 12,
        biomes: ["urban_core", "suburbs"],
        clusterType: "residential",
        layout: [
            "############################",
            "#...|..##...|...##...|.....#",
            "#...d..##...d...##...d.....#",
            "#...|..##...|...##...|.....#",
            "#-d----##--d----##--d------#",
            "#......##.......##.........#",
            "#......##.......##.........#",
            "#......##.......##.........#",
            "#-d----##--d----##--d------#",
            "#......##.......##.........#",
            "#......##.......##.........#",
            "###+#####+###+#####+###+####"
        ],
        lootZones: [
            { x: 1, y: 1, w: 3, h: 3, type: 'residential_bathroom' },
            { x: 5, y: 1, w: 2, h: 3, type: 'residential_bedroom' },
            { x: 1, y: 5, w: 6, h: 3, type: 'residential_living' },
            { x: 1, y: 9, w: 6, h: 2, type: 'residential_kitchen' },
            { x: 9, y: 1, w: 3, h: 3, type: 'residential_bathroom' },
            { x: 13, y: 1, w: 3, h: 3, type: 'residential_bedroom' },
            { x: 9, y: 5, w: 7, h: 3, type: 'residential_living' },
            { x: 9, y: 9, w: 7, h: 2, type: 'residential_kitchen' },
            { x: 18, y: 1, w: 3, h: 3, type: 'residential_bathroom' },
            { x: 22, y: 1, w: 5, h: 3, type: 'residential_bedroom' },
            { x: 18, y: 5, w: 9, h: 3, type: 'residential_living' },
            { x: 18, y: 9, w: 9, h: 2, type: 'residential_kitchen' }
        ],
        furnitureSpawns: [
            { type: 'toilet', x: 1, y: 1 },
            { type: 'sink', x: 2, y: 1 },
            { type: 'bed', x: 5, y: 1 },
            { type: 'couch', x: 2, y: 5 },
            { type: 'table', x: 4, y: 6 },
            { type: 'counter', x: 1, y: 9 },
            { type: 'stove', x: 3, y: 9 },
            { type: 'cabinet', x: 5, y: 9 },
            { type: 'toilet', x: 9, y: 1 },
            { type: 'sink', x: 10, y: 1 },
            { type: 'bed', x: 13, y: 1 },
            { type: 'couch', x: 10, y: 5 },
            { type: 'table', x: 13, y: 6 },
            { type: 'counter', x: 9, y: 9 },
            { type: 'stove', x: 11, y: 9 },
            { type: 'cabinet', x: 14, y: 9 },
            { type: 'toilet', x: 18, y: 1 },
            { type: 'sink', x: 19, y: 1 },
            { type: 'bed', x: 22, y: 1 },
            { type: 'dresser', x: 25, y: 1 },
            { type: 'couch', x: 19, y: 5 },
            { type: 'table', x: 22, y: 6 },
            { type: 'counter', x: 18, y: 9 },
            { type: 'stove', x: 20, y: 9 },
            { type: 'cabinet', x: 24, y: 9 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: false,
            lockChance: 0.4,
            description: "Row of three connected townhouses"
        }
    },

    // 14x12 restaurant: kitchen/backroom at top, dining area near entrance at bottom
    restaurant: {
        id: "restaurant",
        name: "Restaurant",
        size: "medium",
        width: 14,
        height: 12,
        biomes: ["urban_core", "suburbs", "rich_neighborhood"],
        clusterType: "commercial",
        layout: [
            "##############",
            "#..|---d-----#",
            "#..d.........#",
            "#............#",
            "#............#",
            "#----d--d----#",
            "#............#",
            "#............#",
            "#............#",
            "#............#",
            "#............#",
            "#######+######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 2, h: 2, type: 'residential_bathroom' },
            { x: 4, y: 1, w: 9, h: 2, type: 'commercial_backroom' },
            { x: 1, y: 3, w: 12, h: 2, type: 'residential_kitchen' },
            { x: 1, y: 6, w: 12, h: 5, type: 'commercial_store' }
        ],
        furnitureSpawns: [
            { type: 'toilet', x: 1, y: 1 },
            { type: 'crate', x: 5, y: 1 },
            { type: 'shelf', x: 8, y: 1 },
            { type: 'counter', x: 4, y: 3 },
            { type: 'stove', x: 7, y: 3 },
            { type: 'stove', x: 9, y: 3 },
            { type: 'sink', x: 11, y: 4 },
            { type: 'table', x: 2, y: 7 },
            { type: 'chair', x: 1, y: 8 },
            { type: 'chair', x: 3, y: 8 },
            { type: 'table', x: 6, y: 7 },
            { type: 'chair', x: 5, y: 8 },
            { type: 'chair', x: 7, y: 8 },
            { type: 'table', x: 10, y: 7 },
            { type: 'chair', x: 9, y: 8 },
            { type: 'chair', x: 11, y: 8 },
            { type: 'table', x: 2, y: 10 },
            { type: 'table', x: 6, y: 10 },
            { type: 'table', x: 10, y: 10 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: true,
            lockChance: 0.4,
            description: "Restaurant with dining hall and commercial kitchen"
        }
    },

    // 14x14 gas station: garage bay at top, backroom middle, store near entrance
    gas_station: {
        id: "gas_station",
        name: "Gas Station",
        size: "medium",
        width: 14,
        height: 14,
        biomes: ["suburbs", "rural", "industrial"],
        clusterType: "commercial",
        layout: [
            "##############",
            "#............#",
            "#............#",
            "#............#",
            "#............#",
            "#------d-----#",
            "#............#",
            "#............#",
            "#............#",
            "#----d--d----#",
            "#............#",
            "#............#",
            "#............#",
            "#######+######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 12, h: 4, type: 'garage_bay' },
            { x: 1, y: 6, w: 12, h: 3, type: 'commercial_backroom' },
            { x: 1, y: 10, w: 12, h: 3, type: 'commercial_store' }
        ],
        furnitureSpawns: [
            { type: 'workbench', x: 1, y: 1 },
            { type: 'crate', x: 5, y: 2 },
            { type: 'locker', x: 10, y: 1 },
            { type: 'shelf', x: 1, y: 6 },
            { type: 'crate', x: 5, y: 7 },
            { type: 'crate', x: 8, y: 7 },
            { type: 'locker', x: 11, y: 6 },
            { type: 'shelf', x: 1, y: 10 },
            { type: 'shelf', x: 3, y: 10 },
            { type: 'shelf', x: 6, y: 10 },
            { type: 'counter', x: 10, y: 11 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.5,
            description: "Gas station with repair bay and convenience store"
        }
    },

    // 8x8 slum shack: one room, barely standing
    slum_shack: {
        id: "slum_shack",
        name: "Slum Shack",
        size: "small",
        width: 8,
        height: 8,
        biomes: ["urban_core", "ruins", "industrial"],
        clusterType: "residential",
        layout: [
            "########",
            "#......#",
            "#......#",
            "#......#",
            "#......#",
            "#......#",
            "#......#",
            "###+####"
        ],
        lootZones: [
            { x: 1, y: 1, w: 6, h: 6, type: 'residential_living' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 1, y: 1 },
            { type: 'crate', x: 4, y: 1 },
            { type: 'table', x: 1, y: 4 },
            { type: 'shelf', x: 5, y: 5 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.2,
            description: "Ramshackle shelter"
        }
    },

    // 16x16 church: nave, altar area, vestry
    church: {
        id: "church",
        name: "Church",
        size: "large",
        width: 16,
        height: 16,
        biomes: ["suburbs", "urban_core", "rich_neighborhood", "rural"],
        clusterType: "civic",
        layout: [
            "################",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#..............#",
            "#---d----d-----#",
            "#......|.......#",
            "#......d.......#",
            "#..............#",
            "#..............#",
            "#######+########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 14, h: 9, type: 'residential_living' },
            { x: 1, y: 11, w: 6, h: 2, type: 'office' },
            { x: 8, y: 11, w: 7, h: 2, type: 'commercial_backroom' },
            { x: 1, y: 14, w: 14, h: 1, type: 'residential_living' }
        ],
        furnitureSpawns: [
            { type: 'chair', x: 3, y: 2 },
            { type: 'chair', x: 3, y: 4 },
            { type: 'chair', x: 3, y: 6 },
            { type: 'chair', x: 3, y: 8 },
            { type: 'chair', x: 8, y: 2 },
            { type: 'chair', x: 8, y: 4 },
            { type: 'chair', x: 8, y: 6 },
            { type: 'chair', x: 8, y: 8 },
            { type: 'chair', x: 12, y: 2 },
            { type: 'chair', x: 12, y: 4 },
            { type: 'chair', x: 12, y: 6 },
            { type: 'chair', x: 12, y: 8 },
            { type: 'table', x: 2, y: 12 },
            { type: 'shelf', x: 5, y: 11 },
            { type: 'cabinet', x: 9, y: 11 },
            { type: 'crate', x: 13, y: 12 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.3,
            description: "Church with nave, vestry and storage"
        }
    },

    // 20x16 mansion: multiple wings, grand hall
    mansion: {
        id: "mansion",
        name: "Mansion",
        size: "large",
        width: 20,
        height: 16,
        biomes: ["rich_neighborhood"],
        clusterType: "residential",
        layout: [
            "####################",
            "#........|.........#",
            "#........|.........#",
            "#........d.........#",
            "#---d----|----d----#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#..................#",
            "#---d----|----d----#",
            "#........d.........#",
            "#........|.........#",
            "#........|.........#",
            "#---d----|----d----#",
            "#........|.........#",
            "#########+##########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 8, h: 3, type: 'residential_bedroom' },
            { x: 10, y: 1, w: 9, h: 3, type: 'residential_bedroom' },
            { x: 1, y: 5, w: 18, h: 4, type: 'residential_living' },
            { x: 1, y: 10, w: 8, h: 3, type: 'residential_kitchen' },
            { x: 10, y: 10, w: 9, h: 3, type: 'residential_living' },
            { x: 1, y: 14, w: 8, h: 1, type: 'residential_bathroom' },
            { x: 10, y: 14, w: 9, h: 1, type: 'residential_bathroom' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 2, y: 1 },
            { type: 'dresser', x: 5, y: 1 },
            { type: 'cabinet', x: 7, y: 2 },
            { type: 'bed', x: 11, y: 1 },
            { type: 'dresser', x: 15, y: 1 },
            { type: 'cabinet', x: 17, y: 2 },
            { type: 'couch', x: 3, y: 6 },
            { type: 'couch', x: 8, y: 6 },
            { type: 'table', x: 6, y: 7 },
            { type: 'shelf', x: 14, y: 5 },
            { type: 'shelf', x: 17, y: 5 },
            { type: 'counter', x: 1, y: 11 },
            { type: 'stove', x: 3, y: 11 },
            { type: 'sink', x: 5, y: 10 },
            { type: 'cabinet', x: 7, y: 10 },
            { type: 'table', x: 11, y: 11 },
            { type: 'shelf', x: 15, y: 11 },
            { type: 'toilet', x: 1, y: 14 },
            { type: 'sink', x: 3, y: 14 },
            { type: 'shower', x: 6, y: 14 },
            { type: 'toilet', x: 10, y: 14 },
            { type: 'sink', x: 13, y: 14 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.7,
            description: "Sprawling mansion with multiple wings"
        }
    },

    // 12x10 convenience store: back office at top, store floor near entrance
    convenience_store: {
        id: "convenience_store",
        name: "Convenience Store",
        size: "small",
        width: 12,
        height: 10,
        biomes: ["suburbs", "urban_core", "industrial"],
        clusterType: "commercial",
        layout: [
            "############",
            "#..........#",
            "#..........#",
            "#----d-----#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#####+######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 10, h: 2, type: 'commercial_backroom' },
            { x: 1, y: 4, w: 10, h: 5, type: 'commercial_store' }
        ],
        furnitureSpawns: [
            { type: 'crate', x: 2, y: 1 },
            { type: 'shelf', x: 5, y: 1 },
            { type: 'crate', x: 9, y: 2 },
            { type: 'counter', x: 9, y: 4 },
            { type: 'shelf', x: 2, y: 5 },
            { type: 'shelf', x: 2, y: 6 },
            { type: 'shelf', x: 2, y: 7 },
            { type: 'shelf', x: 5, y: 5 },
            { type: 'shelf', x: 5, y: 6 },
            { type: 'shelf', x: 5, y: 7 },
            { type: 'shelf', x: 8, y: 5 },
            { type: 'shelf', x: 8, y: 6 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.5,
            description: "Small convenience shop"
        }
    },

    // 10x8 guard post / police booth: desk, lockers, holding cell
    guard_post: {
        id: "guard_post",
        name: "Guard Post",
        size: "small",
        width: 10,
        height: 8,
        biomes: ["urban_core", "industrial", "rich_neighborhood"],
        clusterType: "civic",
        layout: [
            "##########",
            "#...|....#",
            "#...|....#",
            "#...d....#",
            "#........#",
            "#........#",
            "#........#",
            "####+#####"
        ],
        lootZones: [
            { x: 1, y: 1, w: 3, h: 3, type: 'office' },
            { x: 5, y: 1, w: 4, h: 3, type: 'warehouse_storage' },
            { x: 1, y: 4, w: 8, h: 3, type: 'office' }
        ],
        furnitureSpawns: [
            { type: 'table', x: 1, y: 1 },
            { type: 'chair', x: 2, y: 2 },
            { type: 'locker', x: 5, y: 1 },
            { type: 'locker', x: 7, y: 1 },
            { type: 'filing_cabinet', x: 1, y: 5 },
            { type: 'table', x: 4, y: 5 },
            { type: 'chair', x: 5, y: 5 },
            { type: 'locker', x: 8, y: 5 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: false,
            lockChance: 0.8,
            description: "Small security post with holding area"
        }
    },

    // 12x12 bar / pub: back room at top, bar area near entrance at bottom
    bar: {
        id: "bar",
        name: "Bar",
        size: "medium",
        width: 12,
        height: 12,
        biomes: ["urban_core", "suburbs", "industrial"],
        clusterType: "commercial",
        layout: [
            "############",
            "#..........#",
            "#..........#",
            "#..........#",
            "#----d-----#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#..........#",
            "#####+######"
        ],
        lootZones: [
            { x: 1, y: 1, w: 10, h: 3, type: 'commercial_backroom' },
            { x: 1, y: 5, w: 10, h: 6, type: 'commercial_store' }
        ],
        furnitureSpawns: [
            { type: 'crate', x: 2, y: 1 },
            { type: 'shelf', x: 5, y: 1 },
            { type: 'crate', x: 8, y: 2 },
            { type: 'counter', x: 1, y: 5 },
            { type: 'counter', x: 3, y: 5 },
            { type: 'counter', x: 5, y: 5 },
            { type: 'counter', x: 7, y: 5 },
            { type: 'shelf', x: 9, y: 6 },
            { type: 'table', x: 1, y: 8 },
            { type: 'chair', x: 2, y: 9 },
            { type: 'table', x: 5, y: 8 },
            { type: 'chair', x: 6, y: 9 },
            { type: 'table', x: 9, y: 8 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: true,
            lockChance: 0.4,
            description: "Dive bar with storage cellar"
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
    },

    // ===== EXTRA LARGE BUILDINGS (24+ tiles) =====

    // 24x20 office building: central vertical corridor, offices on both sides, lobby at entrance
    office_building: {
        id: "office_building",
        name: "Office Building",
        size: "xlarge",
        width: 24,
        height: 20,
        biomes: ["urban_core", "industrial"],
        clusterType: "office",
        layout: [
            "########################",
            "#.........|..|.........#",
            "#.........|..|.........#",
            "#.........d..d.........#",
            "#.........|..|.........#",
            "#---------|..|---------#",
            "#.........|..|.........#",
            "#.........|..|.........#",
            "#.........d..d.........#",
            "#.........|..|.........#",
            "#---------|..|---------#",
            "#.........|..|.........#",
            "#.........|..|.........#",
            "#.........d..d.........#",
            "#.........|..|.........#",
            "#---------|..|---------#",
            "#......................#",
            "#......................#",
            "#......................#",
            "###########+############"
        ],
        lootZones: [
            { x: 1, y: 1, w: 9, h: 4, type: 'commercial_office' },
            { x: 14, y: 1, w: 9, h: 4, type: 'commercial_office' },
            { x: 1, y: 6, w: 9, h: 4, type: 'commercial_office' },
            { x: 14, y: 6, w: 9, h: 4, type: 'commercial_office' },
            { x: 1, y: 11, w: 9, h: 4, type: 'commercial_storage' },
            { x: 14, y: 11, w: 9, h: 4, type: 'commercial_office' },
            { x: 1, y: 16, w: 22, h: 3, type: 'office_reception' }
        ],
        furnitureSpawns: [
            { type: 'table', x: 3, y: 1 },
            { type: 'chair', x: 4, y: 2 },
            { type: 'filing_cabinet', x: 8, y: 1 },
            { type: 'table', x: 16, y: 1 },
            { type: 'chair', x: 17, y: 2 },
            { type: 'filing_cabinet', x: 21, y: 1 },
            { type: 'table', x: 3, y: 6 },
            { type: 'chair', x: 4, y: 7 },
            { type: 'filing_cabinet', x: 8, y: 6 },
            { type: 'table', x: 16, y: 6 },
            { type: 'chair', x: 17, y: 7 },
            { type: 'filing_cabinet', x: 21, y: 7 },
            { type: 'cabinet', x: 2, y: 12 },
            { type: 'crate', x: 5, y: 12 },
            { type: 'shelf', x: 8, y: 11 },
            { type: 'table', x: 16, y: 12 },
            { type: 'chair', x: 17, y: 12 },
            { type: 'filing_cabinet', x: 21, y: 11 },
            { type: 'counter', x: 5, y: 17 },
            { type: 'chair', x: 8, y: 17 },
            { type: 'chair', x: 14, y: 17 },
            { type: 'couch', x: 18, y: 17 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.7,
            description: "Multi-story office building with lobby and private offices"
        }
    },

    // 22x16 hotel: central corridor, guest rooms on both sides, lobby
    hotel: {
        id: "hotel",
        name: "Hotel",
        size: "xlarge",
        width: 22,
        height: 16,
        biomes: ["urban_core", "suburbs"],
        clusterType: "commercial",
        layout: [
            "######################",
            "#........|..|........#",
            "#........d..d........#",
            "#........|..|........#",
            "#--------|..|--------#",
            "#........|..|........#",
            "#........d..d........#",
            "#........|..|........#",
            "#--------|..|--------#",
            "#........|..|........#",
            "#........d..d........#",
            "#........|..|........#",
            "#--------|..|--------#",
            "#....................#",
            "#....................#",
            "###########+##########"
        ],
        lootZones: [
            { x: 1, y: 1, w: 8, h: 3, type: 'residential_bedroom' },
            { x: 13, y: 1, w: 8, h: 3, type: 'residential_bedroom' },
            { x: 1, y: 5, w: 8, h: 3, type: 'residential_bedroom' },
            { x: 13, y: 5, w: 8, h: 3, type: 'residential_bedroom' },
            { x: 1, y: 9, w: 8, h: 3, type: 'residential_bedroom' },
            { x: 13, y: 9, w: 8, h: 3, type: 'residential_bedroom' },
            { x: 1, y: 13, w: 20, h: 2, type: 'office_reception' }
        ],
        furnitureSpawns: [
            { type: 'bed', x: 1, y: 1 },
            { type: 'dresser', x: 5, y: 1 },
            { type: 'bed', x: 13, y: 1 },
            { type: 'dresser', x: 18, y: 1 },
            { type: 'bed', x: 1, y: 5 },
            { type: 'dresser', x: 5, y: 5 },
            { type: 'bed', x: 13, y: 5 },
            { type: 'dresser', x: 18, y: 5 },
            { type: 'bed', x: 1, y: 9 },
            { type: 'dresser', x: 5, y: 9 },
            { type: 'bed', x: 13, y: 9 },
            { type: 'dresser', x: 18, y: 9 },
            { type: 'counter', x: 5, y: 13 },
            { type: 'chair', x: 8, y: 14 },
            { type: 'couch', x: 14, y: 13 },
            { type: 'table', x: 17, y: 14 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: false,
            lockChance: 0.6,
            description: "Hotel with guest rooms and lobby"
        }
    },

    // 24x14 supermarket: back storage at top, store floor with aisles near entrance
    supermarket: {
        id: "supermarket",
        name: "Supermarket",
        size: "xlarge",
        width: 24,
        height: 14,
        biomes: ["urban_core", "suburbs"],
        clusterType: "commercial",
        layout: [
            "########################",
            "#......................#",
            "#......................#",
            "#......................#",
            "#-----------d----------#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "###########+############"
        ],
        lootZones: [
            { x: 1, y: 1, w: 22, h: 3, type: 'commercial_backroom' },
            { x: 1, y: 5, w: 22, h: 8, type: 'commercial_store' }
        ],
        furnitureSpawns: [
            { type: 'crate', x: 2, y: 1 },
            { type: 'crate', x: 5, y: 1 },
            { type: 'crate', x: 8, y: 2 },
            { type: 'shelf', x: 14, y: 1 },
            { type: 'shelf', x: 18, y: 1 },
            { type: 'crate', x: 21, y: 2 },
            { type: 'counter', x: 20, y: 5 },
            { type: 'counter', x: 21, y: 5 },
            { type: 'shelf', x: 3, y: 6 },
            { type: 'shelf', x: 3, y: 7 },
            { type: 'shelf', x: 3, y: 8 },
            { type: 'shelf', x: 3, y: 9 },
            { type: 'shelf', x: 3, y: 10 },
            { type: 'shelf', x: 7, y: 6 },
            { type: 'shelf', x: 7, y: 7 },
            { type: 'shelf', x: 7, y: 8 },
            { type: 'shelf', x: 7, y: 9 },
            { type: 'shelf', x: 7, y: 10 },
            { type: 'shelf', x: 11, y: 6 },
            { type: 'shelf', x: 11, y: 7 },
            { type: 'shelf', x: 11, y: 8 },
            { type: 'shelf', x: 11, y: 9 },
            { type: 'shelf', x: 11, y: 10 },
            { type: 'shelf', x: 15, y: 6 },
            { type: 'shelf', x: 15, y: 7 },
            { type: 'shelf', x: 15, y: 8 },
            { type: 'shelf', x: 15, y: 9 },
            { type: 'shelf', x: 15, y: 10 },
            { type: 'shelf', x: 19, y: 6 },
            { type: 'shelf', x: 19, y: 7 },
            { type: 'shelf', x: 19, y: 8 }
        ],
        features: {
            hasUpstairs: false,
            hasBasement: true,
            lockChance: 0.5,
            description: "Large supermarket with aisles of goods and back storage"
        }
    },

    // 28x22 office tower: large lobby, dual corridor wings, many offices
    office_tower: {
        id: "office_tower",
        name: "Office Tower",
        size: "xlarge",
        width: 28,
        height: 22,
        biomes: ["urban_core"],
        clusterType: "office",
        layout: [
            "############################",
            "#............|.............#",
            "#............|.............#",
            "#............d.............#",
            "#............|.............#",
            "#----d-------|--------d----#",
            "#............|.............#",
            "#............|.............#",
            "#............d.............#",
            "#............|.............#",
            "#----d-------|--------d----#",
            "#............|.............#",
            "#............|.............#",
            "#............d.............#",
            "#............|.............#",
            "#----d-------|--------d----#",
            "#............d.............#",
            "#............d.............#",
            "#..........................#",
            "#..........................#",
            "#..........................#",
            "#############+##############"
        ],
        lootZones: [
            { x: 1, y: 1, w: 12, h: 4, type: 'commercial_office' },
            { x: 14, y: 1, w: 13, h: 4, type: 'commercial_office' },
            { x: 1, y: 6, w: 12, h: 4, type: 'commercial_office' },
            { x: 14, y: 6, w: 13, h: 4, type: 'commercial_office' },
            { x: 1, y: 11, w: 12, h: 4, type: 'commercial_office' },
            { x: 14, y: 11, w: 13, h: 4, type: 'commercial_office' },
            { x: 1, y: 16, w: 12, h: 2, type: 'commercial_storage' },
            { x: 14, y: 16, w: 13, h: 2, type: 'commercial_office' },
            { x: 1, y: 18, w: 26, h: 3, type: 'office_reception' }
        ],
        furnitureSpawns: [
            { type: 'table', x: 3, y: 1 },
            { type: 'chair', x: 4, y: 2 },
            { type: 'filing_cabinet', x: 10, y: 1 },
            { type: 'table', x: 17, y: 1 },
            { type: 'chair', x: 18, y: 2 },
            { type: 'filing_cabinet', x: 24, y: 1 },
            { type: 'table', x: 3, y: 6 },
            { type: 'chair', x: 4, y: 7 },
            { type: 'filing_cabinet', x: 10, y: 7 },
            { type: 'table', x: 17, y: 6 },
            { type: 'chair', x: 18, y: 7 },
            { type: 'filing_cabinet', x: 24, y: 7 },
            { type: 'table', x: 3, y: 11 },
            { type: 'chair', x: 4, y: 12 },
            { type: 'filing_cabinet', x: 10, y: 12 },
            { type: 'table', x: 17, y: 11 },
            { type: 'chair', x: 18, y: 12 },
            { type: 'filing_cabinet', x: 24, y: 12 },
            { type: 'cabinet', x: 3, y: 16 },
            { type: 'crate', x: 8, y: 16 },
            { type: 'table', x: 17, y: 16 },
            { type: 'chair', x: 18, y: 17 },
            { type: 'counter', x: 7, y: 19 },
            { type: 'chair', x: 10, y: 19 },
            { type: 'couch', x: 16, y: 19 },
            { type: 'couch', x: 20, y: 19 },
            { type: 'table', x: 23, y: 20 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.8,
            description: "Tall office tower with spacious lobby and many private offices"
        }
    },

    // 26x18 police station: front desk, offices, holding cells, armory
    police_station: {
        id: "police_station",
        name: "Police Station",
        size: "xlarge",
        width: 26,
        height: 18,
        biomes: ["urban_core", "suburbs"],
        clusterType: "civic",
        layout: [
            "##########################",
            "#...........|............#",
            "#...........|............#",
            "#...........|............#",
            "#...........|............#",
            "#--d--------d----d-------#",
            "#......|....|......|.....#",
            "#......|....|......|.....#",
            "#......d....|......d.....#",
            "#......|....|......|.....#",
            "#------d----|------d-----#",
            "#......|....|............#",
            "#......d....|............#",
            "#......|....|............#",
            "#--d--------d----d-------#",
            "#........................#",
            "#........................#",
            "############+#############"
        ],
        lootZones: [
            { x: 1, y: 1, w: 11, h: 4, type: 'office' },
            { x: 13, y: 1, w: 12, h: 4, type: 'office' },
            { x: 1, y: 6, w: 6, h: 4, type: 'office' },
            { x: 8, y: 6, w: 4, h: 4, type: 'warehouse_storage' },
            { x: 13, y: 6, w: 6, h: 4, type: 'office' },
            { x: 20, y: 6, w: 5, h: 4, type: 'warehouse_storage' },
            { x: 1, y: 11, w: 6, h: 3, type: 'warehouse_storage' },
            { x: 8, y: 11, w: 4, h: 3, type: 'warehouse_storage' },
            { x: 13, y: 11, w: 12, h: 3, type: 'warehouse_storage' },
            { x: 1, y: 15, w: 24, h: 2, type: 'office_reception' }
        ],
        furnitureSpawns: [
            { type: 'table', x: 3, y: 1 },
            { type: 'chair', x: 4, y: 2 },
            { type: 'filing_cabinet', x: 9, y: 1 },
            { type: 'table', x: 16, y: 1 },
            { type: 'chair', x: 17, y: 2 },
            { type: 'filing_cabinet', x: 22, y: 1 },
            { type: 'table', x: 2, y: 7 },
            { type: 'locker', x: 5, y: 6 },
            { type: 'cabinet', x: 9, y: 7 },
            { type: 'table', x: 15, y: 7 },
            { type: 'locker', x: 18, y: 6 },
            { type: 'locker', x: 21, y: 7 },
            { type: 'locker', x: 23, y: 7 },
            { type: 'locker', x: 2, y: 12 },
            { type: 'locker', x: 4, y: 12 },
            { type: 'cabinet', x: 9, y: 12 },
            { type: 'shelf', x: 15, y: 12 },
            { type: 'crate', x: 20, y: 12 },
            { type: 'counter', x: 6, y: 15 },
            { type: 'chair', x: 9, y: 16 },
            { type: 'chair', x: 14, y: 16 },
            { type: 'filing_cabinet', x: 20, y: 15 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.9,
            description: "Police station with offices, holding cells, and armory"
        }
    },

    // 24x18 department store: offices/backroom at top, store floor near entrance
    department_store: {
        id: "department_store",
        name: "Department Store",
        size: "xlarge",
        width: 24,
        height: 18,
        biomes: ["urban_core", "suburbs"],
        clusterType: "commercial",
        layout: [
            "########################",
            "#.....|....|...........#",
            "#.....|....|...........#",
            "#.....d....d...........#",
            "#.....|....|...........#",
            "#.....|....|...........#",
            "#-----------d----------#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "#......................#",
            "###########+############"
        ],
        lootZones: [
            { x: 1, y: 1, w: 5, h: 5, type: 'office' },
            { x: 7, y: 1, w: 4, h: 5, type: 'commercial_storage' },
            { x: 12, y: 1, w: 11, h: 5, type: 'commercial_backroom' },
            { x: 1, y: 7, w: 22, h: 10, type: 'commercial_store' }
        ],
        furnitureSpawns: [
            { type: 'table', x: 2, y: 2 },
            { type: 'filing_cabinet', x: 4, y: 2 },
            { type: 'crate', x: 8, y: 2 },
            { type: 'crate', x: 10, y: 3 },
            { type: 'shelf', x: 14, y: 2 },
            { type: 'crate', x: 18, y: 3 },
            { type: 'crate', x: 21, y: 2 },
            { type: 'counter', x: 20, y: 7 },
            { type: 'counter', x: 21, y: 7 },
            { type: 'shelf', x: 3, y: 8 },
            { type: 'shelf', x: 3, y: 9 },
            { type: 'shelf', x: 3, y: 10 },
            { type: 'shelf', x: 3, y: 11 },
            { type: 'shelf', x: 8, y: 8 },
            { type: 'shelf', x: 8, y: 9 },
            { type: 'shelf', x: 8, y: 10 },
            { type: 'shelf', x: 8, y: 11 },
            { type: 'shelf', x: 13, y: 8 },
            { type: 'shelf', x: 13, y: 9 },
            { type: 'shelf', x: 13, y: 10 },
            { type: 'shelf', x: 13, y: 11 },
            { type: 'shelf', x: 18, y: 8 },
            { type: 'shelf', x: 18, y: 9 },
            { type: 'shelf', x: 18, y: 10 },
            { type: 'shelf', x: 18, y: 11 },
            { type: 'shelf', x: 3, y: 13 },
            { type: 'shelf', x: 3, y: 14 },
            { type: 'shelf', x: 8, y: 13 },
            { type: 'shelf', x: 8, y: 14 },
            { type: 'shelf', x: 13, y: 13 },
            { type: 'shelf', x: 13, y: 14 }
        ],
        features: {
            hasUpstairs: true,
            hasBasement: true,
            lockChance: 0.6,
            description: "Large department store with back offices and storage"
        }
    }
};

// Orient a prefab so its door (normally on bottom) faces the target side
// targetDoorSide: 0=top, 1=right, 2=bottom (original), 3=left
export function orientPrefab(prefab, targetDoorSide) {
    if (targetDoorSide === 2 || targetDoorSide === -1) return prefab;
    
    const W = prefab.width;
    const H = prefab.height;
    const swapWall = (ch) => ch === '|' ? '-' : ch === '-' ? '|' : ch;
    
    let newLayout, newW, newH, tfLZ, tfFS;
    
    if (targetDoorSide === 0) {
        // Flip vertical: bottom → top
        newW = W; newH = H;
        newLayout = [...prefab.layout].reverse();
        tfLZ = (z) => ({ ...z, y: H - z.y - z.h });
        tfFS = (f) => ({ ...f, y: H - 1 - f.y });
    } else if (targetDoorSide === 1) {
        // Rotate 90° CCW: bottom → right
        newW = H; newH = W;
        newLayout = [];
        for (let r = 0; r < W; r++) {
            let row = '';
            for (let c = 0; c < H; c++) {
                row += swapWall(prefab.layout[c][W - 1 - r]);
            }
            newLayout.push(row);
        }
        tfLZ = (z) => ({ ...z, x: z.y, y: W - z.x - z.w, w: z.h, h: z.w });
        tfFS = (f) => ({ ...f, x: f.y, y: W - 1 - f.x });
    } else if (targetDoorSide === 3) {
        // Rotate 90° CW: bottom → left
        newW = H; newH = W;
        newLayout = [];
        for (let r = 0; r < W; r++) {
            let row = '';
            for (let c = 0; c < H; c++) {
                row += swapWall(prefab.layout[H - 1 - c][r]);
            }
            newLayout.push(row);
        }
        tfLZ = (z) => ({ ...z, x: H - z.y - z.h, y: z.x, w: z.h, h: z.w });
        tfFS = (f) => ({ ...f, x: H - 1 - f.y, y: f.x });
    }
    
    return {
        ...prefab,
        width: newW,
        height: newH,
        layout: newLayout,
        lootZones: prefab.lootZones.map(tfLZ),
        furnitureSpawns: prefab.furnitureSpawns.map(tfFS)
    };
}

// Get a matching prefab for the given size range, biome, and door side
// doorSide param kept for API compatibility but no longer restricts matching
// All prefabs have doors on bottom row - player walks around to find entrance
export function findMatchingPrefab(width, height, biome, doorSide = 2) {
    // Scale tolerance with space size — larger spaces allow more slack
    const toleranceW = width >= 24 ? 8 : width >= 16 ? 6 : 4;
    const toleranceH = height >= 24 ? 8 : height >= 16 ? 6 : 4;
    
    const candidates = Object.values(BUILDING_PREFABS).filter(prefab => {
        // Check biome match
        if (!prefab.biomes.includes(biome)) return false;
        // Check size match (prefab must fit within the allocated space)
        if (prefab.width > width || prefab.height > height) return false;
        // Don't use a prefab much smaller than the space
        if (prefab.width < width - toleranceW || prefab.height < height - toleranceH) return false;
        return true;
    });
    
    if (candidates.length === 0) return null;
    
    // Prefer larger prefabs (sort by area descending, pick from top candidates)
    candidates.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    // Pick from top 3 candidates (or all if fewer) for variety
    const rand = typeof arguments[4] === 'function' ? arguments[4] : Math.random;
    const poolSize = Math.min(candidates.length, 3);
    return candidates[Math.floor(rand() * poolSize)];
}
