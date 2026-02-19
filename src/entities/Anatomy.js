/**
 * Anatomy - Full body simulation replacing the HP bar.
 * 
 * Every entity has blood, organs, limbs. Death comes from:
 * - Blood loss (bleeding out from wounds)
 * - Brain destruction (instant death)
 * - Heart destruction (massive internal bleed → rapid death)
 * - Both lungs destroyed (suffocation over turns)
 * - Organ failure cascade (liver + kidneys → toxin buildup)
 * - Shock (too much pain/trauma at once)
 * 
 * EXPANSION POINTS:
 * - Infection from untreated wounds
 * - Fractures and splinting
 * - Tourniquet system
 * - Cybernetic organ replacements
 * - Blood type / transfusion
 */

// Blood loss thresholds (percentage of max blood remaining)
const BLOOD_THRESHOLDS = {
    healthy:      80,  // 80-100% — no effects
    lightheaded:  60,  // 60-80% — minor penalties
    woozy:        40,  // 40-60% — significant penalties, vision dims
    critical:     20,  // 20-40% — near unconscious, severe penalties
    unconscious:  10,  // 10-20% — passed out, helpless
    dead:          0   // 0-10% — death from exsanguination
};

// Suffocation: turns until death when both lungs are destroyed
const SUFFOCATION_TURNS = 8;

// Shock threshold: total pain accumulated in a short window
const SHOCK_THRESHOLD = 80;
const SHOCK_WINDOW = 5; // turns

// Infection
const INFECTION_CHANCE_PER_TURN = 0.03;  // 3% per turn per untreated wound
const INFECTION_DAMAGE_PER_TURN = 0.5;   // HP damage to the wounded region per turn
const INFECTION_SPREAD_CHANCE = 0.02;    // 2% chance per turn to spread to adjacent region

export class Anatomy {
    constructor(entity) {
        this.entity = entity;
        this.parts = {};
        
        // Blood system
        this.blood = 100;
        this.maxBlood = 100;
        this.wounds = [];       // Active bleeding wounds
        
        // Suffocation tracking
        this.suffocating = false;
        this.suffocationTurns = 0;
        
        // Pain/shock tracking
        this.painHistory = [];  // { amount, turn } entries
        this.inShock = false;
        
        // Death state
        this.alive = true;
        this.causeOfDeath = null;
        
        // Natural blood recovery (very slow, only after wounds fully closed + cooldown)
        this.clotRate = 0.15;
        this.regenCooldown = 0;  // turns remaining before blood can regenerate
        
        // Pain suppression (from painkillers)
        this.painSuppression = 0;       // turns remaining of pain suppression
        this.shockThresholdBonus = 0;    // temporary bonus to shock threshold
    }
    
