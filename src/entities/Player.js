import { Entity } from './Entity.js';
import { Anatomy } from './Anatomy.js';
import { EquipmentSystem } from '../systems/EquipmentSystem.js';
import { ContainerSystem } from '../systems/ContainerSystem.js';

export class Player extends Entity {
    constructor(game, characterData) {
        super(game, 0, 0);
        
        this.z = 0; // Z-level (0 = ground, positive = up, negative = down)
        
        this.name = characterData.name || 'Survivor';
        this.gender = characterData.gender || 'other';
        this.glyph = '@';
        this.color = '#00ffff';
        
        this.anatomy = new Anatomy(this);
        this.anatomy.init();
        
        this.stats = {
            strength: characterData.strength || 10,
            agility: characterData.agility || 10,
            endurance: characterData.endurance || 10,
            intelligence: characterData.intelligence || 10,
            perception: characterData.perception || 10
        };
        
        if (characterData.background && game.charCreationSystem) {
            game.charCreationSystem.applyBackgroundToCharacter(this, characterData.background);
        }
        
        if (characterData.traits && game.charCreationSystem) {
            game.charCreationSystem.applyTraitsToCharacter(this, characterData.traits);
        }
        
        // Legacy HP kept for compatibility but no longer used for death
        this.hp = 999;
        this.maxHP = 999;
        
        this.inventory = [];
        this.isContainer = true;
        this.maxWeight = this.getMaxCarryWeight();
        this.maxVolume = 50000;
        
        this.carrying = {
            leftHand: null,
            rightHand: null
        };
        this.contents = this.inventory;
        
        // Facing direction for directional light (flashlight cone)
        // Updated on every move: 'north', 'south', 'east', 'west', 'ne', 'nw', 'se', 'sw'
        this.facing = 'south';
        
        this.movementMode = 'walk';
        this.movementModes = {
            walk: { name: 'Walking', actionCost: 100, soundVolume: 3, color: '#00ffff' },
            run: { name: 'Running', actionCost: 75, soundVolume: 8, color: '#ffff00' },
            crouch: { name: 'Crouching', actionCost: 125, soundVolume: 1, color: '#ff8800' },
            prone: { name: 'Prone', actionCost: 150, soundVolume: 0, color: '#ff0000' }
        };
        
        // Combat stance system
        this.combatStance = 'aggressive';
        this.combatStances = {
            aggressive: {
                name: 'Aggressive',
                color: '#ff4444',
                damageMod: 1.25,       // +25% damage dealt
                hitMod: 5,             // +5% hit chance
                critMod: 3,            // +3% crit chance
                incomingDamageMod: 1.2, // +20% damage taken
                bleedMod: 1.3,         // +30% bleed chance
                interceptMod: 0.5,     // 50% arm intercept (reckless, less guarding)
                offBalanceOnMiss: true  // miss → attacker becomes off-balance
            },
            defensive: {
                name: 'Defensive',
                color: '#4488ff',
                damageMod: 0.7,        // -30% damage dealt
                hitMod: -5,            // -5% hit chance (cautious swings)
                critMod: -2,           // -2% crit chance
                incomingDamageMod: 0.7, // -30% damage taken
                bleedMod: 0.6,         // -40% bleed chance
                interceptMod: 1.5,     // 150% arm intercept (actively guarding)
                canDisengage: true     // can move away without opportunity attack
            },
            opportunistic: {
                name: 'Opportunistic',
                color: '#44ff44',
                damageMod: 1.0,        // normal damage
                hitMod: 0,             // normal hit chance
                critMod: 0,            // normal crit
                incomingDamageMod: 1.0, // normal incoming
                bleedMod: 1.0,         // normal bleed
                interceptMod: 1.0,     // normal intercept
                exploitWounded: true   // bonus crit on already-wounded parts
            }
        };
        
        this.equipment = {
            head: null,
            torso: null,
            legs: null,
            back: null,
            leftHand: null,
            rightHand: null
        };
        
        this.cybernetics = [];
        this.statusEffects = [];
        
        this.hunger = 100;
        this.maxHunger = 100;
        this.hungerRate = 0.1;
        this.thirst = 100;
        this.maxThirst = 100;
        this.thirstRate = 0.2;
        
        // Energy system — tracks cost of last action for world tick scaling
        this.lastActionCost = 100;
        
        // Debug mode
        this.exploreMode = false; // Toggle with F key - disables hunger/thirst
        
        this.equipmentSystem = new EquipmentSystem(this);
        this.containerSystem = new ContainerSystem();
    }
    
