/**
 * Furniture - Interactive furniture world object
 * Extends WorldObject with furniture-specific functionality
 * Some furniture acts as storage containers (cabinets, dressers, etc.)
 */
import { WorldObject } from '../WorldObject.js';

export class Furniture extends WorldObject {
    constructor(config) {
        const furnitureConfig = {
            ...config,
            type: 'furniture',
            actions: config.actions || ['inspect', 'smash', 'disassemble']
        };
        
        super(furnitureConfig);
        
        // Furniture-specific state
        this.state.searched = false;
        this.state.open = config.open !== undefined ? config.open : false;
        this.furnitureType = config.furnitureType || 'generic';
        
        // Storage properties (mirrors ContainerSystem pocket structure)
        this.isContainer = config.isContainer || false;
        if (this.isContainer) {
            this.pockets = config.pockets ? config.pockets.map(p => ({
                name: p.name,
                maxWeight: p.maxWeight,
                maxVolume: p.maxVolume,
                contents: []
            })) : [];
        }
        
        this.updateVisuals();
    }
    
    /**
     * Update glyph and blocking based on furniture state
     */
    updateVisuals() {
        if (this.isDestroyed()) {
            this.glyph = '%';
            this.fgColor = '#555555';
            this.blocked = false;
            this.blocksVision = false;
            if (!this.name.includes('Broken')) {
                this.name = `Broken ${this.name}`;
            }
        }
    }
    
    /**
     * Get available actions based on current state
     */
    getAvailableActions() {
        const actions = [];
        
        if (this.isDestroyed()) {
            return actions;
        }
        
        // Storage furniture can be searched
        if (this.isContainer) {
            actions.push('search');
        }
        
        actions.push('smash');
        actions.push('disassemble');
        
        return actions;
    }
    
    /**
     * Get status description
     */
    getStatusText() {
        let status = [];
        
        if (this.isDestroyed()) {
            status.push('Destroyed');
        } else {
            const condition = super.getStatusText();
            if (condition !== 'Pristine') {
                status.push(condition);
            } else {
                status.push('Intact');
            }
            
            if (this.isContainer) {
                const itemCount = this.getStoredItemCount();
                if (this.state.searched) {
                    status.push(itemCount > 0 ? `${itemCount} item(s) inside` : 'Empty');
                } else {
                    status.push('Unsearched');
                }
            }
        }
        
        return status.join(', ');
    }
    
    /**
     * Count total items stored in all pockets
     */
    getStoredItemCount() {
        if (!this.pockets) return 0;
        let count = 0;
        for (const pocket of this.pockets) {
            if (pocket.contents) {
                count += pocket.contents.length;
            }
        }
        return count;
    }
    
    /**
     * Get all stored items with location info
     */
    getAllStoredItems() {
        const items = [];
        if (!this.pockets) return items;
        
        for (let i = 0; i < this.pockets.length; i++) {
            const pocket = this.pockets[i];
            if (pocket.contents) {
                for (let j = 0; j < pocket.contents.length; j++) {
                    items.push({
                        item: pocket.contents[j],
                        pocketIndex: i,
                        itemIndex: j,
                        location: pocket.name
                    });
                }
            }
        }
        return items;
    }
}

/**
 * Sprite index mapping for the objects spritesheet (8 columns, 32px tiles)
 * Indices 0-15: furniture, 16-20: doors
 */
export const OBJECT_SPRITE_INDEX = {
    cabinet: 0,
    dresser: 1,
    shelf: 2,
    locker: 3,
    crate: 4,
    filing_cabinet: 5,
    table: 6,
    chair: 7,
    couch: 8,
    bed: 9,
    sink: 10,
    counter: 11,
    stove: 12,
    toilet: 13,
    shower: 14,
    workbench: 15,
    door_closed: 16,
    door_open: 17,
    door_broken: 18,
    door_barricaded: 19
};

/**
 * Furniture type definitions
 * Storage furniture has pockets[] matching ContainerSystem format
 */
