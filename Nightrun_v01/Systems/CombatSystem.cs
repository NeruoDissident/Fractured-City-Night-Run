using Nightrun.Content;
using Nightrun.Entities;

namespace Nightrun.Systems;

/// <summary>
/// Result of a single <see cref="CombatSystem.ResolveAttack"/> call. The caller
/// (player input, NPC AI) uses this to decide follow-up actions and to check
/// whether the target was killed on this swing.
/// </summary>
public readonly record struct AttackResult(
    bool   Hit,
    int    Damage,
    string? BodyPart,
    string? Region,
    bool   Critical,
    bool   Killed,
    int    Blocked,
    bool   Staggered,
    bool   Parried);

/// <summary>
/// Resolves melee attacks between two <see cref="Entity"/> combatants using
/// the body-region targeting system, armor mitigation, wound creation, and
/// anatomy-aware damage. 1:1 port of <c>src/systems/CombatSystem.js</c>,
/// minus the pieces that require unported systems (abilities, stances,
/// combat-effects overlay).
/// </summary>
public sealed class CombatSystem
{
    private readonly Random                _rng;
    private readonly Func<int>             _getTurn;
    private readonly Action<string, byte>  _log;

    public CombatSystem(Random rng, Func<int> getTurn, Action<string> log)
    {
        _rng = rng; _getTurn = getTurn;
        // Wrap plain Action<string> so callers don't need to change
        _log = (msg, _) => log(msg);
    }

    public CombatSystem(Random rng, Func<int> getTurn, Action<string, byte> colorLog)
    {
        _rng = rng; _getTurn = getTurn; _log = colorLog;
    }

    // =====================================================================
    // Static targeting tables — mirror JS module-level constants
    // =====================================================================

    private readonly record struct RegionWeight(string Region, int Weight);

    private readonly record struct SubPart(
        string  Part,
        string? Path,          // null = glancing hit, no specific organ
        int     Weight,
        bool    Vital = false,
        string? DisplayName = null);

    private static readonly RegionWeight[] TargetingBlunt =
    {
        new("head",     20),
        new("torso",    30),
        new("leftArm",  15),
        new("rightArm", 15),
        new("leftLeg",  10),
        new("rightLeg", 10),
    };
    private static readonly RegionWeight[] TargetingSharp =
    {
        new("head",      5),
        new("torso",    45),
        new("leftArm",  18),
        new("rightArm", 18),
        new("leftLeg",   7),
        new("rightLeg",  7),
    };
    private static readonly RegionWeight[] TargetingUnarmed =
    {
        new("head",     25),
        new("torso",    35),
        new("leftArm",  10),
        new("rightArm", 10),
        new("leftLeg",  10),
        new("rightLeg", 10),
    };

    private static readonly Dictionary<string, SubPart[]> RegionParts = new()
    {
        ["head"] = new[]
        {
            // Surface parts absorb most hits
            new SubPart("skull",     "head.skull",     35, false, "skull"),
            new SubPart("face",      "head.face",      25, false, "face"),
            new SubPart("jaw",       "head.jaw",       15),
            new SubPart("leftEar",   "head.ears.0",    8,  false, "left ear"),
            new SubPart("rightEar",  "head.ears.1",    8,  false, "right ear"),
            // Organs — rare to hit directly
            new SubPart("leftEye",   "head.eyes.0",    3,  false, "left eye"),
            new SubPart("rightEye",  "head.eyes.1",    3,  false, "right eye"),
            new SubPart("brain",     "head.brain",     3,  true),
        },
        ["torso"] = new[]
        {
            // Surface parts absorb most hits
            new SubPart("chest",       "torso.chest",       30, false, "chest"),
            new SubPart("ribs",        "torso.ribs",        25, false, "ribs"),
            new SubPart("abdomen",     "torso.abdomen",     25, false, "abdomen"),
            // Organs — rare to hit directly on a normal swing
            new SubPart("stomach",     "torso.stomach",      8, true),
            new SubPart("leftLung",    "torso.lungs.0",      3, true, "left lung"),
            new SubPart("rightLung",   "torso.lungs.1",      3, true, "right lung"),
            new SubPart("liver",       "torso.liver",        3, true),
            new SubPart("leftKidney",  "torso.kidneys.0",    1, true, "left kidney"),
            new SubPart("rightKidney", "torso.kidneys.1",    1, true, "right kidney"),
            new SubPart("heart",       "torso.heart",        1, true),
        },
        ["leftArm"] = new[]
        {
            new SubPart("leftArm",     "leftArm.arm",   50, false, "left arm"),
            new SubPart("leftHand",    "leftArm.hand",  30, false, "left hand"),
            new SubPart("leftFingers", null,            20, false, "left fingers"),
        },
        ["rightArm"] = new[]
        {
            new SubPart("rightArm",     "rightArm.arm",   50, false, "right arm"),
            new SubPart("rightHand",    "rightArm.hand",  30, false, "right hand"),
            new SubPart("rightFingers", null,             20, false, "right fingers"),
        },
        ["leftLeg"] = new[]
        {
            new SubPart("leftLeg",  "leftLeg.leg",  65, false, "left leg"),
            new SubPart("leftFoot", "leftLeg.foot", 35, false, "left foot"),
        },
        ["rightLeg"] = new[]
        {
            new SubPart("rightLeg",  "rightLeg.leg",  65, false, "right leg"),
            new SubPart("rightFoot", "rightLeg.foot", 35, false, "right foot"),
        },
    };

