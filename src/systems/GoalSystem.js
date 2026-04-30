// GoalSystem.js — archetype goals, floor goals, completion tracking

export const ARCHETYPES = {
    streetKid: {
        label: 'Street Kid',
        primaryGoal: {
            id: 'sk_primary',
            text: 'Survive and protect what matters.',
            type: 'primary',
            xp: 0  // ongoing identity — no single completion
        },
        floorGoalPool: [
            'find_stash',
            'deliver_item',
            'reach_extraction',
            'kill_gang_leader',
            'avoid_kills',
        ],
        factionStanding: {
            downstairs:    'welcome',
            helixcare:     'suspicious',
            blackSash:     'hostile',
            rustChoir:     'tolerated',
            paleStatic:    'tolerated',
            civicGhost:    'restricted',
        }
    },
    scavenger: {
        label: 'Scavenger',
        primaryGoal: {
            id: 'sc_primary',
            text: 'Recover 5 valuable components this run.',
            type: 'primary',
            xp: 50,
            check: (game) => (game.player.goalsData.componentsFound || 0) >= 5
        },
        floorGoalPool: [
            'find_stash',
            'strip_electronics',
            'reach_extraction',
            'salvage_gear',
        ],
        factionStanding: {
            downstairs:    'tolerated',
            helixcare:     'suspicious',
            blackSash:     'restricted',
            rustChoir:     'welcome',
            paleStatic:    'tolerated',
            civicGhost:    'hostile',
        }
    },
    raiderDefector: {
        label: 'Raider Defector',
        primaryGoal: {
            id: 'rd_primary',
            text: 'Prove you\'re done. Kill 3 gang members this run.',
            type: 'primary',
            xp: 75,
            check: (game) => (game.player.goalsData.killCount || 0) >= 3
        },
        floorGoalPool: [
            'kill_gang_leader',
            'destroy_stash',
            'reach_extraction',
            'intimidate_npc',
        ],
        factionStanding: {
            downstairs:    'tolerated',
            helixcare:     'hostile',
            blackSash:     'suspicious',   // ex-member, risky
            rustChoir:     'tolerated',
            paleStatic:    'tolerated',
            civicGhost:    'hostile',
        }
    },
    medic: {
        label: 'Field Medic',
        primaryGoal: {
            id: 'md_primary',
            text: 'Save 3 injured survivors this run.',
            type: 'primary',
            xp: 75,
            check: (game) => (game.player.goalsData.npcsSaved || 0) >= 3
        },
        floorGoalPool: [
            'find_medicine',
            'treat_npc',
            'reach_extraction',
            'avoid_kills',
        ],
        factionStanding: {
            downstairs:    'welcome',
            helixcare:     'welcome',
            blackSash:     'restricted',
            rustChoir:     'tolerated',
            paleStatic:    'tolerated',
            civicGhost:    'tolerated',
        }
    },
    corpo: {
        label: 'Corpo Defector',
        primaryGoal: {
            id: 'cp_primary',
            text: 'Reach a terminal and delete your ID.',
            type: 'primary',
            xp: 75,
            check: (game) => game.player.goalsData.idDeleted === true
        },
        floorGoalPool: [
            'hack_terminal',
            'reach_extraction',
            'find_stash',
            'avoid_kills',
        ],
        factionStanding: {
            downstairs:    'suspicious',
            helixcare:     'welcome',
            blackSash:     'hostile',
            rustChoir:     'tolerated',
            paleStatic:    'restricted',
            civicGhost:    'welcome',
        }
    },
    echoTouched: {
        label: 'Echo-Touched',
        primaryGoal: {
            id: 'et_primary',
            text: 'Attune 3 Echo fragments.',
            type: 'primary',
            xp: 75,
            check: (game) => (game.player.goalsData.fragmentsAttuned || 0) >= 3
        },
        floorGoalPool: [
            'find_fragment',
            'reach_extraction',
            'avoid_kills',
        ],
        factionStanding: {
            downstairs:    'tolerated',
            helixcare:     'hostile',
            blackSash:     'hostile',
            rustChoir:     'hostile',
            paleStatic:    'welcome',
            civicGhost:    'hostile',
        }
    }
};

