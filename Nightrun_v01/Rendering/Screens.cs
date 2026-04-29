using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Systems;

namespace Nightrun.Rendering;

/// <summary>A single log message with a display color (ANSI 256 index).</summary>
public readonly struct LogEntry
{
    public readonly string Text;
    public readonly byte   Color;
    public LogEntry(string text, byte color = 250) { Text = text; Color = color; }
}

/// <summary>
/// Flat view of one item in the inventory — links the item back to the pocket
/// it lives in so the UI can both show its container and remove it correctly.
/// <see cref="Indent"/> is 0 for top-level items and 1 for items nested inside
/// an opened container (e.g. beans inside an opened can).
/// </summary>
public readonly struct InvSlot
{
    public readonly string PocketName;
    public readonly Pocket Pocket;
    public readonly Item Item;
    public readonly int Indent;

    public InvSlot(string pocketName, Pocket pocket, Item item, int indent = 0)
    {
        PocketName = pocketName; Pocket = pocket; Item = item; Indent = indent;
    }
}

/// <summary>
/// Helpers shared by all modal screens — panel frame + column sizing.
/// Keeps the actual screens short and consistent looking.
/// </summary>
internal static class ScreenHelpers
{
    // Slightly dimmed panel bg so the world shows through visually but
    // the menu text is clearly in focus.
    public const byte PanelBg = 236;
    public const byte PanelFg = 250;
    public const byte TitleFg = 226;
    public const byte LabelFg = 250;
    public const byte ValueFg = 252;
    public const byte HintFg  = 244;
    public const byte SelBg   = 240;
    public const byte SelFg   = 255;

    public static (int x, int y, int w, int h) CenterPanel(IRenderer r, int w, int h)
    {
        int x = (r.Width - w) / 2;
        int y = (r.Height - h) / 2;
        return (x, y, w, h);
    }

    public static void DrawFrame(IRenderer r, int x, int y, int w, int h, string title)
    {
        // Fill bg
        for (int dy = 0; dy < h; dy++)
            for (int dx = 0; dx < w; dx++)
                r.Put(x + dx, y + dy, ' ', PanelFg, PanelBg);

        // Borders
        for (int dx = 0; dx < w; dx++)
        {
            r.Put(x + dx, y,         '─', 240, PanelBg);
            r.Put(x + dx, y + h - 1, '─', 240, PanelBg);
        }
        for (int dy = 0; dy < h; dy++)
        {
            r.Put(x,         y + dy, '│', 240, PanelBg);
            r.Put(x + w - 1, y + dy, '│', 240, PanelBg);
        }
        r.Put(x,         y,         '┌', 240, PanelBg);
        r.Put(x + w - 1, y,         '┐', 240, PanelBg);
        r.Put(x,         y + h - 1, '└', 240, PanelBg);
        r.Put(x + w - 1, y + h - 1, '┘', 240, PanelBg);

        // Title
        string t = $" {title} ";
        int tx = x + 2;
        r.PutString(tx, y, t, TitleFg, PanelBg);
    }

    public static void DrawHintBar(IRenderer r, int x, int y, int w, string hint)
    {
        for (int i = 0; i < w; i++) r.Put(x + i, y, ' ', HintFg, PanelBg);
        r.PutString(x + 1, y, hint, HintFg, PanelBg);
    }

    public static char LetterFor(int index) => (char)('a' + index);

    public static string FmtWeight(int grams)
    {
        if (grams >= 10_000) return $"{grams / 1000.0:0.0}kg";
        return $"{grams}g";
    }

    public static string FmtVol(int ml)
    {
        if (ml >= 1_000) return $"{ml / 1000.0:0.#}L";
        return $"{ml}ml";
    }

