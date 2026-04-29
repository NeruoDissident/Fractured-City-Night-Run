using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.World;

namespace Nightrun.Systems;

/// <summary>
/// Outcome of a world-object action. <see cref="TimeCost"/> is how many turns
/// the caller should tick; <see cref="Destroyed"/> is true when the object
/// was reduced to 0 HP (smash/disassemble).
/// </summary>
public readonly struct WorldObjectResult
{
    public readonly bool   Success;
    public readonly string Message;
    public readonly int    TimeCost;
    public readonly bool   Destroyed;
    public readonly int    NoiseVolume;
    public readonly int    NoiseRange;

    public WorldObjectResult(bool success, string message, int timeCost = 0,
                             bool destroyed = false,
                             int noiseVolume = 0, int noiseRange = 0)
    {
        Success = success; Message = message; TimeCost = timeCost;
        Destroyed = destroyed; NoiseVolume = noiseVolume; NoiseRange = noiseRange;
    }

    public static WorldObjectResult Fail(string msg) => new(false, msg);
}

/// <summary>
/// Port of <c>src/systems/WorldObjectSystem.js</c> — the "core" subset:
/// peek, knock, smash (with material drops), and careful disassembly of
/// adjacent world objects. Lockpick / barricade are stubbed for later.
/// Noise generation returns a (volume,range) pair in the result so the
/// future <see cref="SoundSystem"/> can consume it without this class having
/// to depend on it yet.
/// </summary>
public sealed class WorldObjectSystem
{
    private readonly IWorldMap _world;
    private readonly Random _rng;
    private readonly Action<string> _log;

    public WorldObjectSystem(IWorldMap world, Random rng, Action<string> log)
    {
        _world = world; _rng = rng; _log = log;
    }

    // ------------------------------------------------------------------
    // Peek / Knock — both are closed-door-only and cheap.

    public WorldObjectResult Peek(Door door, Player player)
    {
        if (door.IsDestroyed) return WorldObjectResult.Fail($"The {door.Name.ToLower()} is gone.");
        if (door.Open)        return WorldObjectResult.Fail($"The {door.Name.ToLower()} is already open.");

        // Reveal one tile on the far side.
        int dx = Math.Sign(door.X - player.X);
        int dy = Math.Sign(door.Y - player.Y);
        int px = door.X + dx;
        int py = door.Y + dy;
        var tile = _world.GetTile(px, py, door.Z);
        var def  = TileCatalog.Get(tile.Type);

        string what = def.Name;
        var obj = _world.GetObjectAt(px, py, door.Z);
        if (obj != null) what = obj.Name.ToLower();
        else
        {
            var items = _world.GetItemsAt(px, py, door.Z);
            if (items != null && items.Count > 0) what = items[items.Count - 1].Name.ToLower();
            var npc = _world.GetNpcAt(px, py, door.Z);
            if (npc != null && !npc.IsDead) what = npc.Name.ToLower();
        }

        return new WorldObjectResult(
            success: true,
            message: $"You peek through the {door.Name.ToLower()}. You see: {what}.",
            timeCost: 1);
    }

    public WorldObjectResult Knock(Door door, Player player)
    {
        if (door.IsDestroyed) return WorldObjectResult.Fail($"The {door.Name.ToLower()} is gone.");
        if (door.Open)        return WorldObjectResult.Fail($"The {door.Name.ToLower()} is already open.");

        return new WorldObjectResult(
            success: true,
            message: $"You knock on the {door.Name.ToLower()}.",
            timeCost: 1,
            noiseVolume: 15,
            noiseRange: 10);
    }

    // ------------------------------------------------------------------
    // Smash — loops hits until destroyed or the weapon breaks. Damage per
    // hit is the average of the weapon's dice (or a small fallback for
    // unarmed kicking against weak materials). Port of
    // WorldObjectSystem.smashObject.

