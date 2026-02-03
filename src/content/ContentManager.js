export class ContentManager {
    constructor() {
        this.materials = {};
        this.itemFamilies = {};
        this.modifiers = {};
        this.cybernetics = {};
        this.traits = {};
    }
    
    loadContent() {
        this.loadMaterials();
        this.loadItemFamilies();
        this.loadModifiers();
        this.loadCybernetics();
        this.loadTraits();
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
            shiv: {
                name: 'Shiv',
                type: 'weapon',
                baseDamage: '1d4',
                actionCost: 100,
                glyph: '/',
                slots: ['hand'],
                canTwoHand: false,
                tags: ['melee', 'sharp', 'improvised']
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
                tags: ['melee', 'sharp', 'tool']
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
                tags: ['melee', 'blunt', 'improvised']
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
                tags: ['armor', 'clothing', 'pockets']
            },
            medkit: {
                name: 'Medkit',
                type: 'consumable',
                healAmount: 20,
                glyph: '+',
                slots: [],
                tags: ['medical', 'consumable']
            },
            battery: {
                name: 'Battery',
                type: 'component',
                powerCapacity: 100,
                glyph: '=',
                slots: [],
                tags: ['power', 'component']
            },
            backpack: {
                name: 'Backpack',
                type: 'container',
                glyph: '(',
                slots: [],
                isContainer: true,
                maxWeight: 15000,
                maxVolume: 25000,
                tags: ['container', 'storage']
            },
            wallet: {
                name: 'Wallet',
                type: 'container',
                glyph: '=',
                slots: [],
                isContainer: true,
                maxWeight: 200,
                maxVolume: 300,
                tags: ['container', 'small']
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
                tags: ['armor', 'clothing', 'pockets']
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
                tags: ['clothing', 'pockets']
            },
            canteen: {
                name: 'Canteen',
                type: 'container',
                glyph: 'u',
                slots: [],
                isContainer: true,
                maxWeight: 1000,
                maxVolume: 1000,
                liquidOnly: true,
                tags: ['container', 'liquid']
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
    
    createItem(familyId, materialId = null, modifierId = null) {
        const family = this.itemFamilies[familyId];
        if (!family) return null;
        
        const item = { ...family };
        item.id = `${familyId}_${Date.now()}_${Math.random()}`;
        
        if (!item.weight) item.weight = this.getDefaultWeight(familyId);
        if (!item.volume) item.volume = this.getDefaultVolume(familyId);
        
        if (!item.isContainer) item.isContainer = false;
        if (!item.contents) item.contents = [];
        
        if (materialId && this.materials[materialId]) {
            const material = this.materials[materialId];
            item.material = materialId;
            item.color = material.color;
            item.durability = 100 * material.durabilityMod;
            
            if (material.weightMod) {
                item.weight = Math.floor(item.weight * material.weightMod);
            }
        } else {
            item.color = '#aaaaaa';
            item.durability = 100;
        }
        
        if (modifierId && this.modifiers[modifierId]) {
            const modifier = this.modifiers[modifierId];
            item.modifier = modifierId;
            item.name = `${modifier.name} ${item.name}`;
            
            if (modifier.weightMod) {
                item.weight = Math.floor(item.weight * modifier.weightMod);
            }
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
            canteen: 300
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
            canteen: 400
        };
        return volumes[familyId] || 100;
    }
}