    // Equipment-slot → body regions it covers for armor purposes
    private static readonly Dictionary<BodySlot, string[]> ArmorCoverage = new()
    {
        [BodySlot.Head]  = new[] { "head" },
        [BodySlot.Torso] = new[] { "torso" },
        [BodySlot.Legs]  = new[] { "leftLeg", "rightLeg" },
        [BodySlot.LHand] = new[] { "leftArm" },
        [BodySlot.RHand] = new[] { "rightArm" },
        [BodySlot.Back]  = new[] { "torso" },
        [BodySlot.Feet]  = new[] { "leftLeg", "rightLeg" },
    };

    // =====================================================================
    // Log templates (picked at random per message)
    // =====================================================================

    private static readonly Dictionary<string, string[]> VerbsLight = new()
    {
        ["blunt"]   = new[] { "taps", "bumps", "nudges", "clips" },
        ["sharp"]   = new[] { "nicks", "scratches", "grazes", "pricks" },
        ["unarmed"] = new[] { "flicks", "jabs", "pokes", "swats" },
    };
    private static readonly Dictionary<string, string[]> VerbsMedium = new()
    {
        ["blunt"]   = new[] { "strikes", "hits", "cracks", "smacks", "bashes", "whacks", "thumps", "clubs" },
        ["sharp"]   = new[] { "cuts", "slashes", "slices", "stabs", "carves", "gouges" },
        ["unarmed"] = new[] { "punches", "strikes", "elbows", "knees", "kicks", "headbutts" },
    };
    private static readonly Dictionary<string, string[]> VerbsHeavy = new()
    {
        ["blunt"]   = new[] { "crushes", "slams", "hammers", "demolishes", "clobbers", "pulverizes" },
        ["sharp"]   = new[] { "cleaves", "hacks", "rips into", "tears open", "shreds" },
        ["unarmed"] = new[] { "pummels", "wallops", "decks", "pile-drives", "hammers" },
    };

    private static readonly string[] AttackTemplates =
    {
        "{a} {verb} {t} in the {p} with {w} for {d} damage.",
        "{a} {verb} {t} on the {p} with {w} — {d} damage!",
        "{a} lands a hit on {t}'s {p} with {w} for {d} damage.",
        "{a} drives {w} into {t}'s {p} — {d} damage!",
        "{w} connects with {t}'s {p} as {a} attacks — {d} damage.",
    };
    private static readonly string[] AttackTemplatesUnarmed =
    {
        "{a} {verb} {t} in the {p} for {d} damage.",
        "{a} {verb} {t} on the {p} — {d} damage!",
        "{a} lands a bare-fisted hit on {t}'s {p} for {d} damage.",
        "{a} catches {t} in the {p} — {d} damage!",
    };
    private static readonly string[] MissTemplates =
    {
        "{a} swings at {t} and misses!",
        "{a} lunges at {t} but hits nothing but air.",
        "{t} dodges {a}'s attack.",
        "{a}'s attack goes wide.",
        "{a} swings wildly at {t} — miss!",
    };
    private static readonly string[] BlockTemplates =
    {
        "{t}'s {armor} absorbs the blow — {blocked} damage blocked.",
        "{a} hits {t}'s {armor}, which absorbs {blocked} of the impact.",
        "The hit glances off {t}'s {armor} — {blocked} damage mitigated.",
    };
    private static readonly string[] StaggerTemplates =
    {
        "The blow staggers {t} — they lose their footing!",
        "{t} reels from the impact, stunned!",
        "A bone-rattling hit leaves {t} dazed!",
        "{t} stumbles, knocked off balance by the force!",
    };
    private static readonly string[] ParryTemplates =
    {
        "{t} deflects the blow with their {w}!",
        "{t} parries with their {w} — the attack glances off!",
        "Steel meets steel as {t} blocks with their {w}!",
        "{t}'s {w} catches the strike and turns it aside!",
    };
    private static readonly string[] CriticalTemplates =
    {
        "Critical hit! {a} {verb} {t} square in the {p} with {w} — {d} damage!",
        "A devastating blow! {a} {verb} {t}'s {p} with {w} for {d} damage!",
        "{a} finds an opening and {verb} {t} right in the {p} — {d} damage!",
    };
    private static readonly string[] PartDestroyedTemplates =
    {
        "{t}'s {p} gives out from the damage!",
        "{t}'s {p} is mangled beyond use!",
        "The blow ruins {t}'s {p}!",
    };
    private static readonly string[] KillTemplates =
    {
        "{t} crumples to the ground, dead.",
        "{t} collapses in a heap.",
        "{t} slumps over, lifeless.",
        "{t} drops dead.",
        "{t} falls and doesn't get back up.",
    };
    private static readonly Dictionary<string, string[]> WoundTemplates = new()
    {
        ["cut"] = new[]
        {
            "Blood wells from a cut on {t}'s {p}.",
            "A gash opens on {t}'s {p}, bleeding freely.",
            "{t}'s {p} is sliced open — blood flows.",
        },
        ["laceration"] = new[]
        {
            "{t}'s {p} is torn open — a nasty laceration.",
            "A ragged wound opens across {t}'s {p}.",
            "Flesh tears on {t}'s {p}, blood seeping out.",
        },
        ["puncture"] = new[]
        {
            "The blade sinks deep into {t}'s {p} — blood wells up.",
            "{t}'s {p} is punctured — dark blood seeps out.",
            "A deep stab wound in {t}'s {p} bleeds steadily.",
        },
        ["arterial"] = new[]
        {
            "Blood sprays from {t}'s {p} — an artery is hit!",
            "Bright red blood pulses from {t}'s {p}!",
            "A deep wound on {t}'s {p} gushes blood!",
        },
        ["internal"] = new[]
        {
            "{t} coughs blood — internal damage to the {p}.",
            "Something ruptures inside {t}'s {p}.",
            "{t} staggers — internal bleeding from the {p}.",
        },
    };

