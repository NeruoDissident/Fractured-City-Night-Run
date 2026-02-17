/**
 * AbilitySystem — Manages combat abilities tied to weapon types, stat thresholds, and stances.
 * 
 * Abilities are data-driven, defined in ABILITY_DATA below.
 * Each ability has:
 *   - weaponType: 'blunt', 'sharp', or 'unarmed'
 *   - statRequirements: { stat: minValue, ... }
 *   - preferredStance: stance that grants bonuses (soft lock — usable in any stance)
 *   - actionCost: AP cost to use the ability
 *   - effects: what happens on hit (targeted body part, stun, bleed, etc.)
 */

// ── Ability Definitions ──────────────────────────────────────────────────

const ABILITY_DATA = {
    // ── Blunt Weapon Abilities ───────────────────────────────────────────
    limb_breaker: {
        id: 'limb_breaker',
        name: 'Limb Breaker',
        description: 'Target a specific limb with a crushing blow. Arm hits reduce enemy hit chance and damage. Leg hits reduce dodge.',
        weaponType: 'blunt',
        statRequirements: { strength: 12 },
        preferredStance: 'aggressive',
        actionCost: 150,
        cooldown: 3,
        stanceBonus: { hitMod: 10, damageMod: 1.15 },
        wrongStancePenalty: { hitMod: -15, damageMod: 0.85 },
        effects: {
            targetRegion: 'choose_limb', // player picks arm or leg
            damageMultiplier: 1.4,
            bonusPainMod: 1.5,
            hitChanceMod: -5
        }
    },
    concussion: {
        id: 'concussion',
        name: 'Concussion',
        description: 'Overhead strike aimed at the skull. Stuns the target, skipping their next turn.',
        weaponType: 'blunt',
        statRequirements: { strength: 14, agility: 11 },
        preferredStance: 'aggressive',
        actionCost: 180,
        cooldown: 4,
        stanceBonus: { hitMod: 5, stunDurationBonus: 1 },
        wrongStancePenalty: { hitMod: -20, damageMod: 0.8 },
        effects: {
            targetRegion: 'head',
            targetPart: 'head', // glancing head hit
            damageMultiplier: 1.2,
            stunTurns: 1,
            hitChanceMod: -15
        }
    },
    sweeping_strike: {
        id: 'sweeping_strike',
        name: 'Sweeping Strike',
        description: 'Wide low swing targeting both legs. Knocks target prone (skip turn, easier to hit). Reduced damage per leg.',
        weaponType: 'blunt',
        statRequirements: { strength: 11, agility: 12 },
        preferredStance: 'aggressive',
        actionCost: 160,
        cooldown: 3,
        stanceBonus: { hitMod: 10, damageMod: 1.1 },
        wrongStancePenalty: { hitMod: -10, damageMod: 0.85 },
        effects: {
            targetRegion: 'both_legs',
            damageMultiplier: 0.7, // per leg
            hitChanceMod: -10,
            knockProne: true
        }
    },
    guard_break: {
        id: 'guard_break',
        name: 'Guard Break',
        description: 'Strike the arm they block with. Halves their arm block chance for 3 turns.',
        weaponType: 'blunt',
        statRequirements: { perception: 12 },
        preferredStance: 'opportunistic',
        actionCost: 140,
        cooldown: 4,
        stanceBonus: { hitMod: 10, effectDurationBonus: 1 },
        wrongStancePenalty: { hitMod: -10, damageMod: 0.9 },
        effects: {
            targetRegion: 'arm', // targets the stronger arm (intercept arm)
            damageMultiplier: 0.8,
            interceptReduction: 0.5, // halves intercept for duration
            effectDuration: 3, // turns
            hitChanceMod: 0
        }
    },
    measured_strike: {
        id: 'measured_strike',
        name: 'Measured Strike',
        description: 'Careful blow targeting an already-wounded body part. High accuracy, exploits existing injuries.',
        weaponType: 'blunt',
        statRequirements: { perception: 13, agility: 11 },
        preferredStance: 'defensive',
        actionCost: 130,
        cooldown: 2,
        stanceBonus: { hitMod: 15, critMod: 5 },
        wrongStancePenalty: { hitMod: -5, critMod: -3 },
        effects: {
            targetRegion: 'wounded', // auto-targets a wounded part
            damageMultiplier: 0.9,
            hitChanceMod: 15,
            exploitWounded: true
        }
    },

    // ── Sharp Weapon Abilities ───────────────────────────────────────────
    hamstring: {
        id: 'hamstring',
        name: 'Hamstring',
        description: 'Slash at the legs to cripple movement. Heavy bleed. Leg damage reduces enemy dodge chance.',
        weaponType: 'sharp',
        statRequirements: { agility: 12 },
        preferredStance: 'opportunistic',
        actionCost: 140,
        cooldown: 3,
        stanceBonus: { hitMod: 10, bleedMod: 1.5 },
        wrongStancePenalty: { hitMod: -10, bleedMod: 0.7 },
        effects: {
            targetRegion: 'choose_leg',
            damageMultiplier: 0.9,
            bleedSeverityMod: 2.0,
            hitChanceMod: -5
        }
    },
    throat_slash: {
        id: 'throat_slash',
        name: 'Throat Slash',
        description: 'Lethal strike at the neck. Very hard to land but causes arterial bleeding. Rapid blood loss.',
        weaponType: 'sharp',
        statRequirements: { agility: 14, perception: 12 },
        preferredStance: 'opportunistic',
        actionCost: 180,
        cooldown: 5,
        stanceBonus: { hitMod: 10, bleedMod: 2.0 },
        wrongStancePenalty: { hitMod: -25, bleedMod: 0.5 },
        effects: {
            targetRegion: 'head',
            targetPart: 'head', // neck area — treated as head glancing
            damageMultiplier: 1.3,
            bleedSeverityMod: 3.0,
            hitChanceMod: -25,
            arterialBleed: true
        }
    },
    disarm: {
        id: 'disarm',
        name: 'Disarm',
        description: 'Slash at the weapon hand. If hand drops below 50% HP, enemy drops their weapon. They fight unarmed after.',
        weaponType: 'sharp',
        statRequirements: { agility: 12, strength: 11 },
        preferredStance: 'defensive',
        actionCost: 150,
        cooldown: 4,
        stanceBonus: { hitMod: 15, damageMod: 1.1 },
        wrongStancePenalty: { hitMod: -15, damageMod: 0.8 },
        effects: {
            targetRegion: 'hand', // targets weapon hand
            damageMultiplier: 0.8,
            disarmThreshold: 0.5, // if hand HP drops below 50%, weapon is dropped
            hitChanceMod: -10
        }
    },
    flurry: {
        id: 'flurry',
        name: 'Flurry',
        description: 'Two rapid slashes. Each deals reduced damage but high bleed chance. Stacks wounds fast.',
        weaponType: 'sharp',
        statRequirements: { agility: 14 },
        preferredStance: 'aggressive',
        actionCost: 170,
        cooldown: 3,
        stanceBonus: { hitMod: 5, damageMod: 1.1 },
        wrongStancePenalty: { hitMod: -10, damageMod: 0.85 },
        effects: {
            multiStrike: 2,
            damageMultiplier: 0.6, // per strike
            bleedSeverityMod: 1.5,
            hitChanceMod: -5
        }
    },
    precision_stab: {
        id: 'precision_stab',
        name: 'Precision Stab',
        description: 'Target a specific organ through an existing wound. Bypasses armor on wounded parts. High crit chance.',
        weaponType: 'sharp',
        statRequirements: { perception: 13 },
        preferredStance: 'opportunistic',
        actionCost: 160,
        cooldown: 3,
        stanceBonus: { hitMod: 10, critMod: 8 },
        wrongStancePenalty: { hitMod: -10, critMod: -5 },
        effects: {
            targetRegion: 'wounded',
            damageMultiplier: 1.1,
            bypassArmor: true, // ignores armor on wounded parts
            hitChanceMod: -10,
            exploitWounded: true
        }
    },

    // ── Unarmed Abilities ────────────────────────────────────────────────
    tackle: {
        id: 'tackle',
        name: 'Tackle',
        description: 'Rush and knock the target to the ground. Both go prone (skip turn, easier to hit). Low damage.',
        weaponType: 'unarmed',
        statRequirements: { strength: 12, endurance: 11 },
        preferredStance: 'aggressive',
        actionCost: 160,
        cooldown: 4,
        stanceBonus: { hitMod: 15, damageMod: 1.2 },
        wrongStancePenalty: { hitMod: -15, damageMod: 0.8 },
        effects: {
            targetRegion: 'torso',
            damageMultiplier: 0.6,
            knockProne: true,
            selfProne: true,
            hitChanceMod: 5
        }
    },
    eye_gouge: {
        id: 'eye_gouge',
        name: 'Eye Gouge',
        description: 'Jab at the eyes. Low damage but eye damage reduces enemy crit chance permanently.',
        weaponType: 'unarmed',
        statRequirements: { agility: 12 },
        preferredStance: 'opportunistic',
        actionCost: 130,
        cooldown: 3,
        stanceBonus: { hitMod: 10, damageMod: 1.2 },
        wrongStancePenalty: { hitMod: -15, damageMod: 0.8 },
        effects: {
            targetRegion: 'head',
            targetPart: 'eyes',
            damageMultiplier: 0.5,
            hitChanceMod: -15
        }
    },
    chokehold: {
        id: 'chokehold',
        name: 'Chokehold',
        description: 'Grapple the target. Suffocation damage each turn for 3 turns. They can roll STR to break free.',
        weaponType: 'unarmed',
        statRequirements: { strength: 13, agility: 12 },
        preferredStance: 'defensive',
        actionCost: 180,
        cooldown: 5,
        stanceBonus: { hitMod: 10, effectDurationBonus: 1 },
        wrongStancePenalty: { hitMod: -20, damageMod: 0.7 },
        effects: {
            targetRegion: 'head',
            damageMultiplier: 0.3,
            grapple: true,
            suffocationPerTurn: 15, // suffocation progress per turn
            grappleDuration: 3,
            breakFreeStatCheck: 'strength', // target rolls STR to escape
            breakFreeThreshold: 12,
            hitChanceMod: -10
        }
    },
    kidney_shot: {
        id: 'kidney_shot',
        name: 'Kidney Shot',
        description: 'Brutal body blow targeting organs. Massive pain — can trigger shock (severe combat penalties).',
        weaponType: 'unarmed',
        statRequirements: { strength: 11, perception: 11 },
        preferredStance: 'opportunistic',
        actionCost: 140,
        cooldown: 2,
        stanceBonus: { hitMod: 10, damageMod: 1.15 },
        wrongStancePenalty: { hitMod: -10, damageMod: 0.85 },
        effects: {
            targetRegion: 'torso',
            targetPart: 'kidney',
            damageMultiplier: 1.0,
            bonusPainMod: 2.5,
            hitChanceMod: -5
        }
    },
    headbutt: {
        id: 'headbutt',
        name: 'Headbutt',
        description: 'Slam your skull into theirs. Stuns the target (skip turn). You take 40% of the damage to your own head.',
        weaponType: 'unarmed',
        statRequirements: { strength: 12, endurance: 12 },
        preferredStance: 'aggressive',
        actionCost: 120,
        cooldown: 3,
        stanceBonus: { hitMod: 10, stunDurationBonus: 1 },
        wrongStancePenalty: { hitMod: -10, damageMod: 0.8 },
        effects: {
            targetRegion: 'head',
            targetPart: 'head',
            damageMultiplier: 0.8,
            selfDamage: 0.4, // fraction of damage dealt to self head
            stunTurns: 1,
            hitChanceMod: 5
        }
    }
};

