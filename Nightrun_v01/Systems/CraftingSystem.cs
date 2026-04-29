using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.World;

namespace Nightrun.Systems;

/// <summary>
/// Outcome of a <see cref="CraftingSystem.Craft"/> call. Success carries the
/// produced <see cref="Item"/> and the action cost (turns); failure carries
/// a user-facing reason.
/// </summary>
public readonly record struct CraftResult(bool Success, string Message, Item? Output, int TimeCost)
{
    public static CraftResult Ok(string msg, Item output, int timeCost) => new(true, msg, output, timeCost);
    public static CraftResult Fail(string msg) => new(false, msg, null, 0);
}

/// <summary>
/// Outcome of a <see cref="CraftingSystem.Disassemble"/> call — identifies
/// every recovered component so the UI can show the breakdown.
/// </summary>
public readonly record struct DisassembleResult(bool Success, string Message, IReadOnlyList<Item> Components, int TimeCost)
{
    private static readonly IReadOnlyList<Item> Empty = Array.Empty<Item>();
    public static DisassembleResult Ok(string msg, IReadOnlyList<Item> comps, int timeCost) => new(true, msg, comps, timeCost);
    public static DisassembleResult Fail(string msg) => new(false, msg, Empty, 0);
}

/// <summary>
/// Port of the JS <c>CraftingSystem</c>: gathers the player's component pool
/// (worn gear + pockets + ground items + virtual surface item), checks
/// property/id-based recipe requirements, and produces outputs or component
/// yields. The system is stateless aside from constructor dependencies —
/// all state lives on the items themselves.
/// </summary>
public sealed class CraftingSystem
{
    private readonly IWorldMap _world;
    private readonly Random _rng;
    private readonly Action<string> _log;

    public CraftingSystem(IWorldMap world, Random rng, Action<string> log)
    {
        _world = world;
        _rng   = rng;
        _log   = log;
    }

    // ──────────────────────────────────────────────────────────────────
    // Component pool gathering

    /// <summary>
    /// Enumerate every component the player currently has access to — worn
    /// gear, pocket contents (including inside opened containers), items on
    /// the tile underfoot, and the virtual tile-surface component. This is
    /// the canonical pool every recipe requirement runs against.
    /// </summary>
    public List<Item> GetAllComponents(Player p)
    {
        var list = new List<Item>();

        // Equipped items (a wielded crude_blade is both a weapon and a component).
        foreach (var (_, eq) in p.Equipment.All())
            if (eq.IsComponent) list.Add(eq);

        // Everything in any pocket the player can reach, plus any contents
        // inside opened containers (e.g. components stored inside a medkit).
        foreach (var it in p.Inventory.EnumerateReachableItems())
            if (it.IsComponent && !list.Contains(it)) list.Add(it);

        // Ground items on the player's tile.
        var ground = _world.GetItemsAt(p.X, p.Y, p.Z);
        if (ground != null)
            foreach (var it in ground)
                if (it.IsComponent) list.Add(it);

        // Virtual surface component (grinding, hammering, ...).
        var tile = _world.GetTile(p.X, p.Y, p.Z);
        var surface = SurfaceProperties.CreateFor(tile.Type);
        if (surface != null) list.Add(surface);

        return list;
    }

    /// <summary>
    /// Read the tier value of <paramref name="prop"/> on <paramref name="c"/>,
    /// preferring <see cref="Item.CraftedProperties"/> when present (crafted
    /// intermediates can advertise different tiers than their base template).
    /// </summary>
    public static int GetProperty(Item c, string prop)
    {
        if (c.CraftedProperties != null && c.CraftedProperties.TryGetValue(prop, out var cv))
            return cv;
        return c.Properties.TryGetValue(prop, out var v) ? v : 0;
    }

    /// <summary>
    /// The id the crafting system treats as this component's match key.
    /// Crafted intermediates fall back to their CraftedComponentId so a
    /// crafted wrapped_handle matches the "wrapped_handle" component.
    /// </summary>
    public static string MatchKey(Item c)
        => c.CraftedComponentId ?? c.ComponentId ?? c.FamilyId;

    /// <summary>True if <paramref name="c"/> satisfies <paramref name="req"/>.</summary>
    public static bool Matches(Item c, RecipeRequirement req)
    {
        if (req.ComponentId != null)
            return MatchKey(c) == req.ComponentId;

        if (req.Property != null)
        {
            int val = GetProperty(c, req.Property);
            if (val < req.MinValue) return false;
            if (req.MaxValue.HasValue && val > req.MaxValue.Value) return false;
            return true;
        }

        return false;
    }

    // ──────────────────────────────────────────────────────────────────
    // Craftability + crafting

