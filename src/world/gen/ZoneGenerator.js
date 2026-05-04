import { ZoneCanvas } from './ZoneCanvas.js';
import { ZoneTiles } from './ZoneTiles.js';
import {
    drawBodega,
    drawClinic,
    drawCornerStore,
    drawGasStation,
    drawLaundromat,
    drawPawnShop,
    drawServiceAlley
} from './UrbanFragments.js';

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
        world.pointsOfInterest = [];
        world.extractionPoint = null;

        const rng = mulberry32(world.worldSeed || 12345);
        const canvas = new ZoneCanvas(world, rng);
        const id = world.zoneTemplate?.id || 'safe_hub';

        switch (id) {
            case 'urban_corner_store':
                return generateUrbanCornerBlock(canvas);
            case 'urban_market_corner':
                return generateUrbanMarketCorner(canvas);
            case 'neon_row':
                return generateNeonRow(canvas);
            case 'shopping_strip':
            case 'collapsed_mall':
                return generateDeadMall(canvas);
            case 'kiroshi_hub':
            case 'aurora_clinic':
            case 'old_town_hall':
                return generateCivicComplex(canvas);
            case 'henderson_plant':
            case 'the_yards':
            case 'tank_farm':
            case 'logging_camp':
                return generateIndustrialYard(canvas);
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
            case 'marrow_row':
            case 'safehouse_block':
            case 'the_terraces':
                return generateResidentialBlock(canvas, id);
            case 'wilds':
                return generateEmptyLot(canvas);
            case 'safe_hub':
            default:
                return world.zoneTemplate ? generateEmptyLot(canvas) : generateSafeHub(canvas);
        }
    }
}

function generateSafeHub(z) {
    z.fill(ZoneTiles.grass);
    z.fillRect(0, Math.floor(z.height / 2) - 3, z.width, 7, ZoneTiles.road);
    z.fillRect(Math.floor(z.width / 2) - 3, 0, 7, z.height, ZoneTiles.road);
    z.sidewalkAroundRoad(0, Math.floor(z.height / 2) - 6, z.width - 1, Math.floor(z.height / 2) + 6, [
        { x: 0, y: Math.floor(z.height / 2) - 3, w: z.width, h: 7 },
        { x: Math.floor(z.width / 2) - 3, y: 0, w: 7, h: z.height }
    ]);

    z.drawRect(10, 10, 22, 16, ZoneTiles.wall, ZoneTiles.storeFloor, 'Downstairs Commons');
    z.placeDoor('wood_basic', 21, 25, { name: 'Commons Door' });
    z.placeFurniture('table', 18, 17, 'commercial_store', 'Shared Table');
    z.placeFurniture('chair', 17, 17, 'commercial_store', 'Mismatched Chair');
    z.placeFurniture('chair', 20, 17, 'commercial_store', 'Mismatched Chair');
    z.placeFurniture('cabinet', 28, 14, 'commercial_store', 'Community Cabinet');
    z.addPoi('downstairs_commons', 'Downstairs Commons', 'settlement', 21, 18, 8);

    z.drawRect(48, 46, 22, 18, ZoneTiles.wall, ZoneTiles.garageFloor, 'Clinic Workshop');
    z.placeDoor('wood_basic', 58, 46, { name: 'Workshop Door' });
    z.placeFurniture('workbench', 62, 54, 'garage_tools', 'Patchwork Bench');
    z.placeFurniture('cabinet', 52, 54, 'medical_storage', 'Medical Cabinet');
    z.addPoi('clinic_workshop', 'Clinic Workshop', 'settlement', 59, 55, 8);

    const rook = z.addNpc('survivor', 35, 35, 'Rook', '!', '#ffcc44');
    rook.questId = 'streetkid_rations';
    rook.questRole = 'giver';
    rook.questDialogue = {
        offer: `"You're up. Inez is holding a ration bundle for us at the market corner. Roads shifted again, so keep your eyes open. Bring it back and we eat tonight."`,
        remind: `"Market corner, bodega counter. Ask around if you need to, but don't come back empty."`,
        complete: `"That's it. Good. You kept the crew fed one more day."`
    };
    z.addNpc('survivor', 50, 40, 'Scavenger', '@', '#aaffaa');
    z.world.spawnPoint = { x: 40, y: 40 };
}

