using Nightrun.Entities;

namespace Nightrun.Content;

/// <summary>
/// Which of the three fundamental human-machine spectrums this character
/// embodies. Origin gates entire system trees — no mixing allowed:
///   Flesh  — generalist; tinkering/crafting, most extraction paths; no cybernetics/Echo.
///   Metal  — cybernetics only; electronics/weapon-mod crafting; EMP-vulnerable.
///   Echo   — psychic/digital resonance only; Instability meter; no cybernetics/crafting.
/// </summary>
public enum Origin : byte { Flesh, Metal, Echo }

/// <summary>
/// Per-origin flavour shown in the chargen description panel.
/// </summary>
public static class OriginInfo
{
    public static string Name(Origin o) => o switch
    {
        Origin.Flesh => "Flesh",
        Origin.Metal => "Metal",
        Origin.Echo  => "Echo",
        _            => "Unknown",
    };

    public static string Description(Origin o) => o switch
    {
        Origin.Flesh =>
            "Pure human. No implants, no resonance. Access to full crafting, tinkering, and the widest range of extraction paths. Adaptable but ungated.",
        Origin.Metal =>
            "Augmented with cybernetic hardware. Powerful implants installed by surgeon NPCs — but EMP is your worst enemy. Crafting limited to electronics and weapon mods.",
        Origin.Echo =>
            "Tuned to the digital psychic residue of the old network. Abilities cost Instability, not mana. Reach 100 Instability and your mind fragments — the run ends, not your body.",
        _ => "",
    };

    public static string LockedSystems(Origin o) => o switch
    {
        Origin.Flesh => "Locked: Cybernetics, Echo abilities",
        Origin.Metal => "Locked: Echo abilities, full crafting",
        Origin.Echo  => "Locked: Cybernetics, all crafting",
        _ => "",
    };
}

/// <summary>
/// Player background. The <see cref="BgOrigin"/> field groups backgrounds
/// under their parent Origin — backgrounds are filtered in chargen to only
/// show those matching the player's chosen Origin.
/// </summary>
public sealed record Background(
    string Id,
    string Name,
    string Description,
    Origin BgOrigin,
    IReadOnlyDictionary<string, int> StatMods,
    IReadOnlyList<string> StartingGear,
    IReadOnlyList<string> Traits);

/// <summary>
/// Pickable trait — positive (costs points) or negative (grants points).
/// <see cref="Effect"/> is a free-form string→int map mirroring the JS
/// <c>effect</c> object; the player's <see cref="Entities.Player.TraitEffects"/>
/// is the accumulated overlay of all selected traits.
/// </summary>
public sealed record Trait(
    string Id,
    string Name,
    string Description,
    int Cost,
    TraitKind Kind,
    IReadOnlyDictionary<string, double> Effect);

public enum TraitKind : byte { Positive, Negative }

/// <summary>
/// Per-background gear loadout resolved at game start. Port of the
/// <c>LOADOUTS</c> table inside <c>Game.giveStartingLoadout()</c>. Stored as
/// item-family ids resolved via <see cref="ItemCatalog"/>.
/// </summary>
public sealed record StartingLoadout(
    IReadOnlyDictionary<string, string> Equip,   // slot name → item family id
    IReadOnlyList<string> Inventory);

/// <summary>
/// Frozen snapshot of everything the character-creation flow captured, fed
/// into the <see cref="Entities.Player"/> constructor. Mirrors the JS
/// <c>characterData</c> object. <see cref="Traits"/> is the set of
/// player-chosen trait ids (not background-implied traits).
/// </summary>
public sealed record CharacterData(
    string Name,
    string Gender,
    Origin Origin,
    int Strength,
    int Agility,
    int Endurance,
    int Intelligence,
    int Perception,
    string BackgroundId,
    IReadOnlyList<string> Traits)
{
    public static CharacterData Default => new(
        Name: "Survivor",
        Gender: "other",
        Origin: Origin.Flesh,
        Strength: 10, Agility: 10, Endurance: 10, Intelligence: 10, Perception: 10,
        BackgroundId: "streetKid",
        Traits: Array.Empty<string>());
}

/// <summary>
/// Static catalog of backgrounds, traits, and per-background loadouts. Data
/// is byte-for-byte a port of <c>CharacterCreationSystem</c> plus the
/// <c>LOADOUTS</c> table from <c>Game.giveStartingLoadout()</c>.
/// </summary>
public static class CharacterCreation
{
    public const int StartingTraitPoints = 3;
    public const int StatPointsTotal     = 50;
    public const int StatMin             = 1;
    public const int StatMax             = 20;

