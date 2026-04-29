using Nightrun.Content;
using Nightrun.Entities;

namespace Nightrun.World;

/// <summary>
/// The only contract that game systems need from the world layer.
/// Implemented by <see cref="WorldManager"/> (infinite chunk world) and
/// <see cref="ZoneManager"/> (bounded zone map). Systems and Game.cs hold
/// an <see cref="IWorldMap"/> so the zone swap is transparent.
/// </summary>
public interface IWorldMap
{
    // ── Tile access ────────────────────────────────────────────────────
    Tile    GetTile(int x, int y, int z);
    void    SetTile(int x, int y, int z, Tile tile);
    ref Tile RefTile(int x, int y, int z);

    // ── World objects (doors, furniture) ──────────────────────────────
    WorldObject? GetObjectAt(int x, int y, int z);

    // ── Items ─────────────────────────────────────────────────────────
    IReadOnlyList<Item>? GetItemsAt(int x, int y, int z);
    void RemoveItemAt(int x, int y, int z, Item item);
    void AddItemAt(int x, int y, int z, Item item);

    // ── NPC registry ──────────────────────────────────────────────────
    IReadOnlyList<Npc> Npcs { get; }
    void AddNpc(Npc n);
    bool RemoveNpc(Npc n);
    Npc? GetNpcAt(int x, int y, int z);
    int  SweepDead();

    // ── Dimensions ────────────────────────────────────────────────────
    int Width  { get; }
    int Height { get; }

    // ── Z bounds ──────────────────────────────────────────────────────
    int MinZ { get; }
    int MaxZ { get; }

    // ── Spawn helper ──────────────────────────────────────────────────
    (int x, int y) FindSpawn();
}
