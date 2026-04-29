namespace Nightrun.Content;

/// <summary>
/// Static registry of every craftable / disassemblable item. Each entry is
/// keyed by recipe id (same as the output family id in almost every case)
/// and carries both crafting requirements and per-tool disassembly profiles.
/// Ports the structured portion of <c>ContentManager.loadItemFamilies</c>
/// in JS — only the crafting data, visual / weapon stats stay on the
/// <see cref="Item"/> template in <see cref="ItemCatalog"/>.
/// </summary>
public static class RecipeCatalog
{
    private static readonly Dictionary<string, Recipe> All = Build();

    public static Recipe? Get(string recipeId)
        => All.TryGetValue(recipeId, out var r) ? r : null;

    /// <summary>
    /// Recipes that list at least one <see cref="RecipeRequirement"/> —
    /// i.e. actually buildable at a workbench. Disassembly-only profiles
    /// (sealed containers) are excluded.
    /// </summary>
    public static IEnumerable<Recipe> Craftable
        => All.Values.Where(r => r.Requirements.Count > 0);

    /// <summary>Look up the disassembly profile for a specific item family.</summary>
    public static Recipe? ForOutput(string familyId)
    {
        foreach (var r in All.Values)
            if (r.OutputFamilyId == familyId) return r;
        return null;
    }

