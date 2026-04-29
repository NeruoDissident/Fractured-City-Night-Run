using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Rendering;
using Nightrun.Systems;
using Nightrun.World;

namespace Nightrun.Core;

public sealed partial class Game
{
    // ------------------------------------------------------------------
    // Inventory sub-mode + sort/filter/move state

    private enum InvSubMode { Browse, MovePick }
    private InvSubMode _invSub = InvSubMode.Browse;
    private InvSort    _invSort   = InvSort.Default;
    private string     _invFilter = "";
    private bool       _invSearching;
    private List<InventoryPocketRef> _movePockets = new();
    private int        _movePocketCursor;
    private InvSlot    _moveSourceSlot;
    private HashSet<string> _invPocketCollapsed = new();

    // ------------------------------------------------------------------
    // Mode: Inventory

    private void EnterInventoryMode()
    {
        _invSlots  = InventoryScreen.BuildSlots(_player, _invSort, _invFilter);
        _invCursor = Math.Min(_invCursor, Math.Max(0, _invSlots.Count - 1));
        _invSub    = InvSubMode.Browse;
        _mode = GameMode.Inventory;
    }

    private void ProcessInventoryInput()
    {
        var info = InputSystem.ReadKey();
        var ch   = info.KeyChar;
        var key  = info.Key;

        // ── Move-picker sub-mode ──
        if (_invSub == InvSubMode.MovePick)
        {
            ProcessInvMovePick(ch, key);
            return;
        }

        // ── Search typing sub-mode ──
        if (_invSearching)
        {
            if (key == ConsoleKey.Escape)
            {
                _invFilter    = "";
                _invSearching = false;
                RebuildInventory();
            }
            else if (key == ConsoleKey.Enter || key == ConsoleKey.UpArrow || key == ConsoleKey.DownArrow)
            {
                _invSearching = false;   // keep filter, exit typing
            }
            else if (key == ConsoleKey.Backspace)
            {
                if (_invFilter.Length > 0) _invFilter = _invFilter[..^1];
                RebuildInventory();
            }
            else if (ch >= ' ' && ch < 127)
            {
                _invFilter += ch;
                RebuildInventory();
            }
            return;
        }

        // ── Close inventory ──
        if (key == ConsoleKey.Escape || ch == 'i' || ch == 'I')
        {
            _invFilter    = "";
            _invSearching = false;
            _invSort      = InvSort.Default;
            _mode = GameMode.Playing;
            return;
        }

        // ── Expand/collapse the right-panel pocket that holds the selected item ──
        if (ch == 'e' || ch == 'E')
        {
            if (_invSlots.Count > 0)
            {
                string pn = _invSlots[_invCursor].PocketName;
                if (!_invPocketCollapsed.Remove(pn))
                    _invPocketCollapsed.Add(pn);
            }
            return;
        }

        // ── Sort (no cursor jump) ──
        if (ch == 's' || ch == 'S')
        {
            _invSort = _invSort switch
            {
                InvSort.Default    => InvSort.ByName,
                InvSort.ByName     => InvSort.ByWeight,
                InvSort.ByWeight   => InvSort.ByCategory,
                _                  => InvSort.Default,
            };
            RebuildInventory();
            return;
        }

        // ── Search (enter typing mode) ──
        if (ch == '/')
        {
            _invSearching = true;
            return;
        }

        if (_invSlots.Count == 0)
        {
            if (ch == 'c' || key == ConsoleKey.C) { _mode = GameMode.Character; return; }
            return;
        }

        if (key == ConsoleKey.UpArrow   || key == ConsoleKey.K) { MoveCursor(-1); return; }
        if (key == ConsoleKey.DownArrow || key == ConsoleKey.J) { MoveCursor(+1); return; }

        // Letter-jump cursor to that slot index (roguelike style),
        // then execute any action key (d/w/u/m) on the jumped-to slot.
        if (ch >= 'a' && ch <= 'z')
        {
            int idx = ch - 'a';
            if (idx < _invSlots.Count) _invCursor = idx;
        }

        var slot = _invSlots[_invCursor];

        switch (ch)
        {
            case 'd': case 'D':
                if (_movement.DropItem(_player, slot.Item, out var msg)) AddMessage(msg);
                RebuildInventory();
                TickTurn();
                return;
            case 'w': case 'W':
                TryEquipFromInventory(slot);
                RebuildInventory();
                return;
            case 'u': case 'U':
                TryUseFromInventory(slot);
                RebuildInventory();
                return;
            case 'm': case 'M':
                BeginMovePicker(slot);
                return;
        }
    }

