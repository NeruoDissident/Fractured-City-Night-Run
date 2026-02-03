/**
 * EquipmentSystem
 * 
 * Handles all equipment-related logic: equipping, unequipping, slot validation,
 * stat calculations, and dual-wielding mechanics.
 * 
 * EXPANSION POINTS:
 * - Add weapon weight/encumbrance system
 * - Add equipment degradation on use
 * - Add set bonuses for matching equipment
 * - Add equipment requirements (stat minimums, cybernetic prerequisites)
 */

export class EquipmentSystem {
    constructor(player) {
        this.player = player;
    }
    
    /**
     * Equips an item from inventory to a slot
     * @param {number} inventoryIndex - Index of item in player's inventory
     * @param {string} targetSlot - Optional: 'leftHand', 'rightHand', 'bothHands', 'head', 'torso', 'legs'
     * @param {boolean} skipAutoUnequip - If true, assumes slot is already clear (for UI-managed unequipping)
     * @returns {Object} { success: boolean, message: string }
     */
    equipItem(inventoryIndex, targetSlot = null, skipAutoUnequip = false) {
        const item = this.player.inventory[inventoryIndex];
        if (!item) {
            return { success: false, message: 'Invalid item.' };
        }
        
        const validSlots = this.getValidSlotsForItem(item);
        if (validSlots.length === 0) {
            return { success: false, message: `${item.name} cannot be equipped.` };
        }
        
        if (targetSlot && !validSlots.includes(targetSlot)) {
            return { success: false, message: `${item.name} cannot be equipped in ${targetSlot}.` };
        }
        
        const slot = targetSlot || validSlots[0];
        
        // Initialize carrying if it doesn't exist (for old save games)
        if (!this.player.carrying) {
            this.player.carrying = { leftHand: null, rightHand: null };
        }
        
        // Check if hands are blocked by carried items OR already equipped items
        if (slot === 'leftHand' || slot === 'rightHand' || slot === 'bothHands') {
            if (slot === 'bothHands' || slot === 'leftHand') {
                if (this.player.carrying.leftHand) {
                    return { success: false, message: `Left hand is carrying ${this.player.carrying.leftHand.name}. Drop it first.` };
                }
            }
            if (slot === 'bothHands' || slot === 'rightHand') {
                if (this.player.carrying.rightHand) {
                    return { success: false, message: `Right hand is carrying ${this.player.carrying.rightHand.name}. Drop it first.` };
                }
            }
        }
        
        if (slot === 'bothHands') {
            if (!skipAutoUnequip) {
                const leftResult = this.unequipSlot('leftHand');
                const rightResult = this.unequipSlot('rightHand');
                
                if (leftResult.unequipped) {
                    this.player.game.ui.log(leftResult.message, 'info');
                }
                if (rightResult.unequipped) {
                    this.player.game.ui.log(rightResult.message, 'info');
                }
            }
            
            this.player.equipment.leftHand = item;
            this.player.equipment.rightHand = item;
            item.twoHandGrip = true;
            this.player.inventory.splice(inventoryIndex, 1);
            
            return { 
                success: true, 
                message: `Equipped ${item.name} with both hands (two-handed grip).` 
            };
        }
        
        if (!skipAutoUnequip) {
            const unequipResult = this.unequipSlot(slot);
            if (unequipResult.unequipped) {
                this.player.game.ui.log(unequipResult.message, 'info');
            }
        }
        
        this.player.equipment[slot] = item;
        item.twoHandGrip = false;
        this.player.inventory.splice(inventoryIndex, 1);
        
        return { 
            success: true, 
            message: `Equipped ${item.name} in ${this.getSlotDisplayName(slot)}.` 
        };
    }
    
    /**
     * Unequips an item from a slot and returns it to inventory
     * @param {string} slot - Equipment slot name
     * @returns {Object} { success: boolean, message: string, unequipped: Item|null }
     */
    unequipSlot(slot) {
        const item = this.player.equipment[slot];
        if (!item) {
            return { success: false, message: 'Nothing equipped in that slot.', unequipped: null };
        }
        
        if (item.twoHandGrip) {
            this.player.equipment.leftHand = null;
            this.player.equipment.rightHand = null;
            item.twoHandGrip = false;
            
            return { 
                success: true, 
                message: `Unequipped ${item.name} from both hands.`,
                unequipped: item
            };
        }
        
        this.player.equipment[slot] = null;
        
        return { 
            success: true, 
            message: `Unequipped ${item.name} from ${this.getSlotDisplayName(slot)}.`,
            unequipped: item
        };
    }
    
    /**
     * Determines which slots an item can be equipped in
     * @param {Object} item - Item to check
     * @returns {Array<string>} Array of valid slot names
     */
    getValidSlotsForItem(item) {
        if (!item.slots || item.slots.length === 0) {
            return [];
        }
        
        const validSlots = [];
        
        for (const slotType of item.slots) {
            if (slotType === 'hand') {
                validSlots.push('leftHand', 'rightHand');
                if (item.canTwoHand) {
                    validSlots.push('bothHands');
                }
            } else if (slotType === 'head') {
                validSlots.push('head');
            } else if (slotType === 'torso') {
                validSlots.push('torso');
            } else if (slotType === 'legs') {
                validSlots.push('legs');
            }
        }
        
        return validSlots;
    }
    