export class AbilitySystem {
    constructor(game) {
        this.game = game;
        this.abilities = ABILITY_DATA;
        
        // Active effects from abilities (guard break debuff, grapple, etc.)
        this.activeEffects = new Map(); // entityId -> [{ effectType, turnsRemaining, data }]
        
        // Cooldown tracking: entityId -> { abilityId: turnsRemaining }
        this.cooldowns = new Map();
    }
    
    /**
     * Get all abilities for a given weapon type.
     * Returns all abilities with an `unlocked` flag based on the entity's stats.
     * @param {string} weaponType - 'blunt', 'sharp', or 'unarmed'
     * @param {Object} entity - The entity (player or NPC) using the ability
     * @returns {Array} abilities with unlocked status and computed modifiers
     */
    getAbilitiesForWeapon(weaponType, entity) {
        const results = [];
        
        for (const [id, ability] of Object.entries(this.abilities)) {
            if (ability.weaponType !== weaponType) continue;
            
            const unlocked = this.meetsStatRequirements(ability, entity);
            const currentStance = entity.combatStance || 'aggressive';
            const inPreferredStance = currentStance === ability.preferredStance;
            
            // Compute effective modifiers based on stance
            const stanceMods = inPreferredStance 
                ? ability.stanceBonus 
                : ability.wrongStancePenalty;
            
            const cooldownRemaining = this.getCooldownRemaining(entity, id);
            
            results.push({
                ...ability,
                unlocked,
                inPreferredStance,
                currentStance,
                stanceMods,
                missingStats: this.getMissingStats(ability, entity),
                cooldownRemaining,
                onCooldown: cooldownRemaining > 0
            });
        }
        
        return results;
    }
    