    private void BeginMovePicker(InvSlot source)
    {
        _moveSourceSlot  = source;
        _movePockets     = _player.Inventory.Pockets()
                               .Where(pr => !ReferenceEquals(pr.Pocket, source.Pocket))
                               .ToList();
        if (_movePockets.Count == 0)
        {
            AddMessage("No other pockets to move to.");
            return;
        }
        _movePocketCursor = 0;
        _invSub = InvSubMode.MovePick;
    }

    private void ProcessInvMovePick(char ch, ConsoleKey key)
    {
        if (key == ConsoleKey.Escape) { _invSub = InvSubMode.Browse; return; }

        if (key == ConsoleKey.UpArrow || key == ConsoleKey.K)
        {
            _movePocketCursor = (_movePocketCursor - 1 + _movePockets.Count) % _movePockets.Count;
            return;
        }
        if (key == ConsoleKey.DownArrow || key == ConsoleKey.J)
        {
            _movePocketCursor = (_movePocketCursor + 1) % _movePockets.Count;
            return;
        }

        // Letter pick
        if (ch >= 'a' && ch <= 'z')
        {
            int idx = ch - 'a';
            if (idx < _movePockets.Count) { _movePocketCursor = idx; ExecuteMoveItem(); }
            return;
        }

        if (key == ConsoleKey.Enter)
            ExecuteMoveItem();
    }

    private void ExecuteMoveItem()
    {
        if (_movePocketCursor < 0 || _movePocketCursor >= _movePockets.Count) return;
        var dest = _movePockets[_movePocketCursor];
        var item = _moveSourceSlot.Item;

        if (!dest.Pocket.CanFit(item, _player.CarryMod))
        {
            AddMessage($"No room for the {item.Name} in {dest.Pocket.Spec.Name}.");
            _invSub = InvSubMode.Browse;
            return;
        }
        _moveSourceSlot.Pocket.Remove(item);
        dest.Pocket.TryAdd(item);
        AddMessage($"Moved {item.Name} → {dest.Pocket.Spec.Name}.");
        _invSub = InvSubMode.Browse;
        RebuildInventory();
    }

    private void RebuildInventory()
    {
        _invSlots  = InventoryScreen.BuildSlots(_player, _invSort, _invFilter);
        _invCursor = Math.Clamp(_invCursor, 0, Math.Max(0, _invSlots.Count - 1));
    }

    private void MoveCursor(int delta)
    {
        if (_invSlots.Count == 0) return;
        _invCursor = (_invCursor + delta + _invSlots.Count) % _invSlots.Count;
    }

    private void TryEquipFromInventory(InvSlot slot)
    {
        var item = slot.Item;
        if (item.Slot == EquipSlot.None)
        {
            AddMessage($"The {item.Name} isn't wearable.");
            return;
        }
        if (!Equipment.DefaultSlotFor(item, _player.Equipment, out var body))
        {
            AddMessage($"You can't equip the {item.Name}.");
            return;
        }
        var existing = _player.Equipment[body];
        if (!slot.Pocket.Remove(item))
        {
            AddMessage("You fumble with the item.");
            return;
        }
        if (existing != null)
        {
            _player.Equipment[body] = null;
            if (!slot.Pocket.TryAdd(existing))
            {
                _world.AddItemAt(_player.X, _player.Y, _player.Z, existing);
                AddMessage($"The {existing.Name} drops to the ground.");
            }
        }
        _player.Equipment[body] = item;
        AddMessage($"You put on the {item.Name}.");
        TickTurn();
    }

