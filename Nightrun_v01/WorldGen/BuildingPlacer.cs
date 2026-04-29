using Nightrun.Content;
using Nightrun.Core;
using Nightrun.World;

namespace Nightrun.WorldGen;

/// <summary>
/// Given a block and a biome, fills it with one or more buildings. Prefers
/// authored prefabs from <see cref="Prefabs"/> when a match exists for the
/// block's size + biome, otherwise falls back to simple rectangular buildings.
/// </summary>
public sealed class BuildingPlacer
{
    private readonly WorldManager _world;
    private readonly PrefabPlacer _prefab = new();

    public BuildingPlacer(WorldManager world) { _world = world; }

    public void FillBlock(Chunk chunk, Block block, List<RoadSegment> roads, RNG rng)
    {
        if (!chunk.Biome.HasBuildings()) return;
        if (block.W < 6 || block.H < 6) return; // too small for anything useful

        // Try prefab first — allow a small inner margin so buildings don't kiss sidewalks
        if (TryPlacePrefab(chunk, block, roads, rng)) return;

        switch (chunk.Biome)
        {
            case Biome.UrbanCore:        FillUrban(chunk, block, roads, rng); break;
            case Biome.Suburbs:          FillResidential(chunk, block, roads, rng); break;
            case Biome.RichNeighborhood: FillMansion(chunk, block, roads, rng); break;
            case Biome.Industrial:       FillIndustrial(chunk, block, roads, rng); break;
            case Biome.Rural:            FillRural(chunk, block, roads, rng); break;
            case Biome.Ruins:            FillRuins(chunk, block, roads, rng); break;
        }
    }

    /// <summary>
    /// Look for a prefab that fits the block (accounting for a 1-tile margin)
    /// and place it oriented so its door faces the nearest road.
    /// </summary>
    private bool TryPlacePrefab(Chunk chunk, Block block, List<RoadSegment> roads, RNG rng)
    {
        int availW = Math.Max(0, block.W - 2);
        int availH = Math.Max(0, block.H - 2);
        if (availW < 8 || availH < 6) return false; // not enough room for a meaningful prefab

        var prefab = Prefabs.FindMatching(availW, availH, chunk.Biome, rng);
        if (prefab == null) return false;

        var roadSide = FindRoadSide(block, roads);
        var side = (DoorSide)(int)roadSide;
        var oriented = Prefabs.Orient(prefab, side);

        // Center the prefab inside the block
        int ox = block.X + (block.W - oriented.Width) / 2;
        int oy = block.Y + (block.H - oriented.Height) / 2;
        if (ox < 0 || oy < 0) return false;
        if (ox + oriented.Width > Chunk.Size) return false;
        if (oy + oriented.Height > Chunk.Size) return false;

        return _prefab.Place(chunk, oriented, ox, oy, 0, rng);
    }

    // ---------------------------------------------------------------------
    // Biome-specific strategies — all currently use the same
    // "one big building per block" approach but with different materials.
    // The block-filling surface is where future prefab logic plugs in.

    private void FillUrban(Chunk c, Block b, List<RoadSegment> roads, RNG rng)
    {
        // Large building flush with the block, small setback on each side
        var (x, y, w, h) = Shrink(b, 1, 1);
        var roadSide = FindRoadSide(b, roads);
        PlaceBuilding(c, x, y, w, h, TileType.ConcreteWall, TileType.TileFloor, roadSide, rng);
    }

    private void FillResidential(Chunk c, Block b, List<RoadSegment> roads, RNG rng)
    {
        // Try to fit one or two houses per block with lawns around them
        int housesWide = b.W >= 28 ? 2 : 1;
        int housesTall = b.H >= 24 ? 2 : 1;
        int cellW = b.W / housesWide;
        int cellH = b.H / housesTall;
        var roadSide = FindRoadSide(b, roads);

        for (int hy = 0; hy < housesTall; hy++)
        for (int hx = 0; hx < housesWide; hx++)
        {
            int cx = b.X + hx * cellW;
            int cy = b.Y + hy * cellH;
            int padX = rng.Range(1, 3);
            int padY = rng.Range(1, 3);
            int w = Math.Max(8, cellW - padX * 2);
            int h = Math.Max(6, cellH - padY * 2);
            if (rng.Chance(0.1)) continue; // empty lot
            PlaceBuilding(c, cx + padX, cy + padY, w, h, TileType.WoodWall, TileType.WoodFloor, roadSide, rng);
        }
    }

    private void FillMansion(Chunk c, Block b, List<RoadSegment> roads, RNG rng)
    {
        // One large mansion per block with a generous lawn
        int pad = 4;
        if (b.W <= pad * 2 + 10 || b.H <= pad * 2 + 10) { FillResidential(c, b, roads, rng); return; }
        var roadSide = FindRoadSide(b, roads);
        PlaceBuilding(c, b.X + pad, b.Y + pad, b.W - pad * 2, b.H - pad * 2,
                      TileType.BrickWall, TileType.TileFloor, roadSide, rng);
    }

    private void FillIndustrial(Chunk c, Block b, List<RoadSegment> roads, RNG rng)
    {
        // Big warehouse — fills nearly the whole block
        var (x, y, w, h) = Shrink(b, 1, 1);
        var roadSide = FindRoadSide(b, roads);
        PlaceBuilding(c, x, y, w, h, TileType.MetalWall, TileType.Floor, roadSide, rng);
    }

