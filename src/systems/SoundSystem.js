/**
 * SoundSystem
 * 
 * Manages sound events and propagation in the game world.
 * NPCs can detect sounds and react accordingly.
 */

export class SoundSystem {
    constructor(game) {
        this.game = game;
        this.activeSounds = [];
        this.soundDecayRate = 1;
    }
    
    /**
     * Create a sound event at a location
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {number} volume - Sound volume (radius in tiles)
     * @param {string} type - Type of sound (movement, combat, item, etc.)
     * @param {Entity} source - Entity that made the sound
     */
    makeSound(x, y, volume, type = 'generic', source = null) {
        if (volume <= 0) return;
        
        const sound = {
            x,
            y,
            volume,
            type,
            source,
            turnsRemaining: 2
        };
        
        this.activeSounds.push(sound);
        
        this.alertNearbyNPCs(sound);
    }
    
    /**
     * Alert NPCs within sound radius
     */
    alertNearbyNPCs(sound) {
        for (const entity of this.game.world.entities) {
            if (entity === sound.source) continue;
            if (!entity.hearSound) continue;
            
            const dist = Math.sqrt(
                Math.pow(entity.x - sound.x, 2) + 
                Math.pow(entity.y - sound.y, 2)
            );
            
            if (dist <= sound.volume) {
                entity.hearSound(sound);
            }
        }
    }
    
    /**
     * Process sound decay each turn
     */
    processTurn() {
        this.activeSounds = this.activeSounds.filter(sound => {
            sound.turnsRemaining--;
            return sound.turnsRemaining > 0;
        });
    }
    
    /**
     * Get all active sounds near a position
     */
    getSoundsNear(x, y, radius) {
        return this.activeSounds.filter(sound => {
            const dist = Math.sqrt(
                Math.pow(x - sound.x, 2) + 
                Math.pow(y - sound.y, 2)
            );
            return dist <= radius;
        });
    }
    
    /**
     * Clear all sounds (for new game, etc.)
     */
    clear() {
        this.activeSounds = [];
    }
}