    /// <summary>
    /// Faithful port of JS "use" action:
    ///   - Sealed container → enter OpenWith mode to pick a tool.
    ///   - Opened container with consumable inside → auto-consume the first one.
    ///   - Direct food/drink → consume it in place.
    ///   - Medical item (bandage / antiseptic / painkiller) → dispatch to Anatomy.
    ///   - Anything else → tell the player they can't use that.
    /// </summary>
    private void TryUseFromInventory(InvSlot slot)
    {
        var item = slot.Item;

        if (!string.IsNullOrEmpty(item.MedicalEffect))
        {
            ApplyMedicalItem(item, slot.Pocket);
            return;
        }

        if (item.LightRadius > 0)
        {
            ToggleLight(item);
            return;
        }

        if (item.IsUnopenedContainer)
        {
            EnterOpenWithMode(item);
            return;
        }

        if (item.IsContainer && item.State.Opened)
        {
            Item? inside = null;
            Pocket? innerPocket = null;
            foreach (var p in item.Pockets)
            {
                foreach (var c in p.Contents)
                {
                    if (c.IsEdible || !string.IsNullOrEmpty(c.MedicalEffect))
                    {
                        inside = c; innerPocket = p; break;
                    }
                }
                if (inside != null) break;
            }

            if (inside == null || innerPocket == null)
            {
                AddMessage($"The {item.Name} has nothing to use.");
                return;
            }

            if (!string.IsNullOrEmpty(inside.MedicalEffect))
            {
                ApplyMedicalItem(inside, innerPocket);
                return;
            }

            var r = ItemSystem.ConsumeFood(inside, _player);
            AddMessage(r.Message);
            if (r.Success && inside.Quantity <= 0) innerPocket.Remove(inside);
            if (r.Success)
            {
                if (r.Contaminated && _rng.NextDouble() > _player.PoisonResist)
                {
                    AddMessage("Your stomach turns — the food was bad!");
                    _player.Anatomy!.AddWound("stomach", 1.5, "internal");
                }
                TickTurn();
            }
            return;
        }

        if (item.IsEdible)
        {
            var r = ItemSystem.ConsumeFood(item, _player);
            AddMessage(r.Message);
            if (r.Success && item.Quantity <= 0) slot.Pocket.Remove(item);
            if (r.Success)
            {
                if (r.Contaminated && _rng.NextDouble() > _player.PoisonResist)
                {
                    AddMessage("Your stomach turns — the food was bad!");
                    _player.Anatomy!.AddWound("stomach", 1.5, "internal");
                }
                TickTurn();
            }
            return;
        }

        AddMessage($"You can't use the {item.Name}.");
    }

    /// <summary>
    /// Toggle an item's <see cref="Item.IsLit"/> flag. Refuses to light
    /// fueled sources that have run dry and consumes one turn either way.
    /// </summary>
    private void ToggleLight(Item item)
    {
        if (item.IsLit)
        {
            item.IsLit = false;
            AddMessage($"You switch off the {item.Name}.");
            TickTurn();
            return;
        }

        if (item.RequiresFuel && item.LightFuel <= 0)
        {
            AddMessage($"The {item.Name} is out of power.");
            return;
        }

        item.IsLit = true;
        AddMessage($"You switch on the {item.Name}.");
        TickTurn();
    }

    /// <summary>
    /// Apply a medical item — dispatches to the relevant Anatomy treatment
    /// based on <see cref="Item.MedicalEffect"/>, and on success consumes
    /// the item from <paramref name="from"/>.
    /// </summary>
    private void ApplyMedicalItem(Item item, Pocket from)
    {
        Anatomy.TreatResult r;
        switch (item.MedicalEffect)
        {
            case "bandage":    r = _player.Anatomy.BandageWound();    break;
            case "antiseptic": r = _player.Anatomy.ApplyAntiseptic(); break;
            case "painkiller": r = _player.Anatomy.TakePainkiller();  break;
            default:
                AddMessage($"The {item.Name} doesn't seem to do anything.");
                return;
        }
        AddMessage(r.Message);
        if (r.Success)
        {
            from.Remove(item);
            TickTurn();
        }
    }

    // ------------------------------------------------------------------
    // Mode: Character

    private void ProcessCharacterInput()
    {
        var info = InputSystem.ReadKey();
        if (info.Key == ConsoleKey.Escape || info.KeyChar == 'c' || info.KeyChar == 'C' || info.Key == ConsoleKey.Q)
            _mode = GameMode.Playing;
        else if (info.KeyChar == 'i' || info.KeyChar == 'I')
            EnterInventoryMode();
    }

    // ------------------------------------------------------------------
    // Mode: Container (looting furniture)

