export class Chunk {
    constructor(world, cx, cy) {
        this.world = world;
        this.cx = cx;
        this.cy = cy;
        this.size = world.chunkSize;
        this.biome = world.forcedBiome || 'urban_core';
        this.district = 'zone';
        this.tiles = {};
    }

    generate() {
        this.ensureZ(0);
    }

    ensureZ(z = 0) {
        if (this.tiles[z]) return;

        this.tiles[z] = [];
        for (let y = 0; y < this.size; y++) {
            this.tiles[z][y] = [];
            for (let x = 0; x < this.size; x++) {
                this.tiles[z][y][x] = {
                    glyph: ' ',
                    fgColor: '#000000',
                    bgColor: '#000000',
                    blocked: true,
                    blocksLight: true,
                    blocksVision: true,
                    name: 'Void'
                };
            }
        }
    }

    getTile(x, y, z = 0) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) {
            return {
                glyph: ' ',
                fgColor: '#000000',
                bgColor: '#000000',
                blocked: true,
                blocksLight: true,
                blocksVision: true,
                name: 'Void'
            };
        }
        this.ensureZ(z);
        return this.tiles[z][y][x];
    }

    setTile(x, y, tile, z = 0) {
        if (x < 0 || x >= this.size || y < 0 || y >= this.size) return;
        this.ensureZ(z);
        this.tiles[z][y][x] = tile;
    }
}
