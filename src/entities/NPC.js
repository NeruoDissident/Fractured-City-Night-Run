import { Entity } from './Entity.js';
import { Anatomy } from './Anatomy.js';

// ─── Data-driven NPC type definitions ───────────────────────────────────────
// Add new enemy types by adding entries here. No code changes needed.
const NPC_TYPES = {
    scavenger: {
        name: 'Scavenger',
        glyph: 's',
        color: '#888888',
        // Speed & energy
        speed: 70,              // energy gained per game tick (100 = player walk baseline)
        attackCost: 100,        // energy cost to attack
        moveCost: 100,          // energy cost to move one tile
        // Detection
        visionRange: 6,         // tiles — how far they can see
        hearingRange: 10,       // tiles — max distance to hear sounds
        // Behavior
        hostile: false,         // will they attack on sight?
        aggression: 0.0,        // chance to engage even if hostile (0 = never initiates)
        courage: 1.0,           // blood% threshold to flee (1.0 = never flees)
        leashRange: 15,         // max chase distance from spawn before giving up
        giveUpTurns: 5,         // turns without sight before returning to wander
        wanderChance: 0.3,      // chance to move randomly each turn when idle
        // Weapons
        weaponTable: null,      // no weapons
    },
    raider: {
        name: 'Raider',
        glyph: 'R',
        color: '#ff4444',
        speed: 85,
        attackCost: 100,
        moveCost: 100,
        visionRange: 8,
        hearingRange: 14,
        hostile: true,
        aggression: 0.8,        // 80% chance to engage when spotting player
        courage: 0.35,          // flees below 35% blood
        leashRange: 25,
        giveUpTurns: 15,
        wanderChance: 0.3,
        weaponTable: [
            { weight: 30, weapon: { name: 'Shiv', type: 'weapon', baseDamage: '1d4', weaponStats: { attackType: 'sharp', bleedChance: 0.30 } } },
            { weight: 30, weapon: { name: 'Pipe', type: 'weapon', baseDamage: '1d8', weaponStats: { attackType: 'blunt', stunChance: 0.10 } } },
            { weight: 20, weapon: { name: 'Knife', type: 'weapon', baseDamage: '1d6', weaponStats: { attackType: 'sharp', bleedChance: 0.40 } } },
            { weight: 20, weapon: null },  // unarmed
        ],
    },
};

// Detection states — controls NPC awareness and behavior
const DETECTION_STATE = {
    UNAWARE: 'unaware',       // idle, wandering — hasn't noticed player
    ALERT: 'alert',           // heard something or glimpsed movement, investigating
    SEARCHING: 'searching',   // lost sight of player, checking last known position
    ENGAGED: 'engaged',       // actively fighting / chasing player
    FLEEING: 'fleeing',       // retreating due to low morale
};

export { NPC_TYPES, DETECTION_STATE };

export class NPC extends Entity {
    constructor(game, type, x, y) {
        super(game, x, y);
        
        const profile = NPC_TYPES[type];
        if (!profile) {
            console.error(`[NPC] Unknown type: ${type}`);
        }
        
        this.type = type;
        this.profile = profile || NPC_TYPES.scavenger;
        
        // Display
        this.name = this.profile.name;
        this.glyph = this.profile.glyph;
        this.color = this.profile.color;
        this.hostile = this.profile.hostile;
        
        // Energy / speed system
        this.energy = 0;
        this.speed = this.profile.speed;
        
        // Detection state machine
        this.detectionState = DETECTION_STATE.UNAWARE;
        this.lastKnownPlayerPos = null;
        this.turnsWithoutSight = 0;
        this.investigateTarget = null;
        this.investigateTurns = 0;
        this.alertLevel = 0;            // 0-100, builds up from sounds/glimpses
        this.spawnX = x;                // remember spawn for leash
        this.spawnY = y;
        
        // All NPCs get anatomy
        this.anatomy = new Anatomy(this);
        this.anatomy.init();
        
        // Equipment slots (for armor coverage)
        this.equipment = {};
        
        // Weapon item (null = unarmed)
        this.weapon = this.rollWeapon();
    }
    