function generateUrbanCornerBlock(z) {
    z.fill(ZoneTiles.asphalt);
    const eastRoad = { x: 72, y: 0, w: 11, h: z.height };
    const crossRoad = { x: 0, y: 58, w: z.width, h: 11 };
    const southRoad = { x: 0, y: z.height - 18, w: z.width, h: 8 };
    z.fillRect(eastRoad.x, eastRoad.y, eastRoad.w, eastRoad.h, ZoneTiles.road);
    z.fillRect(crossRoad.x, crossRoad.y, crossRoad.w, crossRoad.h, ZoneTiles.road);
    z.fillRect(southRoad.x, southRoad.y, southRoad.w, southRoad.h, ZoneTiles.road);
    z.sidewalkAroundRoad(0, 54, z.width - 1, 72, [eastRoad, crossRoad]);
    z.sidewalkAroundRoad(68, 0, 86, z.height - 1, [eastRoad, crossRoad, southRoad]);
    z.fillRect(12, 14, 60, 48, ZoneTiles.sidewalk);
    z.fillRect(86, 12, 38, 44, ZoneTiles.sidewalk);
    z.fillRect(8, 74, 56, 36, ZoneTiles.sidewalk);
    z.fillRect(84, 74, 40, 34, ZoneTiles.sidewalk);

    for (let x = 4; x < z.width - 4; x += 6) {
        z.set(x, 62, ZoneTiles.lanePaint);
        z.set(x, 64, ZoneTiles.lanePaint);
    }
    for (let y = 4; y < z.height - 4; y += 6) {
        z.set(76, y, ZoneTiles.lanePaint);
        z.set(78, y, ZoneTiles.lanePaint);
    }

    drawCornerStore(z, 18, 17);
    drawGasStation(z, 91, 16);
    drawLaundromat(z, 14, 77);
    drawPawnShop(z, 88, 78);
    drawServiceAlley(z, 69, 18, 33);

    z.placeSign(78, 72, 'Crooked Street Sign');
    z.addNpc('drifter', 79, 71, 'Intersection Watcher', 'w', '#d8d0a0');
    z.world.spawnPoint = { x: 64, y: 72 };
}

function generateUrbanMarketCorner(z) {
    z.fill(ZoneTiles.asphalt);
    const verticalRoad = { x: 40, y: 0, w: 10, h: z.height };
    const horizontalRoad = { x: 0, y: 74, w: z.width, h: 10 };
    z.fillRect(verticalRoad.x, verticalRoad.y, verticalRoad.w, verticalRoad.h, ZoneTiles.road);
    z.fillRect(horizontalRoad.x, horizontalRoad.y, horizontalRoad.w, horizontalRoad.h, ZoneTiles.road);
    z.sidewalkAroundRoad(34, 0, 55, z.height - 1, [verticalRoad, horizontalRoad]);
    z.sidewalkAroundRoad(0, 68, z.width - 1, 89, [verticalRoad, horizontalRoad]);

    z.fillRect(58, 12, 62, 48, ZoneTiles.sidewalk);
    z.fillRect(6, 12, 30, 42, ZoneTiles.sidewalk);
    z.fillRect(8, 92, 48, 30, ZoneTiles.sidewalk);
    z.fillRect(70, 92, 48, 30, ZoneTiles.sidewalk);

    for (let y = 5; y < z.height - 5; y += 6) {
        z.set(44, y, ZoneTiles.lanePaint);
    }
    for (let x = 5; x < z.width - 5; x += 6) {
        z.set(x, 78, ZoneTiles.lanePaint);
    }

    drawBodega(z, 7, 18, { idPrefix: 'west_bodega', name: 'West Bodega', clerkName: 'Inez, Bodega Clerk' });
    z.placeItem({
        id: 'crew_rations',
        familyId: 'crew_rations',
        name: 'Crew Ration Bundle',
        type: 'quest_item',
        glyph: '%',
        color: '#ffaa44',
        weight: 900,
        volume: 1200,
        stackable: false,
        description: 'A wrapped bundle of sealed cans, water, and old protein bars marked for Rook.'
    }, 18, 37);
    drawClinic(z, 63, 18, { idPrefix: 'street_clinic', name: 'Street Clinic' });
    drawGasStation(z, 88, 58, { idPrefix: 'mini_gas', attendantName: 'Patch, Pump Watcher' });
    drawLaundromat(z, 10, 94, { idPrefix: 'south_laundry' });
    drawPawnShop(z, 76, 94, { idPrefix: 'south_pawn' });
    drawServiceAlley(z, 56, 16, 40, { idPrefix: 'market_alley' });

    z.placeSign(46, 87, 'Bus Stop Marker');
    z.placeFurniture('chair', 32, 88, 'commercial_store', 'Bus Stop Bench');
    z.placeFurniture('chair', 35, 88, 'commercial_store', 'Bus Stop Bench');
    z.addPoi('bus_stop', 'Bus Stop', 'transit', 34, 88, 5);
    z.addNpc('drifter', 47, 86, 'Bus Stop Prophet', 'p', '#d8d0a0');
    z.world.spawnPoint = { x: 60, y: 86 };
}

