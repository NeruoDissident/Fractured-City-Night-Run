export class Renderer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.tileSize = 32; // Keep at 32 for sprite compatibility
        this.tilesX = 30;
        this.tilesY = 20;
        this.scale = 1.0;
    }
    
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.calculateDimensions();
        
        this.ctx.imageSmoothingEnabled = false;
        
        // Add resize handler
        window.addEventListener('resize', () => this.handleResize());
    }
    
    calculateDimensions() {
        const mainView = document.getElementById('main-view');
        const availableWidth = mainView.clientWidth;
        const availableHeight = mainView.clientHeight;
        
        // Detect mobile
        const isMobile = window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
        
        // Calculate how many tiles can fit at base size (32px)
        const maxTilesX = Math.floor(availableWidth / this.tileSize);
        const maxTilesY = Math.floor(availableHeight / this.tileSize);
        
        if (isMobile) {
            // On mobile, use fewer tiles so they remain readable
            this.tilesX = Math.max(12, Math.min(maxTilesX, 20));
            this.tilesY = Math.max(10, Math.min(maxTilesY, 16));
        } else {
            // Desktop: use slightly fewer tiles to leave some margin
            this.tilesX = Math.max(30, maxTilesX - 2);
            this.tilesY = Math.max(20, maxTilesY - 2);
        }
        
        // Set canvas to actual pixel dimensions (32px tiles)
        this.canvas.width = this.tileSize * this.tilesX;
        this.canvas.height = this.tileSize * this.tilesY;
        
        // Calculate scale to fill available space nicely
        const scaleX = availableWidth / this.canvas.width;
        const scaleY = availableHeight / this.canvas.height;
        this.scale = Math.min(scaleX, scaleY, 2.0); // Cap at 2x for readability
        
        // Apply CSS scaling
        this.canvas.style.transform = `scale(${this.scale})`;
        this.canvas.style.transformOrigin = 'top left';
        
        // Adjust container to account for scaling
        this.canvas.style.width = `${this.canvas.width}px`;
        this.canvas.style.height = `${this.canvas.height}px`;
    }
    
    handleResize() {
        this.calculateDimensions();
        // Trigger re-render if game exists
        if (window.game && window.game.renderer) {
            window.game.render();
        }
    }
    
    clear() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    drawTile(x, y, glyph, fgColor, bgColor = null) {
        const screenX = x * this.tileSize;
        const screenY = y * this.tileSize;
        
        if (bgColor) {
            this.ctx.fillStyle = bgColor;
            this.ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);
        }
        
        this.ctx.fillStyle = fgColor;
        this.ctx.font = 'bold 24px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(glyph, screenX + this.tileSize / 2, screenY + this.tileSize / 2);
    }
    
    drawRect(x, y, width, height, color) {
        const screenX = x * this.tileSize;
        const screenY = y * this.tileSize;
        this.ctx.fillStyle = color;
        this.ctx.fillRect(screenX, screenY, width * this.tileSize, height * this.tileSize);
    }
    
    drawBorder(x, y, color) {
        const screenX = x * this.tileSize;
        const screenY = y * this.tileSize;
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(screenX + 1, screenY + 1, this.tileSize - 2, this.tileSize - 2);
    }
    
    drawInspectCursor(x, y) {
        const screenX = x * this.tileSize;
        const screenY = y * this.tileSize;
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(screenX + 2, screenY + 2, this.tileSize - 4, this.tileSize - 4);
    }
}
