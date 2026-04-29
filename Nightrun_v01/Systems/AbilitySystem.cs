using Nightrun.Content;
using Nightrun.Entities;

namespace Nightrun.Systems;
// TalentEffects is in Nightrun.Content — already imported above

/// <summary>
/// Result of a <see cref="AbilitySystem.Execute"/> call — mirrors
/// <see cref="AttackResult"/> but extended for multi-strike and special effects.
/// </summary>
public readonly record struct AbilityResult(
    bool   Used,            // false = failed prerequisite / on cooldown
    bool   Hit,
    int    TotalDamage,
    string? FailReason,     // non-null when Used=false
    IReadOnlyList<string> Log);

/// <summary>
/// Drives combat ability execution. Pure system — no rendering.
///
/// Scalability notes:
///   • Adding a new ability = add a record to <see cref="AbilityCatalog.All"/>
///     using existing effect kinds. No code changes here.
///   • Adding a new effect kind = add a case to <see cref="ApplyEffects"/> and
///     document the kind in <c>AbilityCatalog.cs</c>.
///   • Active effects and cooldowns live on <see cref="Entity"/> so NPCs can
///     also use abilities in the future with zero extra work.
/// </summary>
public sealed class AbilitySystem
{
    private readonly CombatSystem    _combat;
    private readonly Random          _rng;
    private readonly Action<string>  _log;