function generateNeonRow(z) {
    z.fill(ZoneTiles.neonFloor);
    z.fillRect(0, Math.floor(z.height / 2) - 5, z.width, 10, ZoneTiles.road);
    z.sidewalkAroundRoad(0, Math.floor(z.height / 2) - 10, z.width - 1, Math.floor(z.height / 2) + 10, [
        { x: 0, y: Math.floor(z.height / 2) - 5, w: z.width, h: 10 }
    ]);

    for (let x = 4; x < z.width - 4; x += 7) {
        z.set(x, Math.floor(z.height / 2), ZoneTiles.lanePaint);
    }

    drawBodega(z, 4, 5, { idPrefix: 'neon_food', name: 'Neon Food Stall', clerkName: 'Vex, Stall Clerk' });
    drawPawnShop(z, 43, 5, { idPrefix: 'neon_parts', name: 'Parts Cage' });
    z.drawRect(8, 42, 28, 14, ZoneTiles.wall, ZoneTiles.neonFloor, 'Glow Bar');
    z.placeDoor('glass', 21, 42, { name: 'Glow Bar Door' });
    z.placeFurniture('counter', 13, 49, 'commercial_store', 'Lit Bar Counter');
    z.placeFurniture('table', 28, 49, 'commercial_store', 'Sticky Table');
    z.placeSign(38, 31, 'Buzzing Neon Sign');
    z.addNpc('survivor', 38, 34, 'Fixer in Pink Glasses', 'f', '#ff66cc');
    z.addPoi('neon_row_market', 'Neon Row Market', 'trade', Math.floor(z.width / 2), 22, 14);
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: Math.floor(z.height / 2) + 8 };
}

