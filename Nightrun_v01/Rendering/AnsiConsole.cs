using System.Runtime.InteropServices;
using System.Text;

namespace Nightrun.Rendering;

/// <summary>
/// Low-level console helpers for ANSI escape sequences.
/// Enables VT processing on Windows (no-op elsewhere) so 256-color output
/// works in both cmd.exe and modern terminals.
/// </summary>
public static class AnsiConsole
{
    public const string Reset  = "\x1b[0m";
    public const string Hide   = "\x1b[?25l";
    public const string Show   = "\x1b[?25h";
    public const string Clear  = "\x1b[2J\x1b[H";

    public static string Home => "\x1b[H";
    public static string MoveTo(int x, int y) => $"\x1b[{y + 1};{x + 1}H";
    public static string Fg(byte c) => $"\x1b[38;5;{c}m";
    public static string Bg(byte c) => $"\x1b[48;5;{c}m";
    public static string Fg(byte c, StringBuilder sb) { sb.Append("\x1b[38;5;").Append(c).Append('m'); return ""; }

    public static void EnableAnsi()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;
        try
        {
            var handle = GetStdHandle(-11);
            if (handle == IntPtr.Zero || handle == new IntPtr(-1)) return;
            if (!GetConsoleMode(handle, out uint mode)) return;
            SetConsoleMode(handle, mode | 0x0004 /* ENABLE_VIRTUAL_TERMINAL_PROCESSING */);
        }
        catch { /* best-effort */ }
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetConsoleMode(IntPtr handle, out uint mode);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetConsoleMode(IntPtr handle, uint mode);
}
