namespace Nightrun.World;

/// <summary>
/// Describes a zone type shown on the zone-selection screen.
/// The generator uses this to decide room counts, NPC profiles,
/// loot density, and the structural palette.
/// </summary>
public sealed record ZoneProfile(
    string Id,
    string Name,
    string Description,
    ZoneTheme Theme,
    int    ThreatLevel,     // 1–5
    float  EchoDensity,     // 0.0 – 1.0
    int    Width  = 80,
    int    Height = 50,
    int    MinZ   = 0,      // lowest Z level (negative = underground)
    int    MaxZ   = 0);     // highest Z level (positive = upper floors)

/// <summary>High-level theme that drives tile palette + generator pass selection.</summary>
public enum ZoneTheme : byte
{
    UrbanRuins,         // rubble-strewn streets, collapsed apartments, scavenger territory
    Sewer,              // tight tunnels, standing water, ambush enemies
    CorporateTower,     // intact offices, security bots, high-value loot
    Wasteland,          // open map, long LoS, sparse structures, exposure danger
    Subway,             // dark corridors, echo-heavy, rat swarms
    Suburbs,            // residential streets, wood-frame houses, sparse NPCs
    CollapsedDistrict,  // dense ruins, salvage-heavy, structural hazards
    Industrial,         // warehouses, factory floors, hazmat, armed guards
    Waterfront,         // docks, flooded warehouses, water hazards
    Forest,             // dense tree cover, stalker territory, no buildings
    CorporateResidential, // executive housing blocks, gated compounds, corp security
}

/// <summary>
/// Central catalog of all available zones.
/// Zone select screen reads this list directly — add a new record to unlock a new zone.
/// </summary>
public static class ZoneCatalog
{
    public static readonly IReadOnlyList<ZoneProfile> All = new ZoneProfile[]
    {
        // ── Urban biomes ────────────────────────────────────────────
        new(
            Id:          "urban_ruins",
            Name:        "Urban Ruins",
            Description: "Collapsed apartment blocks and rubble-choked streets. Scavengers and raiders compete over dwindling salvage.",
            Theme:       ZoneTheme.UrbanRuins,
            ThreatLevel: 2,
            EchoDensity: 0.1f,
            Width:       120,
            Height:      80,
            MinZ:        -1),  // manholes lead to sewers

        new(
            Id:          "suburbs",
            Name:        "The Suburbs",
            Description: "Crumbling residential sprawl. Overgrown lawns, looted houses, and scavenger camps in cul-de-sacs.",
            Theme:       ZoneTheme.Suburbs,
            ThreatLevel: 1,
            EchoDensity: 0.05f,
            Width:       120,
            Height:      80),

        new(
            Id:          "collapsed_district",
            Name:        "Collapsed District",
            Description: "A dense block of ruins — walls caved in, floors collapsed, salvage buried under rubble. High danger, high reward.",
            Theme:       ZoneTheme.CollapsedDistrict,
            ThreatLevel: 3,
            EchoDensity: 0.2f,
            Width:       110,
            Height:      75,
            MinZ:        -1),  // manholes lead to sewers

        new(
            Id:          "corp_residential",
            Name:        "Corporate Residential",
            Description: "Sealed executive housing blocks and gated compounds. Security still runs. The loot is worth the risk.",
            Theme:       ZoneTheme.CorporateResidential,
            ThreatLevel: 3,
            EchoDensity: 0.15f,
            Width:       120,
            Height:      80),

        new(
            Id:          "corporate_tower",
            Name:        "Corporate Tower",
            Description: "A half-collapsed corporate arcology. Intact server floors above, flooded basement below. High-value loot, high-risk NPCs.",
            Theme:       ZoneTheme.CorporateTower,
            ThreatLevel: 4,
            EchoDensity: 0.2f,
            Width:       80,
            Height:      120,
            MinZ:        -1,   // flooded basement
            MaxZ:        3),   // 3 upper floors

        // ── Underground ─────────────────────────────────────────────
        new(
            Id:          "sewer",
            Name:        "The Sewers",
            Description: "Flooded service tunnels beneath the city. Narrow chokepoints, total darkness, and things that listen.",
            Theme:       ZoneTheme.Sewer,
            ThreatLevel: 3,
            EchoDensity: 0.4f,
            Width:       100,
            Height:      70),

        new(
            Id:          "subway",
            Name:        "The Subway",
            Description: "Derelict transit tunnels. Echo anomalies cluster here. Raiders use the platforms as fortified camps.",
            Theme:       ZoneTheme.Subway,
            ThreatLevel: 3,
            EchoDensity: 0.5f,
            Width:       130,
            Height:      60),

        // ── Industrial ──────────────────────────────────────────────
        new(
            Id:          "industrial",
            Name:        "Industrial Zone",
            Description: "Vast warehouses and factory floors, stripped and contested. Hazardous materials and armed salvage crews.",
            Theme:       ZoneTheme.Industrial,
            ThreatLevel: 3,
            EchoDensity: 0.15f,
            Width:       120,
            Height:      80,
            MinZ:        -1),  // manholes lead to sewers

        // ── Wilderness ──────────────────────────────────────────────
        new(
            Id:          "wasteland",
            Name:        "The Wasteland",
            Description: "Open ground between the city blocks — overgrown, exposed, and silent except for the wind and distant gunfire.",
            Theme:       ZoneTheme.Wasteland,
            ThreatLevel: 2,
            EchoDensity: 0.1f,
            Width:       140,
            Height:      100),

        new(
            Id:          "forest",
            Name:        "The Overgrowth",
            Description: "The city's outer ring has been reclaimed by dense forest. Stalkers hunt here. The canopy blocks signal.",
            Theme:       ZoneTheme.Forest,
            ThreatLevel: 2,
            EchoDensity: 0.15f,
            Width:       130,
            Height:      90),

        // ── Waterfront ──────────────────────────────────────────────
        new(
            Id:          "waterfront",
            Name:        "The Waterfront",
            Description: "Derelict docks and half-flooded warehouses at the city's edge. Smuggler routes still active.",
            Theme:       ZoneTheme.Waterfront,
            ThreatLevel: 2,
            EchoDensity: 0.1f,
            Width:       130,
            Height:      80),
    };

    private static readonly Dictionary<string, ZoneProfile> _index
        = All.ToDictionary(z => z.Id);

    public static ZoneProfile? Get(string id)
        => _index.TryGetValue(id, out var z) ? z : null;
}
