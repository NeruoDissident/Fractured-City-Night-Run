namespace Nightrun.Rendering;

/// <summary>
/// Renderer abstraction. All screens and UI helpers depend on this interface
/// rather than <see cref="AsciiRenderer"/> directly, so the console back-end
/// can be swapped for a Unity sprite renderer (or any other target) without
/// touching game logic.
///
/// Contract:
///   1. Call <see cref="BeginFrame"/> once at the start of each render pass.
///   2. Call <see cref="Put"/> / <see cref="PutString"/> to write cells.
///   3. Call <see cref="Present"/> to flush the frame to the display.
///
/// Coordinates are screen-space (column, row), zero-indexed from top-left.
/// Colors are 256-color ANSI palette indices for the console back-end;
/// a Unity implementation maps them to palette <c>Color</c> assets.
/// </summary>
public interface IRenderer
{
    /// <summary>Total screen width in cells.</summary>
    int Width  { get; }

    /// <summary>Total screen height in cells.</summary>
    int Height { get; }

    /// <summary>
    /// Width of the playfield area (total width minus any reserved sidebar/HUD).
    /// </summary>
    int MapWidth  { get; }

    /// <summary>Height of the playfield area.</summary>
    int MapHeight { get; }

    /// <summary>
    /// Clear the back buffer and prepare for a new frame.
    /// Must be called before any <see cref="Put"/> calls each tick.
    /// </summary>
    void BeginFrame();

    /// <summary>Write a single cell to the back buffer.</summary>
    /// <param name="sx">Screen column (0-indexed).</param>
    /// <param name="sy">Screen row (0-indexed).</param>
    /// <param name="glyph">Character to display.</param>
    /// <param name="fg">Foreground color (256-color index).</param>
    /// <param name="bg">Background color (256-color index).</param>
    void Put(int sx, int sy, char glyph, byte fg, byte bg);

    /// <summary>Write a string of cells to the back buffer, left to right.</summary>
    /// <param name="sx">Starting screen column.</param>
    /// <param name="sy">Screen row.</param>
    /// <param name="s">String to write.</param>
    /// <param name="fg">Foreground color (256-color index).</param>
    /// <param name="bg">Background color (256-color index).</param>
    void PutString(int sx, int sy, string s, byte fg = 250, byte bg = 0);

    /// <summary>
    /// Flush the back buffer to the display. For the console back-end this
    /// performs a diff against the previous frame and writes only changed cells.
    /// </summary>
    void Present();
}
