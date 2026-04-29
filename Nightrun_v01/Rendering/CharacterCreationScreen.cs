using Nightrun.Content;
using Nightrun.Systems;

namespace Nightrun.Rendering;

/// <summary>
/// Self-contained character-creation TUI. Owns its own input/render loop and
/// returns a finalized <see cref="CharacterData"/>. Mirrors the JS
/// <c>CharacterCreationScreen</c> in <c>src/ui/</c>: name, gender, background,
/// 50-point stat buy (1..20 per stat), and a 3-point trait budget where
/// negatives refund. Escape aborts and returns <see cref="CharacterData.Default"/>.
/// </summary>
public static class CharacterCreationScreen
{
    private enum Section : byte { Name, Gender, Origin, Background, Stats, Traits, Play }
    private static readonly int SectionCount = Enum.GetValues<Section>().Length;

    // Stats shown in a fixed display order so the column layout is stable.
    private static readonly string[] StatKeys = { "strength", "agility", "endurance", "intelligence", "perception" };
    private static readonly string[] StatLabels = { "Strength", "Agility", "Endurance", "Intelligence", "Perception" };
    private static readonly string[] Genders = { "male", "female", "other" };

    public static CharacterData Run(IRenderer r)
    {
        // Working state — seeded from Default so "Play Now" from an
        // untouched screen produces a valid character (a street kid named
        // "Survivor" with 10 in every stat and no traits).
        string name     = CharacterData.Default.Name;
        int genderIx    = 2; // "other"
        var origin      = Content.Origin.Flesh;
        int bgIx        = 0;
        int[] stats     = { 10, 10, 10, 10, 10 };
        var traits      = new List<string>();

        int statCursor  = 0;
        int bgCursor    = 0;
        int traitCursor = 0;
        Section focus   = Section.Name;

        // Helper: backgrounds filtered to the currently selected origin.
        IReadOnlyList<Background> FilteredBgs()
            => CharacterCreation.BackgroundsForOrigin(origin);

        while (true)
        {
            r.BeginFrame();
            Draw(r, name, genderIx, origin, bgIx, stats, traits, statCursor, bgCursor, traitCursor, focus);
            r.Present();

            var info = InputSystem.ReadKey();
            var ch = info.KeyChar;
            var key = info.Key;

            // Global: escape aborts to default character.
            if (key == ConsoleKey.Escape)
                return CharacterData.Default;

            // Section switching — Tab forward, Shift+Tab backward.
            if (key == ConsoleKey.Tab)
            {
                int dir = (info.Modifiers & ConsoleModifiers.Shift) != 0 ? -1 : 1;
                focus = (Section)(((int)focus + dir + SectionCount) % SectionCount);
                // Reset bg cursor when entering background section.
                if (focus == Section.Background) bgCursor = Math.Clamp(bgCursor, 0, Math.Max(0, FilteredBgs().Count - 1));
                continue;
            }

            // Per-section input.
            // Up/Down arrows navigate between sections for Name and Gender (where
            // they have no in-section meaning). For list sections (Background,
            // Stats, Traits) Up/Down scroll within the section; pressing Up on
            // the first item or Down on the last item wraps within the list rather
            // than jumping sections, which matches standard list-box behaviour.
            // Enter on Name/Gender advances focus to the next section.
            switch (focus)
            {
                case Section.Name:
                    if (key == ConsoleKey.UpArrow)
                        focus = Section.Play;       // wrap to last section
                    else if (key == ConsoleKey.DownArrow || key == ConsoleKey.Enter)
                        focus = Section.Gender;
                    else
                        HandleName(ref name, info);
                    break;

                case Section.Gender:
                    if (key == ConsoleKey.UpArrow)
                        focus = Section.Name;
                    else if (key == ConsoleKey.DownArrow || key == ConsoleKey.Enter)
                        focus = Section.Origin;
                    else if (key == ConsoleKey.LeftArrow)
                        genderIx = (genderIx - 1 + Genders.Length) % Genders.Length;
                    else if (key == ConsoleKey.RightArrow)
                        genderIx = (genderIx + 1) % Genders.Length;
                    break;

                case Section.Origin:
                {
                    var origins = Enum.GetValues<Content.Origin>();
                    int oi = Array.IndexOf(origins, origin);
                    if (key == ConsoleKey.UpArrow)
                        focus = Section.Gender;
                    else if (key == ConsoleKey.DownArrow || key == ConsoleKey.Enter)
                    {
                        // Reset bg cursor when origin changes.
                        bgCursor = 0; bgIx = 0;
                        focus = Section.Background;
                    }
                    else if (key == ConsoleKey.LeftArrow)
                    {
                        origin = origins[(oi - 1 + origins.Length) % origins.Length];
                        bgCursor = 0; bgIx = 0;
                    }
                    else if (key == ConsoleKey.RightArrow)
                    {
                        origin = origins[(oi + 1) % origins.Length];
                        bgCursor = 0; bgIx = 0;
                    }
                    break;
                }

                case Section.Background:
                {
                    var bgs = FilteredBgs();
                    int n   = bgs.Count;
                    if (key == ConsoleKey.UpArrow || key == ConsoleKey.K)
                    {
                        if (bgCursor == 0) focus = Section.Origin;
                        else bgCursor--;
                    }
                    else if (key == ConsoleKey.DownArrow || key == ConsoleKey.J)
                    {
                        if (bgCursor == n - 1) focus = Section.Stats;
                        else bgCursor++;
                    }
                    else if (key == ConsoleKey.Enter || ch == ' ')
                    {
                        bgIx = bgCursor;
                        focus = Section.Stats;
                    }
                    break;
                }

                case Section.Stats:
                {
                    int n = stats.Length;
                    if (key == ConsoleKey.UpArrow || key == ConsoleKey.K)
                    {
                        if (statCursor == 0) focus = Section.Background;
                        else statCursor--;
                    }
                    else if (key == ConsoleKey.DownArrow || key == ConsoleKey.J)
                    {
                        if (statCursor == n - 1) focus = Section.Traits;
                        else statCursor++;
                    }
                    else
                    {
                        int total = 0; foreach (var s in stats) total += s;
                        if (key == ConsoleKey.RightArrow || ch == '+' || ch == '=')
                        {
                            if (total < CharacterCreation.StatPointsTotal && stats[statCursor] < CharacterCreation.StatMax)
                                stats[statCursor]++;
                        }
                        else if (key == ConsoleKey.LeftArrow || ch == '-' || ch == '_')
                        {
                            if (stats[statCursor] > CharacterCreation.StatMin) stats[statCursor]--;
                        }
                    }
                    break;
                }

                case Section.Traits:
                {
                    var all = CharacterCreation.Traits;
                    int n = all.Count;
                    if (key == ConsoleKey.UpArrow || key == ConsoleKey.K)
                    {
                        if (traitCursor == 0) focus = Section.Stats;
                        else traitCursor--;
                    }
                    else if (key == ConsoleKey.DownArrow || key == ConsoleKey.J)
                    {
                        if (traitCursor == n - 1) focus = Section.Play;
                        else traitCursor++;
                    }
                    else if (key == ConsoleKey.Enter || ch == ' ')
                        ToggleTrait(traits, all[traitCursor].Id);
                    break;
                }

                case Section.Play:
                    if (key == ConsoleKey.UpArrow)
                        focus = Section.Traits;
                    else if (key == ConsoleKey.DownArrow)
                        focus = Section.Name;
                    else if (key == ConsoleKey.Enter || ch == ' ')
                    {
                        var bgs = FilteredBgs();
                        if (bgs.Count == 0) { focus = Section.Background; break; }
                        var bg = bgs[Math.Clamp(bgIx, 0, bgs.Count - 1)];
                        var data = new CharacterData(
                            Name: string.IsNullOrWhiteSpace(name) ? "Survivor" : name,
                            Gender: Genders[genderIx],
                            Origin: origin,
                            Strength: stats[0], Agility: stats[1], Endurance: stats[2],
                            Intelligence: stats[3], Perception: stats[4],
                            BackgroundId: bg.Id,
                            Traits: traits.ToArray());
                        var v = CharacterCreation.Validate(data);
                        if (v.Valid) return data;
                        focus = Section.Traits;
                    }
                    break;
            }
        }
    }

