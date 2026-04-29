using Nightrun.Core;

namespace Nightrun;

public static class Program
{
    public static void Main(string[] args)
    {
        // Parse optional seed from args
        uint seed = 12345;
        if (args.Length > 0 && uint.TryParse(args[0], out var parsed))
            seed = parsed;

        Console.Title = "Nightrun v0.1";
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.CursorVisible = false;

        try
        {
            var game = new Game(seed);
            game.Run();
        }
        catch (Exception ex)
        {
            Console.CursorVisible = true;
            Console.ResetColor();
            Console.Clear();

            // Write full details to crash.log next to the executable
            string logPath = Path.Combine(AppContext.BaseDirectory, "crash.log");
            string report  = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}]\n{ex}\n";
            File.WriteAllText(logPath, report);

            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("=== CRASH ===");
            Console.ResetColor();
            Console.WriteLine(ex.Message);
            Console.WriteLine();
            Console.WriteLine($"Full details written to: {logPath}");
            Console.WriteLine();
            Console.WriteLine("Press any key to exit...");
            Console.ReadKey(intercept: true);
        }
        finally
        {
            Console.CursorVisible = true;
            Console.ResetColor();
        }
    }
}