function generateDeadMall(z) {
    z.fill(ZoneTiles.parking);
    z.fillRect(4, z.height - 18, z.width - 8, 12, ZoneTiles.parking);
    for (let x = 8; x < z.width - 8; x += 8) z.vLine(x, z.height - 17, 10, ZoneTiles.lanePaint);

    const mallX = 8;
    const mallY = 8;
    const mallW = Math.max(60, z.width - 16);
    const mallH = Math.max(48, z.height - 34);
    z.drawRect(mallX, mallY, mallW, mallH, ZoneTiles.wall, ZoneTiles.mallFloor, 'Dead Mall Concourse');
    z.placeDoor('glass', mallX + Math.floor(mallW / 2), mallY + mallH - 1, { name: 'Mall Entrance' });
    z.hLine(mallX + 8, mallY + mallH - 1, 12, ZoneTiles.glass, { name: 'Mallfront Glass' });
    z.hLine(mallX + mallW - 22, mallY + mallH - 1, 12, ZoneTiles.glass, { name: 'Mallfront Glass' });

    const midY = mallY + Math.floor(mallH / 2);
    z.hLine(mallX + 2, midY, mallW - 4, ZoneTiles.mallFloor, { name: 'Main Concourse' });
    z.vLine(mallX + Math.floor(mallW / 2), mallY + 2, mallH - 4, ZoneTiles.mallFloor, { name: 'Cross Concourse' });

    for (let i = 0; i < 3; i++) {
        const shopX = mallX + 4 + i * 18;
        z.drawRect(shopX, mallY + 4, 14, 13, ZoneTiles.wall, ZoneTiles.storeFloor, `Shuttered Shop ${i + 1}`);
        z.placeDoor('metal', shopX + 6, mallY + 16, { name: 'Bent Security Shutter' });
        z.placeFurniture('shelf', shopX + 4, mallY + 8, 'commercial_store', 'Picked-Over Display');
    }
    for (let i = 0; i < 3; i++) {
        const shopX = mallX + 4 + i * 18;
        z.drawRect(shopX, midY + 5, 14, 13, ZoneTiles.wall, ZoneTiles.stockFloor, `Back Shop ${i + 1}`);
        z.placeDoor('metal', shopX + 6, midY + 5, { name: 'Service Shutter' });
        z.placeFurniture('crate', shopX + 4, midY + 11, 'commercial_backroom', 'Collapsed Stock Crate');
    }

    z.scatter(ZoneTiles.rubble, 45, (tile) => !tile.blocked && !tile.worldObjectId);
    z.addNpc('ganger', mallX + mallW - 18, midY, 'Mall Lookout', 'l', '#d06a5f');
    z.addNpc('brute', mallX + mallW - 12, midY + 5, 'Food Court Heavy', 'B', '#ff7766');
    z.addPoi('dead_mall_concourse', 'Dead Mall Concourse', 'mall', mallX + Math.floor(mallW / 2), midY, 18);
    z.world.spawnPoint = { x: mallX + Math.floor(mallW / 2), y: mallY + mallH - 6 };
}

function generateCivicComplex(z) {
    z.fill(ZoneTiles.concrete);
    z.fillRect(0, z.height - 16, z.width, 9, ZoneTiles.road);
    z.sidewalkAroundRoad(0, z.height - 22, z.width - 1, z.height - 1, [
        { x: 0, y: z.height - 16, w: z.width, h: 9 }
    ]);

    const x = Math.max(6, Math.floor(z.width * 0.18));
    const y = 8;
    const w = Math.min(z.width - x - 6, 58);
    const h = Math.min(z.height - 32, 76);
    z.drawRect(x, y, w, h, ZoneTiles.wall, ZoneTiles.officeFloor, z.world.zoneTemplate?.name || 'Civic Complex');
    z.placeDoor('glass', x + Math.floor(w / 2), y + h - 1, { name: 'Main Lobby Door' });
    z.hLine(x + 8, y + h - 1, 10, ZoneTiles.glass, { name: 'Lobby Window' });
    z.hLine(x + w - 18, y + h - 1, 10, ZoneTiles.glass, { name: 'Lobby Window' });

    z.drawRect(x + 4, y + 5, 18, 14, ZoneTiles.wall, ZoneTiles.officeFloor, 'Records Office');
    z.drawRect(x + w - 24, y + 5, 18, 14, ZoneTiles.wall, ZoneTiles.bathroomFloor, 'Triage Room');
    z.drawRect(x + 4, y + h - 25, 20, 16, ZoneTiles.wall, ZoneTiles.metalFloor, 'Server Closet');
    z.placeDoor('wood_basic', x + 12, y + 18, { name: 'Records Door' });
    z.placeDoor('wood_basic', x + w - 16, y + 18, { name: 'Triage Door' });
    z.placeDoor('metal', x + 14, y + h - 25, { name: 'Server Closet Door', locked: true });
    z.placeFurniture('filing_cabinet', x + 10, y + 10, 'office', 'Records Cabinet');
    z.placeFurniture('terminal', x + 12, y + h - 18, 'technical', 'Active Terminal');
    z.placeFurniture('cabinet', x + w - 17, y + 10, 'medical_storage', 'Supply Cabinet');
    z.placeFurniture('counter', x + Math.floor(w / 2) - 4, y + h - 8, 'office', 'Reception Counter');
    z.addNpc('survivor', x + Math.floor(w / 2), y + h - 10, 'Desk Survivor', '@', '#9fd8ff');
    z.addPoi('civic_lobby', 'Civic Lobby', 'civic', x + Math.floor(w / 2), y + h - 12, 12);
    z.world.spawnPoint = { x: x + Math.floor(w / 2), y: z.height - 20 };
}

