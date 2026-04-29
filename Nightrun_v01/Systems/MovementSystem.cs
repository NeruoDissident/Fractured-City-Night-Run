using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.World;

namespace Nightrun.Systems;

/// <summary>
/// Handles entity movement and tile interactions.
/// Returns a short status string for the message log.
/// </summary>
public sealed class MovementSystem
{
    private readonly IWorldMap _world;

    public MovementSystem(IWorldMap world) { _world = world; }

    /// <summary>
    /// Attempt to move the entity by (dx, dy). If the destination is a closed
    /// door, bump-open it instead of moving. Returns a description of the action.
    /// </summary>
    public string TryMove(Entity e, int dx, int dy)
    {
        int nx = e.X + dx;
        int ny = e.Y + dy;
        var t = _world.GetTile(nx, ny, e.Z);

        // Bump-open doors
        if (t.Type == TileType.DoorClosed)
        {
            if (_world.GetObjectAt(nx, ny, e.Z) is Door door)
            {
                if (door.Barricaded) return $"The {door.Name} is barricaded.";
                if (door.Locked)     return $"The {door.Name} is locked.";
                door.Open = true;
                ref var tile = ref _world.RefTile(nx, ny, e.Z);
                door.UpdateVisuals(ref tile);
                return $"You open the {door.Name.ToLower()}.";
            }
            // Fallback: plain tile swap (shouldn't happen after prefabs)
            _world.SetTile(nx, ny, e.Z, new Tile(TileType.DoorOpen));
            return "You open the door.";
        }

        if (t.IsBlocked) return "Blocked.";
        if (t.IsWater)   return "The water is too deep.";

        // Entity collision — other NPCs block the tile. Bump-to-attack
        // is resolved by the caller before we get here (Game.cs), so if
        // we see an NPC here it means the player is trying to walk into
        // a neutral or unknown actor.
        var npc = _world.GetNpcAt(nx, ny, e.Z);
        if (npc != null && !npc.IsDead && npc != e)
            return $"The {npc.Name} is in the way.";

        e.X = nx;
        e.Y = ny;

        // Report what you're standing on
        var items = _world.GetItemsAt(e.X, e.Y, e.Z);
        if (items != null && items.Count > 0)
        {
            if (items.Count == 1) return $"You see a {items[0].Name} here.";
            return $"You see {items.Count} items here.";
        }
        return "";
    }

    /// <summary>
    /// Interact with the tile under the entity. Priority order:
    ///   1. Grab the top item on the ground (routes into inventory)
    ///   2. Open an adjacent storage furniture as a container dialog
    ///   3. Close an open door beneath the entity
    ///   4. Use stairs / manhole / ladder
    /// </summary>
    public InteractResult Interact(Entity e)
    {
        // Pick up an item into the entity's inventory
        var items = _world.GetItemsAt(e.X, e.Y, e.Z);
        if (items != null && items.Count > 0)
        {
            var top = items[items.Count - 1];
            double cm = e is Nightrun.Entities.Player pl ? pl.CarryMod : 1.0;
            var fit = e.Inventory.FindFit(top, cm);
            if (fit == null)
            {
                return InteractResult.None($"No room for the {top.Name}.");
            }
            _world.RemoveItemAt(e.X, e.Y, e.Z, top);
            fit.TryAdd(top);
            return InteractResult.Did($"You pick up the {top.Name}.");
        }

        // Adjacent storage furniture — hand it back to the UI to open
        for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++)
        {
            if (dx == 0 && dy == 0) continue;
            if (_world.GetObjectAt(e.X + dx, e.Y + dy, e.Z) is Furniture furn && furn.IsContainer)
            {
                furn.Searched = true;
                return InteractResult.Open(furn, $"You search the {furn.Name.ToLower()}...");
            }
        }

        var t = _world.GetTile(e.X, e.Y, e.Z);

        // Close an open door beneath us
        if (t.Type == TileType.DoorOpen)
        {
            if (_world.GetObjectAt(e.X, e.Y, e.Z) is Door door)
            {
                door.Open = false;
                ref var tile = ref _world.RefTile(e.X, e.Y, e.Z);
                door.UpdateVisuals(ref tile);
                return InteractResult.Did($"You close the {door.Name.ToLower()}.");
            }
            _world.SetTile(e.X, e.Y, e.Z, new Tile(TileType.DoorClosed));
            return InteractResult.Did("You close the door.");
        }

        if ((t.Flags & TileFlags.CanDescend) != 0) return InteractResult.Did(Descend(e));
        if ((t.Flags & TileFlags.CanAscend) != 0)  return InteractResult.Did(Ascend(e));
        return InteractResult.None("Nothing to do here.");
    }

    /// <summary>
    /// Drop an item from the entity's inventory at its feet, onto the ground.
    /// Returns false if the item can't be found in the inventory.
    /// </summary>
    public bool DropItem(Entity e, Item item, out string msg)
    {
        if (!e.Inventory.Remove(item))
        {
            msg = "You don't have that.";
            return false;
        }
        _world.AddItemAt(e.X, e.Y, e.Z, item);
        msg = $"You drop the {item.Name}.";
        return true;
    }

    public string Ascend(Entity e)
    {
        if (e.Z >= _world.MaxZ) return "You can't go up.";
        var here = _world.GetTile(e.X, e.Y, e.Z);
        if ((here.Flags & TileFlags.CanAscend) == 0) return "No way up here.";
        e.Z += 1;
        return $"You climb up. (z={e.Z})";
    }

    public string Descend(Entity e)
    {
        var here = _world.GetTile(e.X, e.Y, e.Z);
        if ((here.Flags & TileFlags.CanDescend) == 0) return "No way down here.";
        if (e.Z <= _world.MinZ) return "The way down is sealed shut.";
        e.Z -= 1;
        return e.Z < 0 ? $"You drop through the manhole. (z={e.Z})" : $"You descend. (z={e.Z})";
    }
}