export const FURNITURE_TYPES = {
    // === STORAGE FURNITURE ===
    
    cabinet: {
        name: 'Cabinet',
        furnitureType: 'cabinet',
        glyph: '¤',
        fgColor: '#b8860b',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 40,
        maxHP: 40,
        durability: 1.0,
        blocked: true,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Upper Shelf', maxWeight: 5000, maxVolume: 8000 },
            { name: 'Lower Shelf', maxWeight: 5000, maxVolume: 8000 }
        ],
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [2, 3], quality: [60, 90] },
                { name: 'Nails', quantity: [2, 4], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    dresser: {
        name: 'Dresser',
        furnitureType: 'dresser',
        glyph: '¤',
        fgColor: '#a0522d',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 45,
        maxHP: 45,
        durability: 1.0,
        blocked: true,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Top Drawer', maxWeight: 3000, maxVolume: 4000 },
            { name: 'Middle Drawer', maxWeight: 4000, maxVolume: 6000 },
            { name: 'Bottom Drawer', maxWeight: 5000, maxVolume: 8000 }
        ],
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [2, 4], quality: [60, 85] },
                { name: 'Nails', quantity: [2, 3], quality: [70, 100] },
                { name: 'Screws', quantity: [1, 2], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    shelf: {
        name: 'Shelf',
        furnitureType: 'shelf',
        glyph: '=',
        fgColor: '#c4a882',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 25,
        maxHP: 25,
        durability: 0.8,
        blocked: false,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Shelf', maxWeight: 6000, maxVolume: 10000 }
        ],
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [1, 2], quality: [60, 90] },
                { name: 'Screws', quantity: [1, 2], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    locker: {
        name: 'Locker',
        furnitureType: 'locker',
        glyph: '¤',
        fgColor: '#808080',
        bgColor: '#3a3a3a',
        material: 'metal',
        hp: 60,
        maxHP: 60,
        durability: 1.5,
        blocked: true,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Locker', maxWeight: 8000, maxVolume: 12000 }
        ],
        dropTable: {
            materials: [
                { name: 'Metal Scraps', quantity: [2, 3], quality: [70, 90] },
                { name: 'Screws', quantity: [1, 2], quality: [70, 100] }
            ],
            disassembleTool: 'crowbar'
        }
    },
    
    crate: {
        name: 'Crate',
        furnitureType: 'crate',
        glyph: '¤',
        fgColor: '#deb887',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 20,
        maxHP: 20,
        durability: 0.7,
        blocked: true,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Inside', maxWeight: 10000, maxVolume: 15000 }
        ],
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [2, 3], quality: [50, 80] },
                { name: 'Nails', quantity: [1, 2], quality: [60, 90] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    filing_cabinet: {
        name: 'Filing Cabinet',
        furnitureType: 'filing_cabinet',
        glyph: '¤',
        fgColor: '#696969',
        bgColor: '#3a3a3a',
        material: 'metal',
        hp: 50,
        maxHP: 50,
        durability: 1.3,
        blocked: true,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Top Drawer', maxWeight: 3000, maxVolume: 4000 },
            { name: 'Bottom Drawer', maxWeight: 3000, maxVolume: 4000 }
        ],
        dropTable: {
            materials: [
                { name: 'Metal Scraps', quantity: [2, 3], quality: [70, 90] },
                { name: 'Screws', quantity: [1, 2], quality: [70, 100] }
            ],
            disassembleTool: 'crowbar'
        }
    },
    
    // === NON-STORAGE FURNITURE ===
    
    table: {
        name: 'Table',
        furnitureType: 'table',
        glyph: 'T',
        fgColor: '#b8860b',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 35,
        maxHP: 35,
        durability: 1.0,
        blocked: true,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [2, 3], quality: [60, 90] },
                { name: 'Nails', quantity: [2, 3], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    chair: {
        name: 'Chair',
        furnitureType: 'chair',
        glyph: 'h',
        fgColor: '#b8860b',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 20,
        maxHP: 20,
        durability: 0.8,
        blocked: false,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [1, 2], quality: [60, 85] },
                { name: 'Nails', quantity: [1, 2], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    couch: {
        name: 'Couch',
        furnitureType: 'couch',
        glyph: '=',
        fgColor: '#8b6914',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 40,
        maxHP: 40,
        durability: 1.0,
        blocked: true,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [1, 2], quality: [50, 80] },
                { name: 'Fabric Panel', quantity: [2, 3], quality: [40, 70] },
                { name: 'Nails', quantity: [1, 2], quality: [60, 90] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    bed: {
        name: 'Bed',
        furnitureType: 'bed',
        glyph: '=',
        fgColor: '#6b8e9b',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 35,
        maxHP: 35,
        durability: 1.0,
        blocked: true,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [2, 3], quality: [60, 85] },
                { name: 'Fabric Panel', quantity: [1, 2], quality: [40, 70] },
                { name: 'Nails', quantity: [1, 2], quality: [60, 90] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    sink: {
        name: 'Sink',
        furnitureType: 'sink',
        glyph: 'U',
        fgColor: '#b0c4de',
        bgColor: '#3a3a3a',
        material: 'metal',
        hp: 50,
        maxHP: 50,
        durability: 1.5,
        blocked: true,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Metal Scraps', quantity: [1, 2], quality: [60, 85] },
                { name: 'Pipe', quantity: [1, 1], quality: [50, 80] }
            ],
            disassembleTool: 'crowbar'
        }
    },
    
    counter: {
        name: 'Counter',
        furnitureType: 'counter',
        glyph: '=',
        fgColor: '#a9a9a9',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 45,
        maxHP: 45,
        durability: 1.2,
        blocked: true,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Under Counter', maxWeight: 6000, maxVolume: 10000 }
        ],
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [2, 3], quality: [60, 90] },
                { name: 'Nails', quantity: [2, 3], quality: [70, 100] }
            ],
            disassembleTool: 'screwdriver'
        }
    },
    
    stove: {
        name: 'Stove',
        furnitureType: 'stove',
        glyph: '&',
        fgColor: '#555555',
        bgColor: '#3a3a3a',
        material: 'metal',
        hp: 80,
        maxHP: 80,
        durability: 2.0,
        blocked: true,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Metal Scraps', quantity: [3, 5], quality: [60, 85] },
                { name: 'Screws', quantity: [2, 3], quality: [70, 100] }
            ],
            disassembleTool: 'crowbar'
        }
    },
    
    toilet: {
        name: 'Toilet',
        furnitureType: 'toilet',
        glyph: 'o',
        fgColor: '#dcdcdc',
        bgColor: '#3a3a3a',
        material: 'metal',
        hp: 40,
        maxHP: 40,
        durability: 1.3,
        blocked: true,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Metal Scraps', quantity: [1, 2], quality: [50, 75] },
                { name: 'Pipe', quantity: [1, 1], quality: [40, 70] }
            ],
            disassembleTool: 'crowbar'
        }
    },
    
    shower: {
        name: 'Shower',
        furnitureType: 'shower',
        glyph: '~',
        fgColor: '#87ceeb',
        bgColor: '#3a3a3a',
        material: 'metal',
        hp: 30,
        maxHP: 30,
        durability: 1.0,
        blocked: false,
        blocksVision: false,
        isContainer: false,
        dropTable: {
            materials: [
                { name: 'Pipe', quantity: [1, 2], quality: [50, 80] },
                { name: 'Metal Scraps', quantity: [1, 1], quality: [50, 75] }
            ],
            disassembleTool: 'crowbar'
        }
    },
    
    workbench: {
        name: 'Workbench',
        furnitureType: 'workbench',
        glyph: 'T',
        fgColor: '#8b7355',
        bgColor: '#3a3a3a',
        material: 'wood',
        hp: 50,
        maxHP: 50,
        durability: 1.3,
        blocked: true,
        blocksVision: false,
        isContainer: true,
        pockets: [
            { name: 'Workbench Surface', maxWeight: 8000, maxVolume: 12000 },
            { name: 'Tool Drawer', maxWeight: 4000, maxVolume: 5000 }
        ],
        dropTable: {
            materials: [
                { name: 'Wood Plank', quantity: [3, 4], quality: [70, 95] },
                { name: 'Nails', quantity: [3, 5], quality: [70, 100] },
                { name: 'Metal Scraps', quantity: [1, 2], quality: [60, 85] }
            ],
            disassembleTool: 'screwdriver'
        }
    }
};

