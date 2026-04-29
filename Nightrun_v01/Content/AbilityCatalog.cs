namespace Nightrun.Content;

// ─────────────────────────────────────────────────────────────────────────────
// Ability system data layer — F7
//
// An Ability is a special combat action gated behind:
//   • A talent-tree unlock (TalentId)
//   • A weapon-type requirement (AttackType: "blunt" | "sharp" | "unarmed" | null=any)
//   • Optional stat minimums (StatReqs dictionary)
//
// Execution is data-driven: AbilitySystem reads the Effect list and applies
// each entry in sequence. Adding a new ability = adding an entry here.
// No code changes needed in AbilitySystem for new abilities that use existing
// effect kinds.
//
// Effect kinds currently supported:
//   damage_mult      — multiply base damage by Value
//   hit_mod          — add Value% to hit chance for this attack
//   target_region    — force hit location to StringValue region
//   target_wounded   — force hit to a wounded body part if one exists
//   bleed_mult       — multiply bleed severity by Value
//   force_arterial   — if bleed occurs, make it arterial
//   bypass_armor     — ignore armor mitigation entirely
//   multi_strike     — strike Value times (each at base hit chance)
//   apply_effect     — apply active effect StringValue for (int)Value2 turns on target
//   self_damage_pct  — deal Value% of inflicted damage back to self
//   heal_self        — restore Value blood to self on hit
//   disarm           — knock weapon from target's hand on hit
// ─────────────────────────────────────────────────────────────────────────────

/// <summary>
/// One entry in an ability's effect list. The <see cref="AbilitySystem"/>
/// reads these in order to resolve what happens when the ability connects.
/// </summary>
public sealed record AbilityEffect(
    string Kind,           // effect kind string (see header above)
    double Value  = 0,     // primary numeric param
    double Value2 = 0,     // secondary numeric param (e.g. duration)
    string StringValue = "");  // string param (e.g. region name, effect id)

/// <summary>
/// Stat prerequisite. The player must have at least <see cref="Min"/> in
/// <see cref="Stat"/> before the ability can be used.
/// </summary>
public sealed record StatReq(string Stat, int Min);

/// <summary>
/// One combat ability. Pure data — no logic here.
/// Add new abilities by adding entries to <see cref="AbilityCatalog.All"/>.
/// </summary>
public sealed record Ability(
    string Id,
    string Name,
    string Description,
    string? TalentId,          // talent that unlocks this ability (null = always available)
    string? AttackType,        // "blunt" | "sharp" | "unarmed" | null (any weapon)
    string PreferredStance,    // "aggressive" | "defensive" | "opportunistic" | "any"
    int    ActionCost,         // energy cost (100 = normal attack baseline)
    int    Cooldown,           // turns before it can be used again
    IReadOnlyList<StatReq>       StatReqs,
    IReadOnlyList<AbilityEffect> Effects);

/// <summary>
/// Static catalog of all abilities. Extend freely — AbilitySystem needs no
/// changes for abilities that use existing effect kinds.
/// </summary>
public static class AbilityCatalog
{
    public static readonly IReadOnlyList<Ability> All;
    private static readonly Dictionary<string, Ability> _byId;

    static AbilityCatalog()
    {
        All   = Build();
        _byId = All.ToDictionary(a => a.Id);
    }

    public static Ability? Get(string id) => _byId.TryGetValue(id, out var a) ? a : null;

    /// <summary>All abilities usable with a given attack type (null = any weapon).</summary>
    public static IReadOnlyList<Ability> ForWeaponType(string attackType)
        => All.Where(a => a.AttackType == null || a.AttackType == attackType).ToList();

    // ─────────────────────────────────────────────────────────────────────────
    // Ability definitions — port of AbilitySystem.js ABILITY_DATA
    // ─────────────────────────────────────────────────────────────────────────

    private static IReadOnlyList<Ability> Build() => new Ability[]
    {
        // ── Sharp ──────────────────────────────────────────────────────────
        // Lunge: a precise thrust that slips past armour.
        // Purpose — the sharp weapon's identity is *penetration*. This
        // gives knife/shiv users a way to punish armoured targets.
        new("lunge", "Lunge",
            "Drive your blade forward in a precise thrust that bypasses armour.",
            TalentId: null, AttackType: "sharp", PreferredStance: "aggressive",
            ActionCost: 130, Cooldown: 3,
            StatReqs: new[] { new StatReq("Agility", 10) },
            Effects: new AbilityEffect[]
            {
                new("bypass_armor"),
                new("damage_mult", Value: 0.8),
                new("bleed_mult",  Value: 1.5),
            }),

        // ── Blunt ──────────────────────────────────────────────────────────
        // Skull Crack: an overhead smash targeting the head. Can stun.
        // Purpose — the blunt weapon's identity is *impact & stagger*. This
        // gives club/pipe users a targeted high-risk, high-reward swing.
        new("skull_crack", "Skull Crack",
            "An overhead smash aimed at the skull. Hard to land but can stun.",
            TalentId: null, AttackType: "blunt", PreferredStance: "aggressive",
            ActionCost: 150, Cooldown: 3,
            StatReqs: new[] { new StatReq("Strength", 10) },
            Effects: new AbilityEffect[]
            {
                new("target_region", StringValue: "head"),
                new("hit_mod",       Value: -10),
                new("damage_mult",   Value: 1.3),
                new("apply_effect",  StringValue: "stunned", Value: 1, Value2: 1),
            }),

        // ── Unarmed ────────────────────────────────────────────────────────
        // Grapple: grab the target and choke. Applies grappled (suffocation).
        // Purpose — the unarmed identity is *control & attrition*. This
        // gives bare-handed fighters a way to neutralise a target over time.
        new("grapple", "Grapple",
            "Grab the target by the throat. They take suffocation damage each turn until they break free.",
            TalentId: null, AttackType: "unarmed", PreferredStance: "aggressive",
            ActionCost: 150, Cooldown: 4,
            StatReqs: new[] { new StatReq("Strength", 10) },
            Effects: new AbilityEffect[]
            {
                new("damage_mult", Value: 0.3),
                new("apply_effect", StringValue: "grappled", Value: 2, Value2: 2),
            }),
    };
}
