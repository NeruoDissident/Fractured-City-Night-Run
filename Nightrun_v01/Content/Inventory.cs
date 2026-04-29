namespace Nightrun.Content;

/// <summary>
/// A logical inventory entry — one pocket belonging to the entity, sourced
/// either from the intrinsic hands pocket or from a currently-worn container item.
/// </summary>
public readonly record struct InventoryPocketRef(string Source, Pocket Pocket);

/// <summary>
/// Aggregates all pockets an entity currently has access to. Pockets are not
/// owned here — they live on the worn items themselves (and on the hands pocket)
/// so contents follow the gear whether it's worn, dropped, or picked back up.
/// Matches the JS model: backpacks keep their contents when you take them off.
/// </summary>
public sealed class Inventory
{
    private readonly Equipment _equip;

    /// <summary>Always-present tiny intrinsic pocket — the entity's bare hands.</summary>
    public readonly Pocket Hands = new(new PocketSpec("Hands", 3000, 3000));

    public Inventory(Equipment equip) { _equip = equip; }

    /// <summary>
    /// Enumerate all pockets the entity can access, in UI display order:
    /// Hands first, then backpack (most storage), then other worn gear.
    /// </summary>
    public IEnumerable<InventoryPocketRef> Pockets()
    {
        yield return new InventoryPocketRef("Hands", Hands);

        if (_equip.Back is { Pockets.Length: > 0 } back)
            foreach (var p in back.Pockets)
                yield return new InventoryPocketRef("Back", p);

        foreach (var (slot, item) in _equip.All())
        {
            if (slot == BodySlot.Back) continue;
            if (item.Pockets.Length == 0) continue;
            foreach (var p in item.Pockets)
                yield return new InventoryPocketRef(Equipment.Label(slot), p);
        }
    }

    /// <summary>First pocket that can hold <paramref name="item"/>, or null.</summary>
    /// <param name="carryMod">Carry capacity multiplier (e.g. 1.2 from Pack Rat trait).</param>
    public Pocket? FindFit(Item item, double carryMod = 1.0)
    {
        foreach (var pr in Pockets())
            if (pr.Pocket.CanFit(item, carryMod)) return pr.Pocket;
        return null;
    }

    /// <summary>Sum of weight/volume across all accessible pockets (for UI).</summary>
    public (int weight, int volume) Load()
    {
        int w = 0, v = 0;
        foreach (var pr in Pockets())
        {
            w += pr.Pocket.UsedWeight;
            v += pr.Pocket.UsedVolume;
        }
        return (w, v);
    }

    /// <summary>Try to find and remove <paramref name="item"/> from any accessible pocket.</summary>
    public bool Remove(Item item)
    {
        foreach (var pr in Pockets())
            if (pr.Pocket.Remove(item)) return true;
        return false;
    }

    /// <summary>
    /// Walk every item the entity can see, including contents nested inside
    /// opened containers (for tool-search on eqipped/carried/stashed cans, etc).
    /// Does not descend into sealed containers — you can't use a tool you can't reach.
    /// </summary>
    public IEnumerable<Item> EnumerateReachableItems()
    {
        // Worn equipment shells themselves (a wielded knife, an equipped flashlight)
        foreach (var (_, item) in _equip.All())
        {
            yield return item;
            if (item.IsContainer && item.State.Opened)
                foreach (var nested in EnumerateContainer(item))
                    yield return nested;
        }

        // Pocketed items
        foreach (var pr in Pockets())
        {
            foreach (var it in pr.Pocket.Contents)
            {
                yield return it;
                if (it.IsContainer && it.State.Opened)
                    foreach (var nested in EnumerateContainer(it))
                        yield return nested;
            }
        }
    }

    private static IEnumerable<Item> EnumerateContainer(Item c)
    {
        foreach (var p in c.Pockets)
            foreach (var i in p.Contents)
                yield return i;
    }
}
