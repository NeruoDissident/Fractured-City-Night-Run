namespace Nightrun.Content;

/// <summary>
/// Item family registry. Each entry is a template cloned when the loot system
/// or inventory code requests an instance. Templates carry all the metadata
/// (tags, nutrition, pocket specs, open methods) that the runtime needs.
///
/// Family IDs match the JS ContentManager.js keys so the same loot tables work.
/// </summary>
public static class ItemCatalog
{
    private static readonly Dictionary<string, Item> Families = Build();
    private static readonly Dictionary<string, Item> Components = BuildComponents();

    public static Item? CreateByFamily(string familyId)
        => Families.TryGetValue(familyId, out var t) ? t.Clone() : null;

    public static Item? CreateByComponent(string componentId)
        => Components.TryGetValue(componentId, out var t) ? t.Clone() : null;

    /// <summary>
    /// Unified lookup — families first, components second. Lets the crafting
    /// system resolve a recipe's <c>OutputFamilyId</c> without caring whether
    /// the target is a top-level family (knife) or a crafted intermediate
    /// that also lives in the component library (crude_blade, strap).
    /// </summary>
    public static Item? Create(string id)
        => CreateByFamily(id) ?? CreateByComponent(id);

    public static IEnumerable<string> FamilyIds => Families.Keys;
    public static IEnumerable<string> ComponentIds => Components.Keys;

    /// <summary>
    /// Factory for a new sealed can with a fresh beans inside (the most common
    /// pairing in the JS loot world). Returns null if catalog fails to build.
    /// </summary>
    public static Item? CreateSealedCanOfBeans()
    {
        var can = CreateByFamily("can_sealed");
        var beans = CreateByFamily("beans");
        if (can == null || beans == null) return can;
        return can.WithContents(beans);
    }

    /// <summary>Factory for a new sealed bottle with water inside.</summary>
    public static Item? CreateSealedBottleOfWater()
    {
        var btl = CreateByFamily("bottle_sealed");
        var water = CreateByFamily("water");
        if (btl == null || water == null) return btl;
        return btl.WithContents(water);
    }

    /// <summary>
    /// Factory for a fresh medkit pre-stocked with the standard randomized
    /// supply set (mirrors JS createMedkit): 1-4 bandages, 0-2 antiseptic,
    /// 0-3 painkillers. Returns just the medkit shell if any spawn fails.
    /// </summary>
    public static Item? CreateStockedMedkit(Random? rng = null)
    {
        rng ??= Random.Shared;
        var kit = CreateByFamily("medkit");
        if (kit == null || kit.Pockets.Length == 0) return kit;
        var pocket = kit.Pockets[0];

        int bandages   = 1 + rng.Next(4);
        int antiseptic = rng.Next(3);
        int painkillers= rng.Next(4);

        for (int i = 0; i < bandages   ; i++)
            if (CreateByFamily("bandage")   is { } b) pocket.TryAdd(b);
        for (int i = 0; i < antiseptic ; i++)
            if (CreateByFamily("antiseptic") is { } a) pocket.TryAdd(a);
        for (int i = 0; i < painkillers; i++)
            if (CreateByFamily("painkiller") is { } p) pocket.TryAdd(p);

        return kit;
    }

