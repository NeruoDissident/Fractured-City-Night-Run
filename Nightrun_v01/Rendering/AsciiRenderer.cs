using System.Text;
using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.Systems;
using Nightrun.World;

namespace Nightrun.Rendering;

/// <summary>
/// Double-buffered ANSI renderer. Builds a frame of (glyph, fg, bg) cells,
/// diffs against the previous frame, and writes only the changed cells in
/// a single batched console write. This is fast enough for 80x40 at 60 FPS
/// even on the default Windows console.
/// </summary>
public sealed class AsciiRenderer : IRenderer
{
    // Sidebar width reserved on the right for stats/log
    public const int SidebarWidth = 32;

    private int _width;
    private int _height;

    // Front/back buffers: flat arrays indexed by y * width + x
    private char[] _glyphs;
    private byte[] _fgs;
    private byte[] _bgs;

    private char[] _prevGlyphs;
    private byte[] _prevFgs;
    private byte[] _prevBgs;

    private readonly StringBuilder _sb = new(65536);
    private bool _firstFrame = true;

    public int Width  => _width;
    public int Height => _height;
    public int MapWidth  => _width - SidebarWidth;
    public int MapHeight => _height;

    public AsciiRenderer()
    {
        AnsiConsole.EnableAnsi();
        ResizeToConsole();
        _glyphs = new char[_width * _height];
        _fgs = new byte[_width * _height];
        _bgs = new byte[_width * _height];
        _prevGlyphs = new char[_width * _height];
        _prevFgs = new byte[_width * _height];
        _prevBgs = new byte[_width * _height];
    }

    private void ResizeToConsole()
    {
        _width = Math.Max(60, Console.WindowWidth);
        _height = Math.Max(24, Console.WindowHeight - 1);
    }

    /// <summary>Clear the back buffer to a blank cell (space, default colors).</summary>
    public void BeginFrame()
    {
        // Detect console resize and rebuild buffers if needed
        int cw = Math.Max(60, Console.WindowWidth);
        int ch = Math.Max(24, Console.WindowHeight - 1);
        if (cw != _width || ch != _height)
        {
            _width = cw; _height = ch;
            _glyphs = new char[_width * _height];
            _fgs = new byte[_width * _height];
            _bgs = new byte[_width * _height];
            _prevGlyphs = new char[_width * _height];
            _prevFgs = new byte[_width * _height];
            _prevBgs = new byte[_width * _height];
            _firstFrame = true;
        }

        Array.Fill(_glyphs, ' ');
        Array.Fill(_fgs, (byte)7);
        Array.Fill(_bgs, (byte)0);
    }

    public void Put(int sx, int sy, char glyph, byte fg, byte bg)
    {
        if (sx < 0 || sy < 0 || sx >= _width || sy >= _height) return;
        int i = sy * _width + sx;
        _glyphs[i] = glyph;
        _fgs[i] = fg;
        _bgs[i] = bg;
    }

    public void PutString(int sx, int sy, string s, byte fg = 250, byte bg = 0)
    {
        for (int i = 0; i < s.Length; i++) Put(sx + i, sy, s[i], fg, bg);
    }

    /// <summary>Change just the background color of an existing cell (for VFX flashes).</summary>
    public void OverrideBg(int sx, int sy, byte bg)
    {
        if (sx < 0 || sy < 0 || sx >= _width || sy >= _height) return;
        _bgs[sy * _width + sx] = bg;
    }

    // -----------------------------------------------------------------
    // World rendering

