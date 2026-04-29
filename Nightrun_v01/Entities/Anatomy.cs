namespace Nightrun.Entities;

/// <summary>
/// One body part of an entity. Tracks current/max HP, whether it's still
/// functional (gone below 0 or destroyed by a critical), whether it has been
/// replaced by a cybernetic, and the last damage type to color status text.
/// Mirrors the JS object literal { name, hp, maxHP, functional, cybernetic }.
/// </summary>
public sealed class BodyPart
{
    public required string Name;
    public required string Region;       // "head", "torso", "leftArm", "rightArm", "leftLeg", "rightLeg"
    public required string Path;         // e.g. "torso.heart" or "torso.lungs.0"
    public int Hp;
    public int MaxHp;
    public bool Functional = true;
    public bool Cybernetic = false;
    public string? LastDamageType;       // "blunt" | "sharp" | "stab"
}

/// <summary>
/// A bleeding wound on a body part. Severity is the blood-loss-per-turn rate;
/// it falls toward 0 as the wound clots (or rises when infected).
/// </summary>
public sealed class Wound
{
    public required string Part;         // display name of wounded body part
    public double Severity;
    public required string Type;         // "cut" | "stab" | "laceration" | "arterial" | "internal" | "puncture"
    public int TurnsActive;
    public bool Bandaged;
    public bool Disinfected;
    public bool Infected;
    public double InfectionSeverity;
}

public readonly record struct AnatomyEffect(string Kind, string Message);
public readonly record struct ProcessTurnResult(bool Alive, IReadOnlyList<AnatomyEffect> Effects);
public readonly record struct BloodStatus(string Label, byte Color);
public readonly record struct BodyCondition(string Label, byte Color, string Details);
public readonly record struct PartStatus(string Status, byte Color);

/// <summary>
/// Aggregate of all the combat modifiers a wounded entity carries. Hit/crit
/// mods are signed integer percentages added to chance; damage is a multiplier;
/// dodge is signed (positive = easier to hit).
/// </summary>
public sealed class CombatPenalties
{
    public int HitChanceMod;
    public int CritChanceMod;
    public double DamageMod = 1.0;
    public int DodgeMod;
    public List<string> Details = new();
}

/// <summary>
/// Per-entity anatomy simulation — replaces a flat HP bar with a body parts
/// tree, blood volume, bleeding wounds, infection, suffocation, pain/shock,
/// and per-cause death detection. 1:1 port of <c>src/entities/Anatomy.js</c>.
/// </summary>
public sealed class Anatomy
{
    // ── Constants (port of the JS module-level consts) ────────────────────
    public const int BLOOD_HEALTHY      = 80;
    public const int BLOOD_LIGHTHEADED  = 60;
    public const int BLOOD_WOOZY        = 40;
    public const int BLOOD_CRITICAL     = 20;
    public const int BLOOD_UNCONSCIOUS  = 10;
    public const int BLOOD_DEAD         = 0;

    public const int SUFFOCATION_TURNS  = 8;
    public const int SHOCK_THRESHOLD    = 80;
    public const int SHOCK_WINDOW       = 5;

    public const double INFECTION_CHANCE_PER_TURN = 0.03;
    public const double INFECTION_DAMAGE_PER_TURN = 0.5;

    // ── Color palette (ANSI 256 approximations of the JS hex colors) ──
    private const byte CLR_HEALTHY    = 46;   // green
    private const byte CLR_LIGHT      = 154;  // yellow-green
    private const byte CLR_WOOZY      = 214;  // orange
    private const byte CLR_CRITICAL   = 196;  // bright red
    private const byte CLR_FADING     = 124;  // dark red
    private const byte CLR_DEAD       = 52;   // very dark red
    private const byte CLR_SHOCK      = 201;  // magenta
    private const byte CLR_SUFFOCATE  = 99;   // purple
    private const byte CLR_INJURED    = 208;  // orange
    private const byte CLR_BLEED      = 203;  // pink-red
    private const byte CLR_LIGHT_HURT = 209;  // soft orange
    private const byte CLR_DESTROYED  = 240;  // grey
    private const byte CLR_OK_LIGHT   = 112;  // soft green

    // ── State ──────────────────────────────────────────────────────────
    private readonly Random _rng;
    private readonly Dictionary<string, BodyPart> _parts = new(StringComparer.Ordinal);