    init() {
        this.parts = {
            head: {
                eyes: [
                    { name: 'Left Eye', hp: 10, maxHP: 10, functional: true, cybernetic: false },
                    { name: 'Right Eye', hp: 10, maxHP: 10, functional: true, cybernetic: false }
                ],
                ears: [
                    { name: 'Left Ear', hp: 10, maxHP: 10, functional: true, cybernetic: false },
                    { name: 'Right Ear', hp: 10, maxHP: 10, functional: true, cybernetic: false }
                ],
                brain: { name: 'Brain', hp: 50, maxHP: 50, functional: true, cybernetic: false },
                jaw: { name: 'Jaw', hp: 20, maxHP: 20, functional: true, cybernetic: false }
            },
            torso: {
                heart: { name: 'Heart', hp: 40, maxHP: 40, functional: true, cybernetic: false },
                lungs: [
                    { name: 'Left Lung', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                    { name: 'Right Lung', hp: 30, maxHP: 30, functional: true, cybernetic: false }
                ],
                stomach: { name: 'Stomach', hp: 25, maxHP: 25, functional: true, cybernetic: false },
                liver: { name: 'Liver', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                kidneys: [
                    { name: 'Left Kidney', hp: 20, maxHP: 20, functional: true, cybernetic: false },
                    { name: 'Right Kidney', hp: 20, maxHP: 20, functional: true, cybernetic: false }
                ]
            },
            leftArm: {
                arm: { name: 'Left Arm', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                hand: { name: 'Left Hand', hp: 20, maxHP: 20, functional: true, cybernetic: false },
                fingers: []
            },
            rightArm: {
                arm: { name: 'Right Arm', hp: 30, maxHP: 30, functional: true, cybernetic: false },
                hand: { name: 'Right Hand', hp: 20, maxHP: 20, functional: true, cybernetic: false },
                fingers: []
            },
            leftLeg: {
                leg: { name: 'Left Leg', hp: 35, maxHP: 35, functional: true, cybernetic: false },
                foot: { name: 'Left Foot', hp: 20, maxHP: 20, functional: true, cybernetic: false }
            },
            rightLeg: {
                leg: { name: 'Right Leg', hp: 35, maxHP: 35, functional: true, cybernetic: false },
                foot: { name: 'Right Foot', hp: 20, maxHP: 20, functional: true, cybernetic: false }
            }
        };
        
        for (let i = 0; i < 5; i++) {
            this.parts.leftArm.fingers.push({
                name: `Left Finger ${i + 1}`,
                hp: 5,
                maxHP: 5,
                functional: true,
                cybernetic: false
            });
            this.parts.rightArm.fingers.push({
                name: `Right Finger ${i + 1}`,
                hp: 5,
                maxHP: 5,
                functional: true,
                cybernetic: false
            });
        }
    }
    
    // ── Blood & Wound System ───────────────────────────────────────────
    
    /**
     * Add a bleeding wound. Called by CombatSystem on sharp/piercing hits.
     * @param {string} partName - Display name of the wounded body part
     * @param {number} severity - Bleed rate per turn (blood lost)
     * @param {string} type - 'cut', 'stab', 'laceration', 'arterial'
     */
    addWound(partName, severity, type = 'cut') {
        this.wounds.push({
            part: partName,
            severity,
            type,
            turnsActive: 0,
            clotting: false,
            bandaged: false,
            disinfected: false,
            infected: false,
            infectionSeverity: 0
        });
    }
    
    /**
     * Process all bleeding wounds for one turn.
     * Wounds slowly clot over time (severity decreases).
     * Returns total blood lost this turn.
     */
    processWounds() {
        let totalBloodLoss = 0;
        
        for (let i = this.wounds.length - 1; i >= 0; i--) {
            const wound = this.wounds[i];
            wound.turnsActive++;
            
            // Blood loss this turn from this wound
            totalBloodLoss += wound.severity;
            
            // Natural clotting: wounds slowly reduce in severity
            // Clotting doesn't start until the wound has been open a few turns
            // Deep/internal wounds take longer to clot and clot slower
            let clotDelay, clotSpeed;
            switch (wound.type) {
                case 'arterial':  clotDelay = 10; clotSpeed = 0.02; break;
                case 'internal':  clotDelay = 8;  clotSpeed = 0.03; break;
                case 'puncture':  clotDelay = 6;  clotSpeed = 0.05; break;
                case 'laceration': clotDelay = 3; clotSpeed = 0.08; break;
                case 'cut':       clotDelay = 3;  clotSpeed = 0.10; break;
                default:          clotDelay = 3;  clotSpeed = 0.08; break;
            }
            // Bandaged wounds clot faster
            if (wound.bandaged) {
                clotDelay = Math.max(1, clotDelay - 2);
                clotSpeed *= 2.0;
            }
            if (wound.turnsActive > clotDelay) {
                wound.severity = Math.max(0, wound.severity - clotSpeed);
            }
            
            // Infection risk: untreated wounds can become infected
            if (!wound.infected && !wound.disinfected && !wound.bandaged && wound.type !== 'internal') {
                if (wound.turnsActive > 5 && Math.random() < INFECTION_CHANCE_PER_TURN) {
                    wound.infected = true;
                    wound.infectionSeverity = 1;
                }
            }
            
            // Infection progression
            if (wound.infected) {
                wound.infectionSeverity = Math.min(10, wound.infectionSeverity + 0.1);
            }
            
            // Remove fully clotted wounds
            if (wound.severity <= 0.01) {
                this.wounds.splice(i, 1);
                // Set regen cooldown — blood doesn't recover immediately after wounds close
                this.regenCooldown = Math.max(this.regenCooldown, 10);
            }
        }
        
        return totalBloodLoss;
    }
    
    /**
     * Process one turn of anatomy effects.
     * Called each turn from Player.processStatusEffects() or NPC turn processing.
     * Returns { alive, effects[] } where effects are log-worthy events.
     */
    processTurn(currentTurn) {
        if (!this.alive) return { alive: false, effects: [] };
        
        const effects = [];
        
        // ── Process bleeding ──
        const bloodLost = this.processWounds();
        if (bloodLost > 0) {
            this.blood = Math.max(0, this.blood - bloodLost);
        }
        
        // Natural blood recovery — only when no wounds AND cooldown expired
        if (this.wounds.length === 0 && this.blood < this.maxBlood) {
            if (this.regenCooldown > 0) {
                this.regenCooldown--;
            } else {
                this.blood = Math.min(this.maxBlood, this.blood + this.clotRate);
            }
        } else {
            // Reset cooldown while actively bleeding
            this.regenCooldown = 0;
        }
        
        // ── Heart destroyed → massive internal bleed ──
        const heart = this.parts.torso.heart;
        if (!heart.functional) {
            this.blood = Math.max(0, this.blood - 8);
            if (this.blood > 0) {
                effects.push({ type: 'organ', msg: 'Blood pours from catastrophic cardiac damage!' });
            }
        }
        
        // ── Suffocation (both lungs destroyed) ──
        const leftLung = this.parts.torso.lungs[0];
        const rightLung = this.parts.torso.lungs[1];
        if (!leftLung.functional && !rightLung.functional) {
            if (!this.suffocating) {
                this.suffocating = true;
                this.suffocationTurns = 0;
                effects.push({ type: 'organ', msg: 'Both lungs have collapsed — suffocating!' });
            }
            this.suffocationTurns++;
            if (this.suffocationTurns >= SUFFOCATION_TURNS) {
                this.alive = false;
                this.causeOfDeath = 'suffocation';
                effects.push({ type: 'death', msg: 'suffocated from collapsed lungs' });
                return { alive: false, effects };
            } else if (this.suffocationTurns > SUFFOCATION_TURNS / 2) {
                effects.push({ type: 'organ', msg: 'Gasping desperately for air...' });
            }
        } else {
            if (this.suffocating) {
                this.suffocating = false;
                this.suffocationTurns = 0;
            }
        }
        
        // ── Liver/kidney failure → slow toxin buildup ──
        const liver = this.parts.torso.liver;
        const leftKidney = this.parts.torso.kidneys[0];
        const rightKidney = this.parts.torso.kidneys[1];
        const organFailures = (!liver.functional ? 1 : 0) + (!leftKidney.functional ? 1 : 0) + (!rightKidney.functional ? 1 : 0);
        if (organFailures >= 2) {
            // Toxin buildup damages brain slowly
            const toxinDamage = organFailures >= 3 ? 2 : 1;
            const brain = this.parts.head.brain;
            if (brain.functional) {
                brain.hp = Math.max(0, brain.hp - toxinDamage);
                if (brain.hp <= 0) {
                    brain.functional = false;
                }
                if (Math.random() < 0.3) {
                    effects.push({ type: 'organ', msg: 'Toxins cloud your mind — organ failure is setting in...' });
                }
            }
        }
        
        // ── Infection damage ──
        for (const wound of this.wounds) {
            if (wound.infected && wound.infectionSeverity >= 3) {
                // Infection damages the body — fever, tissue damage
                this.blood = Math.max(0, this.blood - INFECTION_DAMAGE_PER_TURN * (wound.infectionSeverity / 5));
                if (Math.random() < 0.15) {
                    effects.push({ type: 'infection', msg: `Infection in ${wound.part} is getting worse...` });
                }
                // Severe infection can cause sepsis (organ damage)
                if (wound.infectionSeverity >= 7 && Math.random() < 0.1) {
                    const liver = this.parts.torso.liver;
                    if (liver.functional) {
                        liver.hp = Math.max(0, liver.hp - 1);
                        if (liver.hp <= 0) liver.functional = false;
                        effects.push({ type: 'infection', msg: 'Sepsis is setting in — organ damage!' });
                    }
                }
            }
        }
        
        // ── Pain suppression tick ──
        if (this.painSuppression > 0) {
            this.painSuppression--;
            if (this.painSuppression <= 0) {
                this.shockThresholdBonus = 0;
            }
        }
        
        // ── Shock check ──
        this.painHistory = this.painHistory.filter(p => currentTurn - p.turn < SHOCK_WINDOW);
        let recentPain = this.painHistory.reduce((sum, p) => sum + p.amount, 0);
        // Pain suppression reduces effective pain
        if (this.painSuppression > 0) {
            recentPain *= 0.4;
        }
        const effectiveThreshold = SHOCK_THRESHOLD + this.shockThresholdBonus;
        if (recentPain >= effectiveThreshold && !this.inShock) {
            this.inShock = true;
            effects.push({ type: 'shock', msg: 'The pain is overwhelming — going into shock!' });
        } else if (recentPain < effectiveThreshold * 0.5) {
            this.inShock = false;
        }
        
        // ── Blood loss status effects ──
        const bloodPercent = this.getBloodPercent();
        if (bloodPercent <= BLOOD_THRESHOLDS.dead) {
            this.alive = false;
            this.causeOfDeath = 'blood loss';
            effects.push({ type: 'death', msg: 'bled out' });
            return { alive: false, effects };
        } else if (bloodPercent <= BLOOD_THRESHOLDS.unconscious) {
            effects.push({ type: 'blood', msg: 'Consciousness fading... too much blood lost.' });
        } else if (bloodPercent <= BLOOD_THRESHOLDS.critical) {
            if (Math.random() < 0.4) {
                effects.push({ type: 'blood', msg: 'Vision blurs. Blood soaks everything.' });
            }
        } else if (bloodPercent <= BLOOD_THRESHOLDS.woozy) {
            if (Math.random() < 0.2) {
                effects.push({ type: 'blood', msg: 'Feeling lightheaded from blood loss...' });
            }
        }
        
        // ── Brain check (instant death) ──
        const brain = this.parts.head.brain;
        if (!brain.functional) {
            this.alive = false;
            this.causeOfDeath = 'brain destruction';
            effects.push({ type: 'death', msg: 'brain destroyed' });
            return { alive: false, effects };
        }
        
        return { alive: true, effects };
    }
    
    /**
     * Record pain for shock tracking.
     */
    addPain(amount, currentTurn) {
        this.painHistory.push({ amount, turn: currentTurn });
    }
    
    // ── Death Detection ────────────────────────────────────────────────
    
    /**
     * Check if this entity is dead. Used by CombatSystem and Game.
     * Can detect instant-death conditions without waiting for processTurn.
     */
    isDead() {
        if (!this.alive) return true;
        
        // Brain destroyed = instant death
        const brain = this.parts.head.brain;
        if (brain && !brain.functional) {
            this.alive = false;
            this.causeOfDeath = this.causeOfDeath || 'brain destruction';
            return true;
        }
        
        // Complete blood loss
        if (this.blood <= 0) {
            this.alive = false;
            this.causeOfDeath = this.causeOfDeath || 'blood loss';
            return true;
        }
        
        return false;
    }
    
    /**
     * Get a human-readable cause of death string.
     */
    getDeathCause() {
        if (!this.causeOfDeath) return 'unknown causes';
        
        const causes = {
            'blood loss': [
                'bled out from their wounds',
                'exsanguinated',
                'bled to death',
                'lost too much blood'
            ],
            'brain destruction': [
                'suffered fatal brain trauma',
                'died from massive head trauma',
                'brain was destroyed'
            ],
            'suffocation': [
                'suffocated from collapsed lungs',
                'asphyxiated',
                'couldn\'t breathe and died'
            ],
            'cardiac arrest': [
                'died of cardiac arrest',
                'heart gave out',
                'suffered fatal cardiac damage'
            ],
            'shock': [
                'died from traumatic shock',
                'body shut down from shock',
                'went into fatal shock'
            ],
            'starvation': [
                'starved to death',
                'wasted away from hunger'
            ],
            'dehydration': [
                'died of dehydration',
                'perished from thirst'
            ]
        };
        
        const options = causes[this.causeOfDeath];
        if (options) {
            return options[Math.floor(Math.random() * options.length)];
        }
        return this.causeOfDeath;
    }
    
    // ── Status Queries ─────────────────────────────────────────────────
    
    getBloodPercent() {
        return (this.blood / this.maxBlood) * 100;
    }
    
    getBloodStatus() {
        const pct = this.getBloodPercent();
        if (pct > BLOOD_THRESHOLDS.healthy) return { label: 'Healthy', color: '#00ff00' };
        if (pct > BLOOD_THRESHOLDS.lightheaded) return { label: 'Lightheaded', color: '#aaff00' };
        if (pct > BLOOD_THRESHOLDS.woozy) return { label: 'Woozy', color: '#ffaa00' };
        if (pct > BLOOD_THRESHOLDS.critical) return { label: 'Critical', color: '#ff4444' };
        if (pct > BLOOD_THRESHOLDS.unconscious) return { label: 'Fading', color: '#aa0000' };
        return { label: 'Dead', color: '#660000' };
    }
    
    /**
     * Get overall body condition for the side panel (replaces HP bar).
     * Returns { label, color, details }
     */
    getBodyCondition() {
        if (!this.alive) return { label: 'DEAD', color: '#660000', details: this.getDeathCause() };
        
        const bloodStatus = this.getBloodStatus();
        const activeWounds = this.wounds.length;
        const destroyedParts = this.getDestroyedParts();
        
        // Worst condition wins
        if (this.inShock) return { label: 'SHOCK', color: '#ff00ff', details: 'In traumatic shock' };
        if (this.suffocating) return { label: 'SUFFOCATING', color: '#8800ff', details: `${SUFFOCATION_TURNS - this.suffocationTurns} turns of air left` };
        if (bloodStatus.label === 'Critical' || bloodStatus.label === 'Fading') {
            return { label: bloodStatus.label, color: bloodStatus.color, details: `Blood: ${Math.floor(this.blood)}%` };
        }
        
        if (destroyedParts.length > 0) {
            return { label: 'Injured', color: '#ff8800', details: `${destroyedParts.length} part(s) ruined` };
        }
        
        if (activeWounds > 0) {
            const totalBleed = this.wounds.reduce((s, w) => s + w.severity, 0);
            return { label: 'Bleeding', color: '#ff4444', details: `${activeWounds} wound(s), ${totalBleed.toFixed(1)}/turn` };
        }
        
        if (bloodStatus.label !== 'Healthy') {
            return { label: bloodStatus.label, color: bloodStatus.color, details: `Blood: ${Math.floor(this.blood)}%` };
        }
        
        return { label: 'Healthy', color: '#00ff00', details: '' };
    }
    
    /**
     * Get list of destroyed/non-functional body parts.
     */
    getDestroyedParts() {
        const destroyed = [];
        this.forEachPart((part) => {
            if (!part.functional && part.hp <= 0) {
                destroyed.push(part.name);
            }
        });
        return destroyed;
    }
    
    /**
     * Iterate over every body part (flat).
     */
    forEachPart(callback) {
        for (const region of Object.values(this.parts)) {
            for (const value of Object.values(region)) {
                if (Array.isArray(value)) {
                    for (const part of value) {
                        callback(part);
                    }
                } else if (value && value.hp !== undefined) {
                    callback(value);
                }
            }
        }
    }
    
    /**
     * Get total damage across all parts as a rough "how hurt" metric.
     */
    getTotalDamagePercent() {
        let totalHP = 0;
        let totalMaxHP = 0;
        this.forEachPart((part) => {
            totalHP += part.hp;
            totalMaxHP += part.maxHP;
        });
        return totalMaxHP > 0 ? (totalHP / totalMaxHP) * 100 : 0;
    }
    
    // ── Existing Methods (preserved) ───────────────────────────────────
    
    getVisionRange() {
        const leftEye = this.parts.head.eyes[0];
        const rightEye = this.parts.head.eyes[1];
        
        let range = 0;
        if (leftEye.functional) range += 5;
        if (rightEye.functional) range += 5;
        
        // Blood loss vision penalty
        const bloodPct = this.getBloodPercent();
        if (bloodPct <= BLOOD_THRESHOLDS.critical) range -= 4;
        else if (bloodPct <= BLOOD_THRESHOLDS.woozy) range -= 2;
        else if (bloodPct <= BLOOD_THRESHOLDS.lightheaded) range -= 1;
        
        // Apply nightVision trait bonus
        if (this.entity.traitEffects && this.entity.traitEffects.visionBonus) {
            range += this.entity.traitEffects.visionBonus;
        }
        
        // Apply nearSighted trait penalty
        if (this.entity.traitEffects && this.entity.traitEffects.visionPenalty) {
            range -= this.entity.traitEffects.visionPenalty;
        }
        
        return Math.max(1, range);
    }
    
    getHearingRange() {
        const leftEar = this.parts.head.ears[0];
        const rightEar = this.parts.head.ears[1];
        
        let range = 0;
        if (leftEar.functional) range += 3;
        if (rightEar.functional) range += 3;
        
        return range;
    }
    
    canUseHands() {
        return this.parts.leftArm.hand.functional || this.parts.rightArm.hand.functional;
    }
    
    getMovementPenalty() {
        let penalty = 0;
        if (!this.parts.leftLeg.leg.functional) penalty += 0.5;
        if (!this.parts.rightLeg.leg.functional) penalty += 0.5;
        if (!this.parts.leftLeg.foot.functional) penalty += 0.25;
        if (!this.parts.rightLeg.foot.functional) penalty += 0.25;
        
        // Blood loss movement penalty
        const bloodPct = this.getBloodPercent();
        if (bloodPct <= BLOOD_THRESHOLDS.critical) penalty += 0.5;
        else if (bloodPct <= BLOOD_THRESHOLDS.woozy) penalty += 0.25;
        
        // Shock penalty
        if (this.inShock) penalty += 0.5;
        
        return Math.min(1.0, penalty);
    }
    
    /**
     * Get all combat-relevant injury penalties for this entity.
     * Returns an object with modifier values and human-readable breakdown.
     * Used by CombatSystem and combat overlay UI.
     */
    getCombatPenalties() {
        const penalties = {
            hitChanceMod: 0,      // Added to hit chance (negative = penalty)
            critChanceMod: 0,     // Added to crit chance (negative = penalty)
            damageMod: 1.0,       // Multiplied with damage (< 1.0 = penalty)
            dodgeMod: 0,          // Added to target's dodge (negative = easier to hit)
            details: []           // Human-readable penalty descriptions
        };
        
        // ── Arm/hand damage reduces hit chance and damage ──
        const leftArm = this.parts.leftArm.arm;
        const rightArm = this.parts.rightArm.arm;
        const leftHand = this.parts.leftArm.hand;
        const rightHand = this.parts.rightArm.hand;
        
        // Arm condition: average HP% of both arms
        const armCondition = ((leftArm.hp / leftArm.maxHP) + (rightArm.hp / rightArm.maxHP)) / 2;
        // Hand condition: average HP% of both hands
        const handCondition = ((leftHand.hp / leftHand.maxHP) + (rightHand.hp / rightHand.maxHP)) / 2;
        
        // Damaged arms reduce hit chance (up to -15%) and damage (down to 0.5x)
        if (armCondition < 1.0) {
            const armHitPenalty = Math.round((1.0 - armCondition) * -15);
            const armDamageMod = 0.5 + (armCondition * 0.5); // 1.0 at full, 0.5 at destroyed
            penalties.hitChanceMod += armHitPenalty;
            penalties.damageMod *= armDamageMod;
            if (armHitPenalty !== 0) {
                penalties.details.push({ label: 'Arm damage', hitMod: armHitPenalty, damageMod: Math.round((armDamageMod - 1) * 100), color: '#ff8844' });
            }
        }
        
        // Damaged hands reduce hit chance (up to -10%) and damage (down to 0.7x)
        if (handCondition < 1.0) {
            const handHitPenalty = Math.round((1.0 - handCondition) * -10);
            const handDamageMod = 0.7 + (handCondition * 0.3); // 1.0 at full, 0.7 at destroyed
            penalties.hitChanceMod += handHitPenalty;
            penalties.damageMod *= handDamageMod;
            if (handHitPenalty !== 0) {
                penalties.details.push({ label: 'Hand damage', hitMod: handHitPenalty, damageMod: Math.round((handDamageMod - 1) * 100), color: '#ff8844' });
            }
        }
        
        // ── Eye damage reduces crit chance ──
        const leftEye = this.parts.head.eyes[0];
        const rightEye = this.parts.head.eyes[1];
        const eyeCondition = ((leftEye.hp / leftEye.maxHP) + (rightEye.hp / rightEye.maxHP)) / 2;
        if (eyeCondition < 1.0) {
            const eyeCritPenalty = Math.round((1.0 - eyeCondition) * -8);
            penalties.critChanceMod += eyeCritPenalty;
            if (eyeCritPenalty !== 0) {
                penalties.details.push({ label: 'Eye damage', critMod: eyeCritPenalty, color: '#ff6666' });
            }
        }
        
        // ── Blood loss reduces all combat effectiveness ──
        const bloodPct = this.getBloodPercent();
        if (bloodPct <= BLOOD_THRESHOLDS.critical) {
            penalties.hitChanceMod += -20;
            penalties.critChanceMod += -5;
            penalties.damageMod *= 0.6;
            penalties.dodgeMod += 15; // easier to hit when critical
            penalties.details.push({ label: 'Critical blood loss', hitMod: -20, critMod: -5, damageMod: -40, dodgePenalty: 15, color: '#ff4444' });
        } else if (bloodPct <= BLOOD_THRESHOLDS.woozy) {
            penalties.hitChanceMod += -10;
            penalties.critChanceMod += -3;
            penalties.damageMod *= 0.8;
            penalties.dodgeMod += 8;
            penalties.details.push({ label: 'Woozy (blood loss)', hitMod: -10, critMod: -3, damageMod: -20, dodgePenalty: 8, color: '#ffaa00' });
        } else if (bloodPct <= BLOOD_THRESHOLDS.lightheaded) {
            penalties.hitChanceMod += -5;
            penalties.critChanceMod += -1;
            penalties.damageMod *= 0.9;
            penalties.dodgeMod += 3;
            penalties.details.push({ label: 'Lightheaded', hitMod: -5, critMod: -1, damageMod: -10, dodgePenalty: 3, color: '#aaff00' });
        }
        
        // ── Shock severely impairs combat ──
        if (this.inShock) {
            penalties.hitChanceMod += -20;
            penalties.critChanceMod += -5;
            penalties.damageMod *= 0.5;
            penalties.dodgeMod += 20;
            penalties.details.push({ label: 'SHOCK', hitMod: -20, critMod: -5, damageMod: -50, dodgePenalty: 20, color: '#ff00ff' });
        }
        
        // ── Leg damage reduces dodge (easier to hit) ──
        const leftLeg = this.parts.leftLeg.leg;
        const rightLeg = this.parts.rightLeg.leg;
        const leftFoot = this.parts.leftLeg.foot;
        const rightFoot = this.parts.rightLeg.foot;
        const legCondition = ((leftLeg.hp / leftLeg.maxHP) + (rightLeg.hp / rightLeg.maxHP)) / 2;
        const footCondition = ((leftFoot.hp / leftFoot.maxHP) + (rightFoot.hp / rightFoot.maxHP)) / 2;
        
        if (legCondition < 1.0) {
            const legDodgePenalty = Math.round((1.0 - legCondition) * 15);
            penalties.dodgeMod += legDodgePenalty;
            if (legDodgePenalty > 0) {
                penalties.details.push({ label: 'Leg damage', dodgePenalty: legDodgePenalty, color: '#ff8844' });
            }
        }
        if (footCondition < 1.0) {
            const footDodgePenalty = Math.round((1.0 - footCondition) * 8);
            penalties.dodgeMod += footDodgePenalty;
            if (footDodgePenalty > 0) {
                penalties.details.push({ label: 'Foot damage', dodgePenalty: footDodgePenalty, color: '#ff8844' });
            }
        }
        
        // Clamp damage mod
        penalties.damageMod = Math.max(0.2, penalties.damageMod);
        
        return penalties;
    }
    
    // ── Medical Treatment Methods ────────────────────────────────────
    
    /**
     * Apply a bandage to the worst untreated wound.
     * Halves bleed severity and accelerates clotting.
     * Returns { success, wound, msg }
     */
    bandageWound() {
        // Find worst unbandaged surface wound
        const treatable = this.wounds
            .filter(w => !w.bandaged && w.type !== 'internal')
            .sort((a, b) => b.severity - a.severity);
        
        if (treatable.length === 0) {
            return { success: false, msg: 'No wounds to bandage.' };
        }
        
        const wound = treatable[0];
        wound.bandaged = true;
        wound.severity *= 0.5;  // Immediately halve bleeding
        
        return { success: true, wound, msg: `Bandaged ${wound.type} on ${wound.part}. Bleeding reduced.` };
    }
    
    /**
     * Apply antiseptic to an infected or at-risk wound.
     * Clears infection or prevents it.
     * Returns { success, wound, msg }
     */
    applyAntiseptic() {
        // Prioritize infected wounds, then unbandaged untreated wounds
        const infected = this.wounds.filter(w => w.infected).sort((a, b) => b.infectionSeverity - a.infectionSeverity);
        const atRisk = this.wounds.filter(w => !w.disinfected && !w.infected && w.type !== 'internal');
        
        const target = infected[0] || atRisk[0];
        if (!target) {
            return { success: false, msg: 'No wounds need antiseptic.' };
        }
        
        if (target.infected) {
            target.infected = false;
            target.infectionSeverity = 0;
            target.disinfected = true;
            return { success: true, wound: target, msg: `Treated infection in ${target.part}. Infection cleared.` };
        } else {
            target.disinfected = true;
            return { success: true, wound: target, msg: `Disinfected ${target.type} on ${target.part}. Infection prevented.` };
        }
    }
    
    /**
     * Take a painkiller. Suppresses pain for several turns,
     * raises shock threshold, and can pull out of shock.
     * Returns { success, msg }
     */
    takePainkiller() {
        this.painSuppression = 20;       // 20 turns of pain suppression
        this.shockThresholdBonus = 40;   // Effectively raises shock threshold by 40
        this.painHistory = [];           // Clear accumulated pain
        
        // Pull out of shock if currently in it
        if (this.inShock) {
            this.inShock = false;
            return { success: true, msg: 'Painkiller takes effect. Pain fades. Shock subsides.' };
        }
        
        return { success: true, msg: 'Painkiller takes effect. Pain dulled for a while.' };
    }
    
    /**
     * Get summary of treatable conditions for UI.
     * Returns { wounds, infections, painLevel }
     */
    getMedicalSummary() {
        const unbandaged = this.wounds.filter(w => !w.bandaged && w.type !== 'internal').length;
        const infected = this.wounds.filter(w => w.infected).length;
        const unsterilized = this.wounds.filter(w => !w.disinfected && w.type !== 'internal').length;
        const recentPain = this.painHistory.reduce((sum, p) => sum + p.amount, 0);
        
        return {
            totalWounds: this.wounds.length,
            unbandaged,
            infected,
            unsterilized,
            inShock: this.inShock,
            painSuppressed: this.painSuppression > 0,
            painLevel: recentPain,
            bloodPercent: Math.floor(this.getBloodPercent())
        };
    }
    
    installCybernetic(cyberneticData, slot) {
        return true;
    }
    
    damagePart(partPath, damage, damageType = 'blunt') {
        // Navigate the anatomy path (e.g., "head.brain", "torso.lungs.0")
        const pathParts = partPath.split('.');
        let part = this.parts;
        for (const p of pathParts) {
            if (part === undefined || part === null) return null;
            const idx = parseInt(p);
            part = isNaN(idx) ? part[p] : part[idx];
        }
        
        if (!part || part.hp === undefined) return null;
        
        const wasFunctional = part.functional;
        part.hp = Math.max(0, part.hp - damage);
        part.lastDamageType = damageType;
        
        if (part.hp <= 0 && wasFunctional) {
            part.functional = false;
        }
        
        return { part, destroyed: part.hp <= 0 && wasFunctional };
    }
    
    /**
     * Get a context-aware status label for a body part based on HP% and damage type.
     * Returns { status, color }.
     */
    static getPartStatus(part) {
        const pct = (part.hp / part.maxHP) * 100;
        const dtype = part.lastDamageType || 'blunt';
        
        if (!part.functional) return { status: 'DESTROYED', color: '#666666' };
        if (pct >= 100) return { status: 'Healthy', color: '#00ff00' };
        
        // Labels vary by damage type and severity
        if (dtype === 'sharp') {
            if (pct < 25) return { status: 'Mangled', color: '#ff4444' };
            if (pct < 50) return { status: 'Cut Deep', color: '#ffaa00' };
            if (pct < 80) return { status: 'Cut', color: '#aaff00' };
            return { status: 'Nicked', color: '#88cc00' };
        } else if (dtype === 'stab') {
            if (pct < 25) return { status: 'Perforated', color: '#ff4444' };
            if (pct < 50) return { status: 'Punctured', color: '#ffaa00' };
            if (pct < 80) return { status: 'Stabbed', color: '#aaff00' };
            return { status: 'Pierced', color: '#88cc00' };
        } else {
            // blunt / unarmed
            if (pct < 25) return { status: 'Crushed', color: '#ff4444' };
            if (pct < 50) return { status: 'Battered', color: '#ffaa00' };
            if (pct < 80) return { status: 'Bruised', color: '#aaff00' };
            return { status: 'Sore', color: '#88cc00' };
        }
    }
}
