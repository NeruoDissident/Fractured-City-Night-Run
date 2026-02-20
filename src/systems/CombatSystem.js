/**
 * CombatSystem - Handles all combat resolution
 * 
 * Hit location targeting, damage calculation, armor mitigation,
 * rich combat log generation, and anatomy-based damage application.
 * 
 * EXPANSION POINTS:
 * - Damage types: piercing, fire, electric, etc.
 * - Status effects: bleeding, stun, infection, fracture
 * - Critical hits and fumbles
 * - Ranged combat with accuracy falloff
 * - Abilities and special attacks
 * - Blood/liquid tracking on ground tiles
 */

// Default body region weights (fallback)
const BODY_REGIONS = [
    { region: 'head',     weight: 10 },
    { region: 'torso',    weight: 40 },
    { region: 'leftArm',  weight: 12 },
    { region: 'rightArm', weight: 12 },
    { region: 'leftLeg',  weight: 13 },
    { region: 'rightLeg', weight: 13 }
];

// Per-weapon-type targeting profiles
// Blunt: big swings aimed at head/torso, arms often intercept
// Sharp: close-range stabs/slashes, torso vitals + arm cuts
// Unarmed: wild punches to head, body blows, poor targeting
const WEAPON_TARGETING = {
    blunt: [
        { region: 'head',     weight: 20 },  // overhead swings
        { region: 'torso',    weight: 30 },  // body shots
        { region: 'leftArm',  weight: 15 },  // arms intercept
        { region: 'rightArm', weight: 15 },  // arms intercept
        { region: 'leftLeg',  weight: 10 },
        { region: 'rightLeg', weight: 10 }
    ],
    sharp: [
        { region: 'head',     weight: 5 },   // hard to stab the head
        { region: 'torso',    weight: 45 },  // go for the gut/vitals
        { region: 'leftArm',  weight: 18 },  // slashing in close quarters
        { region: 'rightArm', weight: 18 },  // slashing in close quarters
        { region: 'leftLeg',  weight: 7 },
        { region: 'rightLeg', weight: 7 }
    ],
    unarmed: [
        { region: 'head',     weight: 25 },  // punches to the face
        { region: 'torso',    weight: 35 },  // body blows
        { region: 'leftArm',  weight: 10 },
        { region: 'rightArm', weight: 10 },
        { region: 'leftLeg',  weight: 10 },
        { region: 'rightLeg', weight: 10 }
    ]
};

// Sub-parts within each region, with their own weights
const REGION_PARTS = {
    head: [
        { part: 'brain', path: 'head.brain', weight: 5, vital: true },
        { part: 'jaw',   path: 'head.jaw',   weight: 30 },
        { part: 'leftEye',  path: 'head.eyes.0',  weight: 10, displayName: 'left eye' },
        { part: 'rightEye', path: 'head.eyes.1',  weight: 10, displayName: 'right eye' },
        { part: 'leftEar',  path: 'head.ears.0',  weight: 20, displayName: 'left ear' },
        { part: 'rightEar', path: 'head.ears.1',  weight: 20, displayName: 'right ear' },
        { part: 'head',     path: null,            weight: 5, displayName: 'head', glancing: true }
    ],
    torso: [
        { part: 'heart',       path: 'torso.heart',      weight: 5, vital: true },
        { part: 'leftLung',    path: 'torso.lungs.0',    weight: 10, vital: true, displayName: 'left lung' },
        { part: 'rightLung',   path: 'torso.lungs.1',    weight: 10, vital: true, displayName: 'right lung' },
        { part: 'stomach',     path: 'torso.stomach',    weight: 20, vital: true },
        { part: 'liver',       path: 'torso.liver',      weight: 10, vital: true },
        { part: 'leftKidney',  path: 'torso.kidneys.0',  weight: 5, vital: true, displayName: 'left kidney' },
        { part: 'rightKidney', path: 'torso.kidneys.1',  weight: 5, vital: true, displayName: 'right kidney' },
        { part: 'torso',       path: null,                weight: 35, displayName: 'torso', glancing: true }
    ],
    leftArm: [
        { part: 'leftArm',  path: 'leftArm.arm',   weight: 50, displayName: 'left arm' },
        { part: 'leftHand', path: 'leftArm.hand',   weight: 30, displayName: 'left hand' },
        { part: 'leftFingers', path: null,           weight: 20, displayName: 'left fingers', glancing: true }
    ],
    rightArm: [
        { part: 'rightArm',  path: 'rightArm.arm',   weight: 50, displayName: 'right arm' },
        { part: 'rightHand', path: 'rightArm.hand',   weight: 30, displayName: 'right hand' },
        { part: 'rightFingers', path: null,            weight: 20, displayName: 'right fingers', glancing: true }
    ],
    leftLeg: [
        { part: 'leftLeg',  path: 'leftLeg.leg',   weight: 65, displayName: 'left leg' },
        { part: 'leftFoot', path: 'leftLeg.foot',   weight: 35, displayName: 'left foot' }
    ],
    rightLeg: [
        { part: 'rightLeg',  path: 'rightLeg.leg',   weight: 65, displayName: 'right leg' },
        { part: 'rightFoot', path: 'rightLeg.foot',   weight: 35, displayName: 'right foot' }
    ]
};

// Armor coverage mapping: equipment slot → body regions it protects
const ARMOR_COVERAGE = {
    head:      ['head'],
    torso:     ['torso'],
    legs:      ['leftLeg', 'rightLeg'],
    leftHand:  ['leftArm'],
    rightHand: ['rightArm'],
    back:      ['torso'],
    feet:      ['leftLeg', 'rightLeg']
};