    public int Blood     { get; private set; } = 100;
    public int MaxBlood  { get; private set; } = 100;

    /// <summary>Adjust the max blood pool (e.g. weakConstitution trait). Clamps current blood.</summary>
    public void SetMaxBlood(int newMax)
    {
        MaxBlood = Math.Max(10, newMax);
        Blood    = Math.Min(Blood, MaxBlood);
    }
    public List<Wound> Wounds { get; } = new();

    public bool   Suffocating       { get; private set; }
    public int    SuffocationTurns  { get; private set; }
    public bool   InShock           { get; private set; }
    public bool   Alive             { get; private set; } = true;
    public string? CauseOfDeath     { get; private set; }

    public double ClotRate          = 0.15;
    public int    RegenCooldown     { get; private set; }

    public int    PainSuppression       { get; private set; }
    public int    ShockThresholdBonus   { get; private set; }
    /// <summary>Permanent pain threshold bonus from traits (Combat Veteran = 15).</summary>
    public int    TraitPainThresholdBonus { get; set; }
    /// <summary>Wound clotting speed multiplier from traits (Medical Training = 1.5, Slow Healer = 0.5).</summary>
    public double HealingMod            { get; set; } = 1.0;

    private readonly List<(double amount, int turn)> _painHistory = new();

    public Anatomy(Random? rng = null)
    {
        _rng = rng ?? new Random();
    }

    /// <summary>Build the canonical body-part tree. Call once after construction.</summary>
    public void Init()
    {
        // -- Head: surface layer first, then organs behind it --
        Add("head.skull",    "Skull",          "head", 40);
        Add("head.face",     "Face",           "head", 25);
        Add("head.eyes.0",   "Left Eye",       "head", 10);
        Add("head.eyes.1",   "Right Eye",      "head", 10);
        Add("head.ears.0",   "Left Ear",       "head", 10);
        Add("head.ears.1",   "Right Ear",      "head", 10);
        Add("head.brain",    "Brain",          "head", 50);
        Add("head.jaw",      "Jaw",            "head", 20);

        // -- Torso: surface layer first, then organs behind it --
        Add("torso.chest",     "Chest",        "torso", 45);
        Add("torso.ribs",      "Ribs",         "torso", 35);
        Add("torso.abdomen",   "Abdomen",      "torso", 35);
        Add("torso.heart",     "Heart",        "torso", 40);
        Add("torso.lungs.0",   "Left Lung",    "torso", 30);
        Add("torso.lungs.1",   "Right Lung",   "torso", 30);
        Add("torso.stomach",   "Stomach",      "torso", 25);
        Add("torso.liver",     "Liver",        "torso", 30);
        Add("torso.kidneys.0", "Left Kidney",  "torso", 20);
        Add("torso.kidneys.1", "Right Kidney", "torso", 20);

        Add("leftArm.arm",   "Left Arm",       "leftArm", 30);
        Add("leftArm.hand",  "Left Hand",      "leftArm", 20);
        for (int i = 0; i < 5; i++)
            Add($"leftArm.fingers.{i}",  $"Left Finger {i + 1}",  "leftArm", 5);

        Add("rightArm.arm",  "Right Arm",      "rightArm", 30);
        Add("rightArm.hand", "Right Hand",     "rightArm", 20);
        for (int i = 0; i < 5; i++)
            Add($"rightArm.fingers.{i}", $"Right Finger {i + 1}", "rightArm", 5);

        Add("leftLeg.leg",   "Left Leg",       "leftLeg", 35);
        Add("leftLeg.foot",  "Left Foot",      "leftLeg", 20);

        Add("rightLeg.leg",  "Right Leg",      "rightLeg", 35);
        Add("rightLeg.foot", "Right Foot",     "rightLeg", 20);
    }

    private void Add(string path, string name, string region, int hp)
    {
        _parts[path] = new BodyPart
        {
            Name = name, Region = region, Path = path, Hp = hp, MaxHp = hp,
        };
    }

