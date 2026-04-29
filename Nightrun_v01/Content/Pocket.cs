namespace Nightrun.Content;

/// <summary>
/// Static definition of a pocket — its display name and capacity limits.
/// Declared once per clothing/furniture type; individual runtime pockets
/// clone from this spec.
/// </summary>
public readonly record struct PocketSpec(
    string Name,
    int MaxWeight,      // grams
    int MaxVolume,      // ml
    PocketFilter Filter = PocketFilter.Any);

/// <summary>
/// Restricts what a pocket can hold. Clothing pockets tend to be Any; weapon
/// holsters would be WeaponsOnly; etc. Phase 2 only uses Any.
/// </summary>
public enum PocketFilter : byte { Any, WeaponsOnly, ContainersOnly, NoContainers }

/// <summary>
/// Runtime container. Shared by furniture pockets, worn-clothing pockets, and
/// backpacks. Tracks used weight/volume so UI can show fill levels without
/// scanning contents on every frame.
/// </summary>
public sealed class Pocket
{
    public PocketSpec Spec;
    public readonly List<Item> Contents = new();
    public int UsedWeight;
    public int UsedVolume;

    public Pocket(PocketSpec spec) { Spec = spec; }

    public int FreeWeight => Math.Max(0, Spec.MaxWeight - UsedWeight);
    public int FreeVolume => Math.Max(0, Spec.MaxVolume - UsedVolume);

    public bool CanFit(Item it, double carryMod = 1.0)
    {
        int maxW = (int)(Spec.MaxWeight * carryMod);
        int maxV = (int)(Spec.MaxVolume * carryMod);
        if (UsedWeight + it.Weight > maxW) return false;
        if (UsedVolume + it.Volume > maxV) return false;
        return Spec.Filter switch
        {
            PocketFilter.WeaponsOnly    => it.Category == "weapon",
            PocketFilter.ContainersOnly => it.Category == "container",
            PocketFilter.NoContainers   => it.Category != "container",
            _ => true,
        };
    }

    public bool TryAdd(Item it)
    {
        if (!CanFit(it)) return false;
        Contents.Add(it);
        UsedWeight += it.Weight;
        UsedVolume += it.Volume;
        return true;
    }

    public bool Remove(Item it)
    {
        if (!Contents.Remove(it)) return false;
        UsedWeight -= it.Weight;
        UsedVolume -= it.Volume;
        if (UsedWeight < 0) UsedWeight = 0;
        if (UsedVolume < 0) UsedVolume = 0;
        return true;
    }
}
