import { Game } from './core/Game.js';

const game = new Game();
window.game = game; // Make accessible for resize handler
game.init();
