using Nightrun.Content;

namespace Nightrun.Systems;

/// <summary>
/// Outcome of an Interact action. Lets MovementSystem communicate "open this
/// container screen on Furniture X" back to Game without the system needing
/// to know anything about the UI.
/// </summary>
public readonly struct InteractResult
{
    public readonly string Message;
    public readonly Furniture? OpenContainer;
    public readonly bool ConsumedTurn;

    public InteractResult(string msg, Furniture? openContainer = null, bool consumedTurn = true)
    {
        Message = msg;
        OpenContainer = openContainer;
        ConsumedTurn = consumedTurn;
    }

    public static InteractResult None(string msg) => new(msg, null, false);
    public static InteractResult Did(string msg) => new(msg, null, true);
    public static InteractResult Open(Furniture f, string msg) => new(msg, f, false);
}
