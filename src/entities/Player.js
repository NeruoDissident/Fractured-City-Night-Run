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
        
        this.hp = this.getMaxHP();
        this.maxHP = this.hp;
        
        this.inventory = [];
        this.isContainer = true;
        this.maxWeight = this.getMaxCarryWeight();
        this.maxVolume = 50000;
        
        this.carrying = {
            leftHand: null,
            rightHand: null
        };
        this.contents = this.inventory;
        
        this.movementMode = 'walk';
        this.movementModes = {
            walk: { name: 'Walking', actionCost: 100, soundVolume: 3, color: '#00ffff' },
            run: { name: 'Running', actionCost: 75, soundVolume: 8, color: '#ffff00' },
            crouch: { name: 'Crouching', actionCost: 125, soundVolume: 1, color: '#ff8800' },
            prone: { name: 'Prone', actionCost: 150, soundVolume: 0, color: '#ff0000' }
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
        
        // Debug mode
        this.exploreMode = false; // Toggle with F key - disables hunger/thirst
        
        this.equipmentSystem = new EquipmentSystem(this);
        this.containerSystem = new ContainerSystem();
    }
    
    getMaxHP() {
        let maxHP = 50 + (this.stats.endurance * 5);
        
        // Apply weakConstitution trait modifier
        if (this.traitEffects && this.traitEffects.maxHPMod) {
            maxHP += this.traitEffects.maxHPMod;
        }
        
        return Math.max(1, maxHP);
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
        
        if (isTwoHanded) {
            return {
                canCarry: !this.carrying.leftHand && !this.carrying.rightHand,
                hands: 'both',
                reason: this.carrying.leftHand || this.carrying.rightHand ? 'Need both hands free' : null
            };
        } else {
            return {
                canCarry: !this.carrying.leftHand || !this.carrying.rightHand,
                hands: 'one',
                reason: this.carrying.leftHand && this.carrying.rightHand ? 'Both hands full' : null
            };
        }
    }
    
    carryInHands(item) {
        const check = this.canCarryInHands(item);
        
        if (!check.canCarry) {
            return { success: false, message: check.reason };
        }
        
        if (check.hands === 'both') {
            this.carrying.leftHand = item;
            this.carrying.rightHand = item; // Same item reference in both hands
            item.carriedIn = 'both';
            return { success: true, message: `Carrying ${item.name} in both hands`, hands: 'both' };
        } else {
            if (!this.carrying.leftHand) {
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
        this.game.ui.log(`Movement: ${mode.name}`, 'info');
        return true;
    }
    
    tryMove(dx, dy) {
        const newX = this.x + dx;
        const newY = this.y + dy;
        
        if (this.game.world.isBlocked(newX, newY, this.z)) {
            const entity = this.game.world.getEntityAt(newX, newY, this.z);
            if (entity && entity !== this) {
                this.attack(entity);
                return true;
            }
            return false;
        }
        
        this.x = newX;
        this.y = newY;
        
        const mode = this.movementModes[this.movementMode];
        if (mode.soundVolume > 0) {
            this.game.soundSystem.makeSound(this.x, this.y, mode.soundVolume, 'movement', this);
        }
        
        this.checkExtraction();
        
        return true;
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
    
    attack(target) {
        const weaponDamage = this.equipmentSystem.getEquippedDamage();
        const strBonus = Math.floor(this.stats.strength / 2);
        const damage = weaponDamage + strBonus;
        
        target.takeDamage(damage);
        
        const weaponText = this.equipmentSystem.getWeaponGripText();
        const actionCost = this.equipmentSystem.getWeaponActionCost();
        
        this.game.ui.log(`You attack ${target.name} with ${weaponText} for ${damage} damage.`, 'combat');
    }
    
    takeDamage(amount) {
        const defense = this.equipmentSystem.getEquippedDefense();
        const actualDamage = Math.max(1, amount - defense);
        
        this.hp -= actualDamage;
        
        if (defense > 0) {
            this.game.ui.log(`You take ${actualDamage} damage (${defense} blocked by armor)!`, 'combat');
        } else {
            this.game.ui.log(`You take ${actualDamage} damage!`, 'combat');
        }
        
        if (this.hp <= 0) {
            this.hp = 0;
        }
    }
    
    isDead() {
        return this.hp <= 0;
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
        
        // Starvation effects
        if (this.hunger <= 0) {
            this.hp = Math.max(0, this.hp - 2);
            if (this.hp > 0) {
                this.game.ui.log('You are starving! -2 HP', 'warning');
            }
        } else if (this.hunger < 20) {
            if (Math.random() < 0.1) {
                this.game.ui.log('Your stomach growls with hunger...', 'warning');
            }
        }
        
        // Dehydration effects
        if (this.thirst <= 0) {
            this.hp = Math.max(0, this.hp - 3);
            if (this.hp > 0) {
                this.game.ui.log('You are severely dehydrated! -3 HP', 'warning');
            }
        } else if (this.thirst < 20) {
            if (Math.random() < 0.1) {
                this.game.ui.log('Your throat is parched...', 'warning');
            }
        }
        
        // Process other status effects
        for (let i = this.statusEffects.length - 1; i >= 0; i--) {
            const effect = this.statusEffects[i];
            
            if (effect.type === 'heal') {
                this.hp = Math.min(this.hp + effect.value, this.maxHP);
                this.game.ui.log(`+${effect.value} HP from ${effect.name}`, 'info');
            } else if (effect.type === 'sickness') {
                this.hp = Math.max(0, this.hp + effect.value);
                this.game.ui.log(`${effect.value} HP from ${effect.name}`, 'warning');
            }
            
            effect.duration--;
            if (effect.duration <= 0) {
                this.statusEffects.splice(i, 1);
                this.game.ui.log(`${effect.name} effect ended.`, 'info');
            }
        }
    }
}