    // =====================================================================
    // Main entry — resolve an attack
    // =====================================================================

    /// <summary>
    /// Resolve a single strike driven by an ability. Accepts modifiers from
    /// <see cref="Nightrun.Systems.AbilitySystem"/>: damage multiplier, bleed
    /// multiplier, hit-chance offset, armour bypass, forced arterial, forced
    /// region override, and target-wounded redirect.
    /// </summary>
    public AttackResult ResolveAbilityStrike(
        Entity attacker, Entity target, Item? weapon,
        double damageMult, double bleedMult, double hitMod,
        bool bypassArmor, bool forceArterial, string? forceRegion,
        bool targetWounded, double painMult = 1.0)
    {
        string attackerName     = GetDisplayName(attacker, true);
        string targetName       = GetDisplayName(target, false);
        bool   attackerIsPlayer = attacker is Player;
        string attackType       = GetAttackType(weapon);

        // Hit roll with ability modifier
        double hitChance = CalculateHitChance(attacker, target, weapon) + hitMod;
        hitChance = Math.Max(10, Math.Min(95, hitChance));
        if (_rng.NextDouble() * 100 > hitChance)
        {
            LogMiss(attackerName, targetName);
            return new AttackResult(false, 0, null, null, false, false, 0, false, false);
        }

        // Hit location — ability may override region
        var loc = forceRegion != null
            ? ForcedHitLocation(forceRegion)
            : targetWounded
                ? WoundedHitLocation(target) ?? RollHitLocation(weapon)
                : RollHitLocation(weapon);

        // Crit
        double critChance = CalculateCritChance(attacker, weapon);
        bool isCritical = _rng.NextDouble() * 100 < critChance;

        string partDisplay = loc.subPart.DisplayName ?? loc.subPart.Part;

        // Damage
        int damage = RollWeaponDamage(weapon, attacker);
        if (isCritical) damage = (int)Math.Floor(damage * 1.5);
        damage = (int)Math.Floor(damage * damageMult);

        // Armor
        int finalDamage;
        int blocked;
        if (bypassArmor)
        {
            finalDamage = Math.Max(1, damage);
            blocked     = 0;
        }
        else
        {
            var armor = CalculateArmor(target, loc.region);
            finalDamage = Math.Max(1, damage - armor.Reduction);
            blocked     = damage - finalDamage;
            if (blocked > 0 && armor.Name != null)
                LogBlock(attackerName, targetName, armor.Name, blocked);
        }

        // Anatomy damage
        var partRes = ApplyAnatomyDamage(target, loc.subPart, finalDamage, attackType);

        // Wounds — modified by bleedMult and forceArterial
        if (target.Anatomy != null)
        {
            bool isVital = loc.subPart.Vital;
            if (attackType == "sharp")
            {
                double bleedChance = weapon?.BleedChance ?? 0.40;
                if (isVital) bleedChance = Math.Max(bleedChance, 0.80);
                if (_rng.NextDouble() < bleedChance || isCritical)
                {
                    double severity = isCritical ? finalDamage * 0.8 : finalDamage * 0.5;
                    severity *= bleedMult;
                    if (isVital) severity *= 1.5;
                    string woundType = forceArterial || (isVital && (isCritical || _rng.NextDouble() < 0.25))
                        ? "arterial"
                        : isVital ? "puncture"
                        : _rng.NextDouble() < 0.5 ? "cut" : "laceration";
                    target.Anatomy.AddWound(partDisplay, severity, woundType);
                    LogWound(targetName, partDisplay, woundType);
                }
            }
            double painAmt = finalDamage * painMult;
            target.Anatomy.AddPain((int)painAmt, _getTurn());
        }

        if (isCritical) LogCritical(attackerName, targetName, weapon?.Name, partDisplay, finalDamage, attackType, attackerIsPlayer);
        else            LogAttack  (attackerName, targetName, weapon?.Name, partDisplay, finalDamage, attackType, attackerIsPlayer);

        if (partRes.Destroyed) LogPartDestroyed(targetName, partDisplay);

        bool killed = target.Anatomy?.IsDead() ?? false;
        if (killed) LogKill(targetName, target);

        return new AttackResult(
            Hit: true, Damage: finalDamage, BodyPart: partDisplay, Region: loc.region,
            Critical: isCritical, Killed: killed, Blocked: blocked, Staggered: false, Parried: false);
    }

