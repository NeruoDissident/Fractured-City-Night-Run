/**
 * WorldObject - Base class for interactive world objects
 * Handles doors, furniture, trees, walls, etc.
 */
export class WorldObject {
    constructor(config) {
        this.id = config.id || `obj_${Date.now()}_${Math.random()}`;
        this.type = config.type; // 'door', 'furniture', 'tree', 'wall'
        this.name = config.name;
        this.glyph = config.glyph;
        this.fgColor = config.fgColor;
        this.bgColor = config.bgColor;
        
        // Position
        this.x = config.x;
        this.y = config.y;
        this.z = config.z || 0;
        
        // State
        this.state = config.state || {};
        
        // Properties
        this.hp = config.hp || 100;
        this.maxHP = config.maxHP || 100;
        this.blocked = config.blocked !== undefined ? config.blocked : true;
        this.blocksVision = config.blocksVision !== undefined ? config.blocksVision : false;
        
        // Material properties
        this.material = config.material || 'wood';
        this.durability = config.durability || 1.0; // Damage resistance multiplier
        
        // Available actions
        this.actions = config.actions || [];
        
        // Drop table for destruction/disassembly
        this.dropTable = config.dropTable || { materials: [] };
        
        // Key system (future)
        this.keyId = config.keyId || null; // If locked, what key opens it
        this.canBarricade = config.canBarricade || false;
        this.barricaded = false;
    }
    
    /**
     * Get current visual representation
     */
    getTile() {
        return {
            glyph: this.glyph,
            fgColor: this.fgColor,
            bgColor: this.bgColor,
            blocked: this.blocked,
            blocksVision: this.blocksVision,
            name: this.name,
            worldObject: this // Reference back to this object
        };
    }
    
    /**
     * Check if action is available
     */
    canPerformAction(actionName) {
        return this.actions.includes(actionName);
    }
    
    /**
     * Get available actions based on current state
     */
    getAvailableActions() {
        return this.actions.filter(action => {
            // Override in subclasses for state-specific filtering
            return true;
        });
    }
    
    /**
     * Take damage
     */
    takeDamage(amount) {
        const actualDamage = amount / this.durability;
        this.hp = Math.max(0, this.hp - actualDamage);
        
        if (this.hp <= 0) {
            return { destroyed: true };
        }
        
        return { damaged: true, hp: this.hp };
    }
    
    /**
     * Check if object is destroyed
     */
    isDestroyed() {
        return this.hp <= 0;
    }
    
    /**
     * Get status description
     */
    getStatusText() {
        const hpPercent = (this.hp / this.maxHP) * 100;
        if (hpPercent >= 90) return 'Pristine';
        if (hpPercent >= 70) return 'Good';
        if (hpPercent >= 50) return 'Worn';
        if (hpPercent >= 30) return 'Damaged';
        if (hpPercent >= 10) return 'Badly Damaged';
        return 'Nearly Destroyed';
    }
}