    // ─── Weapon rolling from profile's weighted table ───────────────────────
    rollWeapon() {
        const table = this.profile.weaponTable;
        if (!table) return null;
        
        const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
        let roll = Math.random() * totalWeight;
        for (const entry of table) {
            roll -= entry.weight;
            if (roll <= 0) {
                // Deep copy so each NPC gets its own weapon instance
                return entry.weapon ? JSON.parse(JSON.stringify(entry.weapon)) : null;
            }
        }
        return null;
    }
    
    // ─── Energy-based turn system ───────────────────────────────────────────
    // Called by World.processTurn(actionCost).
    // actionCost = player's action cost (100 = baseline walk).
    // NPC gains energy = speed × (actionCost / 100).
    // So if player runs (cost 75), NPC gains 75% of its speed.
    // If player crouches (cost 125), NPC gains 125% of its speed.
    takeTurn(actionCost = 100) {
        // Process anatomy (bleeding, organ effects) each turn
        if (this.anatomy) {
            const currentTurn = this.game.turnCount || 0;
            const result = this.anatomy.processTurn(currentTurn);
            if (!result.alive) {
                this.die();
                return;
            }
        }
        
        // Accumulate energy proportional to player's action cost
        this.energy += this.speed * (actionCost / 100);
        
        // Cap stored energy to prevent idle NPCs from banking huge reserves
        const maxEnergy = this.profile.moveCost * 2;
        if (this.energy > maxEnergy) this.energy = maxEnergy;
        
        // Act while we have enough energy for at least a move
        let actionsThisTick = 0;
        const maxActions = 3; // safety cap to prevent infinite loops
        
        while (this.energy >= this.profile.moveCost && actionsThisTick < maxActions) {
            const cost = this.executeAI();
            if (cost <= 0) break; // AI chose to do nothing
            this.energy -= cost;
            actionsThisTick++;
        }
    }
    
    // ─── Main AI dispatcher — returns energy cost of action taken ───────────
    executeAI() {
        // Check morale first — override everything if fleeing
        if (this.shouldFlee()) {
            this.detectionState = DETECTION_STATE.FLEEING;
        }
        
        // Update detection based on senses
        this.updateDetection();
        
        switch (this.detectionState) {
            case DETECTION_STATE.UNAWARE:
                return this.behaviorWander();
                
            case DETECTION_STATE.ALERT:
                return this.behaviorInvestigate();
                
            case DETECTION_STATE.SEARCHING:
                return this.behaviorSearch();
                
            case DETECTION_STATE.ENGAGED:
                return this.behaviorEngage();
                
            case DETECTION_STATE.FLEEING:
                return this.behaviorFlee();
                
            default:
                return this.behaviorWander();
        }
    }
    