    /// <summary>Force a hit into a specific region but roll among its sub-parts.</summary>
    private (string region, SubPart subPart) ForcedHitLocation(string region)
    {
        if (!RegionParts.TryGetValue(region, out var parts) || parts.Length == 0)
            return RollHitLocation(null);
        return (region, WeightedSubPart(parts));
    }

    /// <summary>
    /// If the target has any wounded body part, redirect the hit there.
    /// Returns null if no wounded part found.
    /// </summary>
    private (string region, SubPart subPart)? WoundedHitLocation(Entity target)
    {
        if (target.Anatomy == null) return null;
        var wounds = target.Anatomy.GetWoundedParts();
        if (wounds.Count == 0) return null;
        // Pick a random wounded part name and map it back to a region/subpart
        string partName = wounds[_rng.Next(wounds.Count)];
        foreach (var kv in RegionParts)
        {
            foreach (var sp in kv.Value)
            {
                if ((sp.DisplayName ?? sp.Part).Equals(partName, StringComparison.OrdinalIgnoreCase))
                    return (kv.Key, sp);
            }
        }
        return null;
    }

    public AttackResult ResolveAttack(Entity attacker, Entity target, Item? weapon)
    {
        string attackerName = GetDisplayName(attacker, true);
        string targetName   = GetDisplayName(target, false);
        bool   attackerIsPlayer = attacker is Player;

        string attackType = GetAttackType(weapon);

        // ── Hit roll ──
        double hitChance = CalculateHitChance(attacker, target, weapon);
        double hitRoll = _rng.NextDouble() * 100;

        if (hitRoll > hitChance)
        {
            LogMiss(attackerName, targetName);
            return new AttackResult(false, 0, null, null, false, false, 0, false, false);
        }

        // ── Hit location ──
        var loc = RollHitLocation(weapon);

        // ── Crit roll ──
        double critChance = CalculateCritChance(attacker, weapon);
        bool isCritical = _rng.NextDouble() * 100 < critChance;

        // ── Weapon parry (sharp on head/torso hits) ──
        if ((loc.region == "head" || loc.region == "torso") && !isCritical)
        {
            var parry = CheckParry(target);
            if (parry.Success)
            {
                LogParry(targetName, parry.WeaponName!);
                return new AttackResult(false, 0, null, null, false, false, 0, false, true);
            }
        }

        // ── Arm intercept ──
        if ((loc.region == "head" || loc.region == "torso") && target.Anatomy != null && !isCritical)
        {
            double intercept = GetArmInterceptChance(target);
            if (_rng.NextDouble() < intercept)
            {
                var armLoc = PickInterceptArm(target);
                if (armLoc != null)
                {
                    string origPart = loc.subPart.DisplayName ?? loc.subPart.Part;
                    loc = armLoc.Value;
                    string armName = loc.subPart.DisplayName ?? loc.subPart.Part;
                    _log($"{targetName} blocks with their {armName}, shielding their {origPart}!", 51);
                }
            }
        }

        string partDisplay = loc.subPart.DisplayName ?? loc.subPart.Part;

        // ── Damage roll ──
        int damage = RollWeaponDamage(weapon, attacker);
        if (isCritical)
        {
            // sharpCritMult talent: higher crit multiplier for sharp weapons
            double critMult = 1.5;
            if (attackType == "sharp")
            {
                double bonusMult = TalentEffects.Get(attacker, "sharpCritMult");
                if (bonusMult > critMult) critMult = bonusMult;
            }
            damage = (int)Math.Floor(damage * critMult);
        }

        // executioner: +25% damage vs targets below 30% blood
        double execThresh = TalentEffects.Get(attacker, "executionerThresh");
        if (execThresh > 0 && target.Anatomy != null)
        {
            double bloodPct = target.Anatomy.Blood / (double)target.Anatomy.MaxBlood;
            if (bloodPct < execThresh)
                damage = (int)Math.Floor(damage * (1.0 + TalentEffects.Get(attacker, "executionerMod")));
        }

        // killingSpree: active buff from previous kill this run
        if (attacker.HasEffect("killing_spree"))
            damage = (int)Math.Floor(damage * (1.0 + TalentEffects.Get(attacker, "killingSpreeBonus")));

        // ── Armor mitigation ──
        var armor = CalculateArmor(target, loc.region);
        int flatReduction = (int)TalentEffects.Get(target, "flatDmgReduction");
        // Trait-based flat damage reduction (Thick-Skinned) stacks with talent
        if (target is Nightrun.Entities.Player pt) flatReduction += (int)pt.FlatDmgReduction;
        int finalDamage = Math.Max(1, damage - armor.Reduction - flatReduction);
        int blocked = damage - finalDamage;

        // ── Apply anatomy damage ──
        var partRes = ApplyAnatomyDamage(target, loc.subPart, finalDamage, attackType);

        // ── Wound creation ──
        if (target.Anatomy != null)
        {
            bool isVital = loc.subPart.Vital;
            bool bleedImmune = TalentEffects.Get(target, "bleedImmune") > 0;

            if (attackType == "sharp" && !bleedImmune)
            {
                double bleedChance = weapon?.BleedChance ?? 0.40;
                if (isVital) bleedChance = Math.Max(bleedChance, 0.80);

                if (_rng.NextDouble() < bleedChance || isCritical)
                {
                    double severity = isCritical ? finalDamage * 0.8 : finalDamage * 0.5;
                    if (isVital) severity *= 1.5;

                    bool isArterial = isVital && (isCritical || _rng.NextDouble() < 0.2);
                    string woundType =
                        isArterial           ? "arterial" :
                        isVital              ? "puncture" :
                        _rng.NextDouble() < 0.5 ? "cut" : "laceration";

                    target.Anatomy.AddWound(partDisplay, severity, woundType);
                    LogWound(targetName, partDisplay, woundType);
                }
            }
            else if (attackType == "blunt")
            {
                if (isVital && (isCritical || _rng.NextDouble() < 0.25))
                {
                    double severity = isCritical ? finalDamage * 0.6 : finalDamage * 0.3;
                    target.Anatomy.AddWound(partDisplay, severity, "internal");
                    LogWound(targetName, partDisplay, "internal");
                }
                else if (loc.region == "head" && _rng.NextDouble() < 0.35)
                {
                    double severity = finalDamage * 0.2;
                    target.Anatomy.AddWound(partDisplay, severity, "laceration");
                    LogWound(targetName, partDisplay, "laceration");
                }
            }
            else if (attackType == "unarmed" && isCritical && loc.region == "head")
            {
                double severity = finalDamage * 0.15;
                target.Anatomy.AddWound(partDisplay, severity, "laceration");
                LogWound(targetName, partDisplay, "laceration");
            }

            // Trait: Thin-Skinned adds extra pain per hit
            double painAmount = finalDamage;
            if (target is Nightrun.Entities.Player pp) painAmount += pp.PainVuln;
            target.Anatomy.AddPain(painAmount, _getTurn());
        }

        // ── Stagger (blunt only) ──
        bool staggered = false;
        if (attackType == "blunt")
        {
            // staggeImmune: cybernetics talent makes target immune
            bool immuneToStagger = TalentEffects.Get(target, "staggeImmune") > 0;
            if (!immuneToStagger)
            {
                staggered = CheckStagger(attacker, target, weapon, finalDamage, isCritical);
                if (staggered) LogStagger(targetName);
            }
        }

        // ── Generate main log line ──
        string? weaponName = weapon?.Name;
        if (isCritical) LogCritical(attackerName, targetName, weaponName, partDisplay, finalDamage, attackType, attackerIsPlayer);
        else            LogAttack  (attackerName, targetName, weaponName, partDisplay, finalDamage, attackType, attackerIsPlayer);

        if (blocked > 0 && armor.Name != null)
            LogBlock(attackerName, targetName, armor.Name, blocked);

        if (partRes.Destroyed)
            LogPartDestroyed(targetName, partDisplay);

        // ── Death check ──
        bool killed = target.Anatomy?.IsDead() ?? false;
        if (killed)
        {
            LogKill(targetName, target);
            // killingSpree: grant buff to attacker for next N turns
            double ksTurns = TalentEffects.Get(attacker, "killingSpreeturns");
            if (ksTurns > 0)
                attacker.ApplyEffect("killing_spree", (int)ksTurns);
        }

        return new AttackResult(
            Hit: true, Damage: finalDamage, BodyPart: partDisplay, Region: loc.region,
            Critical: isCritical, Killed: killed, Blocked: blocked, Staggered: staggered, Parried: false);
    }

