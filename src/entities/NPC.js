import { Entity } from './Entity.js';

export class NPC extends Entity {
    constructor(game, type, x, y) {
        super(game, x, y);
        
        this.type = type;
        this.ai = null;
        
        this.lastKnownPlayerPos = null;
        this.turnsWithoutSight = 0;
        this.investigateTarget = null;
        this.investigateTurns = 0;
        
        if (type === 'scavenger') {
            this.name = 'Scavenger';
            this.glyph = 's';
            this.color = '#888888';
            this.hp = 30;
            this.maxHP = 30;
            this.hostile = false;
            this.ai = 'wander';
        } else if (type === 'raider') {
            this.name = 'Raider';
            this.glyph = 'R';
            this.color = '#ff4444';
            this.hp = 50;
            this.maxHP = 50;
            this.hostile = true;
            this.ai = 'chase';
        }
    }
    
    takeTurn() {
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
            
            if (!this.game.world.isBlocked(newX, newY)) {
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
            
            if (!this.game.world.isBlocked(newX, newY)) {
                this.x = newX;
                this.y = newY;
            } else if (moveX !== 0) {
                moveX = 0;
                moveY = dy > 0 ? 1 : -1;
                const altX = this.x + moveX;
                const altY = this.y + moveY;
                if (!this.game.world.isBlocked(altX, altY)) {
                    this.x = altX;
                    this.y = altY;
                }
            }
        }
    }
    
    raiderAI() {
        const player = this.game.player;
        const canSeePlayer = this.game.fov && this.game.fov.isVisible(this.x, this.y);
        
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
        if (newX === player.x && newY === player.y) {
            this.attack(player);
            return;
        }
        
        if (!this.game.world.isBlocked(newX, newY)) {
            this.x = newX;
            this.y = newY;
        }
    }
    
    attack(target) {
        const damage = Math.floor(Math.random() * 8) + 2;
        target.takeDamage(damage);
        this.game.ui.log(`${this.name} attacks you for ${damage} damage!`, 'combat');
    }
    
    takeDamage(amount) {
        this.hp -= amount;
        
        if (this.isDead()) {
            this.die();
        }
    }
    
    isDead() {
        return this.hp <= 0;
    }
    
    hearSound(sound) {
        if (this.type !== 'raider') return;
        
        if (!this.investigateTarget || this.investigateTurns === 0) {
            this.investigateTarget = { x: sound.x, y: sound.y };
            this.investigateTurns = 10;
        }
    }
    
    die() {
        this.game.ui.log(`${this.name} dies.`, 'combat');
        this.game.world.removeEntity(this);
    }
}
