using Nightrun.Content;
using Nightrun.Entities;

namespace Nightrun.Systems;

/// <summary>
/// A single way the player can open a container — wraps the JS openMethods
/// entry plus the specific tool item (or null for hand/ground methods).
/// </summary>
public sealed class OpenOption
{
    public required string ToolType;        // "can_opener", "knife", "pipe", "hand", "ground"
    public required string DisplayName;     // "Can Opener", "Your Hands", "Smash on Ground", ...
    public Item? ToolItem;                  // null for hand/ground
    public required double Yield;
    public required int DurabilityDamage;
    public string Location = "";            // "equipped" | "inventory" | "" (hand/ground)
}

public readonly record struct OpenResult(
    bool   Success,
    string Message,
    double Yield,
    List<Item> SpilledItems);

public readonly record struct ConsumeResult(
    bool   Success,
    string Message,
    int    Consumed,
    int    Remaining,
    bool   Contaminated);

/// <summary>
/// Port of <c>src/systems/ItemSystem.js</c> — deals with opening sealed
/// containers, finding tools for that, and consuming food/drink. Keeps the
/// same behavioral rules: yield/durability tradeoffs, contamination spill,
/// quantity-based consumption, sickness on contaminated items.
/// </summary>
public sealed class ItemSystem
{
    /// <summary>
    /// Enumerate every way the player can open <paramref name="container"/>
    /// given their current equipment + inventory. The UI presents this list.
    /// Mirrors <c>getAvailableOpeningTools(player, container)</c>.
    /// </summary>
    public static List<OpenOption> GetAvailableOpeningTools(Player player, Item container)
    {
        var options = new List<OpenOption>();
        if (container.OpenMethods == null) return options;

        foreach (var (toolType, method) in container.OpenMethods)
        {
            switch (toolType)
            {
                case "hand":
                    options.Add(new OpenOption
                    {
                        ToolType = "hand", DisplayName = "Your Hands",
                        ToolItem = null, Yield = method.Yield, DurabilityDamage = method.DurabilityDamage,
                    });
                    continue;

                case "ground":
                    options.Add(new OpenOption
                    {
                        ToolType = "ground", DisplayName = "Smash on Ground",
                        ToolItem = null, Yield = method.Yield, DurabilityDamage = method.DurabilityDamage,
                    });
                    continue;
            }

            // Otherwise: look for a tool item with the matching tag, prefer equipped.
            var tool = FindToolInEquipment(player, toolType)
                    ?? FindToolInInventory(player, toolType);
            if (tool != null)
            {
                options.Add(new OpenOption
                {
                    ToolType = toolType, DisplayName = tool.Name,
                    ToolItem = tool, Yield = method.Yield, DurabilityDamage = method.DurabilityDamage,
                    Location = IsEquipped(player, tool) ? "equipped" : "inventory",
                });
            }
        }

        return options;
    }

    private static bool IsEquipped(Player p, Item tool)
    {
        foreach (var (_, it) in p.Equipment.All())
            if (ReferenceEquals(it, tool)) return true;
        return false;
    }

    private static Item? FindToolInEquipment(Player p, string toolType)
    {
        foreach (var (_, item) in p.Equipment.All())
            if (MatchesTool(item, toolType)) return item;
        return null;
    }

    private static Item? FindToolInInventory(Player p, string toolType)
    {
        foreach (var pr in p.Inventory.Pockets())
            foreach (var item in pr.Pocket.Contents)
                if (MatchesTool(item, toolType)) return item;
        return null;
    }

    private static bool MatchesTool(Item item, string toolType) => toolType switch
    {
        "can_opener" => item.HasTag("opener"),
        "knife"      => item.HasTag("sharp"),
        "pipe"       => item.HasTag("blunt"),
        _            => false,
    };

    // ------------------------------------------------------------------
    // Opening

