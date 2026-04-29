using Nightrun.Content;

namespace Nightrun.Entities;

/// <summary>
/// The player character. Spawns with a background-specific starting kit so
/// the first turn already has a worn outfit, a backpack, a wielded weapon,
/// and a little food. Hunger/Thirst stats are tracked here so <see cref="Nightrun.Systems.ItemSystem"/>
/// has somewhere to deposit consumption gains. Chargen fields (CharacterName,
/// Gender, Background, traits) mirror <c>src/entities/Player.js</c>.
/// </summary>
public sealed class Player : Entity
{
    public int ViewRadius = 14;

    // Basic survival stats — 0..Max, higher = better fed / hydrated.
    public int Hunger    = 100;
    public int MaxHunger = 100;
    public int Thirst    = 100;
    public int MaxThirst = 100;

    // Decay rates per turn (1 turn ≈ 30 s game time).
    // Thirst: -1 every 5 turns  → runs out in ~500 turns  (~2-3 zones of exploration)
    // Hunger: -1 every 10 turns → runs out in ~1000 turns (~4-5 zones of exploration)
    public int HungerDecayPerTurn = 0;
    public int ThirstDecayPerTurn = 0;
    private int _hungerTickAcc = 0;
    private int _thirstTickAcc = 0;

    /// <summary>Advance hunger/thirst by one turn. Anatomy damage when starved/dehydrated.</summary>
    public void TickSurvival(Anatomy anatomy, int currentTurn)
    {
        // Thirst: -1 every 5 turns
        _thirstTickAcc++;
        if (_thirstTickAcc >= 5) { _thirstTickAcc = 0; Thirst = Math.Max(0, Thirst - 1); }

        // Hunger: -1 every 10 turns
        _hungerTickAcc++;
        if (_hungerTickAcc >= 10) { _hungerTickAcc = 0; Hunger = Math.Max(0, Hunger - 1); }

        // Organ damage when empty
        if (Thirst <= 0)
            anatomy.AddWound("kidneys", 0.4, "internal");
        if (Hunger <= 0)
            anatomy.AddWound("stomach", 0.3, "internal");
    }

    // ── Character identity / chargen result ─────────────────────────────
    /// <summary>The name the player picked. <see cref="Entity.Name"/> stays
    /// "You" for second-person log grammar.</summary>
    public string CharacterName = "Survivor";
    public string Gender        = "other";

    /// <summary>Which of the three Origins (Flesh / Metal / Echo) this character embodies.
    /// Gates entire system trees — set at chargen, never changes during a run.</summary>
    public Origin Origin = Origin.Flesh;

    /// <summary>Display name of the chosen background (e.g. "Street Kid").</summary>
    public string  Background       = "";
    public string  BackgroundId     = "";
    public List<string> BackgroundTraits = new();
    public List<string> SelectedTraits   = new();

    /// <summary>Accumulated trait effect overlay — e.g. <c>carryMod</c>,
    /// <c>visionBonus</c>. Consumers look up keys they care about with a
    /// sensible default.</summary>
    public Dictionary<string, double> TraitEffects = new();