    // ── Quick-access part properties ──────────────────────────────────
    // Surface layer
    public BodyPart Skull      => _parts["head.skull"];
    public BodyPart Face       => _parts["head.face"];
    public BodyPart Chest      => _parts["torso.chest"];
    public BodyPart Ribs       => _parts["torso.ribs"];
    public BodyPart Abdomen    => _parts["torso.abdomen"];
    // Head organs
    public BodyPart Brain      => _parts["head.brain"];
    public BodyPart Jaw        => _parts["head.jaw"];
    public BodyPart LeftEye    => _parts["head.eyes.0"];
    public BodyPart RightEye   => _parts["head.eyes.1"];
    public BodyPart LeftEar    => _parts["head.ears.0"];
    public BodyPart RightEar   => _parts["head.ears.1"];
    // Torso organs
    public BodyPart Heart      => _parts["torso.heart"];
    public BodyPart LeftLung   => _parts["torso.lungs.0"];
    public BodyPart RightLung  => _parts["torso.lungs.1"];
    public BodyPart Stomach    => _parts["torso.stomach"];
    public BodyPart Liver      => _parts["torso.liver"];
    public BodyPart LeftKidney => _parts["torso.kidneys.0"];
    public BodyPart RightKidney=> _parts["torso.kidneys.1"];
    public BodyPart LeftArm    => _parts["leftArm.arm"];
    public BodyPart RightArm   => _parts["rightArm.arm"];
    public BodyPart LeftHand   => _parts["leftArm.hand"];
    public BodyPart RightHand  => _parts["rightArm.hand"];
    public BodyPart LeftLeg    => _parts["leftLeg.leg"];
    public BodyPart RightLeg   => _parts["rightLeg.leg"];
    public BodyPart LeftFoot   => _parts["leftLeg.foot"];
    public BodyPart RightFoot  => _parts["rightLeg.foot"];

    /// <summary>Look a part up by JS-style dotted path (e.g. "torso.lungs.0").</summary>
    public BodyPart? GetPart(string path)
        => _parts.TryGetValue(path, out var p) ? p : null;

    /// <summary>Iterate every body part in the tree (flat).</summary>
    public IEnumerable<BodyPart> AllParts() => _parts.Values;

    // ── Wound API ──────────────────────────────────────────────────────

    /// <summary>
    /// Add a bleeding wound. Called by CombatSystem on sharp / piercing hits.
    /// </summary>
    public void AddWound(string partName, double severity, string type = "cut")
    {
        Wounds.Add(new Wound
        {
            Part = partName, Severity = severity, Type = type,
        });
    }

    /// <summary>
    /// Process all bleeding wounds for one turn. Wounds slowly clot over time
    /// (severity decreases). Returns total blood lost this turn.
    /// </summary>
    public double ProcessWounds()
    {
        double total = 0;
        for (int i = Wounds.Count - 1; i >= 0; i--)
        {
            var w = Wounds[i];
            w.TurnsActive++;
            total += w.Severity;

            (int delay, double speed) = w.Type switch
            {
                "arterial"   => (10, 0.02),
                "internal"   => (8,  0.03),
                "puncture"   => (6,  0.05),
                "laceration" => (3,  0.08),
                "cut"        => (3,  0.10),
                _            => (3,  0.08),
            };
            if (w.Bandaged)
            {
                delay = Math.Max(1, delay - 2);
                speed *= 2.0;
            }
            if (w.TurnsActive > delay)
                w.Severity = Math.Max(0, w.Severity - speed * HealingMod);

            // Untreated wounds risk infection after 5 turns.
            if (!w.Infected && !w.Disinfected && !w.Bandaged && w.Type != "internal")
            {
                if (w.TurnsActive > 5 && _rng.NextDouble() < INFECTION_CHANCE_PER_TURN)
                {
                    w.Infected = true;
                    w.InfectionSeverity = 1;
                }
            }

            if (w.Infected)
                w.InfectionSeverity = Math.Min(10, w.InfectionSeverity + 0.1);

            if (w.Severity <= 0.01)
            {
                Wounds.RemoveAt(i);
                RegenCooldown = Math.Max(RegenCooldown, 10);
            }
        }
        return total;
    }

