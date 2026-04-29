namespace Nightrun.Content;

/// <summary>
/// Which equipment slot this item goes in when worn/wielded.
/// None = not wearable. Hand = wieldable in either hand.
/// </summary>
public enum EquipSlot : byte
{
    None,
    Head,
    Torso,
    Arms,
    Legs,
    Feet,
    Hand,      // wieldable in LHand or RHand
    Back,      // backpack slot
}

/// <summary>
/// How a sealed container may be opened. <see cref="Yield"/> is the fraction of
/// contents preserved (0..1); the rest spills as contaminated waste. Durability
/// damage is applied to the tool used (0 if no tool, or for lossless methods).
/// Mirrors JS openMethods: { can_opener: { yield: 1.0, durabilityDamage: 0 }, ... }.
/// </summary>
public readonly record struct OpenMethod(double Yield, int DurabilityDamage);

/// <summary>Nutritional payload of a food or drink item.</summary>
public sealed class Nutrition
{
    public int Hunger;
    public int Thirst;
    public Nutrition Clone() => new() { Hunger = Hunger, Thirst = Thirst };
}

/// <summary>
/// Per-instance mutable state for an item. Sealed containers transition from
/// (Sealed=true, Opened=false) → (Sealed=false, Opened=true) when opened.
/// Opened food accumulates ContaminationLevel per turn; crossing 0.3 flips
/// Contaminated=true and causes sickness when consumed (Phase 3 hook).
/// </summary>
public sealed class ItemState
{
    public bool Sealed;
    public bool Opened;
    public bool Contaminated;
    public double ContaminationLevel;

    public ItemState Clone() => new()
    {
        Sealed             = Sealed,
        Opened             = Opened,
        Contaminated       = Contaminated,
        ContaminationLevel = ContaminationLevel,
    };
}

/// <summary>
/// Runtime item instance. Deep-cloned from the catalog templates via
/// <see cref="ItemCatalog.CreateByFamily"/> so each instance owns its own
/// mutable State, Pockets, and Nutrition. Matches JS ContentManager semantics.
/// </summary>
public sealed class Item
{
    public required string FamilyId;   // 'can_sealed', 'bottle_sealed', 'beans', ...
    public required string Name;
    public required char Glyph;
    public required byte Fg;
    public int Weight = 100;            // grams
    public int Volume = 100;            // ml
    public int Quantity = 1;            // for stackable items or food grams / drink ml
    public string QuantityUnit = "";    // "g", "ml", or "" for discrete stacks
    public bool Stackable = false;
    public string Category = "misc";    // JS `type`: food / drink / container / tool / weapon / clothing / component / medical

    // --- Equip ---
    public EquipSlot Slot = EquipSlot.None;
    public bool TwoHanded = false;

    // --- Durability ---
    public int Durability = 100;
    public int MaxDurability = 100;

    // --- Tags (for tool matching & general semantics) ---
    // Common values: "opener", "sharp", "blunt", "food", "drink", "protein",
    // "liquid", "stackable", "plastic", "metal", "medical".
    public List<string> Tags = new();

    // --- Light source ---
    // Any item can emit light when IsLit is true; LightRadius determines the
    // illumination falloff (in tiles) and LightColor tints the illuminated
    // cells. Fueled sources (flashlight, lantern) consume LightFuel per turn
    // while lit and go dark at zero. Static / cybernetic sources declare
    // RequiresFuel=false and burn forever. Mirrors the "light" sub-state on
    // JS items in Fractured City.
    public int  LightRadius    = 0;    // 0 = not a light source
    public int  LightFuel      = 0;    // remaining fuel (arbitrary units)
    public int  MaxLightFuel   = 0;
    public bool RequiresFuel   = false;
    public bool IsLit          = false;
    public byte LightColor     = 229;  // warm amber by default

    // --- Crafting ---
    // Mirrors JS ContentManager.components: items flagged IsComponent can
    // satisfy recipe requirements via Properties (tiered attribute map like
    // { "cutting": 2 }). ComponentId is the match key for specific-component
    // requirements; defaults to FamilyId for raw library components, or to
    // CraftedComponentId for crafted intermediates whose outputs should
    // re-enter the pool under a stable id. CraftedProperties take precedence
    // over Properties when the crafting system reads attribute values, so a
    // crafted "wrapped_handle" advertises grip=2 even though its base family
    // is whatever template it came from. IsSurface marks the virtual item the
    // crafting system constructs for the ground tile the player is standing
    // on (concrete → grinding:2), which is infinite and never consumed.
    public bool IsComponent = false;
    public bool IsSurface = false;
    public string? ComponentId;
    public string? CraftedComponentId;
    public Dictionary<string, int> Properties = new();
    public Dictionary<string, int>? CraftedProperties;

    // --- Container model ---
    // Container items own their own Pockets; the contents persist with the
    // item whether it is worn, held, or on the ground. This matches JS.
    // Templates declare PocketSpecs; CreateByFamily() builds the runtime
    // Pocket[] from those specs on each clone.
    public bool IsContainer = false;
    public bool RequiresOpener = false;
    public Dictionary<string, OpenMethod>? OpenMethods;
    public PocketSpec[] PocketSpecs = Array.Empty<PocketSpec>();
    public Pocket[] Pockets = Array.Empty<Pocket>();

