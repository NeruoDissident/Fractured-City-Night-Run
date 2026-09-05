import { ZoneCanvas } from './ZoneCanvas.js';
import { generateSite } from './InteriorGenerator.js';
import { getSiteProfile } from '../../content/SiteCatalog.js';
import { ZoneTiles } from './ZoneTiles.js';

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

export class ZoneGenerator {
    static generate(world) {
        world.entities = [];
        world.items = [];
        world.worldObjects = [];
        world.extractionPoint = null;
        world.isInterior = false;
        world.siteName = null;
        world.siteExit = null;
        world.spawnFacing = null;
        world.staticLights = [];

        const rng = mulberry32(world.worldSeed || 12345);
        const id = world.zoneTemplate?.id || 'safe_hub';

        // Interior sites own their own footprint, which is much smaller than a
        // street zone so a floor stays learnable in first person.
        const site = getSiteProfile(id);
        if (site) {
            world.zoneWidth = site.width;
            world.zoneHeight = site.height;
            world.zoneBounds = {
                minCx: 0,
                maxCx: Math.ceil(site.width / world.chunkSize) - 1,
                minCy: 0,
                maxCy: Math.ceil(site.height / world.chunkSize) - 1
            };
            return generateSite(new ZoneCanvas(world, rng), site);
        }

        const canvas = new ZoneCanvas(world, rng);

        // Street blocks, buildings, and slices all have site profiles now (see
        // SiteCatalog). What is left here is the hub, the few open-ground
        // zones the debug region map can still drop into, and the fallback.
        switch (id) {
            case 'open_water':
            case 'wreck_marker':
            case 'lake_shore':
            case 'flooded_camp':
            case 'river_crossing':
            case 'toll_bridge':
            case 'coastal_road':
            case 'marina_ruins':
                return generateWaterfront(canvas, id);
            case 'overgrown_park':
            case 'abandoned_farm':
            case 'greenhold':
            case 'highway_overlook':
                return generateGreenZone(canvas, id);
            case 'wilds':
                return generateEmptyLot(canvas);
            case 'safe_hub':
                return generateSafeHub(canvas);
            default:
                return world.zoneTemplate ? generateEmptyLot(canvas) : generateSafeHub(canvas);
        }
    }
}