    public WorldObjectResult Smash(WorldObject obj, Player player)
    {
        if (obj.IsDestroyed)
            return WorldObjectResult.Fail($"The {obj.Name.ToLower()} is already destroyed.");

        var weapon = player.Equipment.RHand ?? player.Equipment.LHand;
        bool kicking = false;
        string weaponName;
        int baseDamage;
        List<string> weaponTags;

        if (weapon == null)
        {
            // Only weak materials can be kicked.
            if (obj.Material != "wood" && obj.Material != "glass")
                return WorldObjectResult.Fail(
                    "You need a weapon or tool to smash this. It's too strong to kick.");
            kicking     = true;
            weaponName  = "kick";
            baseDamage  = 8;
            weaponTags  = new List<string> { "blunt" };
        }
        else
        {
            weaponName = weapon.Name;
            baseDamage = AverageDice(weapon.DamageDice) + (weapon.AttackType == "blunt" ? 1 : 0);
            if (baseDamage < 1) baseDamage = 5;
            weaponTags = weapon.Tags;
        }

        double matMod      = GetMaterialModifier(obj.Material, weaponTags);
        int    damagePerHit = Math.Max(1, (int)(baseDamage * matMod));
        int    timePerHit   = Math.Max(2, (int)Math.Ceiling(5 - baseDamage / 10.0));

        int hits = 0, totalTime = 0;
        bool destroyed = false, weaponBroke = false, lockBroke = false;

        while (!destroyed)
        {
            obj.TakeDamage(damagePerHit);
            hits++;
            totalTime += timePerHit;

            if (!kicking && weapon != null)
            {
                weapon.Durability = Math.Max(0, weapon.Durability - 2);
                if (weapon.Durability <= 0) weaponBroke = true;
            }

            // Lock breaks at 30% HP — auto-unlocks the door.
            if (!lockBroke && obj is Door d && d.Locked && obj.HP < obj.MaxHP * 0.3)
            {
                d.Locked = false;
                lockBroke = true;
            }

            if (obj.IsDestroyed) { destroyed = true; break; }
            if (weaponBroke) break;
        }

        string verb = kicking ? "kick" : "smash";
        string message;
        if (destroyed)
        {
            message = kicking
                ? $"You kick apart the {obj.Name.ToLower()} in {hits} hit{(hits > 1 ? "s" : "")} ({totalTime} turns)."
                : $"You smash the {obj.Name.ToLower()} to pieces with your {weaponName} in {hits} hit{(hits > 1 ? "s" : "")} ({totalTime} turns).";

            ApplyDestruction(obj);
            var mats = RollDropTable(DropTableCatalog.For(obj), yieldMod: 0.5);
            int dropped = DropMaterials(mats, obj.X, obj.Y, obj.Z, player);
            if (dropped > 0) message += " Some materials scatter on the ground.";

            int spilled = SpillContents(obj);
            if (spilled > 0) message += $" {spilled} item(s) spill out onto the ground.";
        }
        else
        {
            message = kicking
                ? $"You kick the {obj.Name.ToLower()} {hits} time{(hits > 1 ? "s" : "")} ({totalTime} turns)."
                : $"You {verb} the {obj.Name.ToLower()} {hits} time{(hits > 1 ? "s" : "")} but your {weaponName} broke!";
            message += $" ({obj.HP}/{obj.MaxHP} HP remaining)";
        }

        if (lockBroke) _log($"The lock on the {obj.Name.ToLower()} breaks!");
        if (weaponBroke) _log($"Your {weaponName} broke!");

        return new WorldObjectResult(
            success: true,
            message: message,
            timeCost: totalTime,
            destroyed: destroyed,
            noiseVolume: 30,
            noiseRange: 20);
    }

    // ------------------------------------------------------------------
    // Disassemble — requires the right tool, grants full yield.

    public WorldObjectResult Disassemble(WorldObject obj, Player player)
    {
        if (obj.IsDestroyed)
            return WorldObjectResult.Fail($"The {obj.Name.ToLower()} is already destroyed.");

        var table = DropTableCatalog.For(obj);
        if (table == null || table.DisassembleTool == null)
            return WorldObjectResult.Fail("This can't be taken apart.");

        var tool = FindTool(player, table.DisassembleTool);
        if (tool == null)
            return WorldObjectResult.Fail($"You need a {table.DisassembleTool} to disassemble this.");

        if (obj is Door door && !door.Open)
            return WorldObjectResult.Fail($"You must open the {obj.Name.ToLower()} first.");

        int timeCost = Math.Max(5, (int)Math.Ceiling(obj.MaxHP / 10.0));
        var mats = RollDropTable(table, yieldMod: 1.0);

        obj.HP = 0;
        ApplyDestruction(obj);

        int dropped = DropMaterials(mats, obj.X, obj.Y, obj.Z, player);
        int spilled = SpillContents(obj);

        tool.Durability = Math.Max(0, tool.Durability - 1);

        string spillMsg = spilled > 0 ? $" {spilled} stored item(s) dropped on the ground." : "";
        string gotMsg   = dropped > 0 ? $" ({dropped} materials recovered)"                 : "";

        return new WorldObjectResult(
            success: true,
            message: $"You carefully disassemble the {obj.Name.ToLower()}.{gotMsg}{spillMsg}",
            timeCost: timeCost,
            destroyed: true);
    }

    // ------------------------------------------------------------------
    // Helpers

    /// <summary>Sync the object's tile after destruction so the renderer
    /// shows the new state (open broken door / empty floor).</summary>
    private void ApplyDestruction(WorldObject obj)
    {
        if (obj is Door d)
        {
            ref var tile = ref _world.RefTile(d.X, d.Y, d.Z);
            d.UpdateVisuals(ref tile);
            return;
        }

        if (obj is Furniture f)
        {
            // Clear the tile's object reference and drop back to whatever
            // floor tile the chunk generator painted underneath.
            ref var tile = ref _world.RefTile(f.X, f.Y, f.Z);
            tile.ObjectId = 0;
            // Tile type stays as it was (floor / sidewalk / whatever).
            // Blocking is now gone since ObjectId == 0.
        }
    }

