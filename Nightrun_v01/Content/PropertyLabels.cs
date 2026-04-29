namespace Nightrun.Content;

/// <summary>
/// Human-readable labels for component-property tiers. Mirrors the
/// <c>PROPERTY_LABELS</c> table in the JS ContentManager — the crafting UI
/// uses these to turn a raw requirement like <c>{ property: "cutting",
/// minValue: 2 }</c> into a descriptive string like "Sharp Edge".
///
/// Tier-locked requirements (minValue == maxValue) render as a single
/// label. Capped requirements (maxValue &gt; minValue) append "(max tier N)".
/// Uncapped requirements fall back to "{property} +{minValue}" if no label
/// is registered for the property.
/// </summary>
public static class PropertyLabels
{
    public static readonly Dictionary<string, Dictionary<int, string>> Labels = new()
    {
        ["cutting"]      = new() { [1] = "Crude Edge",        [2] = "Sharp Edge",         [3] = "Fine Edge" },
        ["piercing"]     = new() { [1] = "Pointed",           [2] = "Piercing Tip",       [3] = "Needle Point" },
        ["grip"]         = new() { [1] = "Rough Grip",        [2] = "Firm Grip",          [3] = "Ergonomic Grip" },
        ["fastening"]    = new() { [1] = "Basic Fastener",    [2] = "Secure Fastener",    [3] = "Precision Fastener" },
        ["binding"]      = new() { [1] = "Loose Binding",     [2] = "Firm Binding",       [3] = "Tight Binding" },
        ["structural"]   = new() { [1] = "Flimsy Frame",      [2] = "Sturdy Frame",       [3] = "Rigid Frame" },
        ["padding"]      = new() { [1] = "Thin Padding",      [2] = "Soft Padding",       [3] = "Thick Padding" },
        ["insulation"]   = new() { [1] = "Light Insulation",  [2] = "Good Insulation",    [3] = "Heavy Insulation" },
        ["container"]    = new() { [1] = "Small Vessel",      [2] = "Sealed Vessel",      [3] = "Large Vessel" },
        ["blunt"]        = new() { [1] = "Blunt Weight",      [2] = "Heavy Weight",       [3] = "Crushing Weight" },
        ["grinding"]     = new() { [1] = "Abrasive",          [2] = "Grinding Surface",   [3] = "Fine Grindstone" },
        ["fuel"]         = new() { [1] = "Combustible",       [2] = "Fuel Source",        [3] = "High-Energy Fuel" },
        ["electrical"]   = new() { [1] = "Conductive Wire",   [2] = "Wiring",             [3] = "Circuit" },
        ["conductor"]    = new() { [1] = "Weak Conductor",    [2] = "Conductor",          [3] = "High Conductor" },
        ["chemical"]     = new() { [1] = "Mild Chemical",     [2] = "Chemical Agent",     [3] = "Potent Chemical" },
        ["medical"]      = new() { [1] = "Basic Medical",     [2] = "Medical Supply",     [3] = "Surgical Grade" },
        ["harnessing"]   = new() { [1] = "Simple Strap",      [2] = "Sturdy Strap",       [3] = "Reinforced Strap" },
        ["screwdriving"] = new() { [1] = "Screwdriver",       [2] = "Precision Driver" },
        ["prying"]       = new() { [1] = "Pry Tool",          [2] = "Heavy Pry Bar" },
        ["bolt_turning"] = new() { [1] = "Wrench",            [2] = "Torque Wrench" },
        ["hammering"]    = new() { [1] = "Makeshift Hammer",  [2] = "Heavy Hammer" },
    };

    /// <summary>
    /// Format a property-tier requirement as a display string.
    /// </summary>
    /// <param name="property">Property key (e.g. "cutting").</param>
    /// <param name="minValue">Minimum required tier.</param>
    /// <param name="maxValue">Upper tier cap; null for "or better".</param>
    public static string Format(string property, int minValue, int? maxValue = null)
    {
        if (!Labels.TryGetValue(property, out var tiers))
            return $"{property} +{minValue}";

        // Tier-locked requirement (e.g. shiv wants "Small Sharp Edge" only).
        if (maxValue.HasValue && maxValue.Value == minValue)
            return tiers.TryGetValue(minValue, out var exact) ? exact : $"{property} {minValue}";

        // Capped but not locked (minValue..maxValue tier band).
        if (maxValue.HasValue)
        {
            var minLabel = tiers.TryGetValue(minValue, out var mn) ? mn : $"{property} {minValue}";
            return $"{minLabel} (max tier {maxValue.Value})";
        }

        // Open-ended "this tier or better".
        return tiers.TryGetValue(minValue, out var open) ? open : $"{property} +{minValue}";
    }
}