    private static void HandleName(ref string name, ConsoleKeyInfo info)
    {
        var key = info.Key;
        var ch  = info.KeyChar;
        if (key == ConsoleKey.Backspace)
        {
            if (name.Length > 0) name = name.Substring(0, name.Length - 1);
            return;
        }
        if (ch >= ' ' && ch != 127 && name.Length < 18)
        {
            // Only allow reasonable name characters.
            if (char.IsLetterOrDigit(ch) || ch == ' ' || ch == '-' || ch == '\'' || ch == '_')
                name += ch;
        }
    }

    private static void ToggleTrait(List<string> selected, string id)
    {
        if (selected.Contains(id)) { selected.Remove(id); return; }
        // Compute resulting budget — positive traits spend, negatives refund.
        var temp = new List<string>(selected) { id };
        int pts = CharacterCreation.CalculateTraitPoints(temp);
        if (pts < 0) return;    // disallow overspend
        selected.Add(id);
    }

    // ------------------------------------------------------------------
    // Drawing

    private static void Draw(
        IRenderer r,
        string name, int genderIx, Content.Origin origin, int bgIx, int[] stats,
        List<string> traits, int statCursor, int bgCursor, int traitCursor,
        Section focus)
    {
        int w = Math.Min(78, r.Width - 2);
        int h = Math.Min(30, r.Height - 2);
        var (px, py, _, _) = ScreenHelpers.CenterPanel(r, w, h);
        ScreenHelpers.DrawFrame(r, px, py, w, h, "Character Creation");

        int cx = px + 2;
        int cy = py + 2;

        // ── Name ──
        byte nameFg = focus == Section.Name ? ScreenHelpers.SelFg : ScreenHelpers.LabelFg;
        r.PutString(cx, cy, "Name: ", nameFg, ScreenHelpers.PanelBg);
        string nameShown = name + (focus == Section.Name ? "_" : "");
        r.PutString(cx + 6, cy, nameShown, ScreenHelpers.ValueFg, ScreenHelpers.PanelBg);
        cy += 2;

        // ── Gender ──
        byte genFg = focus == Section.Gender ? ScreenHelpers.SelFg : ScreenHelpers.LabelFg;
        r.PutString(cx, cy, "Gender: ", genFg, ScreenHelpers.PanelBg);
        r.PutString(cx + 8, cy, $"< {Genders[genderIx]} >", ScreenHelpers.ValueFg, ScreenHelpers.PanelBg);
        cy += 2;

        // ── Origin ──
        byte oriLabelFg = focus == Section.Origin ? ScreenHelpers.SelFg : ScreenHelpers.LabelFg;
        var origins = Enum.GetValues<Content.Origin>();
        r.PutString(cx, cy, "Origin: ", oriLabelFg, ScreenHelpers.PanelBg);
        r.PutString(cx + 8, cy, $"< {OriginInfo.Name(origin)} >", ScreenHelpers.ValueFg, ScreenHelpers.PanelBg);
        cy++;
        string oriDesc  = OriginInfo.Description(origin);
        string oriLock  = OriginInfo.LockedSystems(origin);
        // Colour code: Flesh=white, Metal=cyan, Echo=magenta.
        byte oriColour = origin switch { Content.Origin.Metal => 51, Content.Origin.Echo => 207, _ => 252 };
        var oriLines = WrapText(oriDesc, w - 6);
        foreach (var ol in oriLines) { r.PutString(cx + 2, cy++, ol, oriColour, ScreenHelpers.PanelBg); }
        r.PutString(cx + 2, cy, oriLock, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        cy += 2;

        // ── Background (filtered by origin) ──
        byte bgFg = focus == Section.Background ? ScreenHelpers.SelFg : ScreenHelpers.LabelFg;
        r.PutString(cx, cy, "Background:", bgFg, ScreenHelpers.PanelBg);
        cy++;
        var bgs = CharacterCreation.BackgroundsForOrigin(origin);
        int safeBgIx = Math.Clamp(bgIx, 0, Math.Max(0, bgs.Count - 1));
        for (int i = 0; i < bgs.Count; i++)
        {
            bool sel    = focus == Section.Background ? i == bgCursor : i == safeBgIx;
            bool active = i == safeBgIx;
            byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
            byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
            string marker = active ? "[*]" : "[ ]";
            string line   = $" {marker} {bgs[i].Name}";
            for (int dx = 1; dx < w - 1; dx++) r.Put(px + dx, cy, ' ', fg, bg);
            r.PutString(cx, cy, line, fg, bg);
            cy++;
        }
        if (bgs.Count == 0)
        {
            r.PutString(cx + 2, cy, "(no backgrounds for this origin)", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            cy++;
        }
        else
        {
            var descBg = focus == Section.Background ? bgs[Math.Clamp(bgCursor, 0, bgs.Count - 1)] : bgs[safeBgIx];
            var bgLines = WrapText(descBg.Description, w - 6);
            foreach (var bl in bgLines) { r.PutString(cx + 2, cy++, bl, ScreenHelpers.HintFg, ScreenHelpers.PanelBg); }
        }
        cy++;

        // ── Stats ──
        byte stFg = focus == Section.Stats ? ScreenHelpers.SelFg : ScreenHelpers.LabelFg;
        int total = 0; foreach (var s in stats) total += s;
        int remaining = CharacterCreation.StatPointsTotal - total;
        r.PutString(cx, cy, $"Stats (points left: {remaining}):", stFg, ScreenHelpers.PanelBg);
        cy++;
        for (int i = 0; i < stats.Length; i++)
        {
            bool sel = focus == Section.Stats && i == statCursor;
            byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
            byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
            for (int dx = 1; dx < w - 1; dx++) r.Put(px + dx, cy, ' ', fg, bg);
            r.PutString(cx, cy, $" {StatLabels[i],-13}  < {stats[i]:00} >", fg, bg);
            cy++;
        }
        cy++;

        // ── Traits ──
        byte trFg = focus == Section.Traits ? ScreenHelpers.SelFg : ScreenHelpers.LabelFg;
        int tp = CharacterCreation.CalculateTraitPoints(traits);
        r.PutString(cx, cy, $"Traits (points left: {tp}):", trFg, ScreenHelpers.PanelBg);
        cy++;
        var tlist = CharacterCreation.Traits;
        // Two-column layout to fit 10 traits on limited vertical space.
        int colW = (w - 4) / 2;
        int rowsPerCol = (tlist.Count + 1) / 2;
        for (int i = 0; i < tlist.Count; i++)
        {
            int col = i / rowsPerCol;
            int row = i % rowsPerCol;
            int rx  = cx + col * colW;
            int ry  = cy + row;
            bool sel = focus == Section.Traits && i == traitCursor;
            bool taken = traits.Contains(tlist[i].Id);
            byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
            byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
            string marker = taken ? "[x]" : "[ ]";
            string costStr = tlist[i].Cost >= 0 ? $"+{tlist[i].Cost}" : $"{tlist[i].Cost}";
            string line = $" {marker} {tlist[i].Name} ({costStr})";
            if (line.Length > colW - 1) line = line.Substring(0, colW - 1);
            for (int dx = 0; dx < colW; dx++) r.Put(rx + dx, ry, ' ', fg, bg);
            r.PutString(rx, ry, line, fg, bg);
        }
        cy += rowsPerCol + 1;

        // ── Play button ──
        byte playFg = focus == Section.Play ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
        byte playBg = focus == Section.Play ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
        string play = "  [ Play Now ]  ";
        int playX = px + (w - play.Length) / 2;
        for (int dx = 0; dx < play.Length; dx++) r.Put(playX + dx, cy, ' ', playFg, playBg);
        r.PutString(playX, cy, play, playFg, playBg);

        // ── Hint bar ──
        ScreenHelpers.DrawHintBar(r, px, py + h - 2, w,
            "↑/↓ move between fields | ←/→ adjust | Enter/Space select | Tab jump | Esc default");
    }

    private static string TruncateWrap(string s, int maxWidth)
    {
        if (s.Length <= maxWidth) return s;
        return s.Substring(0, maxWidth - 1) + "…";
    }

    private static List<string> WrapText(string s, int maxWidth)
    {
        var lines = new List<string>();
        while (s.Length > maxWidth)
        {
            int cut = maxWidth;
            for (int k = maxWidth - 1; k > maxWidth / 2; k--)
                if (s[k] == ' ') { cut = k; break; }
            lines.Add(s[..cut].TrimEnd());
            s = s[cut..].TrimStart();
            if (lines.Count >= 2) break; // max 2 display lines
        }
        if (s.Length > 0)
        {
            if (s.Length > maxWidth) s = s[..(maxWidth - 1)] + "…";
            lines.Add(s);
        }
        return lines;
    }
}