    public void DrawWorld(IWorldMap world, Camera cam, FOVSystem fov,
                          HashSet<long> memory, Player player,
                          LightingSystem? lighting = null, TimeSystem? time = null)
    {
        int mapW = MapWidth;
        int mapH = MapHeight;

        int ox = cam.OriginX;
        int oy = cam.OriginY;

        // Night-time dimming of ambient-only visible tiles. Full daylight
        // bypasses this entirely so the world stays punchy in the morning.
        double ambient = time?.AmbientLight ?? 1.0;
        bool applyNightDim = ambient < 0.55;

        for (int sy = 0; sy < mapH; sy++)
        {
            for (int sx = 0; sx < mapW; sx++)
            {
                int wx = ox + sx;
                int wy = oy + sy;
                var tile = world.GetTile(wx, wy, player.Z);
                var def = TileCatalog.Get(tile.Type);

                bool vis = fov.IsVisible(wx, wy);
                bool seen = memory.Contains(FOVSystem.Pack(wx, wy));

                // Base glyph/colors start from the tile catalog.
                char glyph = def.Glyph;
                byte fg = def.Fg, bg = def.Bg;

                // World object (furniture) can replace the glyph when not a door.
                // Doors keep the tile glyph so open/closed is obvious in remembered tiles.
                if (tile.ObjectId != 0 && !tile.IsDoor)
                {
                    var obj = world.GetObjectAt(wx, wy, player.Z);
                    if (obj != null)
                    {
                        glyph = obj.Glyph;
                        fg = obj.Fg;
                        if (obj.Bg != 0) bg = obj.Bg;
                    }
                }

                // Items on the ground override everything except walls/doors,
                // but only when visible (remembered items should disappear).
                if (vis && !tile.IsWall && !tile.IsDoor && tile.ObjectId == 0)
                {
                    var items = world.GetItemsAt(wx, wy, player.Z);
                    if (items != null && items.Count > 0)
                    {
                        var top = items[items.Count - 1];
                        glyph = top.Glyph;
                        fg = top.Fg;
                    }
                }

                if (vis)
                {
                    byte outFg = fg;
                    byte outBg = bg;
                    if (applyNightDim && lighting != null)
                    {
                        byte lit = lighting.GetLight(wx, wy);
                        // Brightly lit tiles (>128) render normally. Mid-lit
                        // tiles (threshold..128) nudge toward their source
                        // color. Dim tiles (below threshold) ambient-dim.
                        if (lit < 64)
                            outFg = NightDimFg(fg);
                    }
                    Put(sx, sy, glyph, outFg, outBg);
                }
                else if (seen)
                {
                    // Dim — desaturate toward gray and darken bg
                    Put(sx, sy, glyph, DimFg(fg), DimBg(bg));
                }
                // else: unseen — leave as blank (already filled)
            }
        }

        // NPCs go on top of tiles/items but below the player. Only drawn
        // when visible — unseen NPCs don't reveal themselves through memory.
        int mapW0 = MapWidth;
        foreach (var npc in world.Npcs)
        {
            if (npc.IsDead) continue;
            if (npc.Z != player.Z) continue;
            int sx = npc.X - ox;
            int sy = npc.Y - oy;
            if (sx < 0 || sy < 0 || sx >= mapW0 || sy >= mapH) continue;
            if (!fov.IsVisible(npc.X, npc.Y)) continue;
            Put(sx, sy, npc.Glyph, npc.Fg, 0);
        }

        // Player glyph on top (always visible)
        int psx = player.X - ox;
        int psy = player.Y - oy;
        Put(psx, psy, player.Glyph, player.Fg, 0);
    }

    private static byte DimFg(byte c)
    {
        // Map bright colors toward gray for "remembered" tiles
        return c switch
        {
            0  => 0,
            _  => 238,
        };
    }
    private static byte DimBg(byte c) => c == 0 ? (byte)0 : (byte)234;

    /// <summary>
    /// "Night dim" — halfway between full color and memory-gray. Used for
    /// tiles the player can technically see (moonlight / FOV baseline) but
    /// which aren't hit by any local light source. Keeps the world legible
    /// at night while clearly signalling lit spots.
    /// </summary>
    private static byte NightDimFg(byte c)
    {
        if (c == 0) return 0;
        return c switch
        {
            250 or 255 or 252 => 245, // whites → light gray
            244 or 245        => 240, // grays stay grays
            226 or 228 or 229 => 178, // yellows → muted
            214 or 215 or 220 => 172, // oranges → muted
            34  or 108        => 65,  // greens → moss
            21  or 27  or 33  => 19,  // blues → dim blue
            196 or 203 or 160 => 88,  // reds → darker red
            _                 => 240, // everything else → neutral dim
        };
    }

    // -----------------------------------------------------------------
    // Sidebar

