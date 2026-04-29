namespace Nightrun.Content;

/// <summary>
/// Single line of a recipe's component-requirements list. A requirement is
/// either <b>property-based</b> (needs an item with <c>Property</c> at
/// <c>MinValue</c>+, optionally capped at <c>MaxValue</c>) or
/// <b>id-based</b> (needs exactly <c>ComponentId</c>). The first matching
/// item-stack satisfies one quantity slot; <c>Quantity &gt; 1</c> means the
/// crafter has to source that many stacks (or accumulate via stackables).
/// </summary>
public sealed class RecipeRequirement
{
    /// <summary>Property key (e.g. "cutting"); null for an id-based req.</summary>
    public string? Property;

    /// <summary>Minimum tier the component must supply. Default 1.</summary>
    public int MinValue = 1;

    /// <summary>Hard upper tier cap (null = no cap). Used by the shiv recipe
    /// to refuse premium blades and keep the weapon feel consistent.</summary>
    public int? MaxValue;

    /// <summary>Exact component id; null for a property-based req.</summary>
    public string? ComponentId;

    /// <summary>Number of stacks/units needed. Stackable components collapse
    /// naturally — 2 rivets can come from one 2-stack or two 1-stacks.</summary>
    public int Quantity = 1;

    /// <summary>Display label shown in the recipe UI.</summary>
    public string Name = "";
}

/// <summary>
/// A per-tool disassembly profile. Determines what fraction of the recipe's
/// <c>Components</c> list is recovered, how much their quality degrades, and
/// which components are lost outright (thread is excluded from hand-teardown
/// of clothing, for example).
/// </summary>
public sealed class RecipeDisassembly
{
    /// <summary>Fraction of components recovered (0..1). Partial yields
    /// round down, so a 0.66 yield on three rivets returns two.</summary>
    public double ComponentYield = 1.0;

    /// <summary>Multiplier on recovered component durability. The source
    /// item's durability feeds in as the baseline "quality".</summary>
    public double QualityMod = 1.0;

    /// <summary>Turns consumed to complete the teardown.</summary>
    public int TimeRequired = 1;

    /// <summary>Component ids that are never recoverable with this tool.</summary>
    public HashSet<string> ExcludeComponents = new();
}

/// <summary>
/// Full crafting recipe. <c>Components</c> is the ground-truth list of what
/// the output contains (used for disassembly yields and quality math);
/// <c>Requirements</c> is the looser matching pass run against the player's
/// component pool when checking if a craft is possible.
/// </summary>
public sealed class Recipe
{
    public required string RecipeId;
    public required string OutputFamilyId;
    public required string DisplayName;

    /// <summary>Display category for the UI: "weapon", "armor", "container",
    /// "tool", "component".</summary>
    public required string OutputType;

    public List<RecipeRequirement> Requirements = new();

    /// <summary>Components the output contains — disassembly reads this list
    /// to figure out what to hand back.</summary>
    public List<(string Id, int Quantity)> Components = new();

    public Dictionary<string, RecipeDisassembly> DisassemblyMethods = new();

    public int CraftTime = 1;
}