    private void FillRural(Chunk c, Block b, List<RoadSegment> roads, RNG rng)
    {
        // Sparse: single small house per block, large yard
        int w = rng.Range(8, 14);
        int h = rng.Range(7, 12);
        if (w >= b.W - 4 || h >= b.H - 4) return;
        int bx = b.X + rng.Range(2, b.W - w - 2);
        int by = b.Y + rng.Range(2, b.H - h - 2);
        var roadSide = FindRoadSide(b, roads);
        PlaceBuilding(c, bx, by, w, h, TileType.WoodWall, TileType.WoodFloor, roadSide, rng);
    }

    private void FillRuins(Chunk c, Block b, List<RoadSegment> roads, RNG rng)
    {
        // Partially-collapsed building — walls with gaps
        var (x, y, w, h) = Shrink(b, 2, 2);
        var roadSide = FindRoadSide(b, roads);
        if (rng.Chance(0.4)) return; // just rubble
        PlaceRuinedBuilding(c, x, y, w, h, rng, roadSide);
    }

    // ---------------------------------------------------------------------
    // Core placement routine — can be called by any biome strategy.

    private enum RoadSide { Top, Right, Bottom, Left }

    private void PlaceBuilding(Chunk c, int x, int y, int w, int h,
                               TileType wall, TileType floor, RoadSide door, RNG rng)
    {
        if (w < 4 || h < 4) return;
        if (x < 0 || y < 0 || x + w > Chunk.Size || y + h > Chunk.Size) return;

        // Walls on perimeter, floor inside
        for (int dy = 0; dy < h; dy++)
        for (int dx = 0; dx < w; dx++)
        {
            bool isWall = dx == 0 || dx == w - 1 || dy == 0 || dy == h - 1;
            c.SetTile(x + dx, y + dy, 0, new Tile(isWall ? wall : floor));
        }

        // Door on the road-facing side
        (int doorX, int doorY) = door switch
        {
            RoadSide.Top    => (x + w / 2, y),
            RoadSide.Bottom => (x + w / 2, y + h - 1),
            RoadSide.Left   => (x,          y + h / 2),
            RoadSide.Right  => (x + w - 1,  y + h / 2),
            _               => (x + w / 2, y + h - 1),
        };
        c.SetTile(doorX, doorY, 0, new Tile(TileType.DoorClosed));

        // A couple of windows along the road-facing wall
        if (w >= 8 && (door == RoadSide.Top || door == RoadSide.Bottom))
        {
            int wy = door == RoadSide.Top ? y : y + h - 1;
            for (int wx = x + 2; wx < x + w - 2; wx += 3)
            {
                if (wx == doorX) continue;
                if (rng.Chance(0.6)) c.SetTile(wx, wy, 0, new Tile(TileType.Window));
            }
        }
        else if (h >= 8)
        {
            int wx = door == RoadSide.Left ? x : x + w - 1;
            for (int wy = y + 2; wy < y + h - 2; wy += 3)
            {
                if (wy == doorY) continue;
                if (rng.Chance(0.6)) c.SetTile(wx, wy, 0, new Tile(TileType.Window));
            }
        }
    }

    private void PlaceRuinedBuilding(Chunk c, int x, int y, int w, int h, RNG rng, RoadSide door)
    {
        for (int dy = 0; dy < h; dy++)
        for (int dx = 0; dx < w; dx++)
        {
            bool isWall = dx == 0 || dx == w - 1 || dy == 0 || dy == h - 1;
            if (isWall && rng.Chance(0.35))
            {
                c.SetTile(x + dx, y + dy, 0, new Tile(TileType.Rubble));
                continue;
            }
            c.SetTile(x + dx, y + dy, 0,
                new Tile(isWall ? TileType.BrickWall :
                         rng.Chance(0.25) ? TileType.Rubble : TileType.CrackedConcrete));
        }
    }

    // ---------------------------------------------------------------------

    private static (int x, int y, int w, int h) Shrink(Block b, int sx, int sy)
        => (b.X + sx, b.Y + sy, b.W - sx * 2, b.H - sy * 2);

    /// <summary>Which side of the block is adjacent to the widest/nearest road.</summary>
    private RoadSide FindRoadSide(Block b, List<RoadSegment> roads)
    {
        // Score each side by "is there a road just outside it" weighted by road width
        int[] score = new int[4]; // 0=Top, 1=Right, 2=Bottom, 3=Left

        foreach (var r in roads)
        {
            int half = r.Width / 2 + 1;
            if (r.Horizontal)
            {
                if (r.Offset <= b.Y)          score[0] += r.Width - (b.Y - r.Offset);
                if (r.Offset >= b.Y + b.H - 1) score[2] += r.Width - (r.Offset - (b.Y + b.H - 1));
            }
            else
            {
                if (r.Offset <= b.X)          score[3] += r.Width - (b.X - r.Offset);
                if (r.Offset >= b.X + b.W - 1) score[1] += r.Width - (r.Offset - (b.X + b.W - 1));
            }
        }

        int best = 0;
        for (int i = 1; i < 4; i++) if (score[i] > score[best]) best = i;
        return (RoadSide)best;
    }
}
