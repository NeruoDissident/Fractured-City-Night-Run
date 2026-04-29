namespace Nightrun.Systems;

public enum GameAction
{
    None,
    MoveN, MoveNE, MoveE, MoveSE, MoveS, MoveSW, MoveW, MoveNW,
    ExitZone,
    Wait,
    Interact,     // open door / pick up item / search furniture / use stairs
    Ascend,       // '<'
    Descend,      // '>'
    OpenInventory,
    OpenCharacter,
    OpenCrafting,
    OpenTalents,
    OpenAbilities,
    Drop,
    Equip,
    UnequipHands,
    Use,
    Attack,       // explicit attack — auto-targets adjacent hostile
    ObjectMenu,   // open world-object action menu for adjacent furniture/doors
    Inspect,      // enter free-cursor inspect mode
    Regenerate,   // debug: re-seed world
    ToggleOverlay,// debug: show biome map
    NewRun,       // restart: full chargen + new world
    Quit,
    // Menu navigation (used when a modal screen is open)
    MenuUp, MenuDown, MenuLeft, MenuRight,
    MenuConfirm, MenuCancel,
    MenuLetter,   // placeholder — actual letter comes in via separate channel
}

public static class InputSystem
{
    /// <summary>Raw key read — menus use this and translate per-mode.</summary>
    public static ConsoleKeyInfo ReadKey() => Console.ReadKey(intercept: true);

    /// <summary>
    /// Translates a raw ConsoleKey into a semantic game action for play mode.
    /// Supports arrow keys, WASD, numpad (including diagonals), and vi keys.
    /// </summary>
    public static GameAction Read()
    {
        var info = Console.ReadKey(intercept: true);

        // Check modifier combos first
        if ((info.Modifiers & ConsoleModifiers.Control) != 0 && info.Key == ConsoleKey.C)
            return GameAction.Quit;

        // Character-level checks (handle shift-combos like < and >)
        switch (info.KeyChar)
        {
            case '<': return GameAction.Ascend;
            case '>': return GameAction.Descend;
        }

        return info.Key switch
        {
            // Cardinal — arrows, WASD, numpad, vi
            ConsoleKey.UpArrow    or ConsoleKey.W or ConsoleKey.NumPad8 or ConsoleKey.K => GameAction.MoveN,
            ConsoleKey.DownArrow  or ConsoleKey.S or ConsoleKey.NumPad2 or ConsoleKey.J => GameAction.MoveS,
            ConsoleKey.LeftArrow  or ConsoleKey.A or ConsoleKey.NumPad4 or ConsoleKey.H => GameAction.MoveW,
            ConsoleKey.RightArrow or ConsoleKey.D or ConsoleKey.NumPad6              => GameAction.MoveE,
            ConsoleKey.L => GameAction.Inspect,

            // Diagonals — numpad + vi
            ConsoleKey.NumPad7 or ConsoleKey.Y => GameAction.MoveNW,
            ConsoleKey.NumPad9 or ConsoleKey.U => GameAction.MoveNE,
            ConsoleKey.NumPad1 or ConsoleKey.B => GameAction.MoveSW,
            ConsoleKey.NumPad3 or ConsoleKey.N => GameAction.MoveSE,

            ConsoleKey.NumPad5 or ConsoleKey.Spacebar or ConsoleKey.OemPeriod => GameAction.Wait,
            ConsoleKey.E or ConsoleKey.Enter => GameAction.Interact,

            ConsoleKey.I => GameAction.OpenInventory,
            ConsoleKey.C => GameAction.OpenCharacter,
            ConsoleKey.X => GameAction.OpenCrafting,
            ConsoleKey.T => GameAction.OpenTalents,
            ConsoleKey.Q => GameAction.OpenAbilities,
            ConsoleKey.F => GameAction.Attack,
            ConsoleKey.Z => GameAction.ObjectMenu,

            ConsoleKey.Escape => GameAction.Quit,
            ConsoleKey.Tab => GameAction.ExitZone,
            ConsoleKey.F5 => GameAction.Regenerate,
            ConsoleKey.F2 => GameAction.NewRun,
            ConsoleKey.M  => GameAction.ToggleOverlay,

            _ => GameAction.None,
        };
    }

    public static (int dx, int dy) ActionToDelta(GameAction a) => a switch
    {
        GameAction.MoveN  => ( 0, -1),
        GameAction.MoveNE => ( 1, -1),
        GameAction.MoveE  => ( 1,  0),
        GameAction.MoveSE => ( 1,  1),
        GameAction.MoveS  => ( 0,  1),
        GameAction.MoveSW => (-1,  1),
        GameAction.MoveW  => (-1,  0),
        GameAction.MoveNW => (-1, -1),
        _                 => ( 0,  0),
    };
}
