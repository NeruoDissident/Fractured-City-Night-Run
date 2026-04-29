namespace Nightrun.Rendering;

/// <summary>
/// Maps between world coordinates and screen coordinates.
/// Centered on a target (usually the player).
/// </summary>
public sealed class Camera
{
    public int Width;
    public int Height;
    public int TargetX;
    public int TargetY;

    public Camera(int width, int height)
    {
        Width = width;
        Height = height;
    }

    public int OriginX => TargetX - Width / 2;
    public int OriginY => TargetY - Height / 2;

    public (int worldX, int worldY) ScreenToWorld(int sx, int sy)
        => (OriginX + sx, OriginY + sy);
}
