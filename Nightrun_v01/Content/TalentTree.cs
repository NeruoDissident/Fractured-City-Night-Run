using Nightrun.Entities;

namespace Nightrun.Content;

// ─────────────────────────────────────────────────────────────────────────────
// Talent tree data model
//
// A TalentTree has up to 5 tiers. Each tier holds one or more Talents. A Talent
// can be unlocked by spending TalentPoints if its tier prerequisites are met.
// Origin gates are enforced — each tree belongs to one or more Origins.
// Effect keys are free-form strings matched by systems that care about them.
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>One talent inside a tree. Unlockable by spending a TalentPoint.</summary>
public sealed record Talent(
    string Id,
    string Name,
    string Description,
    int    Tier,        // 1..5 — which tier of the tree this talent lives in
    int    Cost,        // talent points to unlock (usually 1)
    IReadOnlyDictionary<string, double> Effects);  // effect key → magnitude

/// <summary>A named tree of 1–5 tiers containing talents.</summary>
public sealed record TalentTree(
    string Id,
    string Name,
    string Description,
    Origin[] AllowedOrigins,     // Origins that may access this tree
    IReadOnlyList<Talent> Talents);

/// <summary>Static catalog of every talent tree in the game.</summary>
public static class TalentCatalog
{
    public static readonly IReadOnlyList<TalentTree> AllTrees;
    private static readonly Dictionary<string, TalentTree> _byId;
    private static readonly Dictionary<string, Talent>     _talents;

    static TalentCatalog()
    {
        AllTrees = BuildTrees();
        _byId    = AllTrees.ToDictionary(t => t.Id);
        _talents = AllTrees
            .SelectMany(t => t.Talents)
            .ToDictionary(t => t.Id);
    }

    public static TalentTree?  GetTree(string id)   => _byId.TryGetValue(id, out var t) ? t : null;
    public static Talent?      GetTalent(string id) => _talents.TryGetValue(id, out var t) ? t : null;

    /// <summary>All trees accessible to a given Origin.</summary>
    public static IReadOnlyList<TalentTree> TreesForOrigin(Origin o)
        => AllTrees.Where(t => t.AllowedOrigins.Contains(o)).ToList();

    // ── Tree definitions ──────────────────────────────────────────────────────

