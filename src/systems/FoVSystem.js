/**
 * FoVSystem - Field of View
 * 
 * Implements shadowcasting algorithm for line-of-sight calculations.
 * Determines which tiles are visible to the player based on vision range and obstacles.
 * 
 * EXPANSION POINTS:
 * - Add light sources (torches, cybernetic eyes with night vision)
 * - Add darkness levels per tile
 * - Add smoke/fog that reduces vision
 * - Add infrared/thermal vision modes
 * - Add sound-based detection for blind characters
 */

export class FoVSystem {
    constructor(world) {
        this.world = world;
        this.visibleTiles = new Set();
        this.exploredTiles = new Set();
    }
    
    /**
     * Calculates field of view from a position
     * Simple circular FoV - shows all tiles within radius
     * @param {number} x - Center X position
     * @param {number} y - Center Y position
     * @param {number} radius - Vision radius
     */
    calculate(x, y, radius) {
        this.visibleTiles.clear();
        
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist <= radius) {
                    const tx = x + dx;
                    const ty = y + dy;
                    
                    if (this.hasLineOfSight(x, y, tx, ty)) {
                        this.visibleTiles.add(`${tx},${ty}`);
                        this.exploredTiles.add(`${tx},${ty}`);
                    }
                }
            }
        }
    }
    
    /**
     * Check if there's line of sight between two points
     * Uses simple raycasting
     */
    hasLineOfSight(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        let x = x0;
        let y = y0;
        
        while (true) {
            if (x === x1 && y === y1) {
                return true;
            }
            
            if (x !== x0 || y !== y0) {
                if (this.isBlocked(x, y)) {
                    return false;
                }
            }
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }
    }
    
    /**
     * Check if a tile blocks vision
     */
    isBlocked(x, y) {
        const tile = this.world.getTile(x, y);
        return tile.blocked;
    }
    
    /**
     * Check if a tile is currently visible
     */
    isVisible(x, y) {
        return this.visibleTiles.has(`${x},${y}`);
    }
    
    /**
     * Check if a tile has been explored (seen before)
     */
    isExplored(x, y) {
        return this.exploredTiles.has(`${x},${y}`);
    }
}