    // =====================================================================
    // Hit / crit chance
    // =====================================================================

    private double CalculateHitChance(Entity attacker, Entity target, Item? weapon)
    {
        double chance = 55;

        chance += (attacker.Stats.Strength - 10) * 1.5;
        chance += (attacker.Stats.Agility  - 10) * 1.0;
        chance -= (target.Stats.Agility    - 10) * 2.0;

        if (weapon != null) chance += weapon.Accuracy;
        else                chance -= 20;

        if (attacker.Anatomy != null)
            chance += attacker.Anatomy.GetCombatPenalties().HitChanceMod;
        if (target.Anatomy != null)
            chance += target.Anatomy.GetCombatPenalties().DodgeMod;

        if (attacker.HasEffect("impaired_vision")) chance -= 20;

        // Trait bonuses (Streetwise, Combat Veteran, Brawler)
        if (attacker is Nightrun.Entities.Player pa)
        {
            chance += pa.HitBonus;
            if (weapon == null) chance += pa.UnarmedHitBonus;
        }

        return Math.Max(15, Math.Min(95, chance));
    }

    private double CalculateCritChance(Entity attacker, Item? weapon)
    {
        double chance = 5;
        chance += (attacker.Stats.Perception - 10) * 1.0;
        chance += (attacker.Stats.Agility    - 10) * 0.5;
        if (weapon != null) chance += weapon.CritBonus;
        else                chance -= 3;
        if (attacker.Anatomy != null)
            chance += attacker.Anatomy.GetCombatPenalties().CritChanceMod;
        // Sharp weapon talent crit bonus
        if (GetAttackType(weapon) == "sharp")
            chance += TalentEffects.Get(attacker, "sharpCritBonus") * 100;
        // Trait bonuses (Keen Eye critBonus, Lucky luckBonus)
        if (attacker is Nightrun.Entities.Player pc)
            chance += pc.CritBonus + pc.LuckBonus;
        return Math.Max(1, Math.Min(30, chance));
    }

