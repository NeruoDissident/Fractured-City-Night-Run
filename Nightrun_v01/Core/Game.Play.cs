using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Rendering;
using Nightrun.Systems;
using Nightrun.World;

namespace Nightrun.Core;

public sealed partial class Game
{
    // ------------------------------------------------------------------
    // Mode: Playing — movement, bump-attack, and action dispatch

    private void ProcessPlayInput()
    {
        var action = InputSystem.Read();
        if (action == GameAction.None) return;
        ProcessPlayAction(action);
    }

    private void ProcessPlayAction(GameAction action)
    {
        switch (action)
        {
            case GameAction.Quit:
                _running = false;
                return;

            case GameAction.ExitZone:
                ExitToOverworld();
                return;

            case GameAction.NewRun:
                _seed++;
                _charData     = CharacterCreationScreen.Run(_renderer);
                _worldManager = new WorldManager(_seed);
                _overworld    = OverworldMap.Build(_worldManager);
                OverworldScreen_RevealStart(_overworld);
                _player       = null!;
                _zoneCache.Clear();
                _currentTile  = null;
                _seen.Clear();
                _log.Clear();
                AddMessage($"New run. Seed {_seed}.", 226);
                _mode = GameMode.Overworld;
                return;

            case GameAction.Regenerate:
                _seed++;
                InitWorld(_seed);
                _seen.Clear();
                _log.Clear();
                AddMessage($"Reseeded: {_seed}");
                return;

            case GameAction.ToggleOverlay:
                _showBiomeOverlay = !_showBiomeOverlay;
                return;

            case GameAction.OpenInventory:
                EnterInventoryMode();
                return;

            case GameAction.OpenCharacter:
                _mode = GameMode.Character;
                return;

            case GameAction.OpenCrafting:
                EnterCraftingMode();
                return;

            case GameAction.OpenTalents:
                TalentScreen.Run(_renderer, _player);
                return;

            case GameAction.OpenAbilities:
                UseAbility();
                return;

            case GameAction.Wait:
                AddMessage("You wait.");
                TickTurn();
                return;

            case GameAction.Interact:
                {
                    var r = _movement.Interact(_player);
                    if (!string.IsNullOrEmpty(r.Message)) AddMessage(r.Message);
                    if (r.OpenContainer is { } furn)
                    {
                        _containerTarget = furn;
                        _containerSlots  = ContainerScreen.BuildSlots(furn);
                        _invCursor = 0;
                        _mode = GameMode.Container;
                        return;
                    }
                    if (r.ConsumedTurn) TickTurn();
                    return;
                }

            case GameAction.Ascend:
                AddMessage(_movement.Ascend(_player));
                TickTurn();
                return;

            case GameAction.Descend:
                AddMessage(_movement.Descend(_player));
                TickTurn();
                return;

            case GameAction.Attack:
                TryFKeyAttack();
                return;

            case GameAction.ObjectMenu:
                EnterWorldObjectMode();
                return;

            case GameAction.Inspect:
                EnterInspectMode();
                return;
        }

        // Movement — check for bump-to-attack first, then delegate to MovementSystem.
        var (dx, dy) = InputSystem.ActionToDelta(action);
        if (dx != 0 || dy != 0)
        {
            int nx = _player.X + dx;
            int ny = _player.Y + dy;
            var npc = _world.GetNpcAt(nx, ny, _player.Z);
            if (npc != null && !npc.IsDead)
            {
                AttackNpc(npc);
                return;
            }

            var msg = _movement.TryMove(_player, dx, dy);
            if (!string.IsNullOrEmpty(msg)) AddMessage(msg);
            // Footsteps — volume 6 (walking), NPCs can hear within ~8 tiles
            _sound.MakeSound(_player.X, _player.Y, _player.Z, 6, 8, "footstep", _player);
            TickTurn();
        }
    }

    // ------------------------------------------------------------------
    // Abilities

    /// <summary>
    /// Open the ability picker. If the player selects an ability, auto-target
    /// the nearest hostile adjacent NPC. If no NPC is adjacent, show a message.
    /// Consumes a turn on success.
    /// </summary>
    private void UseAbility()
    {
        var ability = AbilityScreen.Pick(_renderer, _player);
        if (ability == null) return;  // cancelled

        Npc? target = NearestAdjacentTarget();
        if (target == null)
        {
            AddMessage($"No adjacent target for {ability.Name}.");
            return;
        }

        var result = _abilities.Execute(_player, target, ability);
        if (!result.Used)
        {
            AddMessage(result.FailReason ?? "Can't use that ability.");
            return;
        }

        // VFX: show ability callout on the target
        _vfx.AbilityUsed(target.X, target.Y, ability.Name);

        if (target.Detection == DetectionState.Unaware)
            target.Detection = DetectionState.Engaged;

        TickTurn();
    }