function generateSafeHub(z) {
    z.fill(ZoneTiles.grass);
    z.fillRect(0, 37, z.width, 7, ZoneTiles.road);
    z.fillRect(37, 0, 7, z.height, ZoneTiles.road);

    z.fillRect(8, 8, 64, 64, ZoneTiles.dirt, { name: 'Downstairs Yard' });
    z.fillRect(36, 8, 8, 64, ZoneTiles.concrete, { name: 'Main Walk' });
    z.fillRect(8, 36, 64, 8, ZoneTiles.concrete, { name: 'Main Walk' });

    z.hLine(8, 8, 64, ZoneTiles.fence, { name: 'Downstairs Fence' });
    z.hLine(8, 71, 64, ZoneTiles.fence, { name: 'Downstairs Fence' });
    z.vLine(8, 8, 64, ZoneTiles.fence, { name: 'Downstairs Fence' });
    z.vLine(71, 8, 64, ZoneTiles.fence, { name: 'Downstairs Fence' });
    z.fillRect(37, 8, 7, 1, ZoneTiles.concrete, { name: 'North Gate' });
    z.fillRect(37, 71, 7, 1, ZoneTiles.concrete, { name: 'South Gate' });
    z.fillRect(8, 37, 1, 7, ZoneTiles.concrete, { name: 'West Gate' });
    z.fillRect(71, 37, 1, 7, ZoneTiles.concrete, { name: 'East Gate' });
    for (const [x, y] of [[34, 9], [45, 9], [34, 70], [45, 70], [9, 34], [9, 45], [70, 34], [70, 45]]) {
        z.set(x, y, ZoneTiles.barricade);
    }

    z.drawRect(12, 12, 24, 18, ZoneTiles.wall, ZoneTiles.storeFloor, 'Downstairs Commons');
    z.placeDoor('wood_basic', 24, 29, { name: 'Commons Door' });
    z.placeFurniture('table', 20, 20, 'commercial_store', 'Shared Table');
    z.placeFurniture('table', 25, 20, 'commercial_store', 'Shared Table');
    z.placeFurniture('chair', 19, 20, 'commercial_store', 'Mismatched Chair');
    z.placeFurniture('chair', 26, 20, 'commercial_store', 'Mismatched Chair');
    z.placeFurniture('cabinet', 32, 15, 'commercial_store', 'Community Cabinet');
    z.placeFurniture('filing_cabinet', 15, 15, 'office', 'Notice Board');
    // The crew stash: persistent storage that is yours, never looted by the
    // generator. Big enough to bank a run's haul.
    z.placeFurniture('stash', 28, 15, 'hub', 'Crew Stash');

    z.drawRect(46, 12, 20, 18, ZoneTiles.wall, ZoneTiles.breakFloor, 'Crew Bunks');
    z.placeDoor('wood_basic', 56, 29, { name: 'Bunkroom Door', open: true });
    for (const [x, y] of [[50, 17], [57, 17], [50, 23], [57, 23]]) {
        z.placeFurniture('bed', x, y, 'residential_bedroom', 'Thin Bunk');
    }
    z.placeFurniture('locker', 63, 17, 'residential_bedroom', 'Crew Locker');

    z.drawRect(12, 50, 22, 16, ZoneTiles.wall, ZoneTiles.stockFloor, 'Food Cage');
    z.placeDoor('metal', 23, 50, { name: 'Food Cage Door', locked: true });
    z.placeFurniture('crate', 18, 58, 'commercial_backroom', 'Ration Crate');
    z.placeFurniture('shelf', 28, 57, 'commercial_backroom', 'Dry Shelf');

    z.drawRect(48, 48, 20, 18, ZoneTiles.wall, ZoneTiles.garageFloor, 'Clinic Workshop');
    z.placeDoor('wood_basic', 58, 48, { name: 'Workshop Door' });
    z.placeFurniture('workbench', 62, 56, 'garage_tools', 'Patchwork Bench');
    z.placeFurniture('cabinet', 52, 56, 'medical_storage', 'Medical Cabinet');
    z.placeFurniture('sink', 52, 61, 'medical_storage', 'Wash Basin');

    z.fillRect(14, 33, 16, 10, ZoneTiles.dirt, { name: 'Planter Beds' });
    for (let x = 15; x < 29; x += 3) z.vLine(x, 34, 8, ZoneTiles.grass, { name: 'Planter Row' });
    z.fillRect(52, 34, 12, 8, ZoneTiles.parking, { name: 'Repair Pad' });
    z.placeFurniture('crate', 54, 37, 'garage_tools', 'Parts Crate');
    z.placeFurniture('workbench', 61, 38, 'garage_tools', 'Outdoor Workbench');

    // Baked light so the hub reads in first person at any hour: a lamp in
    // each shack and work lights on the yard's main walk and gates.
    const warm = '#ffcf8a';
    const lights = [
        { x: 24, y: 20, radius: 9, intensity: 0.85, color: warm },  // Commons
        { x: 56, y: 20, radius: 9, intensity: 0.7, color: '#d9c7a8' }, // Bunks
        { x: 23, y: 58, radius: 8, intensity: 0.6, color: '#cfe8ff' }, // Food Cage
        { x: 58, y: 57, radius: 9, intensity: 0.8, color: '#e8f4ff' }, // Workshop
        { x: 40, y: 20, radius: 7, intensity: 0.7, color: warm },   // Main Walk N
        { x: 40, y: 40, radius: 7, intensity: 0.7, color: warm },   // Crossing
        { x: 40, y: 60, radius: 7, intensity: 0.7, color: warm },   // Main Walk S
        { x: 20, y: 40, radius: 6, intensity: 0.6, color: warm },   // West walk
        { x: 60, y: 40, radius: 6, intensity: 0.6, color: warm },   // East walk
        { x: 40, y: 70, radius: 5, intensity: 0.8, color: '#a8ffc0' }, // South Gate
        { x: 40, y: 9, radius: 5, intensity: 0.8, color: '#a8ffc0' },  // North Gate
        { x: 9, y: 40, radius: 5, intensity: 0.8, color: '#a8ffc0' },  // West Gate
        { x: 70, y: 40, radius: 5, intensity: 0.8, color: '#a8ffc0' }  // East Gate
    ];
    z.world.staticLights = lights.map(l => ({ ...l, z: 0 }));

    // You arrive at the South Gate looking up the Main Walk, whichever way
    // you travelled here. Edge transitions override this with the edge.
    z.world.spawnPoint = { x: 40, y: 68 };
    z.world.spawnFacing = 'north';
}

