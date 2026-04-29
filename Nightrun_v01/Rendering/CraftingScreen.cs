using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Systems;

namespace Nightrun.Rendering;

/// <summary>
/// Two-pane workbench UI. Left pane lists recipes (craft mode) or
/// disassemblable items (disassemble mode); right pane shows the
/// requirement / tool breakdown for the selected row. Tab flips between
/// the two sub-modes so one screen handles both halves of the crafting
/// workflow.
/// </summary>
public static class CraftingScreen
{
    private const int W = 84, H = 30;

    public static void DrawCraft(
        IRenderer r,
        Player player,
        CraftingSystem system,
        List<Recipe> recipes,
        int cursor)
    {
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, "CRAFTING — Build");

        int listX  = x + 2;
        int listW  = 30;
        int detX   = listX + listW + 2;
        int detW   = w - listW - 6;

        // Divider
        for (int dy = 1; dy < h - 2; dy++)
            r.Put(x + listW + 2, y + dy, '│', 240, ScreenHelpers.PanelBg);

        // ── Left: recipe list ─────────────────────────────────────
        int rowY = y + 2;
        var components = system.GetAllComponents(player);

        if (recipes.Count == 0)
        {
            r.PutString(listX, rowY, "(no recipes)", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        }
        else
        {
            for (int i = 0; i < recipes.Count && rowY < y + h - 3; i++)
            {
                var rec = recipes[i];
                bool canCraft = system.CanCraft(rec, components, out _);
                bool sel = i == cursor;
                byte fg = sel ? ScreenHelpers.SelFg : (canCraft ? ScreenHelpers.ValueFg : (byte)240);
                byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;

                for (int dx = 0; dx < listW; dx++) r.Put(listX + dx, rowY, ' ', fg, bg);
                r.PutString(listX, rowY, $" {ScreenHelpers.LetterFor(i)}) ", ScreenHelpers.HintFg, bg);

                string name = rec.DisplayName;
                if (name.Length > listW - 10) name = name[..(listW - 10)];
                r.PutString(listX + 4, rowY, name, fg, bg);
                if (canCraft)
                    r.PutString(listX + listW - 3, rowY, "OK", 108, bg);
                rowY++;
            }
        }

        // ── Right: selected recipe detail ─────────────────────────
        if (recipes.Count > 0 && cursor >= 0 && cursor < recipes.Count)
        {
            var selRec = recipes[cursor];
            int dy = y + 2;

            r.PutString(detX, dy, selRec.DisplayName, ScreenHelpers.TitleFg, ScreenHelpers.PanelBg);
            string typeTag = $"[{selRec.OutputType}]";
            r.PutString(detX + detW - typeTag.Length, dy, typeTag, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            dy += 2;

            r.PutString(detX, dy++, "Requires:", ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);

            foreach (var req in selRec.Requirements)
            {
                int available = CountMatches(components, req);
                bool ok = available >= req.Quantity;

                string label = string.IsNullOrEmpty(req.Name)
                    ? (req.Property != null
                        ? PropertyLabels.Format(req.Property, req.MinValue, req.MaxValue)
                        : req.ComponentId ?? "?")
                    : req.Name;
                string line = $"  {(ok ? "+" : "-")} {label}";
                string qty  = $"{available}/{req.Quantity}";

                byte lfg = ok ? (byte)108 : (byte)203;
                if (line.Length > detW - qty.Length - 1)
                    line = line[..(detW - qty.Length - 1)];

                r.PutString(detX, dy, line, lfg, ScreenHelpers.PanelBg);
                r.PutString(detX + detW - qty.Length, dy, qty, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
                dy++;
            }

            dy++;
            r.PutString(detX, dy++, $"Time: {selRec.CraftTime} turn{(selRec.CraftTime == 1 ? "" : "s")}",
                ScreenHelpers.HintFg, ScreenHelpers.PanelBg);

            if (selRec.Components.Count > 0)
            {
                dy++;
                r.PutString(detX, dy++, "Contains:", ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
                foreach (var (id, q) in selRec.Components)
                {
                    var tmpl = ItemCatalog.CreateByComponent(id) ?? ItemCatalog.CreateByFamily(id);
                    string nm = tmpl?.Name ?? id;
                    string line = $"  {nm} x{q}";
                    if (line.Length > detW) line = line[..detW];
                    r.PutString(detX, dy++, line, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
                    if (dy >= y + h - 3) break;
                }
            }
        }

        ScreenHelpers.DrawHintBar(r, x + 1, y + h - 2, w - 2,
            "↑↓ select   Enter craft   Tab → disassemble   Esc close");
    }

    public static void DrawDisassemble(
        IRenderer r,
        Player player,
        CraftingSystem system,
        List<Item> items,
        int cursor)
    {
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, "CRAFTING — Disassemble");

        int listX  = x + 2;
        int listW  = 30;
        int detX   = listX + listW + 2;
        int detW   = w - listW - 6;

        for (int dy = 1; dy < h - 2; dy++)
            r.Put(x + listW + 2, y + dy, '│', 240, ScreenHelpers.PanelBg);

        int rowY = y + 2;

        if (items.Count == 0)
        {
            r.PutString(listX, rowY, "(nothing to disassemble)", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        }
        else
        {
            for (int i = 0; i < items.Count && rowY < y + h - 3; i++)
            {
                var it = items[i];
                bool sel = i == cursor;
                byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
                byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;

                for (int dx = 0; dx < listW; dx++) r.Put(listX + dx, rowY, ' ', fg, bg);
                r.PutString(listX, rowY, $" {ScreenHelpers.LetterFor(i)}) ", ScreenHelpers.HintFg, bg);
                r.Put(listX + 4, rowY, it.Glyph, it.Fg, bg);
                string name = it.Name;
                if (name.Length > listW - 8) name = name[..(listW - 8)];
                r.PutString(listX + 6, rowY, name, fg, bg);
                rowY++;
            }
        }

        if (items.Count > 0 && cursor >= 0 && cursor < items.Count)
        {
            var sel = items[cursor];
            var recipe = RecipeCatalog.ForOutput(sel.FamilyId);
            int dy = y + 2;

            r.PutString(detX, dy, sel.Name, ScreenHelpers.TitleFg, ScreenHelpers.PanelBg);
            string durTag = $"dur {sel.Durability}/{sel.MaxDurability}";
            r.PutString(detX + detW - durTag.Length, dy, durTag, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            dy += 2;

            if (recipe == null || recipe.Components.Count == 0)
            {
                r.PutString(detX, dy, "No salvage data.", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            }
            else
            {
                r.PutString(detX, dy++, "Tools:", ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
                var tools = system.GetDisassemblyTools(player, recipe);
                foreach (var (toolId, method) in recipe.DisassemblyMethods)
                {
                    bool have = tools.Contains(toolId);
                    byte lfg = have ? (byte)108 : (byte)240;
                    string yieldPct = $"{(int)(method.ComponentYield * 100)}% yield";
                    string qPct     = $"{(int)(method.QualityMod * 100)}% qual";
                    string timeStr  = $"{method.TimeRequired}t";
                    string line = $"  {(have ? "+" : "-")} {toolId,-8}  {yieldPct,-10} {qPct,-10} {timeStr}";
                    if (line.Length > detW) line = line[..detW];
                    r.PutString(detX, dy++, line, lfg, ScreenHelpers.PanelBg);
                }

                dy++;
                r.PutString(detX, dy++, "Would yield:", ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
                string bestTool = tools.Count > 0 ? BestTool(tools) : "hand";
                if (recipe.DisassemblyMethods.TryGetValue(bestTool, out var bestMethod))
                {
                    foreach (var (id, q) in recipe.Components)
                    {
                        if (bestMethod.ExcludeComponents.Contains(id)) continue;
                        int yielded = (int)Math.Floor(q * bestMethod.ComponentYield);
                        if (yielded <= 0) continue;
                        var tmpl = ItemCatalog.CreateByComponent(id) ?? ItemCatalog.CreateByFamily(id);
                        string nm = tmpl?.Name ?? id;
                        string line = $"  {nm} x{yielded}";
                        if (line.Length > detW) line = line[..detW];
                        r.PutString(detX, dy++, line, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
                        if (dy >= y + h - 3) break;
                    }
                }
            }
        }

        ScreenHelpers.DrawHintBar(r, x + 1, y + h - 2, w - 2,
            "↑↓ select   Enter disassemble (best tool)   Tab → craft   Esc close");
    }

    /// <summary>
    /// Preferred tool when auto-picking for disassembly. Knife wins because
    /// it hands back more intact components than a bare-handed teardown.
    /// </summary>
    public static string BestTool(List<string> tools)
    {
        if (tools.Contains("knife")) return "knife";
        if (tools.Count > 0 && tools[0] != "hand") return tools[0];
        return "hand";
    }

    /// <summary>
    /// Count how many component units in <paramref name="pool"/> satisfy
    /// <paramref name="req"/>. Stackables contribute their Quantity; surfaces
    /// read as infinite (999) so they don't dominate the display.
    /// </summary>
    private static int CountMatches(List<Item> pool, RecipeRequirement req)
    {
        int n = 0;
        foreach (var c in pool)
        {
            if (!CraftingSystem.Matches(c, req)) continue;
            n += c.IsSurface ? 999 : Math.Max(1, c.Stackable ? c.Quantity : 1);
        }
        return n;
    }
}