    public void DrawSidebar(Player player, Biome biome, District district,
                            uint seed, IReadOnlyList<LogEntry> log, TimeSystem? time = null,
                            string zoneName = "", string tileUnderfoot = "",
                            InspectInfo? inspect = null)
    {
        int x0 = MapWidth;
        if (x0 >= _width) return;

        // Vertical separator
        for (int y = 0; y < _height; y++)
            Put(x0, y, '│', 240, 0);

        int cx = x0 + 2;
        int y0 = 1;

        PutString(cx, y0++, "NIGHTRUN v0.2",  226, 0);
        PutString(cx, y0++, $"seed {seed}",    244, 0);
        if (!string.IsNullOrEmpty(player.CharacterName))
            PutString(cx, y0++, player.CharacterName, 255, 0);
        if (!string.IsNullOrEmpty(player.Background))
            PutString(cx, y0++, player.Background, 108, 0);
        y0++;

        if (time != null)
        {
            byte timeFg = time.Phase switch
            {
                TimeOfDay.Night    => 67,   // cool blue
                TimeOfDay.Twilight => 214,  // orange
                _                  => 226,  // yellow
            };
            PutString(cx, y0++, "Time", 255, 0);
            PutString(cx, y0++, $"  {time.Clock}", timeFg, 0);
            PutString(cx, y0++, $"  {time.Phase}", 245, 0);
            y0++;
        }

        // ── Location block ──────────────────────────────────────────────
        PutString(cx, y0++, "Location", 255, 0);
        // Zone name (if in a zone) or biome (if on world map)
        if (!string.IsNullOrEmpty(zoneName))
            PutString(cx, y0++, $"  {zoneName}", 34, 0);
        else
            PutString(cx, y0++, $"  {biome}", 34, 0);
        PutString(cx, y0++, $"  {district}", 245, 0);
        PutString(cx, y0++, $"  x{player.X,5} y{player.Y,5}", 244, 0);
        PutString(cx, y0++, $"  z={player.Z,-3}",  244, 0);
        // Tile underfoot
        if (!string.IsNullOrEmpty(tileUnderfoot))
            PutString(cx, y0++, $"  [{tileUnderfoot}]", 240, 0);
        y0++;

        // ── Inspect panel (shown instead of Controls when inspect mode is active) ─
        if (inspect != null)
        {
            PutString(cx, y0++, "INSPECT", 226, 0);
            PutString(cx, y0++, $"  ({inspect.WorldX},{inspect.WorldY})", 244, 0);
            PutString(cx, y0++, $"  {inspect.TileName}",  255, 0);
            if (!string.IsNullOrEmpty(inspect.TileDesc))
                PutString(cx, y0++, $"  {inspect.TileDesc}", 240, 0);
            if (inspect.ObjectName != null)
            {
                y0++;
                PutString(cx, y0++, "Object:", 255, 0);
                PutString(cx, y0++, $"  {inspect.ObjectName}", 215, 0);
            }
            if (inspect.Npc != null)
            {
                var n = inspect.Npc;
                y0++;
                byte hdrFg = n.IsHostile ? (byte)196 : (byte)255;
                PutString(cx, y0++, n.IsHostile ? "HOSTILE" : "Creature", hdrFg, 0);
                PutString(cx, y0++, $"  {n.Name}", 255, 0);
                if (n.IsAlive)
                {
                    PutString(cx, y0++, $"  {n.ConditionLabel} ({n.BloodPct}%)", n.ConditionColor, 0);
                    PutString(cx, y0++, $"  {n.DetectionLabel}", n.DetectionColor, 0);
                    PutString(cx, y0++, $"  {n.WeaponName}", 244, 0);
                    if (n.WoundCount > 0)
                        PutString(cx, y0++, $"  {n.WoundCount} wound(s)", 203, 0);
                }
                else
                {
                    PutString(cx, y0++, "  [DEAD]", 240, 0);
                }
            }
            if (inspect.ItemNames.Count > 0)
            {
                y0++;
                PutString(cx, y0++, "Items:", 255, 0);
                foreach (var name in inspect.ItemNames)
                {
                    if (y0 >= _height - 1) break;
                    PutString(cx, y0++, $"  {name}", 248, 0);
                }
            }
            y0++;
            PutString(cx, y0++, "  arrows move cursor", 240, 0);
            PutString(cx, y0++, "  Esc cancel",          240, 0);
        }
        else
        {
            // ── Condition + blood + needs ─────────────────────────────────
            var cond = player.Anatomy.GetBodyCondition();
            PutString(cx, y0++, "Condition", 255, 0);
            PutString(cx, y0++, $"  {cond.Label}", cond.Color, 0);
            if (!string.IsNullOrEmpty(cond.Details))
                PutString(cx, y0++, $"  {cond.Details}", 244, 0);
            var blood = player.Anatomy.GetBloodStatus();
            PutString(cx, y0++, $"  Blood {(int)player.Anatomy.GetBloodPercent(),3}%", blood.Color, 0);
            if (player.Anatomy.Wounds.Count > 0)
            {
                double bleed = 0;
                foreach (var wnd in player.Anatomy.Wounds) bleed += wnd.Severity;
                PutString(cx, y0++, $"  {player.Anatomy.Wounds.Count} wound(s) {bleed:F1}/t", 203, 0);
            }
            if (player.Anatomy.PainSuppression > 0)
                PutString(cx, y0++, $"  Painkiller {player.Anatomy.PainSuppression}t", 207, 0);
            PutString(cx, y0++, $"  Hunger {player.Hunger,3}  Thirst {player.Thirst,3}", 244, 0);
            y0++;

            // Weight summary
            var (w, v) = player.Inventory.Load();
            PutString(cx, y0++, "Load", 255, 0);
            PutString(cx, y0++, $"  {(w >= 10000 ? $"{w / 1000.0:0.0}kg" : w + "g")}", 244, 0);
            y0++;

                // ── Active wounds list ──────────────────────────────────────
            if (player.Anatomy.Wounds.Count > 0)
            {
                PutString(cx, y0++, "Wounds", 203, 0);
                foreach (var wnd in player.Anatomy.Wounds)
                {
                    if (y0 >= _height - 6) break;
                    string tag = wnd.Bandaged ? "[bd]" : (wnd.Infected ? "[!]" : "");
                    string wline = $"  {wnd.Part} {wnd.Type}{tag} {wnd.Severity:F1}/t";
                    if (wline.Length > SidebarWidth - 3) wline = wline[..(SidebarWidth - 3)];
                    byte wc = wnd.Type == "arterial" ? (byte)196 :
                              wnd.Infected             ? (byte)207 :
                              wnd.Type == "internal"   ? (byte)214 : (byte)203;
                    PutString(cx, y0++, wline, wc, 0);
                }
                y0++;
            }

            // ── Instability (Echo only) ─────────────────────────────────
            if (player.Origin == Nightrun.Content.Origin.Echo && player.MaxInstability > 0)
            {
                int pct = (int)((player.Instability / (double)player.MaxInstability) * 100);
                byte ic = pct >= 80 ? (byte)196 : pct >= 50 ? (byte)214 : (byte)207;
                PutString(cx, y0++, "Instability", ic, 0);
                PutString(cx, y0++, $"  {player.Instability}/{player.MaxInstability} ({pct}%)", ic, 0);
                y0++;
            }

            PutString(cx, y0++, "Keys",             244, 0);
            PutString(cx, y0++, "  wasd/arrows move", 240, 0);
            PutString(cx, y0++, "  e:interact f:atk", 240, 0);
            PutString(cx, y0++, "  i:inv c:char q:Q",  240, 0);
            PutString(cx, y0++, "  F2:new run  l:look", 240, 0);
            y0++;
        }

        PutString(cx, y0++, "Log", 255, 0);
        // Word-wrap each entry and render newest-first
        int logMaxW = SidebarWidth - 3;
        var wrapped = new List<(string text, byte color)>();
        for (int i = log.Count - 1; i >= 0 && wrapped.Count < 60; i--)
        {
            var entry = log[i];
            // Split into lines of logMaxW
            string t = entry.Text;
            while (t.Length > logMaxW)
            {
                // Try to break at a space
                int cut = logMaxW;
                for (int k = logMaxW - 1; k > logMaxW / 2; k--)
                    if (t[k] == ' ') { cut = k; break; }
                wrapped.Add((t[..cut].TrimEnd(), entry.Color));
                t = "  " + t[cut..].TrimStart();
            }
            if (t.Length > 0) wrapped.Add((t, entry.Color));
        }
        for (int row = 0; row < wrapped.Count && y0 + row < _height - 1; row++)
        {
            byte fg = row == 0 ? wrapped[row].color : (byte)Math.Max(236, wrapped[row].color - 14);
            PutString(cx, y0 + row, wrapped[row].text, fg, 0);
        }
    }

