// QuestSystem.js — runtime quest state machine
//
// Each quest has stages. Stages advance via code checks (e.g. item in inventory,
// flag set, NPC talked to). Rewards fire on completion.
//
// Integration points:
//   Game.js        — init on run start, _talkToNPC() branches on quest NPCs
//   NPC.js         — questRole / questId fields
//   GoalSystem.js  — quest completion can satisfy goals
//   UIManager.js   — quest journal panel (key: J)

export const QUESTS = {
    // ─── Street Kid starter chain ───────────────────────────────────────────
    streetkid_rations: {
        id: 'streetkid_rations',
        title: 'One More Day',
        description: 'Rook needs you to cross into a nearby market corner and recover a ration bundle from the bodega.',
        occupation: 'streetKid',
        targetZoneId: 'urban_market_corner',
        giverNpcType: 'survivor',
        stages: [
            {
                id: 'recover_rations',
                description: 'Travel to the marked Market Corner, find the Crew Ration Bundle in the bodega, and return it to Rook.',
                checkCanComplete: (game, player) => {
                    return player.inventory.some(i => i.id === 'crew_rations' || i.familyId === 'crew_rations');
                },
                consumeItems: ['crew_rations']
            }
        ],
        rewards: {
            items: [{ itemId: 'bandage', count: 1 }],
            xp: 35
        },
        oncePerRun: true
    }
};

export class QuestSystem {
    constructor(game) {
        this.game = game;
    }

    // ─── Player lifecycle ───────────────────────────────────────────────────

    initPlayer(player) {
        if (!player.questData) {
            player.questData = {
                active: [],      // { questId, stageIndex, stageFlags: {}, startedTurn }
                completed: [],   // { questId, completedTurn }
                flags: {},        // arbitrary booleans / counters
                knownDeliveries: []  // { npcId, npcName, itemId, label, fulfilled }
            };
        }
    }

    // ─── Quest queries ──────────────────────────────────────────────────────

    getDef(questId) {
        return QUESTS[questId];
    }

    hasActive(player, questId) {
        return player.questData?.active?.some(q => q.questId === questId) ?? false;
    }

    hasCompleted(player, questId) {
        return player.questData?.completed?.some(q => q.questId === questId) ?? false;
    }

    hasQuest(player, questId) {
        return this.hasActive(player, questId) || this.hasCompleted(player, questId);
    }

    getActive(player, questId) {
        return player.questData?.active?.find(q => q.questId === questId) ?? null;
    }

    getStageDef(questId, stageIndex) {
        const def = this.getDef(questId);
        return def?.stages?.[stageIndex] ?? null;
    }

    getCurrentStage(player, questId) {
        const q = this.getActive(player, questId);
        if (!q) return null;
        return this.getStageDef(questId, q.stageIndex);
    }

    // ─── Starting ───────────────────────────────────────────────────────────

    startQuest(player, questId, giverNpc = null) {
        const def = this.getDef(questId);
        if (!def) {
            console.warn(`QuestSystem: unknown quest "${questId}"`);
            return false;
        }

        if (this.hasQuest(player, questId)) {
            if (def.oncePerRun) return false;
        }

        // Remove from completed if repeatable (not used yet, but future-proof)
        player.questData.completed = player.questData.completed.filter(q => q.questId !== questId);

        const questState = {
            questId,
            stageIndex: 0,
            stageFlags: {},
            startedTurn: this.game.turnCount || 0,
            giverNpcId: giverNpc?.id || null
        };

        player.questData.active.push(questState);

        this.game.ui.log(`Quest started: ${def.title}`, 'info');
        this.game.ui.log(def.description, 'info');
        if (def.targetZoneId && this.game.getQuestTargetHint) {
            const hint = this.game.getQuestTargetHint(def.targetZoneId);
            if (hint) this.game.ui.log(`Target: ${hint}`, 'warning');
        }
        if (def.stages[0]) {
            this.game.ui.log(`Objective: ${def.stages[0].description}`, 'warning');
        }

        return true;
    }

    // ─── Advancement ────────────────────────────────────────────────────────

    // Advance by one stage. Call this when the player does the thing.
    advanceStage(player, questId, data = {}) {
        const q = this.getActive(player, questId);
        const def = this.getDef(questId);
        if (!q || !def) return false;

        q.stageIndex++;
        Object.assign(q.stageFlags, data);

        if (q.stageIndex >= def.stages.length) {
            this.completeQuest(player, questId);
            return true;
        }

        const next = def.stages[q.stageIndex];
        this.game.ui.log(`Quest updated: ${def.title} — ${next.description}`, 'info');
        return true;
    }

