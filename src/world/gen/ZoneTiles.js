export const ZoneTiles = {
    void: tile(' ', '#000000', '#000000', 'Void', { blocked: true, blocksLight: true, blocksVision: true }),
    asphalt: tile('.', '#686868', '#151515', 'Cracked Asphalt'),
    road: tile('=', '#707070', '#101010', 'Road', { isRoad: true }),
    lanePaint: tile('-', '#d8d0a0', '#101010', 'Faded Lane Paint', { isRoad: true }),
    sidewalk: tile(',', '#a0a094', '#222222', 'Concrete Sidewalk'),
    concrete: tile('.', '#9c9c92', '#1c1c1c', 'Stained Concrete'),
    parking: tile(':', '#6e6e6e', '#131313', 'Parking Lot'),
    alley: tile(';', '#5a5548', '#101010', 'Service Alley'),
    storeFloor: tile('.', '#c8c8bc', '#252525', 'Shop Floor', { isExterior: false, roomType: 'commercial_store' }),
    stockFloor: tile(':', '#a8a08a', '#202018', 'Stockroom Floor', { isExterior: false, roomType: 'commercial_backroom' }),
    officeFloor: tile('.', '#b8b8c8', '#202028', 'Office Floor', { isExterior: false, roomType: 'commercial_office' }),
    mallFloor: tile('+', '#beb8aa', '#242424', 'Mall Tile', { isExterior: false, roomType: 'commercial_store' }),
    neonFloor: tile('.', '#ff66cc', '#1c1024', 'Neon-Stained Pavement'),
    metalFloor: tile('=', '#9fa6a8', '#191c1c', 'Steel Grating', { isExterior: false, roomType: 'industrial' }),
    breakFloor: tile(',', '#b8aa90', '#211d18', 'Break Room Floor', { isExterior: false, roomType: 'residential_kitchen' }),
    bathroomFloor: tile('.', '#a8c0c0', '#182020', 'Bathroom Tile', { isExterior: false, roomType: 'residential_bathroom' }),
    garageFloor: tile('.', '#a0a0a0', '#1b1b1b', 'Garage Floor', { isExterior: false, roomType: 'garage_tools' }),
    canopy: tile('^', '#c0b890', '#262318', 'Gas Station Canopy'),
    dirt: tile(',', '#8a6f45', '#17110b', 'Packed Dirt'),
    mud: tile(';', '#6f5a3f', '#120e09', 'Mud'),
    sand: tile('.', '#c8b36a', '#221f14', 'Gritty Sand'),
    grass: tile('"', '#4f8a45', '#0e1a0e', 'Weedy Grass'),
    brush: tile('*', '#5f9a4f', '#0d180d', 'Brush', { blocked: true, blocksLight: false, blocksVision: false }),
    tree: tile('T', '#2f8a35', '#071207', 'Tree', { blocked: true, blocksLight: true, blocksVision: true }),
    wall: tile('#', '#b8b8aa', '#101010', 'Wall', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    glass: tile('"', '#9fd8ff', '#17232a', 'Cracked Window', { blocked: true, blocksLight: false, blocksVision: false, isExterior: false }),
    fence: tile('|', '#8a7a55', '#111111', 'Chain Fence', { blocked: true, blocksLight: false, blocksVision: false }),
    rubble: tile('%', '#7a6a5a', '#15100d', 'Rubble', { blocked: true, blocksLight: false, blocksVision: false }),
    pipe: tile('o', '#a88a66', '#16100c', 'Pipework', { blocked: true, blocksLight: false, blocksVision: false }),
    hazard: tile('x', '#d8b45f', '#241b08', 'Hazard Marking'),
    dock: tile('=', '#9b7653', '#18100a', 'Weathered Dock'),
    water: tile('~', '#4aa3ff', '#061525', 'Shallow Water', { isWater: true })
};

export function tile(glyph, fgColor, bgColor, name, options = {}) {
    return {
        glyph,
        fgColor,
        bgColor,
        name,
        blocked: false,
        blocksLight: false,
        blocksVision: false,
        isExterior: true,
        ...options
    };
}

export function cloneTile(base, overrides = {}) {
    return { ...base, ...overrides };
}