    /// <summary>
    /// Draws the inspect cursor ('[' ']' brackets) at the given world position.
    /// Must be called after DrawWorld so it renders on top.
    /// </summary>
    public void DrawInspectCursor(Camera cam, int wx, int wy)
    {
        int sx = wx - cam.OriginX;
        int sy = wy - cam.OriginY;
        if (sx < 0 || sy < 0 || sx >= MapWidth || sy >= MapHeight) return;
        Put(sx - 1, sy, '[', 226, 0);
        Put(sx + 1, sy, ']', 226, 0);
    }

    // -----------------------------------------------------------------
    // Biome map overlay — a mini-map of surrounding chunks by biome color.

    public void DrawBiomeOverlay(WorldManager world, Camera cam)
    {
        int mapW = MapWidth;
        int mapH = MapHeight;
        int radius = Math.Min(mapW, mapH) / 2 - 4;
        if (radius < 6) return;

        int centerSx = mapW / 2;
        int centerSy = mapH / 2;

        int pcx = (int)Math.Floor(cam.TargetX / (double)Chunk.Size);
        int pcy = (int)Math.Floor(cam.TargetY / (double)Chunk.Size);

        // Dark panel background
        for (int dy = -radius; dy <= radius; dy++)
        for (int dx = -radius; dx <= radius; dx++)
            Put(centerSx + dx, centerSy + dy, ' ', 0, 232);

        for (int dy = -radius; dy <= radius; dy++)
        {
            for (int dx = -radius; dx <= radius; dx++)
            {
                int sx = centerSx + dx;
                int sy = centerSy + dy;
                var biome = world.BiomeMapper.BiomeAt(pcx + dx, pcy + dy);
                (char g, byte fg, byte bg) = BiomeGlyph(biome);
                if (dx == 0 && dy == 0) { g = '@'; fg = 226; }
                Put(sx, sy, g, fg, bg);
            }
        }
        PutString(centerSx - radius, centerSy - radius - 1, " BIOME MAP (press M to close) ", 255, 236);
    }