    private static Dictionary<string, Recipe> Build()
    {
        var d = new Dictionary<string, Recipe>();

        // ── CRAFTED INTERMEDIATE COMPONENTS ─────────────────────────
        d["crude_blade"] = new()
        {
            RecipeId = "crude_blade", OutputFamilyId = "crude_blade",
            DisplayName = "Crude Blade", OutputType = "component",
            CraftTime = 3,
            Requirements =
            {
                new() { Property = "cutting",  MinValue = 1, Quantity = 1, Name = "Sharp Material"    },
                new() { Property = "grinding", MinValue = 1, Quantity = 1, Name = "Abrasive Surface"  },
            },
            Components =
            {
                ("scrap_metal_shard", 1),
                ("stone",             1),
            },
            DisassemblyMethods =
            {
                ["hand"] = new() { ComponentYield = 0.5, QualityMod = 0.5, TimeRequired = 1 },
            },
        };

        d["sharpened_stick"] = new()
        {
            RecipeId = "sharpened_stick", OutputFamilyId = "sharpened_stick",
            DisplayName = "Sharpened Stick", OutputType = "component",
            CraftTime = 2,
            Requirements =
            {
                new() { Property = "structural", MinValue = 1, Quantity = 1, Name = "Rigid Material"    },
                new() { Property = "grinding",   MinValue = 1, Quantity = 1, Name = "Abrasive Surface"  },
            },
            Components =
            {
                ("wood_piece", 1),
                ("stone",      1),
            },
            DisassemblyMethods =
            {
                ["hand"] = new() { ComponentYield = 0.5, QualityMod = 0.5, TimeRequired = 1 },
            },
        };

        d["wrapped_handle"] = new()
        {
            RecipeId = "wrapped_handle", OutputFamilyId = "wrapped_handle",
            DisplayName = "Wrapped Handle", OutputType = "component",
            CraftTime = 1,
            Requirements =
            {
                new() { Property = "structural", MinValue = 1, Quantity = 1, Name = "Handle Core" },
                new() { Property = "binding",    MinValue = 1, Quantity = 1, Name = "Wrapping"    },
            },
            Components =
            {
                ("wood_piece", 1),
                ("cloth_wrap", 1),
            },
            DisassemblyMethods =
            {
                ["hand"] = new() { ComponentYield = 1.0, QualityMod = 0.7, TimeRequired = 1 },
            },
        };

        d["strap"] = new()
        {
            RecipeId = "strap", OutputFamilyId = "strap",
            DisplayName = "Strap", OutputType = "component",
            CraftTime = 1,
            Requirements =
            {
                new() { Property = "padding", MinValue = 1, Quantity = 1, Name = "Flexible Material" },
            },
            Components = { ("fabric_panel", 1) },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 1.0, QualityMod = 0.8, TimeRequired = 1 },
                ["knife"] = new() { ComponentYield = 1.0, QualityMod = 0.9, TimeRequired = 1 },
            },
        };

        // ── WEAPONS ─────────────────────────────────────────────────
        d["shiv"] = new()
        {
            RecipeId = "shiv", OutputFamilyId = "shiv",
            DisplayName = "Shiv", OutputType = "weapon",
            CraftTime = 1,
            Requirements =
            {
                new() { Property = "cutting", MinValue = 1, MaxValue = 1, Quantity = 1, Name = "Small Sharp Edge" },
                new() { Property = "grip",    MinValue = 1,               Quantity = 1, Name = "Grip Wrap"        },
            },
            Components =
            {
                ("scrap_metal_shard", 1),
                ("cloth_wrap",        1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 1.0, QualityMod = 0.7, TimeRequired = 1 },
                ["knife"] = new() { ComponentYield = 1.0, QualityMod = 0.9, TimeRequired = 1 },
            },
        };

        d["knife"] = new()
        {
            RecipeId = "knife", OutputFamilyId = "knife",
            DisplayName = "Knife", OutputType = "weapon",
            CraftTime = 2,
            Requirements =
            {
                new() { Property = "cutting",   MinValue = 2, Quantity = 1, Name = "Blade"     },
                new() { Property = "grip",      MinValue = 2, Quantity = 1, Name = "Handle"    },
                new() { Property = "fastening", MinValue = 1, Quantity = 2, Name = "Fasteners" },
            },
            Components =
            {
                ("blade",  1),
                ("handle", 1),
                ("rivet",  2),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.66, QualityMod = 0.6, TimeRequired = 2,
                                    ExcludeComponents = new() { "rivet" } },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.85, TimeRequired = 1 },
            },
        };

        d["pipe"] = new()
        {
            RecipeId = "pipe", OutputFamilyId = "pipe",
            DisplayName = "Pipe", OutputType = "weapon",
            CraftTime = 1,
            Requirements =
            {
                new() { ComponentId = "metal_tube", Quantity = 1, Name = "Metal Tube" },
            },
            Components = { ("metal_tube", 1) },
            DisassemblyMethods =
            {
                ["hand"] = new() { ComponentYield = 1.0, QualityMod = 0.9, TimeRequired = 1 },
            },
        };

        d["spiked_club"] = new()
        {
            RecipeId = "spiked_club", OutputFamilyId = "spiked_club",
            DisplayName = "Spiked Club", OutputType = "weapon",
            CraftTime = 3,
            Requirements =
            {
                new() { Property = "structural", MinValue = 2, Quantity = 1, Name = "Sturdy Wood"     },
                new() { Property = "piercing",   MinValue = 1, Quantity = 3, Name = "Nails"           },
                new() { Property = "hammering",  MinValue = 1, Quantity = 1, Name = "Hammering Tool"  },
            },
            Components =
            {
                ("wood_plank", 1),
                ("nail",       3),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.5, QualityMod = 0.5, TimeRequired = 2 },
                ["knife"] = new() { ComponentYield = 0.8, QualityMod = 0.7, TimeRequired = 1 },
            },
        };

        // ── CLOTHING / ARMOR ────────────────────────────────────────
        d["coat"] = new()
        {
            RecipeId = "coat", OutputFamilyId = "coat",
            DisplayName = "Coat", OutputType = "armor",
            CraftTime = 4,
            Requirements =
            {
                new() { Property = "padding",    MinValue = 1, Quantity = 3, Name = "Fabric Panels" },
                new() { Property = "fastening",  MinValue = 1, Quantity = 6, Name = "Fasteners"     },
                new() { ComponentId = "thread",                Quantity = 1, Name = "Thread"        },
            },
            Components =
            {
                ("fabric_panel", 3),
                ("button",       5),
                ("thread",       1),
                ("zipper",       1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.75, QualityMod = 0.5, TimeRequired = 3,
                                    ExcludeComponents = new() { "thread" } },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.8, TimeRequired = 2 },
            },
        };

        d["pants"] = new()
        {
            RecipeId = "pants", OutputFamilyId = "pants",
            DisplayName = "Pants", OutputType = "armor",
            CraftTime = 3,
            Requirements =
            {
                new() { Property = "padding",    MinValue = 1, Quantity = 2, Name = "Fabric Panels" },
                new() { Property = "fastening",  MinValue = 1, Quantity = 3, Name = "Fasteners"     },
                new() { ComponentId = "thread",                Quantity = 1, Name = "Thread"        },
            },
            Components =
            {
                ("fabric_panel", 2),
                ("button",       2),
                ("thread",       1),
                ("zipper",       1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.75, QualityMod = 0.5, TimeRequired = 2,
                                    ExcludeComponents = new() { "thread" } },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.8, TimeRequired = 1 },
            },
        };

        d["trenchcoat"] = new()
        {
            RecipeId = "trenchcoat", OutputFamilyId = "trenchcoat",
            DisplayName = "Trenchcoat", OutputType = "armor",
            CraftTime = 5,
            Requirements =
            {
                new() { Property = "padding",    MinValue = 1, Quantity = 4, Name = "Fabric Panels" },
                new() { Property = "fastening",  MinValue = 1, Quantity = 7, Name = "Fasteners"     },
                new() { ComponentId = "thread",                Quantity = 1, Name = "Thread"        },
            },
            Components =
            {
                ("fabric_panel", 4),
                ("button",       6),
                ("thread",       1),
                ("zipper",       1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.75, QualityMod = 0.5, TimeRequired = 3,
                                    ExcludeComponents = new() { "thread" } },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.8, TimeRequired = 2 },
            },
        };

        // ── CONTAINERS ──────────────────────────────────────────────
        d["backpack"] = new()
        {
            RecipeId = "backpack", OutputFamilyId = "backpack",
            DisplayName = "Backpack", OutputType = "container",
            CraftTime = 4,
            Requirements =
            {
                new() { ComponentId = "fabric_panel",             Quantity = 3, Name = "Fabric Panels"     },
                new() { Property = "harnessing",  MinValue = 2,   Quantity = 2, Name = "Shoulder Straps"  },
                new() { Property = "fastening",   MinValue = 2,   Quantity = 2, Name = "Secure Fasteners" },
                new() { ComponentId = "thread",                   Quantity = 1, Name = "Thread"           },
            },
            Components =
            {
                ("fabric_panel", 3),
                ("strap",        2),
                ("buckle",       2),
                ("zipper",       2),
                ("thread",       1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.75, QualityMod = 0.6,  TimeRequired = 3,
                                    ExcludeComponents = new() { "thread" } },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.85, TimeRequired = 2 },
            },
        };

        d["canteen"] = new()
        {
            RecipeId = "canteen", OutputFamilyId = "canteen",
            DisplayName = "Canteen", OutputType = "container",
            CraftTime = 2,
            Requirements =
            {
                new() { Property = "container",  MinValue = 1, Quantity = 1, Name = "Vessel"      },
                new() { Property = "fastening",  MinValue = 1, Quantity = 1, Name = "Seal"        },
                new() { Property = "harnessing", MinValue = 1, Quantity = 1, Name = "Carry Strap" },
            },
            Components =
            {
                ("metal_bottle", 1),
                ("screw_cap",    1),
                ("strap",        1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 1.0, QualityMod = 0.7, TimeRequired = 1 },
                ["knife"] = new() { ComponentYield = 1.0, QualityMod = 0.9, TimeRequired = 1 },
            },
        };

        d["medkit"] = new()
        {
            RecipeId = "medkit", OutputFamilyId = "medkit",
            DisplayName = "Medkit", OutputType = "container",
            CraftTime = 1,
            Requirements =
            {
                new() { Property = "container", MinValue = 1, Quantity = 1, Name = "Case" },
            },
            Components = { ("plastic_case", 1) },
            DisassemblyMethods =
            {
                ["hand"] = new() { ComponentYield = 1.0, QualityMod = 0.8, TimeRequired = 1 },
            },
        };

        // ── TOOLS ───────────────────────────────────────────────────
        d["can_opener"] = new()
        {
            RecipeId = "can_opener", OutputFamilyId = "can_opener",
            DisplayName = "Can Opener", OutputType = "tool",
            CraftTime = 2,
            Requirements =
            {
                new() { Property = "cutting", MinValue = 1, Quantity = 1, Name = "Cutting Edge" },
                new() { Property = "grip",    MinValue = 1, Quantity = 1, Name = "Handle"       },
            },
            Components =
            {
                ("metal_casing", 1),
                ("handle",       1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 1.0, QualityMod = 0.6, TimeRequired = 1 },
                ["knife"] = new() { ComponentYield = 1.0, QualityMod = 0.9, TimeRequired = 1 },
            },
        };

        d["battery"] = new()
        {
            RecipeId = "battery", OutputFamilyId = "battery",
            DisplayName = "Battery", OutputType = "component",
            CraftTime = 2,
            Requirements =
            {
                new() { Property = "container", MinValue = 1, Quantity = 1, Name = "Casing"         },
                new() { Property = "chemical",  MinValue = 1, Quantity = 1, Name = "Chemical Agent" },
                new() { Property = "conductor", MinValue = 1, Quantity = 1, Name = "Conductor"      },
            },
            Components =
            {
                ("metal_casing",      1),
                ("electrolyte_paste", 1),
                ("carbon_rod",        1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.66, QualityMod = 0.5, TimeRequired = 2 },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.8, TimeRequired = 1 },
            },
        };

        d["flashlight"] = new()
        {
            RecipeId = "flashlight", OutputFamilyId = "flashlight",
            DisplayName = "Flashlight", OutputType = "tool",
            CraftTime = 3,
            Requirements =
            {
                new() { Property = "container",  MinValue = 1, Quantity = 1, Name = "Casing"    },
                new() { Property = "electrical", MinValue = 1, Quantity = 2, Name = "Wiring"    },
                new() { Property = "fastening",  MinValue = 1, Quantity = 2, Name = "Fasteners" },
            },
            Components =
            {
                ("plastic_case", 1),
                ("wire",         2),
                ("screw",        2),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.66, QualityMod = 0.5, TimeRequired = 2 },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.8, TimeRequired = 1 },
            },
        };

        d["lantern"] = new()
        {
            RecipeId = "lantern", OutputFamilyId = "lantern",
            DisplayName = "Lantern", OutputType = "tool",
            CraftTime = 3,
            Requirements =
            {
                new() { Property = "container",  MinValue = 1, Quantity = 2, Name = "Casing"     },
                new() { Property = "electrical", MinValue = 1, Quantity = 1, Name = "Wick"       },
                new() { Property = "grip",       MinValue = 1, Quantity = 1, Name = "Handle"     },
            },
            Components =
            {
                ("metal_casing", 2),
                ("wire",         1),
                ("handle",       1),
            },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 0.66, QualityMod = 0.5, TimeRequired = 2 },
                ["knife"] = new() { ComponentYield = 1.0,  QualityMod = 0.8, TimeRequired = 1 },
            },
        };

        // ── DISASSEMBLY-ONLY (sealed containers) ────────────────────
        d["can_sealed"] = new()
        {
            RecipeId = "can_sealed", OutputFamilyId = "can_sealed",
            DisplayName = "Sealed Can", OutputType = "container",
            Components = { ("tin_can", 1), ("can_lid", 1) },
            DisassemblyMethods =
            {
                ["knife"] = new() { ComponentYield = 1.0, QualityMod = 0.8, TimeRequired = 1 },
                ["hand"]  = new() { ComponentYield = 0.5, QualityMod = 0.4, TimeRequired = 2 },
            },
        };

        d["bottle_sealed"] = new()
        {
            RecipeId = "bottle_sealed", OutputFamilyId = "bottle_sealed",
            DisplayName = "Sealed Bottle", OutputType = "container",
            Components = { ("plastic_bottle", 1), ("bottle_cap", 1) },
            DisassemblyMethods =
            {
                ["hand"]  = new() { ComponentYield = 1.0, QualityMod = 0.9, TimeRequired = 1 },
                ["knife"] = new() { ComponentYield = 1.0, QualityMod = 0.9, TimeRequired = 1 },
            },
        };

        return d;
    }
}