    /// <summary>
    /// Per-turn anatomy effects. Called from <c>Game.TickTurn</c> after the
    /// world clock advances. Returns liveness + a list of log-worthy events.
    /// </summary>
    public ProcessTurnResult ProcessTurn(int currentTurn)
    {
        if (!Alive) return new ProcessTurnResult(false, Array.Empty<AnatomyEffect>());

        var effects = new List<AnatomyEffect>();

        // ── Bleeding ──
        double bloodLost = ProcessWounds();
        if (bloodLost > 0)
            Blood = (int)Math.Max(0, Blood - bloodLost);

        // Natural blood recovery — only when no wounds AND cooldown expired
        if (Wounds.Count == 0 && Blood < MaxBlood)
        {
            if (RegenCooldown > 0) RegenCooldown--;
            else Blood = (int)Math.Min(MaxBlood, Blood + ClotRate);
        }
        else
        {
            RegenCooldown = 0;
        }

        // ── Heart destroyed → catastrophic internal bleed ──
        bool heartKill = false;
        if (!Heart.Functional)
        {
            int before = Blood;
            Blood = Math.Max(0, Blood - 8);
            if (Blood > 0)
                effects.Add(new AnatomyEffect("organ", "Blood pours from catastrophic cardiac damage!"));
            if (Blood <= 0 && before > 0) heartKill = true;
        }

        // ── Suffocation (both lungs destroyed) ──
        if (!LeftLung.Functional && !RightLung.Functional)
        {
            if (!Suffocating)
            {
                Suffocating = true;
                SuffocationTurns = 0;
                effects.Add(new AnatomyEffect("organ", "Both lungs have collapsed — suffocating!"));
            }
            SuffocationTurns++;
            if (SuffocationTurns >= SUFFOCATION_TURNS)
            {
                Alive = false;
                CauseOfDeath = "suffocation";
                effects.Add(new AnatomyEffect("death", "suffocated from collapsed lungs"));
                return new ProcessTurnResult(false, effects);
            }
            else if (SuffocationTurns > SUFFOCATION_TURNS / 2)
            {
                effects.Add(new AnatomyEffect("organ", "Gasping desperately for air..."));
            }
        }
        else if (Suffocating)
        {
            Suffocating = false;
            SuffocationTurns = 0;
        }

        // ── Liver/kidney failure cascade → toxin damages brain ──
        int organFailures =
            (!Liver.Functional ? 1 : 0) +
            (!LeftKidney.Functional ? 1 : 0) +
            (!RightKidney.Functional ? 1 : 0);
        if (organFailures >= 2)
        {
            int toxinDamage = organFailures >= 3 ? 2 : 1;
            if (Brain.Functional)
            {
                Brain.Hp = Math.Max(0, Brain.Hp - toxinDamage);
                if (Brain.Hp <= 0) Brain.Functional = false;
                if (_rng.NextDouble() < 0.3)
                    effects.Add(new AnatomyEffect("organ",
                        "Toxins cloud your mind — organ failure is setting in..."));
            }
        }

        // ── Infection damage ──
        foreach (var w in Wounds)
        {
            if (w.Infected && w.InfectionSeverity >= 3)
            {
                Blood = (int)Math.Max(0, Blood - INFECTION_DAMAGE_PER_TURN * (w.InfectionSeverity / 5));
                if (_rng.NextDouble() < 0.15)
                    effects.Add(new AnatomyEffect("infection",
                        $"Infection in {w.Part} is getting worse..."));
                if (w.InfectionSeverity >= 7 && _rng.NextDouble() < 0.1)
                {
                    if (Liver.Functional)
                    {
                        Liver.Hp = Math.Max(0, Liver.Hp - 1);
                        if (Liver.Hp <= 0) Liver.Functional = false;
                        effects.Add(new AnatomyEffect("infection",
                            "Sepsis is setting in — organ damage!"));
                    }
                }
            }
        }

        // ── Pain suppression tick ──
        if (PainSuppression > 0)
        {
            PainSuppression--;
            if (PainSuppression <= 0) ShockThresholdBonus = 0;
        }

        // ── Shock check (slide pain window) ──
        _painHistory.RemoveAll(p => currentTurn - p.turn >= SHOCK_WINDOW);
        double recentPain = 0;
        foreach (var p in _painHistory) recentPain += p.amount;
        if (PainSuppression > 0) recentPain *= 0.4;
        int effectiveThreshold = SHOCK_THRESHOLD + ShockThresholdBonus + TraitPainThresholdBonus;
        if (recentPain >= effectiveThreshold && !InShock)
        {
            InShock = true;
            effects.Add(new AnatomyEffect("shock", "The pain is overwhelming — going into shock!"));
        }
        else if (recentPain < effectiveThreshold * 0.5)
        {
            InShock = false;
        }

        // ── Blood loss thresholds (and exsanguination death) ──
        double bloodPct = GetBloodPercent();
        if (bloodPct <= BLOOD_DEAD)
        {
            Alive = false;
            CauseOfDeath = heartKill ? "cardiac arrest" : "blood loss";
            effects.Add(new AnatomyEffect("death", heartKill ? "died of cardiac arrest" : "bled out"));
            return new ProcessTurnResult(false, effects);
        }
        else if (bloodPct <= BLOOD_UNCONSCIOUS)
        {
            // Unconscious with still-bleeding wounds — death is inevitable this turn
            if (Wounds.Count > 0)
            {
                Alive = false;
                CauseOfDeath = "blood loss";
                effects.Add(new AnatomyEffect("death", "bled out while unconscious"));
                return new ProcessTurnResult(false, effects);
            }
            effects.Add(new AnatomyEffect("blood", "Consciousness fading... too much blood lost."));
        }
        else if (bloodPct <= BLOOD_CRITICAL)
        {
            // Shock at critical blood = death
            if (InShock)
            {
                Alive = false;
                CauseOfDeath = "shock";
                effects.Add(new AnatomyEffect("death", "went into fatal shock from blood loss"));
                return new ProcessTurnResult(false, effects);
            }
            if (_rng.NextDouble() < 0.4)
                effects.Add(new AnatomyEffect("blood", "Vision blurs. Blood soaks everything."));
        }
        else if (bloodPct <= BLOOD_WOOZY)
        {
            if (_rng.NextDouble() < 0.2)
                effects.Add(new AnatomyEffect("blood", "Feeling lightheaded from blood loss..."));
        }

        // ── Brain check (instant death if not functional) ──
        if (!Brain.Functional)
        {
            Alive = false;
            CauseOfDeath = "brain destruction";
            effects.Add(new AnatomyEffect("death", "brain destroyed"));
            return new ProcessTurnResult(false, effects);
        }

        return new ProcessTurnResult(true, effects);
    }