    /// <summary>
    /// Render a single inventory row (letter, glyph, name with state tags,
    /// weight). Used by both <see cref="InventoryScreen"/> and any other
    /// list-of-items screen that wants consistent formatting.
    /// </summary>
    public static void DrawItemRow(
        IRenderer r, int x, int y, int w, int i, Item item, bool selected, int indent = 0)
    {
        byte fg = selected ? SelFg : ValueFg;
        byte bg = selected ? SelBg : PanelBg;
        for (int dx = 1; dx < w - 1; dx++) r.Put(x + dx, y, ' ', fg, bg);

        int gx = x + 3 + indent * 4;
        string letter = $" {LetterFor(i)}) ";
        r.PutString(gx, y, letter, HintFg, bg);
        r.Put(gx + 4, y, item.Glyph, item.Fg, bg);

        string name = item.Name;
        int nx = gx + 6;
        r.PutString(nx, y, name, fg, bg);
        int afterName = nx + name.Length;

        // State tags right after the name
        if (item.IsContainer)
        {
            if (item.State.Sealed && !item.State.Opened)
            {
                afterName += 1;
                r.PutString(afterName, y, "[SEALED]", 244, bg);
                afterName += "[SEALED]".Length;
            }
            else if (item.State.Opened)
            {
                afterName += 1;
                r.PutString(afterName, y, "[open]", 108, bg);
                afterName += "[open]".Length;
            }
        }
        if (item.State.Contaminated)
        {
            afterName += 1;
            r.PutString(afterName, y, "[!]", 208, bg);
            afterName += 3;
        }
        if (item.IsLit)
        {
            afterName += 1;
            r.PutString(afterName, y, "[lit]", 229, bg);
            afterName += 5;
        }
        if (item.Durability < item.MaxDurability && item.MaxDurability > 0
            && item.Durability <= item.MaxDurability / 4)
        {
            afterName += 1;
            r.PutString(afterName, y, "[worn]", 173, bg);
        }

        // Quantity / weight on the right
        string right = !string.IsNullOrEmpty(item.QuantityUnit) && item.Quantity > 0
            ? $"{item.Quantity}{item.QuantityUnit}"
            : FmtWeight(item.Weight);
        r.PutString(x + w - 2 - right.Length, y, right, HintFg, bg);
    }
}

// ======================================================================
// INVENTORY

/// <summary>Sort mode for the inventory list — sorts items within each pocket.</summary>
public enum InvSort { Default, ByName, ByWeight, ByCategory }

public static class InventoryScreen
{
    /// <summary>
    /// Flatten the inventory into a linear list with optional sort and name filter.
    /// Opened containers show their contents inline right after the parent item.
    /// </summary>
    public static List<InvSlot> BuildSlots(Player player, InvSort sort = InvSort.Default, string filter = "")
    {
        bool hasFilter = !string.IsNullOrEmpty(filter);
        var list = new List<InvSlot>();
        foreach (var pr in player.Inventory.Pockets())
        {
            string label = pr.Source == pr.Pocket.Spec.Name
                ? pr.Source
                : $"{pr.Source} — {pr.Pocket.Spec.Name}";

            IEnumerable<Item> items = pr.Pocket.Contents;
            items = sort switch
            {
                InvSort.ByName     => items.OrderBy(i => i.Name),
                InvSort.ByWeight   => items.OrderByDescending(i => i.Weight),
                InvSort.ByCategory => items.OrderBy(i => i.Category ?? ""),
                _                  => items,
            };

            foreach (var it in items)
            {
                if (hasFilter && !it.Name.Contains(filter, StringComparison.OrdinalIgnoreCase))
                    continue;
                list.Add(new InvSlot(label, pr.Pocket, it, 0));
                if (it.IsContainer && it.State.Opened)
                {
                    foreach (var inner in it.Pockets)
                        foreach (var nested in inner.Contents)
                        {
                            if (hasFilter && !nested.Name.Contains(filter, StringComparison.OrdinalIgnoreCase))
                                continue;
                            list.Add(new InvSlot(label, inner, nested, 1));
                        }
                }
            }
        }
        return list;
    }

