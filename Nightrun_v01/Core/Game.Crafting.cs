using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Rendering;
using Nightrun.Systems;

namespace Nightrun.Core;

public sealed partial class Game
{
    // ------------------------------------------------------------------
    // Mode: Crafting (recipes + disassembly)

    /// <summary>
    /// Enter the workbench screen. Snapshots the craftable-recipe list once
    /// (recipes never change at runtime) and the disassemblable-item list
    /// from the current reachable pool, then drops into Craft sub-mode.
    /// </summary>
    private void EnterCraftingMode()
    {
        _craftRecipes = RecipeCatalog.Craftable.ToList();
        _craftRecipes.Sort((a, b) => string.CompareOrdinal(a.DisplayName, b.DisplayName));
        _disasmItems  = _crafting.GetDisassemblableItems(_player);
        _craftCursor  = 0;
        _craftSub     = CraftSubMode.Craft;
        _mode         = GameMode.Crafting;
    }

    private void ProcessCraftingInput()
    {
        var info = InputSystem.ReadKey();
        var ch   = info.KeyChar;
        var key  = info.Key;

        if (key == ConsoleKey.Escape || key == ConsoleKey.Q || ch == 'x' || ch == 'X')
        {
            _mode = GameMode.Playing;
            return;
        }

        if (key == ConsoleKey.Tab)
        {
            _craftSub = _craftSub == CraftSubMode.Craft
                ? CraftSubMode.Disassemble
                : CraftSubMode.Craft;
            if (_craftSub == CraftSubMode.Disassemble)
                _disasmItems = _crafting.GetDisassemblableItems(_player);
            _craftCursor = 0;
            return;
        }

        int count = _craftSub == CraftSubMode.Craft ? _craftRecipes.Count : _disasmItems.Count;

        if (count == 0)
        {
            if (key == ConsoleKey.Enter) _mode = GameMode.Playing;
            return;
        }

        if (key == ConsoleKey.UpArrow   || key == ConsoleKey.K) { _craftCursor = (_craftCursor - 1 + count) % count; return; }
        if (key == ConsoleKey.DownArrow || key == ConsoleKey.J) { _craftCursor = (_craftCursor + 1) % count; return; }

        if (ch >= 'a' && ch <= 'z')
        {
            int idx = ch - 'a';
            if (idx < count) { _craftCursor = idx; return; }
        }

        if (key == ConsoleKey.Enter || ch == ' ')
        {
            if (_craftSub == CraftSubMode.Craft)
                ExecuteCraft();
            else
                ExecuteDisassemble();
        }
    }

    private void ExecuteCraft()
    {
        if (_craftCursor < 0 || _craftCursor >= _craftRecipes.Count) return;
        var recipe = _craftRecipes[_craftCursor];
        var result = _crafting.Craft(recipe.RecipeId, _player);
        AddMessage(result.Message);
        if (result.Success)
        {
            int turns = Math.Max(1, (int)(result.TimeCost * _player.CraftTimeMod));
            for (int i = 0; i < turns; i++)
            {
                TickTurn();
                if (_mode == GameMode.GameOver) return;
            }
            _disasmItems = _crafting.GetDisassemblableItems(_player);
        }
    }

    private void ExecuteDisassemble()
    {
        if (_craftCursor < 0 || _craftCursor >= _disasmItems.Count) return;
        var item   = _disasmItems[_craftCursor];
        var recipe = RecipeCatalog.ForOutput(item.FamilyId);
        if (recipe == null) { AddMessage($"The {item.Name} can't be taken apart."); return; }

        var tools = _crafting.GetDisassemblyTools(_player, recipe);
        if (tools.Count == 0) { AddMessage("You lack a suitable tool."); return; }

        string tool  = CraftingScreen.BestTool(tools);
        var result   = _crafting.Disassemble(item, tool, _player);
        AddMessage(result.Message);
        if (result.Success)
        {
            for (int i = 0; i < Math.Max(1, result.TimeCost); i++)
            {
                TickTurn();
                if (_mode == GameMode.GameOver) return;
            }
            _disasmItems = _crafting.GetDisassemblableItems(_player);
            if (_craftCursor >= _disasmItems.Count)
                _craftCursor = Math.Max(0, _disasmItems.Count - 1);
        }
    }
}