// Floor goal definitions — each has text, xp reward, and a check function
export const FLOOR_GOALS = {
    find_stash: {
        id: 'find_stash',
        text: 'Find a hidden stash.',
        xp: 15,
        check: (game) => game.player.goalsData.stashFound === true
    },
    reach_extraction: {
        id: 'reach_extraction',
        text: 'Reach the extraction point.',
        xp: 20,
        check: (game) => game.player.goalsData.reachedExtraction === true
    },
    kill_gang_leader: {
        id: 'kill_gang_leader',
        text: 'Eliminate the local gang leader.',
        xp: 25,
        check: (game) => game.player.goalsData.gangLeaderKilled === true
    },
    avoid_kills: {
        id: 'avoid_kills',
        text: 'Complete the zone without killing.',
        xp: 20,
        check: (game) => (game.player.goalsData.killCount || 0) === 0
    },
    find_medicine: {
        id: 'find_medicine',
        text: 'Recover medical supplies.',
        xp: 15,
        check: (game) => game.player.goalsData.medicineFound === true
    },
    treat_npc: {
        id: 'treat_npc',
        text: 'Treat an injured survivor.',
        xp: 20,
        check: (game) => (game.player.goalsData.npcsSaved || 0) >= 1
    },
    find_fragment: {
        id: 'find_fragment',
        text: 'Locate an Echo fragment.',
        xp: 20,
        check: (game) => (game.player.goalsData.fragmentsAttuned || 0) >= 1
    },
    hack_terminal: {
        id: 'hack_terminal',
        text: 'Access a terminal.',
        xp: 15,
        check: (game) => game.player.goalsData.terminalAccessed === true
    },
    destroy_stash: {
        id: 'destroy_stash',
        text: 'Destroy a gang stash.',
        xp: 20,
        check: (game) => game.player.goalsData.stashDestroyed === true
    },
    strip_electronics: {
        id: 'strip_electronics',
        text: 'Strip electronics from the environment.',
        xp: 15,
        check: (game) => (game.player.goalsData.componentsFound || 0) >= 2
    },
    salvage_gear: {
        id: 'salvage_gear',
        text: 'Salvage gear from a body or ruin.',
        xp: 15,
        check: (game) => game.player.goalsData.gearSalvaged === true
    },
    intimidate_npc: {
        id: 'intimidate_npc',
        text: 'Intimidate an enemy into backing down.',
        xp: 15,
        check: (game) => game.player.goalsData.npcIntimidated === true
    },
    deliver_item: {
        id: 'deliver_item',
        text: 'Deliver a needed item.',
        xp: 20,
        check: (game) => game.player.goalsData.itemDelivered === true
    },
};

export class GoalSystem {
    constructor(game) {
        this.game = game;
    }

    // Called once when the run starts — assign goals to the player
    initGoals(player) {
        const archetypeId = player.backgroundId || 'streetKid';
        const archetype = ARCHETYPES[archetypeId] || ARCHETYPES.streetKid;

        player.archetypeId = archetypeId;
        player.archetypeLabel = archetype.label;
        player.factionStanding = { ...archetype.factionStanding };

        // Init tracking data bag
        if (!player.goalsData) player.goalsData = {};
        player.goalsData.killCount = 0;

        // Primary goal
        player.primaryGoal = { ...archetype.primaryGoal, completed: false };

        // Pick 2 random floor goals from the pool
        const pool = archetype.floorGoalPool
            .map(id => FLOOR_GOALS[id])
            .filter(Boolean);
        player.floorGoals = this._pick(pool, 2).map(g => ({ ...g, completed: false }));
    }

    // Call this every turn to check and mark completed goals
    checkGoals(player) {
        const game = this.game;
        let anyNew = false;

        // Primary
        if (!player.primaryGoal.completed && player.primaryGoal.check) {
            if (player.primaryGoal.check(game)) {
                player.primaryGoal.completed = true;
                if (player.primaryGoal.xp) {
                    this._awardXP(player, player.primaryGoal.xp);
                }
                game.ui.log(`Primary goal complete: ${player.primaryGoal.text}`, 'info');
                anyNew = true;
            }
        }

        // Floor goals
        for (const goal of (player.floorGoals || [])) {
            if (!goal.completed && goal.check) {
                if (goal.check(game)) {
                    goal.completed = true;
                    this._awardXP(player, goal.xp);
                    game.ui.log(`Goal complete: ${goal.text} (+${goal.xp} XP)`, 'info');
                    anyNew = true;
                }
            }
        }

        return anyNew;
    }

    // Track a kill for the avoid_kills goal
    recordKill(player) {
        if (!player.goalsData) player.goalsData = {};
        player.goalsData.killCount = (player.goalsData.killCount || 0) + 1;
    }

    getFactionStanding(player, factionId) {
        return (player.factionStanding || {})[factionId] || 'tolerated';
    }

    _awardXP(player, amount) {
        player.xp = (player.xp || 0) + amount;
        // Future: level-up check here
    }

    _pick(arr, n) {
        const shuffled = [...arr].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, n);
    }
}