// ── Combat log message templates ──────────────────────────────────────
// {a} = attacker name, {t} = target name, {w} = weapon name,
// {p} = body part, {d} = damage number

const ATTACK_VERBS = {
    blunt: {
        light:  ['taps', 'bumps', 'nudges', 'clips'],
        medium: ['strikes', 'hits', 'cracks', 'smacks', 'bashes', 'whacks', 'thumps', 'clubs'],
        heavy:  ['crushes', 'slams', 'hammers', 'demolishes', 'clobbers', 'pulverizes']
    },
    sharp: {
        light:  ['nicks', 'scratches', 'grazes', 'pricks'],
        medium: ['cuts', 'slashes', 'slices', 'stabs', 'carves', 'gouges'],
        heavy:  ['cleaves', 'hacks', 'rips into', 'tears open', 'shreds']
    },
    unarmed: {
        light:  ['flicks', 'jabs', 'pokes', 'swats'],
        medium: ['punches', 'strikes', 'elbows', 'knees', 'kicks', 'headbutts'],
        heavy:  ['pummels', 'wallops', 'decks', 'pile-drives', 'hammers']
    }
};

// Templates: picked randomly per attack
const ATTACK_TEMPLATES = [
    '{a} {verb} {t} in the {p} with {w} for {d} damage.',
    '{a} {verb} {t} on the {p} with {w} — {d} damage!',
    '{a} lands a hit on {t}\'s {p} with {w} for {d} damage.',
    '{a} drives {w} into {t}\'s {p} — {d} damage!',
    '{w} connects with {t}\'s {p} as {a} attacks — {d} damage.',
];

const ATTACK_TEMPLATES_UNARMED = [
    '{a} {verb} {t} in the {p} for {d} damage.',
    '{a} {verb} {t} on the {p} — {d} damage!',
    '{a} lands a bare-fisted hit on {t}\'s {p} for {d} damage.',
    '{a} catches {t} in the {p} — {d} damage!',
];

const MISS_TEMPLATES = [
    '{a} swings at {t} and misses!',
    '{a} lunges at {t} but hits nothing but air.',
    '{t} dodges {a}\'s attack.',
    '{a}\'s attack goes wide.',
    '{a} swings wildly at {t} — miss!',
];

const BLOCK_TEMPLATES = [
    '{t}\'s {armor} absorbs the blow — {blocked} damage blocked.',
    '{a} hits {t}\'s {armor}, which absorbs {blocked} of the impact.',
    'The hit glances off {t}\'s {armor} — {blocked} damage mitigated.',
];

const STAGGER_TEMPLATES = [
    'The blow staggers {t} — they lose their footing!',
    '{t} reels from the impact, stunned!',
    'A bone-rattling hit leaves {t} dazed!',
    '{t} stumbles, knocked off balance by the force!',
];

const PARRY_TEMPLATES = [
    '{t} deflects the blow with their {w}!',
    '{t} parries with their {w} — the attack glances off!',
    'Steel meets steel as {t} blocks with their {w}!',
    '{t}\'s {w} catches the strike and turns it aside!',
];

const CRITICAL_TEMPLATES = [
    'Critical hit! {a} {verb} {t} square in the {p} with {w} — {d} damage!',
    'A devastating blow! {a} {verb} {t}\'s {p} with {w} for {d} damage!',
    '{a} finds an opening and {verb} {t} right in the {p} — {d} damage!',
];

const PART_DESTROYED_TEMPLATES = [
    '{t}\'s {p} gives out from the damage!',
    '{t}\'s {p} is mangled beyond use!',
    'The blow ruins {t}\'s {p}!',
];

const KILL_TEMPLATES = [
    '{t} crumples to the ground, dead.',
    '{t} collapses in a heap.',
    '{t} slumps over, lifeless.',
    '{t} drops dead.',
    '{t} falls and doesn\'t get back up.',
];

export class CombatSystem {
    constructor(game) {
        this.game = game;
        
        // Structured combat event log for the combat detail window
        // Each event: { turn, type, attacker, target, weapon, ... }
        this.combatEvents = [];
        this.maxCombatEvents = 20;
        
        // Track entities currently engaged in combat (adjacent + recently fought)
        this.engagedEnemies = new Map(); // entityId -> { entity, lastCombatTurn }
        this.engagementTimeout = 5; // turns of no combat before disengagement
    }
    
    /**
     * Record a structured combat event for the detail window.
     */
    addCombatEvent(event) {
        event.turn = this.game.turnCount || 0;
        this.combatEvents.push(event);
        if (this.combatEvents.length > this.maxCombatEvents) {
            this.combatEvents.shift();
        }
        // Auto-show combat overlay when combat happens
        if (this.game.ui && this.game.ui.combatOverlay) {
            this.game.ui.showCombatOverlay();
        }
    }
    
    /**
     * Track an entity as engaged in combat with the player.
     */
    trackEngagement(entity) {
        if (entity === this.game.player) return;
        const id = entity.id || entity.name + '_' + entity.x + '_' + entity.y;
        this.engagedEnemies.set(id, {
            entity,
            lastCombatTurn: this.game.turnCount || 0
        });
        
        // Force NPC into ENGAGED detection state when attacked
        if (entity.detectionState && entity.detectionState !== 'fleeing') {
            entity.detectionState = 'engaged';
            entity.lastKnownPlayerPos = { x: this.game.player.x, y: this.game.player.y };
            entity.turnsWithoutSight = 0;
        }
    }
    
