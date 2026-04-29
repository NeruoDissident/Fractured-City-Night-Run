using Nightrun.Content;
using Nightrun.Core;
using Nightrun.World;

namespace Nightrun.WorldGen;

/// <summary>
/// Stamps an oriented BuildingPrefab onto a chunk at the given origin, spawning
/// Door and Furniture WorldObjects, and placing loot into pockets + on floors.
///
/// The prefab layout uses a small character vocabulary:
///   #  exterior wall
///   |  interior wall (vertical)
///   -  interior wall (horizontal)
///   .  floor
///   +  exterior door
///   d  interior door (always unlocked)
///   _  open floor next to a door (not currently emitted, treated as floor)
///   <  stairs up
///   >  stairs down
///   ~  "skip" — leave the underlying tile as-is
/// </summary>
public sealed class PrefabPlacer
{
    /// <summary>
    /// Place <paramref name="prefab"/> into <paramref name="chunk"/> at local origin (ox, oy, oz).
    /// Returns true on success. Caller is responsible for passing an oriented prefab.
    /// </summary>
    public bool Place(Chunk chunk, BuildingPrefab prefab, int ox, int oy, int oz, RNG rng)
    {
        if (ox < 0 || oy < 0) return false;
        if (ox + prefab.Width > Chunk.Size) return false;
        if (oy + prefab.Height > Chunk.Size) return false;

        var (extDoor, intDoor) = DoorCatalog.ForBiome(chunk.Biome);

        // Wall/floor materials by biome.
        var wallExt = chunk.Biome switch
        {
            Biome.UrbanCore        => TileType.ConcreteWall,
            Biome.Industrial       => TileType.MetalWall,
            Biome.RichNeighborhood => TileType.BrickWall,
            Biome.Ruins            => TileType.BrickWall,
            _                      => TileType.WoodWall,
        };
        var wallInt = TileType.WoodWall;   // interior walls are always drywall/wood
        var floor = chunk.Biome switch
        {
            Biome.UrbanCore or Biome.RichNeighborhood => TileType.TileFloor,
            Biome.Industrial => TileType.Floor,
            _                => TileType.WoodFloor,
        };

        // First pass: tiles + door objects
        for (int ly = 0; ly < prefab.Height; ly++)
        {
            var row = prefab.Layout[ly];
            for (int lx = 0; lx < prefab.Width; lx++)
            {
                char ch = lx < row.Length ? row[lx] : ' ';
                int wx = ox + lx;
                int wy = oy + ly;

                switch (ch)
                {
                    case '~':
                        // skip — leave existing tile
                        break;

                    case '#':
                        chunk.SetTile(wx, wy, oz, wallExt);
                        break;

                    case '|':
                    case '-':
                        chunk.SetTile(wx, wy, oz, wallInt);
                        break;

                    case '.':
                    case '_':
                        chunk.SetTile(wx, wy, oz, floor);
                        break;

                    case '<':
                        chunk.SetTile(wx, wy, oz, TileType.StairsUp);
                        break;

                    case '>':
                        chunk.SetTile(wx, wy, oz, TileType.StairsDown);
                        break;

                    case '+':
                    {
                        chunk.SetTile(wx, wy, oz, floor);
                        bool locked = rng.Chance(prefab.LockChance);
                        var door = Door.Create(extDoor, wx, wy, oz, exterior: true, locked: locked);
                        // Put the DoorClosed tile under the door first so flags are set.
                        chunk.SetTile(wx, wy, oz, TileType.DoorClosed);
                        chunk.AddObject(door);
                        break;
                    }

                    case 'd':
                    {
                        chunk.SetTile(wx, wy, oz, floor);
                        var door = Door.Create(intDoor, wx, wy, oz, exterior: false, locked: false);
                        chunk.SetTile(wx, wy, oz, TileType.DoorClosed);
                        chunk.AddObject(door);
                        break;
                    }

                    default:
                        // ' ' or unexpected — fall through to floor
                        chunk.SetTile(wx, wy, oz, floor);
                        break;
                }
            }
        }

        // Build a fast (lx, ly) → roomType lookup from loot zones
        var roomAt = new string?[prefab.Width * prefab.Height];
        foreach (var z in prefab.LootZones)
        {
            for (int dy = 0; dy < z.H; dy++)
            {
                int ly = z.Y + dy;
                if (ly < 0 || ly >= prefab.Height) continue;
                for (int dx = 0; dx < z.W; dx++)
                {
                    int lx = z.X + dx;
                    if (lx < 0 || lx >= prefab.Width) continue;
                    roomAt[ly * prefab.Width + lx] = z.RoomType;
                }
            }
        }

        // Second pass: furniture — skip any whose tile is a wall/door
        foreach (var fs in prefab.FurnitureSpawns)
        {
            int wx = ox + fs.X;
            int wy = oy + fs.Y;
            var t = chunk.GetTile(wx, wy, oz);
            if (t.IsWall || t.IsDoor) continue;

            var furn = Furniture.Create(fs.Kind, wx, wy, oz);
            chunk.AddObject(furn);

            // Pre-populate storage furniture based on the room it sits in
            if (furn.IsContainer)
            {
                var rt = fs.Y >= 0 && fs.Y < prefab.Height && fs.X >= 0 && fs.X < prefab.Width
                    ? roomAt[fs.Y * prefab.Width + fs.X] : null;
                if (rt != null) FurnitureLoot.Populate(furn, rt, rng);
            }
        }

        // Third pass: scatter per-floor loot in each room
        foreach (var z in prefab.LootZones)
        {
            if (!LootTables.Rooms.TryGetValue(z.RoomType, out var table)) continue;

            // Collect eligible floor tiles for this zone
            var tiles = new List<(int wx, int wy)>(z.W * z.H);
            for (int dy = 0; dy < z.H; dy++)
            for (int dx = 0; dx < z.W; dx++)
            {
                int wx = ox + z.X + dx;
                int wy = oy + z.Y + dy;
                var t = chunk.GetTile(wx, wy, oz);
                // Don't drop items on walls, doors, or tiles occupied by furniture
                if (t.IsWall || t.IsDoor || t.IsBlocked) continue;
                if (t.ObjectId != 0) continue;
                tiles.Add((wx, wy));
            }

            // Shuffle so item placement is not always top-left biased
            for (int i = tiles.Count - 1; i > 0; i--)
            {
                int j = rng.Range(0, i + 1);
                (tiles[i], tiles[j]) = (tiles[j], tiles[i]);
            }

            int placed = 0;
            foreach (var (tx, ty) in tiles)
            {
                if (placed >= table.MaxItems) break;
                if (!rng.Chance(table.SpawnChance)) continue;
                var item = LootTables.Roll(table, rng);
                if (item == null) continue;
                chunk.AddItem(tx, ty, oz, item);
                placed++;
            }
        }

        return true;
    }
}