    public AbilitySystem(CombatSystem combat, Random rng, Action<string> log)
    {
        _combat = combat; _rng = rng; _log = log;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /// <summary>
    /// Try to execute <paramref name="ability"/> by <paramref name="user"/>
    /// against <paramref name="target"/>. Validates prerequisites (talent,
    /// weapon type, stats, cooldown) before resolving effects.
    /// </summary>
    public AbilityResult Execute(Entity user, Entity target, Ability ability)
    {
        // ── Prerequisite checks ──
        if (user.Cooldowns.TryGetValue(ability.Id, out int cd) && cd > 0)
            return Fail($"{ability.Name} is on cooldown ({cd} turns).");

        string weaponType = CombatSystem.GetAttackType(user.ActiveWeapon);

        if (ability.AttackType != null && ability.AttackType != weaponType)
            return Fail($"{ability.Name} requires a {ability.AttackType} weapon.");

        if (ability.TalentId != null && user is Player p && !p.HasTalent(ability.TalentId))
            return Fail($"{ability.Name} requires talent '{ability.TalentId}'.");

        foreach (var req in ability.StatReqs)
        {
            int val = GetStat(user, req.Stat);
            if (val < req.Min)
                return Fail($"{ability.Name} requires {req.Stat} {req.Min} (you have {val}).");
        }

        // ── Resolve ──
        var msgs   = new List<string>();
        int strikes = 1;
        double damageMult  = 1.0;
        double bleedMult   = 1.0;
        bool   bypassArmor = false;
        bool   forceArterial = false;
        bool   targetWounded = false;
        string? forceRegion = null;
        var effectsToApply = new List<(string id, int turns, bool onSelf)>();
        double selfDamagePct = 0;
        bool   doDisarm = false;
        double painSpikeMult = 1.0;
        int    instabilityCost = 0;

        // First pass: read non-damage modifiers
        foreach (var eff in ability.Effects)
        {
            switch (eff.Kind)
            {
                case "multi_strike":      strikes        = Math.Max(1, (int)eff.Value); break;
                case "damage_mult":       damageMult     = eff.Value;                   break;
                case "bleed_mult":        bleedMult      = eff.Value;                   break;
                case "bypass_armor":      bypassArmor    = true;                        break;
                case "force_arterial":    forceArterial  = true;                        break;
                case "target_wounded":    targetWounded  = true;                        break;
                case "hit_mod":           /* handled per-strike below */               break;
                case "target_region":     forceRegion    = eff.StringValue;             break;
                case "self_damage_pct":   selfDamagePct  = eff.Value;                  break;
                case "disarm":            doDisarm       = true;                        break;
                case "pain_spike":        painSpikeMult  = eff.Value;                  break;
                case "instability_cost":  instabilityCost = (int)eff.Value;            break;
                case "apply_effect":
                    bool onSelf = eff.StringValue.EndsWith("_self");
                    string effId = onSelf ? eff.StringValue[..^5] : eff.StringValue;
                    effectsToApply.Add((effId, (int)eff.Value2, onSelf));
                    break;
            }
        }

        // Echo Instability cost — deduct before execution, fail if it would fragment
        if (instabilityCost > 0 && user is Player echoPl)
        {
            bool shattered = echoPl.AddInstability(instabilityCost);
            if (echoPl.Instability > 0)
                _log($"Instability: {echoPl.Instability}/{echoPl.MaxInstability}");
            if (shattered)
            {
                _log("Your mind FRAGMENTS — the resonance tears you apart!");
                // Mark the player as dead via anatomy catastrophic brain damage
                echoPl.Anatomy?.AddWound("brain", 999, "internal");
                return new AbilityResult(Used: true, Hit: false, TotalDamage: 0,
                    FailReason: null, Log: new[] { "Instability overload — run ends!" });
            }
        }

        // Hit modifier
        double hitMod = 0;
        foreach (var eff in ability.Effects)
            if (eff.Kind == "hit_mod") hitMod += eff.Value;

        int totalDamage = 0;
        bool anyHit = false;

        for (int s = 0; s < strikes; s++)
        {
            var result = _combat.ResolveAbilityStrike(
                user, target, user.ActiveWeapon,
                damageMult, bleedMult, hitMod,
                bypassArmor, forceArterial, forceRegion, targetWounded, painSpikeMult);

            if (result.Hit)
            {
                anyHit = true;
                totalDamage += result.Damage;

                if (doDisarm && target.ActiveWeapon != null)
                {
                    target.Equipment.RHand = null;
                    msgs.Add($"{target.Name}'s weapon is knocked away!");
                }
            }
        }

        // Apply active effects regardless of hit (grapple on miss = realistic)
        if (anyHit || ability.PreferredStance == "any")
        {
            foreach (var (effId, turns, onSelf) in effectsToApply)
            {
                if (effId == "prone_self")
                {
                    user.ApplyEffect("prone", turns);
                    msgs.Add($"You are knocked prone!");
                }
                else
                {
                    target.ApplyEffect(effId, turns);
                    string dispName = target is Player ? "You are" : $"{target.Name} is";
                    msgs.Add(FormatEffectMessage(dispName, effId, turns));
                }
            }
        }

        // Self damage
        if (anyHit && selfDamagePct > 0 && totalDamage > 0 && user.Anatomy != null)
        {
            int selfDmg = Math.Max(1, (int)(totalDamage * selfDamagePct));
            user.Anatomy.AddPain(selfDmg, 0);
            msgs.Add($"You take {selfDmg} damage from the impact!");
        }

        // Start cooldown
        user.Cooldowns[ability.Id] = ability.Cooldown;

        string hdr = anyHit
            ? $"[{ability.Name}] {(user is Player ? "You use" : user.Name + " uses")} {ability.Name}!"
            : $"[{ability.Name}] {ability.Name} misses!";
        msgs.Insert(0, hdr);

        foreach (var m in msgs) _log(m);

        return new AbilityResult(Used: true, Hit: anyHit, TotalDamage: totalDamage,
            FailReason: null, Log: msgs);
    }

    /// <summary>
    /// Decrement all cooldowns and active effects on <paramref name="entity"/> by one turn.
    /// Call this once per entity per game tick.
    /// </summary>
    public static void TickEntity(Entity entity)
    {
        // Cooldowns
        foreach (var key in entity.Cooldowns.Keys.ToList())
        {
            entity.Cooldowns[key]--;
            if (entity.Cooldowns[key] <= 0)
                entity.Cooldowns.Remove(key);
        }

        // Active effects
        foreach (var key in entity.ActiveEffects.Keys.ToList())
        {
            entity.ActiveEffects[key]--;
            if (entity.ActiveEffects[key] <= 0)
                entity.ActiveEffects.Remove(key);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static AbilityResult Fail(string reason)
        => new(Used: false, Hit: false, TotalDamage: 0, FailReason: reason, Log: Array.Empty<string>());

    private static int GetStat(Entity e, string stat) => stat switch
    {
        "Strength"     => e.Stats.Strength     + (int)TalentEffects.Get(e, "strBonus"),
        "Agility"      => e.Stats.Agility      + (int)TalentEffects.Get(e, "agiBonus"),
        "Endurance"    => e.Stats.Endurance,
        "Intelligence" => e.Stats.Intelligence,
        "Perception"   => e.Stats.Perception   + (int)TalentEffects.Get(e, "perBonus"),
        _              => 0,
    };

    private static string FormatEffectMessage(string subject, string effId, int turns) => effId switch
    {
        "stunned"         => $"{subject} stunned for {turns} turn(s)!",
        "prone"           => $"{subject} knocked prone for {turns} turn(s)!",
        "guard_break"     => $"{subject} guard broken for {turns} turn(s)!",
        "grappled"        => $"{subject} grappled — suffocating!",
        "slowed"          => $"{subject} slowed for {turns} turn(s)!",
        "impaired_vision" => $"{subject} vision is impaired for {turns} turn(s)!",
        "pain_spike"      => $"{subject} wracked with pain!",
        _                 => $"{subject} affected by {effId} for {turns} turn(s)!",
    };

    // Placeholder — keeps the list of abilities a player can currently see/use.
    /// <summary>
    /// Returns all abilities valid for <paramref name="player"/>'s current weapon,
    /// regardless of cooldown or stat requirements. Used by the UI to show the
    /// full ability list with locked/available/cooldown indicators.
    /// </summary>
    public static IReadOnlyList<Ability> AvailableAbilities(Player player)
    {
        string wpType = CombatSystem.GetAttackType(player.ActiveWeapon);
        return AbilityCatalog.All
            .Where(a => a.AttackType == null || a.AttackType == wpType)
            .ToList();
    }
}