    /**
     * Checks if an item requires two hands
     * EXPANSION POINT: Add 'twoHanded' property to item definitions
     */
    isTwoHanded(item) {
        return item.twoHanded === true;
    }
    
    /**
     * Gets display-friendly slot name
     */
    getSlotDisplayName(slot) {
        const names = {
            'leftHand': 'Left Hand',
            'rightHand': 'Right Hand',
            'bothHands': 'Both Hands',
            'head': 'Head',
            'torso': 'Torso',
            'legs': 'Legs'
        };
        return names[slot] || slot;
    }
    
    /**
     * Calculates total damage from equipped weapons
     * EXPANSION POINT: Add damage types, critical multipliers, status effects
     */
    getEquippedDamage() {
        let totalDamage = 0;
        let damageBonus = 0;
        
        const leftWeapon = this.player.equipment.leftHand;
        const rightWeapon = this.player.equipment.rightHand;
        
        if (leftWeapon && leftWeapon.type === 'weapon' && leftWeapon.twoHandGrip) {
            totalDamage += this.rollDamage(leftWeapon.baseDamage);
            if (leftWeapon.twoHandDamageBonus) {
                totalDamage += this.rollDamage(leftWeapon.twoHandDamageBonus);
            }
            if (leftWeapon.damageMod) {
                damageBonus += leftWeapon.damageMod;
            }
        } else {
            if (leftWeapon && leftWeapon.type === 'weapon') {
                totalDamage += this.rollDamage(leftWeapon.baseDamage);
                if (leftWeapon.damageMod) {
                    damageBonus += leftWeapon.damageMod;
                }
            }
            
            if (rightWeapon && rightWeapon.type === 'weapon') {
                totalDamage += this.rollDamage(rightWeapon.baseDamage);
                if (rightWeapon.damageMod) {
                    damageBonus += rightWeapon.damageMod;
                }
            }
        }
        
        if (totalDamage === 0) {
            totalDamage = Math.floor(Math.random() * 3) + 1;
        }
        
        totalDamage = Math.floor(totalDamage * (1 + damageBonus));
        
        return totalDamage;
    }
    
    /**
     * Rolls damage from a dice string (e.g., "1d6", "2d4")
     */
    rollDamage(diceString) {
        if (!diceString) return 0;
        
        const parts = diceString.split('d');
        if (parts.length !== 2) return 0;
        
        const count = parseInt(parts[0]);
        const sides = parseInt(parts[1]);
        
        let total = 0;
        for (let i = 0; i < count; i++) {
            total += Math.floor(Math.random() * sides) + 1;
        }
        
        return total;
    }
    
    /**
     * Calculates total defense from equipped armor
     * EXPANSION POINT: Add armor types, damage resistance by type, durability
     */
    getEquippedDefense() {
        let totalDefense = 0;
        
        for (const slot in this.player.equipment) {
            const item = this.player.equipment[slot];
            if (item && item.type === 'armor' && item.defense) {
                totalDefense += item.defense;
                if (item.defenseMod) {
                    totalDefense += item.defenseMod;
                }
            }
        }
        
        return totalDefense;
    }
    
    /**
     * Gets total action cost modifier from equipment
     * EXPANSION POINT: Tie to movement modes, add stamina system
     */
    getActionCostModifier() {
        let modifier = 1.0;
        
        for (const slot in this.player.equipment) {
            const item = this.player.equipment[slot];
            if (item && item.weightMod) {
                modifier *= item.weightMod;
            }
        }
        
        return modifier;
    }
    
    /**
     * Checks if player can use hands (for equipment requirements)
     */
    canEquipHandItem() {
        return this.player.anatomy.canUseHands();
    }
    
    /**
     * Gets the action cost for the current weapon setup
     * Used for turn-based speed calculations
     * @returns {number} Action cost (100 = baseline, higher = slower)
     */
    getWeaponActionCost() {
        const leftWeapon = this.player.equipment.leftHand;
        const rightWeapon = this.player.equipment.rightHand;
        
        if (leftWeapon && leftWeapon.type === 'weapon' && leftWeapon.twoHandGrip) {
            return leftWeapon.twoHandActionCost || leftWeapon.actionCost || 100;
        }
        
        let maxCost = 100;
        
        if (leftWeapon && leftWeapon.type === 'weapon') {
            maxCost = Math.max(maxCost, leftWeapon.actionCost || 100);
        }
        
        if (rightWeapon && rightWeapon.type === 'weapon') {
            maxCost = Math.max(maxCost, rightWeapon.actionCost || 100);
        }
        
        return maxCost;
    }
    
    /**
     * Gets display text for current weapon grip
     */
    getWeaponGripText() {
        const leftWeapon = this.player.equipment.leftHand;
        const rightWeapon = this.player.equipment.rightHand;
        
        if (leftWeapon && leftWeapon.type === 'weapon' && leftWeapon.twoHandGrip) {
            return `${leftWeapon.name} (two-handed)`;
        }
        
        if (leftWeapon && rightWeapon && leftWeapon.type === 'weapon' && rightWeapon.type === 'weapon') {
            return `${leftWeapon.name} and ${rightWeapon.name}`;
        } else if (leftWeapon && leftWeapon.type === 'weapon') {
            return leftWeapon.name;
        } else if (rightWeapon && rightWeapon.type === 'weapon') {
            return rightWeapon.name;
        }
        
        return 'your fists';
    }
}
