using Nightrun.Content;
using Nightrun.Systems;
using Nightrun.World;

namespace Nightrun.Entities;

/// <summary>Awareness state machine for an NPC. Mirrors JS DETECTION_STATE.</summary>
public enum DetectionState : byte
{
    Unaware,     // idle, wandering
    Alert,       // heard / glimpsed something, investigating
    Searching,   // lost sight, checking last known position
    Engaged,     // actively fighting / chasing the player
    Fleeing,     // retreating due to low morale
}

/// <summary>
/// Per-turn dependencies handed to <see cref="Npc.TakeTurn"/>. Lets the NPC
/// reach the world, the player, FOV for line-of-sight, combat for attacks,
/// and the current turn index for anatomy processing without coupling to a
/// god-object.
/// </summary>
public sealed class AIContext
{
    public required IWorldMap     World;
    public required Player        Player;
    public required FOVSystem     Fov;
    public required CombatSystem  Combat;
    public required int           Turn;
    public required Random        Rng;
    public required Action<string> Log;   // message-log sink
    /// <summary>Optional callback fired after each NPC attack so the game can queue VFX.</summary>
    public Action<Systems.AttackResult, int, int>? OnAttackResult;
}

/// <summary>
/// Hostile (or passive) NPC — owns anatomy, stats, a weapon, and a simple
/// state-machine AI. 1:1 port of <c>src/entities/NPC.js</c> minus the parts
/// that depend on systems we haven't ported yet (abilities, stances,
/// sound/hearing, movement modes, combat-effects overlay).
/// </summary>
public sealed class Npc : Entity
{
    public readonly NpcProfile Profile;
    public readonly bool       Hostile;
    public DetectionState      Detection = DetectionState.Unaware;
    public (int X, int Y)?     LastKnownPlayerPos;
    public int                 TurnsWithoutSight;
    public (int X, int Y)?     InvestigateTarget;
    public int                 InvestigateTurns;
    public double              AlertLevel;   // 0..100

    public readonly int SpawnX;
    public readonly int SpawnY;

    public double Energy;
    public Item?  Weapon;

    public override Item? ActiveWeapon => Weapon ?? base.ActiveWeapon;

    public Npc(NpcProfile profile, int x, int y, int z, Random rng)
        : base(profile.Name, profile.Glyph, profile.Color)
    {
        Profile = profile;
        X = x; Y = y; Z = z;
        SpawnX = x; SpawnY = y;
        Blocks = true;
        Hostile = profile.Hostile;

        Stats = new Stats
        {
            Strength     = profile.Strength,
            Agility      = profile.Agility,
            Endurance    = profile.Endurance,
            Intelligence = profile.Intelligence,
            Perception   = profile.Perception,
        };

        Anatomy = new Anatomy(rng);
        Anatomy.Init();

        Weapon = RollWeapon(rng);
    }

    /// <summary>Pick one weapon from the profile's weighted table.</summary>
    private Item? RollWeapon(Random rng)
    {
        var table = Profile.WeaponTable;
        if (table.Length == 0) return null;

        int total = 0;
        foreach (var e in table) total += e.Weight;
        int roll = rng.Next(total);
        foreach (var e in table)
        {
            roll -= e.Weight;
            if (roll < 0)
                return e.FamilyId == null ? null : ItemCatalog.CreateByFamily(e.FamilyId);
        }
        return null;
    }

    // ── Energy-based turn ─────────────────────────────────────────────

    /// <summary>
    /// Drive this NPC's turn. Accumulates energy proportional to the player's
    /// <paramref name="actionCost"/> (100 = walk baseline) and spends it on
    /// AI actions (move/attack). Returns true if the NPC did anything.
    /// </summary>
    public void TakeTurn(AIContext ctx, int actionCost = 100)
    {
        if (IsDead || Anatomy == null) return;

        // Active effects — stunned/prone NPCs lose their turn entirely
        if (HasEffect("stunned") || HasEffect("prone")) return;

        // Anatomy first — may kill the NPC before it gets to act
        var r = Anatomy.ProcessTurn(ctx.Turn);
        foreach (var eff in r.Effects)
        {
            if (eff.Kind == "death")
                ctx.Log($"The {Name} {eff.Message}.");
        }
        if (!r.Alive) return;

        // Grappled — suffocation: drain blood each turn
        if (HasEffect("grappled"))
            Anatomy.AddWound("throat", 1.5, "puncture");

        double speedMod = HasEffect("slowed") ? 0.5 : HasEffect("overclocked") ? 2.0 : 1.0;
        Energy += Profile.Speed * speedMod * (actionCost / 100.0);
        double maxEnergy = Profile.MoveCost * 2.0;
        if (Energy > maxEnergy) Energy = maxEnergy;

        int actions = 0;
        while (Energy >= Profile.MoveCost && actions < 3)
        {
            double cost = ExecuteAI(ctx);
            if (cost <= 0) break;
            Energy -= cost;
            actions++;
        }
    }