/**
 * Furniture loot tables - what items spawn inside storage furniture
 * Keyed by room type, maps furniture type to weighted item pools
 */
export const FURNITURE_LOOT = {
    residential_kitchen: {
        cabinet: {
            spawnChance: 0.7,
            maxItems: 3,
            pools: [
                { familyId: 'can_sealed',     weight: 30 },
                { familyId: 'bottle_sealed',  weight: 20 },
                { familyId: 'knife',          weight: 8 },
                { familyId: 'canteen',        weight: 5 }
            ]
        },
        counter: {
            spawnChance: 0.5,
            maxItems: 2,
            pools: [
                { familyId: 'can_sealed',     weight: 25 },
                { familyId: 'bottle_sealed',  weight: 20 },
                { familyId: 'knife',          weight: 10 }
            ]
        }
    },
    residential_bathroom: {
        cabinet: {
            spawnChance: 0.6,
            maxItems: 2,
            pools: [
                { familyId: 'medkit',         weight: 30 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'strap',          weight: 8 }
            ]
        }
    },
    residential_bedroom: {
        dresser: {
            spawnChance: 0.6,
            maxItems: 3,
            pools: [
                { familyId: 'coat',           weight: 15 },
                { familyId: 'pants',          weight: 15 },
                { familyId: 'trenchcoat',     weight: 5 },
                { familyId: 'strap',          weight: 8 },
                { familyId: 'battery',        weight: 10 }
            ]
        }
    },
    residential_living: {
        cabinet: {
            spawnChance: 0.5,
            maxItems: 2,
            pools: [
                { familyId: 'battery',        weight: 15 },
                { familyId: 'can_sealed',     weight: 15 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'strap',          weight: 8 }
            ]
        },
        shelf: {
            spawnChance: 0.4,
            maxItems: 2,
            pools: [
                { familyId: 'battery',        weight: 15 },
                { familyId: 'bottle_sealed',  weight: 10 },
                { familyId: 'can_sealed',     weight: 10 }
            ]
        }
    },
    commercial_store: {
        shelf: {
            spawnChance: 0.7,
            maxItems: 3,
            pools: [
                { familyId: 'can_sealed',     weight: 25 },
                { familyId: 'bottle_sealed',  weight: 25 },
                { familyId: 'battery',        weight: 10 },
                { familyId: 'medkit',         weight: 5 }
            ]
        },
        counter: {
            spawnChance: 0.5,
            maxItems: 2,
            pools: [
                { familyId: 'battery',        weight: 15 },
                { familyId: 'can_sealed',     weight: 10 },
                { familyId: 'knife',          weight: 5 }
            ]
        }
    },
    commercial_backroom: {
        shelf: {
            spawnChance: 0.7,
            maxItems: 3,
            pools: [
                { familyId: 'can_sealed',     weight: 20 },
                { familyId: 'bottle_sealed',  weight: 20 },
                { familyId: 'pipe',           weight: 10 },
                { familyId: 'strap',          weight: 10 }
            ]
        },
        crate: {
            spawnChance: 0.6,
            maxItems: 3,
            pools: [
                { familyId: 'can_sealed',     weight: 20 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'battery',        weight: 10 },
                { familyId: 'pipe',           weight: 10 }
            ]
        }
    },
    office: {
        filing_cabinet: {
            spawnChance: 0.4,
            maxItems: 2,
            pools: [
                { familyId: 'battery',        weight: 15 },
                { familyId: 'strap',          weight: 8 },
                { familyId: 'shiv',           weight: 5 }
            ]
        }
    },
    office_reception: {
        filing_cabinet: {
            spawnChance: 0.4,
            maxItems: 2,
            pools: [
                { familyId: 'battery',        weight: 15 },
                { familyId: 'bottle_sealed',  weight: 10 }
            ]
        }
    },
    medical_store: {
        cabinet: {
            spawnChance: 0.7,
            maxItems: 3,
            pools: [
                { familyId: 'medkit',         weight: 40 },
                { familyId: 'bottle_sealed',  weight: 15 }
            ]
        },
        shelf: {
            spawnChance: 0.6,
            maxItems: 3,
            pools: [
                { familyId: 'medkit',         weight: 35 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'battery',        weight: 8 }
            ]
        }
    },
    medical_storage: {
        cabinet: {
            spawnChance: 0.8,
            maxItems: 4,
            pools: [
                { familyId: 'medkit',         weight: 45 },
                { familyId: 'bottle_sealed',  weight: 10 }
            ]
        },
        shelf: {
            spawnChance: 0.7,
            maxItems: 3,
            pools: [
                { familyId: 'medkit',         weight: 40 },
                { familyId: 'battery',        weight: 10 }
            ]
        }
    },
    medical_waiting: {
        cabinet: {
            spawnChance: 0.3,
            maxItems: 1,
            pools: [
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'battery',        weight: 10 }
            ]
        }
    },
    medical_exam: {
        cabinet: {
            spawnChance: 0.6,
            maxItems: 2,
            pools: [
                { familyId: 'medkit',         weight: 30 },
                { familyId: 'bottle_sealed',  weight: 10 },
                { familyId: 'knife',          weight: 5 }
            ]
        }
    },
    garage_bay: {
        workbench: {
            spawnChance: 0.6,
            maxItems: 3,
            pools: [
                { familyId: 'pipe',           weight: 20 },
                { familyId: 'strap',          weight: 15 },
                { familyId: 'battery',        weight: 10 }
            ]
        },
        locker: {
            spawnChance: 0.5,
            maxItems: 2,
            pools: [
                { familyId: 'coat',           weight: 10 },
                { familyId: 'pants',          weight: 10 },
                { familyId: 'pipe',           weight: 8 },
                { familyId: 'strap',          weight: 8 }
            ]
        }
    },
    garage_tools: {
        workbench: {
            spawnChance: 0.7,
            maxItems: 4,
            pools: [
                { familyId: 'pipe',           weight: 20 },
                { familyId: 'knife',          weight: 10 },
                { familyId: 'strap',          weight: 15 },
                { familyId: 'battery',        weight: 12 }
            ]
        },
        shelf: {
            spawnChance: 0.6,
            maxItems: 3,
            pools: [
                { familyId: 'pipe',           weight: 15 },
                { familyId: 'strap',          weight: 15 },
                { familyId: 'battery',        weight: 10 }
            ]
        }
    },
    warehouse_floor: {
        crate: {
            spawnChance: 0.5,
            maxItems: 3,
            pools: [
                { familyId: 'can_sealed',     weight: 15 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'pipe',           weight: 10 },
                { familyId: 'strap',          weight: 10 }
            ]
        },
        shelf: {
            spawnChance: 0.4,
            maxItems: 2,
            pools: [
                { familyId: 'can_sealed',     weight: 15 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'battery',        weight: 8 }
            ]
        }
    },
    warehouse_storage: {
        crate: {
            spawnChance: 0.7,
            maxItems: 4,
            pools: [
                { familyId: 'can_sealed',     weight: 20 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'pipe',           weight: 10 },
                { familyId: 'strap',          weight: 10 },
                { familyId: 'medkit',         weight: 5 }
            ]
        },
        shelf: {
            spawnChance: 0.6,
            maxItems: 3,
            pools: [
                { familyId: 'can_sealed',     weight: 20 },
                { familyId: 'bottle_sealed',  weight: 15 },
                { familyId: 'battery',        weight: 10 }
            ]
        }
    }
};

