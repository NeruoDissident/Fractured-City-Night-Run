using Nightrun.Systems;
using Nightrun.World;

namespace Nightrun.Rendering;

/// <summary>
/// Zone selection screen. Blocks until the player confirms a zone or
/// presses Escape (which returns <c>null</c> — caller should fall back
/// to a default zone or quit).
/// </summary>
public static class ZoneSelectScreen
{
    public static ZoneProfile? Run(IRenderer r)
    {
        var zones = ZoneCatalog.All;
        int cursor = 0;

        while (true)
        {
            r.BeginFrame();
            Draw(r, zones, cursor);
            r.Present();

            var info = InputSystem.ReadKey();
            var key  = info.Key;
            var ch   = info.KeyChar;

            if (key == ConsoleKey.Escape) return null;

            if (key == ConsoleKey.UpArrow   || ch == 'k')
                cursor = (cursor - 1 + zones.Count) % zones.Count;
            else if (key == ConsoleKey.DownArrow || ch == 'j')
                cursor = (cursor + 1) % zones.Count;
            else if (ch >= 'a' && ch <= 'z')
            {
                int idx = ch - 'a';
                if (idx < zones.Count) cursor = idx;
            }
            else if (key == ConsoleKey.Enter || ch == ' ')
                return zones[cursor];
        }
    }

    private static void Draw(IRenderer r, IReadOnlyList<ZoneProfile> zones, int cursor)
    {
        const int W = 60, H = 26;
        var (px, py, _, _) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, px, py, W, H, "SELECT ZONE");

        int cx = px + 2;
        int cy = py + 2;

        r.PutString(cx, cy, "Choose your destination.", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        cy += 2;

        for (int i = 0; i < zones.Count; i++)
        {
            var z   = zones[i];
            bool sel = i == cursor;
            byte fg  = sel ? ScreenHelpers.SelFg  : ScreenHelpers.ValueFg;
            byte bg  = sel ? ScreenHelpers.SelBg  : ScreenHelpers.PanelBg;
            char letter = (char)('a' + i);

            // Clear the row
            for (int dx = 1; dx < W - 1; dx++) r.Put(px + dx, cy, ' ', fg, bg);

            string marker = sel ? "[*]" : "[ ]";
            r.PutString(cx, cy, $" {marker} {letter}) {z.Name}", fg, bg);

            // Threat pips on the right
            string threat = new string('!', z.ThreatLevel) + new string('.', 5 - z.ThreatLevel);
            r.PutString(px + W - 9, cy, $"[{threat}]", sel ? (byte)196 : (byte)160, bg);
            cy++;

            // Description line, indented
            string desc = z.Description.Length > W - 6 ? z.Description[..(W - 6)] : z.Description;
            r.PutString(cx + 4, cy, desc, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            cy += 2;
        }

        // Echo density label for selected zone
        var sel2 = zones[cursor];
        string echoLabel = sel2.EchoDensity switch
        {
            < 0.1f => "Echo: None",
            < 0.3f => "Echo: Low",
            < 0.6f => "Echo: Medium",
            _      => "Echo: High",
        };
        r.PutString(cx, cy, $"  Threat: {sel2.ThreatLevel}/5    {echoLabel}    {sel2.Width}x{sel2.Height}",
            ScreenHelpers.LabelFg, ScreenHelpers.PanelBg);

        ScreenHelpers.DrawHintBar(r, px, py + H - 2, W,
            "↑/↓ or j/k move | Enter confirm | Esc back");
    }
}