    /**
     * Get list of currently engaged enemies (still alive and recently fought).
     */
    getEngagedEnemies() {
        const currentTurn = this.game.turnCount || 0;
        const engaged = [];
        for (const [id, data] of this.engagedEnemies) {
            if (data.entity.isDead && data.entity.isDead()) {
                this.engagedEnemies.delete(id);
                continue;
            }
            if (currentTurn - data.lastCombatTurn > this.engagementTimeout) {
                this.engagedEnemies.delete(id);
                continue;
            }
            engaged.push(data.entity);
        }
        return engaged;
    }
    
    /**
     * Check if the player is currently in combat (has engaged enemies).
     */
    isInCombat() {
        return this.getEngagedEnemies().length > 0;
    }
    
    /**
     * Resolve a melee attack between two entities.
     * @param {Object} attacker - Entity attacking (Player or NPC)
     * @param {Object} target - Entity being attacked
     * @param {Object} [weapon] - Weapon item used (null = unarmed)
     * @returns {Object} result with { hit, damage, bodyPart, critical, killed }
     */
    resolveAttack(attacker, target, weapon = null) {
        const attackerName = this.getDisplayName(attacker, true);
        const targetName = this.getDisplayName(target, false);
        
        // ── Compute injury penalties for both combatants ──
        const attackerPenalties = attacker.anatomy ? attacker.anatomy.getCombatPenalties() : null;
        const targetPenalties = target.anatomy ? target.anatomy.getCombatPenalties() : null;
        
        // ── Hit check ──
        const hitChance = this.calculateHitChance(attacker, target, weapon);
        const hitRoll = Math.random() * 100;
        
        if (hitRoll > hitChance) {
            // Miss
            this.logMiss(attackerName, targetName);
            // Floating miss text
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y, 'MISS', '#888888', 800);
            }
            // Track engagement and record event
            this.trackEngagement(attacker);
            this.trackEngagement(target);
            this.addCombatEvent({
                type: 'miss',
                attackerName, targetName,
                attacker, target,
                weaponName: weapon ? weapon.name : 'bare fists',
                hitChance: Math.round(hitChance),
                attackerPenalties,
                targetPenalties
            });
            return { hit: false, damage: 0, bodyPart: null, critical: false, killed: false };
        }
        
        // ── Roll hit location (weapon-specific targeting) ──
        let location = this.rollHitLocation(weapon);
        
        // ── Critical hit check ──
        let critChance = this.calculateCritChance(attacker, weapon);
        
        // Opportunistic stance: bonus crit on already-wounded parts
        const attackerStanceForCrit = this.getEntityStance(attacker);
        if (attackerStanceForCrit && attackerStanceForCrit.exploitWounded && target.anatomy) {
            const partName = location.subPart.displayName || location.subPart.part;
            const hasWound = target.anatomy.wounds.some(w => w.location === partName);
            if (hasWound) critChance += 10;
        }
        
        const isCritical = Math.random() * 100 < critChance;
        
        // ── Weapon parry: sharp weapons in defensive stance can fully deflect ──
        // Parry replaces arm intercept — if parry succeeds, attack is negated entirely
        let parried = false;
        if ((location.region === 'head' || location.region === 'torso') && !isCritical) {
            const parryResult = this.checkParry(target);
            if (parryResult.success) {
                parried = true;
                this.logParry(targetName, parryResult.weaponName);
                if (this.game.combatEffects) {
                    this.game.combatEffects.addFloatingText(target.x, target.y, 'PARRY', '#4488ff', 1000);
                }
                // Track engagement and record event
                this.trackEngagement(attacker);
                this.trackEngagement(target);
                this.addCombatEvent({
                    type: 'parry',
                    attackerName, targetName,
                    attacker, target,
                    weaponName: weapon ? weapon.name : 'bare fists',
                    parryWeapon: parryResult.weaponName,
                    hitChance: Math.round(hitChance),
                    attackerPenalties,
                    targetPenalties
                });
                return { hit: false, damage: 0, bodyPart: null, critical: false, killed: false, parried: true };
            }
        }
        
        // ── Arm intercept: instinctive block ──
        // When hit targets head or torso, functional arms may intercept
        if ((location.region === 'head' || location.region === 'torso') && target.anatomy && !isCritical) {
            const interceptChance = this.getArmInterceptChance(target);
            if (Math.random() < interceptChance) {
                const interceptArm = this.pickInterceptArm(target);
                if (interceptArm) {
                    const originalPart = location.subPart.displayName || location.subPart.part;
                    location = interceptArm;
                    const armName = location.subPart.displayName || location.subPart.part;
                    this.game.ui.log(`${targetName} blocks with their ${armName}, shielding their ${originalPart}!`, 'combat');
                }
            }
        }
        
        const partDisplayName = location.subPart.displayName || location.subPart.part;
        
        // ── Calculate damage ──
        let baseDamage = this.rollWeaponDamage(weapon, attacker);
        if (isCritical) baseDamage = Math.floor(baseDamage * 1.5);
        
        // Attacker stance damage modifier
        const attackerStance = this.getEntityStance(attacker);
        if (attackerStance) baseDamage = Math.floor(baseDamage * (attackerStance.damageMod || 1.0));
        
        // Attacker injury damage modifier (arm/hand damage, blood loss, shock)
        if (attackerPenalties && attackerPenalties.damageMod < 1.0) {
            baseDamage = Math.max(1, Math.floor(baseDamage * attackerPenalties.damageMod));
        }
        
        // ── Armor mitigation ──
        const armorResult = this.calculateArmor(target, location.region);
        let finalDamage = Math.max(1, baseDamage - armorResult.reduction);
        const blocked = baseDamage - finalDamage;
        
        // Target stance incoming damage modifier
        const targetStance = this.getEntityStance(target);
        if (targetStance) finalDamage = Math.max(1, Math.floor(finalDamage * (targetStance.incomingDamageMod || 1.0)));
        
        // ── Determine attack type ──
        const attackType = this.getAttackType(weapon);
        
        // ── Apply damage to anatomy ──
        const partResult = this.applyAnatomyDamage(target, location, finalDamage, attackType);
        
        // ── Bleeding / wound creation ──
        if (target.anatomy) {
            const isVital = location.subPart.vital;
            
            // Sharp weapons cause bleeding wounds
            if (attackType === 'sharp') {
                let bleedChance = weapon?.weaponStats?.bleedChance || 0.4;
                // Attacker stance bleed modifier
                if (attackerStance) bleedChance *= (attackerStance.bleedMod || 1.0);
                // Vital organ hits always bleed
                if (isVital) bleedChance = Math.max(bleedChance, 0.8);
                
                if (Math.random() < bleedChance || isCritical) {
                    // Bleed severity scales with damage — higher base rates
                    let severity = isCritical ? finalDamage * 0.8 : finalDamage * 0.5;
                    // Vital organs bleed more (lungs, heart, liver, kidneys)
                    if (isVital) severity *= 1.5;
                    
                    const isArterial = isVital && (isCritical || Math.random() < 0.2);
                    let woundType;
                    if (isArterial) {
                        woundType = 'arterial';
                    } else if (isVital) {
                        woundType = 'puncture'; // deep stab into organ
                    } else {
                        woundType = Math.random() < 0.5 ? 'cut' : 'laceration';
                    }
                    target.anatomy.addWound(partDisplayName, severity, woundType);
                    this.logWound(targetName, partDisplayName, woundType);
                }
            }
            
            // Blunt weapons: internal bleeding on vital hits, surface bleeding on head/face
            if (attackType === 'blunt') {
                // Vital organ hits with blunt force — internal bleeding
                if (isVital && (isCritical || Math.random() < 0.25)) {
                    const severity = isCritical ? finalDamage * 0.6 : finalDamage * 0.3;
                    target.anatomy.addWound(partDisplayName, severity, 'internal');
                    this.logWound(targetName, partDisplayName, 'internal');
                }
                // Head/face hits split skin — surface bleeding
                else if (location.region === 'head' && Math.random() < 0.35) {
                    const severity = finalDamage * 0.2;
                    target.anatomy.addWound(partDisplayName, severity, 'laceration');
                    this.logWound(targetName, partDisplayName, 'laceration');
                }
            }
            
            // Unarmed: only bleeds on crits to the face
            if (attackType === 'unarmed' && isCritical && location.region === 'head') {
                const severity = finalDamage * 0.15;
                target.anatomy.addWound(partDisplayName, severity, 'laceration');
                this.logWound(targetName, partDisplayName, 'laceration');
            }
            
            // Record pain for shock tracking
            const currentTurn = this.game.turnCount || 0;
            target.anatomy.addPain(finalDamage, currentTurn);
        }
        
        // ── Stagger check (blunt weapons can stun for 1 turn) ──
        let staggered = false;
        if (attackType === 'blunt' && !killed) {
            staggered = this.checkStagger(attacker, target, weapon, finalDamage, isCritical);
            if (staggered) {
                this.logStagger(targetName);
            }
        }
        
        // ── Generate combat log ──
        const weaponName = weapon ? weapon.name : null;
        
        if (isCritical) {
            this.logCritical(attackerName, targetName, weaponName, partDisplayName, finalDamage, attackType);
        } else {
            this.logAttack(attackerName, targetName, weaponName, partDisplayName, finalDamage, attackType);
        }
        
        if (blocked > 0 && armorResult.armorName) {
            this.logBlock(attackerName, targetName, armorResult.armorName, blocked);
        }
        
        if (partResult.destroyed) {
            this.logPartDestroyed(targetName, partDisplayName);
        }
        
        // ── Visual combat feedback ──
        if (this.game.combatEffects) {
            const fx = this.game.combatEffects;
            
            // Shake the target
            const shakeIntensity = isCritical ? 5 : 3;
            const shakeDuration = isCritical ? 350 : 200;
            fx.shakeEntity(target, shakeIntensity, shakeDuration);
            
            // Floating damage text
            const dmgColor = isCritical ? '#ffff00' : '#ff4444';
            const dmgText = isCritical ? `CRIT ${finalDamage}` : `${finalDamage}`;
            fx.addFloatingText(target.x, target.y, dmgText, dmgColor, 1000);
            
            // Body part hit indicator (slightly delayed, below damage)
            const partText = partDisplayName.toUpperCase();
            fx.addFloatingText(target.x, target.y + 0.4, partText, '#cccccc', 800);
            
            // Part destroyed callout
            if (partResult.destroyed) {
                fx.addFloatingText(target.x, target.y - 0.3, `${partDisplayName} DESTROYED`, '#ff8800', 1500);
            }
        }
        
        // ── Check death ──
        const killed = this.checkDeath(target);
        if (killed) {
            this.logKill(targetName, target);
            // Death floating text
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, 'KILLED', '#ff0000', 2000);
            }
        }
        
        // ── Track engagement and record structured event ──
        this.trackEngagement(attacker);
        this.trackEngagement(target);
        
        // Gather wound info created this attack
        const woundsInflicted = [];
        if (target.anatomy) {
            // Check the most recent wound(s) — they were just added above
            const recentWounds = target.anatomy.wounds.filter(w => w.turnsActive === 0);
            for (const w of recentWounds) {
                woundsInflicted.push({ part: w.part, type: w.type, severity: w.severity });
            }
        }
        
        this.addCombatEvent({
            type: 'hit',
            attackerName, targetName,
            attacker, target,
            weaponName: weapon ? weapon.name : 'bare fists',
            attackType,
            bodyPart: partDisplayName,
            region: location.region,
            damage: finalDamage,
            blocked,
            armorName: armorResult.armorName,
            critical: isCritical,
            staggered,
            partDestroyed: partResult.destroyed,
            woundsInflicted,
            killed,
            hitChance: Math.round(hitChance),
            critChance: Math.round(critChance),
            attackerPenalties,
            targetPenalties
        });
        
        return {
            hit: true,
            damage: finalDamage,
            bodyPart: partDisplayName,
            region: location.region,
            critical: isCritical,
            killed,
            blocked,
            staggered
        };
    }
    
    // ── Hit chance ──────────────────────────────────────────────────────
    
    calculateHitChance(attacker, target, weapon) {
        // Base 55% — stats and gear push this up or down significantly
        let chance = 55;
        
        // Attacker stats: STR helps land heavy blows, AGI helps accuracy
        if (attacker.stats) {
            chance += (attacker.stats.strength - 10) * 1.5;  // STR: strong hits are hard to dodge
            chance += (attacker.stats.agility - 10) * 1.0;   // AGI: fast = accurate
        }
        
        // Target stats: AGI is primary dodge stat, STR helps resist stagger
        if (target.stats) {
            chance -= (target.stats.agility - 10) * 2.0;     // AGI: agile targets dodge more
        }
        
        // Weapon accuracy bonus (good weapons are easier to hit with)
        if (weapon && weapon.weaponStats && weapon.weaponStats.accuracy !== undefined) {
            chance += weapon.weaponStats.accuracy;
        }
        
        // Unarmed heavy penalty — fists are desperate and inaccurate
        if (!weapon) chance -= 20;
        
        // Stance modifier (attacker)
        const attackerStance = this.getEntityStance(attacker);
        if (attackerStance) chance += (attackerStance.hitMod || 0);
        
        // Attacker injury penalties (arm/hand damage, blood loss, shock)
        if (attacker.anatomy) {
            const penalties = attacker.anatomy.getCombatPenalties();
            chance += penalties.hitChanceMod;
        }
        
        // Target injury dodge penalties (leg damage, blood loss, shock make them easier to hit)
        if (target.anatomy) {
            const targetPenalties = target.anatomy.getCombatPenalties();
            chance += targetPenalties.dodgeMod;
        }
        
        // Prone targets are much easier to hit
        if (this.game.abilitySystem && this.game.abilitySystem.hasEffect(target, 'prone')) {
            const proneEffect = this.game.abilitySystem.getEffect(target, 'prone');
            chance += (proneEffect && proneEffect.data.dodgePenalty) || 15;
        }
        
        return Math.max(15, Math.min(95, chance));
    }
    
    calculateCritChance(attacker, weapon) {
        let chance = 5; // Base 5%
        
        if (attacker.stats) {
            // PER: spot openings. AGI: exploit them quickly
            chance += (attacker.stats.perception - 10) * 1.0;
            chance += (attacker.stats.agility - 10) * 0.5;
        }
        
        // Weapon crit bonus (precise weapons crit more)
        if (weapon && weapon.weaponStats && weapon.weaponStats.critBonus) {
            chance += weapon.weaponStats.critBonus;
        }
        
        // Stance modifier
        const stance = this.getEntityStance(attacker);
        if (stance) chance += (stance.critMod || 0);
        
        // Unarmed penalty — fists are imprecise
        if (!weapon) chance -= 3;
        
        // Injury penalties (eye damage, blood loss, shock)
        if (attacker.anatomy) {
            const penalties = attacker.anatomy.getCombatPenalties();
            chance += penalties.critChanceMod;
        }
        
        return Math.max(1, Math.min(30, chance));
    }
    
    /**
     * Get the combat stance data for an entity.
     * Players have explicit stances; NPCs default to aggressive.
     */
    getEntityStance(entity) {
        if (entity.combatStances && entity.combatStance) {
            return entity.combatStances[entity.combatStance];
        }
        return null;
    }
    
    // ── Hit location ───────────────────────────────────────────────────
    
    rollHitLocation(weapon = null) {
        // Use weapon-specific targeting profile
        const attackType = this.getAttackType(weapon);
        const regionWeights = WEAPON_TARGETING[attackType] || BODY_REGIONS;
        
        const region = this.weightedRandom(regionWeights, 'weight', 'region');
        const subParts = REGION_PARTS[region];
        const subPart = this.weightedRandom(subParts, 'weight');
        
        return { region, subPart };
    }
    
    weightedRandom(items, weightKey, returnKey = null) {
        const totalWeight = items.reduce((sum, item) => sum + item[weightKey], 0);
        let roll = Math.random() * totalWeight;
        
        for (const item of items) {
            roll -= item[weightKey];
            if (roll <= 0) {
                return returnKey ? item[returnKey] : item;
            }
        }
        return returnKey ? items[items.length - 1][returnKey] : items[items.length - 1];
    }
    
    // ── Arm intercept helpers ──────────────────────────────────────────
    
    /**
     * Calculate chance that target's arms intercept a head/torso hit.
     * Both arms functional = 25%, one arm = 12%, no arms = 0%.
     */
    getArmInterceptChance(target) {
        if (!target.anatomy) return 0;
        const leftArm = target.anatomy.parts.leftArm.arm;
        const rightArm = target.anatomy.parts.rightArm.arm;
        const functional = (leftArm.functional ? 1 : 0) + (rightArm.functional ? 1 : 0);
        let baseChance = 0;
        if (functional === 2) baseChance = 0.25;
        else if (functional === 1) baseChance = 0.12;
        
        // Target stance modifies intercept (defensive guards more, aggressive less)
        const stance = this.getEntityStance(target);
        if (stance) baseChance *= (stance.interceptMod || 1.0);
        
        // Guard break ability effect reduces intercept
        if (this.game.abilitySystem) {
            baseChance *= this.game.abilitySystem.getInterceptModifier(target);
        }
        
        return Math.min(0.6, baseChance); // Cap at 60%
    }
    
    /**
     * Pick which arm intercepts. Returns a location object like rollHitLocation.
     * Prefers the arm with more HP (instinctively shields with the stronger arm).
     */
    pickInterceptArm(target) {
        if (!target.anatomy) return null;
        const leftArm = target.anatomy.parts.leftArm.arm;
        const rightArm = target.anatomy.parts.rightArm.arm;
        
        let armRegion, armSubPart;
        if (leftArm.functional && rightArm.functional) {
            // Pick the arm with more HP
            if (leftArm.hp >= rightArm.hp) {
                armRegion = 'leftArm';
                armSubPart = REGION_PARTS.leftArm[0]; // left arm main
            } else {
                armRegion = 'rightArm';
                armSubPart = REGION_PARTS.rightArm[0]; // right arm main
            }
        } else if (leftArm.functional) {
            armRegion = 'leftArm';
            armSubPart = REGION_PARTS.leftArm[0];
        } else if (rightArm.functional) {
            armRegion = 'rightArm';
            armSubPart = REGION_PARTS.rightArm[0];
        } else {
            return null;
        }
        
        return { region: armRegion, subPart: armSubPart };
    }
    
    // ── Stagger check ────────────────────────────────────────────────
    
    /**
     * Check if a blunt weapon hit staggers the target (stun for 1 turn).
     * Chance = weapon staggerChance + attacker STR bonus - target END resistance.
     * Crits always stagger. Uses AbilitySystem.applyStun().
     */
    checkStagger(attacker, target, weapon, damage, isCritical) {
        if (!this.game.abilitySystem) return false;
        
        // Crits with blunt weapons always stagger
        if (isCritical) {
            this.game.abilitySystem.applyStun(target, 1);
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, 'STAGGERED', '#ffaa00', 1200);
            }
            return true;
        }
        
        // Base stagger chance from weapon (default 15% for blunt)
        let chance = (weapon && weapon.weaponStats && weapon.weaponStats.staggerChance)
            ? weapon.weaponStats.staggerChance
            : 0.15;
        
        // Attacker STR increases stagger chance (+3% per point above 10)
        if (attacker.stats) {
            chance += (attacker.stats.strength - 10) * 0.03;
        }
        
        // Target END resists stagger (-3% per point above 10)
        if (target.stats) {
            chance -= (target.stats.endurance - 10) * 0.03;
        }
        
        // High damage hits stagger more (+5% per point above 5 damage)
        if (damage > 5) {
            chance += (damage - 5) * 0.05;
        }
        
        chance = Math.max(0.05, Math.min(0.50, chance));
        
        if (Math.random() < chance) {
            this.game.abilitySystem.applyStun(target, 1);
            if (this.game.combatEffects) {
                this.game.combatEffects.addFloatingText(target.x, target.y - 0.5, 'STAGGERED', '#ffaa00', 1200);
            }
            return true;
        }
        
        return false;
    }
    
    // ── Parry check ─────────────────────────────────────────────────
    
    /**
     * Check if the target parries the incoming attack.
     * Requires: target has a weapon with parryBonus, and is in defensive stance.
     * Parry chance = parryBonus + target AGI bonus.
     * Returns { success: boolean, weaponName: string }
     */
    checkParry(target) {
        // Get target's weapon
        let targetWeapon = null;
        let targetWeaponName = null;
        
        // Player: check equipped weapon
        if (target.equipmentSystem) {
            targetWeapon = target.equipmentSystem.getActiveWeapon();
        }
        // NPC: check .weapon field
        if (!targetWeapon && target.weapon) {
            targetWeapon = target.weapon;
        }
        
        if (!targetWeapon || !targetWeapon.weaponStats || !targetWeapon.weaponStats.parryBonus) {
            return { success: false };
        }
        
        targetWeaponName = targetWeapon.name;
        
        // Must be in defensive stance (or have a stance with parry enabled)
        const stance = this.getEntityStance(target);
        const isDefensive = stance && (stance.canDisengage || stance.interceptMod > 1.0);
        
        // Base parry chance from weapon
        let chance = targetWeapon.weaponStats.parryBonus;
        
        // Defensive stance doubles parry chance; non-defensive gets only half
        if (isDefensive) {
            chance *= 2.0;
        } else {
            chance *= 0.5;
        }
        
        // Target AGI bonus (+2% per point above 10)
        if (target.stats) {
            chance += (target.stats.agility - 10) * 0.02;
        }
        
        chance = Math.max(0, Math.min(0.40, chance));
        
        if (Math.random() < chance) {
            return { success: true, weaponName: targetWeaponName };
        }
        
        return { success: false };
    }
    
    // ── Damage calculation ─────────────────────────────────────────────
    
    rollWeaponDamage(weapon, attacker) {
        let damage = 0;
        
        if (weapon && weapon.baseDamage) {
            damage = this.rollDice(weapon.baseDamage);
            if (weapon.damageMod) {
                damage = Math.floor(damage * (1 + weapon.damageMod));
            }
        } else if (weapon && weapon.weaponStats && weapon.weaponStats.damage) {
            damage = this.rollDice(weapon.weaponStats.damage);
        } else {
            // Unarmed: 1d2 (was 1d3 — fists are weak)
            damage = Math.floor(Math.random() * 2) + 1;
        }
        
        // Strength bonus — scales better now
        // STR 10 = +0, STR 12 = +1, STR 14 = +2, STR 8 = -1
        if (attacker.stats && attacker.stats.strength) {
            damage += Math.floor((attacker.stats.strength - 10) / 2);
        }
        
        // NPC flat damage bonus (NPCs without stats — legacy fallback)
        if (attacker.baseDamage && !attacker.stats) {
            damage += attacker.baseDamage;
        }
        
        // Injury damage modifier (arm/hand damage, blood loss, shock)
        if (attacker.anatomy) {
            const penalties = attacker.anatomy.getCombatPenalties();
            damage = Math.floor(damage * penalties.damageMod);
        }
        
        return Math.max(1, damage);
    }
    
    rollDice(diceString) {
        if (!diceString) return 0;
        
        let total = 0;
        // Handle compound dice like "1d8+1d6"
        const groups = diceString.split('+');
        for (const group of groups) {
            const trimmed = group.trim();
            if (trimmed.includes('d')) {
                const [count, sides] = trimmed.split('d').map(Number);
                for (let i = 0; i < count; i++) {
                    total += Math.floor(Math.random() * sides) + 1;
                }
            } else {
                total += parseInt(trimmed) || 0;
            }
        }
        return total;
    }
    
    getAttackType(weapon) {
        if (!weapon) return 'unarmed';
        if (weapon.weaponStats && weapon.weaponStats.attackType) return weapon.weaponStats.attackType;
        if (weapon.attackType) return weapon.attackType;
        return 'blunt';
    }
    
    // ── Armor ──────────────────────────────────────────────────────────
    
    calculateArmor(target, region) {
        let reduction = 0;
        let armorName = null;
        
        if (!target.equipment) return { reduction: 0, armorName: null };
        
        for (const [slot, coveredRegions] of Object.entries(ARMOR_COVERAGE)) {
            if (!coveredRegions.includes(region)) continue;
            
            const item = target.equipment[slot];
            if (item && item.defense) {
                reduction += item.defense;
                armorName = armorName || item.name;
            }
        }
        
        return { reduction, armorName };
    }
    
    // ── Anatomy damage ─────────────────────────────────────────────────
    
    applyAnatomyDamage(target, location, damage, attackType = 'blunt') {
        if (!target.anatomy || !target.anatomy.parts) {
            return { destroyed: false };
        }
        
        const subPart = location.subPart;
        if (!subPart.path) {
            // Glancing hit — no specific organ, just general region damage
            return { destroyed: false };
        }
        
        // Navigate the anatomy path (e.g., "head.eyes.0")
        const pathParts = subPart.path.split('.');
        let part = target.anatomy.parts;
        for (const p of pathParts) {
            if (part === undefined || part === null) return { destroyed: false };
            const idx = parseInt(p);
            part = isNaN(idx) ? part[p] : part[idx];
        }
        
        if (!part || part.hp === undefined) return { destroyed: false };
        
        const wasFunctional = part.functional;
        part.hp = Math.max(0, part.hp - damage);
        
        // Track damage type for context-aware status labels
        // Map weapon attackType to anatomy damage categories
        const damageTypeMap = { 'sharp': 'sharp', 'blunt': 'blunt', 'unarmed': 'blunt' };
        part.lastDamageType = damageTypeMap[attackType] || 'blunt';
        // Shivs and knives are stab weapons — differentiate from slash
        if (attackType === 'sharp' && subPart.vital) {
            part.lastDamageType = 'stab'; // deep penetrating hits on organs
        }
        
        if (part.hp <= 0 && wasFunctional) {
            part.functional = false;
            return { destroyed: true };
        }
        
        return { destroyed: false };
    }
    
    // ── Death check ────────────────────────────────────────────────────
    
    checkDeath(target) {
        // Anatomy-based death check
        if (target.anatomy) {
            return target.anatomy.isDead();
        }
        
        return false;
    }
    
    // ── Display helpers ────────────────────────────────────────────────
    
    getDisplayName(entity, isAttacker) {
        if (entity === this.game.player) return 'You';
        return entity.name || 'Something';
    }
    
    getDamageIntensity(damage) {
        if (damage <= 2) return 'light';
        if (damage <= 6) return 'medium';
        return 'heavy';
    }
    
    pickRandom(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }
    
    // ── Log generation ─────────────────────────────────────────────────
    
    logAttack(attacker, target, weaponName, bodyPart, damage, attackType) {
        const intensity = this.getDamageIntensity(damage);
        const verbs = ATTACK_VERBS[attackType] || ATTACK_VERBS.blunt;
        const verb = this.pickRandom(verbs[intensity]);
        
        const isPlayer = attacker === 'You';
        const conjugatedVerb = isPlayer ? this.baseForm(verb) : verb;
        
        const templates = weaponName ? ATTACK_TEMPLATES : ATTACK_TEMPLATES_UNARMED;
        let msg = this.pickRandom(templates);
        
        msg = msg.replace('{a}', attacker)
                  .replace('{t}', target)
                  .replace('{w}', weaponName || 'bare fists')
                  .replace('{p}', bodyPart)
                  .replace('{d}', damage)
                  .replace('{verb}', conjugatedVerb);
        
        this.game.ui.log(msg, 'combat');
    }
    
    logCritical(attacker, target, weaponName, bodyPart, damage, attackType) {
        const intensity = 'heavy';
        const verbs = ATTACK_VERBS[attackType] || ATTACK_VERBS.blunt;
        const verb = this.pickRandom(verbs[intensity]);
        
        const isPlayer = attacker === 'You';
        const conjugatedVerb = isPlayer ? this.baseForm(verb) : verb;
        
        let msg = this.pickRandom(CRITICAL_TEMPLATES);
        
        msg = msg.replace('{a}', attacker)
                  .replace('{t}', target)
                  .replace('{w}', weaponName || 'bare fists')
                  .replace('{p}', bodyPart)
                  .replace('{d}', damage)
                  .replace('{verb}', conjugatedVerb);
        
        this.game.ui.log(msg, 'combat');
    }
    
    logMiss(attacker, target) {
        let msg = this.pickRandom(MISS_TEMPLATES);
        msg = msg.replace('{a}', attacker).replace('{t}', target);
        this.game.ui.log(msg, 'combat');
    }
    
    logBlock(attacker, target, armorName, blocked) {
        let msg = this.pickRandom(BLOCK_TEMPLATES);
        msg = msg.replace('{a}', attacker)
                  .replace('{t}', target)
                  .replace('{armor}', armorName)
                  .replace('{blocked}', blocked);
        this.game.ui.log(msg, 'info');
    }
    
    logStagger(target) {
        let msg = this.pickRandom(STAGGER_TEMPLATES);
        msg = msg.replace('{t}', target);
        this.game.ui.log(msg, 'combat');
    }
    
    logParry(target, weaponName) {
        let msg = this.pickRandom(PARRY_TEMPLATES);
        msg = msg.replace('{t}', target).replace('{w}', weaponName);
        this.game.ui.log(msg, 'combat');
    }
    
    logPartDestroyed(target, bodyPart) {
        let msg = this.pickRandom(PART_DESTROYED_TEMPLATES);
        msg = msg.replace('{t}', target).replace('{p}', bodyPart);
        this.game.ui.log(msg, 'combat');
    }
    
    logKill(target, entity = null) {
        let msg = this.pickRandom(KILL_TEMPLATES);
        msg = msg.replace('{t}', target);
        this.game.ui.log(msg, 'combat');
        
        // Log cause of death if anatomy is available
        if (entity && entity.anatomy && entity.anatomy.causeOfDeath) {
            const cause = entity.anatomy.getDeathCause();
            this.game.ui.log(`Cause of death: ${cause}.`, 'combat');
        }
    }
    
    logWound(target, bodyPart, woundType) {
        const templates = {
            cut: [
                'Blood wells from a cut on {t}\'s {p}.',
                'A gash opens on {t}\'s {p}, bleeding freely.',
                '{t}\'s {p} is sliced open — blood flows.',
            ],
            laceration: [
                '{t}\'s {p} is torn open — a nasty laceration.',
                'A ragged wound opens across {t}\'s {p}.',
                'Flesh tears on {t}\'s {p}, blood seeping out.',
            ],
            puncture: [
                'The blade sinks deep into {t}\'s {p} — blood wells up.',
                '{t}\'s {p} is punctured — dark blood seeps out.',
                'A deep stab wound in {t}\'s {p} bleeds steadily.',
            ],
            arterial: [
                'Blood sprays from {t}\'s {p} — an artery is hit!',
                'Bright red blood pulses from {t}\'s {p}!',
                'A deep wound on {t}\'s {p} gushes blood!',
            ],
            internal: [
                '{t} coughs blood — internal damage to the {p}.',
                'Something ruptures inside {t}\'s {p}.',
                '{t} staggers — internal bleeding from the {p}.',
            ]
        };
        
        const pool = templates[woundType] || templates.cut;
        let msg = this.pickRandom(pool);
        msg = msg.replace('{t}', target).replace('{p}', bodyPart);
        this.game.ui.log(msg, 'combat');
    }
    
    /**
     * Convert third-person verb to base form for "You" subject.
     * "strikes" → "strike", "crushes" → "crush", "hits" → "hit"
     */
    baseForm(verb) {
        // Handle multi-word verbs like "rips into" — conjugate only the first word
        const parts = verb.split(' ');
        let first = parts[0];
        const rest = parts.slice(1).join(' ');
        
        if (first.endsWith('es') && (first.endsWith('shes') || first.endsWith('ches') || first.endsWith('zes') || first.endsWith('xes') || first.endsWith('sses'))) {
            first = first.slice(0, -2);
        } else if (first.endsWith('ies')) {
            first = first.slice(0, -3) + 'y';
        } else if (first.endsWith('s') && !first.endsWith('ss')) {
            first = first.slice(0, -1);
        }
        
        return rest ? `${first} ${rest}` : first;
    }
}
