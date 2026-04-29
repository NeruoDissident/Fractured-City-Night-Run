namespace Nightrun.Rendering;

/// <summary>Rich NPC snapshot for the inspect panel.</summary>
public sealed record NpcInspectData(
    string Name,
    bool   IsHostile,
    bool   IsAlive,
    string ConditionLabel,
    byte   ConditionColor,
    int    BloodPct,
    string DetectionLabel,
    byte   DetectionColor,
    string WeaponName,
    int    WoundCount
);

/// <summary>
/// Snapshot of everything visible at an inspected tile.
/// Built each frame while inspect mode is active and passed to DrawSidebar.
/// </summary>
public sealed class InspectInfo(
    int    WorldX,
    int    WorldY,
    string TileName,
    string TileDesc,
    string? ObjectName,
    NpcInspectData? Npc,
    IReadOnlyList<string> ItemNames)
{
    public int    WorldX      { get; } = WorldX;
    public int    WorldY      { get; } = WorldY;
    public string TileName    { get; } = TileName;
    public string TileDesc    { get; } = TileDesc;
    public string? ObjectName { get; } = ObjectName;
    public NpcInspectData? Npc { get; } = Npc;
    public IReadOnlyList<string> ItemNames { get; } = ItemNames;
}