/**
 * Create a furniture instance
 */
export function createFurniture(furnitureType, x, y, z = 0) {
    const template = FURNITURE_TYPES[furnitureType];
    if (!template) {
        console.warn(`Unknown furniture type: ${furnitureType}, falling back to table`);
        return createFurniture('table', x, y, z);
    }
    
    return new Furniture({
        ...template,
        x,
        y,
        z
    });
}

/**
 * Populate a storage furniture piece with items based on room type
 * Uses FURNITURE_LOOT tables and ContentManager to create items
 */
export function populateFurniture(furniture, roomType, contentManager) {
    if (!furniture.isContainer || !furniture.pockets || furniture.pockets.length === 0) return;
    
    const roomLoot = FURNITURE_LOOT[roomType];
    if (!roomLoot) return;
    
    const furnitureLoot = roomLoot[furniture.furnitureType];
    if (!furnitureLoot) return;
    
    let itemCount = 0;
    const totalWeight = furnitureLoot.pools.reduce((sum, p) => sum + p.weight, 0);
    
    // Roll for items
    for (let i = 0; i < furnitureLoot.maxItems; i++) {
        if (Math.random() > furnitureLoot.spawnChance) continue;
        
        // Pick random item from pool
        let roll = Math.random() * totalWeight;
        let familyId = furnitureLoot.pools[furnitureLoot.pools.length - 1].familyId;
        for (const entry of furnitureLoot.pools) {
            roll -= entry.weight;
            if (roll <= 0) {
                familyId = entry.familyId;
                break;
            }
        }
        
        const item = contentManager.createItem(familyId);
        if (!item) continue;
        
        // Place in a random pocket that has space
        const pocketIndex = Math.floor(Math.random() * furniture.pockets.length);
        const pocket = furniture.pockets[pocketIndex];
        
        const itemWeight = item.weight || 100;
        const itemVolume = item.volume || 100;
        const currentWeight = (pocket.contents || []).reduce((sum, i) => sum + (i.weight || 100), 0);
        const currentVolume = (pocket.contents || []).reduce((sum, i) => sum + (i.volume || 100), 0);
        
        if (currentWeight + itemWeight <= pocket.maxWeight && currentVolume + itemVolume <= pocket.maxVolume) {
            if (!pocket.contents) pocket.contents = [];
            pocket.contents.push(item);
            itemCount++;
        }
    }
    
    return itemCount;
}
