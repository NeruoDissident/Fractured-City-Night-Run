export class Entity {
    constructor(game, x, y) {
        this.game = game;
        this.x = x;
        this.y = y;
        this.glyph = '?';
        this.color = '#ffffff';
        this.blocksMovement = true;
        this.name = 'Unknown Entity';
    }
    
    takeTurn() {
    }
}