    private Npc? NearestHostileAdjacent()
    {
        for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
        {
            if (dx == 0 && dy == 0) continue;
            var n = _world.GetNpcAt(_player.X + dx, _player.Y + dy, _player.Z);
            if (n != null && !n.IsDead && n.Hostile) return n;
        }
        return null;
    }

    /// <summary>
    /// Find the nearest adjacent NPC. Targets ANY non-dead NPC so the player
    /// can always aim abilities at whatever is standing next to them.
    /// Prefers hostile-profile NPCs when multiple are adjacent.
    /// </summary>
    private Npc? NearestAdjacentTarget()
    {
        Npc? fallback = null;
        for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
        {
            if (dx == 0 && dy == 0) continue;
            var n = _world.GetNpcAt(_player.X + dx, _player.Y + dy, _player.Z);
            if (n == null || n.IsDead) continue;
            if (n.Hostile) return n;        // take first profile-hostile immediately
            fallback ??= n;                 // keep any NPC as fallback
        }
        return fallback;
    }

    private Npc? NearestHostileInRange(int range)
    {
        Npc? best = null;
        int  bestDist = int.MaxValue;
        foreach (var npc in _world.Npcs)
        {
            if (npc.IsDead || !npc.Hostile || npc.Z != _player.Z) continue;
            int dx = npc.X - _player.X;
            int dy = npc.Y - _player.Y;
            int dist = dx * dx + dy * dy;
            if (dist <= range * range && dist < bestDist) { best = npc; bestDist = dist; }
        }
        return best;
    }

    // ------------------------------------------------------------------
    // Combat — player attack paths

    /// <summary>
    /// F-key attack — scan the 8 surrounding tiles for the nearest living
    /// hostile NPC and attack it. Falls back to a no-op message if none.
    /// </summary>
    private void TryFKeyAttack()
    {
        Npc? target = null;
        for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
        {
            if (dx == 0 && dy == 0) continue;
            var n = _world.GetNpcAt(_player.X + dx, _player.Y + dy, _player.Z);
            if (n != null && !n.IsDead && n.Hostile) { target = n; break; }
            if (n != null && !n.IsDead && target == null) target = n;
        }

        if (target == null)
        {
            AddMessage("Nothing in reach to attack.");
            return;
        }
        AttackNpc(target);
    }

    /// <summary>
    /// Resolve a player attack on <paramref name="target"/> and let the
    /// world react (turn tick + NPC AI). If the target dies, they're
    /// swept from the NPC registry on the next tick.
    /// </summary>
    private void AttackNpc(Npc target)
    {
        var result = _combat.ResolveAttack(_player, target, _player.ActiveWeapon);
        QueueCombatVfx(result, target.X, target.Y);

        // Weapon swings generate noise — blunt louder than sharp, unarmed quietest
        int vol = _player.ActiveWeapon == null ? 8 :
                  _player.ActiveWeapon.AttackType == "blunt" ? 20 : 14;
        _sound.MakeSound(_player.X, _player.Y, _player.Z, vol, vol + 4, "attack", _player);

        if (!target.IsDead && target.Detection == DetectionState.Unaware)
            target.Detection = DetectionState.Engaged;

        TickTurn();
    }

    /// <summary>
    /// Translate an <see cref="AttackResult"/> into queued combat VFX.
    /// Called for both player attacks and NPC attacks.
    /// </summary>
    private void QueueCombatVfx(AttackResult r, int wx, int wy)
    {
        if (r.Parried)       { _vfx.Parry(wx, wy); return; }
        if (!r.Hit)          { _vfx.Miss(wx, wy);  return; }
        if (r.Killed)        { _vfx.Kill(wx, wy);  return; }
        if (r.Critical)        _vfx.Crit(wx, wy, r.Damage);
        else                   _vfx.Hit(wx, wy, r.Damage);
        if (r.Staggered)      _vfx.Stagger(wx, wy);
        if (r.Blocked > 0)    _vfx.Block(wx, wy, r.Blocked);
    }
}