    /// <summary>Record pain for shock tracking.</summary>
    public void AddPain(double amount, int currentTurn)
        => _painHistory.Add((amount, currentTurn));

    // ── Death detection ────────────────────────────────────────────────

    public bool IsDead()
    {
        if (!Alive) return true;
        if (!Brain.Functional)
        {
            Alive = false;
            CauseOfDeath ??= "brain destruction";
            return true;
        }
        if (Blood <= 0)
        {
            Alive = false;
            CauseOfDeath ??= "blood loss";
            return true;
        }
        return false;
    }

    private static readonly Dictionary<string, string[]> DeathPhrases = new()
    {
        ["blood loss"] = new[]
        {
            "bled out from their wounds",
            "exsanguinated",
            "bled to death",
            "lost too much blood",
        },
        ["brain destruction"] = new[]
        {
            "suffered fatal brain trauma",
            "died from massive head trauma",
            "brain was destroyed",
        },
        ["suffocation"] = new[]
        {
            "suffocated from collapsed lungs",
            "asphyxiated",
            "couldn't breathe and died",
        },
        ["cardiac arrest"] = new[]
        {
            "died of cardiac arrest",
            "heart gave out",
            "suffered fatal cardiac damage",
        },
        ["shock"] = new[]
        {
            "died from traumatic shock",
            "body shut down from shock",
            "went into fatal shock",
        },
        ["starvation"] = new[]
        {
            "starved to death",
            "wasted away from hunger",
        },
        ["dehydration"] = new[]
        {
            "died of dehydration",
            "perished from thirst",
        },
    };

    public string GetDeathCause()
    {
        if (CauseOfDeath == null) return "unknown causes";
        if (DeathPhrases.TryGetValue(CauseOfDeath, out var arr))
            return arr[_rng.Next(arr.Length)];
        return CauseOfDeath;
    }

    // ── Status queries ─────────────────────────────────────────────────

    public double GetBloodPercent() => (Blood / (double)MaxBlood) * 100;

    public BloodStatus GetBloodStatus()
    {
        double p = GetBloodPercent();
        if (p > BLOOD_HEALTHY)     return new BloodStatus("Healthy",     CLR_HEALTHY);
        if (p > BLOOD_LIGHTHEADED) return new BloodStatus("Lightheaded", CLR_LIGHT);
        if (p > BLOOD_WOOZY)       return new BloodStatus("Woozy",       CLR_WOOZY);
        if (p > BLOOD_CRITICAL)    return new BloodStatus("Critical",    CLR_CRITICAL);
        if (p > BLOOD_UNCONSCIOUS) return new BloodStatus("Fading",      CLR_FADING);
        return new BloodStatus("Dead", CLR_DEAD);
    }