    // Try to complete the current stage (e.g. talking to the quest giver with the item).
    // Returns true if the stage was advanced or quest completed.
    tryAdvanceByTalk(player, questId, npc) {
        const q = this.getActive(player, questId);
        const stage = this.getCurrentStage(player, questId);
        if (!q || !stage) return false;

        if (stage.checkCanComplete && !stage.checkCanComplete(this.game, player)) {
            return false;
        }

        // Consume items if the stage demands it
        if (stage.consumeItems) {
            for (const itemId of stage.consumeItems) {
                const idx = player.inventory.findIndex(
                    i => i.id === itemId || i.familyId === itemId
                );
                if (idx === -1) {
                    // Can't consume — abort
                    return false;
                }
            }
            // All found — remove them
            for (const itemId of stage.consumeItems) {
                const idx = player.inventory.findIndex(
                    i => i.id === itemId || i.familyId === itemId
                );
                if (idx !== -1) player.removeFromInventory(player.inventory[idx]);
            }
        }

        this.advanceStage(player, questId, { completedByNpcId: npc?.id });
        return true;
    }

    // ─── Completion ─────────────────────────────────────────────────────────

    completeQuest(player, questId) {
        const idx = player.questData.active.findIndex(q => q.questId === questId);
        if (idx === -1) return false;

        const q = player.questData.active.splice(idx, 1)[0];
        player.questData.completed.push({
            questId,
            completedTurn: this.game.turnCount || 0
        });

        const def = this.getDef(questId);
        this.game.ui.log(`Quest complete: ${def.title}!`, 'success');

        // Rewards
        if (def.rewards) {
            this._grantRewards(player, def.rewards);
        }

        // Goal-system hook
        if (!player.goalsData) player.goalsData = {};
        player.goalsData.questCompleted = true;
        if (this.game.goalSystem) {
            this.game.goalSystem.checkGoals(player);
        }

        return true;
    }

    _grantRewards(player, rewards) {
        // Items
        if (rewards.items) {
            for (const { itemId, count } of rewards.items) {
                for (let i = 0; i < (count || 1); i++) {
                    const item = this.game.content.createItem(itemId);
                    if (item) {
                        player.addToInventory(item);
                        this.game.ui.log(`Received: ${item.name}`, 'info');
                    }
                }
            }
        }

        // Reputation
        if (rewards.reputation && player.factionStanding) {
            for (const [faction, delta] of Object.entries(rewards.reputation)) {
                if (player.factionStanding[faction] !== undefined) {
                    const old = player.factionStanding[faction];
                    player.factionStanding[faction] += delta;
                    this.game.ui.log(
                        `Reputation: ${faction} ${old} → ${player.factionStanding[faction]}`,
                        'info'
                    );
                }
            }
        }

        // XP
        if (rewards.xp && this.game.goalSystem) {
            this.game.goalSystem._awardXP(player, rewards.xp);
            this.game.ui.log(`Gained ${rewards.xp} XP.`, 'info');
        }
    }

    // ─── Flags ──────────────────────────────────────────────────────────────

    setFlag(player, flag, value = true) {
        if (!player.questData) this.initPlayer(player);
        player.questData.flags[flag] = value;
    }

    getFlag(player, flag) {
        return player.questData?.flags?.[flag] ?? false;
    }

    // ─── Active quest list for UI ───────────────────────────────────────────

    getActiveQuests(player) {
        return (player.questData?.active || []).map(q => {
            const def = this.getDef(q.questId);
            const stage = def?.stages?.[q.stageIndex];
            return {
                questId: q.questId,
                title: def?.title || q.questId,
                description: def?.description || '',
                stageIndex: q.stageIndex,
                stageText: stage?.description || 'Unknown objective',
                totalStages: def?.stages?.length || 0
            };
        });
    }

    getCompletedQuests(player) {
        return (player.questData?.completed || []).map(q => {
            const def = this.getDef(q.questId);
            return {
                questId: q.questId,
                title: def?.title || q.questId
            };
        });
    }

    // ─── Delivery request tracking ──────────────────────────────────────────

    registerDelivery(player, npc, itemId, label) {
        if (!player.questData) this.initPlayer(player);
        const existing = player.questData.knownDeliveries.find(
            d => d.npcId === npc.id && d.itemId === itemId
        );
        if (existing) return;
        player.questData.knownDeliveries.push({
            npcId: npc.id,
            npcName: npc.name,
            itemId,
            label,
            fulfilled: false
        });
    }

    fulfillDelivery(player, npc, itemId) {
        if (!player.questData) return;
        const del = player.questData.knownDeliveries.find(
            d => d.npcId === npc.id && d.itemId === itemId
        );
        if (del) del.fulfilled = true;
    }

    getActiveDeliveries(player) {
        return (player.questData?.knownDeliveries || []).filter(d => !d.fulfilled);
    }

    getCompletedDeliveries(player) {
        return (player.questData?.knownDeliveries || []).filter(d => d.fulfilled);
    }
}