    /**
     * Get all abilities available to an entity based on their current weapon.
     * @param {Object} entity - Player or NPC
     * @returns {Array} abilities with status info
     */
    getAvailableAbilities(entity) {
        const weapon = this.getEntityWeapon(entity);
        const weaponType = this.getWeaponType(weapon);
        return this.getAbilitiesForWeapon(weaponType, entity);
    }
    
    /**
     * Check if entity meets stat requirements for an ability.
     */
    meetsStatRequirements(ability, entity) {
        if (!entity.stats) return false;
        for (const [stat, minValue] of Object.entries(ability.statRequirements)) {
            if ((entity.stats[stat] || 0) < minValue) return false;
        }
        return true;
    }
    
    /**
     * Get list of stats that don't meet requirements.
     */
    getMissingStats(ability, entity) {
        const missing = [];
        if (!entity.stats) return Object.entries(ability.statRequirements).map(([s, v]) => ({ stat: s, required: v, current: 0 }));
        
        for (const [stat, minValue] of Object.entries(ability.statRequirements)) {
            const current = entity.stats[stat] || 0;
            if (current < minValue) {
                missing.push({ stat, required: minValue, current });
            }
        }
        return missing;
    }
    
    /**
     * Get the weapon an entity is using (checks both hands, prefers right).
     */
    getEntityWeapon(entity) {
        if (entity.equipment) {
            const right = entity.equipment.rightHand;
            const left = entity.equipment.leftHand;
            if (right && right.weaponStats) return right;
            if (left && left.weaponStats) return left;
        }
        return null;
    }
    
    /**
     * Determine weapon type from weapon item.
     */
    getWeaponType(weapon) {
        if (!weapon || !weapon.weaponStats) return 'unarmed';
        return weapon.weaponStats.attackType || 'blunt';
    }
    