    // ─── Detection / awareness update ───────────────────────────────────────
    updateDetection() {
        const player = this.game.player;
        
        // Can't detect across Z-levels
        if (player.z !== this.z) {
            if (this.detectionState === DETECTION_STATE.ENGAGED || 
                this.detectionState === DETECTION_STATE.SEARCHING) {
                this.detectionState = DETECTION_STATE.SEARCHING;
                this.turnsWithoutSight++;
            }
            return;
        }
        
        const canSee = this.canSeePlayer();
        
        if (canSee) {
            this.lastKnownPlayerPos = { x: player.x, y: player.y };
            this.turnsWithoutSight = 0;
            
            if (this.detectionState === DETECTION_STATE.FLEEING) {
                // Stay fleeing — don't re-engage just because we see them
                return;
            }
            
            if (this.hostile) {
                // Hostile NPCs: check aggression roll on first sight
                if (this.detectionState === DETECTION_STATE.UNAWARE) {
                    if (Math.random() < this.profile.aggression) {
                        this.detectionState = DETECTION_STATE.ENGAGED;
                        this.game.ui.log(`${this.name} spots you!`, 'combat');
                    } else {
                        this.detectionState = DETECTION_STATE.ALERT;
                    }
                } else {
                    // Already alert/searching — escalate to engaged
                    this.detectionState = DETECTION_STATE.ENGAGED;
                }
            } else {
                // Non-hostile: just become alert, never engage
                if (this.detectionState === DETECTION_STATE.UNAWARE) {
                    this.detectionState = DETECTION_STATE.ALERT;
                }
            }
        } else {
            // Can't see player
            if (this.detectionState === DETECTION_STATE.ENGAGED) {
                this.detectionState = DETECTION_STATE.SEARCHING;
                this.turnsWithoutSight = 1;
            } else if (this.detectionState === DETECTION_STATE.SEARCHING) {
                this.turnsWithoutSight++;
                if (this.turnsWithoutSight >= this.profile.giveUpTurns) {
                    this.detectionState = DETECTION_STATE.UNAWARE;
                    this.lastKnownPlayerPos = null;
                    this.investigateTarget = null;
                    this.alertLevel = 0;
                }
            } else if (this.detectionState === DETECTION_STATE.ALERT) {
                // Alert from sound — stays alert until investigate completes or times out
                if (!this.investigateTarget && !this.lastKnownPlayerPos) {
                    this.detectionState = DETECTION_STATE.UNAWARE;
                    this.alertLevel = 0;
                }
            }
        }
        
        // Leash check — if too far from spawn, give up chase
        if (this.detectionState === DETECTION_STATE.ENGAGED || 
            this.detectionState === DETECTION_STATE.SEARCHING) {
            const distFromSpawn = Math.abs(this.x - this.spawnX) + Math.abs(this.y - this.spawnY);
            if (distFromSpawn > this.profile.leashRange) {
                this.detectionState = DETECTION_STATE.UNAWARE;
                this.lastKnownPlayerPos = null;
                this.investigateTarget = null;
                this.alertLevel = 0;
            }
        }
    }
    
    // ─── NPC vision — independent of player FoV ────────────────────────────
    canSeePlayer() {
        const player = this.game.player;
        if (player.z !== this.z) return false;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Base vision range from profile
        let effectiveRange = this.profile.visionRange;
        
        // Lighting affects NPC vision too
        if (this.game.lightingSystem) {
            const ambient = this.game.lightingSystem.getLightLevel(player.x, player.y, player.z);
            // In darkness, vision range drops significantly
            // ambient is 0.0 (pitch black) to 1.0 (full light)
            effectiveRange = Math.max(2, Math.floor(effectiveRange * Math.max(0.25, ambient)));
        }
        
        // Player movement mode affects detection range
        const playerMode = player.movementModes[player.movementMode];
        if (playerMode) {
            // Crouching/prone = harder to spot (reduce effective range)
            // Running = easier to spot (increase effective range)
            if (player.movementMode === 'crouch') effectiveRange = Math.floor(effectiveRange * 0.6);
            else if (player.movementMode === 'prone') effectiveRange = Math.floor(effectiveRange * 0.35);
            else if (player.movementMode === 'run') effectiveRange = Math.floor(effectiveRange * 1.25);
        }
        
        if (dist > effectiveRange) return false;
        
        // Line of sight check using FoV system's raycasting
        if (this.game.fov) {
            return this.game.fov.hasLineOfSight(this.x, this.y, player.x, player.y);
        }
        
        return true; // fallback if no FoV system
    }
    
    // ─── Morale check ──────────────────────────────────────────────────────
    shouldFlee() {
        if (this.profile.courage >= 1.0) return false; // never flees
        if (this.detectionState === DETECTION_STATE.UNAWARE) return false;
        
        const bloodPercent = this.anatomy.getBloodPercent() / 100;
        if (bloodPercent < this.profile.courage) return true;
        
        // Also flee if critical body parts are destroyed
        const destroyed = this.anatomy.getDestroyedParts();
        if (destroyed.length >= 3) return true;
        
        return false;
    }
    
    // ─── Behavior: Wander (UNAWARE state) ──────────────────────────────────
    behaviorWander() {
        if (Math.random() >= this.profile.wanderChance) return 0; // idle, no cost
        
        const dx = Math.floor(Math.random() * 3) - 1;
        const dy = Math.floor(Math.random() * 3) - 1;
        if (dx === 0 && dy === 0) return 0;
        
        const newX = this.x + dx;
        const newY = this.y + dy;
        
        if (!this.game.world.isBlocked(newX, newY, this.z)) {
            this.x = newX;
            this.y = newY;
            return this.profile.moveCost;
        }
        return 0;
    }
    
