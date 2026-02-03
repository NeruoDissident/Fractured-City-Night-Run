export class CharacterCreationSystem {
    constructor() {
        this.backgrounds = {
            streetKid: {
                name: 'Street Kid',
                description: 'Born in the ruins, raised by the streets. You know every alley, every hiding spot, every way to survive when you have nothing.',
                statMods: { agility: 2, perception: 1, intelligence: -1 },
                startingGear: ['rusty_knife', 'torn_jacket', 'lockpick'],
                traits: ['streetwise']
            },
            corpo: {
                name: 'Corporate Defector',
                description: 'You escaped the corporate towers with your life and little else. Your technical knowledge is valuable, but your soft hands betray your past.',
                statMods: { intelligence: 3, perception: 1, strength: -2 },
                startingGear: ['datapad', 'corpo_suit', 'access_card'],
                traits: ['tech_savvy']
            },
            nomad: {
                name: 'Nomad',
                description: 'The wasteland is your home. You\'ve walked further than most, survived worse than most, and you\'re tougher for it.',
                statMods: { endurance: 2, strength: 2, intelligence: -1 },
                startingGear: ['hunting_rifle', 'leather_jacket', 'water_canteen'],
                traits: ['wasteland_survivor']
            },
            scavenger: {
                name: 'Scavenger',
                description: 'You make your living picking through the bones of the old world. You have an eye for value and know how to find what others miss.',
                statMods: { perception: 3, agility: 1, strength: -1 },
                startingGear: ['crowbar', 'backpack', 'flashlight'],
                traits: ['keen_eye']
            },
            raiderDefector: {
                name: 'Raider Defector',
                description: 'You left the raider gangs behind, but the skills remain. You know how to fight, how to kill, and how to survive in a world that wants you dead.',
                statMods: { strength: 2, endurance: 1, intelligence: -1 },
                startingGear: ['machete', 'raider_armor', 'stimpak'],
                traits: ['combat_veteran']
            },
            medic: {
                name: 'Field Medic',
                description: 'In a world of violence, healers are rare and precious. You know anatomy, medicine, and how to keep people alive against all odds.',
                statMods: { intelligence: 2, perception: 2, strength: -2 },
                startingGear: ['scalpel', 'med_kit', 'white_coat'],
                traits: ['medical_training']
            }
        };
        
        this.traits = {
            // Positive traits (cost points)
            nightVision: {
                name: 'Night Vision',
                description: 'Your eyes adapt quickly to darkness. +2 vision range in low light.',
                cost: 2,
                type: 'positive',
                effect: { visionBonus: 2 }
            },
            quickReflexes: {
                name: 'Quick Reflexes',
                description: 'You react faster than most. -10% action cost for all actions.',
                cost: 3,
                type: 'positive',
                effect: { actionCostMod: 0.9 }
            },
            ironStomach: {
                name: 'Iron Stomach',
                description: 'You can eat almost anything without getting sick. Reduced food poisoning chance.',
                cost: 1,
                type: 'positive',
                effect: { poisonResist: 0.5 }
            },
            packRat: {
                name: 'Pack Rat',
                description: 'You know how to pack efficiently. +20% carrying capacity.',
                cost: 2,
                type: 'positive',
                effect: { carryMod: 1.2 }
            },
            lucky: {
                name: 'Lucky',
                description: 'Things just seem to go your way. Better loot drops and critical hits.',
                cost: 3,
                type: 'positive',
                effect: { luckBonus: 2 }
            },
            
            // Negative traits (give points)
            nearSighted: {
                name: 'Near-Sighted',
                description: 'You can\'t see as far as others. -2 vision range.',
                cost: -2,
                type: 'negative',
                effect: { visionPenalty: 2 }
            },
            weakConstitution: {
                name: 'Weak Constitution',
                description: 'You get sick easily and tire quickly. -10 max HP.',
                cost: -2,
                type: 'negative',
                effect: { maxHPMod: -10 }
            },
            slowHealer: {
                name: 'Slow Healer',
                description: 'Your wounds take longer to mend. -50% healing effectiveness.',
                cost: -2,
                type: 'negative',
                effect: { healingMod: 0.5 }
            },
            clumsy: {
                name: 'Clumsy',
                description: 'You\'re not very coordinated. +10% action cost for all actions.',
                cost: -2,
                type: 'negative',
                effect: { actionCostMod: 1.1 }
            },
            lightSleeper: {
                name: 'Light Sleeper',
                description: 'You wake easily and don\'t rest well. Reduced benefits from sleeping.',
                cost: -1,
                type: 'negative',
                effect: { restMod: 0.7 }
            }
        };
    }
    
    getBackground(backgroundId) {
        return this.backgrounds[backgroundId];
    }
    
    getTrait(traitId) {
        return this.traits[traitId];
    }
    
    getAllBackgrounds() {
        return Object.entries(this.backgrounds).map(([id, bg]) => ({
            id,
            ...bg
        }));
    }
    
    getAllTraits() {
        return Object.entries(this.traits).map(([id, trait]) => ({
            id,
            ...trait
        }));
    }
    
    getPositiveTraits() {
        return this.getAllTraits().filter(t => t.type === 'positive');
    }
    
    getNegativeTraits() {
        return this.getAllTraits().filter(t => t.type === 'negative');
    }
    
    calculateTraitPoints(selectedTraits) {
        let points = 3; // Starting points
        
        for (const traitId of selectedTraits) {
            const trait = this.traits[traitId];
            if (trait) {
                points -= trait.cost;
            }
        }
        
        return points;
    }
    
    validateCharacter(characterData) {
        const errors = [];
        
        if (!characterData.name || characterData.name.trim().length === 0) {
            errors.push('Name is required');
        }
        
        if (!characterData.background) {
            errors.push('Background is required');
        }
        
        const traitPoints = this.calculateTraitPoints(characterData.traits || []);
        if (traitPoints < 0) {
            errors.push('Not enough trait points');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    applyBackgroundToCharacter(player, backgroundId) {
        const background = this.backgrounds[backgroundId];
        if (!background) return;
        
        // Apply stat modifiers
        for (const [stat, mod] of Object.entries(background.statMods)) {
            player.stats[stat] = Math.max(1, player.stats[stat] + mod);
        }
        
        // Store background info
        player.background = background.name;
        player.backgroundId = backgroundId;
        
        // Background traits are automatically applied
        player.backgroundTraits = background.traits || [];
    }
    
    applyTraitsToCharacter(player, traitIds) {
        player.selectedTraits = traitIds || [];
        player.traitEffects = {};
        
        for (const traitId of traitIds) {
            const trait = this.traits[traitId];
            if (trait && trait.effect) {
                // Merge trait effects
                Object.assign(player.traitEffects, trait.effect);
            }
        }
    }
}
