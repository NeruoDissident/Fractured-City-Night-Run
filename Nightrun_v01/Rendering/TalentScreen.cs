using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Systems;

namespace Nightrun.Rendering;

/// <summary>
/// Talent tree browser. Opened with T during play.
/// Left/Right selects a tree; Up/Down moves the cursor through that tree's
/// talents; Enter/Space spends a point on the highlighted talent.
/// Escape or T closes.
/// </summary>
public static class TalentScreen
{
    public static void Run(IRenderer r, Player player)
    {
        var trees = TalentCatalog.TreesForOrigin(player.Origin);
        if (trees.Count == 0) return;

        int treeIx   = 0;
        int talentIx = 0;

        while (true)
        {
            r.BeginFrame();
            Draw(r, player, trees, treeIx, talentIx);
            r.Present();

            var info = InputSystem.ReadKey();
            var key  = info.Key;
            var ch   = info.KeyChar;

            if (key == ConsoleKey.Escape || key == ConsoleKey.T || ch == 't')
                return;

            // Left / Right — cycle trees.
            if (key == ConsoleKey.LeftArrow || key == ConsoleKey.H)
            {
                treeIx   = (treeIx - 1 + trees.Count) % trees.Count;
                talentIx = 0;
            }
            else if (key == ConsoleKey.RightArrow || key == ConsoleKey.L)
            {
                treeIx   = (treeIx + 1) % trees.Count;
                talentIx = 0;
            }
            // Up / Down — move cursor within current tree.
            else if (key == ConsoleKey.UpArrow || key == ConsoleKey.K)
            {
                int n = trees[treeIx].Talents.Count;
                talentIx = (talentIx - 1 + n) % n;
            }
            else if (key == ConsoleKey.DownArrow || key == ConsoleKey.J)
            {
                int n = trees[treeIx].Talents.Count;
                talentIx = (talentIx + 1) % n;
            }
            // Enter / Space — try to unlock.
            else if (key == ConsoleKey.Enter || ch == ' ')
            {
                TryUnlock(player, trees[treeIx], talentIx);
            }
        }
    }

    // ── Unlock logic ──────────────────────────────────────────────────────────

    private static void TryUnlock(Player player, TalentTree tree, int idx)
    {
        var talent = tree.Talents[idx];

        if (player.HasTalent(talent.Id)) return;             // already have it
        if (player.TalentPoints < talent.Cost) return;       // can't afford it

        // Prerequisite: at least one talent in the previous tier must be unlocked
        // (tier 1 always unlocked as long as player has points).
        if (talent.Tier > 1)
        {
            bool prevUnlocked = tree.Talents.Any(t =>
                t.Tier == talent.Tier - 1 && player.HasTalent(t.Id));
            if (!prevUnlocked) return;
        }

        player.TalentPoints -= talent.Cost;
        player.UnlockedTalents.Add(talent.Id);
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private static void Draw(
        IRenderer r, Player player,
        IReadOnlyList<TalentTree> trees, int treeIx, int talentIx)
    {
        int w = Math.Min(76, r.Width - 2);
        int h = Math.Min(32, r.Height - 2);
        var (px, py, _, _) = ScreenHelpers.CenterPanel(r, w, h);
        ScreenHelpers.DrawFrame(r, px, py, w, h, "Talent Trees");

        int cx = px + 2;
        int cy = py + 2;

        // ── Points header ──
        byte ptColour = player.TalentPoints > 0 ? (byte)190 : (byte)244;
        r.PutString(cx, cy,
            $"Talent Points: {player.TalentPoints}   Origin: {player.Origin}",
            ptColour, ScreenHelpers.PanelBg);
        cy += 2;

        // ── Tree tabs ──
        int tx = cx;
        for (int i = 0; i < trees.Count; i++)
        {
            bool sel = i == treeIx;
            byte fg = sel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg;
            byte bg = sel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
            string label = $" {trees[i].Name} ";
            for (int dx = 0; dx < label.Length; dx++)
                r.Put(tx + dx, cy, label[dx], fg, bg);
            tx += label.Length + 1;
        }
        cy += 2;

        // ── Talent list for current tree ──
        var tree    = trees[treeIx];
        int maxTier = tree.Talents.Count > 0 ? tree.Talents.Max(t => t.Tier) : 1;

        // Group by tier for display
        for (int tier = 1; tier <= maxTier; tier++)
        {
            // Tier header
            byte tierColour = TierUnlocked(player, tree, tier) ? (byte)220 : (byte)238;
            r.PutString(cx, cy, $"── Tier {tier} ", tierColour, ScreenHelpers.PanelBg);
            cy++;

            var tierTalents = tree.Talents.Where(t => t.Tier == tier).ToList();
            int globalStart = tree.Talents.TakeWhile(t => t.Tier < tier).Count();

            for (int li = 0; li < tierTalents.Count; li++)
            {
                int globalIdx = globalStart + li;
                var t         = tierTalents[li];
                bool isSel    = globalIdx == talentIx;
                bool owned    = player.HasTalent(t.Id);
                bool canAfford = player.TalentPoints >= t.Cost;
                bool prereqOk = t.Tier == 1 || tree.Talents.Any(pt =>
                    pt.Tier == t.Tier - 1 && player.HasTalent(pt.Id));

                byte fg = isSel ? ScreenHelpers.SelFg
                        : owned   ? (byte)82   // bright green
                        : !prereqOk ? (byte)238 // dark grey — locked
                        : !canAfford ? (byte)166 // orange — can't afford
                        : ScreenHelpers.ValueFg;
                byte bg = isSel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;

                string status  = owned ? "[✓]" : (prereqOk ? $"[{t.Cost}]" : "[x]");
                string line    = $"  {status} {t.Name}";
                int    lineMax = w - 4;
                if (line.Length > lineMax) line = line.Substring(0, lineMax);

                for (int dx = 1; dx < w - 1; dx++) r.Put(px + dx, cy, ' ', fg, bg);
                r.PutString(cx, cy, line, fg, bg);
                cy++;

                // Description on selected talent
                if (isSel && cy < py + h - 4)
                {
                    string desc = "  " + t.Description;
                    if (desc.Length > w - 4) desc = desc.Substring(0, w - 5) + "…";
                    r.PutString(cx, cy, desc, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
                    cy++;
                }
            }
            cy++;
        }

        // ── Hint bar ──
        ScreenHelpers.DrawHintBar(r, px, py + h - 2, w,
            "←/→ tree | ↑/↓ talent | Enter/Space unlock | T/Esc close");
    }

    /// <summary>True if at least one talent in the given tier (or tier 1) is unlocked.</summary>
    private static bool TierUnlocked(Player player, TalentTree tree, int tier)
    {
        if (tier == 1) return true;
        return tree.Talents.Any(t => t.Tier == tier - 1 && player.HasTalent(t.Id));
    }
}