    private static Dictionary<string, Item> Build()
    {
        var d = new Dictionary<string, Item>();

        // ========================================================
        // FOOD & DRINK (loose consumables — go inside containers)
        // ========================================================
        d["beans"] = new()
        {
            FamilyId = "beans", Name = "Beans", Glyph = '*', Fg = 172,
            Weight = 400, Volume = 350, Quantity = 400, QuantityUnit = "g",
            Stackable = true, Category = "food",
            Nutrition = new Nutrition { Hunger = 30, Thirst = -5 },
            Tags = { "food", "protein", "stackable" },
        };
        d["soup"] = new()
        {
            FamilyId = "soup", Name = "Soup", Glyph = '*', Fg = 215,
            Weight = 350, Volume = 300, Quantity = 350, QuantityUnit = "g",
            Stackable = true, Category = "food",
            Nutrition = new Nutrition { Hunger = 25, Thirst = 10 },
            Tags = { "food", "liquid", "stackable" },
        };
        d["mystery_meat"] = new()
        {
            FamilyId = "mystery_meat", Name = "Mystery Meat", Glyph = '*', Fg = 131,
            Weight = 300, Volume = 250, Quantity = 300, QuantityUnit = "g",
            Stackable = true, Category = "food",
            Nutrition = new Nutrition { Hunger = 35, Thirst = -10 },
            Tags = { "food", "protein", "stackable" },
        };
        d["water"] = new()
        {
            FamilyId = "water", Name = "Water", Glyph = '~', Fg = 75,
            Weight = 500, Volume = 500, Quantity = 500, QuantityUnit = "ml",
            Stackable = true, Category = "drink",
            Nutrition = new Nutrition { Hunger = 0, Thirst = 40 },
            Tags = { "drink", "liquid", "stackable" },
        };

        // ========================================================
        // MEDICAL SUPPLIES (consume to apply Anatomy treatment)
        // ========================================================
        // Medical supplies are also valid crafting components — setting
        // IsComponent/Properties/ComponentId mirrors the component-library
        // copies so a loot-spawned bandage still satisfies a medical:1
        // recipe requirement.
        d["bandage"] = new()
        {
            FamilyId = "bandage", ComponentId = "bandage", Name = "Bandage",
            Glyph = ',', Fg = 254,
            Weight = 20, Volume = 30, Stackable = true, Category = "medical",
            IsComponent = true, MedicalEffect = "bandage",
            Tags = { "medical", "fabric", "stackable" },
            Properties = new() { ["medical"] = 1 },
        };
        d["antiseptic"] = new()
        {
            FamilyId = "antiseptic", ComponentId = "antiseptic", Name = "Antiseptic",
            Glyph = '!', Fg = 51,
            Weight = 50, Volume = 50, Stackable = true, Category = "medical",
            IsComponent = true, MedicalEffect = "antiseptic",
            Tags = { "medical", "liquid", "chemical", "stackable" },
            Properties = new() { ["medical"] = 2, ["chemical"] = 1 },
        };
        d["painkiller"] = new()
        {
            FamilyId = "painkiller", ComponentId = "painkiller", Name = "Painkiller",
            Glyph = '*', Fg = 207,
            Weight = 10, Volume = 5, Stackable = true, Category = "medical",
            IsComponent = true, MedicalEffect = "painkiller",
            Tags = { "medical", "drug", "stackable" },
            Properties = new() { ["medical"] = 2 },
        };

        // ========================================================
        // SEALED CONTAINERS (starting state: sealed, closed, empty)
        // Callers (loot / factories) populate contents after creation.
        // ========================================================
        d["can_sealed"] = new()
        {
            FamilyId = "can_sealed", Name = "Sealed Can", Glyph = 'c', Fg = 244,
            Weight = 100, Volume = 150, Category = "container",
            IsContainer = true, RequiresOpener = true,
            State = new ItemState { Sealed = true, Opened = false },
            OpenMethods = new()
            {
                ["can_opener"] = new OpenMethod(1.00, 0),
                ["knife"]      = new OpenMethod(0.80, 5),
                ["pipe"]       = new OpenMethod(0.50, 3),
                ["ground"]     = new OpenMethod(0.15, 0),
            },
            PocketSpecs = new[] { new PocketSpec("Contents", 600, 600) },
            Tags = { "container", "sealed", "metal" },
            Slot = EquipSlot.Hand,
        };
        d["bottle_sealed"] = new()
        {
            FamilyId = "bottle_sealed", Name = "Sealed Bottle", Glyph = 'b', Fg = 67,
            Weight = 50, Volume = 120, Category = "container",
            IsContainer = true, RequiresOpener = false,
            State = new ItemState { Sealed = true, Opened = false },
            OpenMethods = new()
            {
                ["hand"]  = new OpenMethod(1.00, 0),
                ["knife"] = new OpenMethod(0.95, 2),
            },
            PocketSpecs = new[] { new PocketSpec("Contents", 800, 800) },
            Tags = { "container", "sealed", "plastic" },
            Slot = EquipSlot.Hand,
        };
        d["canteen"] = new()
        {
            FamilyId = "canteen", Name = "Canteen", Glyph = 'b', Fg = 130,
            Weight = 200, Volume = 250, Category = "container",
            IsContainer = true, RequiresOpener = false,
            State = new ItemState { Sealed = false, Opened = true },  // refillable, starts open
            PocketSpecs = new[] { new PocketSpec("Canteen", 1000, 1000) },
            Tags = { "container", "plastic" },
            Slot = EquipSlot.Hand,
        };
        d["medkit"] = new()
        {
            FamilyId = "medkit", Name = "Medkit", Glyph = '+', Fg = 196,
            Weight = 100, Volume = 200, Category = "container",
            IsContainer = true, RequiresOpener = false,
            State = new ItemState { Sealed = false, Opened = true },  // always accessible
            PocketSpecs = new[] { new PocketSpec("Medical Supplies", 500, 400) },
            Tags = { "container", "medical" },
            Slot = EquipSlot.Hand,
        };

        // ========================================================
        // TOOLS
        // ========================================================
        d["can_opener"] = new()
        {
            FamilyId = "can_opener", Name = "Can Opener", Glyph = '/', Fg = 244,
            Weight = 80, Volume = 100, Category = "tool", Slot = EquipSlot.Hand,
            Tags = { "tool", "opener" },
        };
        d["battery"] = new()
        {
            FamilyId = "battery", Name = "Battery", Glyph = '*', Fg = 226,
            Weight = 50, Volume = 30, Category = "tool", Slot = EquipSlot.Hand,
            Tags = { "power", "component" },
        };
        // Handheld lights: flashlight = tight cool beam, lantern = warm wash.
        // Both start unlit with full fuel; the player toggles them via 'u'
        // from inventory. Fuel decays per turn while lit.
        d["flashlight"] = new()
        {
            FamilyId = "flashlight", Name = "Flashlight", Glyph = '/', Fg = 220,
            Weight = 250, Volume = 200, Category = "tool", Slot = EquipSlot.Hand,
            Tags = { "tool", "light" },
            LightRadius = 8, LightColor = 195,          // cool white
            RequiresFuel = true,
            LightFuel = 500, MaxLightFuel = 500,
        };
        d["lantern"] = new()
        {
            FamilyId = "lantern", Name = "Lantern", Glyph = 'f', Fg = 215,
            Weight = 600, Volume = 800, Category = "tool", Slot = EquipSlot.Hand,
            Tags = { "tool", "light" },
            LightRadius = 6, LightColor = 215,          // warm orange
            RequiresFuel = true,
            LightFuel = 800, MaxLightFuel = 800,
        };
        d["lantern_fuel"] = new()
        {
            FamilyId = "lantern_fuel", Name = "Lantern Fuel", Glyph = 'u', Fg = 208,
            Weight = 500, Volume = 500, Category = "tool",
            Tags = { "fuel" },
        };

        // ========================================================
        // WEAPONS (tagged for tool matching: sharp = knives, blunt = pipes)
        // ========================================================
        d["shiv"] = new()
        {
            FamilyId = "shiv", Name = "Shiv", Glyph = '/', Fg = 250,
            Weight = 80, Volume = 40, Category = "weapon", Slot = EquipSlot.Hand,
            Durability = 40, MaxDurability = 40,
            DamageDice = "1d4", AttackType = "sharp",
            BleedChance = 0.30, Accuracy = 5, ParryBonus = 0.05,
            Tags = { "weapon", "sharp" },
        };
        d["knife"] = new()
        {
            FamilyId = "knife", Name = "Knife", Glyph = '/', Fg = 253,
            Weight = 200, Volume = 100, Category = "weapon", Slot = EquipSlot.Hand,
            Durability = 100, MaxDurability = 100,
            DamageDice = "1d6", AttackType = "sharp",
            BleedChance = 0.40, Accuracy = 10, CritBonus = 3, ParryBonus = 0.12,
            Tags = { "weapon", "sharp" },
        };
        d["pipe"] = new()
        {
            FamilyId = "pipe", Name = "Metal Pipe", Glyph = '|', Fg = 244,
            Weight = 800, Volume = 300, Category = "weapon", Slot = EquipSlot.Hand,
            Durability = 150, MaxDurability = 150,
            DamageDice = "1d8", AttackType = "blunt",
            StaggerChance = 0.20, Accuracy = -5,
            Tags = { "weapon", "blunt", "metal" },
        };
        d["spiked_club"] = new()
        {
            FamilyId = "spiked_club", Name = "Spiked Club", Glyph = '!', Fg = 130,
            Weight = 1100, Volume = 400, Category = "weapon", Slot = EquipSlot.Hand,
            Durability = 120, MaxDurability = 120,
            DamageDice = "1d10", AttackType = "blunt",
            BleedChance = 0.20, StaggerChance = 0.25, Accuracy = -8,
            Tags = { "weapon", "blunt" },
        };

        // ========================================================
        // CLOTHING (worn containers — their pockets stay with the item)
        // ========================================================
        d["coat"] = new()
        {
            FamilyId = "coat", Name = "Coat", Glyph = '[', Fg = 130,
            Weight = 900, Volume = 1200, Category = "clothing", Slot = EquipSlot.Torso,
            Tags = { "clothing" },
            PocketSpecs = new[]
            {
                new PocketSpec("Coat Pocket L", 2000, 2500),
                new PocketSpec("Coat Pocket R", 2000, 2500),
            },
        };
        d["pants"] = new()
        {
            FamilyId = "pants", Name = "Pants", Glyph = '[', Fg = 94,
            Weight = 500, Volume = 700, Category = "clothing", Slot = EquipSlot.Legs,
            Defense = 1,
            Tags = { "clothing" },
            PocketSpecs = new[]
            {
                new PocketSpec("Left Pocket", 1500, 1500),
                new PocketSpec("Right Pocket", 1500, 1500),
            },
        };
        d["trenchcoat"] = new()
        {
            FamilyId = "trenchcoat", Name = "Trenchcoat", Glyph = '[', Fg = 52,
            Weight = 1200, Volume = 1600, Category = "clothing", Slot = EquipSlot.Torso,
            Defense = 2,
            Tags = { "clothing", "leather" },
            PocketSpecs = new[]
            {
                new PocketSpec("Trench Pocket L", 3000, 4000),
                new PocketSpec("Trench Pocket R", 3000, 4000),
                new PocketSpec("Inner Pocket",    1500, 1500),
            },
        };
        d["backpack"] = new()
        {
            FamilyId = "backpack", Name = "Backpack", Glyph = '{', Fg = 94,
            Weight = 700, Volume = 1000, Category = "container", Slot = EquipSlot.Back,
            IsContainer = true,
            State = new ItemState { Sealed = false, Opened = true },
            Tags = { "container", "worn" },
            PocketSpecs = new[]
            {
                new PocketSpec("Main Compartment", 20000, 25000),
                new PocketSpec("Side Pouch",        2000,  3000),
            },
        };
        d["strap"] = new()
        {
            FamilyId = "strap", Name = "Strap", Glyph = '-', Fg = 180,
            Weight = 80, Volume = 50, Category = "component",
            Tags = { "component" },
        };

        // Run Clone() once through each template so Pockets[] is materialized
        // from PocketSpecs[] — that way the templates themselves hold valid
        // runtime shape and subsequent Clone() calls deep-copy correctly.
        // (The alternative is to lazily create Pockets on first clone, but
        // doing it here keeps Clone() branch simple.)
        foreach (var key in d.Keys.ToArray())
        {
            var t = d[key];
            if (t.PocketSpecs.Length > 0 && t.Pockets.Length == 0)
            {
                t.Pockets = new Pocket[t.PocketSpecs.Length];
                for (int i = 0; i < t.PocketSpecs.Length; i++)
                    t.Pockets[i] = new Pocket(t.PocketSpecs[i]);
            }
        }

        return d;
    }