    private static (char, byte, byte) BiomeGlyph(Biome b) => b switch
    {
        Biome.UrbanCore        => ('#', 250, 238),
        Biome.Suburbs          => ('.',  34,  22),
        Biome.Industrial       => ('%', 244, 235),
        Biome.RichNeighborhood => ('"',  40,  22),
        Biome.Ruins            => ('x', 130, 234),
        Biome.Rural            => (',',  28,  22),
        Biome.Forest           => ('T',  22,  22),
        Biome.Coast            => ('s', 222, 234),
        Biome.Ocean            => ('~',  25,  18),
        Biome.Lake             => ('~',  31,  18),
        Biome.River            => ('~',  31,  18),
        _                      => ('?', 124,   0),
    };

    // -----------------------------------------------------------------
    // Present: write diff to console.

    public void Present()
    {
        _sb.Clear();

        byte lastFg = 255, lastBg = 255;
        bool haveColor = false;
        int lastRow = -1, lastCol = -1;

        if (_firstFrame)
        {
            _sb.Append(AnsiConsole.Hide);
            _sb.Append(AnsiConsole.Clear);
        }

        for (int y = 0; y < _height; y++)
        {
            for (int x = 0; x < _width; x++)
            {
                int i = y * _width + x;
                char g = _glyphs[i];
                byte fg = _fgs[i];
                byte bg = _bgs[i];

                if (!_firstFrame && g == _prevGlyphs[i] && fg == _prevFgs[i] && bg == _prevBgs[i])
                    continue;

                if (y != lastRow || x != lastCol + 1)
                {
                    _sb.Append("\x1b[").Append(y + 1).Append(';').Append(x + 1).Append('H');
                }

                if (!haveColor || fg != lastFg)
                {
                    _sb.Append("\x1b[38;5;").Append(fg).Append('m');
                    lastFg = fg;
                }
                if (!haveColor || bg != lastBg)
                {
                    _sb.Append("\x1b[48;5;").Append(bg).Append('m');
                    lastBg = bg;
                }
                haveColor = true;

                _sb.Append(g);
                lastRow = y; lastCol = x;

                _prevGlyphs[i] = g;
                _prevFgs[i] = fg;
                _prevBgs[i] = bg;
            }
        }

        _sb.Append(AnsiConsole.Reset);
        Console.Write(_sb.ToString());
        _firstFrame = false;
    }
}