function generateIndustrialYard(z) {
    z.fill(ZoneTiles.concrete);
    z.fillRect(0, z.height - 14, z.width, 9, ZoneTiles.road);
    for (let x = 5; x < z.width - 5; x += 7) z.set(x, z.height - 10, ZoneTiles.lanePaint);

    z.drawRect(8, 10, Math.min(46, z.width - 16), 30, ZoneTiles.wall, ZoneTiles.metalFloor, 'Machine Hall');
    z.placeDoor('metal', 28, 39, { name: 'Roll-Up Door' });
    for (let x = 14; x < Math.min(48, z.width - 14); x += 8) {
        z.placeFurniture('workbench', x, 22, 'garage_tools', 'Machine Bench');
        z.set(x, 26, ZoneTiles.pipe);
    }

    const yardX = Math.min(62, Math.max(12, z.width - 48));
    z.fillRect(yardX, 12, Math.min(36, z.width - yardX - 6), 42, ZoneTiles.parking, { name: 'Scrap Yard' });
    for (let i = 0; i < 16; i++) {
        const x = yardX + 2 + Math.floor(z.rng() * Math.max(4, Math.min(32, z.width - yardX - 10)));
        const y = 15 + Math.floor(z.rng() * 34);
        z.set(x, y, i % 3 === 0 ? ZoneTiles.pipe : ZoneTiles.rubble);
    }
    for (let y = 12; y < 55; y += 4) {
        z.set(yardX - 1, y, ZoneTiles.fence);
        z.set(Math.min(z.width - 7, yardX + 36), y, ZoneTiles.fence);
    }

    z.placeFurniture('locker', 14, 33, 'garage_tools', 'Tool Locker');
    z.placeFurniture('crate', yardX + 8, 49, 'commercial_backroom', 'Salvage Crate');
    z.addNpc('scavenger', yardX + 12, 42, 'Yard Picker', 's', '#c8b080');
    z.addNpc('scavenger', 22, 25, 'Plant Hand', 'h', '#c8b080');
    z.addPoi('machine_hall', 'Machine Hall', 'industrial', 28, 25, 12);
    z.addPoi('scrap_yard', 'Scrap Yard', 'salvage', yardX + 18, 34, 16);
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: z.height - 20 };
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
            z.addNpc('ganger', Math.floor(z.width / 2) + 16, Math.floor(z.height / 2) + 2, 'Bridge Tollhand', 't', '#d06a5f');
        }
        z.addPoi('bridge_crossing', 'Bridge Crossing', 'travel', Math.floor(z.width / 2), Math.floor(z.height / 2), 14);
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
            z.addNpc('scavenger', 28, 54, 'Dock Salvager', 's', '#c8b080');
        } else if (id === 'flooded_camp') {
            z.drawRect(14, 52, 20, 14, ZoneTiles.wall, ZoneTiles.stockFloor, 'Flooded Camp Shack');
            z.placeDoor('wood_basic', 24, 52, { name: 'Swollen Shack Door' });
            z.placeFurniture('crate', 21, 60, 'commercial_backroom', 'Damp Supply Crate');
        }
        z.scatter(ZoneTiles.brush, 25, (tile, x, y) => y > Math.floor(z.height * 0.45) && !tile.blocked);
        z.addPoi('shoreline', 'Shoreline', 'water', Math.floor(z.width / 2), Math.floor(z.height * 0.42), 16);
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
        z.addNpc('scavenger', cx + 5, cy + 2, 'Wreck Diver', 'd', '#c8b080');
        z.addPoi('wreck_marker', 'Half-Sunk Wreck', 'salvage', cx, cy, 12);
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
    z.addNpc('drifter', Math.floor(z.width / 2), Math.floor(z.height / 2), 'Trail Drifter', 'd', '#c9c0a8');
    z.addPoi('green_zone', z.world.zoneTemplate?.name || 'Green Zone', 'wild', Math.floor(z.width / 2), Math.floor(z.height / 2), 18);
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: z.height - 10 };
}

