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
    barricade: tile('X', '#c08a55', '#17110b', 'Barricade', { blocked: true, blocksLight: false, blocksVision: false }),
    rubble: tile('%', '#7a6a5a', '#15100d', 'Rubble', { blocked: true, blocksLight: false, blocksVision: false }),
    pipe: tile('o', '#a88a66', '#16100c', 'Pipework', { blocked: true, blocksLight: false, blocksVision: false }),
    hazard: tile('x', '#d8b45f', '#241b08', 'Hazard Marking'),
    dock: tile('=', '#9b7653', '#18100a', 'Weathered Dock'),
    water: tile('~', '#4aa3ff', '#061525', 'Shallow Water', { isWater: true }),

    // ── Interior construction (site generator) ──────────────────────────────
    // Walls carry isWall so the first-person view draws them as solid faces and
    // isExterior:false so LightingSystem treats the space as indoors.
    interiorWall: tile('#', '#a09a8c', '#0d0d0c', 'Interior Wall', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    concreteWall: tile('#', '#8c8c88', '#0c0c0c', 'Concrete Wall', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    metalWall: tile('#', '#8e9aa0', '#0b0e10', 'Steel Bulkhead', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    partitionWall: tile('#', '#b4ad9c', '#111010', 'Partition Wall', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    glassPartition: tile('"', '#9fd8ff', '#141c22', 'Glass Partition', { blocked: true, blocksLight: false, blocksVision: false, isExterior: false }),

    // ── Street blocks (block layout) ─────────────────────────────────────────
    // Facades are the walls of a street corridor. One per block profile so a
    // street tells you which block you are on.
    brickFacade: tile('#', '#a86a58', '#120a08', 'Brick Facade', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    concreteFacade: tile('#', '#9a9a90', '#0e0e0c', 'Concrete Facade', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    neonFacade: tile('#', '#8a6aa0', '#100a16', 'Neon-Stained Facade', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    shutterFacade: tile('#', '#7f8a92', '#0b0e10', 'Steel Shutter', { blocked: true, blocksLight: true, blocksVision: true, isExterior: false, isWall: true }),
    // Street floors stay exterior: sky above, daylight on them.
    street: tile('.', '#6e6e6e', '#151515', 'Street', { isExterior: true }),
    alleyFloor: tile(';', '#5a5548', '#101010', 'Alley', { isExterior: true }),
    marketPaving: tile(',', '#a0a094', '#222222', 'Market Paving', { isExterior: true }),
    neonStreet: tile('.', '#c060a0', '#1c1024', 'Neon-Stained Street', { isExterior: true }),
    underpass: tile('.', '#7d8486', '#111313', 'Underpass', { isExterior: false }),

    corridor: tile('.', '#8f8f86', '#171717', 'Corridor', { isExterior: false }),
    serviceCorridor: tile('.', '#7d8486', '#131515', 'Service Corridor', { isExterior: false }),
    carpet: tile('.', '#6f6560', '#1a1618', 'Carpet', { isExterior: false }),
    tileFloor: tile('.', '#b0b6b8', '#1a1c1c', 'Tiled Floor', { isExterior: false }),
    grating: tile('=', '#9aa2a4', '#141616', 'Steel Grating', { isExterior: false }),
    stairwellFloor: tile('.', '#9a9a92', '#151515', 'Stairwell', { isExterior: false }),
    lobbyFloor: tile('.', '#bdb6a4', '#1c1a16', 'Lobby Floor', { isExterior: false })
};

/**
 * Stairwell tile. `up`/`down` control which directions are usable, matching the
 * canAscend/canDescend flags Player.tryAscend/tryDescend read.
 */
export function stairsTile(up, down, name = 'Stairwell') {
    const glyph = up && down ? '\u2261' : up ? '<' : '>';
    return tile(glyph, '#7fe8ff', '#101a1c', name, {
        isExterior: false,
        isStaircase: true,
        canAscend: !!up,
        canDescend: !!down
    });
}

/**
 * The way back out of a site. Handled by Game before tryAscend so it returns to
 * the overworld instead of changing z-level.
 */
export function siteExitTile(name = 'Exit', options = {}) {
    return tile('\u2302', '#8fffa8', '#0e1a10', name, {
        isExterior: false,
        isSiteExit: true,
        ...options
    });
}

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