    getMaxHP() {
        // Legacy — no longer drives death. Kept for any UI that still references it.
        return 999;
    }
    
    getMaxCarryWeight() {
        let baseWeight = 10000 + (this.stats.strength * 1000);
        
        if (this.traitEffects && this.traitEffects.carryMod) {
            baseWeight *= this.traitEffects.carryMod;
        }
        
        return Math.floor(baseWeight);
    }
    
    getCurrentCarryWeight() {
        return this.containerSystem.getTotalWeight(this);
    }
    
    getEncumbranceLevel() {
        const current = this.getCurrentCarryWeight();
        const max = this.maxWeight;
        const ratio = current / max;
        
        if (ratio < 0.5) return 'light';
        if (ratio < 0.75) return 'medium';
        if (ratio < 1.0) return 'heavy';
        return 'overencumbered';
    }
    
    getEncumbrancePenalty() {
        const level = this.getEncumbranceLevel();
        
        const penalties = {
            light: 0,
            medium: 10,
            heavy: 25,
            overencumbered: 50
        };
        
        return penalties[level] || 0;
    }
    
    canPickupItem(item) {
        const storageOptions = this.containerSystem.findAvailableStorage(this, item);
        
        if (storageOptions.length === 0) {
            return { 
                canFit: false, 
                reason: 'No storage space available in pockets or containers' 
            };
        }
        
        return { canFit: true, storageOptions: storageOptions };
    }
    
    addToInventory(item) {
        const result = this.containerSystem.autoStoreItem(this, item);
        
        if (!result.success) {
            return { success: false, message: result.message };
        }
        
        // Add to inventory array for tracking
        this.inventory.push(item);
        return { success: true, message: result.message, location: result.location };
    }
    
    canCarryInHands(item) {
        const weight = this.containerSystem.getItemWeight(item);
        const isTwoHanded = item.twoHanded || weight > 5000; // Heavy items need two hands
        
        // Check both carrying AND equipment slots for hand availability
        const leftFree = !this.carrying.leftHand && !this.equipment.leftHand;
        const rightFree = !this.carrying.rightHand && !this.equipment.rightHand;
        
        if (isTwoHanded) {
            return {
                canCarry: leftFree && rightFree,
                hands: 'both',
                reason: !(leftFree && rightFree) ? 'Need both hands free' : null
            };
        } else {
            return {
                canCarry: leftFree || rightFree,
                hands: 'one',
                reason: !leftFree && !rightFree ? 'Both hands full' : null
            };
        }
    }
    
    carryInHands(item) {
        const check = this.canCarryInHands(item);
        
        if (!check.canCarry) {
            return { success: false, message: check.reason };
        }
        
        // Check both carrying AND equipment slots for hand availability
        const leftFree = !this.carrying.leftHand && !this.equipment.leftHand;
        const rightFree = !this.carrying.rightHand && !this.equipment.rightHand;
        
        if (check.hands === 'both') {
            this.carrying.leftHand = item;
            this.carrying.rightHand = item; // Same item reference in both hands
            item.carriedIn = 'both';
            return { success: true, message: `Carrying ${item.name} in both hands`, hands: 'both' };
        } else {
            if (leftFree) {
                this.carrying.leftHand = item;
                item.carriedIn = 'left';
                return { success: true, message: `Carrying ${item.name} in left hand`, hands: 'left' };
            } else {
                this.carrying.rightHand = item;
                item.carriedIn = 'right';
                return { success: true, message: `Carrying ${item.name} in right hand`, hands: 'right' };
            }
        }
    }
    
    dropCarriedItem(hand) {
        let item = null;
        
        if (hand === 'left' || hand === 'both') {
            item = this.carrying.leftHand;
            this.carrying.leftHand = null;
        }
        
        if (hand === 'right' || hand === 'both') {
            if (!item) item = this.carrying.rightHand;
            this.carrying.rightHand = null;
        }
        
        if (item) {
            delete item.carriedIn;
            item.x = this.x;
            item.y = this.y;
            item.z = this.z;
            this.game.world.addItem(item);
            return { success: true, item: item };
        }
        
        return { success: false };
    }
    
    isHandFree(hand) {
        if (hand === 'left') return !this.carrying.leftHand && !this.equipment.leftHand;
        if (hand === 'right') return !this.carrying.rightHand && !this.equipment.rightHand;
        return false;
    }
    
    removeFromInventory(item) {
        // Remove from storage location
        if (item.storedIn) {
            const container = item.storedIn.container;
            this.containerSystem.removeItem(container, item);
        }
        
        // Remove from inventory array
        const index = this.inventory.indexOf(item);
        if (index > -1) {
            this.inventory.splice(index, 1);
            return { success: true };
        }
        return { success: false };
    }
    
