// Descriptive labels for component properties at each tier
// Used by CraftingUI to show human-readable requirement text
export const PROPERTY_LABELS = {
    cutting:     { 1: 'Crude Edge',        2: 'Sharp Edge',         3: 'Fine Edge' },
    piercing:    { 1: 'Pointed',           2: 'Piercing Tip',       3: 'Needle Point' },
    grip:        { 1: 'Rough Grip',        2: 'Firm Grip',          3: 'Ergonomic Grip' },
    fastening:   { 1: 'Basic Fastener',    2: 'Secure Fastener',    3: 'Precision Fastener' },
    binding:     { 1: 'Loose Binding',     2: 'Firm Binding',       3: 'Tight Binding' },
    structural:  { 1: 'Flimsy Frame',      2: 'Sturdy Frame',       3: 'Rigid Frame' },
    padding:     { 1: 'Thin Padding',      2: 'Soft Padding',       3: 'Thick Padding' },
    insulation:  { 1: 'Light Insulation',  2: 'Good Insulation',    3: 'Heavy Insulation' },
    container:   { 1: 'Small Vessel',      2: 'Sealed Vessel',      3: 'Large Vessel' },
    blunt:       { 1: 'Blunt Weight',      2: 'Heavy Weight',       3: 'Crushing Weight' },
    grinding:    { 1: 'Abrasive',          2: 'Grinding Surface',   3: 'Fine Grindstone' },
    fuel:        { 1: 'Combustible',       2: 'Fuel Source',        3: 'High-Energy Fuel' },
    electrical:  { 1: 'Conductive Wire',   2: 'Wiring',             3: 'Circuit' },
    conductor:   { 1: 'Weak Conductor',    2: 'Conductor',          3: 'High Conductor' },
    chemical:    { 1: 'Mild Chemical',     2: 'Chemical Agent',     3: 'Potent Chemical' },
    medical:     { 1: 'Basic Medical',     2: 'Medical Supply',     3: 'Surgical Grade' },
    harnessing:   { 1: 'Simple Strap',     2: 'Sturdy Strap',       3: 'Reinforced Strap' },
    // Tool-action properties (for disassembly and crafting tool requirements)
    screwdriving: { 1: 'Screwdriver',      2: 'Precision Driver' },
    prying:       { 1: 'Pry Tool',         2: 'Heavy Pry Bar' },
    bolt_turning: { 1: 'Wrench',           2: 'Torque Wrench' }
};

/**
 * Get a human-readable label for a property requirement.
 * @param {string} property - Property name (e.g., 'cutting')
 * @param {number} minValue - Minimum required value
 * @param {number|undefined} maxValue - Maximum allowed value (tier cap)
 * @returns {string} - Display label (e.g., 'Sharp Edge' or 'Crude Edge only')
 */
export function getPropertyLabel(property, minValue, maxValue) {
    const labels = PROPERTY_LABELS[property];
    if (!labels) return `${property} +${minValue}`;
    
    // If maxValue is set and equals minValue, it's a tier-locked requirement
    if (maxValue !== undefined && maxValue === minValue) {
        return labels[minValue] || `${property} ${minValue}`;
    }
    
    // If maxValue is set but different from minValue, show range
    if (maxValue !== undefined) {
        const minLabel = labels[minValue] || `${property} ${minValue}`;
        return `${minLabel} (max tier ${maxValue})`;
    }
    
    // No maxValue — just show the minimum tier label
    return labels[minValue] || `${property} +${minValue}`;
}

export class ContentManager {
    constructor() {
        this.materials = {};
        this.itemFamilies = {};
        this.modifiers = {};
        this.cybernetics = {};
        this.traits = {};
        this.components = {};
    }
    
    loadContent() {
        this.loadComponents();
        this.loadMaterials();
        this.loadItemFamilies();
        this.loadModifiers();
        this.loadCybernetics();
        this.loadTraits();
    }
    