    // =====================================================================
    // Targeting & sub-part roll
    // =====================================================================

    private (string region, SubPart subPart) RollHitLocation(Item? weapon)
    {
        string atk = GetAttackType(weapon);
        var regions = atk switch
        {
            "sharp"   => TargetingSharp,
            "unarmed" => TargetingUnarmed,
            _         => TargetingBlunt,
        };
        string region = WeightedRegion(regions);
        var parts = RegionParts[region];
        SubPart sub = WeightedSubPart(parts);
        return (region, sub);
    }

    private string WeightedRegion(RegionWeight[] items)
    {
        int total = 0;
        foreach (var it in items) total += it.Weight;
        double roll = _rng.NextDouble() * total;
        foreach (var it in items)
        {
            roll -= it.Weight;
            if (roll <= 0) return it.Region;
        }
        return items[^1].Region;
    }

    private SubPart WeightedSubPart(SubPart[] items)
    {
        int total = 0;
        foreach (var it in items) total += it.Weight;
        double roll = _rng.NextDouble() * total;
        foreach (var it in items)
        {
            roll -= it.Weight;
            if (roll <= 0) return it;
        }
        return items[^1];
    }

    // =====================================================================
    // Intercept / parry
    // =====================================================================

    private double GetArmInterceptChance(Entity target)
    {
        if (target.Anatomy == null) return 0;
        int functional =
            (target.Anatomy.LeftArm.Functional  ? 1 : 0) +
            (target.Anatomy.RightArm.Functional ? 1 : 0);
        double chance = functional == 2 ? 0.25 : functional == 1 ? 0.12 : 0;
        if (target.HasEffect("guard_break")) chance *= 0.5;
        return chance;
    }

    private (string region, SubPart subPart)? PickInterceptArm(Entity target)
    {
        if (target.Anatomy == null) return null;
        var left = target.Anatomy.LeftArm;
        var right = target.Anatomy.RightArm;
        if (left.Functional && right.Functional)
        {
            string r = left.Hp >= right.Hp ? "leftArm" : "rightArm";
            return (r, RegionParts[r][0]);
        }
        if (left.Functional)  return ("leftArm",  RegionParts["leftArm"][0]);
        if (right.Functional) return ("rightArm", RegionParts["rightArm"][0]);
        return null;
    }

    private readonly record struct ParryResult(bool Success, string? WeaponName);

