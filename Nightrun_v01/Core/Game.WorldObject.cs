using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Rendering;
using Nightrun.Systems;
using Nightrun.World;

namespace Nightrun.Core;

public sealed partial class Game
{
    // ------------------------------------------------------------------
    // Mode: WorldObject (peek / knock / smash / disassemble adjacent objects)

    /// <summary>
    /// Scan the 8 tiles adjacent to the player for interactive world
    /// objects (doors + furniture) and enter object-pick mode. If nothing
    /// is adjacent, log and stay in play mode so we don't eat a turn.
    /// </summary>
    private void EnterWorldObjectMode()
    {
        _woObjects.Clear();
        for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
        {
            if (dx == 0 && dy == 0) continue;
            var obj = _world.GetObjectAt(_player.X + dx, _player.Y + dy, _player.Z);
            if (obj is Door or Furniture) _woObjects.Add(obj);
        }
        if (_woObjects.Count == 0)
        {
            AddMessage("Nothing to interact with nearby.");
            return;
        }
        _woSub    = WoSubMode.PickObject;
        _woCursor = 0;
        _woTarget = null;
        _mode     = GameMode.WorldObject;
    }

    private void ProcessWorldObjectInput()
    {
        var info = InputSystem.ReadKey();
        var ch   = info.KeyChar;
        var key  = info.Key;

        if (key == ConsoleKey.Escape || key == ConsoleKey.Q || ch == 'z' || ch == 'Z')
        {
            if (_woSub == WoSubMode.PickAction)
            {
                _woSub    = WoSubMode.PickObject;
                _woTarget = null;
                return;
            }
            _mode = GameMode.Playing;
            return;
        }

        if (_woSub == WoSubMode.PickObject)
        {
            int n = _woObjects.Count;
            if (n == 0) { _mode = GameMode.Playing; return; }
            if (key == ConsoleKey.UpArrow   || key == ConsoleKey.K) { _woCursor = (_woCursor - 1 + n) % n; return; }
            if (key == ConsoleKey.DownArrow || key == ConsoleKey.J) { _woCursor = (_woCursor + 1) % n; return; }
            if (ch >= 'a' && ch <= 'z')
            {
                int idx = ch - 'a';
                if (idx < n) { _woCursor = idx; BeginActionPick(); return; }
            }
            if (key == ConsoleKey.Enter || ch == ' ')
                BeginActionPick();
            return;
        }

        // PickAction sub-mode
        {
            int n = _woActions.Count;
            if (n == 0 || _woTarget == null) { _woSub = WoSubMode.PickObject; return; }
            if (key == ConsoleKey.UpArrow   || key == ConsoleKey.K) { _woActionCursor = (_woActionCursor - 1 + n) % n; return; }
            if (key == ConsoleKey.DownArrow || key == ConsoleKey.J) { _woActionCursor = (_woActionCursor + 1) % n; return; }
            if (ch >= 'a' && ch <= 'z')
            {
                int idx = ch - 'a';
                if (idx < n) { _woActionCursor = idx; ExecuteWorldObjectAction(); return; }
            }
            if (key == ConsoleKey.Enter || ch == ' ')
                ExecuteWorldObjectAction();
        }
    }

    /// <summary>
    /// Populate the per-target action list based on object type / state.
    /// Doors get peek+knock when closed; anything with a drop table
    /// gets smash+disassemble (disassemble only if a tool is known).
    /// </summary>
    private void BeginActionPick()
    {
        if (_woCursor < 0 || _woCursor >= _woObjects.Count) return;
        _woTarget = _woObjects[_woCursor];
        _woActions.Clear();

        if (_woTarget is Door d && !d.Open && !d.IsDestroyed)
        {
            _woActions.Add("Peek");
            _woActions.Add("Knock");
        }
        if (!_woTarget.IsDestroyed)
        {
            _woActions.Add("Smash");
            var table = DropTableCatalog.For(_woTarget);
            if (table != null && table.DisassembleTool != null)
                _woActions.Add("Disassemble");
        }

        if (_woActions.Count == 0)
        {
            AddMessage($"Nothing you can do with the {_woTarget.Name.ToLower()}.");
            _woTarget = null;
            return;
        }
        _woActionCursor = 0;
        _woSub = WoSubMode.PickAction;
    }

    private void ExecuteWorldObjectAction()
    {
        if (_woTarget == null) return;
        if (_woActionCursor < 0 || _woActionCursor >= _woActions.Count) return;

        var action = _woActions[_woActionCursor];
        WorldObjectResult r = action switch
        {
            "Peek"        when _woTarget is Door door => _worldObj.Peek(door, _player),
            "Knock"       when _woTarget is Door door => _worldObj.Knock(door, _player),
            "Smash"       => _worldObj.Smash(_woTarget, _player),
            "Disassemble" => _worldObj.Disassemble(_woTarget, _player),
            _             => WorldObjectResult.Fail("Unknown action."),
        };

        AddMessage(r.Message);

        if (r.Success && r.NoiseVolume > 0 && r.NoiseRange > 0 && _woTarget != null)
        {
            _sound.MakeSound(
                _woTarget.X, _woTarget.Y, _player.Z,
                r.NoiseVolume, r.NoiseRange,
                type: action.ToLowerInvariant(),
                source: _player);
        }

        _mode = GameMode.Playing;
        _woTarget = null;
        _woObjects.Clear();
        _woActions.Clear();

        if (r.Success && r.TimeCost > 0)
        {
            for (int i = 0; i < r.TimeCost; i++)
            {
                TickTurn();
                if (_mode == GameMode.GameOver) return;
            }
        }
    }
}