    loadComponents() {
        // Master component library - all possible components that can be extracted/used
        this.components = {
            // Metal components
            scrap_metal_shard: {
                name: 'Metal Shard',
                type: 'component',
                isComponent: true,
                weight: 50,
                volume: 30,
                tags: ['metal', 'sharp'],
                stackable: true,
                properties: {
                    cutting: 1,
                    piercing: 1
                }
            },
            metal_tube: {
                name: 'Metal Tube',
                type: 'component',
                isComponent: true,
                weight: 200,
                volume: 150,
                tags: ['metal', 'structural'],
                stackable: true,
                properties: {
                    structural: 2,
                    blunt: 1,
                    grip: 1
                }
            },
            blade: {
                name: 'Knife Blade',
                type: 'component',
                isComponent: true,
                weight: 80,
                volume: 50,
                tags: ['metal', 'sharp'],
                stackable: true,
                properties: {
                    cutting: 3,
                    piercing: 2
                }
            },
            rivet: {
                name: 'Rivet',
                type: 'component',
                isComponent: true,
                weight: 5,
                volume: 2,
                tags: ['metal', 'fastener'],
                stackable: true,
                properties: {
                    fastening: 1
                }
            },
            screw: {
                name: 'Screw',
                type: 'component',
                isComponent: true,
                weight: 3,
                volume: 1,
                tags: ['metal', 'fastener'],
                stackable: true,
                properties: {
                    fastening: 2
                }
            },
            wire: {
                name: 'Wire',
                type: 'component',
                isComponent: true,
                weight: 10,
                volume: 5,
                tags: ['metal', 'flexible'],
                stackable: true,
                properties: {
                    binding: 2,
                    electrical: 1
                }
            },
            blade_wheel: {
                name: 'Cutting Wheel',
                type: 'component',
                isComponent: true,
                weight: 30,
                volume: 20,
                tags: ['metal', 'sharp', 'tool'],
                stackable: true,
                properties: {
                    cutting: 2,
                    piercing: 1
                }
            },
            tin_can: {
                name: 'Tin Can',
                type: 'component',
                isComponent: true,
                weight: 50,
                volume: 80,
                tags: ['metal', 'container'],
                stackable: true,
                properties: {
                    container: 1
                }
            },
            can_lid: {
                name: 'Can Lid',
                type: 'component',
                isComponent: true,
                weight: 10,
                volume: 10,
                tags: ['metal', 'sharp'],
                stackable: true,
                properties: {
                    cutting: 1
                }
            },
            metal_casing: {
                name: 'Metal Casing',
                type: 'component',
                isComponent: true,
                weight: 15,
                volume: 8,
                tags: ['metal', 'container'],
                stackable: true,
                properties: {
                    container: 1,
                    structural: 1
                }
            },
            metal_bottle: {
                name: 'Metal Bottle',
                type: 'component',
                isComponent: true,
                weight: 150,
                volume: 250,
                tags: ['metal', 'container', 'liquid'],
                stackable: true,
                properties: {
                    container: 2
                }
            },
            
            // Fabric components
            fabric_panel: {
                name: 'Fabric Panel',
                type: 'component',
                isComponent: true,
                weight: 100,
                volume: 200,
                tags: ['fabric', 'flexible'],
                stackable: true,
                properties: {
                    padding: 2,
                    insulation: 1,
                    binding: 1
                }
            },
            cloth_wrap: {
                name: 'Cloth Wrap',
                type: 'component',
                isComponent: true,
                weight: 20,
                volume: 30,
                tags: ['fabric', 'flexible'],
                stackable: true,
                properties: {
                    grip: 1,
                    padding: 1,
                    binding: 1
                }
            },
            thread: {
                name: 'Thread',
                type: 'component',
                isComponent: true,
                weight: 5,
                volume: 10,
                tags: ['fabric', 'binding'],
                stackable: true,
                properties: {
                    binding: 1,
                    fastening: 1
                }
            },
            strap: {
                name: 'Strap',
                type: 'component',
                isComponent: true,
                weight: 50,
                volume: 80,
                tags: ['fabric', 'flexible', 'structural'],
                stackable: true,
                properties: {
                    harnessing: 2,
                    structural: 1
                }
            },
            leather_piece: {
                name: 'Leather Piece',
                type: 'component',
                isComponent: true,
                weight: 20,
                volume: 40,
                tags: ['leather', 'flexible'],
                stackable: true,
                properties: {
                    grip: 2,
                    padding: 1,
                    binding: 1
                }
            },
            
            // Plastic components
            plastic_bottle: {
                name: 'Plastic Bottle',
                type: 'component',
                isComponent: true,
                weight: 30,
                volume: 100,
                tags: ['plastic', 'container', 'liquid'],
                stackable: true,
                properties: {
                    container: 1
                }
            },
            plastic_case: {
                name: 'Plastic Case',
                type: 'component',
                isComponent: true,
                weight: 80,
                volume: 150,
                tags: ['plastic', 'container'],
                stackable: true,
                properties: {
                    container: 1
                }
            },
            bottle_cap: {
                name: 'Bottle Cap',
                type: 'component',
                isComponent: true,
                weight: 5,
                volume: 5,
                tags: ['plastic', 'seal'],
                stackable: true,
                properties: {
                    fastening: 1
                }
            },
            screw_cap: {
                name: 'Screw Cap',
                type: 'component',
                isComponent: true,
                weight: 20,
                volume: 15,
                tags: ['plastic', 'seal'],
                stackable: true,
                properties: {
                    fastening: 1
                }
            },
            button: {
                name: 'Button',
                type: 'component',
                isComponent: true,
                weight: 2,
                volume: 1,
                tags: ['plastic', 'fastener'],
                stackable: true,
                properties: {
                    fastening: 1
                }
            },
            zipper: {
                name: 'Zipper',
                type: 'component',
                isComponent: true,
                weight: 15,
                volume: 20,
                tags: ['plastic', 'metal', 'fastener'],
                stackable: true,
                properties: {
                    fastening: 2
                }
            },
            buckle: {
                name: 'Buckle',
                type: 'component',
                isComponent: true,
                weight: 20,
                volume: 15,
                tags: ['plastic', 'metal', 'fastener'],
                stackable: true,
                properties: {
                    fastening: 2,
                    structural: 1
                }
            },
            
            // Generic components
            handle: {
                name: 'Handle',
                type: 'component',
                isComponent: true,
                weight: 40,
                volume: 60,
                tags: ['wood', 'plastic', 'grip'],
                stackable: true,
                properties: {
                    grip: 3,
                    structural: 1
                }
            },
            
            // Medical components
            bandage: {
                name: 'Bandage',
                type: 'component',
                isComponent: true,
                weight: 20,
                volume: 30,
                tags: ['medical', 'fabric'],
                stackable: true,
                actions: ['use'],
                medicalEffect: 'bandage',
                properties: {
                    medical: 1
                }
            },
            antiseptic: {
                name: 'Antiseptic',
                type: 'component',
                isComponent: true,
                weight: 50,
                volume: 50,
                tags: ['medical', 'liquid', 'chemical'],
                stackable: true,
                actions: ['use'],
                medicalEffect: 'antiseptic',
                properties: {
                    medical: 2,
                    chemical: 1
                }
            },
            painkiller: {
                name: 'Painkiller',
                type: 'component',
                isComponent: true,
                weight: 10,
                volume: 5,
                tags: ['medical', 'drug'],
                stackable: true,
                actions: ['use'],
                medicalEffect: 'painkiller',
                properties: {
                    medical: 2
                }
            },
            
            // Power components
            electrolyte_paste: {
                name: 'Electrolyte Paste',
                type: 'component',
                isComponent: true,
                weight: 8,
                volume: 5,
                tags: ['chemical', 'power'],
                stackable: true,
                properties: {
                    chemical: 2
                }
            },
            carbon_rod: {
                name: 'Carbon Rod',
                type: 'component',
                isComponent: true,
                weight: 5,
                volume: 3,
                tags: ['carbon', 'power'],
                stackable: true,
                properties: {
                    conductor: 2
                }
            },
            
            // Raw materials — found in the world, used to craft intermediates
            glass_shard: {
                name: 'Glass Shard',
                type: 'component',
                isComponent: true,
                weight: 15,
                volume: 10,
                tags: ['glass', 'sharp'],
                stackable: true,
                properties: {
                    cutting: 1,
                    piercing: 1
                }
            },
            wood_piece: {
                name: 'Wood Piece',
                type: 'component',
                isComponent: true,
                weight: 80,
                volume: 100,
                tags: ['wood', 'structural'],
                stackable: true,
                properties: {
                    structural: 1,
                    grip: 1,
                    fuel: 1
                }
            },
            stone: {
                name: 'Stone',
                type: 'component',
                isComponent: true,
                weight: 200,
                volume: 80,
                tags: ['stone', 'blunt'],
                stackable: true,
                properties: {
                    blunt: 2,
                    grinding: 2
                }
            },
            bone_shard: {
                name: 'Bone Shard',
                type: 'component',
                isComponent: true,
                weight: 20,
                volume: 15,
                tags: ['bone', 'sharp'],
                stackable: true,
                properties: {
                    piercing: 1,
                    structural: 1
                }
            },
            rubber_piece: {
                name: 'Rubber Piece',
                type: 'component',
                isComponent: true,
                weight: 30,
                volume: 40,
                tags: ['rubber', 'flexible'],
                stackable: true,
                properties: {
                    grip: 2,
                    padding: 1,
                    insulation: 2
                }
            },
            duct_tape: {
                name: 'Duct Tape',
                type: 'component',
                isComponent: true,
                weight: 40,
                volume: 30,
                tags: ['adhesive', 'flexible'],
                stackable: true,
                properties: {
                    binding: 2,
                    fastening: 1,
                    grip: 1
                }
            },
            nail: {
                name: 'Nail',
                type: 'component',
                isComponent: true,
                weight: 5,
                volume: 2,
                tags: ['metal', 'sharp', 'fastener'],
                stackable: true,
                properties: {
                    piercing: 1,
                    fastening: 1
                }
            }
        };
    }
    