    private double ExecuteAI(AIContext ctx)
    {
        if (ShouldFlee()) Detection = DetectionState.Fleeing;
        UpdateDetection(ctx);

        return Detection switch
        {
            DetectionState.Unaware   => BehaviorWander(ctx),
            DetectionState.Alert     => BehaviorInvestigate(ctx),
            DetectionState.Searching => BehaviorSearch(ctx),
            DetectionState.Engaged   => BehaviorEngage(ctx),
            DetectionState.Fleeing   => BehaviorFlee(ctx),
            _                        => BehaviorWander(ctx),
        };
    }

    // ── Detection / awareness ─────────────────────────────────────────

    private void UpdateDetection(AIContext ctx)
    {
        var player = ctx.Player;

        if (player.Z != Z)
        {
            if (Detection is DetectionState.Engaged or DetectionState.Searching)
            {
                Detection = DetectionState.Searching;
                TurnsWithoutSight++;
            }
            return;
        }

        bool canSee = CanSeePlayer(ctx);

        if (canSee)
        {
            LastKnownPlayerPos = (player.X, player.Y);
            TurnsWithoutSight = 0;

            if (Detection == DetectionState.Fleeing) return;

            if (Hostile)
            {
                if (Detection == DetectionState.Unaware)
                {
                    if (ctx.Rng.NextDouble() < Profile.Aggression)
                    {
                        Detection = DetectionState.Engaged;
                        ctx.Log($"{Name} spots you!");
                    }
                    else
                    {
                        Detection = DetectionState.Alert;
                    }
                }
                else
                {
                    Detection = DetectionState.Engaged;
                }
            }
            else
            {
                if (Detection == DetectionState.Unaware)
                    Detection = DetectionState.Alert;
            }
        }
        else
        {
            if (Detection == DetectionState.Engaged)
            {
                Detection = DetectionState.Searching;
                TurnsWithoutSight = 1;
            }
            else if (Detection == DetectionState.Searching)
            {
                TurnsWithoutSight++;
                if (TurnsWithoutSight >= Profile.GiveUpTurns)
                {
                    Detection = DetectionState.Unaware;
                    LastKnownPlayerPos = null;
                    InvestigateTarget  = null;
                    AlertLevel = 0;
                }
            }
            else if (Detection == DetectionState.Alert)
            {
                if (InvestigateTarget == null && LastKnownPlayerPos == null)
                {
                    Detection = DetectionState.Unaware;
                    AlertLevel = 0;
                }
            }
        }

        // Leash — give up chase if too far from spawn
        if (Detection is DetectionState.Engaged or DetectionState.Searching)
        {
            int dist = Math.Abs(X - SpawnX) + Math.Abs(Y - SpawnY);
            if (dist > Profile.LeashRange)
            {
                Detection = DetectionState.Unaware;
                LastKnownPlayerPos = null;
                InvestigateTarget  = null;
                AlertLevel = 0;
            }
        }
    }

    private bool CanSeePlayer(AIContext ctx)
    {
        var player = ctx.Player;
        if (player.Z != Z) return false;

        int dx = player.X - X;
        int dy = player.Y - Y;
        double dist = Math.Sqrt(dx * dx + dy * dy);

        int range = Profile.VisionRange;
        if (dist > range) return false;

        return ctx.Fov.HasLineOfSight(X, Y, player.X, player.Y, Z);
    }

