namespace Nightrun.Content;

/// <summary>
/// Base class for interactive world objects (doors, furniture, etc.).
/// Stored per-chunk and referenced by Tile.ObjectId.
/// </summary>
public abstract class WorldObject
{
    public ushort Id;               // 1-based index into the chunk's object registry
    public string Name = "object";
    public char Glyph = '?';
    public byte Fg = 250;
    public byte Bg = 0;
    public int X, Y, Z;             // local chunk coordinates

    public int HP = 100;
    public int MaxHP = 100;
    public bool Blocked = true;
    public bool BlocksVision = false;
    public string Material = "wood";
    public double Durability = 1.0;

    public bool IsDestroyed => HP <= 0;

    /// <summary>Short status string shown in the sidebar when inspected.</summary>
    public virtual string GetStatusText()
    {
        double p = (double)HP / MaxHP * 100;
        if (p >= 90) return "Pristine";
        if (p >= 70) return "Good";
        if (p >= 50) return "Worn";
        if (p >= 30) return "Damaged";
        if (p >= 10) return "Badly Damaged";
        return "Nearly Destroyed";
    }

    /// <summary>Apply damage, scaled by the object's durability multiplier.</summary>
    public virtual void TakeDamage(int amount)
    {
        HP = Math.Max(0, HP - (int)(amount / Durability));
    }
}
