export const TALENT_TREES = {
    combat_tactics: {
        id: 'combat_tactics',
        name: 'Combat Tactics',
        description: 'General fighting principles. Weapon handling and combat stances.',
        color: '#ff8844'
    },
    small_blades: {
        id: 'small_blades',
        name: 'Small Blades',
        description: 'Knives, shivs, and short cutting weapons. Speed and precision.',
        color: '#ffcc44'
    },
    blunt_weapons: {
        id: 'blunt_weapons',
        name: 'Blunt Weapons',
        description: 'Pipes, clubs, and improvised bludgeons. Stagger and crush.',
        color: '#cc8844'
    },
    unarmed: {
        id: 'unarmed',
        name: 'Unarmed Combat',
        description: 'Bare hands, elbows, knees, and the weight of your body.',
        color: '#ff4444'
    },
    survival: {
        id: 'survival',
        name: 'Survival',
        description: 'Toughness and the will to endure when everything is against you.',
        color: '#44aa44'
    }
};

export const TALENT_NODES = {
    // ── Combat Tactics ──────────────────────────────────────────────────
    weapon_aptitude: {
        id: 'weapon_aptitude',
        treeId: 'combat_tactics',
        name: 'Weapon Aptitude',
        description: '+10 hit chance and +5 accuracy with all held weapons.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { allWeaponHit: 10, allWeaponAccuracy: 5 }
    },
    stance_aggressive: {
        id: 'stance_aggressive',
        treeId: 'combat_tactics',
        name: 'Aggressive Stance',
        description: 'Unlock aggressive fighting stance. All-in — hit harder, get hit harder. +25% damage, +5 hit, +3 crit. +20% damage taken.',
        cost: 1,
        tier: 2,
        prerequisites: [],
        effects: { unlocksStance: 'aggressive' }
    },
    stance_defensive: {
        id: 'stance_defensive',
        treeId: 'combat_tactics',
        name: 'Defensive Stance',
        description: 'Unlock defensive fighting stance. Guard up — survive and retreat. -30% damage taken, -30% damage dealt. Safe disengage.',
        cost: 1,
        tier: 2,
        prerequisites: [],
        effects: { unlocksStance: 'defensive' }
    },
    stance_opportunistic: {
        id: 'stance_opportunistic',
        treeId: 'combat_tactics',
        name: 'Opportunistic Stance',
        description: 'Unlock opportunistic stance. Read the fight — exploit wounds and openings. +10% crit on wounded parts.',
        cost: 1,
        tier: 2,
        prerequisites: [],
        effects: { unlocksStance: 'opportunistic' }
    },

    // ── Small Blades ─────────────────────────────────────────────────────
    blades_crit: {
        id: 'blades_crit',
        treeId: 'small_blades',
        name: 'Razor Edge',
        description: '+5% critical hit chance with small blade weapons.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { sharpCritBonus: 5 }
    },
    blades_accuracy: {
        id: 'blades_accuracy',
        treeId: 'small_blades',
        name: 'Sure Strike',
        description: '+10 hit chance with small blade weapons.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { sharpHitBonus: 10 }
    },
    blades_hamstring: {
        id: 'blades_hamstring',
        treeId: 'small_blades',
        name: 'Hamstring',
        description: 'Unlocks the Hamstring ability. Slash the leg — heavy bleed, cripples movement.',
        cost: 2,
        tier: 2,
        prerequisites: [],
        effects: { unlocksAbility: 'hamstring' }
    },
    blades_disarm: {
        id: 'blades_disarm',
        treeId: 'small_blades',
        name: 'Disarm',
        description: 'Unlocks the Disarm ability. Slash the weapon hand to make them drop it. Requires Defensive Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_defensive'],
        effects: { unlocksAbility: 'disarm' }
    },
    blades_flurry: {
        id: 'blades_flurry',
        treeId: 'small_blades',
        name: 'Flurry',
        description: 'Unlocks the Flurry ability. Two rapid slashes — stacks wounds fast.',
        cost: 2,
        tier: 2,
        prerequisites: ['blades_accuracy'],
        effects: { unlocksAbility: 'flurry' }
    },
    blades_throat_slash: {
        id: 'blades_throat_slash',
        treeId: 'small_blades',
        name: 'Throat Slash',
        description: 'Unlocks the Throat Slash ability. Lethal neck strike — causes arterial bleed. Requires Opportunistic Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_opportunistic'],
        effects: { unlocksAbility: 'throat_slash' }
    },
    blades_precision_stab: {
        id: 'blades_precision_stab',
        treeId: 'small_blades',
        name: 'Precision Stab',
        description: 'Unlocks the Precision Stab ability. Target existing wounds — bypasses armor. Requires Opportunistic Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_opportunistic'],
        effects: { unlocksAbility: 'precision_stab' }
    },

    // ── Blunt Weapons ────────────────────────────────────────────────────
    blunt_damage: {
        id: 'blunt_damage',
        treeId: 'blunt_weapons',
        name: 'Heavy Hitter',
        description: '+2 flat damage with blunt weapons.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { bluntDamageBonus: 2 }
    },
    blunt_stagger: {
        id: 'blunt_stagger',
        treeId: 'blunt_weapons',
        name: 'Bone Breaker',
        description: '+15% stagger chance with blunt weapons.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { bluntStaggerBonus: 0.15 }
    },
    blunt_limb_breaker: {
        id: 'blunt_limb_breaker',
        treeId: 'blunt_weapons',
        name: 'Limb Breaker',
        description: 'Unlocks the Limb Breaker ability. Target a specific limb with a crushing blow.',
        cost: 2,
        tier: 2,
        prerequisites: ['blunt_damage'],
        effects: { unlocksAbility: 'limb_breaker' }
    },
    blunt_skull_crack: {
        id: 'blunt_skull_crack',
        treeId: 'blunt_weapons',
        name: 'Skull Crack',
        description: 'Unlocks the Concussion ability. Overhead strike that stuns for 1 turn. Requires Aggressive Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_aggressive'],
        effects: { unlocksAbility: 'concussion' }
    },
    blunt_guard_break: {
        id: 'blunt_guard_break',
        treeId: 'blunt_weapons',
        name: 'Guard Break',
        description: 'Unlocks the Guard Break ability. Strike the blocking arm to halve their intercept. Requires Opportunistic Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_opportunistic'],
        effects: { unlocksAbility: 'guard_break' }
    },
    blunt_sweeping_strike: {
        id: 'blunt_sweeping_strike',
        treeId: 'blunt_weapons',
        name: 'Sweeping Strike',
        description: 'Unlocks the Sweeping Strike ability. Wide low swing targeting both legs — knocks prone.',
        cost: 2,
        tier: 2,
        prerequisites: ['blunt_stagger'],
        effects: { unlocksAbility: 'sweeping_strike' }
    },
    blunt_measured_strike: {
        id: 'blunt_measured_strike',
        treeId: 'blunt_weapons',
        name: 'Measured Strike',
        description: 'Unlocks the Measured Strike ability. Careful blow to a wounded part — high accuracy. Requires Defensive Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_defensive'],
        effects: { unlocksAbility: 'measured_strike' }
    },

    // ── Unarmed ──────────────────────────────────────────────────────────
    unarmed_damage: {
        id: 'unarmed_damage',
        treeId: 'unarmed',
        name: 'Iron Fists',
        description: '+2 flat damage when fighting unarmed.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { unarmedDamageBonus: 2 }
    },
    unarmed_hit: {
        id: 'unarmed_hit',
        treeId: 'unarmed',
        name: 'Brawler',
        description: '+15 hit chance when fighting unarmed.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { unarmedHitBonus: 15 }
    },
    unarmed_tackle: {
        id: 'unarmed_tackle',
        treeId: 'unarmed',
        name: 'Tackle',
        description: 'Unlocks the Tackle ability. Rush the target — both go prone. Requires Aggressive Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_aggressive'],
        effects: { unlocksAbility: 'tackle' }
    },
    unarmed_eye_gouge: {
        id: 'unarmed_eye_gouge',
        treeId: 'unarmed',
        name: 'Eye Gouge',
        description: 'Unlocks the Eye Gouge ability. Jab the eyes — reduces enemy crit permanently. Requires Opportunistic Stance.',
        cost: 2,
        tier: 2,
        prerequisites: ['stance_opportunistic'],
        effects: { unlocksAbility: 'eye_gouge' }
    },
    unarmed_chokehold: {
        id: 'unarmed_chokehold',
        treeId: 'unarmed',
        name: 'Chokehold',
        description: 'Unlocks the Chokehold ability. Grapple and suffocate the enemy over 3 turns.',
        cost: 2,
        tier: 2,
        prerequisites: ['unarmed_damage'],
        effects: { unlocksAbility: 'chokehold' }
    },
    unarmed_kidney_shot: {
        id: 'unarmed_kidney_shot',
        treeId: 'unarmed',
        name: 'Kidney Shot',
        description: 'Unlocks the Kidney Shot ability. Brutal organ blow — massive pain, can trigger shock.',
        cost: 2,
        tier: 2,
        prerequisites: ['unarmed_hit'],
        effects: { unlocksAbility: 'kidney_shot' }
    },
    unarmed_headbutt: {
        id: 'unarmed_headbutt',
        treeId: 'unarmed',
        name: 'Headbutt',
        description: 'Unlocks the Headbutt ability. Stun the target — you take 40% of the damage dealt.',
        cost: 2,
        tier: 2,
        prerequisites: ['unarmed_damage'],
        effects: { unlocksAbility: 'headbutt' }
    },

    // ── Survival ─────────────────────────────────────────────────────────
    survival_tough_hide: {
        id: 'survival_tough_hide',
        treeId: 'survival',
        name: 'Tough Hide',
        description: '+10 maximum blood. You bleed out slower.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { maxBloodBonus: 10 }
    },
    survival_fast_clotter: {
        id: 'survival_fast_clotter',
        treeId: 'survival',
        name: 'Fast Clotter',
        description: 'Wounds clot 25% faster.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { clotRateBonus: 0.25 }
    },
    survival_pain_resistance: {
        id: 'survival_pain_resistance',
        treeId: 'survival',
        name: 'Pain Resistance',
        description: '+15 shock threshold. You can absorb more pain before going into shock.',
        cost: 1,
        tier: 1,
        prerequisites: [],
        effects: { shockThresholdBonus: 15 }
    },
    survival_adrenaline: {
        id: 'survival_adrenaline',
        treeId: 'survival',
        name: 'Adrenaline Rush',
        description: 'When below 25% blood, your action costs drop by 20%.',
        cost: 2,
        tier: 2,
        prerequisites: ['survival_tough_hide'],
        effects: { adrenalineRush: true }
    },
    survival_iron_constitution: {
        id: 'survival_iron_constitution',
        treeId: 'survival',
        name: 'Iron Constitution',
        description: 'Reduces wound infection chance by 50%.',
        cost: 2,
        tier: 2,
        prerequisites: ['survival_fast_clotter'],
        effects: { infectionResist: 0.5 }
    }
};