    /// <summary>
    /// Raw component library — every item the crafting system treats as
    /// a stackable building block. Each carries a <see cref="Item.Properties"/>
    /// tier map (e.g. cutting:1, grinding:2) that property-based recipe
    /// requirements read. Mirrors ContentManager.loadComponents in JS.
    /// </summary>
    private static Dictionary<string, Item> BuildComponents()
    {
        var d = new Dictionary<string, Item>();

        // ── METAL ────────────────────────────────────────────────────
        d["scrap_metal_shard"] = MakeComp("scrap_metal_shard", "Metal Shard", '/', 252,
            w:  50, v:  30, tags: new[] { "metal", "sharp" },
            props: new() { ["cutting"] = 1, ["piercing"] = 1 });
        d["metal_tube"] = MakeComp("metal_tube", "Metal Tube", '|', 252,
            w: 200, v: 150, tags: new[] { "metal", "structural" },
            props: new() { ["structural"] = 2, ["blunt"] = 1, ["grip"] = 1 });
        d["blade"] = MakeComp("blade", "Knife Blade", '/', 255,
            w:  80, v:  50, tags: new[] { "metal", "sharp" },
            props: new() { ["cutting"] = 3, ["piercing"] = 2 });
        d["rivet"] = MakeComp("rivet", "Rivet", '*', 250,
            w:   5, v:   2, tags: new[] { "metal", "fastener" },
            props: new() { ["fastening"] = 1 });
        d["screw"] = MakeComp("screw", "Screw", '*', 248,
            w:   3, v:   1, tags: new[] { "metal", "fastener" },
            props: new() { ["fastening"] = 2 });
        d["wire"] = MakeComp("wire", "Wire", '~', 220,
            w:  10, v:   5, tags: new[] { "metal", "flexible" },
            props: new() { ["binding"] = 2, ["electrical"] = 1 });
        d["blade_wheel"] = MakeComp("blade_wheel", "Cutting Wheel", 'o', 246,
            w:  30, v:  20, tags: new[] { "metal", "sharp", "tool" },
            props: new() { ["cutting"] = 2, ["piercing"] = 1 });
        d["tin_can"] = MakeComp("tin_can", "Tin Can", 'c', 244,
            w:  50, v:  80, tags: new[] { "metal", "container" },
            props: new() { ["container"] = 1 });
        d["can_lid"] = MakeComp("can_lid", "Can Lid", '-', 252,
            w:  10, v:  10, tags: new[] { "metal", "sharp" },
            props: new() { ["cutting"] = 1 });
        d["metal_casing"] = MakeComp("metal_casing", "Metal Casing", '[', 102,
            w:  15, v:   8, tags: new[] { "metal", "container" },
            props: new() { ["container"] = 1, ["structural"] = 1 });
        d["metal_bottle"] = MakeComp("metal_bottle", "Metal Bottle", 'u', 244,
            w: 150, v: 250, tags: new[] { "metal", "container", "liquid" },
            props: new() { ["container"] = 2 });
        d["nail"] = MakeComp("nail", "Nail", '|', 252,
            w:   5, v:   2, tags: new[] { "metal", "sharp", "fastener" },
            props: new() { ["piercing"] = 1, ["fastening"] = 1 });

        // ── FABRIC / LEATHER ────────────────────────────────────────
        d["fabric_panel"] = MakeComp("fabric_panel", "Fabric Panel", '=', 180,
            w: 100, v: 200, tags: new[] { "fabric", "flexible" },
            props: new() { ["padding"] = 2, ["insulation"] = 1, ["binding"] = 1 });
        d["cloth_wrap"] = MakeComp("cloth_wrap", "Cloth Wrap", '-', 250,
            w:  20, v:  30, tags: new[] { "fabric", "flexible" },
            props: new() { ["grip"] = 1, ["padding"] = 1, ["binding"] = 1 });
        d["thread"] = MakeComp("thread", "Thread", '~', 255,
            w:   5, v:  10, tags: new[] { "fabric", "binding" },
            props: new() { ["binding"] = 1, ["fastening"] = 1 });
        d["strap"] = MakeComp("strap", "Strap", '~', 215,
            w:  50, v:  80, tags: new[] { "fabric", "flexible", "structural" },
            props: new() { ["harnessing"] = 2, ["structural"] = 1 });
        d["leather_piece"] = MakeComp("leather_piece", "Leather Piece", '=', 94,
            w:  20, v:  40, tags: new[] { "leather", "flexible" },
            props: new() { ["grip"] = 2, ["padding"] = 1, ["binding"] = 1 });

        // ── PLASTIC ─────────────────────────────────────────────────
        d["plastic_bottle"] = MakeComp("plastic_bottle", "Plastic Bottle", 'b', 248,
            w:  30, v: 100, tags: new[] { "plastic", "container", "liquid" },
            props: new() { ["container"] = 1 });
        d["plastic_case"] = MakeComp("plastic_case", "Plastic Case", '[', 244,
            w:  80, v: 150, tags: new[] { "plastic", "container" },
            props: new() { ["container"] = 1 });
        d["bottle_cap"] = MakeComp("bottle_cap", "Bottle Cap", 'o', 244,
            w:   5, v:   5, tags: new[] { "plastic", "seal" },
            props: new() { ["fastening"] = 1 });
        d["screw_cap"] = MakeComp("screw_cap", "Screw Cap", 'o', 248,
            w:  20, v:  15, tags: new[] { "plastic", "seal" },
            props: new() { ["fastening"] = 1 });
        d["button"] = MakeComp("button", "Button", 'o', 252,
            w:   2, v:   1, tags: new[] { "plastic", "fastener" },
            props: new() { ["fastening"] = 1 });
        d["zipper"] = MakeComp("zipper", "Zipper", ':', 244,
            w:  15, v:  20, tags: new[] { "plastic", "metal", "fastener" },
            props: new() { ["fastening"] = 2 });
        d["buckle"] = MakeComp("buckle", "Buckle", 'x', 246,
            w:  20, v:  15, tags: new[] { "plastic", "metal", "fastener" },
            props: new() { ["fastening"] = 2, ["structural"] = 1 });

        // ── GENERIC / GRIP ──────────────────────────────────────────
        d["handle"] = MakeComp("handle", "Handle", '|', 136,
            w:  40, v:  60, tags: new[] { "wood", "plastic", "grip" },
            props: new() { ["grip"] = 3, ["structural"] = 1 });

        // ── CRAFTED INTERMEDIATES ───────────────────────────────────
        // These are produced by recipes but re-enter the component pool so
        // they can feed higher-tier recipes (crude_blade → pipe+blade weapon,
        // wrapped_handle → knife's grip). Each is stackable + wieldable with
        // minimal weapon stats, mirroring the JS itemFamilies intermediates.
        d["crude_blade"] = new()
        {
            FamilyId = "crude_blade", ComponentId = "crude_blade",
            Name = "Crude Blade", Glyph = '-', Fg = 250,
            Weight = 60, Volume = 35, Stackable = true,
            Category = "component", IsComponent = true,
            Slot = EquipSlot.Hand,
            Durability = 40, MaxDurability = 40,
            DamageDice = "1d3", AttackType = "sharp", BleedChance = 0.15,
            Tags = { "component", "metal", "sharp", "weapon" },
            Properties = new() { ["cutting"] = 2, ["piercing"] = 1 },
        };
        d["sharpened_stick"] = new()
        {
            FamilyId = "sharpened_stick", ComponentId = "sharpened_stick",
            Name = "Sharpened Stick", Glyph = '/', Fg = 136,
            Weight = 60, Volume = 80, Stackable = true,
            Category = "component", IsComponent = true,
            Slot = EquipSlot.Hand,
            Durability = 30, MaxDurability = 30,
            DamageDice = "1d3", AttackType = "sharp", BleedChance = 0.10,
            Tags = { "component", "wood", "sharp", "weapon" },
            Properties = new() { ["piercing"] = 1, ["structural"] = 1 },
        };
        d["wrapped_handle"] = new()
        {
            FamilyId = "wrapped_handle", ComponentId = "wrapped_handle",
            Name = "Wrapped Handle", Glyph = '|', Fg = 137,
            Weight = 50, Volume = 60, Stackable = true,
            Category = "component", IsComponent = true,
            Tags = { "component", "grip" },
            Properties = new() { ["grip"] = 2, ["structural"] = 1 },
        };

        // ── MEDICAL (usable + craftable) ────────────────────────────
        d["bandage"] = MakeComp("bandage", "Bandage", ',', 254,
            w:  20, v:  30, tags: new[] { "medical", "fabric" },
            props: new() { ["medical"] = 1 },
            medicalEffect: "bandage");
        d["antiseptic"] = MakeComp("antiseptic", "Antiseptic", '!', 51,
            w:  50, v:  50, tags: new[] { "medical", "liquid", "chemical" },
            props: new() { ["medical"] = 2, ["chemical"] = 1 },
            medicalEffect: "antiseptic");
        d["painkiller"] = MakeComp("painkiller", "Painkiller", '*', 207,
            w:  10, v:   5, tags: new[] { "medical", "drug" },
            props: new() { ["medical"] = 2 },
            medicalEffect: "painkiller");

        // ── POWER ────────────────────────────────────────────────────
        d["electrolyte_paste"] = MakeComp("electrolyte_paste", "Electrolyte Paste", '%', 226,
            w:   8, v:   5, tags: new[] { "chemical", "power" },
            props: new() { ["chemical"] = 2 });
        d["carbon_rod"] = MakeComp("carbon_rod", "Carbon Rod", '|', 245,
            w:   5, v:   3, tags: new[] { "carbon", "power" },
            props: new() { ["conductor"] = 2 });

        // ── RAW MATERIALS ───────────────────────────────────────────
        d["glass_shard"] = MakeComp("glass_shard", "Glass Shard", '/', 153,
            w:  15, v:  10, tags: new[] { "glass", "sharp" },
            props: new() { ["cutting"] = 1, ["piercing"] = 1 });
        d["wood_piece"] = MakeComp("wood_piece", "Wood Piece", '/', 172,
            w:  80, v: 100, tags: new[] { "wood", "structural" },
            props: new() { ["structural"] = 1, ["grip"] = 1, ["fuel"] = 1, ["hammering"] = 1 });
        d["wood_plank"] = MakeComp("wood_plank", "Wood Plank", '=', 136,
            w: 250, v: 300, tags: new[] { "wood", "structural" },
            props: new() { ["structural"] = 2, ["blunt"] = 1, ["fuel"] = 2, ["hammering"] = 1 });
        d["stone"] = MakeComp("stone", "Stone", '*', 245,
            w: 200, v:  80, tags: new[] { "stone", "blunt" },
            props: new() { ["blunt"] = 2, ["grinding"] = 2, ["hammering"] = 1 });
        d["bone_shard"] = MakeComp("bone_shard", "Bone Shard", '/', 230,
            w:  20, v:  15, tags: new[] { "bone", "sharp" },
            props: new() { ["piercing"] = 1, ["structural"] = 1 });
        d["rubber_piece"] = MakeComp("rubber_piece", "Rubber Piece", 'o', 240,
            w:  30, v:  40, tags: new[] { "rubber", "flexible" },
            props: new() { ["grip"] = 2, ["padding"] = 1, ["insulation"] = 2 });
        d["duct_tape"] = MakeComp("duct_tape", "Duct Tape", '=', 250,
            w:  40, v:  30, tags: new[] { "adhesive", "flexible" },
            props: new() { ["binding"] = 2, ["fastening"] = 1, ["grip"] = 1 });

        return d;
    }

    /// <summary>
    /// Factory for a raw library component. Sets IsComponent, ComponentId,
    /// Stackable, and the Component category so the crafting system picks
    /// it up from the player's inventory and recognises it against recipe
    /// requirements. <paramref name="props"/> is copied into
    /// <see cref="Item.Properties"/> as the tier map.
    /// </summary>
    private static Item MakeComp(
        string id,
        string name,
        char glyph,
        byte fg,
        int w,
        int v,
        string[] tags,
        Dictionary<string, int> props,
        string? medicalEffect = null)
    {
        var tagList = new List<string>(tags.Length + 1) { "component" };
        tagList.AddRange(tags);
        return new Item
        {
            FamilyId      = id,
            ComponentId   = id,
            Name          = name,
            Glyph         = glyph,
            Fg            = fg,
            Weight        = w,
            Volume        = v,
            Stackable     = true,
            Category      = "component",
            IsComponent   = true,
            Tags          = tagList,
            Properties    = props,
            MedicalEffect = medicalEffect,
        };
    }
}