    /// <summary>
    /// Apply <paramref name="option"/> to <paramref name="container"/>.
    /// Flips the container's state to opened, damages the tool if applicable,
    /// and if yield &lt; 1.0 spills a fraction of each stackable content as
    /// contaminated waste (returned in the result for the caller to drop).
    /// </summary>
    public static OpenResult OpenContainer(Item container, OpenOption option, Player player)
    {
        var spilled = new List<Item>();

        if (container.State.Opened)
            return new OpenResult(false, "Already opened.", option.Yield, spilled);

        if (container.OpenMethods == null || !container.OpenMethods.ContainsKey(option.ToolType))
            return new OpenResult(false, "Cannot open with this tool.", option.Yield, spilled);

        // Flip state
        container.State.Opened = true;
        container.State.Sealed = false;

        // Rename: "Sealed Can" → "Opened Can"
        if (container.Name.StartsWith("Sealed", StringComparison.Ordinal))
            container.Name = "Opened" + container.Name["Sealed".Length..];

        // Tool durability damage
        if (option.ToolItem != null && option.DurabilityDamage > 0)
        {
            option.ToolItem.Durability = Math.Max(0, option.ToolItem.Durability - option.DurabilityDamage);
        }

        // Partial yield → spill the lost fraction of each stackable content
        if (option.Yield < 1.0)
        {
            foreach (var pocket in container.Pockets)
            {
                // Iterate a snapshot because we mutate Contents via split
                var contentSnapshot = pocket.Contents.ToArray();
                foreach (var content in contentSnapshot)
                {
                    if (content.Quantity <= 1) continue;  // discrete items don't split
                    int spillAmount = (int)Math.Floor(content.Quantity * (1.0 - option.Yield));
                    if (spillAmount <= 0) continue;
                    var split = SplitItem(pocket, content, spillAmount);
                    if (split != null)
                    {
                        split.State.Contaminated = true;
                        spilled.Add(split);
                    }
                }
            }
        }

        return new OpenResult(true, $"Opened {container.Name} with {option.DisplayName}.",
                              option.Yield, spilled);
    }

    /// <summary>
    /// Split a quantity-based item — reduces the original's quantity/weight/volume
    /// and returns a new Item with the split-off portion. Null if the split is
    /// invalid (not stackable or amount &gt;= quantity). Mirrors splitItem() in JS.
    /// </summary>
    public static Item? SplitItem(Pocket? sourcePocket, Item item, int amount)
    {
        if (item.Quantity <= 0 || string.IsNullOrEmpty(item.QuantityUnit)) return null;
        if (amount >= item.Quantity) return null;

        var split = item.Clone();
        split.Quantity = amount;

        int totalQ = item.Quantity;
        double wPerUnit = item.Weight / (double)totalQ;
        double vPerUnit = item.Volume / (double)totalQ;

        item.Quantity -= amount;
        // Rebalance weight/volume on both items proportionally
        int newOrigW = (int)Math.Floor(wPerUnit * item.Quantity);
        int newOrigV = (int)Math.Floor(vPerUnit * item.Quantity);
        int newSplitW = (int)Math.Floor(wPerUnit * amount);
        int newSplitV = (int)Math.Floor(vPerUnit * amount);

        // If the item lives in a pocket, reflect the weight/volume delta there.
        if (sourcePocket != null)
        {
            sourcePocket.UsedWeight += newOrigW - item.Weight;
            sourcePocket.UsedVolume += newOrigV - item.Volume;
        }

        item.Weight = newOrigW;
        item.Volume = newOrigV;
        split.Weight = newSplitW;
        split.Volume = newSplitV;

        return split;
    }

    // ------------------------------------------------------------------
    // Consumption

    /// <summary>
    /// Calculate how much of <paramref name="item"/> to consume to fill
    /// the player without overshooting. Mirrors <c>calculateOptimalConsumption</c>.
    /// </summary>
    public static int CalculateOptimalConsumption(Item item, Player player)
    {
        if (item.Nutrition == null) return Math.Max(1, item.Quantity);
        if (item.Quantity <= 0) return 0;

        int hungerNeeded = player.MaxHunger - player.Hunger;
        int thirstNeeded = player.MaxThirst - player.Thirst;

        double hungerPerUnit = item.Nutrition.Hunger / (double)item.Quantity;
        double thirstPerUnit = item.Nutrition.Thirst / (double)item.Quantity;

        double amountForHunger = double.PositiveInfinity;
        double amountForThirst = double.PositiveInfinity;

        if (hungerPerUnit > 0 && hungerNeeded > 0)
            amountForHunger = Math.Ceiling(hungerNeeded / hungerPerUnit);
        if (thirstPerUnit > 0 && thirstNeeded > 0)
            amountForThirst = Math.Ceiling(thirstNeeded / thirstPerUnit);

        double optimal = Math.Min(item.Quantity, Math.Min(amountForHunger, amountForThirst));
        if (double.IsInfinity(optimal) || optimal <= 0)
            return item.Quantity;

        return (int)optimal;
    }