    // ---- Backgrounds ----
    public static readonly IReadOnlyList<Background> Backgrounds = new Background[]
    {
        new("streetKid", "Street Kid",
            "Born in the ruins, raised by the streets. You know every alley, every hiding spot, every way to survive when you have nothing.",
            Origin.Flesh,
            new Dictionary<string, int> { ["agility"] = 2, ["perception"] = 1, ["intelligence"] = -1 },
            new[] { "rusty_knife", "torn_jacket", "lockpick" },
            new[] { "streetwise" }),

        new("corpo", "Corporate Defector",
            "You escaped the corporate towers with your life and little else. Your technical knowledge is valuable, but your soft hands betray your past.",
            Origin.Flesh,
            new Dictionary<string, int> { ["intelligence"] = 3, ["perception"] = 1, ["strength"] = -2 },
            new[] { "datapad", "corpo_suit", "access_card" },
            new[] { "tech_savvy" }),

        new("nomad", "Nomad",
            "The wasteland is your home. You've walked further than most, survived worse than most, and you're tougher for it.",
            Origin.Flesh,
            new Dictionary<string, int> { ["endurance"] = 2, ["strength"] = 2, ["intelligence"] = -1 },
            new[] { "hunting_rifle", "leather_jacket", "water_canteen" },
            new[] { "wasteland_survivor" }),

        new("scavenger", "Scavenger",
            "You make your living picking through the bones of the old world. You have an eye for value and know how to find what others miss.",
            Origin.Flesh,
            new Dictionary<string, int> { ["perception"] = 3, ["agility"] = 1, ["strength"] = -1 },
            new[] { "crowbar", "backpack", "flashlight" },
            new[] { "keen_eye" }),

        new("raiderDefector", "Raider Defector",
            "You left the raider gangs behind, but the skills remain. You know how to fight, how to kill, and how to survive in a world that wants you dead.",
            Origin.Flesh,
            new Dictionary<string, int> { ["strength"] = 2, ["endurance"] = 1, ["intelligence"] = -1 },
            new[] { "machete", "raider_armor", "stimpak" },
            new[] { "combat_veteran" }),

        new("medic", "Field Medic",
            "In a world of violence, healers are rare and precious. You know anatomy, medicine, and how to keep people alive against all odds.",
            Origin.Flesh,
            new Dictionary<string, int> { ["intelligence"] = 2, ["perception"] = 2, ["strength"] = -2 },
            new[] { "scalpel", "med_kit", "white_coat" },
            new[] { "medical_training" }),

        // Metal origin backgrounds
        new("augedEnforcer", "Auged Enforcer",
            "Corporate security made you what you are — chrome bones, wired reflexes, a face that scares. The implants outlasted the paycheck.",
            Origin.Metal,
            new Dictionary<string, int> { ["strength"] = 2, ["endurance"] = 2, ["intelligence"] = -1 },
            new[] { "implant_scaffold", "body_armor" },
            new[] { "combat_veteran" }),

        new("streetDoc", "Street Doc",
            "You've cracked open more skulls than a trauma surgeon and charged a fraction of the price. You do the chrome work the corpo hospitals won't touch.",
            Origin.Metal,
            new Dictionary<string, int> { ["intelligence"] = 3, ["perception"] = 1, ["endurance"] = -1 },
            new[] { "surgical_kit", "implant_scaffold" },
            new[] { "tech_savvy" }),

        // Echo origin backgrounds
        new("echoTouched", "Echo Touched",
            "The collapse left fragments of the old network alive in you. You hear signals no one else can. Every ability you use pushes you further from yourself.",
            Origin.Echo,
            new Dictionary<string, int> { ["perception"] = 3, ["intelligence"] = 1, ["endurance"] = -2 },
            new[] { "resonance_focus" },
            new[] { "nightVision" }),

        new("ghostCoder", "Ghost Coder",
            "You lived in the network before the collapse. When it died, part of you stayed inside. Now you bleed data when you think too hard.",
            Origin.Echo,
            new Dictionary<string, int> { ["intelligence"] = 3, ["agility"] = 1, ["strength"] = -2 },
            new[] { "resonance_focus" },
            new[] { "tech_savvy" }),
    };

    private static readonly Dictionary<string, Background> BgIndex
        = Backgrounds.ToDictionary(b => b.Id);

    public static Background? GetBackground(string id)
        => BgIndex.TryGetValue(id, out var b) ? b : null;

    public static IReadOnlyList<Background> BackgroundsForOrigin(Origin o)
        => Backgrounds.Where(b => b.BgOrigin == o).ToList();

    // ---- Traits ----
    public static readonly IReadOnlyList<Trait> Traits = new Trait[]
    {
        // Background-implied traits (Cost 0 — granted by background, not purchased)
        new("streetwise", "Streetwise",
            "Street-fighting instincts. +10 hit chance in melee, +1 vision in dim light.",
            Cost: 0, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["hitBonus"] = 10, ["visionBonus"] = 1 }),