    private bool ShouldFlee()
    {
        if (Profile.Courage >= 1.0) return false;
        if (Detection == DetectionState.Unaware) return false;
        if (Anatomy == null) return false;

        if (Anatomy.GetBloodPercent() / 100 < Profile.Courage) return true;
        if (Anatomy.GetDestroyedParts().Count >= 3) return true;
        return false;
    }

    // ── Behaviors ─────────────────────────────────────────────────────

    private double BehaviorWander(AIContext ctx)
    {
        if (ctx.Rng.NextDouble() >= Profile.WanderChance) return 0;

        int dx = ctx.Rng.Next(3) - 1;
        int dy = ctx.Rng.Next(3) - 1;
        if (dx == 0 && dy == 0) return 0;

        int nx = X + dx, ny = Y + dy;
        if (!IsTileBlockedFor(ctx, nx, ny))
        {
            X = nx; Y = ny;
            return Profile.MoveCost;
        }
        return 0;
    }

    private double BehaviorInvestigate(AIContext ctx)
    {
        var target = InvestigateTarget ?? LastKnownPlayerPos;
        if (target is null)
        {
            Detection = DetectionState.Unaware;
            return 0;
        }

        int dx = target.Value.X - X, dy = target.Value.Y - Y;
        if (Math.Abs(dx) <= 1 && Math.Abs(dy) <= 1)
        {
            InvestigateTarget = null;
            InvestigateTurns = 0;
            if (LastKnownPlayerPos is not null)
            {
                Detection = DetectionState.Searching;
                TurnsWithoutSight = Profile.GiveUpTurns / 2;
            }
            else
            {
                Detection = DetectionState.Unaware;
            }
            return 0;
        }

        return MoveToward(ctx, target.Value.X, target.Value.Y);
    }

    private double BehaviorSearch(AIContext ctx)
    {
        if (LastKnownPlayerPos is null)
        {
            Detection = DetectionState.Unaware;
            return 0;
        }

        var p = LastKnownPlayerPos.Value;
        int dx = p.X - X, dy = p.Y - Y;
        if (Math.Abs(dx) <= 2 && Math.Abs(dy) <= 2)
            return BehaviorWander(ctx);

        return MoveToward(ctx, p.X, p.Y);
    }

    private double BehaviorEngage(AIContext ctx)
    {
        var player = ctx.Player;
        int dx = player.X - X, dy = player.Y - Y;
        int manhattan = Math.Abs(dx) + Math.Abs(dy);

        if (manhattan == 1)
        {
            var ar = ctx.Combat.ResolveAttack(this, player, Weapon);
            ctx.OnAttackResult?.Invoke(ar, player.X, player.Y);
            return Profile.AttackCost;
        }

        return MoveToward(ctx, player.X, player.Y);
    }

    private double BehaviorFlee(AIContext ctx)
    {
        var player = ctx.Player;
        int dx = X - player.X;   // away from player
        int dy = Y - player.Y;
        int manhattan = Math.Abs(dx) + Math.Abs(dy);

        if (manhattan > Profile.LeashRange * 3 / 4)
        {
            Detection = DetectionState.Unaware;
            LastKnownPlayerPos = null;
            AlertLevel = 0;
            return 0;
        }

        int mx = 0, my = 0;
        if (Math.Abs(dx) >= Math.Abs(dy)) mx = dx > 0 ? 1 : -1;
        else                              my = dy > 0 ? 1 : -1;

        int nx = X + mx, ny = Y + my;
        if (!IsTileBlockedFor(ctx, nx, ny))
        {
            X = nx; Y = ny;
            return Profile.MoveCost;
        }

        // Try perpendicular
        (int x, int y)[] alts = { (my, -mx), (-my, mx) };
        foreach (var alt in alts)
        {
            if (alt.x == 0 && alt.y == 0) continue;
            int ax = X + alt.x, ay = Y + alt.y;
            if (!IsTileBlockedFor(ctx, ax, ay))
            {
                X = ax; Y = ay;
                return Profile.MoveCost;
            }
        }
        return 0;
    }

    // ── Movement helper ───────────────────────────────────────────────

