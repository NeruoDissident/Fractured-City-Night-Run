using Nightrun.Entities;
using Nightrun.World;

namespace Nightrun.Systems;

/// <summary>
/// One active noise event in the world. <see cref="Range"/> is the maximum
/// distance at which any NPC can hear it; <see cref="Volume"/> is the
/// intensity used in the alert-level math (louder sounds raise alertness
/// faster and can convert Unaware NPCs straight to Alert). <see cref="Source"/>
/// is the entity that caused the noise so it doesn't react to itself.
/// </summary>
public sealed class Sound
{
    public int X, Y, Z;
    public int Volume;
    public int Range;
    public string Type = "generic";
    public Entity? Source;
    public int TurnsRemaining = 2;
}

/// <summary>
/// Port of <c>src/systems/SoundSystem.js</c>. Keeps a list of recently-made
/// sounds (decays after 2 turns) and alerts eligible NPCs when new ones are
/// created. NPCs hook in via <see cref="Npc.HearSound"/>; non-NPC entities
/// currently don't react.
/// </summary>
public sealed class SoundSystem
{
    private readonly IWorldMap _world;
    private readonly List<Sound>  _active = new();

    public SoundSystem(IWorldMap world) { _world = world; }

    public IReadOnlyList<Sound> Active => _active;

    /// <summary>
    /// Register a new sound at <paramref name="x"/>,<paramref name="y"/> and
    /// immediately alert every NPC within <paramref name="range"/>. No-op
    /// when volume ≤ 0.
    /// </summary>
    public void MakeSound(int x, int y, int z,
                          int volume, int range,
                          string type = "generic",
                          Entity? source = null)
    {
        if (volume <= 0 || range <= 0) return;

        var s = new Sound
        {
            X = x, Y = y, Z = z,
            Volume = volume, Range = range,
            Type = type, Source = source,
        };
        _active.Add(s);
        AlertNearbyNpcs(s);
    }

    /// <summary>Called once per player turn — ages + culls sounds.</summary>
    public void ProcessTurn()
    {
        for (int i = _active.Count - 1; i >= 0; i--)
        {
            _active[i].TurnsRemaining--;
            if (_active[i].TurnsRemaining <= 0)
                _active.RemoveAt(i);
        }
    }

    /// <summary>Throw away every sound (e.g. on world reseed).</summary>
    public void Clear() => _active.Clear();

    private void AlertNearbyNpcs(Sound s)
    {
        foreach (var npc in _world.Npcs)
        {
            if (npc.IsDead) continue;
            if (npc == s.Source) continue;
            if (npc.Z != s.Z) continue;

            int dx = npc.X - s.X;
            int dy = npc.Y - s.Y;
            double dist = Math.Sqrt(dx * dx + dy * dy);
            if (dist > s.Range) continue;

            npc.HearSound(s, dist);
        }
    }
}
