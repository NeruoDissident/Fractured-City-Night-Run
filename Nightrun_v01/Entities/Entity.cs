using Nightrun.Content;

namespace Nightrun.Entities;

/// <summary>
/// Base entity — anything that occupies a tile and has a visual representation.
/// Uses world coordinates (not chunk-local). Combatants (Player, Npc) also
/// get an <see cref="Anatomy"/> body simulation and a <see cref="Stats"/>
/// attribute block; the base class carries nullable refs so the CombatSystem
/// can treat every entity uniformly.
/// </summary>
public class Entity
{
    public int X;
    public int Y;
    public int Z;
    public char Glyph;
    public byte Fg;
    public byte Bg;
    public string Name;
    public bool Blocks;

    public readonly Equipment Equipment = new();
    public readonly Inventory Inventory;

    /// <summary>Full body simulation. Null for inanimate entities.</summary>
    public Anatomy? Anatomy;

    /// <summary>Primary attribute block (defaults to average human).</summary>
    public Stats Stats = Stats.Average;

    /// <summary>
    /// Weapon currently in-use for combat rolls. Defaults to what's in the
    /// right hand; NPCs override this to return their rolled weapon.
    /// </summary>
    public virtual Item? ActiveWeapon => Equipment.RHand ?? Equipment.LHand;

    public bool IsDead => Anatomy?.IsDead() ?? false;

    // ── Ability system (F7) ─────────────────────────────────────────────────
    /// <summary>Per-ability cooldown counters. Key = ability ID, value = turns remaining.</summary>
    public readonly Dictionary<string, int> Cooldowns = new();

    /// <summary>
    /// Active timed effects on this entity. Key = effect ID, value = turns remaining.
    /// Effect IDs: "stunned", "prone", "guard_break", "grappled", "slowed",
    /// "impaired_vision", "pain_spike". Consumed by NPC AI and CombatSystem.
    /// </summary>
    public readonly Dictionary<string, int> ActiveEffects = new();

    public bool HasEffect(string id) => ActiveEffects.TryGetValue(id, out int t) && t > 0;

    public void ApplyEffect(string id, int turns)
    {
        if (!ActiveEffects.TryGetValue(id, out int cur) || cur < turns)
            ActiveEffects[id] = turns;
    }

    public Entity(string name, char glyph, byte fg, byte bg = 0)
    {
        Name = name; Glyph = glyph; Fg = fg; Bg = bg;
        Inventory = new Inventory(Equipment);
    }
}
