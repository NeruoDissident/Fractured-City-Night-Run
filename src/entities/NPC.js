import { Entity } from './Entity.js';
import { Anatomy } from './Anatomy.js';

export class NPC extends Entity {
    constructor(game, type, x, y) {
        super(game, x, y);
        
        this.type = type;
        this.ai = null;
        
        this.lastKnownPlayerPos = null;
        this.turnsWithoutSight = 0;
        this.investigateTarget = null;
        this.investigateTurns = 0;
        
        // All NPCs get anatomy
        this.anatomy = new Anatomy(this);
        this.anatomy.init();
        
        // Equipment slots (for armor coverage)
        this.equipment = {};
        
        // Weapon item (null = unarmed)
        this.weapon = null;
        
        if (type === 'scavenger') {
            this.name = 'Scavenger';
            this.glyph = 's';
            this.color = '#888888';
            this.hostile = false;
            this.ai = 'wander';
            this.weapon = null; // Unarmed
        } else if (type === 'raider') {
            this.name = 'Raider';
            this.glyph = 'R';
            this.color = '#ff4444';
            this.hostile = true;
            this.ai = 'chase';
            // Raiders spawn with a random weapon
            this.weapon = this.rollRaiderWeapon();
        }
    }
    
    rollRaiderWeapon() {
        const roll = Math.random();
        if (roll < 0.3) {
            return { name: 'Shiv', type: 'weapon', baseDamage: '1d4', weaponStats: { attackType: 'sharp', bleedChance: 0.30 } };
        } else if (roll < 0.6) {
            return { name: 'Pipe', type: 'weapon', baseDamage: '1d8', weaponStats: { attackType: 'blunt', stunChance: 0.10 } };
        } else if (roll < 0.8) {
            return { name: 'Knife', type: 'weapon', baseDamage: '1d6', weaponStats: { attackType: 'sharp', bleedChance: 0.40 } };
        }
        return null; // 20% chance unarmed
    }
    
    takeTurn() {
        // Process anatomy (bleeding, organ effects) each turn
        if (this.anatomy) {
            const currentTurn = this.game.turnCount || 0;
            const result = this.anatomy.processTurn(currentTurn);
            if (!result.alive) {
                this.die();
                return;
            }
        }
        
        if (this.ai === 'wander') {
            this.wanderAI();
        } else if (this.ai === 'chase') {
            this.chaseAI();
        }
    }
    
    wanderAI() {
        if (Math.random() < 0.3) {
            const dx = Math.floor(Math.random() * 3) - 1;
            const dy = Math.floor(Math.random() * 3) - 1;
            
            const newX = this.x + dx;
            const newY = this.y + dy;
            
            if (!this.game.world.isBlocked(newX, newY, this.z)) {
                this.x = newX;
                this.y = newY;
            }
        }
    }
    
    chaseAI() {
        if (this.type === 'raider') {
            this.raiderAI();
        } else {
            const player = this.game.player;
            
            // Only chase if on same Z-level
            if (player.z !== this.z) {
                this.wanderAI();
                return;
            }
            
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.abs(dx) + Math.abs(dy);
            
            if (dist > 10) {
                this.wanderAI();
                return;
            }
            
            if (dist === 1) {
                this.attack(player);
                return;
            }
            
            let moveX = 0;
            let moveY = 0;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                moveX = dx > 0 ? 1 : -1;
            } else {
                moveY = dy > 0 ? 1 : -1;
            }
            
            const newX = this.x + moveX;
            const newY = this.y + moveY;
            
            if (!this.game.world.isBlocked(newX, newY, this.z)) {
                this.x = newX;
                this.y = newY;
            } else if (moveX !== 0) {
                moveX = 0;
                moveY = dy > 0 ? 1 : -1;
                const altX = this.x + moveX;
                const altY = this.y + moveY;
                if (!this.game.world.isBlocked(altX, altY, this.z)) {
                    this.x = altX;
                    this.y = altY;
                }
            }
        }
    }
    
    raiderAI() {
        const player = this.game.player;
        
        // Only track player if on same Z-level
        if (player.z !== this.z) {
            this.lastKnownPlayerPos = null;
            this.wanderAI();
            return;
        }
        
        const canSeePlayer = this.game.fov && this.game.fov.isVisible(this.x, this.y, player.z);
        
        if (canSeePlayer) {
            this.lastKnownPlayerPos = { x: player.x, y: player.y };
            this.turnsWithoutSight = 0;
            this.investigateTarget = null;
            this.investigateTurns = 0;
        } else {
            this.turnsWithoutSight++;
        }
        
        if (this.lastKnownPlayerPos && this.turnsWithoutSight < 10) {
            const dx = this.lastKnownPlayerPos.x - this.x;
            const dy = this.lastKnownPlayerPos.y - this.y;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                this.tryMove(Math.sign(dx), 0);
            } else {
                this.tryMove(0, Math.sign(dy));
            }
        } else if (this.investigateTarget && this.investigateTurns > 0) {
            this.investigateTurns--;
            
            const dx = this.investigateTarget.x - this.x;
            const dy = this.investigateTarget.y - this.y;
            
            if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
                this.investigateTarget = null;
                this.investigateTurns = 0;
            } else {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.tryMove(Math.sign(dx), 0);
                } else {
                    this.tryMove(0, Math.sign(dy));
                }
            }
        } else {
            this.lastKnownPlayerPos = null;
            this.investigateTarget = null;
            this.wanderAI();
        }
    }
    
    tryMove(dx, dy) {
        const newX = this.x + dx;
        const newY = this.y + dy;
        
        const player = this.game.player;
        if (newX === player.x && newY === player.y && player.z === this.z) {
            this.attack(player);
            return;
        }
        
        if (!this.game.world.isBlocked(newX, newY, this.z)) {
            this.x = newX;
            this.y = newY;
        }
    }
    
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
    
    hearSound(sound) {
        if (this.type !== 'raider') return;
        
        if (!this.investigateTarget || this.investigateTurns === 0) {
            this.investigateTarget = { x: sound.x, y: sound.y };
            this.investigateTurns = 10;
        }
    }
    
    die() {
        if (this.anatomy && this.anatomy.causeOfDeath) {
            const cause = this.anatomy.getDeathCause();
            this.game.ui.log(`${this.name} ${cause}.`, 'combat');
        }
        this.game.world.removeEntity(this);
    }
}
