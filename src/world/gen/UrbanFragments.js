import { ZoneTiles, tile } from './ZoneTiles.js';

export function drawCornerStore(z, x, y, options = {}) {
    const name = options.name || 'Corner Store';
    z.drawRect(x, y, 48, 36, ZoneTiles.wall, ZoneTiles.storeFloor, name);
    z.hLine(x + 7, y + 35, 12, ZoneTiles.glass, { name: `${name} Window` });
    z.hLine(x + 28, y + 35, 12, ZoneTiles.glass, { name: `${name} Window` });
    z.placeDoor('glass', x + 23, y + 35, { name: `${name} Front Door` });

    for (const ay of [y + 6, y + 10, y + 14]) {
        for (const ax of [x + 8, x + 9, x + 20, x + 21, x + 32, x + 33]) {
            z.placeFurniture('shelf', ax, ay, 'commercial_store', 'Grocery Shelf');
        }
    }
    z.placeFurniture('shelf', x + 41, y + 6, 'commercial_store', 'Medicine Shelf');
    z.placeFurniture('shelf', x + 41, y + 10, 'commercial_store', 'Battery Shelf');
    z.placeFurniture('shelf', x + 41, y + 14, 'commercial_store', 'Snack Shelf');

    for (let cx = x + 6; cx <= x + 16; cx++) {
        z.placeFurniture('counter', cx, y + 30, 'commercial_store', 'Checkout Counter');
    }
    z.placeFurniture('terminal', x + 8, y + 29, 'commercial_store', 'Dead Register Terminal');
    z.placeFurniture('cabinet', x + 16, y + 29, 'commercial_store', 'Cigarette Cabinet');
    z.addPoi(`${options.idPrefix || 'corner_store'}_sales`, `${name} Sales Floor`, 'shop', x + 27, y + 12, 11);

    z.drawRect(x + 3, y + 22, 10, 9, ZoneTiles.wall, ZoneTiles.bathroomFloor, 'Employee Bathroom');
    z.drawRect(x + 16, y + 22, 14, 9, ZoneTiles.wall, ZoneTiles.breakFloor, 'Break Room');
    z.placeDoor('wood_basic', x + 7, y + 22, { name: 'Bathroom Door' });
    z.placeDoor('wood_basic', x + 22, y + 22, { name: 'Break Room Door', open: true });
    z.placeFurniture('toilet', x + 5, y + 26, 'residential_bathroom', 'Employee Toilet');
    z.placeFurniture('sink', x + 10, y + 26, 'residential_bathroom', 'Grimy Sink');
    z.placeFurniture('table', x + 20, y + 26, 'residential_kitchen', 'Break Table');
    z.placeFurniture('chair', x + 19, y + 26, 'residential_kitchen', 'Plastic Chair');
    z.placeFurniture('chair', x + 23, y + 26, 'residential_kitchen', 'Plastic Chair');
    z.placeFurniture('cabinet', x + 27, y + 26, 'residential_kitchen', 'Microwave Cabinet');
    z.addPoi(`${options.idPrefix || 'corner_store'}_bathroom`, 'Employee Bathroom', 'room', x + 8, y + 26, 4);
    z.addPoi(`${options.idPrefix || 'corner_store'}_break_room`, 'Break Room', 'room', x + 23, y + 26, 5);

    z.vLine(x + 31, y + 21, 13, ZoneTiles.wall, { name: 'Stockroom Partition' });
    z.placeDoor('metal', x + 31, y + 25, { name: 'Stockroom Door' });
    for (const sx of [x + 36, x + 40, x + 44]) {
        z.placeFurniture('crate', sx, y + 25, 'commercial_backroom', 'Backroom Crate');
        z.placeFurniture('shelf', sx, y + 30, 'commercial_backroom', 'Stockroom Shelf');
    }
    z.placeFurniture('workbench', x + 44, y + 33, 'garage_tools', 'Improvised Repair Bench');
    z.placeDoor('metal', x + 47, y + 27, { name: 'Alley Service Door', locked: true });
    z.addPoi(`${options.idPrefix || 'corner_store'}_stockroom`, `${name} Stockroom`, 'loot', x + 41, y + 28, 8);

    if (options.npcs !== false) {
        z.addNpc('survivor', x + 9, y + 28, options.clerkName || 'Marta, Corner Clerk', '@', '#8ff0a4');
        z.addNpc('drifter', x + 30, y + 8, 'Coupon Sleeper', 'd', '#c9c0a8');
        z.addNpc('ganger', x + 38, y + 27, 'Backroom Looter', 'l', '#d06a5f');
        z.addNpc('ganger', x + 44, y + 29, 'Backroom Lookout', 'l', '#d06a5f');
    }
}