    /**
     * Resolve an ability use in combat.
     * @param {Object} attacker - Entity using the ability
     * @param {Object} target - Target entity
     * @param {string} abilityId - ID of the ability to use
     * @param {Object} [options] - Additional options (e.g., chosen limb for limb_breaker)
     * @returns {Object} result of the ability use
     */
    resolveAbility(attacker, target, abilityId, options = {}) {
        const ability = this.abilities[abilityId];
        if (!ability) return { success: false, reason: 'Unknown ability' };
        
        if (!this.meetsStatRequirements(ability, attacker)) {
            return { success: false, reason: 'Stats too low' };
        }
        
        // Cooldown check
        const cdRemaining = this.getCooldownRemaining(attacker, abilityId);
        if (cdRemaining > 0) {
            return { success: false, reason: `On cooldown (${cdRemaining} turns)` };
        }
        
        const weapon = this.getEntityWeapon(attacker);
        const weaponType = this.getWeaponType(weapon);
        
        // Verify weapon type matches (unarmed abilities need no weapon)
        if (ability.weaponType !== weaponType) {
            return { success: false, reason: `Requires ${ability.weaponType} weapon` };
        }
        
        const combat = this.game.combatSystem;
        const attackerName = combat.getDisplayName(attacker, true);
        const targetName = combat.getDisplayName(target, false);
        
        // Stance modifiers
        const currentStance = attacker.combatStance || 'aggressive';
        const inPreferredStance = currentStance === ability.preferredStance;
        const stanceMods = inPreferredStance ? ability.stanceBonus : ability.wrongStancePenalty;
        
        // Compute hit chance
        let hitChance = combat.calculateHitChance(attacker, target, weapon);
        hitChance += (ability.effects.hitChanceMod || 0);
        hitChance += (stanceMods.hitMod || 0);
        hitChance = Math.max(10, Math.min(95, hitChance));
        
        // Roll to hit
        const hitRoll = Math.random() * 100;
        
        // Compute injury penalties for event data
        const attackerPenalties = attacker.anatomy ? attacker.anatomy.getCombatPenalties() : null;
        const targetPenalties = target.anatomy ? target.anatomy.getCombatPenalties() : null;
        
        if (hitRoll > hitChance) {
            // Miss
            combat.logMiss(attackerName, targetName);
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y, 'MISS', '#888888', 800);
            }
            combat.trackEngagement(attacker);
            combat.trackEngagement(target);
            combat.addCombatEvent({
                type: 'ability_miss',
                abilityName: ability.name,
                abilityId,
                attackerName, targetName,
                attacker, target,
                weaponName: weapon ? weapon.name : 'bare fists',
                hitChance: Math.round(hitChance),
                inPreferredStance,
                attackerPenalties,
                targetPenalties
            });
            
            // Set action cost and start cooldown
            attacker.lastActionCost = ability.actionCost;
            this.startCooldown(attacker, abilityId, ability.cooldown || 0);
            
