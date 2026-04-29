using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Systems;

namespace Nightrun.Rendering;

/// <summary>
/// Ability selection panel opened with Q during play.
/// Shows all abilities for the current weapon type with locked/cooldown/ready
/// indicators. Number keys 1–9 activate directly; Enter activates the cursor
/// selection. Returns the chosen Ability or null (cancelled / no target).
/// </summary>
public static class AbilityScreen
{
    /// <summary>
    /// Display the ability panel and return the selected <see cref="Ability"/>,
    /// or null if the player cancelled. The caller (Game.Play.cs) then
    /// resolves the attack via <see cref="AbilitySystem"/>.
    /// </summary>
    public static Ability? Pick(IRenderer r, Player player)
    {
        var abilities = AbilitySystem.AvailableAbilities(player);
        if (abilities.Count == 0) return null;

        int cursor = 0;

        while (true)
        {
            r.BeginFrame();
            Draw(r, player, abilities, cursor);
            r.Present();

            var info = InputSystem.ReadKey();
            var key  = info.Key;
            var ch   = info.KeyChar;

            if (key == ConsoleKey.Escape || key == ConsoleKey.Q || ch == 'q')
                return null;

            if (key == ConsoleKey.UpArrow || key == ConsoleKey.K)
                cursor = (cursor - 1 + abilities.Count) % abilities.Count;
            else if (key == ConsoleKey.DownArrow || key == ConsoleKey.J)
                cursor = (cursor + 1) % abilities.Count;
            else if (key == ConsoleKey.Enter || ch == ' ')
                return abilities[cursor];
            else if (ch >= '1' && ch <= '9')
            {
                int idx = ch - '1';
                if (idx < abilities.Count) return abilities[idx];
            }
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private static void Draw(IRenderer r, Player player,
        IReadOnlyList<Ability> abilities, int cursor)
    {
        int w = Math.Min(68, r.Width - 2);
        int h = Math.Min(abilities.Count * 2 + 6, r.Height - 2);
        var (px, py, _, _) = ScreenHelpers.CenterPanel(r, w, h);
        ScreenHelpers.DrawFrame(r, px, py, w, h, "Abilities");

        int cx = px + 2;
        int cy = py + 2;

        string wpType = CombatSystem.GetAttackType(player.ActiveWeapon);
        string wpName = player.ActiveWeapon?.Name ?? "Unarmed";
        r.PutString(cx, cy, $"Weapon: {wpName}", ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
        cy += 2;

        for (int i = 0; i < abilities.Count; i++)
        {
            var ab = abilities[i];
            bool isSel = i == cursor;

            // Determine status
            bool onCd    = player.Cooldowns.TryGetValue(ab.Id, out int cdLeft) && cdLeft > 0;
            bool locked  = ab.TalentId != null && !player.HasTalent(ab.TalentId);
            bool statOk  = ab.StatReqs.All(req => GetStat(player, req.Stat) >= req.Min);

            byte fg;
            byte bg = isSel ? ScreenHelpers.SelBg : ScreenHelpers.PanelBg;
            string status;

            if (locked)       { fg = 238; status = "[locked]"; }
            else if (onCd)    { fg = 166; status = $"[cd:{cdLeft}]"; }
            else if (!statOk) { fg = 238; status = "[req]"; }
            else              { fg = isSel ? ScreenHelpers.SelFg : ScreenHelpers.ValueFg; status = $"[{ab.ActionCost}ap]"; }

            // Row background
            for (int dx = 1; dx < w - 1; dx++) r.Put(px + dx, cy, ' ', fg, bg);

            string num    = $"{i + 1}.";
            string label  = $" {num,-3}{ab.Name,-22}{status,-10}cd:{ab.Cooldown}t";
            if (label.Length > w - 3) label = label[..(w - 3)];
            r.PutString(cx, cy, label, fg, bg);
            cy++;

            // Description on selected
            if (isSel && cy < py + h - 3)
            {
                string desc = "     " + ab.Description;
                if (desc.Length > w - 3) desc = desc[..(w - 4)] + "…";
                r.PutString(cx, cy, desc, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
                cy++;

                // Stat requirements inline
                if (ab.StatReqs.Count > 0)
                {
                    string reqs = "     Requires: " + string.Join(", ",
                        ab.StatReqs.Select(rq =>
                        {
                            int have = GetStat(player, rq.Stat);
                            bool ok  = have >= rq.Min;
                            return $"{rq.Stat} {rq.Min} ({(ok ? "✓" : $"have {have}")})";
                        }));
                    if (reqs.Length > w - 3) reqs = reqs[..(w - 4)] + "…";
                    r.PutString(cx, cy, reqs, ScreenHelpers.HintFg, ScreenHelpers.PanelBg);
                    cy++;
                }
            }
        }

        ScreenHelpers.DrawHintBar(r, px, py + h - 2, w,
            "↑/↓ move | 1-9 quick-select | Enter use | Q/Esc cancel");
    }

    private static int GetStat(Entity e, string stat) => stat switch
    {
        "Strength"     => e.Stats.Strength,
        "Agility"      => e.Stats.Agility,
        "Endurance"    => e.Stats.Endurance,
        "Intelligence" => e.Stats.Intelligence,
        "Perception"   => e.Stats.Perception,
        _              => 0,
    };
}