    /// <summary>Effective carry-capacity multiplier from traits (e.g. Pack Rat = 1.2).</summary>
    public double CarryMod     => TraitEffects.TryGetValue("carryMod",     out var v) ? v : 1.0;
    /// <summary>Action-cost multiplier from traits (Quick Reflexes = 0.9, Clumsy = 1.1).</summary>
    public double ActionCostMod => TraitEffects.TryGetValue("actionCostMod", out var v) ? v : 1.0;
    /// <summary>Poison / contamination resistance from Iron Stomach / Wasteland Survivor.</summary>
    public double PoisonResist  => TraitEffects.TryGetValue("poisonResist",  out var v) ? v : 0.0;
    /// <summary>Flat hit-chance bonus from Streetwise / Combat Veteran.</summary>
    public double HitBonus      => TraitEffects.TryGetValue("hitBonus",      out var v) ? v : 0;
    /// <summary>Flat crit-chance bonus from Keen Eye / Lucky.</summary>
    public double CritBonus     => TraitEffects.TryGetValue("critBonus",     out var v) ? v : 0;
    /// <summary>Luck bonus for crit/loot (Lucky trait).</summary>
    public double LuckBonus     => TraitEffects.TryGetValue("luckBonus",     out var v) ? v : 0;
    /// <summary>Healing effectiveness multiplier (Medical Training = 1.5, Slow Healer = 0.5).</summary>
    public double HealingMod    => TraitEffects.TryGetValue("healingMod",    out var v) ? v : 1.0;
    /// <summary>Crafting time multiplier (Tech Savvy = 0.8).</summary>
    public double CraftTimeMod  => TraitEffects.TryGetValue("craftTimeMod",  out var v) ? v : 1.0;
    /// <summary>Pain/shock threshold bonus (Combat Veteran = +15).</summary>
    public double PainThresholdBonus => TraitEffects.TryGetValue("painThresholdBonus", out var v) ? v : 0;
    /// <summary>Effective Endurance bonus (Wasteland Survivor = +2).</summary>
    public double EndBonus      => TraitEffects.TryGetValue("endBonus",      out var v) ? v : 0;
    /// <summary>Effective Intelligence bonus (Tech Savvy = +2).</summary>
    public double IntBonus      => TraitEffects.TryGetValue("intBonus",      out var v) ? v : 0;
    /// <summary>Unarmed-only hit bonus (Brawler = +15).</summary>
    public double UnarmedHitBonus  => TraitEffects.TryGetValue("unarmedHitBonus",  out var v) ? v : 0;
    /// <summary>Unarmed-only flat damage bonus (Brawler = +2).</summary>
    public double UnarmedDmgBonus  => TraitEffects.TryGetValue("unarmedDmgBonus",  out var v) ? v : 0;
    /// <summary>Flat damage reduction on incoming hits (Thick-Skinned = 1).</summary>
    public double FlatDmgReduction => TraitEffects.TryGetValue("flatDmgReduction", out var v) ? v : 0;
    /// <summary>Adrenaline rush flag — when set, below 50% blood gives speed boost.</summary>
    public double AdrenalineRush   => TraitEffects.TryGetValue("adrenalineRush",   out var v) ? v : 0;
    /// <summary>Extra stagger vulnerability from Brittle Bones.</summary>
    public double StaggerVuln      => TraitEffects.TryGetValue("staggerVuln",      out var v) ? v : 0;
    /// <summary>Extra pain per hit from Thin-Skinned.</summary>
    public double PainVuln         => TraitEffects.TryGetValue("painVuln",         out var v) ? v : 0;

    // ── Echo: Instability meter ─────────────────────────────────────────────
    /// <summary>
    /// Echo-only: current Instability. Abilities add to this; reaching 100
    /// fragments the mind and ends the run (checked in Game.TickTurn).
    /// For Flesh/Metal characters this is always 0 and never changes.
    /// </summary>
    public int Instability    = 0;
    public int MaxInstability = 100;

    /// <summary>Add instability, capped at MaxInstability. Returns true if the run should end.</summary>
    public bool AddInstability(int amount)
    {
        if (Origin != Origin.Echo) return false;
        Instability = Math.Min(MaxInstability, Instability + amount);
        return Instability >= MaxInstability;
    }

    // ── Talent tree (F6) ────────────────────────────────────────────────────
    /// <summary>Unspent talent points available to invest in trees.</summary>
    public int TalentPoints = 0;

    /// <summary>Set of talent IDs the player has unlocked this run.</summary>
    public HashSet<string> UnlockedTalents = new();

    /// <summary>Quick lookup: does the player have a given talent?</summary>
    public bool HasTalent(string id) => UnlockedTalents.Contains(id);