export function drawGasStation(z, x, y, options = {}) {
    const name = options.name || 'Gas Station Kiosk';
    z.drawRect(x, y, 27, 22, ZoneTiles.wall, ZoneTiles.storeFloor, name);
    z.hLine(x + 5, y + 21, 11, ZoneTiles.glass, { name: 'Kiosk Window' });
    z.placeDoor('glass', x + 19, y + 21, { name: 'Kiosk Door' });
    z.placeFurniture('counter', x + 5, y + 16, 'commercial_store', 'Kiosk Counter');
    z.placeFurniture('terminal', x + 7, y + 15, 'commercial_store', 'Lottery Terminal');
    z.placeFurniture('shelf', x + 17, y + 6, 'commercial_store', 'Oil and Snacks Shelf');
    z.placeFurniture('shelf', x + 17, y + 10, 'commercial_store', 'Oil and Snacks Shelf');
    z.fillRect(x - 3, y + 27, 34, 10, ZoneTiles.canopy);
    for (const px of [x + 3, x + 13, x + 23]) {
        z.placeFurniture('terminal', px, y + 32, 'garage_bay', 'Dead Fuel Pump');
        z.set(px, y + 31, tile('|', '#d0d0c0', '#262318', 'Pump Hose'));
    }
    z.placeSign(x, y + 26, 'Bent Fuel Price Sign');
    z.addPoi(`${options.idPrefix || 'gas'}_kiosk`, name, 'shop', x + 14, y + 12, 8);
    z.addPoi(`${options.idPrefix || 'gas'}_pumps`, 'Fuel Pump Canopy', 'utility', x + 13, y + 32, 8);
    if (options.npcs !== false) {
        z.addNpc('survivor', x + 9, y + 14, options.attendantName || 'Nina, Kiosk Attendant', '@', '#9fd8ff');
    }
}

export function drawLaundromat(z, x, y, options = {}) {
    const name = options.name || 'Coin Laundry';
    z.drawRect(x, y, 44, 28, ZoneTiles.wall, ZoneTiles.storeFloor, name);
    z.placeDoor('glass', x + 20, y, { name: 'Laundry Front Door' });
    z.hLine(x + 5, y, 11, ZoneTiles.glass, { name: 'Laundry Window' });
    z.hLine(x + 28, y, 11, ZoneTiles.glass, { name: 'Laundry Window' });
    for (const wy of [y + 7, y + 11, y + 15]) {
        for (const wx of [x + 7, x + 8, x + 17, x + 18, x + 29, x + 30]) {
            z.placeFurniture('cabinet', wx, wy, 'commercial_store', 'Dead Washer');
        }
    }
    z.placeFurniture('table', x + 35, y + 19, 'commercial_store', 'Folding Table');
    z.placeFurniture('chair', x + 34, y + 20, 'commercial_store', 'Waiting Chair');
    z.placeFurniture('chair', x + 38, y + 20, 'commercial_store', 'Waiting Chair');
    z.placeFurniture('locker', x + 7, y + 22, 'commercial_backroom', 'Lost-and-Found Locker');
    z.addPoi(`${options.idPrefix || 'laundry'}_main`, name, 'shop', x + 23, y + 14, 10);
    if (options.npcs !== false) {
        z.addNpc('drifter', x + 36, y + 18, 'Laundry Sleeper', 'd', '#c9c0a8');
    }
}

export function drawPawnShop(z, x, y, options = {}) {
    const name = options.name || 'Pawn and Repair Shop';
    z.drawRect(x, y, 32, 26, ZoneTiles.wall, ZoneTiles.garageFloor, name);
    z.placeDoor('metal', x + 14, y, { name: 'Pawn Shop Door' });
    z.hLine(x + 4, y, 7, ZoneTiles.glass, { name: 'Barred Pawn Window' });
    z.hLine(x + 20, y, 8, ZoneTiles.glass, { name: 'Barred Pawn Window' });
    for (const sx of [x + 6, x + 12, x + 18, x + 24]) {
        z.placeFurniture('shelf', sx, y + 7, 'garage_tools', 'Pawn Shelf');
        z.placeFurniture('shelf', sx, y + 12, 'garage_tools', 'Pawn Shelf');
    }
    z.placeFurniture('counter', x + 7, y + 20, 'garage_tools', 'Pawn Counter');
    z.placeFurniture('workbench', x + 24, y + 20, 'garage_tools', 'Repair Bench');
    z.placeFurniture('locker', x + 27, y + 5, 'garage_tools', 'Locked Tool Cage');
    z.placeSign(x + 16, y - 2, 'Hanging Pawn Sign');
    z.addPoi(`${options.idPrefix || 'pawn'}_main`, name, 'shop', x + 17, y + 13, 9);
    if (options.npcs !== false) {
        z.addNpc('ganger', x + 22, y + 18, 'Pawn Shop Burglar', 'b', '#d06a5f');
    }
}