export class TalentEffects {
    /**
     * Get the sum of a numeric talent effect across all of the player's unlocked talents.
     */
    static getSum(player, effectKey) {
        if (!player.unlockedTalents || !player.unlockedTalents.length) return 0;
        let total = 0;
        for (const talentId of player.unlockedTalents) {
            const node = TALENT_NODES[talentId];
            if (node && node.effects && typeof node.effects[effectKey] === 'number') {
                total += node.effects[effectKey];
            }
        }
        return total;
    }

    /**
     * Check if a player has a specific talent unlocked.
     */
    static has(player, talentId) {
        return !!(player.unlockedTalents && player.unlockedTalents.includes(talentId));
    }

    /**
     * Check if a player has an ability unlocked via any talent node.
     */
    static hasAbility(player, abilityId) {
        if (!player.unlockedTalents) return false;
        for (const talentId of player.unlockedTalents) {
            const node = TALENT_NODES[talentId];
            if (node && node.effects && node.effects.unlocksAbility === abilityId) return true;
        }
        return false;
    }

    /**
     * Get all stance keys the player has unlocked.
     * @returns {string[]} e.g. ['aggressive', 'opportunistic']
     */
    static getUnlockedStances(player) {
        const stances = [];
        if (!player.unlockedTalents) return stances;
        for (const talentId of player.unlockedTalents) {
            const node = TALENT_NODES[talentId];
            if (node && node.effects && node.effects.unlocksStance) {
                stances.push(node.effects.unlocksStance);
            }
        }
        return stances;
    }

    /**
     * Check whether a player meets all prerequisites to unlock a talent.
     */
    static canUnlock(player, talentId) {
        const node = TALENT_NODES[talentId];
        if (!node) return false;
        if (!node.prerequisites || node.prerequisites.length === 0) return true;
        return node.prerequisites.every(prereqId => TalentEffects.has(player, prereqId));
    }

    /**
     * Apply any one-time side effects of unlocking a talent to the player.
     * Called immediately after adding the talent to unlockedTalents.
     */
    static applyImmediateEffect(player, talentId) {
        const node = TALENT_NODES[talentId];
        if (!node || !node.effects) return;
        const fx = node.effects;

        if (fx.maxBloodBonus && player.anatomy) {
            player.anatomy.maxBlood = (player.anatomy.maxBlood || 100) + fx.maxBloodBonus;
            player.anatomy.blood = Math.min(player.anatomy.blood, player.anatomy.maxBlood);
        }
        if (fx.shockThresholdBonus && player.anatomy) {
            player.anatomy.shockThresholdBonus = (player.anatomy.shockThresholdBonus || 0) + fx.shockThresholdBonus;
        }
        if (fx.unlocksStance && !player.combatStance) {
            player.combatStance = fx.unlocksStance;
        }
    }
}
