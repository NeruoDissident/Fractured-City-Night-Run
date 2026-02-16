/**
 * CombatEffects - Visual feedback for combat events.
 * 
 * Manages:
 * - Entity shake (sprite offset on hit)
 * - Floating combat text (damage numbers, status text above entities)
 * 
 * All effects are time-based and rendered as overlays on the game canvas.
 * The Game render loop calls drawEffects() each frame.
 */

export class CombatEffects {
    constructor(game) {
        this.game = game;
        
        // Active shake effects: { entityId, startTime, duration, intensity }
        this.shakes = new Map();
        
        // Floating text: { x, y, text, color, startTime, duration, offsetY }
        this.floatingTexts = [];
        
        // Animation frame tracking
        this.animating = false;
        this.lastFrameTime = 0;
    }
    
    /**
     * Trigger a shake effect on an entity.
     * @param {Object} entity - The entity to shake
     * @param {number} intensity - Shake magnitude in pixels (2-6 typical)
     * @param {number} duration - Duration in ms (150-400 typical)
     */
    shakeEntity(entity, intensity = 3, duration = 250) {
        const id = entity === this.game.player ? '_player' : `${entity.x},${entity.y}`;
        this.shakes.set(id, {
            entity,
            startTime: performance.now(),
            duration,
            intensity
        });
        this.startAnimation();
    }
    
    /**
     * Add floating combat text above a world position.
     * @param {number} worldX - World tile X
     * @param {number} worldY - World tile Y
     * @param {string} text - Text to display
     * @param {string} color - CSS color
     * @param {number} duration - How long to show in ms
     */
    addFloatingText(worldX, worldY, text, color = '#ffffff', duration = 1200) {
        this.floatingTexts.push({
            x: worldX,
            y: worldY,
            text,
            color,
            startTime: performance.now(),
            duration,
            offsetY: 0
        });
        this.startAnimation();
    }
    
    /**
     * Get the current shake offset for an entity (called by World.render).
     * Returns { dx, dy } in pixels.
     */
    getShakeOffset(entity) {
        const id = entity === this.game.player ? '_player' : `${entity.x},${entity.y}`;
        const shake = this.shakes.get(id);
        if (!shake) return { dx: 0, dy: 0 };
        
        const elapsed = performance.now() - shake.startTime;
        if (elapsed >= shake.duration) {
            this.shakes.delete(id);
            return { dx: 0, dy: 0 };
        }
        
        // Decay intensity over time
        const progress = elapsed / shake.duration;
        const currentIntensity = shake.intensity * (1 - progress);
        
        // Rapid oscillation
        const dx = Math.round((Math.random() - 0.5) * 2 * currentIntensity);
        const dy = Math.round((Math.random() - 0.5) * 2 * currentIntensity);
        
        return { dx, dy };
    }
    
    /**
     * Draw all active floating text effects onto the canvas.
     * Called after entity rendering in the render loop.
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} cameraX - Camera offset in tiles
     * @param {number} cameraY - Camera offset in tiles
     * @param {number} tileSize - Pixel size of tiles
     */
    drawFloatingTexts(ctx, cameraX, cameraY, tileSize) {
        const now = performance.now();
        
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            const elapsed = now - ft.startTime;
            
            if (elapsed >= ft.duration) {
                this.floatingTexts.splice(i, 1);
                continue;
            }
            
            const progress = elapsed / ft.duration;
            
            // Float upward
            const floatY = progress * tileSize * 1.2;
            
            // Fade out in last 40%
            const alpha = progress > 0.6 ? 1 - ((progress - 0.6) / 0.4) : 1.0;
            
            // Screen position
            const screenX = (ft.x - cameraX) * tileSize + tileSize / 2;
            const screenY = (ft.y - cameraY) * tileSize - floatY;
            
            // Skip if off-screen
            if (screenX < -50 || screenX > ctx.canvas.width + 50) continue;
            if (screenY < -50 || screenY > ctx.canvas.height + 50) continue;
            
            // Draw text with outline for readability
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = 'bold 14px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            
            // Black outline
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3;
            ctx.strokeText(ft.text, screenX, screenY);
            
            // Colored fill
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, screenX, screenY);
            
            ctx.restore();
        }
    }
    
    /**
     * Check if any effects are still active.
     */
    hasActiveEffects() {
        return this.shakes.size > 0 || this.floatingTexts.length > 0;
    }
    
    /**
     * Start the animation loop if not already running.
     */
    startAnimation() {
        if (this.animating) return;
        this.animating = true;
        this.lastFrameTime = performance.now();
        this.animate();
    }
    
    /**
     * Animation loop — re-renders the game while effects are active.
     */
    animate() {
        if (!this.hasActiveEffects()) {
            this.animating = false;
            // One final render to clear shake offsets
            this.game.render();
            return;
        }
        
        this.game.render();
        requestAnimationFrame(() => this.animate());
    }
}
