/**
 * SpriteManager - Loads and manages spritesheets for tile rendering.
 * Supports multiple named spritesheets, each with configurable grid dimensions.
 * Falls back to ASCII glyph rendering if no sprite is available.
 */
export class SpriteManager {
    constructor() {
        this.sheets = {};       // { sheetName: { image, columns, tileSize, loaded } }
        this.tintCache = {};    // Cache tinted versions of sheets
        this.ready = false;
        this.pendingLoads = 0;
        
        // Offscreen canvas for tint compositing (avoids destroying main canvas)
        this._offCanvas = document.createElement('canvas');
        this._offCanvas.width = 64;
        this._offCanvas.height = 64;
        this._offCtx = this._offCanvas.getContext('2d');
    }

    /**
     * Register and load a spritesheet.
     * @param {string} name - Sheet identifier (e.g., 'walls', 'floors')
     * @param {string} path - Path to the PNG file
     * @param {number} columns - Number of columns in the grid
     * @param {number} tileSize - Pixel size of each tile (default 32)
     * @returns {Promise} Resolves when the image is loaded
     */
    loadSheet(name, path, columns, tileSize = 32) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            this.pendingLoads++;

            img.onload = () => {
                this.sheets[name] = {
                    image: img,
                    columns: columns,
                    tileSize: tileSize,
                    loaded: true
                };
                this.pendingLoads--;
                if (this.pendingLoads === 0) this.ready = true;
                console.log(`[SpriteManager] Loaded sheet '${name}' (${img.width}x${img.height}, ${columns} cols)`);
                resolve();
            };

            img.onerror = () => {
                console.warn(`[SpriteManager] Failed to load sheet '${name}' from ${path} — will use ASCII fallback`);
                this.sheets[name] = { image: null, columns, tileSize, loaded: false };
                this.pendingLoads--;
                if (this.pendingLoads === 0) this.ready = true;
                resolve(); // Resolve anyway so the game still starts
            };

            img.src = path;
        });
    }

    /**
     * Check if a sheet is loaded and available.
     */
    hasSheet(name) {
        return this.sheets[name] && this.sheets[name].loaded;
    }

    /**
     * Draw a sprite from a named sheet at a given screen position.
     * @param {CanvasRenderingContext2D} ctx - Canvas context
     * @param {string} sheetName - Which spritesheet to use
     * @param {number} spriteIndex - Index in the sheet (left-to-right, top-to-bottom)
     * @param {number} screenX - Pixel X on canvas
     * @param {number} screenY - Pixel Y on canvas
     * @param {number} destSize - Destination tile size on canvas
     * @param {string|null} tintColor - Hex color to tint the sprite (e.g., '#d2b48c' for brick)
     * @param {number} lightLevel - 0.0 to 1.0 brightness
     * @param {string|null} lightTint - Hex color for light source tint
     * @returns {boolean} True if sprite was drawn, false if fallback needed
     */
    drawSprite(ctx, sheetName, spriteIndex, screenX, screenY, destSize, tintColor = null, lightLevel = 1.0, lightTint = null) {
        const sheet = this.sheets[sheetName];
        if (!sheet || !sheet.loaded || spriteIndex === undefined || spriteIndex === null) {
            return false;
        }

        const srcX = (spriteIndex % sheet.columns) * sheet.tileSize;
        const srcY = Math.floor(spriteIndex / sheet.columns) * sheet.tileSize;

        if (tintColor) {
            // Composite tint on offscreen canvas to avoid destroying main canvas
            const oc = this._offCtx;
            const size = destSize;
            if (this._offCanvas.width < size) this._offCanvas.width = size;
            if (this._offCanvas.height < size) this._offCanvas.height = size;
            oc.clearRect(0, 0, size, size);
            
            // Draw base sprite to offscreen
            oc.globalCompositeOperation = 'source-over';
            oc.drawImage(
                sheet.image,
                srcX, srcY, sheet.tileSize, sheet.tileSize,
                0, 0, size, size
            );
            // Multiply tint color
            oc.globalCompositeOperation = 'multiply';
            oc.fillStyle = tintColor;
            oc.fillRect(0, 0, size, size);
            // Restore alpha from original sprite
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(
                sheet.image,
                srcX, srcY, sheet.tileSize, sheet.tileSize,
                0, 0, size, size
            );
            oc.globalCompositeOperation = 'source-over';
            
            // Stamp result onto main canvas
            ctx.drawImage(this._offCanvas, 0, 0, size, size, screenX, screenY, size, size);
        } else {
            // No tint — draw directly
            ctx.drawImage(
                sheet.image,
                srcX, srcY, sheet.tileSize, sheet.tileSize,
                screenX, screenY, destSize, destSize
            );
        }

        // Apply light tint (warm glow from light sources)
        if (lightTint && lightLevel > 0.08) {
            const tintStrength = Math.min(0.25, lightLevel * 0.3);
            ctx.globalAlpha = tintStrength;
            ctx.fillStyle = lightTint;
            ctx.fillRect(screenX, screenY, destSize, destSize);
            ctx.globalAlpha = 1.0;
        }

        // Apply darkness overlay for lighting
        if (lightLevel < 1.0) {
            const darkness = 1.0 - Math.max(0.08, lightLevel);
            ctx.globalAlpha = darkness;
            ctx.fillStyle = '#000000';
            ctx.fillRect(screenX, screenY, destSize, destSize);
            ctx.globalAlpha = 1.0;
        }

        return true;
    }

    /**
     * Draw a dimmed (explored but not visible) sprite.
     */
    drawSpriteDimmed(ctx, sheetName, spriteIndex, screenX, screenY, destSize, tintColor = null) {
        const sheet = this.sheets[sheetName];
        if (!sheet || !sheet.loaded || spriteIndex === undefined || spriteIndex === null) {
            return false;
        }

        const srcX = (spriteIndex % sheet.columns) * sheet.tileSize;
        const srcY = Math.floor(spriteIndex / sheet.columns) * sheet.tileSize;

        if (tintColor) {
            // Composite tint on offscreen canvas
            const oc = this._offCtx;
            const size = destSize;
            if (this._offCanvas.width < size) this._offCanvas.width = size;
            if (this._offCanvas.height < size) this._offCanvas.height = size;
            oc.clearRect(0, 0, size, size);
            
            oc.globalCompositeOperation = 'source-over';
            oc.drawImage(
                sheet.image,
                srcX, srcY, sheet.tileSize, sheet.tileSize,
                0, 0, size, size
            );
            oc.globalCompositeOperation = 'multiply';
            oc.fillStyle = tintColor;
            oc.fillRect(0, 0, size, size);
            oc.globalCompositeOperation = 'destination-in';
            oc.drawImage(
                sheet.image,
                srcX, srcY, sheet.tileSize, sheet.tileSize,
                0, 0, size, size
            );
            oc.globalCompositeOperation = 'source-over';
            
            // Draw dimmed onto main canvas
            ctx.globalAlpha = 0.3;
            ctx.drawImage(this._offCanvas, 0, 0, size, size, screenX, screenY, size, size);
            ctx.globalAlpha = 1.0;
        } else {
            // No tint — draw directly at low opacity
            ctx.globalAlpha = 0.3;
            ctx.drawImage(
                sheet.image,
                srcX, srcY, sheet.tileSize, sheet.tileSize,
                screenX, screenY, destSize, destSize
            );
            ctx.globalAlpha = 1.0;
        }
        return true;
    }
}