    // --- Consumable ---
    public Nutrition? Nutrition;

    // --- Medical effect (bandage / antiseptic / painkiller) ---
    // When the player uses this item, dispatch to the matching Anatomy method.
    // Mirrors the JS `medicalEffect` field on bandage/antiseptic/painkiller components.
    public string? MedicalEffect;

    // --- Weapon stats ---
    // Mirrors JS { baseDamage, weaponStats: { attackType, bleedChance, accuracy,
    // critBonus, parryBonus, staggerChance } } from NPC_TYPES weapon tables.
    public string? DamageDice;               // "1d6", "1d8+2" — null = not a weapon
    public string AttackType = "blunt";      // "sharp" | "blunt" | "unarmed"
    public double BleedChance = 0;
    public int    Accuracy = 0;              // added to hit chance %
    public int    CritBonus = 0;             // added to crit chance %
    public double ParryBonus = 0;            // chance to deflect head/torso hits
    public double StaggerChance = 0;         // chance to stun on blunt hits

    public bool IsWeapon => DamageDice != null;

    // --- Armor ---
    // Flat damage reduction when this item is equipped and the hit lands on
    // a covered body region (see CombatSystem.ArmorCoverage map).
    public int Defense = 0;

    // --- Per-instance state ---
    public ItemState State = new();

    public bool HasTag(string tag) => Tags.Contains(tag);

    /// <summary>True if this item can be eaten or drunk directly.</summary>
    public bool IsEdible => Nutrition != null && (Category == "food" || Category == "drink");

    /// <summary>True if this item's sealed state still requires opening.</summary>
    public bool IsUnopenedContainer => IsContainer && State.Sealed && !State.Opened;

    public Item Clone()
    {
        var c = new Item
        {
            FamilyId       = FamilyId,
            Name           = Name,
            Glyph          = Glyph,
            Fg             = Fg,
            Weight         = Weight,
            Volume         = Volume,
            Quantity       = Quantity,
            QuantityUnit   = QuantityUnit,
            Stackable      = Stackable,
            Category       = Category,
            Slot           = Slot,
            TwoHanded      = TwoHanded,
            Durability     = Durability,
            MaxDurability  = MaxDurability,
            Tags           = new List<string>(Tags),
            LightRadius        = LightRadius,
            LightFuel          = LightFuel,
            MaxLightFuel       = MaxLightFuel,
            RequiresFuel       = RequiresFuel,
            IsLit              = IsLit,
            LightColor         = LightColor,
            IsComponent        = IsComponent,
            IsSurface          = IsSurface,
            ComponentId        = ComponentId,
            CraftedComponentId = CraftedComponentId,
            Properties         = new Dictionary<string, int>(Properties),
            CraftedProperties  = CraftedProperties == null
                                 ? null
                                 : new Dictionary<string, int>(CraftedProperties),
            IsContainer    = IsContainer,
            RequiresOpener = RequiresOpener,
            OpenMethods    = OpenMethods == null ? null
                             : new Dictionary<string, OpenMethod>(OpenMethods),
            PocketSpecs    = PocketSpecs,   // shared ref; specs are immutable records
            Nutrition      = Nutrition?.Clone(),
            MedicalEffect  = MedicalEffect,
            DamageDice     = DamageDice,
            AttackType     = AttackType,
            BleedChance    = BleedChance,
            Accuracy       = Accuracy,
            CritBonus      = CritBonus,
            ParryBonus     = ParryBonus,
            StaggerChance  = StaggerChance,
            Defense        = Defense,
            State          = State.Clone(),
        };

        // Deep-clone the runtime Pockets so this instance owns its own contents.
        if (Pockets.Length > 0)
        {
            c.Pockets = new Pocket[Pockets.Length];
            for (int i = 0; i < Pockets.Length; i++)
            {
                var src = Pockets[i];
                var dst = new Pocket(src.Spec);
                foreach (var content in src.Contents)
                    dst.TryAdd(content.Clone());
                c.Pockets[i] = dst;
            }
        }
        else if (PocketSpecs.Length > 0)
        {
            // Fresh container, no contents yet — materialize empty runtime pockets.
            c.Pockets = new Pocket[PocketSpecs.Length];
            for (int i = 0; i < PocketSpecs.Length; i++)
                c.Pockets[i] = new Pocket(PocketSpecs[i]);
        }

        return c;
    }

    /// <summary>
    /// Preload a container instance with a freshly-created content item.
    /// Used by catalog factories to seed a sealed can with beans, bottle with water, etc.
    /// </summary>
    public Item WithContents(params Item[] contents)
    {
        if (Pockets.Length == 0) return this;
        foreach (var it in contents)
        {
            // Drop into the first pocket that can fit
            foreach (var p in Pockets)
                if (p.TryAdd(it)) break;
        }
        return this;
    }
}
