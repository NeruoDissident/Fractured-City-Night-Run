import { NPC } from '../../entities/NPC.js';
import { createDoor } from '../objects/Door.js';
import { createFurniture, populateFurniture } from '../objects/Furniture.js';
import { ZoneTiles, cloneTile, tile } from './ZoneTiles.js';

const FURNITURE_ASCII = {
    shelf: { glyph: 's', fgColor: '#d6c47a' },
    counter: { glyph: 'c', fgColor: '#d8a85c' },
    cabinet: { glyph: 'k', fgColor: '#b8860b' },
    crate: { glyph: 'C', fgColor: '#b98952' },
    locker: { glyph: 'L', fgColor: '#9aa8b5' },
    terminal: { glyph: 'T', fgColor: '#66ffff' },
    table: { glyph: 't', fgColor: '#bfa06a' },
    chair: { glyph: 'h', fgColor: '#c8b080' },
    toilet: { glyph: 'o', fgColor: '#d8f0f0' },
    sink: { glyph: 'u', fgColor: '#a8d8ff' },
    workbench: { glyph: 'W', fgColor: '#d8a85c' },
    filing_cabinet: { glyph: 'f', fgColor: '#aeb8c2' },
    bed: { glyph: 'b', fgColor: '#c7a8d8' },
    stove: { glyph: 'v', fgColor: '#d0d0d0' }
};

function asciiForFurniture(type, name) {
    const lower = (name || '').toLowerCase();
    if (lower.includes('washer')) return { glyph: 'w', fgColor: '#9fd8ff' };
    if (lower.includes('pump')) return { glyph: 'P', fgColor: '#ffdd88' };
    if (lower.includes('register')) return { glyph: 'R', fgColor: '#66ffff' };
    if (lower.includes('fridge') || lower.includes('cooler')) return { glyph: 'F', fgColor: '#a8d8ff' };
    if (lower.includes('dumpster')) return { glyph: 'D', fgColor: '#7c8a78' };
    if (lower.includes('vending')) return { glyph: 'V', fgColor: '#ff8a80' };
    return FURNITURE_ASCII[type] || { glyph: '?', fgColor: '#cccccc' };
}

export class ZoneCanvas {
    constructor(world, rng) {
        this.world = world;
        this.rng = rng;
        this.z = 0;
        this.width = world.zoneWidth;
        this.height = world.zoneHeight;
    }

    fill(baseTile) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.set(x, y, baseTile);
            }
        }
    }

    set(x, y, baseTile, overrides = {}) {
        if (!this.inBounds(x, y)) return;
        this.world.updateTileAt(x, y, this.z, cloneTile(baseTile, overrides));
    }

    get(x, y) {
        return this.world.getTile(x, y, this.z);
    }

    inBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    fillRect(x, y, w, h, baseTile, overrides = {}) {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
                this.set(xx, yy, baseTile, overrides);
            }
        }
    }

    drawRect(x, y, w, h, wallTile, floorTile, name) {
        for (let yy = y; yy < y + h; yy++) {
            for (let xx = x; xx < x + w; xx++) {
                const edge = xx === x || xx === x + w - 1 || yy === y || yy === y + h - 1;
                this.set(xx, yy, edge ? wallTile : floorTile, edge ? { name: `${name} Wall` } : { name });
            }
        }
    }

    hLine(x, y, len, baseTile, overrides = {}) {
        for (let i = 0; i < len; i++) this.set(x + i, y, baseTile, overrides);
    }

    vLine(x, y, len, baseTile, overrides = {}) {
        for (let i = 0; i < len; i++) this.set(x, y + i, baseTile, overrides);
    }

    sidewalkAroundRoad(x1, y1, x2, y2, roadBounds) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                if (roadBounds.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)) continue;
                this.set(x, y, ZoneTiles.sidewalk);
            }
        }
    }

    placeDoor(type, x, y, options = {}) {
        const door = createDoor(type, x, y, this.z, !!options.locked, !!options.open);
        if (options.name) door.name = options.name;
        this.world.addWorldObject(door);
        this.set(x, y, tile(door.glyph, door.fgColor, door.bgColor, door.name, {
            blocked: door.blocked,
            blocksLight: door.blocksVision,
            blocksVision: door.blocksVision,
            isExterior: false,
            worldObjectId: door.id,
            roomType: options.roomType
        }));
        return door;
    }

    placeFurniture(type, x, y, roomType, name = null) {
        const furn = createFurniture(type, x, y, this.z);
        if (name) furn.name = name;
        if (this.world.game.content) {
            populateFurniture(furn, roomType, this.world.game.content);
        }
        this.world.addWorldObject(furn);
        const ascii = asciiForFurniture(type, furn.name);
        furn.glyph = ascii.glyph;
        furn.fgColor = ascii.fgColor;
        this.set(x, y, tile(ascii.glyph, ascii.fgColor, furn.bgColor || '#3a3a3a', furn.name, {
            blocked: furn.blocked,
            blocksLight: furn.blocksVision,
            blocksVision: furn.blocksVision,
            isExterior: false,
            roomType,
            worldObjectId: furn.id
        }));
        return furn;
    }

    placeSign(x, y, name) {
        this.set(x, y, tile('!', '#ffd36a', '#17120a', name));
    }

    addPoi(id, name, type, x, y, radius = 6) {
        this.world.pointsOfInterest.push({ id, name, type, x, y, radius, discovered: false });
    }

    addNpc(type, x, y, name, glyph, color) {
        const npc = new NPC(this.world.game, type, x, y);
        npc.name = name;
        npc.glyph = glyph;
        npc.color = color;
        this.world.addEntity(npc);
        return npc;
    }

    placeItem(item, x, y) {
        item.x = x;
        item.y = y;
        item.z = this.z;
        this.world.addItem(item);
        return item;
    }

    scatter(baseTile, count, predicate = null, overrides = {}) {
        for (let i = 0; i < count; i++) {
            for (let attempt = 0; attempt < 40; attempt++) {
                const x = 1 + Math.floor(this.rng() * (this.width - 2));
                const y = 1 + Math.floor(this.rng() * (this.height - 2));
                const current = this.get(x, y);
                if (current.blocked || current.worldObjectId) continue;
                if (predicate && !predicate(current, x, y)) continue;
                this.set(x, y, baseTile, overrides);
                break;
            }
        }
    }
}
