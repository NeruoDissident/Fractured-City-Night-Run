using Nightrun.Systems;
using Nightrun.World;

namespace Nightrun.Rendering;

/// <summary>
/// Result returned from <see cref="OverworldScreen.Run"/>.
/// </summary>
public sealed class OverworldResult
{
    /// <summary>Player pressed Enter — drop into this tile's zone.</summary>
    public OverworldTile? DropInto { get; init; }

    /// <summary>Player pressed Esc — quit to main menu.</summary>
    public bool QuitToMenu { get; init; }
}

/// <summary>
/// Caves-of-Qud-style ASCII overworld map screen.
/// Blocks until the player drops into a zone (Enter) or quits (Esc).
/// </summary>
public static class OverworldScreen
{
    // Sidebar width reserved to the right of the map.
    private const int SideW = 28;

    public static OverworldResult Run(IRenderer r, OverworldMap map)
    {
        while (true)
        {
            r.BeginFrame();
            DrawMap(r, map);
            DrawSidebar(r, map);
            r.Present();

            var info = InputSystem.ReadKey();
            var key  = info.Key;
            var ch   = info.KeyChar;

            // 8-direction movement
            int dx = 0, dy = 0;
            if (key == ConsoleKey.LeftArrow  || ch == 'h') dx = -1;
            else if (key == ConsoleKey.RightArrow || ch == 'l') dx =  1;
            else if (key == ConsoleKey.UpArrow    || ch == 'k') dy = -1;
            else if (key == ConsoleKey.DownArrow  || ch == 'j') dy =  1;
            else if (ch == 'y') { dx = -1; dy = -1; }
            else if (ch == 'u') { dx =  1; dy = -1; }
            else if (ch == 'b') { dx = -1; dy =  1; }
            else if (ch == 'n') { dx =  1; dy =  1; }

            if (dx != 0 || dy != 0)
            {
                int nx = Math.Clamp(map.CursorX + dx, 0, OverworldMap.Cols - 1);
                int ny = Math.Clamp(map.CursorY + dy, 0, OverworldMap.Rows - 1);
                map.CursorX = nx;
                map.CursorY = ny;
                // Mark adjacent explored tiles as seen (fog of war radius 1).
                RevealAround(map, nx, ny, 2);
                continue;
            }

            if (key == ConsoleKey.Enter || ch == ' ')
            {
                var tile = map[map.CursorX, map.CursorY];
                // Can't drop into water tiles (no zone yet).
                if (tile.Biome is Biome.Ocean or Biome.Lake or Biome.River)
                    continue;
                tile.Explored = true;
                return new OverworldResult { DropInto = tile };
            }

            if (key == ConsoleKey.Escape || ch == 'q')
                return new OverworldResult { QuitToMenu = true };
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Rendering

    private static void DrawMap(IRenderer r, OverworldMap map)
    {
        // Map area is full screen minus the right sidebar.
        int mapW = r.Width - SideW;
        int mapH = r.Height;

        // Centre the overworld grid inside the map area.
        int offX = (mapW - OverworldMap.Cols) / 2;
        int offY = (mapH - OverworldMap.Rows) / 2;

        // Background fill for map area.
        for (int sy = 0; sy < mapH; sy++)
            for (int sx = 0; sx < mapW; sx++)
                r.Put(sx, sy, ' ', 0, 0);

        for (int row = 0; row < OverworldMap.Rows; row++)
        {
            for (int col = 0; col < OverworldMap.Cols; col++)
            {
                int sx = offX + col;
                int sy = offY + row;
                if (sx < 0 || sx >= mapW || sy < 0 || sy >= mapH) continue;

                var tile = map[col, row];
                bool isCursor = col == map.CursorX && row == map.CursorY;

                if (isCursor)
                {
                    r.Put(sx, sy, '@', 226, 0);
                    continue;
                }

                if (!tile.Explored)
                {
                    r.Put(sx, sy, ' ', 0, 234);
                    continue;
                }

                var (g, fg, bg) = OverworldMap.BiomeVisual(tile.Biome);

                // Cleared zones shown slightly brighter.
                if (tile.Cleared) fg = Math.Min((byte)255, (byte)(fg + 30));

                r.Put(sx, sy, g, fg, bg);
            }
        }

        // Border lines around the map grid.
        int bx = offX - 1;
        int by = offY - 1;
        for (int col = -1; col <= OverworldMap.Cols; col++)
        {
            r.Put(offX + col, by,                        '─', 240, 0);
            r.Put(offX + col, offY + OverworldMap.Rows, '─', 240, 0);
        }
        for (int row = -1; row <= OverworldMap.Rows; row++)
        {
            r.Put(bx,                        offY + row, '│', 240, 0);
            r.Put(offX + OverworldMap.Cols, offY + row, '│', 240, 0);
        }

        // Hint bar at screen bottom.
        string hint = "hjklyubn/arrows move  Enter drop in  Esc quit";
        for (int i = 0; i < mapW; i++) r.Put(i, mapH - 1, ' ', 244, 236);
        r.PutString(2, mapH - 1, hint, 244, 236);
    }

    private static void DrawSidebar(IRenderer r, OverworldMap map)
    {
        int x0 = r.Width - SideW;
        int h  = r.Height;

        // Background
        for (int sy = 0; sy < h; sy++)
            for (int sx = x0; sx < r.Width; sx++)
                r.Put(sx, sy, ' ', 250, 236);

        // Title
        r.PutString(x0 + 1, 0, " OVERWORLD ", 226, 236);

        var tile = map[map.CursorX, map.CursorY];
        int y = 2;

        r.PutString(x0 + 1, y++, OverworldMap.BiomeName(tile.Biome), 252, 236);

        // Zone info (only shown if explored)
        if (tile.Explored)
        {
            var profile = ZoneCatalog.Get(tile.ZoneId);
            if (profile != null)
            {
                y++;
                r.PutString(x0 + 1, y++, "Zone:", 244, 236);
                r.PutString(x0 + 3, y++, profile.Name, 255, 236);

                y++;
                r.PutString(x0 + 1, y++, "Threat:", 244, 236);
                string pips = new string('!', tile.ThreatLevel)
                            + new string('.', 5 - tile.ThreatLevel);
                r.PutString(x0 + 3, y++, $"[{pips}]", 196, 236);

                y++;
                r.PutString(x0 + 1, y++, "Echo:", 244, 236);
                string echoLabel = profile.EchoDensity switch
                {
                    < 0.1f => "None",
                    < 0.3f => "Low",
                    < 0.6f => "Medium",
                    _      => "High",
                };
                r.PutString(x0 + 3, y++, echoLabel, 99, 236);

                if (tile.Cleared)
                {
                    y++;
                    r.PutString(x0 + 1, y++, "[CLEARED]", 34, 236);
                }
            }
        }
        else
        {
            y += 2;
            r.PutString(x0 + 1, y, "Unexplored", 240, 236);
        }

        // Coords at bottom
        r.PutString(x0 + 1, h - 3, $"({map.CursorX},{map.CursorY})", 240, 236);
        r.PutString(x0 + 1, h - 2, "Enter to drop in", 244, 236);
    }

    // ──────────────────────────────────────────────────────────────────
    // Fog of war

    private static void RevealAround(OverworldMap map, int cx, int cy, int radius)
    {
        for (int dy = -radius; dy <= radius; dy++)
        for (int dx = -radius; dx <= radius; dx++)
        {
            int nx = cx + dx;
            int ny = cy + dy;
            if (nx < 0 || nx >= OverworldMap.Cols) continue;
            if (ny < 0 || ny >= OverworldMap.Rows) continue;
            map[nx, ny].Explored = true;
        }
    }
}