function generateWaterfront(z, id) {
    const shoreIds = new Set(['lake_shore', 'flooded_camp', 'coastal_road', 'marina_ruins']);
    const bridgeIds = new Set(['river_crossing', 'toll_bridge']);

    if (bridgeIds.has(id)) {
        z.fill(ZoneTiles.water);
        z.fillRect(0, Math.floor(z.height / 2) - 4, z.width, 8, ZoneTiles.dock, { name: 'Bridge Deck' });
        z.fillRect(Math.floor(z.width / 2) - 7, 0, 14, z.height, ZoneTiles.road);
        for (let y = 4; y < z.height - 4; y += 6) z.set(Math.floor(z.width / 2), y, ZoneTiles.lanePaint);
        z.placeSign(Math.floor(z.width / 2) + 9, Math.floor(z.height / 2) - 8, id === 'toll_bridge' ? 'Toll Warning Sign' : 'River Crossing Sign');
        if (id === 'toll_bridge') {
            z.placeFurniture('crate', Math.floor(z.width / 2) + 12, Math.floor(z.height / 2), 'commercial_backroom', 'Toll Barricade');
        }
        z.world.spawnPoint = { x: Math.floor(z.width / 2), y: z.height - 10 };
        return;
    }

    if (shoreIds.has(id)) {
        z.fill(ZoneTiles.sand);
        z.fillRect(0, 0, z.width, Math.floor(z.height * 0.42), ZoneTiles.water);
        z.fillRect(0, Math.floor(z.height * 0.42), z.width, 4, ZoneTiles.mud);
        if (id === 'coastal_road') z.fillRect(0, z.height - 18, z.width, 9, ZoneTiles.road);
        if (id === 'marina_ruins') {
            for (let x = 10; x < z.width - 12; x += 18) z.vLine(x, 18, 30, ZoneTiles.dock, { name: 'Broken Dock' });
            z.placeFurniture('crate', 22, 52, 'commercial_backroom', 'Waterlogged Crate');
        } else if (id === 'flooded_camp') {
            z.drawRect(14, 52, 20, 14, ZoneTiles.wall, ZoneTiles.stockFloor, 'Flooded Camp Shack');
            z.placeDoor('wood_basic', 24, 52, { name: 'Swollen Shack Door' });
            z.placeFurniture('crate', 21, 60, 'commercial_backroom', 'Damp Supply Crate');
        }
        z.scatter(ZoneTiles.brush, 25, (tile, x, y) => y > Math.floor(z.height * 0.45) && !tile.blocked);
        z.world.spawnPoint = { x: Math.floor(z.width / 2), y: z.height - 10 };
        return;
    }

    z.fill(ZoneTiles.water);
    if (id === 'wreck_marker') {
        const cx = Math.floor(z.width / 2);
        const cy = Math.floor(z.height / 2);
        z.fillRect(cx - 12, cy - 4, 24, 8, ZoneTiles.dock, { name: 'Half-Sunk Wreck' });
        z.set(cx - 14, cy, ZoneTiles.rubble);
        z.set(cx + 14, cy, ZoneTiles.rubble);
        z.placeFurniture('crate', cx, cy, 'commercial_backroom', 'Sealed Salvage Box');
        z.world.spawnPoint = { x: cx, y: cy + 8 };
        return;
    }
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: Math.floor(z.height / 2) };
}

function generateGreenZone(z, id) {
    z.fill(id === 'abandoned_farm' ? ZoneTiles.dirt : ZoneTiles.grass);
    if (id === 'highway_overlook') {
        z.fillRect(0, Math.floor(z.height / 2) - 5, z.width, 10, ZoneTiles.road);
        z.fillRect(0, Math.floor(z.height / 2) + 6, z.width, 5, ZoneTiles.concrete, { name: 'Overlook Shoulder' });
        z.placeSign(12, Math.floor(z.height / 2) + 12, 'Overlook Sign');
    } else if (id === 'abandoned_farm') {
        z.drawRect(14, 16, 28, 22, ZoneTiles.wall, ZoneTiles.stockFloor, 'Old Farmhouse');
        z.placeDoor('wood_basic', 27, 37, { name: 'Farmhouse Door' });
        z.drawRect(58, 18, 24, 20, ZoneTiles.wall, ZoneTiles.dirt, 'Sagging Barn');
        z.placeDoor('wood_basic', 69, 37, { name: 'Barn Door' });
        for (let y = 52; y < z.height - 8; y += 4) z.hLine(10, y, z.width - 20, ZoneTiles.mud, { name: 'Old Crop Row' });
    } else {
        const pondY = Math.floor(z.height * 0.35);
        z.fillRect(Math.floor(z.width * 0.55), pondY, Math.floor(z.width * 0.25), 10, ZoneTiles.water);
        z.fillRect(Math.floor(z.width * 0.55), pondY + 10, Math.floor(z.width * 0.25), 3, ZoneTiles.mud);
    }

    z.scatter(ZoneTiles.tree, 35, (tile) => !tile.blocked && !tile.worldObjectId);
    z.scatter(ZoneTiles.brush, 50, (tile) => !tile.blocked && !tile.worldObjectId);
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: z.height - 10 };
}

function generateEmptyLot(z) {
    z.fill(ZoneTiles.asphalt);
    z.fillRect(0, z.height - 14, z.width, 8, ZoneTiles.road);
    z.scatter(ZoneTiles.rubble, 35, (tile) => !tile.blocked && !tile.worldObjectId);
    z.scatter(ZoneTiles.brush, 25, (tile) => !tile.blocked && !tile.worldObjectId);
    z.placeSign(Math.floor(z.width / 2), z.height - 18, z.world.zoneTemplate?.name || 'Empty Lot');
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: z.height - 10 };
}