    /// <summary>Spill all stored items from a container onto the ground tile
    /// and clear its pockets. Returns the count dropped. No-op for non-
    /// container objects.</summary>
    private int SpillContents(WorldObject obj)
    {
        if (obj is not Furniture f || !f.IsContainer) return 0;
        int spilled = 0;
        foreach (var pocket in f.Pockets)
        {
            // Copy out before mutating.
            var items = pocket.Contents.ToArray();
            foreach (var it in items)
            {
                pocket.Remove(it);
                _world.AddItemAt(f.X, f.Y, f.Z, it);
                spilled++;
            }
        }
        return spilled;
    }

    private List<(string Name, int Qty, int Qual)> RollDropTable(DropTable? table, double yieldMod)
    {
        var result = new List<(string, int, int)>();
        if (table == null) return result;
        foreach (var m in table.Materials)
        {
            int qty  = _rng.Next(m.MinQ, m.MaxQ + 1);
            int qual = _rng.Next(m.MinQual, m.MaxQual + 1);
            int actualQty = Math.Max(1, (int)(qty * yieldMod));
            result.Add((m.Name, actualQty, (int)(qual * yieldMod)));
        }
        return result;
    }

    /// <summary>
    /// Convert rolled materials into <see cref="Item"/>s, try to stuff them
    /// into the player's inventory, and drop the remainder on the ground.
    /// Returns the number of unique entries that were produced (0 if the
    /// table yielded nothing).
    /// </summary>
    private int DropMaterials(
        List<(string Name, int Qty, int Qual)> mats,
        int x, int y, int z, Player player)
    {
        int produced = 0;
        foreach (var (name, qty, qual) in mats)
        {
            var id = DropNameMap.FamilyIdFor(name);
            Item? item = id != null ? ItemCatalog.Create(id) : null;
            if (item == null)
            {
                // Unknown drop entry — create a bare stackable component so
                // the material still drops instead of being silently lost.
                item = new Item
                {
                    FamilyId = name.ToLowerInvariant().Replace(' ', '_'),
                    Name     = name,
                    Category = "component",
                    Glyph    = '*',
                    Fg       = 214,
                    Weight   = qty * 10,
                    IsComponent = true,
                };
                item.Tags.Add("material");
                item.Tags.Add("salvage");
            }

            item.Quantity = qty;
            if (qual > 0) { item.Durability = Math.Min(item.MaxDurability, qual); }

            // Try player inventory first, fall back to the ground tile.
            var fit = player.Inventory.FindFit(item);
            if (fit != null && fit.TryAdd(item))
                _log($"Recovered {name} x{qty}.");
            else
            {
                _world.AddItemAt(x, y, z, item);
                _log($"{name} x{qty} drops on the ground.");
            }
            produced++;
        }
        return produced;
    }

    /// <summary>
    /// Blunt weapons are good against wood, bad against metal, great against
    /// glass. Sharp weapons are decent across the board. Identical to the
    /// JS table in WorldObjectSystem.getMaterialModifier.
    /// </summary>
    private static double GetMaterialModifier(string material, IReadOnlyList<string> tags)
    {
        bool blunt = tags.Contains("blunt");
        bool sharp = tags.Contains("sharp");

        if (blunt)
        {
            if (material == "wood")  return 1.5;
            if (material == "metal") return 0.5;
            if (material == "glass") return 2.0;
        }
        if (sharp)
        {
            if (material == "wood")  return 1.2;
            if (material == "metal") return 0.7;
            if (material == "glass") return 1.5;
        }
        return 1.0;
    }

    /// <summary>"1d6+2" → average 5. Returns 0 on null/empty.</summary>
    private static int AverageDice(string? dice)
    {
        if (string.IsNullOrEmpty(dice)) return 0;
        int plus = 0;
        string s = dice;
        int pi = s.IndexOfAny(new[] { '+', '-' });
        if (pi > 0)
        {
            plus = int.Parse(s.Substring(pi));
            s = s.Substring(0, pi);
        }
        var parts = s.Split('d');
        if (parts.Length != 2) return plus;
        if (!int.TryParse(parts[0], out int n)) return plus;
        if (!int.TryParse(parts[1], out int f)) return plus;
        // Average of n dN = n * (f+1) / 2, rounded up.
        return (int)Math.Ceiling(n * (f + 1) / 2.0) + plus;
    }

    /// <summary>
    /// Scan equipment and then every pocket reachable from the player for
    /// the first item that matches <paramref name="toolTag"/>. Uses the same
    /// alias groups as JS WorldObjectSystem.isToolType.
    /// </summary>
    private static Item? FindTool(Player player, string toolTag)
    {
        string[] aliases = toolTag switch
        {
            "screwdriver" => new[] { "screwdriver", "multitool" },
            "crowbar"     => new[] { "crowbar", "prybar" },
            "hacksaw"     => new[] { "hacksaw", "saw" },
            "lockpick"    => new[] { "lockpick", "lockpick_set" },
            _             => new[] { toolTag },
        };

        bool Matches(Item it) => aliases.Any(a => it.HasTag(a) || it.FamilyId == a);

        foreach (var it in player.Inventory.EnumerateReachableItems())
            if (Matches(it)) return it;
        return null;
    }
}