        new("tech_savvy", "Tech Savvy",
            "Deep technical knowledge. Crafting takes 20% less time. +2 effective Intelligence for device interaction.",
            Cost: 0, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["craftTimeMod"] = 0.8, ["intBonus"] = 2 }),

        new("wasteland_survivor", "Wasteland Survivor",
            "Hardened by the wastes. 30% poison resistance, +2 effective Endurance.",
            Cost: 0, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["poisonResist"] = 0.3, ["endBonus"] = 2 }),

        new("keen_eye", "Keen Eye",
            "You spot what others miss. +3 vision range, +5% crit chance.",
            Cost: 0, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["visionBonus"] = 3, ["critBonus"] = 5 }),

        new("combat_veteran", "Combat Veteran",
            "Years of violence honed your instincts. +10 hit chance, pain threshold +15.",
            Cost: 0, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["hitBonus"] = 10, ["painThresholdBonus"] = 15 }),

        new("medical_training", "Medical Training",
            "Trained in field medicine. Healing and bandaging are 50% more effective.",
            Cost: 0, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["healingMod"] = 1.5 }),

        // Positive (cost points)
        new("nightVision", "Night Vision",
            "Your eyes adapt quickly to darkness. +2 vision range in low light.",
            Cost: 2, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["visionBonus"] = 2 }),

        new("quickReflexes", "Quick Reflexes",
            "You react faster than most. -10% action cost for all actions.",
            Cost: 3, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["actionCostMod"] = 0.9 }),

        new("ironStomach", "Iron Stomach",
            "You can eat almost anything without getting sick. Reduced food poisoning chance.",
            Cost: 1, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["poisonResist"] = 0.5 }),

        new("packRat", "Pack Rat",
            "You know how to pack efficiently. +20% carrying capacity.",
            Cost: 2, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["carryMod"] = 1.2 }),

        new("lucky", "Lucky",
            "Things just seem to go your way. Better loot drops and critical hits.",
            Cost: 3, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["luckBonus"] = 2 }),

        // Negative (give points)
        new("nearSighted", "Near-Sighted",
            "You can't see as far as others. -2 vision range.",
            Cost: -2, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["visionPenalty"] = 2 }),

        new("weakConstitution", "Weak Constitution",
            "You get sick easily and tire quickly. -10 max HP.",
            Cost: -2, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["maxHPMod"] = -10 }),

        new("slowHealer", "Slow Healer",
            "Your wounds take longer to mend. -50% healing effectiveness.",
            Cost: -2, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["healingMod"] = 0.5 }),

        new("clumsy", "Clumsy",
            "You're not very coordinated. +10% action cost for all actions.",
            Cost: -2, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["actionCostMod"] = 1.1 }),

        new("lightSleeper", "Light Sleeper",
            "You wake easily and don't rest well. Reduced benefits from sleeping.",
            Cost: -1, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["restMod"] = 0.7 }),

        // ── Additional positive traits ──
        new("brawler", "Brawler",
            "You've been in more fistfights than you can count. +15% unarmed hit chance, +2 unarmed damage.",
            Cost: 2, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["unarmedHitBonus"] = 15, ["unarmedDmgBonus"] = 2 }),

        new("thickSkinned", "Thick-Skinned",
            "Your hide is like leather. +1 flat damage reduction on all hits.",
            Cost: 3, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["flatDmgReduction"] = 1 }),

        new("adrenalineJunkie", "Adrenaline Junkie",
            "Pain makes you faster. When below 50% blood, -15% action cost.",
            Cost: 2, Kind: TraitKind.Positive,
            Effect: new Dictionary<string, double> { ["adrenalineRush"] = 1 }),

        // ── Additional negative traits ──
        new("brittle", "Brittle Bones",
            "Your bones break easily. +25% chance of stagger from blunt hits.",
            Cost: -2, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["staggerVuln"] = 0.25 }),

        new("hemophilia", "Hemophilia",
            "Your blood doesn't clot well. Wounds bleed 50% longer.",
            Cost: -3, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["healingMod"] = 0.5 }),

        new("thinSkinned", "Thin-Skinned",
            "You bruise at a harsh look. +2 pain from every hit.",
            Cost: -1, Kind: TraitKind.Negative,
            Effect: new Dictionary<string, double> { ["painVuln"] = 2 }),
    };

    private static readonly Dictionary<string, Trait> TraitIndex
        = Traits.ToDictionary(t => t.Id);

    public static Trait? GetTrait(string id)
        => TraitIndex.TryGetValue(id, out var t) ? t : null;

    public static IEnumerable<Trait> PositiveTraits
        => Traits.Where(t => t.Kind == TraitKind.Positive && t.Cost > 0);

    public static IEnumerable<Trait> NegativeTraits
        => Traits.Where(t => t.Kind == TraitKind.Negative && t.Cost < 0);

    /// <summary>Running balance: starting budget minus total cost of selected traits.</summary>
    public static int CalculateTraitPoints(IEnumerable<string> selectedTraitIds)
    {
        int pts = StartingTraitPoints;
        foreach (var id in selectedTraitIds)
        {
            var t = GetTrait(id);
            if (t != null) pts -= t.Cost;
        }
        return pts;
    }

    // ---- Validation ----
    public sealed record ValidationResult(bool Valid, IReadOnlyList<string> Errors);

    public static ValidationResult Validate(CharacterData data)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(data.Name))
            errors.Add("Name is required");

        if (string.IsNullOrWhiteSpace(data.BackgroundId) || GetBackground(data.BackgroundId) == null)
            errors.Add("Background is required");

        if (CalculateTraitPoints(data.Traits) < 0)
            errors.Add("Not enough trait points");

        return new ValidationResult(errors.Count == 0, errors);
    }

    // ---- Application ----

    /// <summary>
    /// Apply background stat mods to the player and stash background label /
    /// id / implied-trait list. Mirrors <c>applyBackgroundToCharacter</c>.
    /// Stats are floored at 1 per the JS.
    /// </summary>
    public static void ApplyBackgroundToCharacter(Player player, string backgroundId)
    {
        var bg = GetBackground(backgroundId);
        if (bg == null) return;

        ref var s = ref player.Stats;
        foreach (var (stat, mod) in bg.StatMods)
        {
            switch (stat)
            {
                case "strength":     s.Strength     = Math.Max(1, s.Strength     + mod); break;
                case "agility":      s.Agility      = Math.Max(1, s.Agility      + mod); break;
                case "endurance":    s.Endurance    = Math.Max(1, s.Endurance    + mod); break;
                case "intelligence": s.Intelligence = Math.Max(1, s.Intelligence + mod); break;
                case "perception":   s.Perception   = Math.Max(1, s.Perception   + mod); break;
            }
        }

        player.Background       = bg.Name;
        player.BackgroundId     = bg.Id;
        player.BackgroundTraits = bg.Traits.ToList();

        // Apply background-implied trait effects immediately
        foreach (var traitId in bg.Traits)
        {
            var t = GetTrait(traitId);
            if (t == null) continue;
            foreach (var (k, v) in t.Effect)
                player.TraitEffects[k] = v;
        }
    }

    /// <summary>
    /// Record chosen traits on the player and merge their effects into a
    /// single overlay dict. Later traits overwrite earlier ones on the same
    /// key, matching the JS <c>Object.assign</c> behavior.
    /// </summary>
    public static void ApplyTraitsToCharacter(Player player, IReadOnlyList<string> traitIds)
    {
        player.SelectedTraits = traitIds.ToList();
        // Merge on top of existing effects (background traits already applied)
        foreach (var id in traitIds)
        {
            var t = GetTrait(id);
            if (t == null) continue;
            foreach (var (k, v) in t.Effect)
                player.TraitEffects[k] = v;
        }
    }

    // ---- Starting loadouts (port of Game.giveStartingLoadout LOADOUTS table) ----
    public static readonly IReadOnlyDictionary<string, StartingLoadout> Loadouts
        = new Dictionary<string, StartingLoadout>
    {
        ["streetKid"] = new(
            Equip:     new Dictionary<string, string> { ["rightHand"] = "shiv" },
            Inventory: new[] { "flashlight" }),

        ["corpo"] = new(
            Equip:     new Dictionary<string, string>(),
            Inventory: new[] { "flashlight", "lantern" }),

        ["nomad"] = new(
            Equip:     new Dictionary<string, string> { ["rightHand"] = "knife" },
            Inventory: new[] { "canteen" }),

        ["scavenger"] = new(
            Equip:     new Dictionary<string, string> { ["rightHand"] = "shiv" },
            Inventory: new[] { "flashlight", "lantern" }),

        ["raiderDefector"] = new(
            Equip:     new Dictionary<string, string> { ["rightHand"] = "knife" },
            Inventory: new[] { "pipe" }),

        ["medic"] = new(
            Equip:     new Dictionary<string, string>(),
            Inventory: new[] { "medkit", "flashlight" }),

        ["augedEnforcer"] = new(
            Equip:     new Dictionary<string, string> { ["rightHand"] = "pipe" },
            Inventory: new[] { "flashlight" }),

        ["streetDoc"] = new(
            Equip:     new Dictionary<string, string>(),
            Inventory: new[] { "medkit", "flashlight" }),

        ["echoTouched"] = new(
            Equip:     new Dictionary<string, string>(),
            Inventory: new[] { "flashlight" }),

        ["ghostCoder"] = new(
            Equip:     new Dictionary<string, string>(),
            Inventory: new[] { "flashlight" }),
    };
}