            return { 
                success: true, hit: false, abilityName: ability.name,
                actionCost: ability.actionCost
            };
        }
        
        // ── Hit — resolve ability effects ──
        const results = this.resolveAbilityEffects(attacker, target, ability, weapon, stanceMods, options);
        
        // Track engagement
        combat.trackEngagement(attacker);
        combat.trackEngagement(target);
        
        // Record combat event
        combat.addCombatEvent({
            type: 'ability_hit',
            abilityName: ability.name,
            abilityId,
            attackerName, targetName,
            attacker, target,
            weaponName: weapon ? weapon.name : 'bare fists',
            hitChance: Math.round(hitChance),
            inPreferredStance,
            ...results,
            attackerPenalties,
            targetPenalties
        });
        
        // Set action cost and start cooldown
        attacker.lastActionCost = ability.actionCost;
        this.startCooldown(attacker, abilityId, ability.cooldown || 0);
        
        return {
            success: true,
            hit: true,
            abilityName: ability.name,
            actionCost: ability.actionCost,
            ...results
        };
    }
    
    /**
     * Resolve the specific effects of an ability that hit.
     */
    resolveAbilityEffects(attacker, target, ability, weapon, stanceMods, options) {
        const combat = this.game.combatSystem;
        const effects = ability.effects;
        const result = {
            damage: 0,
            bodyParts: [],
            critical: false,
            killed: false,
            specialEffects: [],
            woundsInflicted: []
        };
        
        // Determine damage multiplier with stance mod
        let damageMod = effects.damageMultiplier || 1.0;
        damageMod *= (stanceMods.damageMod || 1.0);
        
        // Handle multi-strike abilities (e.g., Flurry)
        const strikes = effects.multiStrike || 1;
        
        for (let i = 0; i < strikes; i++) {
            // Roll base damage
            let damage = combat.rollWeaponDamage(weapon, attacker);
            damage = Math.max(1, Math.floor(damage * damageMod));
            
            // Crit check
            let critChance = combat.calculateCritChance(attacker, weapon);
            critChance += (stanceMods.critMod || 0);
            const isCritical = Math.random() * 100 < critChance;
            if (isCritical) {
                damage = Math.floor(damage * 1.5);
                result.critical = true;
            }
            
            // Determine target body part
            const targetInfo = this.resolveTargetPart(target, effects, options);
            
            // Build list of parts to hit (both_legs hits two parts)
            const partsToHit = [];
            if (targetInfo.bothLegs) {
                partsToHit.push(
                    { region: 'leftLeg', anatomyPath: 'leftLeg.leg', displayName: 'Left Leg' },
                    { region: 'rightLeg', anatomyPath: 'rightLeg.leg', displayName: 'Right Leg' }
                );
            } else {
                partsToHit.push(targetInfo);
            }
            
            for (const partInfo of partsToHit) {
                let partDamage = damage;
                
                // Armor check (bypass if ability says so and part is wounded)
                let armorResult = { reduction: 0, armorName: null };
                if (!(effects.bypassArmor && this.isPartWounded(target, partInfo.region))) {
                    armorResult = combat.calculateArmor(target, partInfo.region);
                    partDamage = Math.max(1, partDamage - armorResult.reduction);
                }
                
                // Apply damage to anatomy
                if (target.anatomy && partInfo.anatomyPath) {
                    // Build a location object compatible with CombatSystem.applyAnatomyDamage
                    const abilityLocation = {
                        subPart: { path: partInfo.anatomyPath, displayName: partInfo.displayName }
                    };
                    const partResult = combat.applyAnatomyDamage(
                        target, abilityLocation, partDamage,
                        weapon ? weapon.weaponStats.attackType : 'blunt'
                    );
                    
                    // Wound creation with ability bleed modifiers
                    let bleedMod = effects.bleedSeverityMod || 1.0;
                    bleedMod *= (stanceMods.bleedMod || 1.0);
                    const wounds = this.applyAbilityWounds(target, partInfo, partDamage, weapon, bleedMod, effects);
                    result.woundsInflicted.push(...wounds);
                    
                    // Pain modifier
                    const painMod = effects.bonusPainMod || 1.0;
                    if (painMod > 1.0) {
                        const bonusPain = Math.floor(partDamage * (painMod - 1.0));
                        target.anatomy.addPain(bonusPain, this.game.turnCount);
                    }
                    
                    if (partResult.destroyed) {
                        result.specialEffects.push({ type: 'part_destroyed', part: partInfo.displayName });
                    }
                }
                
                result.damage += partDamage;
                result.bodyParts.push({
                    name: partInfo.displayName,
                    region: partInfo.region,
                    damage: partDamage,
                    blocked: armorResult.reduction,
                    armorName: armorResult.armorName
                });
                
                // Floating damage text
                if (this.game.combatEffects) {
                    const color = isCritical ? '#ffff00' : '#ff4444';
                    this.game.combatEffects.addFloatingText(target.x, target.y, `-${partDamage}`, color, 800);
                }
            }
        }
        
        // ── Special ability effects ──
        
        // Stun
        if (effects.stunTurns) {
            let stunDuration = effects.stunTurns;
            if (stanceMods.stunDurationBonus) stunDuration += stanceMods.stunDurationBonus;
            this.applyStun(target, stunDuration);
            result.specialEffects.push({ type: 'stun', turns: stunDuration });
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, `STUNNED ${stunDuration}t`, '#ffff00', 1200);
            }
        }
        
        // Knock prone — target loses 1 turn getting up + dodge penalty while prone
        if (effects.knockProne) {
            this.applyEffect(target, 'prone', 2, { dodgePenalty: 15 });
            result.specialEffects.push({ type: 'knock_prone', target: 'target', turns: 2 });
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, 'PRONE', '#ff8800', 1200);
            }
        }
        if (effects.selfProne) {
            this.applyEffect(attacker, 'prone', 2, { dodgePenalty: 15 });
            result.specialEffects.push({ type: 'knock_prone', target: 'self', turns: 2 });
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(attacker.x, attacker.y - 0.5, 'PRONE', '#ff8800', 1000);
            }
        }
        
        // Guard break (intercept reduction)
        if (effects.interceptReduction) {
            let duration = effects.effectDuration || 3;
            if (stanceMods.effectDurationBonus) duration += stanceMods.effectDurationBonus;
            this.applyEffect(target, 'guard_break', duration, { 
                interceptMod: effects.interceptReduction 
            });
            result.specialEffects.push({ type: 'guard_break', turns: duration });
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, `GUARD BROKEN ${duration}t`, '#ff8800', 1200);
            }
        }
        
        // Disarm check
        if (effects.disarmThreshold && target.anatomy) {
            const handParts = [
                target.anatomy.parts.leftArm.hand,
                target.anatomy.parts.rightArm.hand
            ];
            // Check if either hand is below threshold
            for (const hand of handParts) {
                if (hand.hp / hand.maxHP < effects.disarmThreshold) {
                    result.specialEffects.push({ type: 'disarm' });
                    // Drop weapon — check both equipment slots and NPC .weapon field
                    let droppedWeapon = null;
                    if (target.equipment) {
                        droppedWeapon = target.equipment.rightHand || target.equipment.leftHand;
                        if (droppedWeapon && droppedWeapon.weaponStats) {
                            if (target.equipment.rightHand === droppedWeapon) target.equipment.rightHand = null;
                            else target.equipment.leftHand = null;
                        }
                    }
                    // NPC weapon field (used by NPC.attack())
                    if (!droppedWeapon && target.weapon && target.weapon.weaponStats) {
                        droppedWeapon = target.weapon;
                    }
                    if (target.weapon) target.weapon = null;
                    
                    if (droppedWeapon) {
                        result.specialEffects.push({ type: 'weapon_dropped', weaponName: droppedWeapon.name });
                        // Drop weapon on the ground as a lootable item
                        if (this.game.world) {
                            droppedWeapon.x = target.x;
                            droppedWeapon.y = target.y;
                            droppedWeapon.z = target.z || 0;
                            this.game.world.addItem(droppedWeapon);
                        }
                        if (this.game.combatEffects) {
                            this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, 'DISARMED', '#ff00ff', 1500);
                        }
                    }
                    break;
                }
            }
        }
        
        // Grapple / Chokehold
        if (effects.grapple) {
            let duration = effects.grappleDuration || 3;
            if (stanceMods.effectDurationBonus) duration += stanceMods.effectDurationBonus;
            this.applyEffect(target, 'grappled', duration, {
                grappledBy: attacker,
                suffocationPerTurn: effects.suffocationPerTurn || 15,
                breakFreeStat: effects.breakFreeStatCheck || 'strength',
                breakFreeThreshold: effects.breakFreeThreshold || 12
            });
            this.applyEffect(attacker, 'grappling', duration, { grapplingTarget: target });
            result.specialEffects.push({ type: 'grapple', turns: duration });
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, `GRAPPLED ${duration}t`, '#ff8800', 1200);
            }
        }
        
        // Self damage (headbutt)
        if (effects.selfDamage && effects.selfDamage > 0) {
            const selfDmg = Math.max(1, Math.floor(result.damage * effects.selfDamage));
            if (attacker.anatomy) {
                const selfLocation = { subPart: { path: 'head.head', displayName: 'Head' } };
                combat.applyAnatomyDamage(attacker, selfLocation, selfDmg, 'blunt');
                attacker.anatomy.addPain(selfDmg, this.game.turnCount);
            }
            result.specialEffects.push({ type: 'self_damage', damage: selfDmg, part: 'Head' });
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(attacker.x, attacker.y, `-${selfDmg}`, '#ff8844', 600);
            }
        }
        
        // Arterial bleed
        if (effects.arterialBleed) {
            result.specialEffects.push({ type: 'arterial_bleed' });
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, 'ARTERIAL BLEED', '#ff0000', 1500);
            }
        }
        
        // Death check
        if (target.anatomy && target.anatomy.isDead()) {
            result.killed = true;
        }
        
        return result;
    }
    
    /**
     * Determine which body part an ability targets.
     */
    resolveTargetPart(target, effects, options) {
        const region = effects.targetRegion;
        
        // Specific part targeting
        if (region === 'head') {
            const partKey = effects.targetPart || 'head';
            if (partKey === 'eyes') {
                // Target a random eye
                const eyeIdx = Math.random() < 0.5 ? 0 : 1;
                const eyeName = eyeIdx === 0 ? 'Left Eye' : 'Right Eye';
                return { region: 'head', anatomyPath: `head.eyes.${eyeIdx}`, displayName: eyeName };
            }
            return { region: 'head', anatomyPath: 'head.head', displayName: 'Head' };
        }
        
        if (region === 'torso') {
            if (effects.targetPart === 'kidney') {
                const side = Math.random() < 0.5 ? 'leftKidney' : 'rightKidney';
                return { region: 'torso', anatomyPath: `torso.${side}`, displayName: side === 'leftKidney' ? 'Left Kidney' : 'Right Kidney' };
            }
            return { region: 'torso', anatomyPath: 'torso.torso', displayName: 'Torso' };
        }
        
        if (region === 'choose_limb' || region === 'arm') {
            // Player chose or default to strongest arm
            const chosenLimb = options.targetLimb || 'rightArm';
            if (chosenLimb === 'leftArm' || chosenLimb === 'rightArm') {
                const armPath = `${chosenLimb}.arm`;
                const name = chosenLimb === 'leftArm' ? 'Left Arm' : 'Right Arm';
                return { region: chosenLimb, anatomyPath: armPath, displayName: name };
            }
            if (chosenLimb === 'leftLeg' || chosenLimb === 'rightLeg') {
                const legPath = `${chosenLimb}.leg`;
                const name = chosenLimb === 'leftLeg' ? 'Left Leg' : 'Right Leg';
                return { region: chosenLimb, anatomyPath: legPath, displayName: name };
            }
            return { region: 'rightArm', anatomyPath: 'rightArm.arm', displayName: 'Right Arm' };
        }
        
        if (region === 'choose_leg') {
            const chosenLeg = options.targetLimb || 'rightLeg';
            const legPath = `${chosenLeg}.leg`;
            const name = chosenLeg === 'leftLeg' ? 'Left Leg' : 'Right Leg';
            return { region: chosenLeg, anatomyPath: legPath, displayName: name };
        }
        
        if (region === 'both_legs') {
            // Returns left leg — caller handles both
            return { region: 'leftLeg', anatomyPath: 'leftLeg.leg', displayName: 'Legs', bothLegs: true };
        }
        
        if (region === 'hand') {
            // Target the weapon hand (right by default)
            const hand = 'rightArm';
            return { region: hand, anatomyPath: `${hand}.hand`, displayName: 'Right Hand' };
        }
        
        if (region === 'wounded') {
            // Find a wounded part to exploit
            const woundedPart = this.findWoundedPart(target);
            if (woundedPart) return woundedPart;
            // Fallback to random
            return { region: 'torso', anatomyPath: 'torso.torso', displayName: 'Torso' };
        }
        
        // Default
        return { region: 'torso', anatomyPath: 'torso.torso', displayName: 'Torso' };
    }
    
    /**
     * Find a wounded body part on the target for exploit abilities.
     */
    findWoundedPart(target) {
        if (!target.anatomy) return null;
        
        const candidates = [];
        const partMappings = [
            { path: 'head.head', region: 'head', name: 'Head' },
            { path: 'torso.torso', region: 'torso', name: 'Torso' },
            { path: 'leftArm.arm', region: 'leftArm', name: 'Left Arm' },
            { path: 'rightArm.arm', region: 'rightArm', name: 'Right Arm' },
            { path: 'leftLeg.leg', region: 'leftLeg', name: 'Left Leg' },
            { path: 'rightLeg.leg', region: 'rightLeg', name: 'Right Leg' },
            { path: 'leftArm.hand', region: 'leftArm', name: 'Left Hand' },
            { path: 'rightArm.hand', region: 'rightArm', name: 'Right Hand' },
            { path: 'leftLeg.foot', region: 'leftLeg', name: 'Left Foot' },
            { path: 'rightLeg.foot', region: 'rightLeg', name: 'Right Foot' }
        ];
        
        for (const mapping of partMappings) {
            const part = this.getPartByPath(target.anatomy, mapping.path);
            if (part && part.hp < part.maxHP) {
                candidates.push({
                    region: mapping.region,
                    anatomyPath: mapping.path,
                    displayName: mapping.name,
                    hpPercent: part.hp / part.maxHP
                });
            }
        }
        
        if (candidates.length === 0) return null;
        
        // Prefer the most damaged part
        candidates.sort((a, b) => a.hpPercent - b.hpPercent);
        return candidates[0];
    }
    
    /**
     * Navigate anatomy parts by dot-path (e.g., "head.head", "leftArm.hand").
     */
    getPartByPath(anatomy, path) {
        const segments = path.split('.');
        let current = anatomy.parts;
        for (const seg of segments) {
            if (current === undefined || current === null) return null;
            current = current[seg];
        }
        return current;
    }
    
    /**
     * Check if a body part region has any wounded parts.
     */
    isPartWounded(target, region) {
        if (!target.anatomy) return false;
        const regionParts = target.anatomy.parts[region];
        if (!regionParts) return false;
        
        for (const key of Object.keys(regionParts)) {
            const part = regionParts[key];
            if (part && typeof part === 'object' && part.hp !== undefined) {
                if (part.hp < part.maxHP) return true;
            }
        }
        return false;
    }
    
    /**
     * Apply wounds from an ability hit with bleed modifiers.
     */
    applyAbilityWounds(target, targetInfo, damage, weapon, bleedMod, effects) {
        const wounds = [];
        if (!target.anatomy) return wounds;
        
        const attackType = weapon ? weapon.weaponStats.attackType : 'blunt';
        
        // Sharp weapons cause bleeding wounds
        if (attackType === 'sharp') {
            let bleedChance = weapon ? (weapon.weaponStats.bleedChance || 0.2) : 0.1;
            bleedChance *= bleedMod;
            
            if (Math.random() < bleedChance) {
                const severity = Math.max(0.5, (damage / 10) * bleedMod);
                target.anatomy.addWound(targetInfo.displayName, severity, 'laceration');
                wounds.push({
                    part: targetInfo.displayName,
                    type: 'laceration',
                    severity
                });
            }
            
            // Arterial bleed — guaranteed heavy bleed
            if (effects.arterialBleed) {
                const arterialSeverity = Math.max(2.0, (damage / 5) * bleedMod);
                target.anatomy.addWound(targetInfo.displayName, arterialSeverity, 'arterial');
                wounds.push({
                    part: targetInfo.displayName,
                    type: 'arterial_bleed',
                    severity: arterialSeverity
                });
            }
        }
        
        return wounds;
    }
    
    // ── Cooldown Management ─────────────────────────────────────────────
    
    /**
     * Start a cooldown for an ability on an entity.
     */
    startCooldown(entity, abilityId, turns) {
        if (!turns || turns <= 0) return;
        const entityId = this.getEntityId(entity);
        if (!this.cooldowns.has(entityId)) {
            this.cooldowns.set(entityId, {});
        }
        this.cooldowns.get(entityId)[abilityId] = turns;
    }
    
    /**
     * Get remaining cooldown turns for an ability on an entity.
     */
    getCooldownRemaining(entity, abilityId) {
        const entityId = this.getEntityId(entity);
        const cds = this.cooldowns.get(entityId);
        if (!cds) return 0;
        return cds[abilityId] || 0;
    }
    
    /**
     * Tick all cooldowns down by 1. Called once per turn.
     */
    tickCooldowns() {
        for (const [entityId, cds] of this.cooldowns.entries()) {
            for (const abilityId of Object.keys(cds)) {
                cds[abilityId]--;
                if (cds[abilityId] <= 0) {
                    delete cds[abilityId];
                }
            }
            if (Object.keys(cds).length === 0) {
                this.cooldowns.delete(entityId);
            }
        }
    }
    
    // ── Status Effect Management ─────────────────────────────────────────
    
    /**
     * Apply a stun to an entity (they lose their next N turns).
     */
    applyStun(entity, turns) {
        const entityId = this.getEntityId(entity);
        if (!this.activeEffects.has(entityId)) {
            this.activeEffects.set(entityId, []);
        }
        // Remove existing stun, replace with new
        const effects = this.activeEffects.get(entityId).filter(e => e.type !== 'stunned');
        effects.push({ type: 'stunned', turnsRemaining: turns, data: {} });
        this.activeEffects.set(entityId, effects);
    }
    
    /**
     * Apply a generic timed effect to an entity.
     */
    applyEffect(entity, effectType, duration, data = {}) {
        const entityId = this.getEntityId(entity);
        if (!this.activeEffects.has(entityId)) {
            this.activeEffects.set(entityId, []);
        }
        const effects = this.activeEffects.get(entityId).filter(e => e.type !== effectType);
        effects.push({ type: effectType, turnsRemaining: duration, data });
        this.activeEffects.set(entityId, effects);
    }
    
    /**
     * Check if an entity has a specific active effect.
     */
    hasEffect(entity, effectType) {
        const entityId = this.getEntityId(entity);
        const effects = this.activeEffects.get(entityId);
        if (!effects) return false;
        return effects.some(e => e.type === effectType && e.turnsRemaining > 0);
    }
    
    /**
     * Get an active effect's data.
     */
    getEffect(entity, effectType) {
        const entityId = this.getEntityId(entity);
        const effects = this.activeEffects.get(entityId);
        if (!effects) return null;
        return effects.find(e => e.type === effectType && e.turnsRemaining > 0) || null;
    }
    
    /**
     * Tick all active effects (call once per turn).
     * Returns array of expired effects for logging.
     */
    processTurn() {
        // Tick cooldowns
        this.tickCooldowns();
        
        const expired = [];
        
        for (const [entityId, effects] of this.activeEffects.entries()) {
            for (let i = effects.length - 1; i >= 0; i--) {
                const effect = effects[i];
                
                // Process per-turn effects
                if (effect.type === 'grappled' && effect.data.suffocationPerTurn) {
                    // Find the entity — check player and NPCs
                    const entity = this.findEntityById(entityId);
                    if (entity && entity.anatomy) {
                        entity.anatomy.suffocation = Math.min(100, 
                            (entity.anatomy.suffocation || 0) + effect.data.suffocationPerTurn);
                        
                        // Break free check
                        if (entity.stats) {
                            const stat = entity.stats[effect.data.breakFreeStat] || 10;
                            if (stat >= effect.data.breakFreeThreshold && Math.random() < 0.4) {
                                effect.turnsRemaining = 0; // break free
                                expired.push({ entityId, effect: { ...effect }, reason: 'broke_free' });
                                // Also remove grappling from attacker
                                if (effect.data.grappledBy) {
                                    const attackerId = this.getEntityId(effect.data.grappledBy);
                                    const attackerEffects = this.activeEffects.get(attackerId);
                                    if (attackerEffects) {
                                        const grapplingIdx = attackerEffects.findIndex(e => e.type === 'grappling');
                                        if (grapplingIdx >= 0) attackerEffects.splice(grapplingIdx, 1);
                                    }
                                }
                            }
                        }
                    }
                }
                
                effect.turnsRemaining--;
                if (effect.turnsRemaining <= 0) {
                    expired.push({ entityId, effect: { ...effect }, reason: 'expired' });
                    effects.splice(i, 1);
                }
            }
            
            // Clean up empty entries
            if (effects.length === 0) {
                this.activeEffects.delete(entityId);
            }
        }
        
        return expired;
    }
    
    /**
     * Check if an entity is stunned (should skip their turn).
     */
    isStunned(entity) {
        return this.hasEffect(entity, 'stunned');
    }
    
    /**
     * Get the intercept modifier for an entity (from guard_break).
     */
    getInterceptModifier(entity) {
        const effect = this.getEffect(entity, 'guard_break');
        if (!effect) return 1.0;
        return effect.data.interceptMod || 1.0;
    }
    
    /**
     * Get a stable ID for an entity.
     */
    getEntityId(entity) {
        if (entity === this.game.player) return 'player';
        return entity.id || `npc_${entity.x}_${entity.y}`;
    }
    
    /**
     * Find an entity by its ID.
     */
    findEntityById(entityId) {
        if (entityId === 'player') return this.game.player;
        // Search NPCs
        if (this.game.world && this.game.world.entities) {
            for (const entity of this.game.world.entities) {
                if (this.getEntityId(entity) === entityId) return entity;
            }
        }
        return null;
    }
}
