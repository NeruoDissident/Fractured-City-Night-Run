namespace Nightrun.Entities;

/// <summary>
/// Primary attribute block for an entity. 10 = average human, 15 = exceptional,
/// 5 = very poor. All combat math keys off the delta from 10 (so default stats
/// contribute zero bonuses). Ported from the JS <c>stats</c> object on player
/// and NPC profiles.
/// </summary>
public struct Stats
{
    public int Strength;
    public int Agility;
    public int Endurance;
    public int Intelligence;
    public int Perception;

    public static Stats Average => new()
    {
        Strength = 10, Agility = 10, Endurance = 10, Intelligence = 10, Perception = 10,
    };
}
