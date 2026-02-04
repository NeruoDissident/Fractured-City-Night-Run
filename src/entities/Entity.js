export class Entity {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.z = 0; // Z-level (0 = ground, positive = up, negative = down)
        this.glyph = '?';
        this.color = '#ffffff';
        this.blocksMovement = true;
        this.name = 'Unknown Entity';
    }
    
    takeTurn() {
    }
}