    loadMaterials() {
        this.materials = {
            scrap_metal: {
                name: 'Scrap Metal',
                quality: 0.5,
                durabilityMod: 0.7,
                color: '#7a7a7a',
                tags: ['metal', 'conductive', 'structural']
            },
            carbon_steel: {
                name: 'Carbon Steel',
                quality: 1.0,
                durabilityMod: 1.0,
                color: '#4d5d68',
                tags: ['metal', 'conductive', 'structural']
            },
            copper_wire: {
                name: 'Copper Wire',
                quality: 1.0,
                durabilityMod: 0.8,
                color: '#b87333',
                tags: ['metal', 'conductive', 'wire']
            },
            plastic_scrap: {
                name: 'Plastic Scrap',
                quality: 0.4,
                durabilityMod: 0.5,
                color: '#666666',
                tags: ['insulator', 'cheap']
            },
            synth_fiber: {
                name: 'Synth Fiber',
                quality: 0.8,
                durabilityMod: 0.9,
                color: '#334455',
                tags: ['fabric', 'flexible']
            }
        };
    }
    
    loadItemFamilies() {
        this.itemFamilies = {
            // ── Intermediate craftable components ──────────────────────
            crude_blade: {
                name: 'Crude Blade',
                type: 'component',
                glyph: '-',
                slots: ['hand'],
                tags: ['component', 'metal', 'sharp'],
                weight: 60,
                volume: 35,
                isComponent: true,
                craftedComponentId: 'crude_blade',
                craftedProperties: { cutting: 2, piercing: 1 },
                components: [
                    { id: 'scrap_metal_shard', name: 'Metal Shard', quantity: 1, quality: 100, maxQuality: 100, weight: 50, volume: 30 },
                    { id: 'stone', name: 'Stone', quantity: 1, quality: 100, maxQuality: 100, weight: 200, volume: 80 }
                ],
                componentRequirements: [
                    { property: 'cutting', minValue: 1, quantity: 1, name: 'Sharp Material' },
                    { property: 'grinding', minValue: 1, quantity: 1, name: 'Abrasive Surface' }
                ],
                craftTime: 3,
                disassemblyMethods: {
                    hand: { componentYield: 0.5, qualityMod: 0.5, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d3',
                    actionCost: 100,
                    attackType: 'sharp',
                    bleedChance: 0.15,
                    canTwoHand: false
                }
            },
            sharpened_stick: {
                name: 'Sharpened Stick',
                type: 'component',
                glyph: '/',
                slots: ['hand'],
                tags: ['component', 'wood', 'sharp'],
                weight: 60,
                volume: 80,
                isComponent: true,
                craftedComponentId: 'sharpened_stick',
                craftedProperties: { piercing: 1, structural: 1 },
                components: [
                    { id: 'wood_piece', name: 'Wood Piece', quantity: 1, quality: 100, maxQuality: 100, weight: 80, volume: 100 },
                    { id: 'stone', name: 'Stone', quantity: 1, quality: 100, maxQuality: 100, weight: 200, volume: 80 }
                ],
                componentRequirements: [
                    { property: 'structural', minValue: 1, quantity: 1, name: 'Rigid Material' },
                    { property: 'grinding', minValue: 1, quantity: 1, name: 'Abrasive Surface' }
                ],
                craftTime: 2,
                disassemblyMethods: {
                    hand: { componentYield: 0.5, qualityMod: 0.5, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d3',
                    actionCost: 110,
                    attackType: 'sharp',
                    bleedChance: 0.10,
                    canTwoHand: false
                }
            },
            wrapped_handle: {
                name: 'Wrapped Handle',
                type: 'component',
                glyph: '|',
                slots: ['hand'],
                tags: ['component', 'grip'],
                weight: 50,
                volume: 60,
                isComponent: true,
                craftedComponentId: 'wrapped_handle',
                craftedProperties: { grip: 2, structural: 1 },
                components: [
                    { id: 'wood_piece', name: 'Wood Piece', quantity: 1, quality: 100, maxQuality: 100, weight: 80, volume: 100 },
                    { id: 'cloth_wrap', name: 'Cloth Wrap', quantity: 1, quality: 100, maxQuality: 100, weight: 20, volume: 30 }
                ],
                componentRequirements: [
                    { property: 'structural', minValue: 1, quantity: 1, name: 'Handle Core' },
                    { property: 'binding', minValue: 1, quantity: 1, name: 'Wrapping' }
                ],
                craftTime: 1,
                disassemblyMethods: {
                    hand: { componentYield: 1.0, qualityMod: 0.7, timeRequired: 1 }
                },
                weaponStats: null
            },
            strap: {
                name: 'Strap',
                type: 'component',
                glyph: '~',
                slots: ['hand'],
                tags: ['component', 'fabric', 'flexible'],
                weight: 50,
                volume: 80,
                isComponent: true,
                craftedComponentId: 'strap',
                craftedProperties: { harnessing: 2, structural: 1 },
                components: [
                    { id: 'fabric_panel', name: 'Fabric Panel', quantity: 1, quality: 100, maxQuality: 100, weight: 100, volume: 200 }
                ],
                componentRequirements: [
                    { property: 'padding', minValue: 1, quantity: 1, name: 'Flexible Material' }
                ],
                craftTime: 1,
                disassemblyMethods: {
                    hand: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 1 },
                    knife: { componentYield: 1.0, qualityMod: 0.9, timeRequired: 1 }
                },
                weaponStats: null
            },
            // ── Weapons ──────────────────────────────────────────────
            shiv: {
                name: 'Shiv',
                type: 'weapon',
                baseDamage: '1d4',
                actionCost: 100,
                glyph: '/',
                slots: ['hand'],
                canTwoHand: false,
                tags: ['melee', 'sharp', 'improvised'],
                weight: 80,
                volume: 60,
                components: [
                    { id: 'scrap_metal_shard', name: 'Metal Shard', quantity: 1, quality: 100, maxQuality: 100, weight: 50, volume: 30 },
                    { id: 'cloth_wrap', name: 'Cloth Wrap', quantity: 1, quality: 100, maxQuality: 100, weight: 20, volume: 30 }
                ],
                componentRequirements: [
                    { property: 'cutting', minValue: 1, maxValue: 1, quantity: 1, name: 'Small Sharp Edge' },
                    { property: 'grip', minValue: 1, quantity: 1, name: 'Grip Wrap' }
                ],
                craftTime: 1,
                disassemblyMethods: {
                    hand: { componentYield: 1.0, qualityMod: 0.7, timeRequired: 1 },
                    knife: { componentYield: 1.0, qualityMod: 0.9, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d4',
                    actionCost: 100,
                    attackType: 'sharp',
                    bleedChance: 0.30,
                    canTwoHand: false
                }
            },
            knife: {
                name: 'Knife',
                type: 'weapon',
                baseDamage: '1d6',
                actionCost: 100,
                glyph: '/',
                slots: ['hand'],
                canTwoHand: true,
                twoHandDamageBonus: '1d4',
                twoHandActionCost: 110,
                tags: ['melee', 'sharp', 'tool'],
                weight: 150,
                volume: 100,
                components: [
                    { id: 'blade', name: 'Knife Blade', quantity: 1, quality: 100, maxQuality: 100, weight: 80, volume: 50 },
                    { id: 'handle', name: 'Handle', quantity: 1, quality: 100, maxQuality: 100, weight: 40, volume: 60 },
                    { id: 'rivet', name: 'Rivet', quantity: 2, quality: 100, maxQuality: 100, weight: 5, volume: 2 }
                ],
                componentRequirements: [
                    { property: 'cutting', minValue: 2, quantity: 1, name: 'Blade' },
                    { property: 'grip', minValue: 2, quantity: 1, name: 'Handle' },
                    { property: 'fastening', minValue: 1, quantity: 2, name: 'Fasteners' }
                ],
                craftTime: 2,
                disassemblyMethods: {
                    hand: { componentYield: 0.66, qualityMod: 0.6, timeRequired: 2, excludeComponents: ['rivet'] },
                    knife: { componentYield: 1.0, qualityMod: 0.85, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d6',
                    actionCost: 100,
                    attackType: 'sharp',
                    bleedChance: 0.40,
                    canTwoHand: true,
                    twoHandDamage: '1d6+1d4',
                    twoHandActionCost: 110
                }
            },
            pipe: {
                name: 'Pipe',
                type: 'weapon',
                baseDamage: '1d8',
                actionCost: 120,
                glyph: '|',
                slots: ['hand'],
                canTwoHand: true,
                twoHandDamageBonus: '1d6',
                twoHandActionCost: 140,
                tags: ['melee', 'blunt', 'improvised'],
                weight: 400,
                volume: 200,
                components: [
                    { id: 'metal_tube', name: 'Metal Tube', quantity: 1, quality: 100, maxQuality: 100, weight: 400, volume: 200 }
                ],
                weaponStats: {
                    damage: '1d8',
                    actionCost: 120,
                    attackType: 'blunt',
                    stunChance: 0.10,
                    canTwoHand: true,
                    twoHandDamage: '1d8+1d6',
                    twoHandActionCost: 140
                }
            },
            trenchcoat: {
                name: 'Trenchcoat',
                type: 'armor',
                defense: 1,
                glyph: '[',
                slots: ['torso'],
                isContainer: true,
                pockets: [
                    { name: 'Left Pocket', maxWeight: 600, maxVolume: 1000, contents: [] },
                    { name: 'Right Pocket', maxWeight: 600, maxVolume: 1000, contents: [] },
                    { name: 'Inner Pocket', maxWeight: 400, maxVolume: 600, contents: [] }
                ],
                tags: ['armor', 'clothing', 'pockets'],
                weight: 1200,
                volume: 3000,
                components: [
                    { id: 'fabric_panel', name: 'Fabric Panel', quantity: 4, quality: 100, maxQuality: 100, weight: 100, volume: 200 },
                    { id: 'button', name: 'Button', quantity: 6, quality: 100, maxQuality: 100, weight: 2, volume: 1 },
                    { id: 'thread', name: 'Thread', quantity: 1, quality: 100, maxQuality: 100, weight: 5, volume: 10 },
                    { id: 'zipper', name: 'Zipper', quantity: 1, quality: 100, maxQuality: 100, weight: 15, volume: 20 }
                ],
                componentRequirements: [
                    { property: 'padding', minValue: 1, quantity: 4, name: 'Fabric Panels' },
                    { property: 'fastening', minValue: 1, quantity: 7, name: 'Fasteners' },
                    { component: 'thread', quantity: 1, name: 'Thread' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 0.75, qualityMod: 0.5, timeRequired: 3, excludeComponents: ['thread'] },
                    knife: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 2 }
                },
                weaponStats: null
            },
            medkit: {
                name: 'Medkit',
                type: 'container',
                glyph: '+',
                slots: ['hand'],
                tags: ['medical', 'container'],
                actions: ['treat'],
                isContainer: true,
                isMedkit: true,
                pockets: [
                    { name: 'Medical Supplies', maxWeight: 500, maxVolume: 400, contents: [] }
                ],
                weight: 100,
                volume: 200,
                components: [
                    { id: 'plastic_case', name: 'Plastic Case', quantity: 1, quality: 100, maxQuality: 100, weight: 80, volume: 150 }
                ],
                componentRequirements: [
                    { property: 'container', minValue: 1, quantity: 1, name: 'Case' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d2',
                    actionCost: 110,
                    attackType: 'blunt',
                    canTwoHand: false
                }
            },
            can_opener: {
                name: 'Can Opener',
                type: 'tool',
                glyph: '¬',
                color: '#999999',
                slots: ['hand'],
                tags: ['tool', 'opener'],
                weight: 80,
                volume: 100,
                durability: 100,
                components: [
                    { id: 'metal_casing', name: 'Metal Casing', quantity: 1, quality: 100, maxQuality: 100, weight: 15, volume: 8 },
                    { id: 'handle', name: 'Handle', quantity: 1, quality: 100, maxQuality: 100, weight: 40, volume: 60 }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 1.0, qualityMod: 0.6, timeRequired: 1 },
                    knife: { componentYield: 1.0, qualityMod: 0.9, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d2',
                    actionCost: 100,
                    attackType: 'blunt',
                    canTwoHand: false
                }
            },
            battery: {
                name: 'Battery',
                type: 'component',
                powerCapacity: 100,
                glyph: '=',
                slots: ['hand'],
                tags: ['power', 'component'],
                weight: 25,
                volume: 10,
                components: [
                    { id: 'metal_casing', name: 'Metal Casing', quantity: 1, quality: 100, maxQuality: 100, weight: 15, volume: 8 },
                    { id: 'electrolyte_paste', name: 'Electrolyte Paste', quantity: 1, quality: 100, maxQuality: 100, weight: 8, volume: 5 },
                    { id: 'carbon_rod', name: 'Carbon Rod', quantity: 1, quality: 100, maxQuality: 100, weight: 5, volume: 3 }
                ],
                componentRequirements: [
                    { property: 'container', minValue: 1, quantity: 1, name: 'Casing' },
                    { property: 'chemical', minValue: 1, quantity: 1, name: 'Chemical Agent' },
                    { property: 'conductor', minValue: 1, quantity: 1, name: 'Conductor' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 0.66, qualityMod: 0.5, timeRequired: 2 },
                    knife: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d2',
                    actionCost: 100,
                    attackType: 'blunt',
                    throwable: true,
                    canTwoHand: false
                }
            },
            can_sealed: {
                name: 'Sealed Can',
                type: 'container',
                glyph: 'c',
                color: '#888888',
                slots: ['hand'],
                isContainer: true,
                state: { opened: false, sealed: true },
                requiresOpener: true,
                openMethods: {
                    can_opener: { yield: 1.0, durabilityDamage: 0 },
                    knife: { yield: 0.8, durabilityDamage: 5 },
                    pipe: { yield: 0.5, durabilityDamage: 3 },
                    ground: { yield: 0.15, durabilityDamage: 0 }
                },
                contents: [],
                tags: ['container', 'sealed', 'metal'],
                weight: 100,
                volume: 150,
                components: [
                    { id: 'tin_can', name: 'Tin Can', quantity: 1, quality: 100, maxQuality: 100, weight: 50, volume: 80 },
                    { id: 'can_lid', name: 'Can Lid', quantity: 1, quality: 100, maxQuality: 100, weight: 10, volume: 10 }
                ],
                weaponStats: {
                    damage: '1d3',
                    actionCost: 100,
                    attackType: 'blunt',
                    canTwoHand: false
                }
            },
            beans: {
                name: 'Beans',
                type: 'food',
                glyph: '*',
                color: '#aa6644',
                slots: [],
                quantity: 400,
                quantityUnit: 'g',
                nutrition: { hunger: 30, thirst: -5 },
                tags: ['food', 'protein', 'stackable'],
                weight: 400,
                volume: 350,
                components: null,
                weaponStats: null
            },
            soup: {
                name: 'Soup',
                type: 'food',
                glyph: '*',
                color: '#cc8844',
                slots: [],
                quantity: 350,
                quantityUnit: 'g',
                nutrition: { hunger: 25, thirst: 10 },
                tags: ['food', 'liquid', 'stackable'],
                weight: 350,
                volume: 300,
                components: null,
                weaponStats: null
            },
            mystery_meat: {
                name: 'Mystery Meat',
                type: 'food',
                glyph: '*',
                color: '#884444',
                slots: [],
                quantity: 300,
                quantityUnit: 'g',
                nutrition: { hunger: 35, thirst: -10 },
                tags: ['food', 'protein', 'stackable'],
                weight: 300,
                volume: 250,
                components: null,
                weaponStats: null
            },
            bottle_sealed: {
                name: 'Sealed Bottle',
                type: 'container',
                glyph: 'b',
                color: '#666666',
                slots: ['hand'],
                isContainer: true,
                state: { opened: false, sealed: true },
                requiresOpener: false,
                openMethods: {
                    hand: { yield: 1.0, durabilityDamage: 0 },
                    knife: { yield: 0.95, durabilityDamage: 2 }
                },
                contents: [],
                tags: ['container', 'sealed', 'plastic'],
                weight: 50,
                volume: 120,
                components: [
                    { id: 'plastic_bottle', name: 'Plastic Bottle', quantity: 1, quality: 100, maxQuality: 100, weight: 30, volume: 100 },
                    { id: 'bottle_cap', name: 'Bottle Cap', quantity: 1, quality: 100, maxQuality: 100, weight: 5, volume: 5 }
                ],
                weaponStats: {
                    damage: '1d2',
                    actionCost: 90,
                    attackType: 'blunt',
                    throwable: true,
                    canTwoHand: false
                }
            },
            water: {
                name: 'Water',
                type: 'drink',
                glyph: '~',
                color: '#66aaff',
                slots: [],
                quantity: 500,
                quantityUnit: 'ml',
                nutrition: { thirst: 40, hunger: 0 },
                tags: ['drink', 'water', 'stackable'],
                weight: 500,
                volume: 500,
                components: null,
                weaponStats: null
            },
            soda: {
                name: 'Soda',
                type: 'drink',
                glyph: '~',
                color: '#ff8844',
                slots: [],
                quantity: 350,
                quantityUnit: 'ml',
                nutrition: { thirst: 25, hunger: 5 },
                tags: ['drink', 'sugar', 'stackable'],
                weight: 350,
                volume: 350,
                components: null,
                weaponStats: null
            },
            juice: {
                name: 'Juice',
                type: 'drink',
                glyph: '~',
                color: '#ffaa44',
                slots: [],
                quantity: 400,
                quantityUnit: 'ml',
                nutrition: { thirst: 35, hunger: 10 },
                tags: ['drink', 'fruit', 'stackable'],
                weight: 400,
                volume: 400,
                components: null,
                weaponStats: null
            },
            coat: {
                name: 'Coat',
                type: 'armor',
                defense: 1,
                glyph: '[',
                slots: ['torso'],
                isContainer: true,
                pockets: [
                    { name: 'Left Pocket', maxWeight: 500, maxVolume: 800, contents: [] },
                    { name: 'Right Pocket', maxWeight: 500, maxVolume: 800, contents: [] },
                    { name: 'Inner Pocket', maxWeight: 300, maxVolume: 400, contents: [] }
                ],
                tags: ['armor', 'clothing', 'pockets'],
                weight: 900,
                volume: 2500,
                components: [
                    { id: 'fabric_panel', name: 'Fabric Panel', quantity: 3, quality: 100, maxQuality: 100, weight: 100, volume: 200 },
                    { id: 'button', name: 'Button', quantity: 5, quality: 100, maxQuality: 100, weight: 2, volume: 1 },
                    { id: 'thread', name: 'Thread', quantity: 1, quality: 100, maxQuality: 100, weight: 5, volume: 10 },
                    { id: 'zipper', name: 'Zipper', quantity: 1, quality: 100, maxQuality: 100, weight: 15, volume: 20 }
                ],
                componentRequirements: [
                    { property: 'padding', minValue: 1, quantity: 3, name: 'Fabric Panels' },
                    { property: 'fastening', minValue: 1, quantity: 6, name: 'Fasteners' },
                    { component: 'thread', quantity: 1, name: 'Thread' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 0.75, qualityMod: 0.5, timeRequired: 3, excludeComponents: ['thread'] },
                    knife: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 2 }
                },
                weaponStats: null
            },
            pants: {
                name: 'Pants',
                type: 'armor',
                defense: 0,
                glyph: '[',
                slots: ['legs'],
                isContainer: true,
                pockets: [
                    { name: 'Left Pocket', maxWeight: 400, maxVolume: 600, contents: [] },
                    { name: 'Right Pocket', maxWeight: 400, maxVolume: 600, contents: [] },
                    { name: 'Back Pocket', maxWeight: 200, maxVolume: 300, contents: [] }
                ],
                tags: ['clothing', 'pockets'],
                weight: 600,
                volume: 1500,
                components: [
                    { id: 'fabric_panel', name: 'Fabric Panel', quantity: 2, quality: 100, maxQuality: 100, weight: 100, volume: 200 },
                    { id: 'button', name: 'Button', quantity: 2, quality: 100, maxQuality: 100, weight: 2, volume: 1 },
                    { id: 'thread', name: 'Thread', quantity: 1, quality: 100, maxQuality: 100, weight: 5, volume: 10 },
                    { id: 'zipper', name: 'Zipper', quantity: 1, quality: 100, maxQuality: 100, weight: 15, volume: 20 }
                ],
                componentRequirements: [
                    { property: 'padding', minValue: 1, quantity: 2, name: 'Fabric Panels' },
                    { property: 'fastening', minValue: 1, quantity: 3, name: 'Fasteners' },
                    { component: 'thread', quantity: 1, name: 'Thread' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 0.75, qualityMod: 0.5, timeRequired: 2, excludeComponents: ['thread'] },
                    knife: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 1 }
                },
                weaponStats: null
            },
            canteen: {
                name: 'Canteen',
                type: 'container',
                glyph: 'u',
                slots: ['hand'],
                isContainer: true,
                maxWeight: 1000,
                maxVolume: 1000,
                liquidOnly: true,
                tags: ['container', 'liquid'],
                weight: 200,
                volume: 300,
                components: [
                    { id: 'metal_bottle', name: 'Metal Bottle', quantity: 1, quality: 100, maxQuality: 100, weight: 150, volume: 250 },
                    { id: 'screw_cap', name: 'Screw Cap', quantity: 1, quality: 100, maxQuality: 100, weight: 20, volume: 15 },
                    { id: 'strap', name: 'Strap', quantity: 1, quality: 100, maxQuality: 100, weight: 50, volume: 80 }
                ],
                componentRequirements: [
                    { property: 'container', minValue: 1, quantity: 1, name: 'Vessel' },
                    { property: 'fastening', minValue: 1, quantity: 1, name: 'Seal' },
                    { property: 'harnessing', minValue: 1, quantity: 1, name: 'Carry Strap' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 1.0, qualityMod: 0.7, timeRequired: 1 },
                    knife: { componentYield: 1.0, qualityMod: 0.9, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d3',
                    actionCost: 105,
                    attackType: 'blunt',
                    canTwoHand: false
                }
            },
            backpack: {
                name: 'Backpack',
                type: 'container',
                glyph: '[',
                slots: ['back'],
                isContainer: true,
                pockets: [
                    { name: 'Main Compartment', maxWeight: 8000, maxVolume: 12000, contents: [] },
                    { name: 'Front Pocket', maxWeight: 2000, maxVolume: 3000, contents: [] },
                    { name: 'Side Pocket', maxWeight: 1000, maxVolume: 1500, contents: [] }
                ],
                tags: ['container', 'storage'],
                weight: 800,
                volume: 4000,
                components: [
                    { id: 'fabric_panel', name: 'Fabric Panel', quantity: 3, quality: 100, maxQuality: 100, weight: 100, volume: 200 },
                    { id: 'strap', name: 'Strap', quantity: 2, quality: 100, maxQuality: 100, weight: 50, volume: 80 },
                    { id: 'buckle', name: 'Buckle', quantity: 2, quality: 100, maxQuality: 100, weight: 20, volume: 15 },
                    { id: 'zipper', name: 'Zipper', quantity: 2, quality: 100, maxQuality: 100, weight: 15, volume: 20 },
                    { id: 'thread', name: 'Thread', quantity: 1, quality: 100, maxQuality: 100, weight: 5, volume: 10 }
                ],
                componentRequirements: [
                    { component: 'fabric_panel', quantity: 3, name: 'Fabric Panel' },
                    { property: 'harnessing', minValue: 2, quantity: 2, name: 'Shoulder Straps' },
                    { property: 'fastening', minValue: 2, quantity: 2, name: 'Secure Fasteners' },
                    { component: 'thread', quantity: 1, name: 'Thread' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 0.75, qualityMod: 0.6, timeRequired: 3, excludeComponents: ['thread'] },
                    knife: { componentYield: 1.0, qualityMod: 0.85, timeRequired: 2 }
                },
                weaponStats: null
            },
            flashlight: {
                name: 'Flashlight',
                type: 'tool',
                glyph: '⌐',
                color: '#ffff88',
                slots: ['hand'],
                isContainer: true,
                contents: [],
                maxContents: 2,
                acceptsTags: ['power'],
                tags: ['tool', 'light', 'electronic'],
                weight: 200,
                volume: 150,
                lightRadius: 12,
                lightIntensity: 1.0,
                lightColor: '#ffee88',
                lightShape: 'cone',
                lightConeAngle: 60,
                fuelType: 'battery',
                fuelPerTurn: 0.02,
                components: [
                    { id: 'plastic_case', name: 'Plastic Case', quantity: 1, quality: 100, maxQuality: 100, weight: 80, volume: 150 },
                    { id: 'wire', name: 'Wire', quantity: 2, quality: 100, maxQuality: 100, weight: 10, volume: 5 },
                    { id: 'screw', name: 'Screw', quantity: 2, quality: 100, maxQuality: 100, weight: 3, volume: 1 }
                ],
                componentRequirements: [
                    { property: 'container', minValue: 1, quantity: 1, name: 'Casing' },
                    { property: 'electrical', minValue: 1, quantity: 2, name: 'Wiring' },
                    { property: 'fastening', minValue: 1, quantity: 2, name: 'Fasteners' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 0.66, qualityMod: 0.5, timeRequired: 2 },
                    knife: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d3',
                    actionCost: 100,
                    attackType: 'blunt',
                    canTwoHand: false
                }
            },
            lantern: {
                name: 'Lantern',
                type: 'tool',
                glyph: '♦',
                color: '#ffaa44',
                slots: ['hand'],
                isContainer: true,
                contents: [],
                maxContents: 1,
                acceptsTags: ['fuel'],
                tags: ['tool', 'light'],
                weight: 350,
                volume: 300,
                lightRadius: 7,
                lightIntensity: 0.9,
                lightColor: '#ffcc55',
                lightShape: 'radius',
                fuelType: 'lantern_fuel',
                fuelPerTurn: 0.03,
                components: [
                    { id: 'metal_casing', name: 'Metal Casing', quantity: 2, quality: 100, maxQuality: 100, weight: 15, volume: 8 },
                    { id: 'wire', name: 'Wire', quantity: 1, quality: 100, maxQuality: 100, weight: 10, volume: 5 },
                    { id: 'handle', name: 'Handle', quantity: 1, quality: 100, maxQuality: 100, weight: 40, volume: 60 }
                ],
                componentRequirements: [
                    { property: 'container', minValue: 1, quantity: 2, name: 'Casing' },
                    { property: 'electrical', minValue: 1, quantity: 1, name: 'Wick' },
                    { property: 'grip', minValue: 1, quantity: 1, name: 'Handle' }
                ],
                disassemblyMethods: {
                    hand: { componentYield: 0.66, qualityMod: 0.5, timeRequired: 2 },
                    knife: { componentYield: 1.0, qualityMod: 0.8, timeRequired: 1 }
                },
                weaponStats: {
                    damage: '1d4',
                    actionCost: 110,
                    attackType: 'blunt',
                    canTwoHand: false
                }
            },
            lantern_fuel: {
                name: 'Lantern Fuel',
                type: 'fuel',
                glyph: '~',
                color: '#ff8844',
                slots: [],
                quantity: 500,
                quantityUnit: 'ml',
                tags: ['fuel', 'liquid', 'flammable'],
                weight: 400,
                volume: 450,
                components: null,
                weaponStats: null
            }
        };
    }
    
    loadModifiers() {
        this.modifiers = {
            rusty: {
                name: 'Rusty',
                durabilityMod: 0.6,
                damageMod: 0.9,
                infectionRisk: 0.1,
                colorTint: '#8B4513'
            },
            reinforced: {
                name: 'Reinforced',
                durabilityMod: 1.5,
                defenseMod: 1.2,
                weightMod: 1.3,
                colorTint: '#555555'
            },
            makeshift: {
                name: 'Makeshift',
                durabilityMod: 0.5,
                qualityMod: 0.7,
                breakChance: 0.15,
                colorTint: '#666666'
            },
            sterile: {
                name: 'Sterile',
                infectionRisk: -0.2,
                medicalBonus: 1.2,
                colorTint: '#ffffff'
            }
        };
    }
    
    loadCybernetics() {
        this.cybernetics = {
            cyber_eye_v1: {
                name: 'Cyber Eye Mk1',
                slot: 'eye',
                bonuses: {
                    vision: 2,
                    perception: 1
                },
                drawbacks: {
                    powerDrain: 1,
                    glitchChance: 0.05
                },
                installRequirements: {
                    tools: ['surgical_kit'],
                    meds: ['anesthetic'],
                    skill: 3
                },
                installRisks: {
                    infection: 0.2,
                    shock: 0.1,
                    blindness: 0.05
                },
                glyph: 'o',
                color: '#00ffff'
            },
            crude_arm: {
                name: 'Crude Cyber Arm',
                slot: 'arm',
                bonuses: {
                    strength: 3,
                    carrying: 10
                },
                drawbacks: {
                    maintenanceFreq: 100,
                    powerDrain: 2,
                    dexterityPenalty: -1
                },
                installRequirements: {
                    tools: ['surgical_kit', 'welding_torch'],
                    meds: ['anesthetic', 'antibiotics'],
                    skill: 5
                },
                installRisks: {
                    infection: 0.3,
                    shock: 0.2,
                    nerveDamage: 0.1
                },
                glyph: 'A',
                color: '#888888'
            },
            subdermal_plating: {
                name: 'Subdermal Plating',
                slot: 'skin',
                bonuses: {
                    defense: 2,
                    bluntResist: 0.2
                },
                drawbacks: {
                    mobilityPenalty: -1,
                    infectionRisk: 0.1
                },
                installRequirements: {
                    tools: ['surgical_kit'],
                    meds: ['anesthetic', 'antibiotics'],
                    skill: 4
                },
                installRisks: {
                    infection: 0.25,
                    rejection: 0.15
                },
                glyph: '#',
                color: '#666666'
            }
        };
    }
    
    loadTraits() {
        this.traits = {
            street_doc: {
                name: 'Street Doc',
                description: 'Reduced cybernetic installation risks',
                effects: {
                    cyberInstallBonus: 2,
                    infectionResist: 0.1
                }
            },
            scavenger: {
                name: 'Scavenger',
                description: 'Better loot finds',
                effects: {
                    lootBonus: 1.2
                }
            },
            tough: {
                name: 'Tough',
                description: 'Increased HP',
                effects: {
                    hpBonus: 20
                }
            },
            quick: {
                name: 'Quick',
                description: 'Faster actions',
                effects: {
                    actionSpeedBonus: 0.9
                }
            }
        };
    }
    
    /**
     * Create a standalone component item from the component template library.
     * Used by loot tables to spawn raw materials directly.
     */
    createComponent(componentId) {
        const template = this.components[componentId];
        if (!template) return null;
        
        const comp = {
            id: `${componentId}_${Date.now()}_${Math.random()}`,
            componentId: componentId,
            name: template.name,
            type: 'component',
            glyph: '*',
            color: '#ffaa00',
            weight: template.weight,
            volume: template.volume,
            quantity: 1,
            stackable: template.stackable || false,
            tags: template.tags || [],
            properties: { ...(template.properties || {}) },
            isComponent: true
        };
        
        // Copy optional fields from template
        if (template.actions) comp.actions = [...template.actions];
        if (template.medicalEffect) comp.medicalEffect = template.medicalEffect;
        
        return comp;
    }
    
    createItem(familyId, materialId = null, modifierId = null) {
        const family = this.itemFamilies[familyId];
        if (!family) return null;
        
        const item = { ...family };
        item.id = `${familyId}_${Date.now()}_${Math.random()}`;
        
        // If this is a component-type item, add componentId and properties from component library
        if (family.type === 'component' && this.components[familyId]) {
            item.componentId = familyId;
            item.properties = { ...(this.components[familyId].properties || {}) };
            item.isComponent = true;
        }
        // Craftable intermediates: set componentId and merge craftedProperties
        if (family.craftedComponentId) {
            item.componentId = family.craftedComponentId;
            item.craftedProperties = { ...(family.craftedProperties || {}) };
            item.properties = { ...(item.properties || {}), ...item.craftedProperties };
            item.isComponent = true;
        }
        
        if (!item.weight) item.weight = this.getDefaultWeight(familyId);
        if (!item.volume) item.volume = this.getDefaultVolume(familyId);
        
        if (!item.isContainer) item.isContainer = false;
        if (!item.contents) item.contents = [];
        
        // Deep copy pockets to avoid shared references between items
        if (item.pockets) {
            item.pockets = item.pockets.map(p => ({ ...p, contents: [...(p.contents || [])] }));
        }
        
        if (materialId && this.materials[materialId]) {
            const material = this.materials[materialId];
            item.material = materialId;
            item.color = material.color;
            item.durability = 100 * material.durabilityMod;
            
            if (material.weightMod) {
                item.weight = Math.floor(item.weight * material.weightMod);
            }
        } else {
            // Don't assign default material - items now use component system
            if (!item.color) item.color = '#aaaaaa';
            if (item.durability === undefined) item.durability = 100;
        }
        
        if (modifierId && this.modifiers[modifierId]) {
            const modifier = this.modifiers[modifierId];
            item.modifier = modifierId;
            item.name = `${modifier.name} ${item.name}`;
            
            if (modifier.weightMod) {
                item.weight = Math.floor(item.weight * modifier.weightMod);
            }
        }
        
        // Initialize sealed containers with random contents
        if (familyId === 'can_sealed') {
            const canContents = ['beans', 'soup', 'mystery_meat'];
            const randomContent = canContents[Math.floor(Math.random() * canContents.length)];
            const content = this.createItem(randomContent);
            item.contents = [content];
            // Update container name to reflect contents
            item.name = `Sealed Can (${content.name})`;
        } else if (familyId === 'bottle_sealed') {
            const bottleContents = ['water', 'soda', 'juice'];
            const randomContent = bottleContents[Math.floor(Math.random() * bottleContents.length)];
            const content = this.createItem(randomContent);
            item.contents = [content];
            // Update container name to reflect contents
            item.name = `Sealed Bottle (${content.name})`;
        } else if (familyId === 'flashlight') {
            // Flashlight spawns with 2 batteries inside
            const bat1 = this.createItem('battery');
            const bat2 = this.createItem('battery');
            item.contents = [bat1, bat2];
        } else if (familyId === 'lantern') {
            // Lantern spawns with fuel inside
            const fuel = this.createItem('lantern_fuel');
            item.contents = [fuel];
        } else if (familyId === 'medkit') {
            // Medkit spawns with randomized medical supplies
            const pocket = item.pockets[0];
            // Bandages: 1-4
            const bandageCount = 1 + Math.floor(Math.random() * 4);
            for (let i = 0; i < bandageCount; i++) {
                pocket.contents.push(this.createComponent('bandage'));
            }
            // Antiseptic: 0-2
            const antisepticCount = Math.floor(Math.random() * 3);
            for (let i = 0; i < antisepticCount; i++) {
                pocket.contents.push(this.createComponent('antiseptic'));
            }
            // Painkillers: 0-3
            const painkillerCount = Math.floor(Math.random() * 4);
            for (let i = 0; i < painkillerCount; i++) {
                pocket.contents.push(this.createComponent('painkiller'));
            }
        }
        
        // Deep copy state object to avoid shared references
        if (item.state) {
            item.state = { ...item.state };
        }
        
        return item;
    }
    
    getDefaultWeight(familyId) {
        const weights = {
            knife: 200,
            pipe: 800,
            pistol: 900,
            rifle: 3500,
            trenchcoat: 1500,
            medkit: 500,
            battery: 100,
            backpack: 600,
            wallet: 50,
            canteen: 300,
            can_opener: 80,
            can_sealed: 450,
            beans: 400,
            soup: 350,
            mystery_meat: 300,
            bottle_sealed: 520,
            water: 500,
            soda: 350,
            juice: 400
        };
        return weights[familyId] || 100;
    }
    
    getDefaultVolume(familyId) {
        const volumes = {
            knife: 150,
            pipe: 800,
            pistol: 400,
            rifle: 2000,
            trenchcoat: 3000,
            medkit: 800,
            battery: 50,
            backpack: 1000,
            wallet: 100,
            canteen: 400,
            can_opener: 100,
            can_sealed: 420,
            beans: 400,
            soup: 350,
            mystery_meat: 300,
            bottle_sealed: 550,
            water: 500,
            soda: 350,
            juice: 400
        };
        return volumes[familyId] || 100;
    }
}