    private ParryResult CheckParry(Entity target)
    {
        var w = target.ActiveWeapon;
        if (w == null || w.ParryBonus <= 0) return new ParryResult(false, null);

        // No defensive stance system yet — use half the weapon parry bonus.
        double chance = w.ParryBonus * 0.5;
        chance += (target.Stats.Agility - 10) * 0.02;
        chance = Math.Max(0, Math.Min(0.40, chance));

        return _rng.NextDouble() < chance
            ? new ParryResult(true, w.Name)
            : new ParryResult(false, null);
    }

    // =====================================================================
    // Stagger
    // =====================================================================

    private bool CheckStagger(Entity attacker, Entity target, Item? weapon, int damage, bool isCritical)
    {
        if (isCritical) return true;

        double chance = weapon?.StaggerChance ?? 0.15;
        chance += (attacker.Stats.Strength - 10) * 0.03;
        chance -= (target.Stats.Endurance  - 10) * 0.03;
        if (damage > 5) chance += (damage - 5) * 0.05;
        // Blunt focus talent stagger bonus
        if (GetAttackType(weapon) == "blunt")
            chance += TalentEffects.Get(attacker, "bluntStaggerBonus");
        // Trait: Brittle Bones makes target easier to stagger
        if (target is Nightrun.Entities.Player ps) chance += ps.StaggerVuln;

        chance = Math.Max(0.05, Math.Min(0.60, chance));
        return _rng.NextDouble() < chance;
    }

    // =====================================================================
    // Damage roll
    // =====================================================================

    private int RollWeaponDamage(Item? weapon, Entity attacker)
    {
        int dmg;
        if (weapon != null && weapon.DamageDice != null)
        {
            dmg = RollDice(weapon.DamageDice);
        }
        else
        {
            dmg = _rng.Next(2) + 1;   // unarmed: 1d2
            dmg += (int)TalentEffects.Get(attacker, "unarmedDmgBonus");
            if (attacker is Nightrun.Entities.Player pb) dmg += (int)pb.UnarmedDmgBonus;
        }

        dmg += (attacker.Stats.Strength - 10) / 2;

        // Blunt weapon talent bonus
        string atkType = GetAttackType(weapon);
        if (atkType == "blunt")
            dmg += (int)TalentEffects.Get(attacker, "bluntDmgBonus");

        if (attacker.Anatomy != null)
        {
            double mod = attacker.Anatomy.GetCombatPenalties().DamageMod;
            dmg = (int)Math.Floor(dmg * mod);
        }

        // Fragmentation Edge: bonus damage when Echo player is near instability threshold
        if (attacker is Player fragPl && fragPl.Instability >= (int)TalentEffects.Get(attacker, "fragEdgeThresh"))
        {
            double bonus = TalentEffects.Get(attacker, "fragEdgeBonus");
            if (bonus > 0) dmg = (int)Math.Floor(dmg * (1.0 + bonus));
        }

        return Math.Max(1, dmg);
    }

    /// <summary>Parse a dice expression like "1d6" or "1d8+2" and roll it.</summary>
    public int RollDice(string expr)
    {
        if (string.IsNullOrEmpty(expr)) return 0;
        int total = 0;
        foreach (var raw in expr.Split('+'))
        {
            var part = raw.Trim();
            int d = part.IndexOf('d');
            if (d > 0)
            {
                int count = int.Parse(part[..d]);
                int sides = int.Parse(part[(d + 1)..]);
                for (int i = 0; i < count; i++) total += _rng.Next(sides) + 1;
            }
            else if (part.Length > 0)
            {
                if (int.TryParse(part, out int n)) total += n;
            }
        }
        return total;
    }

    public static string GetAttackType(Item? weapon)
    {
        if (weapon == null) return "unarmed";
        return weapon.AttackType;
    }

    // =====================================================================
    // Armor mitigation
    // =====================================================================

    private readonly record struct ArmorResult(int Reduction, string? Name);

    private ArmorResult CalculateArmor(Entity target, string region)
    {
        int reduction = 0;
        string? firstName = null;

        foreach (var kv in ArmorCoverage)
        {
            bool covers = false;
            foreach (var r in kv.Value) if (r == region) { covers = true; break; }
            if (!covers) continue;

            var item = target.Equipment[kv.Key];
            if (item != null && item.Defense > 0)
            {
                reduction += item.Defense;
                firstName ??= item.Name;
            }
        }
        return new ArmorResult(reduction, firstName);
    }

    // =====================================================================
    // Anatomy damage application
    // =====================================================================

    private readonly record struct PartDamageResult(bool Destroyed);