    /// <summary>
    /// Inspect <paramref name="recipe"/> against <paramref name="components"/>
    /// and decide whether the craft succeeds. On success, <paramref name="plan"/>
    /// is a list of (component, unitsToConsume) pairs — surfaces and other
    /// infinite sources are excluded from the plan so the caller can just
    /// walk it and decrement/delete.
    /// </summary>
    public bool CanCraft(
        Recipe recipe,
        List<Item> components,
        out List<(Item Item, int Units)>? plan)
    {
        var available = new Dictionary<Item, int>(ReferenceEqualityComparer.Instance);
        foreach (var c in components)
        {
            int q = c.IsSurface ? 999 : Math.Max(1, c.Stackable ? c.Quantity : 1);
            available[c] = q;
        }

        var allocation = new List<(Item, int)>();

        foreach (var req in recipe.Requirements)
        {
            int remaining = req.Quantity;
            foreach (var c in components)
            {
                if (remaining == 0) break;
                if (available[c] == 0) continue;
                if (!Matches(c, req)) continue;

                int take = Math.Min(available[c], remaining);
                int consumed = c.IsSurface ? 0 : take;
                if (consumed > 0)
                {
                    available[c] -= consumed;
                    allocation.Add((c, consumed));
                }
                remaining -= take;
            }

            if (remaining > 0)
            {
                plan = null;
                return false;
            }
        }

        plan = allocation;
        return true;
    }

    /// <summary>
    /// Resolve a craft by id against the player's live component pool.
    /// Consumes the matched components, produces the output item (inheriting
    /// durability from the average of consumed components), and stuffs the
    /// result into the first pocket that fits or drops it on the ground.
    /// </summary>
    public CraftResult Craft(string recipeId, Player p)
    {
        var recipe = RecipeCatalog.Get(recipeId);
        if (recipe == null) return CraftResult.Fail("Unknown recipe.");
        if (recipe.Requirements.Count == 0)
            return CraftResult.Fail($"The {recipe.DisplayName} can only be salvaged, not built.");

        var components = GetAllComponents(p);
        if (!CanCraft(recipe, components, out var plan) || plan == null)
            return CraftResult.Fail("You're missing components.");

        var output = ItemCatalog.Create(recipe.OutputFamilyId);
        if (output == null)
            return CraftResult.Fail($"The catalog has no '{recipe.OutputFamilyId}' entry.");

        // Inherit durability from the average of consumed real components.
        int sum = 0, count = 0;
        foreach (var (item, _) in plan)
        {
            if (item.IsSurface) continue;
            sum += item.Durability;
            count++;
        }
        if (count > 0 && output.MaxDurability > 0)
        {
            int avg = sum / count;
            output.Durability = Math.Clamp(avg, 10, output.MaxDurability);
        }

        // Consume from inventory / ground. Stackables decrement Quantity; on
        // hitting zero the item is removed entirely.
        foreach (var (item, units) in plan)
        {
            if (item.IsSurface) continue;
            ConsumeComponent(p, item, units);
        }

        if (p.Inventory.FindFit(output) is { } pocket)
            pocket.TryAdd(output);
        else
            _world.AddItemAt(p.X, p.Y, p.Z, output);

        return CraftResult.Ok($"You craft a {output.Name}.", output, recipe.CraftTime);
    }

    /// <summary>
    /// Remove <paramref name="units"/> of <paramref name="item"/> from the
    /// player's inventory / the ground — stackable components are decremented
    /// in place, non-stackable items are deleted whole regardless of count.
    /// </summary>
    private void ConsumeComponent(Player p, Item item, int units)
    {
        if (item.Stackable && item.Quantity > units)
        {
            item.Quantity -= units;
            return;
        }

        if (p.Inventory.Remove(item)) return;

        // Unequip if the component was worn in a slot.
        foreach (var (slot, eq) in p.Equipment.All())
        {
            if (ReferenceEquals(eq, item))
            {
                p.Equipment[slot] = null;
                return;
            }
        }

        _world.RemoveItemAt(p.X, p.Y, p.Z, item);
    }

    // ──────────────────────────────────────────────────────────────────
    // Disassembly

    /// <summary>
    /// Tools available for disassembling <paramref name="recipe"/>'s output
    /// by the keys in its <see cref="Recipe.DisassemblyMethods"/>. "hand" is
    /// always offered; other keys gate on the player's reachable gear.
    /// </summary>
    public List<string> GetDisassemblyTools(Player p, Recipe recipe)
    {
        var tools = new List<string>();
        foreach (var key in recipe.DisassemblyMethods.Keys)
            if (ToolAvailable(p, key)) tools.Add(key);
        return tools;
    }