    public BodyCondition GetBodyCondition()
    {
        if (!Alive) return new BodyCondition("DEAD", CLR_DEAD, GetDeathCause());

        var blood = GetBloodStatus();
        var destroyed = GetDestroyedParts();

        if (InShock)      return new BodyCondition("SHOCK",       CLR_SHOCK,     "In traumatic shock");
        if (Suffocating)  return new BodyCondition("SUFFOCATING", CLR_SUFFOCATE, $"{SUFFOCATION_TURNS - SuffocationTurns} turns of air left");

        if (blood.Label is "Critical" or "Fading")
            return new BodyCondition(blood.Label, blood.Color, $"Blood: {(int)Blood}%");

        if (destroyed.Count > 0)
            return new BodyCondition("Injured", CLR_INJURED, $"{destroyed.Count} part(s) ruined");

        if (Wounds.Count > 0)
        {
            double totalBleed = 0;
            foreach (var w in Wounds) totalBleed += w.Severity;
            return new BodyCondition("Bleeding", CLR_BLEED,
                $"{Wounds.Count} wound(s), {totalBleed:F1}/turn");
        }

        if (blood.Label != "Healthy")
            return new BodyCondition(blood.Label, blood.Color, $"Blood: {(int)Blood}%");

        return new BodyCondition("Healthy", CLR_HEALTHY, "");
    }

    public List<string> GetDestroyedParts()
    {
        var list = new List<string>();
        foreach (var p in _parts.Values)
            if (!p.Functional && p.Hp <= 0)
                list.Add(p.Name);
        return list;
    }

