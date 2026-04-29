namespace Nightrun.Content;

/// <summary>
/// One entry of an NPC's randomized weapon loadout. <see cref="FamilyId"/>
/// names an entry in <see cref="ItemCatalog"/>; null = unarmed (fists).
/// </summary>
public readonly record struct WeaponRoll(int Weight, string? FamilyId);

/// <summary>
/// Data-driven profile for an NPC kind. Adding a new enemy means adding a
/// new entry to <see cref="NpcTypes.All"/> — no code changes needed.
/// Mirrors <c>NPC_TYPES</c> in <c>src/entities/NPC.js</c>.
/// </summary>
public sealed record class NpcProfile(
    string Key,
    string Name,
    char   Glyph,
    byte   Color,

    // Stats (10 = average human)
    int Strength,
    int Agility,
    int Endurance,
    int Intelligence,
    int Perception,

    // Speed / energy
    int Speed,          // energy gained per player action (100 = walk baseline)
    int AttackCost,     // energy cost to attack
    int MoveCost,       // energy cost to move one tile

    // Detection
    int VisionRange,
    int HearingRange,

    // Behavior
    bool   Hostile,
    double Aggression,  // 0..1 — chance to engage on first sight
    double Courage,     // 0..1 — flees when blood% below this (1.0 = never)
    int    LeashRange,  // max tiles from spawn before giving up chase
    int    GiveUpTurns, // turns without sight before returning to wander
    double WanderChance, // chance to take a random step when idle

    // Weapons
    WeaponRoll[] WeaponTable
);

/// <summary>Catalog of all NPC kinds. 1:1 port of JS <c>NPC_TYPES</c>.</summary>
public static class NpcTypes
{
    public static readonly Dictionary<string, NpcProfile> All = new(StringComparer.Ordinal)
    {
        ["scavenger"] = new(
            Key: "scavenger", Name: "Scavenger", Glyph: 's', Color: 244,
            Strength: 7, Agility: 8, Endurance: 8, Intelligence: 8, Perception: 8,
            Speed: 70, AttackCost: 100, MoveCost: 100,
            VisionRange: 6, HearingRange: 10,
            Hostile: false, Aggression: 0.0, Courage: 1.0,
            LeashRange: 15, GiveUpTurns: 5, WanderChance: 0.30,
            WeaponTable: new WeaponRoll[] { new(100, null) }
        ),

        ["raider"] = new(
            Key: "raider", Name: "Raider", Glyph: 'R', Color: 203,
            Strength: 11, Agility: 10, Endurance: 10, Intelligence: 8, Perception: 9,
            Speed: 85, AttackCost: 100, MoveCost: 100,
            VisionRange: 8, HearingRange: 14,
            Hostile: true, Aggression: 0.80, Courage: 0.35,
            LeashRange: 25, GiveUpTurns: 15, WanderChance: 0.30,
            WeaponTable: new WeaponRoll[]
            {
                new(30, "shiv"),
                new(30, "pipe"),
                new(20, "knife"),
                new(20, null),   // unarmed
            }
        ),

        ["armed_raider"] = new(
            Key: "armed_raider", Name: "Armed Raider", Glyph: 'A', Color: 209,
            Strength: 12, Agility: 11, Endurance: 11, Intelligence: 9, Perception: 10,
            Speed: 90, AttackCost: 100, MoveCost: 100,
            VisionRange: 9, HearingRange: 14,
            Hostile: true, Aggression: 0.90, Courage: 0.25,
            LeashRange: 30, GiveUpTurns: 20, WanderChance: 0.20,
            WeaponTable: new WeaponRoll[]
            {
                new(40, "knife"),
                new(35, "pipe"),
                new(25, "shiv"),
            }
        ),

        ["brute"] = new(
            Key: "brute", Name: "Brute", Glyph: 'B', Color: 166,
            Strength: 15, Agility: 7, Endurance: 14, Intelligence: 6, Perception: 7,
            Speed: 70, AttackCost: 120, MoveCost: 100,
            VisionRange: 6, HearingRange: 10,
            Hostile: true, Aggression: 1.00, Courage: 0.15,
            LeashRange: 20, GiveUpTurns: 10, WanderChance: 0.15,
            WeaponTable: new WeaponRoll[]
            {
                new(40, "pipe"),
                new(30, "spiked_club"),
                new(30, null),   // unarmed — still dangerous with STR 15
            }
        ),

        ["stalker"] = new(
            Key: "stalker", Name: "Stalker", Glyph: 'S', Color: 99,
            Strength: 9, Agility: 14, Endurance: 9, Intelligence: 11, Perception: 13,
            Speed: 100, AttackCost: 90, MoveCost: 90,
            VisionRange: 11, HearingRange: 18,
            Hostile: true, Aggression: 0.60, Courage: 0.50,
            LeashRange: 35, GiveUpTurns: 25, WanderChance: 0.40,
            WeaponTable: new WeaponRoll[]
            {
                new(60, "knife"),
                new(40, "shiv"),
            }
        ),
    };

    public static NpcProfile Get(string key) => All[key];
}
