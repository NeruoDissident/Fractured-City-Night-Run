namespace Nightrun.Systems;

/// <summary>
/// World clock — advances by a fixed number of seconds per player action so
/// the game has a real day/night cycle. Also exposes a 0..1 ambient-light
/// factor the renderer can multiply colors by.
///
/// Phase 2 uses a simplified smooth-triangle day curve. Phase 3 will port
/// the full JS TimeSystem with event triggers and scheduled NPCs.
/// </summary>
public sealed class TimeSystem
{
    // Start the player at 8pm — dusk, feels like "Night Run".
    public int Hour   = 20;
    public int Minute = 0;
    public int Day    = 1;

    /// <summary>Seconds per game turn. 30s = 2 turns per in-game minute.</summary>
    public int SecondsPerTurn = 30;

    /// <summary>
    /// Monotonic turn counter — incremented every <see cref="Tick"/>. Anatomy
    /// uses this to age wounds and slide its pain-window.
    /// </summary>
    public int Turn { get; private set; }

    private int _pendingSeconds;

    /// <summary>Advance by a single in-game action worth of time.</summary>
    public void Tick()
    {
        Turn++;
        _pendingSeconds += SecondsPerTurn;
        while (_pendingSeconds >= 60)
        {
            _pendingSeconds -= 60;
            Minute++;
            if (Minute >= 60) { Minute = 0; Hour++; }
            if (Hour >= 24)  { Hour = 0; Day++; }
        }
    }

    /// <summary>Advance by a specific number of minutes (e.g. sleeping/waiting).</summary>
    public void AdvanceMinutes(int mins)
    {
        Minute += mins;
        while (Minute >= 60) { Minute -= 60; Hour++; }
        while (Hour >= 24)  { Hour -= 24; Day++; }
    }

    public string Clock => $"Day {Day}  {Hour:D2}:{Minute:D2}";

    /// <summary>
    /// Ambient-light factor in [0, 1]. 1.0 = full daylight (12:00),
    /// 0.15 = deep night (00:00). Dawn/dusk are smooth transitions.
    /// </summary>
    public double AmbientLight
    {
        get
        {
            // Map hour to phase: noon = brightest, midnight = darkest
            double t = (Hour + Minute / 60.0) / 24.0;  // 0..1 across the day
            // cosine-based smooth curve, peaks at t=0.5 (noon)
            double c = (Math.Cos((t - 0.5) * Math.PI * 2) + 1) * 0.5; // 0..1
            // Map so night floor = 0.15, day ceiling = 1.0
            return 0.15 + c * 0.85;
        }
    }

    public TimeOfDay Phase
    {
        get
        {
            var a = AmbientLight;
            if (a < 0.25) return TimeOfDay.Night;
            if (a < 0.55) return TimeOfDay.Twilight;
            return TimeOfDay.Day;
        }
    }
}

public enum TimeOfDay : byte { Night, Twilight, Day }
