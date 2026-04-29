using Nightrun.Content;

namespace Nightrun.Rendering;

/// <summary>
/// Menu shown after the player presses "z" — lists adjacent world objects
/// (doors / furniture) and, once one is selected, the valid actions for it
/// (peek, knock, smash, disassemble). Input and execution live in Game; this
/// class only draws. Port of JS <c>WorldObjectModal</c>.
/// </summary>
public static class WorldObjectScreen
{
    public static void DrawObjectList(
        IRenderer r,
        IReadOnlyList<WorldObject> objects,
        int cursor)
    {
        const int W = 52, H = 18;
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, "NEARBY OBJECTS");

        if (objects.Count == 0)
        {
            r.PutString(x + 2, y + 2, "Nothing to interact with nearby.",
                ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
            ScreenHelpers.DrawHintBar(r, x, y + h - 2, w, "Esc/Q back");
            return;
        }

        int rowY = y + 2;
        for (int i = 0; i < objects.Count && rowY < y + h - 3; i++, rowY++)
        {
            bool sel = i == cursor;
            byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
            byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
            for (int dx = 1; dx < w - 1; dx++) r.Put(x + dx, rowY, ' ', fg, bg);

            var o = objects[i];
            string letter = $" {ScreenHelpers.LetterFor(i)}) ";
            r.PutString(x + 2, rowY, letter, ScreenHelpers.HintFg, bg);
            r.Put(x + 2 + letter.Length, rowY, o.Glyph, o.Fg, bg);
            string label = $" {o.Name} — {o.GetStatusText()}";
            r.PutString(x + 2 + letter.Length + 2, rowY, label, fg, bg);
        }

        ScreenHelpers.DrawHintBar(r, x, y + h - 2, w,
            "↑/↓ pick | Enter/Space choose | Esc back");
    }

    public static void DrawActionList(
        IRenderer r,
        WorldObject target,
        IReadOnlyList<string> actions,
        int cursor)
    {
        const int W = 52, H = 14;
        var (x, y, w, h) = ScreenHelpers.CenterPanel(r, W, H);
        ScreenHelpers.DrawFrame(r, x, y, w, h, target.Name);

        r.PutString(x + 2, y + 2, target.GetStatusText(),
            ScreenHelpers.HintFg, ScreenHelpers.PanelBg);

        int rowY = y + 4;
        for (int i = 0; i < actions.Count && rowY < y + h - 3; i++, rowY++)
        {
            bool sel = i == cursor;
            byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
            byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
            for (int dx = 1; dx < w - 1; dx++) r.Put(x + dx, rowY, ' ', fg, bg);
            string letter = $" {ScreenHelpers.LetterFor(i)}) ";
            r.PutString(x + 2, rowY, letter, ScreenHelpers.HintFg, bg);
            r.PutString(x + 2 + letter.Length, rowY, actions[i], fg, bg);
        }

        ScreenHelpers.DrawHintBar(r, x, y + h - 2, w,
            "↑/↓ pick | Enter/Space do | Esc back");
    }
}