function generateResidentialBlock(z, id) {
    z.fill(ZoneTiles.grass);
    z.fillRect(0, Math.floor(z.height / 2) - 4, z.width, 8, ZoneTiles.road);
    z.sidewalkAroundRoad(0, Math.floor(z.height / 2) - 9, z.width - 1, Math.floor(z.height / 2) + 9, [
        { x: 0, y: Math.floor(z.height / 2) - 4, w: z.width, h: 8 }
    ]);

    const houses = [
        { x: 8, y: 10, w: 24, h: 18, name: 'Row House' },
        { x: 40, y: 10, w: 24, h: 18, name: 'Boarded Duplex' },
        { x: 8, y: Math.floor(z.height / 2) + 14, w: 24, h: 18, name: 'Crew House' },
        { x: 40, y: Math.floor(z.height / 2) + 14, w: 24, h: 18, name: 'Empty Flat' }
    ];
    for (const house of houses) {
        if (house.x + house.w >= z.width || house.y + house.h >= z.height) continue;
        z.drawRect(house.x, house.y, house.w, house.h, ZoneTiles.wall, ZoneTiles.breakFloor, house.name);
        z.placeDoor('wood_basic', house.x + Math.floor(house.w / 2), house.y + house.h - 1, { name: `${house.name} Door` });
        z.placeFurniture('bed', house.x + 5, house.y + 6, 'residential_bedroom', 'Thin Mattress');
        z.placeFurniture('cabinet', house.x + house.w - 6, house.y + 6, 'residential_kitchen', 'Kitchen Cabinet');
    }
    if (id === 'safehouse_block') {
        z.addNpc('survivor', 20, Math.floor(z.height / 2) + 21, 'Safehouse Quartermaster', 'q', '#ffcc88');
        z.addPoi('safehouse', 'Safehouse', 'settlement', 20, Math.floor(z.height / 2) + 21, 8);
    } else {
        z.addNpc('scavenger', 54, 20, 'Porch Scavenger', 's', '#c8b080');
        z.addPoi('residential_block', z.world.zoneTemplate?.name || 'Residential Block', 'residential', Math.floor(z.width / 2), Math.floor(z.height / 2), 18);
    }
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: Math.floor(z.height / 2) + 8 };
}

function generateEmptyLot(z) {
    z.fill(ZoneTiles.asphalt);
    z.fillRect(0, z.height - 14, z.width, 8, ZoneTiles.road);
    z.scatter(ZoneTiles.rubble, 35, (tile) => !tile.blocked && !tile.worldObjectId);
    z.scatter(ZoneTiles.brush, 25, (tile) => !tile.blocked && !tile.worldObjectId);
    z.placeSign(Math.floor(z.width / 2), z.height - 18, z.world.zoneTemplate?.name || 'Empty Lot');
    z.addPoi('empty_lot', z.world.zoneTemplate?.name || 'Empty Lot', 'exterior', Math.floor(z.width / 2), Math.floor(z.height / 2), 16);
    z.world.spawnPoint = { x: Math.floor(z.width / 2), y: z.height - 10 };
}