    private double MoveToward(AIContext ctx, int tx, int ty)
    {
        var player = ctx.Player;
        int dx = tx - X, dy = ty - Y;

        int mx = 0, my = 0;
        if (Math.Abs(dx) > Math.Abs(dy))       mx = dx > 0 ? 1 : -1;
        else if (dy != 0)                       my = dy > 0 ? 1 : -1;
        else if (dx != 0)                       mx = dx > 0 ? 1 : -1;

        int nx = X + mx, ny = Y + my;

        // Stepping onto the player → attack instead (if hostile + engaged)
        if (nx == player.X && ny == player.Y && player.Z == Z)
        {
            if (Hostile && Detection == DetectionState.Engaged)
            {
                var ar = ctx.Combat.ResolveAttack(this, player, Weapon);
                ctx.OnAttackResult?.Invoke(ar, player.X, player.Y);
                return Profile.AttackCost;
            }
            return 0;
        }

        if (!IsTileBlockedFor(ctx, nx, ny))
        {
            X = nx; Y = ny;
            return Profile.MoveCost;
        }

        // Alternate axis fallback
        int ax = 0, ay = 0;
        if (mx != 0) ay = dy > 0 ? 1 : (dy < 0 ? -1 : (ctx.Rng.NextDouble() < 0.5 ? 1 : -1));
        else         ax = dx > 0 ? 1 : (dx < 0 ? -1 : (ctx.Rng.NextDouble() < 0.5 ? 1 : -1));

        int anx = X + ax, any = Y + ay;
        if (anx == player.X && any == player.Y && player.Z == Z)
        {
            if (Hostile && Detection == DetectionState.Engaged)
            {
                var ar = ctx.Combat.ResolveAttack(this, player, Weapon);
                ctx.OnAttackResult?.Invoke(ar, player.X, player.Y);
                return Profile.AttackCost;
            }
            return 0;
        }

        if (!IsTileBlockedFor(ctx, anx, any))
        {
            X = anx; Y = any;
            return Profile.MoveCost;
        }
        return 0;
    }

    /// <summary>
    /// True if the NPC cannot step onto (x,y). Combines tile solidity with
    /// other NPC occupants. The player tile itself is not considered blocked
    /// here — combat resolves that separately.
    /// </summary>
    private bool IsTileBlockedFor(AIContext ctx, int x, int y)
    {
        var t = ctx.World.GetTile(x, y, Z);
        if (t.IsBlocked || t.IsWater) return true;

        // Other NPCs block us
        var other = ctx.World.GetNpcAt(x, y, Z);
        if (other != null && other != this && !other.IsDead) return true;

        return false;
    }

    // ── Hearing ───────────────────────────────────────────────────────

    /// <summary>
    /// React to a nearby sound. Distance is precomputed by
    /// <see cref="SoundSystem"/>. Mirrors JS <c>NPC.hearSound</c>: louder and
    /// closer sounds raise <see cref="AlertLevel"/> faster, and sufficiently
    /// loud ones convert an Unaware NPC into an investigating Alert one
    /// with <see cref="InvestigateTarget"/> pointing at the noise source.
    /// Engaged / Fleeing NPCs ignore sounds — their current behavior takes
    /// precedence.
    /// </summary>
    public void HearSound(Sound s, double dist)
    {
        if (dist > Profile.HearingRange) return;
        if (Detection == DetectionState.Engaged) return;
        if (Detection == DetectionState.Fleeing) return;

        double volumeFactor = s.Volume / Math.Max(1.0, dist);
        AlertLevel = Math.Min(100, AlertLevel + volumeFactor * 30);

        if (AlertLevel >= 40 || s.Volume >= 6)
        {
            InvestigateTarget = (s.X, s.Y);
            InvestigateTurns  = 10;
            if (Detection == DetectionState.Unaware)
                Detection = DetectionState.Alert;
        }
    }

    // ── UI helpers ────────────────────────────────────────────────────

    public string DetectionLabel => Detection switch
    {
        DetectionState.Unaware   => "Unaware",
        DetectionState.Alert     => "Alert",
        DetectionState.Searching => "Searching",
        DetectionState.Engaged   => "Hostile",
        DetectionState.Fleeing   => "Fleeing",
        _                        => "?",
    };

    public byte DetectionColor => Detection switch
    {
        DetectionState.Unaware   => 244,
        DetectionState.Alert     => 226,
        DetectionState.Searching => 214,
        DetectionState.Engaged   => 196,
        DetectionState.Fleeing   => 46,
        _                        => 255,
    };
}