export function drawServiceAlley(z, x, y, h, options = {}) {
    z.fillRect(x, y, 5, h, ZoneTiles.alley);
    z.placeFurniture('crate', x + 2, y + 7, 'commercial_backroom', 'Overflow Trash Bin');
    z.placeFurniture('crate', x + 2, y + 14, 'commercial_backroom', 'Overflow Trash Bin');
    z.placeFurniture('locker', x + 2, y + h - 9, 'garage_tools', 'Locked Utility Cage');
    z.addPoi(`${options.idPrefix || 'alley'}_service`, 'Service Alley', 'exterior', x + 2, y + Math.floor(h / 2), 8);
}

export function drawBodega(z, x, y, options = {}) {
    const name = options.name || 'Bodega';
    z.drawRect(x, y, 30, 24, ZoneTiles.wall, ZoneTiles.storeFloor, name);
    z.hLine(x + 5, y + 23, 8, ZoneTiles.glass, { name: `${name} Window` });
    z.placeDoor('glass', x + 16, y + 23, { name: `${name} Door` });
    for (const sy of [y + 6, y + 10, y + 14]) {
        z.placeFurniture('shelf', x + 7, sy, 'commercial_store', 'Narrow Grocery Shelf');
        z.placeFurniture('shelf', x + 18, sy, 'commercial_store', 'Narrow Grocery Shelf');
    }
    for (let cx = x + 4; cx <= x + 10; cx++) z.placeFurniture('counter', cx, y + 19, 'commercial_store', 'Short Counter');
    z.placeFurniture('terminal', x + 6, y + 18, 'commercial_store', 'Dead Register Terminal');
    z.addPoi(`${options.idPrefix || 'bodega'}_main`, name, 'shop', x + 15, y + 12, 8);
    if (options.npcs !== false) {
        z.addNpc('survivor', x + 9, y + 18, options.clerkName || 'Bodega Clerk', '@', '#8ff0a4');
    }
}

export function drawClinic(z, x, y, options = {}) {
    const name = options.name || 'Street Clinic';
    z.drawRect(x, y, 34, 28, ZoneTiles.wall, ZoneTiles.officeFloor, name);
    z.placeDoor('glass', x + 16, y + 27, { name: `${name} Door` });
    z.hLine(x + 5, y + 27, 8, ZoneTiles.glass, { name: `${name} Window` });
    z.hLine(x + 22, y + 27, 7, ZoneTiles.glass, { name: `${name} Window` });
    z.drawRect(x + 3, y + 4, 12, 9, ZoneTiles.wall, ZoneTiles.bathroomFloor, 'Exam Room');
    z.drawRect(x + 18, y + 4, 12, 9, ZoneTiles.wall, ZoneTiles.officeFloor, 'Records Room');
    z.placeDoor('wood_basic', x + 8, y + 12, { name: 'Exam Room Door' });
    z.placeDoor('wood_basic', x + 24, y + 12, { name: 'Records Room Door' });
    z.placeFurniture('cabinet', x + 7, y + 7, 'medical_store', 'Medical Cabinet');
    z.placeFurniture('sink', x + 12, y + 8, 'medical_store', 'Exam Sink');
    z.placeFurniture('filing_cabinet', x + 23, y + 8, 'office', 'Patient Files');
    z.placeFurniture('chair', x + 9, y + 20, 'medical_waiting', 'Waiting Chair');
    z.placeFurniture('chair', x + 13, y + 20, 'medical_waiting', 'Waiting Chair');
    z.placeFurniture('counter', x + 24, y + 21, 'medical_store', 'Reception Counter');
    z.addPoi(`${options.idPrefix || 'clinic'}_main`, name, 'medical', x + 17, y + 15, 9);
    if (options.npcs !== false) {
        z.addNpc('survivor', x + 25, y + 20, options.doctorName || 'Triage Nurse', '@', '#9fd8ff');
    }
}