    public Player(int x, int y, CharacterData? data = null)
        : base("You", '@', 226 /* yellow */, 0)
    {
        X = x; Y = y; Z = 0;
        Blocks = true;
        Anatomy = new Anatomy();
        Anatomy.Init();

        data ??= CharacterData.Default;
        CharacterName = data.Name;
        Gender        = data.Gender;
        Origin        = data.Origin;
        Stats = new Stats
        {
            Strength     = data.Strength,
            Agility      = data.Agility,
            Endurance    = data.Endurance,
            Intelligence = data.Intelligence,
            Perception   = data.Perception,
        };

        // Background + traits apply their stat mods / effect overlay.
        CharacterCreation.ApplyBackgroundToCharacter(this, data.BackgroundId);
        CharacterCreation.ApplyTraitsToCharacter(this, data.Traits);

        // Apply vision trait modifiers now that TraitEffects is populated.
        if (TraitEffects.TryGetValue("visionBonus",   out var vb)) ViewRadius += (int)vb;
        if (TraitEffects.TryGetValue("visionPenalty", out var vp)) ViewRadius -= (int)vp;
        if (ViewRadius < 3) ViewRadius = 3;

        // weakConstitution: lower anatomy blood pool to simulate reduced max HP
        if (TraitEffects.TryGetValue("maxHPMod", out var hpMod) && hpMod < 0 && Anatomy != null)
        {
            // Reduce max blood proportionally (-10 maxHP → 90% blood cap)
            int newMax = Math.Max(30, Anatomy.MaxBlood + (int)hpMod);
            Anatomy.SetMaxBlood(newMax);
        }

        // Trait-based anatomy modifiers
        if (Anatomy != null)
        {
            Anatomy.TraitPainThresholdBonus = (int)PainThresholdBonus;
            Anatomy.HealingMod             = HealingMod;
        }

        // Effective stat bonuses from traits (Wasteland Survivor END+2, Tech Savvy INT+2)
        if (EndBonus != 0) Stats.Endurance    = Math.Max(1, Stats.Endurance    + (int)EndBonus);
        if (IntBonus != 0) Stats.Intelligence = Math.Max(1, Stats.Intelligence + (int)IntBonus);

        GiveStartingLoadout();
    }

    /// <summary>
    /// Per-background starting loadout. 1:1 port of <c>giveStartingLoadout()</c>
    /// in <c>src/core/Game.js</c>: base gear (coat, pants, backpack) for
    /// everyone, then a <see cref="CharacterCreation.Loadouts"/> lookup for
    /// the background-specific equip/inventory items. Food + can-opener +
    /// medkit are kept from the original C# starting kit because the JS
    /// version grants them via loot tables at spawn — close enough to call
    /// them baseline survival gear.
    /// </summary>
    private void GiveStartingLoadout()
    {
        // Base gear — everyone
        if (ItemCatalog.CreateByFamily("pants")      is Item pants) Equipment.Legs  = pants;
        if (ItemCatalog.CreateByFamily("trenchcoat") is Item coat)  Equipment.Torso = coat;
        if (ItemCatalog.CreateByFamily("backpack")   is Item pack)  Equipment.Back  = pack;

        // Background-specific loadout
        var loadout = CharacterCreation.Loadouts.TryGetValue(BackgroundId, out var l)
            ? l
            : CharacterCreation.Loadouts["streetKid"];

        foreach (var (slotName, familyId) in loadout.Equip)
        {
            var item = ItemCatalog.CreateByFamily(familyId);
            if (item == null) continue;
            switch (slotName)
            {
                case "rightHand": Equipment.RHand = item; break;
                case "leftHand":  Equipment.LHand = item; break;
                case "torso":     Equipment.Torso = item; break;
                case "legs":      Equipment.Legs  = item; break;
                case "back":      Equipment.Back  = item; break;
                case "head":      Equipment.Head  = item; break;
            }
        }

        foreach (var familyId in loadout.Inventory)
        {
            var item = ItemCatalog.CreateByFamily(familyId);
            if (item == null) continue;
            // Flashlights and lanterns start OFF (JS line 301-303).
            if (familyId is "flashlight" or "lantern") item.IsLit = false;
            Inventory.FindFit(item)?.TryAdd(item);
        }

        // Baseline survival goodies common to every starting character.
        if (ItemCatalog.CreateSealedCanOfBeans()     is Item can) Inventory.FindFit(can)?.TryAdd(can);
        if (ItemCatalog.CreateSealedBottleOfWater()  is Item btl) Inventory.FindFit(btl)?.TryAdd(btl);
        if (ItemCatalog.CreateByFamily("can_opener") is Item co)  Inventory.FindFit(co)?.TryAdd(co);
        if (ItemCatalog.CreateStockedMedkit()        is Item kit) Inventory.FindFit(kit)?.TryAdd(kit);
    }
}