    /// <summary>
    /// Eat or drink <paramref name="item"/>. Partially consumes if
    /// <paramref name="amount"/> is given; otherwise auto-picks the optimal
    /// amount to fill hunger/thirst. If the item empties out, caller is
    /// responsible for removing the zero-quantity remnant from its pocket.
    /// Mirrors <c>consumeFood</c>.
    /// </summary>
    public static ConsumeResult ConsumeFood(Item item, Player player, int? amount = null)
    {
        if (item.Nutrition == null)
            return new ConsumeResult(false, "This is not consumable.", 0, 0, false);
        if (item.Quantity <= 0)
            return new ConsumeResult(false, "Nothing left to consume.", 0, 0, false);

        int consumeAmount;
        if (amount.HasValue) consumeAmount = amount.Value;
        else if (!string.IsNullOrEmpty(item.QuantityUnit))
            consumeAmount = CalculateOptimalConsumption(item, player);
        else
            consumeAmount = item.Quantity;

        if (consumeAmount <= 0) consumeAmount = 1;
        if (consumeAmount > item.Quantity)
            return new ConsumeResult(false, "Not enough to consume.", 0, item.Quantity, false);

        double ratio = item.Quantity > 0 ? (consumeAmount / (double)item.Quantity) : 1.0;
        int gainHunger = (int)Math.Round(item.Nutrition.Hunger * ratio);
        int gainThirst = (int)Math.Round(item.Nutrition.Thirst * ratio);

        if (gainHunger != 0)
            player.Hunger = Math.Clamp(player.Hunger + gainHunger, 0, player.MaxHunger);
        if (gainThirst != 0)
            player.Thirst = Math.Clamp(player.Thirst + gainThirst, 0, player.MaxThirst);

        bool contaminated = item.State.Contaminated;
        // Phase 3 will wire sickness as a status effect.  For now we just flag it.

        // Reduce quantity + proportional weight/volume
        int prevQty = item.Quantity;
        item.Quantity -= consumeAmount;
        if (prevQty > 0)
        {
            double wPerUnit = item.Weight / (double)prevQty;
            double vPerUnit = item.Volume / (double)prevQty;
            item.Weight = (int)Math.Floor(wPerUnit * item.Quantity);
            item.Volume = (int)Math.Floor(vPerUnit * item.Quantity);
        }

        string verb = item.Category == "drink" ? "drink" : "eat";
        string msg = contaminated
            ? $"You {verb} some of the {item.Name}. It tastes wrong."
            : $"You {verb} some of the {item.Name}.";

        return new ConsumeResult(true, msg, consumeAmount, item.Quantity, contaminated);
    }

    // ------------------------------------------------------------------
    // Per-turn world processing (spoilage + spillage)

    /// <summary>
    /// Advance contamination on opened food the player is carrying. Liquid-
    /// tagged spoils fastest (0.05/turn), protein slowest (0.03/turn), others
    /// 0.04/turn. Once ContaminationLevel &gt;= 0.3 the item flips contaminated.
    /// Mirrors <c>World.processFoodSpoilage</c>.
    /// </summary>
    public static void ProcessFoodSpoilage(Player player)
    {
        foreach (var item in player.Inventory.EnumerateReachableItems())
        {
            if (!item.IsContainer || !item.State.Opened) continue;
            foreach (var pocket in item.Pockets)
            {
                foreach (var content in pocket.Contents)
                {
                    if (content.Category != "food") continue;

                    double rate = 0.04;
                    if (content.HasTag("protein")) rate = 0.03;
                    if (content.HasTag("liquid"))  rate = 0.05;
                    content.State.ContaminationLevel += rate;
                    if (content.State.ContaminationLevel >= 0.3 && !content.State.Contaminated)
                        content.State.Contaminated = true;
                }
            }
        }
    }

    /// <summary>
    /// Spill 7 ml/turn from any opened, unsealed drink container the player
    /// is carrying. Liquids evaporate; stackable quantity drops.
    /// Mirrors <c>World.processLiquidSpillage</c>.
    /// </summary>
    public static void ProcessLiquidSpillage(Player player)
    {
        const int SPILL_PER_TURN = 7;  // ml
        foreach (var item in player.Inventory.EnumerateReachableItems())
        {
            if (!item.IsContainer || !item.State.Opened || item.State.Sealed) continue;
            foreach (var pocket in item.Pockets)
            {
                for (int i = pocket.Contents.Count - 1; i >= 0; i--)
                {
                    var content = pocket.Contents[i];
                    if (content.Category != "drink") continue;
                    if (content.Quantity <= 0 || content.QuantityUnit != "ml") continue;

                    int spill = Math.Min(SPILL_PER_TURN, content.Quantity);
                    int prevQty = content.Quantity;
                    content.Quantity -= spill;

                    double ratio = content.Quantity / (double)prevQty;
                    int prevW = content.Weight, prevV = content.Volume;
                    content.Weight = (int)Math.Floor(content.Weight * ratio);
                    content.Volume = (int)Math.Floor(content.Volume * ratio);
                    pocket.UsedWeight += content.Weight - prevW;
                    pocket.UsedVolume += content.Volume - prevV;

                    if (content.Quantity <= 0)
                    {
                        pocket.Remove(content);
                    }
                }
            }
        }
    }
}
