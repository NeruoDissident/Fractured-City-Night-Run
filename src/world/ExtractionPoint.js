/**
 * ExtractionPoint
 * 
 * Represents an exit point that allows the player to complete a run.
 * Requires an access condition (key, card, etc.) to use.
 */

export class ExtractionPoint {
    constructor(x, y, type = 'transit_gate') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.glyph = this.getGlyphForType(type);
        this.color = this.getColorForType(type);
        this.name = this.getNameForType(type);
        this.requiresItem = 'access_card';
        this.active = true;
    }
    
    getGlyphForType(type) {
        const glyphs = {
            'transit_gate': '▲',
            'safehouse': '■',
            'elevator': '↑',
            'escape_tunnel': '○'
        };
        return glyphs[type] || '▲';
    }
    
    getColorForType(type) {
        const colors = {
            'transit_gate': '#00ff00',
            'safehouse': '#00ffff',
            'elevator': '#ffff00',
            'escape_tunnel': '#ff00ff'
        };
        return colors[type] || '#00ff00';
    }
    
    getNameForType(type) {
        const names = {
            'transit_gate': 'Transit Gate',
            'safehouse': 'Safehouse Entrance',
            'elevator': 'Service Elevator',
            'escape_tunnel': 'Escape Tunnel'
        };
        return names[type] || 'Extraction Point';
    }
    
    canUse(player) {
        if (!this.active) return false;
        
        if (this.requiresItem) {
            return player.inventory.some(item => item.id === this.requiresItem);
        }
        
        return true;
    }
    
    getRequirementText() {
        if (this.requiresItem === 'access_card') {
            return 'Requires: Access Card';
        }
        return 'Ready to extract';
    }
}
