/**
 * Door - Interactive door object
 * Extends WorldObject with door-specific functionality
 */
import { WorldObject } from '../WorldObject.js';

export class Door extends WorldObject {
    constructor(config) {
        const doorConfig = {
            ...config,
            type: 'door',
            actions: ['inspect', 'open', 'close', 'smash', 'peek', 'knock', 'disassemble'],
            canBarricade: true
        };
        
        super(doorConfig);
        
        // Door-specific state
        this.state.open = config.open !== undefined ? config.open : false;
        this.state.locked = config.locked !== undefined ? config.locked : false;
        
        // Update visual and blocking based on state
        this.updateVisuals();
    }
    
    /**
     * Update glyph and blocking based on door state
     */
    updateVisuals() {
        if (this.isDestroyed()) {
            this.glyph = '/';
            this.fgColor = '#666666';
            this.blocked = false;
            this.blocksVision = false;
            this.state.open = true; // Destroyed doors are open/passable
            if (!this.name.includes('Broken')) {
                this.name = this.name.replace('Door', 'Broken Door');
            }
        } else if (this.state.open) {
            this.glyph = "'";
            this.blocked = false;
            this.blocksVision = false;
        } else {
            this.glyph = '+';
            this.blocked = true;
            this.blocksVision = true;
        }
        
        if (this.barricaded) {
            this.glyph = '▓';
            this.blocked = true;
            this.blocksVision = true;
        }
    }
    
    /**
     * Get available actions based on current state
     */
    getAvailableActions() {
        const actions = [];
        
        if (this.isDestroyed()) {
            return actions; // No actions for broken doors
        }
        
        if (this.barricaded) {
            actions.push('remove_barricade');
            return actions;
        }
        
        if (this.state.open) {
            actions.push('close');
        } else {
            if (!this.state.locked) {
                actions.push('open');
            }
            actions.push('peek');
            actions.push('knock');
            
            if (this.state.locked) {
                actions.push('lockpick'); // Future: requires lockpick tool
            }
        }
        
        actions.push('smash');
        
        if (this.state.open) {
            actions.push('disassemble');
        }
        
        if (!this.state.open && !this.state.locked) {
            actions.push('barricade'); // Future feature
        }
        
        return actions;
    }
    
    /**
     * Open the door
     */
    open() {
        if (this.state.open) {
            return { success: false, message: 'Already open.' };
        }
        
        if (this.state.locked) {
            return { success: false, message: `The ${this.name} is locked.` };
        }
        
        if (this.barricaded) {
            return { success: false, message: `The ${this.name} is barricaded.` };
        }
        
        this.state.open = true;
        this.updateVisuals();
        
        return {
            success: true,
            message: `You open the ${this.name}.`,
            timeSpent: 1
        };
    }
    
    /**
     * Close the door
     */
    close() {
        if (!this.state.open) {
            return { success: false, message: 'Already closed.' };
        }
        
        this.state.open = false;
        this.updateVisuals();
        
        return {
            success: true,
            message: `You close the ${this.name}.`,
            timeSpent: 1
        };
    }
    
    /**
     * Peek through the door
     */
    peek() {
        if (this.state.open) {
            return { success: false, message: `The ${this.name} is already open.` };
        }
        
        return {
            success: true,
            message: `You peek through the ${this.name}.`,
            timeSpent: 1,
            peekVision: true // Signal to show limited vision
        };
    }
    
    /**
     * Knock on the door
     */
    knock() {
        if (this.state.open) {
            return { success: false, message: `The ${this.name} is already open.` };
        }
        
        return {
            success: true,
            message: `You knock on the ${this.name}.`,
            timeSpent: 1,
            makeNoise: { volume: 15, range: 10, type: 'knock' }
        };
    }
    
    /**
     * Get status description
     */
    getStatusText() {
        let status = [];
        
        if (this.isDestroyed()) {
            status.push('Destroyed');
        } else {
            status.push(this.state.open ? 'Open' : 'Closed');
            
            if (this.state.locked) {
                status.push('Locked');
            }
            
            if (this.barricaded) {
                status.push('Barricaded');
            }
            
            const condition = super.getStatusText();
            if (condition !== 'Pristine') {
                status.push(condition);
            }
        }
        
        return status.join(', ');
    }
}

/**
 * Door type definitions
 */
export const DOOR_TYPES = {
    wood_basic: {
        name: 'Wooden Door',
        material: 'wood',
        hp: 50,
        maxHP: 50,
        durability: 1.0,
        fgColor: '#d4a574',
        bgColor: '#3a3a3a',
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [2, 3], quality: [60, 90] },
                { name: 'Nails', quantity: [1, 2], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    wood_reinforced: {
        name: 'Reinforced Door',
        material: 'wood',
        hp: 80,
        maxHP: 80,
        durability: 1.3,
        fgColor: '#8b7355',
        bgColor: '#3a3a3a',
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [3, 4], quality: [70, 95] },
                { name: 'Metal Scraps', quantity: [1, 2], quality: [60, 80] },
                { name: 'Screws', quantity: [2, 4], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    metal: {
        name: 'Metal Door',
        material: 'metal',
        hp: 100,
        maxHP: 100,
        durability: 2.0,
        fgColor: '#888888',
        bgColor: '#3a3a3a',
        dropTable: {
            materials: [
                { name: 'Metal Scraps', quantity: [3, 4], quality: [70, 90] },
                { name: 'Screws', quantity: [2, 3], quality: [70, 100] }
            ],
            disassembleTool: 'crowbar'
        }
    },
    
    glass: {
        name: 'Glass Door',
        material: 'glass',
        hp: 30,
        maxHP: 30,
        durability: 0.5,
        fgColor: '#aaddff',
        bgColor: '#3a3a3a',
        dropTable: {
            materials: [
                { name: 'Glass Shards', quantity: [1, 3], quality: [40, 70] }
            ]
        }
    },
    
    security: {
        name: 'Security Door',
        material: 'metal',
        hp: 150,
        maxHP: 150,
        durability: 2.5,
        fgColor: '#444444',
        bgColor: '#3a3a3a',
        dropTable: {
            materials: [
                { name: 'Metal Scraps', quantity: [2, 4], quality: [60, 85] },
                { name: 'Steel Plate', quantity: [1, 1], quality: [70, 90] }
            ]
        }
    }
};

/**
 * Create a door instance
 */
export function createDoor(doorType, x, y, z, locked = false, open = false) {
    const template = DOOR_TYPES[doorType] || DOOR_TYPES.wood_basic;
    
    return new Door({
        ...template,
        x,
        y,
        z,
        locked,
        open
    });
}