    private static IReadOnlyList<TalentTree> BuildTrees() => new TalentTree[]
    {
        // ── Flesh-only: Tinkering ───────────────────────────────────────────
        new("tinkering", "Tinkering",
            "Scavenge, craft, and improvise. The Flesh way: adapt or die.",
            new[] { Origin.Flesh },
            new Talent[]
            {
                new("tinker_1",    "Scrap Eye",
                    "You spot crafting materials others overlook. +15% chance to find an extra component when searching containers.",
                    Tier: 1, Cost: 1,
                    new Dictionary<string,double> { ["scrapFind"] = 0.15 }),

                new("tinker_2a",   "Quick Hands",
                    "Crafting takes less time. -1 turn to all craft actions (minimum 1).",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["craftTimeMod"] = -1 }),

                new("tinker_2b",   "Jury Rig",
                    "Improvised repairs are more effective. Weapon and armour durability restored at twice the rate.",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["repairMod"] = 2.0 }),

                new("tinker_3",    "Field Engineer",
                    "You can craft traps from scrap. Unlocks trap recipes in the crafting menu.",
                    Tier: 3, Cost: 1,
                    new Dictionary<string,double> { ["unlockTraps"] = 1 }),

                new("tinker_4",    "Master Fabricator",
                    "Crafted weapons deal +10% damage. Crafted armour has +10% durability.",
                    Tier: 4, Cost: 1,
                    new Dictionary<string,double> { ["craftDmgMod"] = 0.1, ["craftDurMod"] = 0.1 }),

                new("tinker_5",    "The Engineer",
                    "You can build deployable devices (turrets, barriers). Unlocks engineering recipes.",
                    Tier: 5, Cost: 2,
                    new Dictionary<string,double> { ["unlockEngineering"] = 1 }),
            }),

        // ── Flesh-only: Survival ────────────────────────────────────────────
        new("survival", "Survival",
            "Endure, adapt, outlast. The deep knowledge of staying alive when everything is trying to kill you.",
            new[] { Origin.Flesh },
            new Talent[]
            {
                new("surv_1",   "Tough Hide",
                    "Your body takes punishment better. +10 max blood (stacks with anatomy).",
                    Tier: 1, Cost: 1,
                    new Dictionary<string,double> { ["maxBloodBonus"] = 10 }),

                new("surv_2a",  "Fast Clotter",
                    "Your wounds seal faster. All wound clotting rates +25%.",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["clotMod"] = 1.25 }),

                new("surv_2b",  "Pain Resistance",
                    "Higher threshold before shock. Shock trigger raised by 15 pain.",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["shockThresholdBonus"] = 15 }),

                new("surv_3",   "Adrenaline",
                    "When critically wounded, gain a burst of speed. Action cost -20% for 5 turns after dropping below 25% blood.",
                    Tier: 3, Cost: 1,
                    new Dictionary<string,double> { ["adrenalineSpeed"] = 0.8, ["adrenalineTurns"] = 5 }),

                new("surv_4",   "Iron Constitution",
                    "Radiation, poison, and infections progress 40% slower.",
                    Tier: 4, Cost: 1,
                    new Dictionary<string,double> { ["statusResist"] = 0.4 }),

                new("surv_5",   "Unkillable",
                    "Once per run, survive a lethal blow with 1 blood remaining.",
                    Tier: 5, Cost: 2,
                    new Dictionary<string,double> { ["deathDodge"] = 1 }),
            }),

        // ── Flesh + Metal: Combat ───────────────────────────────────────────
        new("combat", "Combat",
            "Hit harder, hit smarter. Unlocked by all Origins.",
            new[] { Origin.Flesh, Origin.Metal, Origin.Echo },
            new Talent[]
            {
                new("combat_1",   "Brawler",
                    "Unarmed attacks deal +2 damage and have a 10% stagger chance.",
                    Tier: 1, Cost: 1,
                    new Dictionary<string,double> { ["unarmedDmgBonus"] = 2, ["unarmedStagger"] = 0.10 }),

                new("combat_2a",  "Power Strike",
                    "Once per turn, one melee attack deals double damage (costs 20 extra energy).",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["powerStrike"] = 1 }),

                new("combat_2b",  "Weapon Focus: Blunt",
                    "Blunt weapons stagger 15% more often and deal +1 damage.",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["bluntStaggerBonus"] = 0.15, ["bluntDmgBonus"] = 1 }),

                new("combat_3",   "Weapon Focus: Sharp",
                    "Sharp weapons have +10% crit chance and crit for x2.5 instead of x2.",
                    Tier: 3, Cost: 1,
                    new Dictionary<string,double> { ["sharpCritBonus"] = 0.10, ["sharpCritMult"] = 2.5 }),

                new("combat_4",   "Executioner",
                    "Attacks against targets below 30% blood deal +25% damage.",
                    Tier: 4, Cost: 1,
                    new Dictionary<string,double> { ["executionerThresh"] = 0.30, ["executionerMod"] = 0.25 }),

                new("combat_5",   "Zone of Carnage",
                    "After killing an enemy, all attacks deal +20% damage for 3 turns.",
                    Tier: 5, Cost: 2,
                    new Dictionary<string,double> { ["killingSpreeBonus"] = 0.20, ["killingSpreeturns"] = 3 }),
            }),

        // ── Metal-only: Cybernetics ─────────────────────────────────────────
        new("cybernetics", "Cybernetics",
            "Chrome and wire. Each node unlocks an implant slot or upgrade path.",
            new[] { Origin.Metal },
            new Talent[]
            {
                new("cyber_1",   "Subcutaneous Plating",
                    "Basic subdermal armour layer. -1 damage from all physical hits.",
                    Tier: 1, Cost: 1,
                    new Dictionary<string,double> { ["flatDmgReduction"] = 1 }),

                new("cyber_2a",  "Wired Reflexes I",
                    "Reflex booster. +5 Agility (effective), -5% action cost.",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["agiBonus"] = 5, ["actionCostMod"] = 0.95 }),

                new("cyber_2b",  "Myomer Muscle I",
                    "Synthetic muscle fibres. +4 Strength (effective).",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["strBonus"] = 4 }),

                new("cyber_3",   "Combat Optics",
                    "Targeting HUD. +3 Perception (effective), +5% hit chance.",
                    Tier: 3, Cost: 1,
                    new Dictionary<string,double> { ["perBonus"] = 3, ["hitChanceBonus"] = 0.05 }),

                new("cyber_4",   "Wired Reflexes II",
                    "Full nervous system overhaul. -15% action cost, +8 Agility (total with tier 2).",
                    Tier: 4, Cost: 1,
                    new Dictionary<string,double> { ["agiBonus"] = 8, ["actionCostMod"] = 0.85 }),

                new("cyber_5",   "Ghost Frame",
                    "Full body chassis. Immune to bleed, +2 flat damage reduction, ignores stagger.",
                    Tier: 5, Cost: 2,
                    new Dictionary<string,double> { ["bleedImmune"] = 1, ["flatDmgReduction"] = 2, ["staggeImmune"] = 1 }),
            }),

        // ── Echo-only: Resonance ────────────────────────────────────────────
        new("resonance", "Resonance",
            "Echo abilities. Each unlock adds a usable power — and raises your Instability cap.",
            new[] { Origin.Echo },
            new Talent[]
            {
                new("echo_1",    "Signal Sense",
                    "Passive. You sense life signs through walls in a 3-tile radius.",
                    Tier: 1, Cost: 1,
                    new Dictionary<string,double> { ["lifeSenseRadius"] = 3 }),

                new("echo_2a",   "Phase Dart",
                    "Active. Fire a bolt of Echo energy. 10 Instability. Ignores armour.",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["unlockPhaseDart"] = 1 }),

                new("echo_2b",   "Static Veil",
                    "Active. Briefly disrupt NPC detection. NPCs within 6 tiles reset to Unaware. 15 Instability.",
                    Tier: 2, Cost: 1,
                    new Dictionary<string,double> { ["unlockStaticVeil"] = 1 }),

                new("echo_3",    "Echo Step",
                    "Active. Teleport up to 5 tiles to any visible open floor tile. 20 Instability.",
                    Tier: 3, Cost: 1,
                    new Dictionary<string,double> { ["unlockEchoStep"] = 1 }),

                new("echo_4",    "Overclock",
                    "Active. Move and act at double speed for 3 turns. 30 Instability.",
                    Tier: 4, Cost: 1,
                    new Dictionary<string,double> { ["unlockOverclock"] = 1 }),

                new("echo_5",    "Fragmentation Edge",
                    "Passive. At 80+ Instability your attacks deal +30% damage. Run ends at 100.",
                    Tier: 5, Cost: 2,
                    new Dictionary<string,double> { ["fragEdgeThresh"] = 80, ["fragEdgeBonus"] = 0.30 }),
            }),
    };
}