    // ─── Behavior: Investigate (ALERT state) ────────────────────────────────
    behaviorInvestigate() {
        const target = this.investigateTarget || this.lastKnownPlayerPos;
        if (!target) {
            this.detectionState = DETECTION_STATE.UNAWARE;
            return 0;
        }
        
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        
        // Reached investigation point
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            this.investigateTarget = null;
            this.investigateTurns = 0;
            // Look around for a bit, then go back to unaware
            if (this.lastKnownPlayerPos) {
                this.detectionState = DETECTION_STATE.SEARCHING;
                this.turnsWithoutSight = Math.floor(this.profile.giveUpTurns * 0.5);
            } else {
                this.detectionState = DETECTION_STATE.UNAWARE;
            }
            return 0;
        }
        
        return this.moveToward(target.x, target.y);
    }
    
    // ─── Behavior: Search (SEARCHING state) ─────────────────────────────────
    behaviorSearch() {
        if (!this.lastKnownPlayerPos) {
            this.detectionState = DETECTION_STATE.UNAWARE;
            return 0;
        }
        
        const dx = this.lastKnownPlayerPos.x - this.x;
        const dy = this.lastKnownPlayerPos.y - this.y;
        
        // Reached last known position — wander nearby
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) {
            return this.behaviorWander();
        }
        
        return this.moveToward(this.lastKnownPlayerPos.x, this.lastKnownPlayerPos.y);
    }
    
    // ─── Behavior: Engage (ENGAGED state) ───────────────────────────────────
    behaviorEngage() {
        const player = this.game.player;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        
        // Adjacent — attack
        if (dist === 1) {
            this.attack(player);
            return this.profile.attackCost;
        }
        
        // Chase toward player
        return this.moveToward(player.x, player.y);
    }
    
    // ─── Behavior: Flee (FLEEING state) ─────────────────────────────────────
    behaviorFlee() {
        const player = this.game.player;
        
        const dx = this.x - player.x; // away from player
        const dy = this.y - player.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        
        // If far enough away, calm down and go back to unaware
        if (dist > this.profile.leashRange * 0.75) {
            this.detectionState = DETECTION_STATE.UNAWARE;
            this.lastKnownPlayerPos = null;
            this.alertLevel = 0;
            return 0;
        }
        
        // Move away from player
        let moveX = 0;
        let moveY = 0;
        
        if (Math.abs(dx) >= Math.abs(dy)) {
            moveX = dx > 0 ? 1 : -1;
        } else {
            moveY = dy > 0 ? 1 : -1;
        }
        
        const newX = this.x + moveX;
        const newY = this.y + moveY;
        
        if (!this.game.world.isBlocked(newX, newY, this.z)) {
            this.x = newX;
            this.y = newY;
            return this.profile.moveCost;
        }
        
        // Try perpendicular directions if blocked
        const altMoves = [
            { x: moveY, y: -moveX },
            { x: -moveY, y: moveX },
        ];
        for (const alt of altMoves) {
            const ax = this.x + alt.x;
            const ay = this.y + alt.y;
            if (alt.x === 0 && alt.y === 0) continue;
            if (!this.game.world.isBlocked(ax, ay, this.z)) {
                this.x = ax;
                this.y = ay;
                return this.profile.moveCost;
            }
        }
        
        return 0; // cornered
    }
    
    // ─── Movement helper — move toward a target with pathfinding fallback ───
    moveToward(targetX, targetY) {
        const player = this.game.player;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        
        let moveX = 0;
        let moveY = 0;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            moveX = dx > 0 ? 1 : -1;
        } else if (dy !== 0) {
            moveY = dy > 0 ? 1 : -1;
        } else if (dx !== 0) {
            moveX = dx > 0 ? 1 : -1;
        }
        
        const newX = this.x + moveX;
        const newY = this.y + moveY;
        
        // Check if player is at target tile — attack instead of move
        if (newX === player.x && newY === player.y && player.z === this.z) {
            if (this.hostile && this.detectionState === DETECTION_STATE.ENGAGED) {
                this.attack(player);
                return this.profile.attackCost;
            }
            return 0; // non-hostile, don't walk into player
        }
        
        if (!this.game.world.isBlocked(newX, newY, this.z)) {
            this.x = newX;
            this.y = newY;
            return this.profile.moveCost;
        }
        
        // Try alternate direction
        let altX = 0, altY = 0;
        if (moveX !== 0) {
            altY = dy > 0 ? 1 : (dy < 0 ? -1 : (Math.random() < 0.5 ? 1 : -1));
        } else {
            altX = dx > 0 ? 1 : (dx < 0 ? -1 : (Math.random() < 0.5 ? 1 : -1));
        }
        
        const altNewX = this.x + altX;
        const altNewY = this.y + altY;
        
        if (altNewX === player.x && altNewY === player.y && player.z === this.z) {
            if (this.hostile && this.detectionState === DETECTION_STATE.ENGAGED) {
                this.attack(player);
                return this.profile.attackCost;
            }
            return 0;
        }
        
        if (!this.game.world.isBlocked(altNewX, altNewY, this.z)) {
            this.x = altNewX;
            this.y = altNewY;
            return this.profile.moveCost;
        }
        
        return 0; // stuck
    }
    
    // ─── Combat ─────────────────────────────────────────────────────────────
    attack(target) {
        const result = this.game.combatSystem.resolveAttack(this, target, this.weapon);
        
        if (result.killed && target === this.game.player) {
            // Player death handled by Game.checkGameOver()
        }
    }
    
    takeDamage(amount) {
        // Legacy fallback — route through anatomy
        if (this.anatomy) {
            this.anatomy.damagePart('torso.stomach', amount);
        }
    }
    
    isDead() {
        if (this.anatomy) {
            return this.anatomy.isDead();
        }
        return false;
    }
    
    // ─── Sound response ─────────────────────────────────────────────────────
    hearSound(sound) {
        // Check if sound is within this NPC's hearing range
        const dist = Math.sqrt(
            Math.pow(this.x - sound.x, 2) + Math.pow(this.y - sound.y, 2)
        );
        if (dist > this.profile.hearingRange) return;
        
        // Already engaged or fleeing — sound doesn't change behavior
        if (this.detectionState === DETECTION_STATE.ENGAGED) return;
        if (this.detectionState === DETECTION_STATE.FLEEING) return;
        
        // Build alert level based on sound volume and distance
        const volumeFactor = sound.volume / Math.max(1, dist);
        this.alertLevel = Math.min(100, this.alertLevel + volumeFactor * 30);
        
        // Loud enough to investigate
        if (this.alertLevel >= 40 || sound.volume >= 6) {
            this.investigateTarget = { x: sound.x, y: sound.y };
            this.investigateTurns = 10;
            
            if (this.detectionState === DETECTION_STATE.UNAWARE) {
                this.detectionState = DETECTION_STATE.ALERT;
            }
        }
    }
    
    // ─── Death ──────────────────────────────────────────────────────────────
    die() {
        if (this.anatomy && this.anatomy.causeOfDeath) {
            const cause = this.anatomy.getDeathCause();
            this.game.ui.log(`${this.name} ${cause}.`, 'combat');
        }
        this.game.world.removeEntity(this);
    }
    
    // ─── Utility: get detection state for UI display ────────────────────────
    getDetectionLabel() {
        switch (this.detectionState) {
            case DETECTION_STATE.UNAWARE: return 'Unaware';
            case DETECTION_STATE.ALERT: return 'Alert';
            case DETECTION_STATE.SEARCHING: return 'Searching';
            case DETECTION_STATE.ENGAGED: return 'Hostile';
            case DETECTION_STATE.FLEEING: return 'Fleeing';
            default: return 'Unknown';
        }
    }
    
    getDetectionColor() {
        switch (this.detectionState) {
            case DETECTION_STATE.UNAWARE: return '#888888';
            case DETECTION_STATE.ALERT: return '#ffff00';
            case DETECTION_STATE.SEARCHING: return '#ff8800';
            case DETECTION_STATE.ENGAGED: return '#ff4444';
            case DETECTION_STATE.FLEEING: return '#44ff44';
            default: return '#ffffff';
        }
    }
}
