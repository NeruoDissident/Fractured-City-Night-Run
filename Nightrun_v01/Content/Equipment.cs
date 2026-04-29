namespace Nightrun.Content;

/// <summary>
/// Physical equipment slots on a body. LHand/RHand are hand-wielded items.
/// Torso and Legs can each hold one clothing layer for Phase 2 (no layering yet).
/// Back holds a single backpack/container.
/// </summary>
public enum BodySlot : byte
{
    Head,
    Torso,
    Arms,
    Legs,
    Feet,
    LHand,
    RHand,
    Back,
    Count,
}

/// <summary>
/// Per-entity equipment state. Each slot points to an equipped <see cref="Item"/>
/// or null. Phase 2 is single-layer per slot (no undershirts/jacket stacking).
/// </summary>
public sealed class Equipment
{
    private readonly Item?[] _slots = new Item?[(int)BodySlot.Count];

    public Item? this[BodySlot s]
    {
        get => _slots[(int)s];
        set => _slots[(int)s] = value;
    }

    public Item? Head  { get => _slots[(int)BodySlot.Head];  set => _slots[(int)BodySlot.Head]  = value; }
    public Item? Torso { get => _slots[(int)BodySlot.Torso]; set => _slots[(int)BodySlot.Torso] = value; }
    public Item? Arms  { get => _slots[(int)BodySlot.Arms];  set => _slots[(int)BodySlot.Arms]  = value; }
    public Item? Legs  { get => _slots[(int)BodySlot.Legs];  set => _slots[(int)BodySlot.Legs]  = value; }
    public Item? Feet  { get => _slots[(int)BodySlot.Feet];  set => _slots[(int)BodySlot.Feet]  = value; }
    public Item? LHand { get => _slots[(int)BodySlot.LHand]; set => _slots[(int)BodySlot.LHand] = value; }
    public Item? RHand { get => _slots[(int)BodySlot.RHand]; set => _slots[(int)BodySlot.RHand] = value; }
    public Item? Back  { get => _slots[(int)BodySlot.Back];  set => _slots[(int)BodySlot.Back]  = value; }

    public IEnumerable<(BodySlot slot, Item item)> All()
    {
        for (int i = 0; i < _slots.Length; i++)
            if (_slots[i] is Item it) yield return ((BodySlot)i, it);
    }

    /// <summary>Map an item's EquipSlot to the concrete BodySlot to equip into.</summary>
    public static bool DefaultSlotFor(Item it, Equipment eq, out BodySlot slot)
    {
        switch (it.Slot)
        {
            case EquipSlot.Head:  slot = BodySlot.Head;  return true;
            case EquipSlot.Torso: slot = BodySlot.Torso; return true;
            case EquipSlot.Arms:  slot = BodySlot.Arms;  return true;
            case EquipSlot.Legs:  slot = BodySlot.Legs;  return true;
            case EquipSlot.Feet:  slot = BodySlot.Feet;  return true;
            case EquipSlot.Back:  slot = BodySlot.Back;  return true;
            case EquipSlot.Hand:
                // Prefer empty RHand, then LHand
                slot = eq.RHand == null ? BodySlot.RHand
                     : eq.LHand == null ? BodySlot.LHand
                     : BodySlot.RHand;
                return true;
            default:
                slot = BodySlot.Head;
                return false;
        }
    }

    public static string Label(BodySlot s) => s switch
    {
        BodySlot.Head  => "Head",
        BodySlot.Torso => "Torso",
        BodySlot.Arms  => "Arms",
        BodySlot.Legs  => "Legs",
        BodySlot.Feet  => "Feet",
        BodySlot.LHand => "L Hand",
        BodySlot.RHand => "R Hand",
        BodySlot.Back  => "Back",
        _              => s.ToString(),
    };
}