    /// <summary>Returns display names of all currently wounded body parts (has active wounds).</summary>
    public List<string> GetWoundedParts()
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var w in Wounds)
            set.Add(w.Part);
        return set.ToList();
    }

    public double GetTotalDamagePercent()
    {
        int hp = 0, max = 0;
        foreach (var p in _parts.Values) { hp += p.Hp; max += p.MaxHp; }
        return max > 0 ? (hp / (double)max) * 100 : 0;
    }

    // ── Sense / movement effects (used by FOV + MovementSystem) ────────

    public int GetVisionRange()
    {
        int range = 0;
        if (LeftEye.Functional)  range += 5;
        if (RightEye.Functional) range += 5;

        double p = GetBloodPercent();
        if (p <= BLOOD_CRITICAL)         range -= 4;
        else if (p <= BLOOD_WOOZY)       range -= 2;
        else if (p <= BLOOD_LIGHTHEADED) range -= 1;

        // Trait bonuses to wire in once a trait system exists.
        return Math.Max(1, range);
    }

    public int GetHearingRange()
    {
        int range = 0;
        if (LeftEar.Functional)  range += 3;
        if (RightEar.Functional) range += 3;
        return range;
    }

    public bool CanUseHands() => LeftHand.Functional || RightHand.Functional;

    public double GetMovementPenalty()
    {
        double pen = 0;
        if (!LeftLeg.Functional)   pen += 0.5;
        if (!RightLeg.Functional)  pen += 0.5;
        if (!LeftFoot.Functional)  pen += 0.25;
        if (!RightFoot.Functional) pen += 0.25;

        double p = GetBloodPercent();
        if (p <= BLOOD_CRITICAL)   pen += 0.5;
        else if (p <= BLOOD_WOOZY) pen += 0.25;

        if (InShock) pen += 0.5;

        return Math.Min(1.0, pen);
    }

    // ── Combat penalties (used by CombatSystem) ────────────────────────

    public CombatPenalties GetCombatPenalties()
    {
        var pen = new CombatPenalties();

        double armCondition  = (LeftArm.Hp  / (double)LeftArm.MaxHp  + RightArm.Hp  / (double)RightArm.MaxHp ) / 2;
        double handCondition = (LeftHand.Hp / (double)LeftHand.MaxHp + RightHand.Hp / (double)RightHand.MaxHp) / 2;

        if (armCondition < 1.0)
        {
            int armHit = (int)Math.Round((1.0 - armCondition) * -15);
            double armDmg = 0.5 + armCondition * 0.5;
            pen.HitChanceMod += armHit;
            pen.DamageMod    *= armDmg;
            if (armHit != 0) pen.Details.Add($"Arm damage hit{armHit} dmg×{armDmg:F2}");
        }
        if (handCondition < 1.0)
        {
            int handHit = (int)Math.Round((1.0 - handCondition) * -10);
            double handDmg = 0.7 + handCondition * 0.3;
            pen.HitChanceMod += handHit;
            pen.DamageMod    *= handDmg;
            if (handHit != 0) pen.Details.Add($"Hand damage hit{handHit} dmg×{handDmg:F2}");
        }

        double eyeCondition = (LeftEye.Hp / (double)LeftEye.MaxHp + RightEye.Hp / (double)RightEye.MaxHp) / 2;
        if (eyeCondition < 1.0)
        {
            int eyeCrit = (int)Math.Round((1.0 - eyeCondition) * -8);
            pen.CritChanceMod += eyeCrit;
            if (eyeCrit != 0) pen.Details.Add($"Eye damage crit{eyeCrit}");
        }

        double bp = GetBloodPercent();
        if (bp <= BLOOD_CRITICAL)
        {
            pen.HitChanceMod  += -20;
            pen.CritChanceMod += -5;
            pen.DamageMod     *= 0.6;
            pen.DodgeMod      += 15;
            pen.Details.Add("Critical blood loss");
        }
        else if (bp <= BLOOD_WOOZY)
        {
            pen.HitChanceMod  += -10;
            pen.CritChanceMod += -3;
            pen.DamageMod     *= 0.8;
            pen.DodgeMod      += 8;
            pen.Details.Add("Woozy");
        }
        else if (bp <= BLOOD_LIGHTHEADED)
        {
            pen.HitChanceMod  += -5;
            pen.CritChanceMod += -1;
            pen.DamageMod     *= 0.9;
            pen.DodgeMod      += 3;
            pen.Details.Add("Lightheaded");
        }

        if (InShock)
        {
            pen.HitChanceMod  += -20;
            pen.CritChanceMod += -5;
            pen.DamageMod     *= 0.5;
            pen.DodgeMod      += 20;
            pen.Details.Add("SHOCK");
        }

        double legCondition  = (LeftLeg.Hp  / (double)LeftLeg.MaxHp  + RightLeg.Hp  / (double)RightLeg.MaxHp ) / 2;
        double footCondition = (LeftFoot.Hp / (double)LeftFoot.MaxHp + RightFoot.Hp / (double)RightFoot.MaxHp) / 2;
        if (legCondition < 1.0)
        {
            int legDodge = (int)Math.Round((1.0 - legCondition) * 15);
            pen.DodgeMod += legDodge;
            if (legDodge > 0) pen.Details.Add($"Leg damage dodge+{legDodge}");
        }
        if (footCondition < 1.0)
        {
            int footDodge = (int)Math.Round((1.0 - footCondition) * 8);
            pen.DodgeMod += footDodge;
            if (footDodge > 0) pen.Details.Add($"Foot damage dodge+{footDodge}");
        }

        if (pen.DamageMod < 0.2) pen.DamageMod = 0.2;
        return pen;
    }

    // ── Medical treatment ──────────────────────────────────────────────

    public readonly record struct TreatResult(bool Success, string Message);

    /// <summary>Apply a bandage to the worst untreated surface wound.</summary>
    public TreatResult BandageWound()
    {
        Wound? best = null;
        foreach (var w in Wounds)
            if (!w.Bandaged && w.Type != "internal")
                if (best == null || w.Severity > best.Severity) best = w;

        if (best == null) return new TreatResult(false, "No wounds to bandage.");
        best.Bandaged = true;
        best.Severity *= 0.5;
        return new TreatResult(true, $"Bandaged {best.Type} on {best.Part}. Bleeding reduced.");
    }

    /// <summary>Apply antiseptic to an infected or at-risk wound.</summary>
    public TreatResult ApplyAntiseptic()
    {
        Wound? infected = null;
        foreach (var w in Wounds)
            if (w.Infected && (infected == null || w.InfectionSeverity > infected.InfectionSeverity))
                infected = w;

        Wound? atRisk = null;
        if (infected == null)
        {
            foreach (var w in Wounds)
                if (!w.Disinfected && !w.Infected && w.Type != "internal")
                {
                    atRisk = w; break;
                }
        }

        var target = infected ?? atRisk;
        if (target == null) return new TreatResult(false, "No wounds need antiseptic.");

        if (target.Infected)
        {
            target.Infected = false;
            target.InfectionSeverity = 0;
            target.Disinfected = true;
            return new TreatResult(true, $"Treated infection in {target.Part}. Infection cleared.");
        }
        target.Disinfected = true;
        return new TreatResult(true, $"Disinfected {target.Type} on {target.Part}. Infection prevented.");
    }

    /// <summary>Take a painkiller — suppresses pain, raises shock threshold.</summary>
    public TreatResult TakePainkiller()
    {
        PainSuppression     = 20;
        ShockThresholdBonus = 40;
        _painHistory.Clear();
        if (InShock)
        {
            InShock = false;
            return new TreatResult(true, "Painkiller takes effect. Pain fades. Shock subsides.");
        }
        return new TreatResult(true, "Painkiller takes effect. Pain dulled for a while.");
    }

    public sealed record class MedicalSummary(
        int TotalWounds, int Unbandaged, int Infected, int Unsterilized,
        bool InShock, bool PainSuppressed, double PainLevel, int BloodPercent);

    public MedicalSummary GetMedicalSummary()
    {
        int unbandaged = 0, infected = 0, unster = 0;
        double pain = 0;
        foreach (var w in Wounds)
        {
            if (!w.Bandaged    && w.Type != "internal") unbandaged++;
            if (w.Infected) infected++;
            if (!w.Disinfected && w.Type != "internal") unster++;
        }
        foreach (var p in _painHistory) pain += p.amount;
        return new MedicalSummary(
            Wounds.Count, unbandaged, infected, unster,
            InShock, PainSuppression > 0, pain, (int)GetBloodPercent());
    }

    public bool InstallCybernetic(string cyberneticData, string slot) => true;

    // ── Damage application ────────────────────────────────────────────

    public readonly record struct DamageResult(BodyPart Part, bool Destroyed);

    /// <summary>
    /// Apply <paramref name="damage"/> HP to the part at <paramref name="path"/>.
    /// Returns null if the path doesn't resolve. Marks the part non-functional
    /// when its HP first reaches zero.
    /// </summary>
    public DamageResult? DamagePart(string path, int damage, string damageType = "blunt")
    {
        if (!_parts.TryGetValue(path, out var part)) return null;
        bool wasFunctional = part.Functional;
        part.Hp = Math.Max(0, part.Hp - damage);
        part.LastDamageType = damageType;
        if (part.Hp <= 0 && wasFunctional) part.Functional = false;
        return new DamageResult(part, part.Hp <= 0 && wasFunctional);
    }

    // ── Static part-status colorizer (used by Character/Anatomy screen) ──

    public static PartStatus GetPartStatus(BodyPart part)
    {
        double pct = (part.Hp / (double)part.MaxHp) * 100;
        string dtype = part.LastDamageType ?? "blunt";

        if (!part.Functional) return new PartStatus("DESTROYED", CLR_DESTROYED);
        if (pct >= 100)       return new PartStatus("Healthy",   CLR_HEALTHY);

        if (dtype == "sharp")
        {
            if (pct < 25) return new PartStatus("Mangled",   CLR_CRITICAL);
            if (pct < 50) return new PartStatus("Cut Deep",  CLR_WOOZY);
            if (pct < 80) return new PartStatus("Cut",       CLR_LIGHT);
            return                 new PartStatus("Nicked",    CLR_OK_LIGHT);
        }
        if (dtype == "stab")
        {
            if (pct < 25) return new PartStatus("Perforated", CLR_CRITICAL);
            if (pct < 50) return new PartStatus("Punctured",  CLR_WOOZY);
            if (pct < 80) return new PartStatus("Stabbed",    CLR_LIGHT);
            return                 new PartStatus("Pierced",    CLR_OK_LIGHT);
        }
        // blunt / unarmed
        if (pct < 25) return new PartStatus("Crushed",   CLR_CRITICAL);
        if (pct < 50) return new PartStatus("Battered",  CLR_WOOZY);
        if (pct < 80) return new PartStatus("Bruised",   CLR_LIGHT);
        return                 new PartStatus("Sore",     CLR_OK_LIGHT);
    }
}