    private PartDamageResult ApplyAnatomyDamage(Entity target, SubPart sub, int damage, string attackType)
    {
        if (target.Anatomy == null) return new PartDamageResult(false);
        if (sub.Path == null)       return new PartDamageResult(false);  // glancing

        // Map weapon attackType → anatomy damage category; vital-organ sharp hits = "stab"
        string dmgType = attackType switch
        {
            "sharp"   => sub.Vital ? "stab" : "sharp",
            "blunt"   => "blunt",
            "unarmed" => "blunt",
            _         => "blunt",
        };

        var res = target.Anatomy.DamagePart(sub.Path, damage, dmgType);
        if (res == null) return new PartDamageResult(false);
        return new PartDamageResult(res.Value.Destroyed);
    }

    // =====================================================================
    // Log helpers
    // =====================================================================

    private static string GetDisplayName(Entity e, bool _isAttacker)
        => e is Player ? "You" : e.Name;

    private static string GetDamageIntensity(int dmg)
        => dmg <= 2 ? "light" : dmg <= 6 ? "medium" : "heavy";

    private T PickRandom<T>(IReadOnlyList<T> arr) => arr[_rng.Next(arr.Count)];

    private void LogAttack(string a, string t, string? w, string p, int d, string atk, bool attackerIsPlayer)
    {
        var verbs = GetDamageIntensity(d) switch
        {
            "light"  => VerbsLight,
            "heavy"  => VerbsHeavy,
            _        => VerbsMedium,
        };
        string verb = PickRandom(verbs.GetValueOrDefault(atk, verbs["blunt"]));
        if (attackerIsPlayer) verb = BaseForm(verb);

        var templates = w != null ? AttackTemplates : AttackTemplatesUnarmed;
        string msg = PickRandom(templates)
            .Replace("{a}", a).Replace("{t}", t)
            .Replace("{w}", w ?? "bare fists")
            .Replace("{p}", p).Replace("{d}", d.ToString())
            .Replace("{verb}", verb);
        _log(msg, 255);  // normal hit — white
    }

    private void LogCritical(string a, string t, string? w, string p, int d, string atk, bool attackerIsPlayer)
    {
        string verb = PickRandom(VerbsHeavy.GetValueOrDefault(atk, VerbsHeavy["blunt"]));
        if (attackerIsPlayer) verb = BaseForm(verb);

        string msg = PickRandom(CriticalTemplates)
            .Replace("{a}", a).Replace("{t}", t)
            .Replace("{w}", w ?? "bare fists")
            .Replace("{p}", p).Replace("{d}", d.ToString())
            .Replace("{verb}", verb);
        _log(msg, 226);  // critical — yellow
    }

    private void LogMiss(string a, string t)
        => _log(PickRandom(MissTemplates).Replace("{a}", a).Replace("{t}", t), 240);   // dim gray

    private void LogBlock(string a, string t, string armor, int blocked)
        => _log(PickRandom(BlockTemplates)
            .Replace("{a}", a).Replace("{t}", t)
            .Replace("{armor}", armor).Replace("{blocked}", blocked.ToString()), 244); // gray

    private void LogStagger(string t)
        => _log(PickRandom(StaggerTemplates).Replace("{t}", t), 214);                  // orange

    private void LogParry(string t, string w)
        => _log(PickRandom(ParryTemplates).Replace("{t}", t).Replace("{w}", w), 51);   // cyan

    private void LogPartDestroyed(string t, string p)
        => _log(PickRandom(PartDestroyedTemplates).Replace("{t}", t).Replace("{p}", p), 196); // bright red

    private void LogWound(string t, string p, string type)
    {
        var pool = WoundTemplates.GetValueOrDefault(type, WoundTemplates["cut"]);
        byte wc = type == "arterial" ? (byte)196 : type == "internal" ? (byte)214 : (byte)203;
        _log(PickRandom(pool).Replace("{t}", t).Replace("{p}", p), wc);
    }

    private void LogKill(string t, Entity entity)
    {
        _log(PickRandom(KillTemplates).Replace("{t}", t), 196);                        // bright red
        if (entity.Anatomy != null && entity.Anatomy.CauseOfDeath != null)
            _log($"Cause of death: {entity.Anatomy.GetDeathCause()}.", 203);
    }

    /// <summary>
    /// Convert a third-person verb into its base form for player-subject text.
    /// "strikes" → "strike", "crushes" → "crush", "rips into" → "rip into".
    /// </summary>
    private static string BaseForm(string verb)
    {
        var parts = verb.Split(' ');
        string first = parts[0];
        string rest = parts.Length > 1 ? " " + string.Join(' ', parts, 1, parts.Length - 1) : "";

        if (first.EndsWith("es") && (
                first.EndsWith("shes") || first.EndsWith("ches") ||
                first.EndsWith("zes")  || first.EndsWith("xes")  ||
                first.EndsWith("sses")))
            first = first[..^2];
        else if (first.EndsWith("ies"))
            first = first[..^3] + "y";
        else if (first.EndsWith("s") && !first.EndsWith("ss"))
            first = first[..^1];

        return first + rest;
    }
}
