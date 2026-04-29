namespace Nightrun.Rendering;

/// <summary>
/// Lightweight combat visual-effects overlay for the ASCII renderer.
/// Effects are queued after combat resolves and drawn on top of the world
/// for one render frame (the frame the player sees after their action).
/// Cleared at the start of each input cycle via <see cref="Clear"/>.
/// </summary>
public sealed class CombatVfx
{
    // ── Tile flash: change the bg of a world tile for one frame ──────────
    public readonly record struct TileFlash(int WorldX, int WorldY, byte Bg);

    // ── Floating text: short string drawn near a world position ──────────
    // Bg=0 means transparent (use terminal default). All combat text should
    // have a solid Bg so it reads against any tile color.
    public readonly record struct FloatingText(int WorldX, int WorldY, string Text, byte Fg, byte Bg);

    private readonly List<TileFlash>    _flashes = new();
    private readonly List<FloatingText> _texts   = new();

    public void Clear()
    {
        _flashes.Clear();
        _texts.Clear();
    }

    // ── Queue helpers ────────────────────────────────────────────────────

    public void Flash(int wx, int wy, byte bg)
        => _flashes.Add(new TileFlash(wx, wy, bg));

    public void Float(int wx, int wy, string text, byte fg, byte bg = 232)
        => _texts.Add(new FloatingText(wx, wy, text, fg, bg));

    // ── Convenience: standard combat events ──────────────────────────────
    // All text uses a solid bg so it stands out against map tiles.
    // Format: padded label   e.g.  " -7 "  " CRIT! -12 "  " PARRY! "

    /// <summary>Dark-red flash + padded damage number with solid bg.</summary>
    public void Hit(int wx, int wy, int damage)
    {
        Flash(wx, wy, 52);
        Float(wx, wy, $" -{damage} ", 255, 52);
    }

    /// <summary>Gold flash + CRIT callout — most prominent event.</summary>
    public void Crit(int wx, int wy, int damage)
    {
        Flash(wx, wy, 136);
        Float(wx, wy, $" CRIT! -{damage} ", 226, 136);
    }

    /// <summary>Dim gray flash + miss label.</summary>
    public void Miss(int wx, int wy)
    {
        Flash(wx, wy, 234);
        Float(wx, wy, " miss ", 244, 234);
    }

    /// <summary>Cyan flash + PARRY callout.</summary>
    public void Parry(int wx, int wy)
    {
        Flash(wx, wy, 23);
        Float(wx, wy, " PARRY! ", 51, 23);
    }

    /// <summary>Orange flash + STAGGER callout.</summary>
    public void Stagger(int wx, int wy)
    {
        Flash(wx, wy, 94);
        Float(wx, wy, " STAGGER ", 214, 94);
    }

    /// <summary>Purple flash + STUN callout.</summary>
    public void Stun(int wx, int wy)
    {
        Flash(wx, wy, 54);
        Float(wx, wy, " STUN! ", 207, 54);
    }

    /// <summary>Green flash + absorbed amount.</summary>
    public void Block(int wx, int wy, int absorbed)
    {
        if (absorbed <= 0) return;
        Flash(wx, wy, 22);
        Float(wx, wy, $" blk-{absorbed} ", 46, 22);
    }

    /// <summary>Dark-gold flash + ability name.</summary>
    public void AbilityUsed(int wx, int wy, string abilityName)
    {
        Flash(wx, wy, 52);
        Float(wx, wy, $" {abilityName.ToUpperInvariant()}! ", 226, 88);
    }

    /// <summary>Deep red flash + KILL callout — most dramatic.</summary>
    public void Kill(int wx, int wy)
    {
        Flash(wx, wy, 88);
        Float(wx, wy, " KILL! ", 196, 88);
    }

    // ── Draw onto the renderer ───────────────────────────────────────────

    /// <summary>
    /// Overlay all queued effects onto the renderer. Call after DrawWorld()
    /// but before DrawSidebar(). Text is drawn with a solid background so it
    /// is always readable regardless of tile color.
    /// </summary>
    public void Draw(AsciiRenderer r, int ox, int oy, int mapW, int mapH)
    {
        // Tile flashes: overwrite bg of the cell at the target position
        foreach (var f in _flashes)
        {
            int sx = f.WorldX - ox;
            int sy = f.WorldY - oy;
            if (sx < 0 || sy < 0 || sx >= mapW || sy >= mapH) continue;
            r.OverrideBg(sx, sy, f.Bg);
        }

        // Floating text: show 1 row ABOVE the target tile, centered horizontally.
        // If too close to top edge, show on the tile itself instead.
        foreach (var t in _texts)
        {
            int cx = t.WorldX - ox;
            int cy = t.WorldY - oy;

            // Center the text label on the target column
            int sx = cx - t.Text.Length / 2;
            // Prefer one row above; fall back to one row below if at top
            int sy = cy > 0 ? cy - 1 : cy + 1;

            // Clamp horizontally to map area
            if (sx < 0) sx = 0;
            if (sx + t.Text.Length > mapW) sx = mapW - t.Text.Length;
            if (sy < 0 || sy >= mapH) continue;

            r.PutString(sx, sy, t.Text, t.Fg, t.Bg);
        }
    }
}