    cycleMovementMode() {
        const modes = Object.keys(this.movementModes);
        const currentIndex = modes.indexOf(this.movementMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        this.movementMode = modes[nextIndex];
        const mode = this.movementModes[this.movementMode];
        this.game.ui.log(`Movement: ${mode.name} (${(mode.actionCost / 100).toFixed(2)} turns/tile)`, 'info');
        return true;
    }
    
    // ─── Action cost helpers ────────────────────────────────────────────────
    getMovementActionCost() {
        const mode = this.movementModes[this.movementMode];
        let cost = mode.actionCost;
        
        // Equipment weight modifier
        cost *= this.equipmentSystem.getActionCostModifier();
        
        // Anatomy penalties (destroyed legs/feet)
        const movePenalty = this.anatomy.getMovementPenalty();
        cost *= (1 + movePenalty);
        
        return Math.round(cost);
    }
    
    getAttackActionCost() {
        let cost = this.equipmentSystem.getWeaponActionCost();
        
        // Equipment weight modifier
        cost *= this.equipmentSystem.getActionCostModifier();
        
        return Math.round(cost);
    }
    
    tryMove(dx, dy) {
        // Update facing direction regardless of whether move succeeds
        this.facing = this.getFacingFromDelta(dx, dy);
        
        const newX = this.x + dx;
        const newY = this.y + dy;
        
        if (this.game.world.isBlocked(newX, newY, this.z)) {
            const entity = this.game.world.getEntityAt(newX, newY, this.z);
            if (entity && entity !== this) {
                this.attack(entity);
                // Store attack action cost for energy system
                this.lastActionCost = this.getAttackActionCost();
                return true;
            }
            return false;
        }
        
        // Opportunity attacks: adjacent enemies get a free hit when you disengage
        const stance = this.getStance();
        if (!stance.canDisengage) {
            const adjacentEnemies = this.getAdjacentEnemies();
            for (const enemy of adjacentEnemies) {
                if (enemy.attack && !enemy.isDead()) {
                    // Only engaged enemies get opportunity attacks
                    if (enemy.detectionState && enemy.detectionState !== 'engaged') continue;
                    this.game.ui.log(`${enemy.name} strikes as you pull away!`, 'combat');
                    enemy.attack(this);
                    if (this.game.combatEffects) {
                        this.game.combatEffects.addFloatingText(this.x, this.y, 'OPP. ATTACK', '#ff8800', 1000);
                    }
                }
            }
        }
        
        this.x = newX;
        this.y = newY;
        
        const mode = this.movementModes[this.movementMode];
        if (mode.soundVolume > 0) {
            this.game.soundSystem.makeSound(this.x, this.y, mode.soundVolume, 'movement', this);
        }
        
        // Store movement action cost for energy system
        this.lastActionCost = this.getMovementActionCost();
        
        this.checkExtraction();
        
        return true;
    }
    
    getAdjacentEnemies() {
        const enemies = [];
        for (const entity of this.game.world.entities) {
            if (entity === this) continue;
            if (entity.z !== this.z) continue;
            const chebyshev = Math.max(Math.abs(entity.x - this.x), Math.abs(entity.y - this.y));
            if (chebyshev <= 1 && entity.attack) {
                enemies.push(entity);
            }
        }
        return enemies;
    }
    
    getFacingFromDelta(dx, dy) {
        if (dx === 0 && dy === -1) return 'north';
        if (dx === 0 && dy === 1) return 'south';
        if (dx === 1 && dy === 0) return 'east';
        if (dx === -1 && dy === 0) return 'west';
        if (dx === 1 && dy === -1) return 'ne';
        if (dx === -1 && dy === -1) return 'nw';
        if (dx === 1 && dy === 1) return 'se';
        if (dx === -1 && dy === 1) return 'sw';
        return this.facing; // Keep current if no movement
    }
    
    checkExtraction() {
        const extraction = this.game.world.extractionPoint;
        if (extraction && extraction.x === this.x && extraction.y === this.y) {
            if (extraction.canUse(this)) {
                this.game.completeRun();
            } else {
                this.game.ui.log(`${extraction.name}: ${extraction.getRequirementText()}`, 'warning');
            }
        }
    }
    
    tryAscend() {
        const tile = this.game.world.getTile(this.x, this.y, this.z);
        
        if (!tile.isStaircase && !tile.isManhole && !tile.isLadder) {
            this.game.ui.log('There are no stairs here.', 'warning');
            return false;
        }
        
        if (!tile.canAscend) {
            this.game.ui.log('You cannot go up from here.', 'warning');
            return false;
        }
        
        this.z++;
        this.game.ui.log(`You climb up to level ${this.z}.`, 'info');
        return true;
    }
    
    tryDescend() {
        const tile = this.game.world.getTile(this.x, this.y, this.z);
        
        if (!tile.isStaircase && !tile.isManhole && !tile.isLadder) {
            this.game.ui.log('There are no stairs here.', 'warning');
            return false;
        }
        
        if (!tile.canDescend) {
            this.game.ui.log('You cannot go down from here.', 'warning');
            return false;
        }
        
        this.z--;
        this.game.ui.log(`You climb down to level ${this.z}.`, 'info');
        return true;
    }
    
    tryPickup() {
        const items = this.game.world.getItemsAt(this.x, this.y, this.z);
        if (items.length === 0) {
            this.game.ui.log('Nothing to pick up here.', 'info');
            return false;
        }
        
        const item = items[0];
        const canFit = this.canPickupItem(item);
        
        if (!canFit.canFit) {
            this.game.ui.log(`Cannot pick up ${item.name}: ${canFit.reason}`, 'warning');
            return false;
        }
        
        const result = this.addToInventory(item);
        if (result.success) {
            this.game.world.removeItem(item);
            const weight = this.containerSystem.formatWeight(item.weight || this.containerSystem.estimateWeight(item));
            this.game.ui.log(`Picked up ${item.name} (${weight}) → ${result.location}`, 'info');
            
            const encumbrance = this.getEncumbranceLevel();
            if (encumbrance === 'heavy') {
                this.game.ui.log('You are heavily encumbered!', 'warning');
            } else if (encumbrance === 'overencumbered') {
                this.game.ui.log('You are overencumbered! Movement is severely impaired!', 'warning');
            }
            
            return true;
        }
        
        return false;
    }
    
    grabAll() {
        const items = this.game.world.getItemsAt(this.x, this.y, this.z);
        if (items.length === 0) {
            this.game.ui.log('Nothing to pick up here.', 'info');
            return false;
        }
        
        let picked = 0;
        let failed = 0;
        // Iterate backwards since removeItem mutates the array
        const toGrab = [...items];
        for (const item of toGrab) {
            const canFit = this.canPickupItem(item);
            if (!canFit.canFit) {
                failed++;
                continue;
            }
            const result = this.addToInventory(item);
            if (result.success) {
                this.game.world.removeItem(item);
                picked++;
            } else {
                failed++;
            }
        }
        
        if (picked > 0) {
            this.game.ui.log(`Grabbed ${picked} item(s).`, 'info');
            const encumbrance = this.getEncumbranceLevel();
            if (encumbrance === 'heavy') {
                this.game.ui.log('You are heavily encumbered!', 'warning');
            } else if (encumbrance === 'overencumbered') {
                this.game.ui.log('You are overencumbered! Movement is severely impaired!', 'warning');
            }
        }
        if (failed > 0) {
            this.game.ui.log(`${failed} item(s) left — no storage space.`, 'warning');
        }
        
        return picked > 0;
    }
    
    dropItem(item) {
        const result = this.removeFromInventory(item);
        if (result.success) {
            item.x = this.x;
            item.y = this.y;
            item.z = this.z;
            this.game.world.addItem(item);
            this.game.ui.log(`Dropped ${item.name}.`, 'info');
            return true;
        }
        return false;
    }
    
    cycleCombatStance() {
        const stanceOrder = ['aggressive', 'defensive', 'opportunistic'];
        const currentIndex = stanceOrder.indexOf(this.combatStance);
        this.combatStance = stanceOrder[(currentIndex + 1) % stanceOrder.length];
        const stance = this.combatStances[this.combatStance];
        return stance;
    }
    
    getStance() {
        return this.combatStances[this.combatStance] || this.combatStances.aggressive;
    }
    
    attack(target) {
        const weapon = this.equipmentSystem.getActiveWeapon();
        const result = this.game.combatSystem.resolveAttack(this, target, weapon);
        
        if (result.killed && target.die) {
            target.die();
        }
    }
    
    takeDamage(amount) {
        // Legacy fallback — route through anatomy if available
        if (this.anatomy) {
            // Distribute damage to a random torso part
            const torsoPath = 'torso.stomach';
            this.anatomy.damagePart(torsoPath, amount);
        }
    }
    
    isDead() {
        if (this.anatomy) {
            return this.anatomy.isDead();
        }
        return false;
    }
    
    addStatusEffect(effect) {
        this.statusEffects.push({
            type: effect.type,
            value: effect.value,
            duration: effect.duration,
            name: effect.name
        });
    }
    
    processStatusEffects() {
        // Process hunger and thirst (skip in explore mode)
        if (!this.exploreMode) {
            this.hunger = Math.max(0, this.hunger - this.hungerRate);
            this.thirst = Math.max(0, this.thirst - this.thirstRate);
        }
        
        // Starvation → damages stomach, then organs
        if (this.hunger <= 0) {
            const stomach = this.anatomy.parts.torso.stomach;
            if (stomach.functional) {
                stomach.hp = Math.max(0, stomach.hp - 1);
                if (stomach.hp <= 0) stomach.functional = false;
                this.game.ui.log('Your stomach cramps violently from starvation.', 'warning');
            } else {
                // Stomach already destroyed — damage liver
                this.anatomy.damagePart('torso.liver', 1);
                if (Math.random() < 0.3) {
                    this.game.ui.log('Starvation is destroying your organs...', 'warning');
                }
            }
            if (!this.anatomy.causeOfDeath) {
                this.anatomy.causeOfDeath = 'starvation';
            }
        } else {
            // Clear starvation cause if hunger recovered
            if (this.anatomy.causeOfDeath === 'starvation') {
                this.anatomy.causeOfDeath = null;
            }
            if (this.hunger < 20 && Math.random() < 0.1) {
                this.game.ui.log('Your stomach growls with hunger...', 'warning');
            }
        }
        
        // Dehydration → damages kidneys, then brain
        if (this.thirst <= 0) {
            const kidneys = this.anatomy.parts.torso.kidneys;
            const activeKidney = kidneys.find(k => k.functional);
            if (activeKidney) {
                activeKidney.hp = Math.max(0, activeKidney.hp - 1);
                if (activeKidney.hp <= 0) activeKidney.functional = false;
                this.game.ui.log('Dehydration is shutting down your kidneys.', 'warning');
            } else {
                // Both kidneys gone — damage brain directly
                this.anatomy.damagePart('head.brain', 1);
                if (Math.random() < 0.3) {
                    this.game.ui.log('Severe dehydration is causing brain damage...', 'warning');
                }
            }
            if (!this.anatomy.causeOfDeath) {
                this.anatomy.causeOfDeath = 'dehydration';
            }
        } else {
            // Clear dehydration cause if thirst recovered
            if (this.anatomy.causeOfDeath === 'dehydration') {
                this.anatomy.causeOfDeath = null;
            }
            if (this.thirst < 20 && Math.random() < 0.1) {
                this.game.ui.log('Your throat is parched...', 'warning');
            }
        }
        
        // Process anatomy turn (bleeding, organ effects, suffocation, shock)
        const currentTurn = this.game.turnCount || 0;
        const anatomyResult = this.anatomy.processTurn(currentTurn);
        for (const effect of anatomyResult.effects) {
            const logType = effect.type === 'death' ? 'combat' : 'warning';
            this.game.ui.log(effect.msg, logType);
        }
        
        // Process other status effects
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            const effect = this.statusEffects[i];
            
            if (effect.type === 'heal') {
                // Healing primarily patches wounds (reduces bleed severity)
                if (this.anatomy.wounds.length > 0) {
                    for (const wound of this.anatomy.wounds) {
                        wound.severity = Math.max(0, wound.severity - effect.value * 0.15);
                    }
                    // Remove fully patched wounds
                    this.anatomy.wounds = this.anatomy.wounds.filter(w => w.severity > 0.01);
                    this.game.ui.log(`${effect.name} helps close your wounds.`, 'info');
                } else {
                    // No wounds — healing restores blood slowly
                    const bloodGain = effect.value * 0.3;
                    this.anatomy.blood = Math.min(this.anatomy.maxBlood, this.anatomy.blood + bloodGain);
                    this.anatomy.regenCooldown = 0; // healing bypasses regen cooldown
                    this.game.ui.log(`+${bloodGain.toFixed(1)} blood restored by ${effect.name}`, 'info');
                }
            } else if (effect.type === 'sickness') {
                // Sickness damages stomach
                this.anatomy.damagePart('torso.stomach', Math.abs(effect.value));
                this.game.ui.log(`Sickness from ${effect.name} wracks your body.`, 'warning');
            }
            
            effect.duration--;
            if (effect.duration <= 0) {
                this.statusEffects.splice(i, 1);
                this.game.ui.log(`${effect.name} effect ended.`, 'info');
            }
        }
    }
}