    private static bool ToolAvailable(Player p, string toolId)
    {
        if (toolId == "hand") return true;

        if (toolId == "knife")
        {
            foreach (var it in p.Inventory.EnumerateReachableItems())
            {
                if (it.AttackType == "sharp" && it.DamageDice != null) return true;
                if (it.Tags.Contains("sharp")) return true;
            }
            foreach (var (_, eq) in p.Equipment.All())
            {
                if (eq.AttackType == "sharp" && eq.DamageDice != null) return true;
                if (eq.Tags.Contains("sharp")) return true;
            }
            return false;
        }

        // Generic fallback — match a tag of the same name (e.g. "wrench").
        foreach (var it in p.Inventory.EnumerateReachableItems())
            if (it.Tags.Contains(toolId)) return true;
        foreach (var (_, eq) in p.Equipment.All())
            if (eq.Tags.Contains(toolId)) return true;
        return false;
    }

    /// <summary>
    /// Break <paramref name="source"/> down with <paramref name="toolId"/>,
    /// returning the recovered components and the turn cost. Consumed source
    /// is removed from wherever it lives (inventory, ground, or an equipment
    /// slot). Quality on each recovered component is the source's durability
    /// scaled by the method's quality modifier.
    /// </summary>
    public DisassembleResult Disassemble(Item source, string toolId, Player p)
    {
        var recipe = RecipeCatalog.ForOutput(source.FamilyId);
        if (recipe == null || recipe.Components.Count == 0)
            return DisassembleResult.Fail($"The {source.Name} can't be taken apart.");

        if (!recipe.DisassemblyMethods.TryGetValue(toolId, out var method))
            return DisassembleResult.Fail("You don't have the right tool.");

        var produced = new List<Item>();
        foreach (var (compId, qty) in recipe.Components)
        {
            if (method.ExcludeComponents.Contains(compId)) continue;

            int yielded = (int)Math.Floor(qty * method.ComponentYield);
            if (yielded <= 0) continue;

            int baseQuality = source.MaxDurability > 0 ? source.Durability : 100;
            int quality = (int)Math.Floor(baseQuality * method.QualityMod);
            quality = Math.Clamp(quality, 10, 100);

            for (int i = 0; i < yielded; i++)
            {
                var comp = ItemCatalog.CreateByComponent(compId) ?? ItemCatalog.CreateByFamily(compId);
                if (comp == null) continue;
                comp.Durability = quality;
                if (comp.MaxDurability < quality) comp.MaxDurability = quality;
                produced.Add(comp);
            }
        }

        // Excavate the source. Inventory first, then equipment slots, then
        // the ground — the first one that owns it wins.
        if (!p.Inventory.Remove(source))
        {
            bool removed = false;
            foreach (var (slot, eq) in p.Equipment.All())
            {
                if (ReferenceEquals(eq, source))
                {
                    p.Equipment[slot] = null;
                    removed = true;
                    break;
                }
            }
            if (!removed) _world.RemoveItemAt(p.X, p.Y, p.Z, source);
        }

        // Emit the components — prefer pockets, fall back to the ground.
        foreach (var c in produced)
        {
            if (p.Inventory.FindFit(c) is { } pocket) pocket.TryAdd(c);
            else _world.AddItemAt(p.X, p.Y, p.Z, c);
        }

        return DisassembleResult.Ok(
            $"You take apart the {source.Name} — {produced.Count} component{(produced.Count == 1 ? "" : "s")} recovered.",
            produced,
            method.TimeRequired);
    }

    // ──────────────────────────────────────────────────────────────────
    // Disassembly candidate listing (UI helper)

    /// <summary>
    /// Items the player can disassemble right now — anything reachable with
    /// a <see cref="Recipe"/> registered against its family id and at least
    /// one tool they satisfy.
    /// </summary>
    public List<Item> GetDisassemblableItems(Player p)
    {
        var list = new List<Item>();
        var seen = new HashSet<Item>(ReferenceEqualityComparer.Instance);

        void Try(Item it)
        {
            if (!seen.Add(it)) return;
            var rec = RecipeCatalog.ForOutput(it.FamilyId);
            if (rec == null || rec.Components.Count == 0) return;
            if (rec.DisassemblyMethods.Count == 0) return;
            list.Add(it);
        }

        foreach (var (_, eq) in p.Equipment.All()) Try(eq);
        foreach (var it in p.Inventory.EnumerateReachableItems()) Try(it);

        var ground = _world.GetItemsAt(p.X, p.Y, p.Z);
        if (ground != null)
            foreach (var it in ground) Try(it);

        return list;
    }
}
