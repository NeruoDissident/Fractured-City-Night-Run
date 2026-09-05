/**
 * NpcCatalog - data-driven NPC templates
 *
 * The old roster (raiders, brutes, survivors, gangers...) and the quest/errand
 * NPCs were removed with the first-person pivot. The two entries below are
 * PLACEHOLDERS so combat, detection, and the AI shell in NPC.js stay testable
 * (see Game.debugSpawn / F9). The real roster comes with the new run flow.
 *
 * Each entry:
 *   name, glyph, color            - display
 *   spriteIndex                   - optional index into the 'npcs' spritesheet
 *   stats                         - same scale as the player (10 = average human)
 *   speed / attackCost / moveCost - energy system (100 = player walk baseline)
 *   visionRange / hearingRange    - detection
 *   hostile / aggression / courage / leashRange / giveUpTurns / wanderChance
 *   weaponTable                   - weighted list of { weight, weapon|null }
 */
export const NPC_TYPES = {
    debug_hostile: {
        name: 'Hostile (debug)',
        glyph: 'h',
        color: '#ff4444',
        spriteIndex: 0,
        stats: { strength: 11, agility: 10, endurance: 10, intelligence: 8, perception: 9 },
        speed: 85,
        attackCost: 100,
        moveCost: 100,
        visionRange: 8,
        hearingRange: 14,
        hostile: true,
        aggression: 0.8,
        courage: 0.35,
        leashRange: 25,
        giveUpTurns: 15,
        wanderChance: 0.3,
        weaponTable: [
            { weight: 40, weapon: { name: 'Shiv', type: 'weapon', baseDamage: '1d4', weaponStats: { attackType: 'sharp', bleedChance: 0.30, accuracy: 5, parryBonus: 0.05 } } },
            { weight: 40, weapon: { name: 'Pipe', type: 'weapon', baseDamage: '1d8', weaponStats: { attackType: 'blunt', staggerChance: 0.20, accuracy: -5 } } },
            { weight: 20, weapon: null }
        ]
    },
    debug_neutral: {
        name: 'Bystander (debug)',
        glyph: 'b',
        color: '#aaffaa',
        spriteIndex: 1,
        stats: { strength: 8, agility: 8, endurance: 8, intelligence: 9, perception: 8 },
        speed: 60,
        attackCost: 100,
        moveCost: 100,
        visionRange: 6,
        hearingRange: 8,
        hostile: false,
        aggression: 0.0,
        courage: 0.8,
        leashRange: 5,
        giveUpTurns: 3,
        wanderChance: 0.1,
        weaponTable: null
    }
};

export const DEFAULT_NPC_TYPE = 'debug_hostile';