    // Groups slots by top-level pocket so each pocket becomes a column.
    private sealed record PocketGroup(string PocketName, Pocket Pocket, List<(InvSlot Slot, int Index)> Items);

    private static List<PocketGroup> BuildPocketGroups(List<InvSlot> slots)
    {
        var groups  = new List<PocketGroup>();
        PocketGroup? cur = null;
        for (int i = 0; i < slots.Count; i++)
        {
            var s = slots[i];
            if (s.Indent == 0 && (cur == null || s.PocketName != cur.PocketName))
            {
                cur = new(s.PocketName, s.Pocket, new());
                groups.Add(cur);
            }
            cur?.Items.Add((s, i));
        }
        return groups;
    }

    public static void Draw(IRenderer r, Player player, List<InvSlot> slots, int cursor,
        InvSort sort = InvSort.Default, string filter = "", bool searching = false,
        HashSet<string>? collapsed = null)
    {
        int w = Math.Max(60, r.Width  - 4);
        int h = Math.Max(20, r.Height - 2);
        int x = (r.Width  - w) / 2;
        int y = (r.Height - h) / 2;
        ScreenHelpers.DrawFrame(r, x, y, w, h, "INVENTORY");

        // Title-bar decorations
        string sortLabel = sort switch
        {
            InvSort.ByName     => " [name] ",
            InvSort.ByWeight   => " [wt] ",
            InvSort.ByCategory => " [cat] ",
            _                  => "",
        };
        if (sortLabel.Length > 0)
            r.PutString(x + 13, y, sortLabel, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        if (searching || !string.IsNullOrEmpty(filter))
        {
            string bar = string.IsNullOrEmpty(filter) ? " search:_ " : $" /{filter}_ ";
            r.PutString(x + w - 2 - bar.Length, y, bar, 226, ScreenHelpers.PanelBg);
        }

        // Fixed bottom rows (span full panel width, below the divider)
        int hintY   = y + h - 2;
        int loadY   = y + h - 3;
        int sumY    = y + h - 4;
        int bodyTop = y + 2;
        int bodyBot = sumY;

        r.PutString(x + 2, sumY,
            $"Hunger {player.Hunger,3}/{player.MaxHunger}   Thirst {player.Thirst,3}/{player.MaxThirst}",
            ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
        var (totalW, totalV) = player.Inventory.Load();
        r.PutString(x + w / 2, sumY,
            $"Load: {ScreenHelpers.FmtWeight(totalW)}   Vol: {ScreenHelpers.FmtVol(totalV)}",
            ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
        ScreenHelpers.DrawHintBar(r, x + 1, hintY, w - 2,
            "↑↓ select  d)rop  w)ear  u)se  m)ove  e)xpand  s)ort  /)search  Esc");

        // ── Dual-panel split ──
        int innerW = w - 2;
        int leftW  = (innerW - 1) * 55 / 100;   // left panel ~55 %
        int rightW = innerW - leftW - 1;          // right panel = remainder (−1 for divider)
        int divX   = x + 1 + leftW;

        // Vertical divider (stops at bodyBot so bottom rows are undivided)
        for (int row = y + 1; row < bodyBot; row++)
            r.Put(divX, row, '│', 240, ScreenHelpers.PanelBg);
        r.Put(divX, y, '┬', 240, ScreenHelpers.PanelBg);

        // ── LEFT PANEL: navigable flat item list ──
        int lx = x;
        string leftHdr = slots.Count > 0
            ? $" {slots.Count} item{(slots.Count == 1 ? "" : "s")}"
            : " Items";
        r.PutString(lx + 2, bodyTop, leftHdr, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);

        if (slots.Count == 0)
        {
            r.PutString(lx + 3, bodyTop + 1,
                string.IsNullOrEmpty(filter) ? "(pockets are empty)" : $"(nothing matches \"{filter}\")",
                ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        }
        else
        {
            int ry = bodyTop + 1;
            for (int i = 0; i < slots.Count && ry < bodyBot; i++, ry++)
                ScreenHelpers.DrawItemRow(r, lx, ry, leftW + 2, i,
                    slots[i].Item, i == cursor, slots[i].Indent);
        }

        // ── RIGHT PANEL: pocket overview with expand / collapse ──
        int rx = divX + 1;
        r.PutString(rx + 1, bodyTop, "Pockets", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        int ry2 = bodyTop + 1;

        foreach (var pr in player.Inventory.Pockets())
        {
            if (ry2 >= bodyBot) break;

            // Build the stable pocket label (matches BuildSlots)
            string label = pr.Source == pr.Pocket.Spec.Name
                ? pr.Source
                : $"{pr.Source} — {pr.Pocket.Spec.Name}";
            bool isCollapsed = collapsed?.Contains(label) == true;

            // ── Pocket header row ──
            string toggle = isCollapsed ? "[+]" : "[-]";
            int    usedW  = pr.Pocket.UsedWeight, maxW = pr.Pocket.Spec.MaxWeight;
            int    usedV  = pr.Pocket.UsedVolume, maxV = pr.Pocket.Spec.MaxVolume;

            // left part: toggle + name
            string hdrLeft = $" {toggle} {label}";
            if (hdrLeft.Length > rightW - 1) hdrLeft = hdrLeft[..(rightW - 1)];
            // right part: capacity
            string hdrRight = $"{ScreenHelpers.FmtWeight(usedW)}/{ScreenHelpers.FmtWeight(maxW)} {ScreenHelpers.FmtVol(usedV)}/{ScreenHelpers.FmtVol(maxV)} ";
            int    hdrRightX = rx + rightW - hdrRight.Length;

            for (int dx = 0; dx < rightW; dx++) r.Put(rx + dx, ry2, ' ', ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
            r.PutString(rx,        ry2, hdrLeft,  ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
            if (hdrRightX > rx + hdrLeft.Length)
                r.PutString(hdrRightX, ry2, hdrRight, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            ry2++;

            if (isCollapsed) continue;

            // ── Expanded: list items ──
            var contents = pr.Pocket.Contents.ToList();
            if (contents.Count == 0)
            {
                if (ry2 < bodyBot)
                {
                    r.PutString(rx + 4, ry2, "(empty)", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
                    ry2++;
                }
            }
            else
            {
                foreach (var item in contents)
                {
                    if (ry2 >= bodyBot) break;
                    string wt   = ScreenHelpers.FmtWeight(item.Weight);
                    string name = $"    · {item.Name}";
                    int    maxNameLen = rightW - 1 - wt.Length - 1;
                    if (name.Length > maxNameLen) name = name[..maxNameLen];
                    for (int dx = 0; dx < rightW; dx++) r.Put(rx + dx, ry2, ' ', ScreenHelpers.ValueFg, ScreenHelpers.PanelBg);
                    r.PutString(rx,                        ry2, name, ScreenHelpers.ValueFg, ScreenHelpers.PanelBg);
                    r.PutString(rx + rightW - 1 - wt.Length, ry2, wt,  ScreenHelpers.HintFg,  ScreenHelpers.PanelBg);
                    ry2++;
                }
            }

            // Blank separator between pockets
            if (ry2 < bodyBot) ry2++;
        }
    }

    /// <summary>Overlay listing available destination pockets for the move-item action.</summary>
    public static void DrawMovePicker(IRenderer r, List<InventoryPocketRef> pockets, int cursor)
    {
        int panH = Math.Max(8, 5 + pockets.Count);
        const int panW = 46;
        var (bx, by, _, _) = ScreenHelpers.CenterPanel(r, panW, panH);
        int px = Math.Min(bx + 10, r.Width - panW - 1);
        ScreenHelpers.DrawFrame(r, px, by, panW, panH, "MOVE TO");

        int ry = by + 2;
        if (pockets.Count == 0)
        {
            r.PutString(px + 3, ry, "(no other pockets available)", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        }
        else
        {
            for (int i = 0; i < pockets.Count && ry < by + panH - 3; i++)
            {
                var pr  = pockets[i];
                bool sel = i == cursor;
                byte fg  = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
                byte bg  = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
                for (int dx = 1; dx < panW - 1; dx++) r.Put(px + dx, ry, ' ', fg, bg);

                string label = $" {ScreenHelpers.LetterFor(i)}) {pr.Pocket.Spec.Name}";
                string right = $"{ScreenHelpers.FmtWeight(pr.Pocket.FreeWeight)}/{ScreenHelpers.FmtVol(pr.Pocket.FreeVolume)} free";
                r.PutString(px + 1, ry, label, fg, bg);
                r.PutString(px + panW - 2 - right.Length, ry, right, ScreenHelpers.HintFg, bg);
                ry++;
            }
        }
        ScreenHelpers.DrawHintBar(r, px + 1, by + panH - 2, panW - 2, "a-z/Enter pick   Esc cancel");
    }
}

// ======================================================================
// CHARACTER (equipment + anatomy detail)

public static class CharacterScreen
{
    public static void Draw(IRenderer r, Player player)
    {
        const int W = 78, H = 32;
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, "CHARACTER");

        // ── Identity header ──
        string ident = $"{player.CharacterName} ({player.Gender})";
        if (!string.IsNullOrEmpty(player.Background)) ident += $"  —  {player.Background}";
        ident += $"  [{OriginInfo.Name(player.Origin)}]";
        r.PutString(x + 2, y + 1, ident, ScreenHelpers.TitleFg, ScreenHelpers.PanelBg);
        if (player.SelectedTraits.Count > 0)
        {
            string traits = "Traits: " + string.Join(", ", player.SelectedTraits.Select(t =>
                Nightrun.Content.CharacterCreation.GetTrait(t)?.Name ?? t));
            if (traits.Length > w - 4) traits = traits.Substring(0, w - 4);
            r.PutString(x + 2, y + 2, traits, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        }

        // ── Top condition strip ──
        var cond = player.Anatomy.GetBodyCondition();
        int topY = y + 3;
        r.PutString(x + 2, topY, "Condition:", ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
        r.PutString(x + 13, topY, cond.Label, cond.Color, ScreenHelpers.PanelBg);
        if (!string.IsNullOrEmpty(cond.Details))
            r.PutString(x + 13 + cond.Label.Length + 2, topY, cond.Details, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);

        var bs = player.Anatomy.GetBloodStatus();
        string bloodStr = $"Blood {(int)player.Anatomy.GetBloodPercent()}% ({bs.Label})";
        r.PutString(x + w - 2 - bloodStr.Length, topY, bloodStr, bs.Color, ScreenHelpers.PanelBg);

        // ── Two-column body ──
        int leftX  = x + 2;
        int rightX = x + 2 + w / 2;
        int colY = y + 4;

        // ── LEFT: equipment ──
        int ly = colY;
        r.PutString(leftX, ly++, "Equipment", ScreenHelpers.TitleFg, ScreenHelpers.PanelBg);
        ly++;
        foreach (BodySlot s in new[]
        {
            BodySlot.Head, BodySlot.Torso, BodySlot.Arms, BodySlot.Legs, BodySlot.Feet,
            BodySlot.LHand, BodySlot.RHand, BodySlot.Back,
        })
        {
            var item = player.Equipment[s];
            r.PutString(leftX + 1, ly, Equipment.Label(s) + ":", ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
            if (item == null)
                r.PutString(leftX + 12, ly, "—", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            else
            {
                r.Put(leftX + 12, ly, item.Glyph, item.Fg, ScreenHelpers.PanelBg);
                r.PutString(leftX + 14, ly, item.Name, ScreenHelpers.ValueFg, ScreenHelpers.PanelBg);
            }
            ly++;
        }

        // ── RIGHT: anatomy by region ──
        int ay = colY;
        r.PutString(rightX, ay++, "Anatomy", ScreenHelpers.TitleFg, ScreenHelpers.PanelBg);
        ay++;
        DrawRegion(r, rightX, ref ay, "HEAD",   new[] { player.Anatomy.Skull, player.Anatomy.Face, player.Anatomy.Jaw, player.Anatomy.LeftEar, player.Anatomy.RightEar, player.Anatomy.LeftEye, player.Anatomy.RightEye, player.Anatomy.Brain });
        DrawRegion(r, rightX, ref ay, "TORSO",  new[] { player.Anatomy.Chest, player.Anatomy.Ribs, player.Anatomy.Abdomen, player.Anatomy.Stomach, player.Anatomy.LeftLung, player.Anatomy.RightLung, player.Anatomy.Liver, player.Anatomy.Heart, player.Anatomy.LeftKidney, player.Anatomy.RightKidney });
        DrawRegion(r, rightX, ref ay, "ARMS",   new[] { player.Anatomy.LeftArm, player.Anatomy.LeftHand, player.Anatomy.RightArm, player.Anatomy.RightHand });
        DrawRegion(r, rightX, ref ay, "LEGS",   new[] { player.Anatomy.LeftLeg, player.Anatomy.LeftFoot, player.Anatomy.RightLeg, player.Anatomy.RightFoot });

        // ── Wounds list across the bottom ──
        int wy = Math.Max(ly, ay) + 1;
        if (wy < y + h - 4)
        {
            r.PutString(leftX, wy++, "Wounds", ScreenHelpers.TitleFg, ScreenHelpers.PanelBg);
            if (player.Anatomy.Wounds.Count == 0)
            {
                r.PutString(leftX + 1, wy++, "(none)", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            }
            else
            {
                foreach (var wnd in player.Anatomy.Wounds)
                {
                    if (wy >= y + h - 3) break;
                    string tags =
                        (wnd.Bandaged ? " [bandaged]" : "") +
                        (wnd.Disinfected ? " [clean]" : "") +
                        (wnd.Infected ? " [INFECTED]" : "");
                    string line = $"  {wnd.Type} on {wnd.Part} — {wnd.Severity:F1}/turn{tags}";
                    if (line.Length > w - 4) line = line[..(w - 4)];
                    byte fg = wnd.Infected ? (byte)201 : (wnd.Bandaged ? (byte)108 : (byte)203);
                    r.PutString(leftX, wy++, line, fg, ScreenHelpers.PanelBg);
                }
            }
        }

        ScreenHelpers.DrawHintBar(r, x + 1, y + h - 2, w - 2, "Esc close   i inventory");
    }

    private static void DrawRegion(IRenderer r, int x, ref int y, string label, BodyPart[] parts)
    {
        r.PutString(x + 1, y++, label, ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
        foreach (var p in parts)
        {
            var status = Anatomy.GetPartStatus(p);
            string row = $"  {p.Name,-14} {p.Hp,3}/{p.MaxHp,-3}";
            r.PutString(x + 1, y, row, ScreenHelpers.ValueFg, ScreenHelpers.PanelBg);
            r.PutString(x + 1 + row.Length + 1, y, status.Status, status.Color, ScreenHelpers.PanelBg);
            y++;
        }
    }
}

// ======================================================================
// CONTAINER (search furniture)

public static class ContainerScreen
{
    public static List<InvSlot> BuildSlots(Furniture furn)
    {
        var list = new List<InvSlot>();
        foreach (var p in furn.Pockets)
            foreach (var it in p.Contents)
                list.Add(new InvSlot(p.Spec.Name, p, it));
        return list;
    }

    public static void Draw(IRenderer r, Furniture furn, List<InvSlot> slots, int cursor)
    {
        const int W = 60, H = 22;
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, furn.Name.ToUpper());

        int rowY = y + 2;

        if (slots.Count == 0)
        {
            r.PutString(x + 3, rowY, "(empty)", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        }
        else
        {
            string? lastPocket = null;
            for (int i = 0; i < slots.Count && rowY < y + h - 3; i++)
            {
                var slot = slots[i];
                if (slot.PocketName != lastPocket)
                {
                    if (lastPocket != null) rowY++;
                    r.PutString(x + 2, rowY, slot.PocketName, ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);
                    rowY++;
                    lastPocket = slot.PocketName;
                }
                if (rowY >= y + h - 3) break;

                ScreenHelpers.DrawItemRow(r, x, rowY, w, i, slot.Item, i == cursor);
                rowY++;
            }
        }

        ScreenHelpers.DrawHintBar(r, x + 1, y + h - 2, w - 2,
            "↑↓ select   t)ake   T)ake all   Esc close");
    }
}

// ======================================================================
// OPEN WITH (pick a tool to open a sealed container)

public static class OpenWithScreen
{
    public static void Draw(IRenderer r, Item container, List<OpenOption> options, int cursor)
    {
        int W = 52, H = Math.Max(8, 6 + options.Count);
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, $"OPEN {container.Name.ToUpper()}");

        int rowY = y + 2;

        if (options.Count == 0)
        {
            r.PutString(x + 3, rowY,
                "You have nothing that can open this.",
                ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        }
        else
        {
            for (int i = 0; i < options.Count; i++)
            {
                var opt = options[i];
                bool sel = i == cursor;
                byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
                byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
                for (int dx = 1; dx < w - 1; dx++) r.Put(x + dx, rowY, ' ', fg, bg);

                string letter = $" {ScreenHelpers.LetterFor(i)}) ";
                r.PutString(x + 3, rowY, letter, ScreenHelpers.HintFg, bg);
                r.PutString(x + 7, rowY, opt.DisplayName, fg, bg);

                // Yield + durability cost indicator
                string stats = opt.DurabilityDamage > 0
                    ? $"yield {opt.Yield:P0}  -{opt.DurabilityDamage} dur"
                    : $"yield {opt.Yield:P0}";
                r.PutString(x + w - 2 - stats.Length, rowY, stats, ScreenHelpers.HintFg, bg);
                rowY++;
            }
        }

        ScreenHelpers.DrawHintBar(r, x + 1, y + h - 2, w - 2,
            "↑↓ select   Enter open   Esc cancel");
    }
}

// ======================================================================
// GAME OVER (cause of death + restart prompt)

public static class GameOverScreen
{
    public static void Draw(IRenderer r, Player player, uint seed)
    {
        const int W = 60, H = 16;
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, "YOU DIED");

        int rowY = y + 2;
        string headline = "Your run ends here.";
        r.PutString(x + (w - headline.Length) / 2, rowY, headline, 196, ScreenHelpers.PanelBg);
        rowY += 2;

        string cause = player.Anatomy.GetDeathCause();
        string causeLine = $"You {cause}.";
        if (causeLine.Length > w - 4) causeLine = causeLine[..(w - 4)];
        r.PutString(x + (w - causeLine.Length) / 2, rowY++, causeLine, 244, ScreenHelpers.PanelBg);
        rowY++;

        var destroyed = player.Anatomy.GetDestroyedParts();
        if (destroyed.Count > 0)
        {
            string ruined = "Ruined: " + string.Join(", ", destroyed);
            if (ruined.Length > w - 4) ruined = ruined[..(w - 4)];
            r.PutString(x + 2, rowY++, ruined, 240, ScreenHelpers.PanelBg);
            rowY++;
        }

        r.PutString(x + 2, rowY++, $"Seed:  {seed}",                    ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        r.PutString(x + 2, rowY++, $"Wounds at end: {player.Anatomy.Wounds.Count}", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);

        ScreenHelpers.DrawHintBar(r, x + 1, y + h - 2, w - 2,
            "r) restart with a new seed   q) quit");
    }
}