    private void ProcessContainerInput()
    {
        var info = InputSystem.ReadKey();
        var ch   = info.KeyChar;
        var key  = info.Key;

        if (key == ConsoleKey.Escape || key == ConsoleKey.Q)
        {
            _containerTarget = null;
            _mode = GameMode.Playing;
            return;
        }

        if (_containerTarget == null) { _mode = GameMode.Playing; return; }

        if (_containerSlots.Count == 0)
        {
            if (key == ConsoleKey.Enter) { _mode = GameMode.Playing; _containerTarget = null; }
            return;
        }

        if (key == ConsoleKey.UpArrow   || key == ConsoleKey.K) { MoveContainerCursor(-1); return; }
        if (key == ConsoleKey.DownArrow || key == ConsoleKey.J) { MoveContainerCursor(+1); return; }

        if (ch >= 'a' && ch <= 'z')
        {
            int idx = ch - 'a';
            if (idx < _containerSlots.Count) _invCursor = idx;
        }

        if (ch == 't')
            TakeFromContainer(_invCursor);
        else if (ch == 'T')
            for (int i = _containerSlots.Count - 1; i >= 0; i--) TakeFromContainer(i);
    }

    private void MoveContainerCursor(int delta)
    {
        if (_containerSlots.Count == 0) return;
        _invCursor = (_invCursor + delta + _containerSlots.Count) % _containerSlots.Count;
    }

    private void TakeFromContainer(int idx)
    {
        if (_containerTarget == null) return;
        if (idx < 0 || idx >= _containerSlots.Count) return;
        var slot = _containerSlots[idx];
        var fit  = _player.Inventory.FindFit(slot.Item, _player.CarryMod);
        if (fit == null)
        {
            AddMessage($"No room for the {slot.Item.Name}.");
            return;
        }
        slot.Pocket.Remove(slot.Item);
        fit.TryAdd(slot.Item);
        AddMessage($"You take the {slot.Item.Name}.");
        _containerSlots = ContainerScreen.BuildSlots(_containerTarget);
        _invCursor = Math.Clamp(_invCursor, 0, Math.Max(0, _containerSlots.Count - 1));
        TickTurn();
    }

    // ------------------------------------------------------------------
    // Mode: OpenWith (pick a tool to open a sealed container)

    private void EnterOpenWithMode(Item container)
    {
        _openTarget  = container;
        _openOptions = ItemSystem.GetAvailableOpeningTools(_player, container);
        _openCursor  = 0;
        if (_openOptions.Count == 0)
        {
            AddMessage($"You have no way to open the {container.Name}.");
            return;
        }
        _mode = GameMode.OpenWith;
    }

    private void ProcessOpenWithInput()
    {
        var info = InputSystem.ReadKey();
        var ch   = info.KeyChar;
        var key  = info.Key;

        if (key == ConsoleKey.Escape || key == ConsoleKey.Q)
        {
            _openTarget = null;
            _openOptions.Clear();
            _mode = GameMode.Inventory;
            return;
        }

        if (_openTarget == null || _openOptions.Count == 0)
        {
            _mode = GameMode.Inventory;
            return;
        }

        if (key == ConsoleKey.UpArrow   || key == ConsoleKey.K)
        {
            _openCursor = (_openCursor - 1 + _openOptions.Count) % _openOptions.Count;
            return;
        }
        if (key == ConsoleKey.DownArrow || key == ConsoleKey.J)
        {
            _openCursor = (_openCursor + 1) % _openOptions.Count;
            return;
        }

        if (ch >= 'a' && ch <= 'z')
        {
            int idx = ch - 'a';
            if (idx < _openOptions.Count) { _openCursor = idx; ExecuteOpenChoice(); return; }
        }

        if (key == ConsoleKey.Enter || ch == ' ')
            ExecuteOpenChoice();
    }

    private void ExecuteOpenChoice()
    {
        if (_openTarget == null) return;
        var choice = _openOptions[_openCursor];
        var r = ItemSystem.OpenContainer(_openTarget, choice, _player);
        AddMessage(r.Message);

        foreach (var s in r.SpilledItems)
        {
            _world.AddItemAt(_player.X, _player.Y, _player.Z, s);
            AddMessage($"Some {s.Name} spills onto the ground.");
        }

        _openTarget = null;
        _openOptions.Clear();
        _mode = GameMode.Inventory;
        RebuildInventory();
        TickTurn();
    }
}
