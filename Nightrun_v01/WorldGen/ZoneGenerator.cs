using Nightrun.Content;
using Nightrun.Entities;
using Nightrun.World;

namespace Nightrun.WorldGen;

/// <summary>
/// Generates a bounded zone map from a <see cref="ZoneProfile"/>.
/// Each <see cref="ZoneTheme"/> dispatches to a dedicated generation method.
/// All generation is seeded deterministic — same seed = same map.
///
/// Generation order (all themes):
///   1. Border walls
///   2. Theme-specific room/corridor pass
///   3. Furniture + container scatter
///   4. Loot tables
///   5. NPC spawns
///   6. Mark player spawn point
/// </summary>
public static class ZoneGenerator
{
    public static (ZoneManager zone, int spawnX, int spawnY) Generate(ZoneProfile profile, uint seed)
    {
        var zone = new ZoneManager(profile, seed);
        var rng  = new Random(unchecked((int)seed));

        int spawnX, spawnY;
        switch (profile.Theme)
        {
            case ZoneTheme.UrbanRuins:
                (spawnX, spawnY) = GenerateUrbanRuins(zone, rng);
                break;
            case ZoneTheme.Sewer:
                (spawnX, spawnY) = GenerateSewer(zone, rng);
                break;
            case ZoneTheme.CorporateTower:
                (spawnX, spawnY) = GenerateCorporateTower(zone, rng);
                break;
            case ZoneTheme.Suburbs:
                (spawnX, spawnY) = GenerateSuburbs(zone, rng);
                break;
            case ZoneTheme.CollapsedDistrict:
                (spawnX, spawnY) = GenerateCollapsedDistrict(zone, rng);
                break;
            case ZoneTheme.CorporateResidential:
                (spawnX, spawnY) = GenerateCorporateResidential(zone, rng);
                break;
            case ZoneTheme.Industrial:
                (spawnX, spawnY) = GenerateIndustrial(zone, rng);
                break;
            case ZoneTheme.Wasteland:
                (spawnX, spawnY) = GenerateWasteland(zone, rng);
                break;
            case ZoneTheme.Forest:
                (spawnX, spawnY) = GenerateForest(zone, rng);
                break;
            case ZoneTheme.Waterfront:
                (spawnX, spawnY) = GenerateWaterfront(zone, rng);
                break;
            case ZoneTheme.Subway:
                (spawnX, spawnY) = GenerateSubway(zone, rng);
                break;
            default:
                (spawnX, spawnY) = GenerateUrbanRuins(zone, rng);
                break;
        }

        // Z=-1: sewer/basement level for zones that support it.
        if (zone.MinZ <= -1)
            GenerateSewerLevel(zone, rng);

        // Z=1..MaxZ: upper floors for zones that have them (e.g. Corporate Tower).
        for (int floor = 1; floor <= zone.MaxZ; floor++)
            GenerateTowerFloor(zone, rng, floor);

        return (zone, spawnX, spawnY);
    }

    // ──────────────────────────────────────────────────────────────────
    // Urban Ruins
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateUrbanRuins(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Fill with cracked concrete — broken street feel.
        z.FillZ(0, TileType.CrackedConcrete);

        // 2. Perimeter solid walls (impassable boundary).
        DrawBorder(z, W, H);

        // 3. Road grid — two cross arteries forming four quadrants.
        int roadY = H / 2;
        int roadX = W / 2;
        // Main roads (2 tiles wide)
        z.DrawHLine(1, roadY - 1, W - 2, 0, TileType.Asphalt);
        z.DrawHLine(1, roadY,     W - 2, 0, TileType.Asphalt);
        z.DrawVLine(roadX - 1, 1, H - 2, 0, TileType.Asphalt);
        z.DrawVLine(roadX,     1, H - 2, 0, TileType.Asphalt);
        // Secondary east-west alley
        int alleyY = roadY / 2;
        z.DrawHLine(1, alleyY, W - 2, 0, TileType.Alley);
        z.DrawHLine(1, roadY + alleyY, W - 2, 0, TileType.Alley);

        // 4. Sidewalks flanking both sides of each road.
        for (int x = 1; x < W - 1; x++)
        {
            TrySidewalk(z, x, roadY - 2);
            TrySidewalk(z, x, roadY + 1);
        }
        for (int y = 1; y < H - 1; y++)
        {
            TrySidewalk(z, roadX - 2, y);
            TrySidewalk(z, roadX + 1, y);
        }

        // 5. Buildings — BSP-style, four quadrants.
        var rooms = new List<Rect>();
        PlaceBuildingBlock(z, rng, rooms, 2,          2,          roadX - 3, roadY - 3);
        PlaceBuildingBlock(z, rng, rooms, roadX + 2,  2,          W - roadX - 4, roadY - 3);
        PlaceBuildingBlock(z, rng, rooms, 2,          roadY + 2,  roadX - 3, H - roadY - 4);
        PlaceBuildingBlock(z, rng, rooms, roadX + 2,  roadY + 2,  W - roadX - 4, H - roadY - 4);

        // 6. Windows on building exteriors facing the sidewalk.
        StampUrbanWindows(z, rng, rooms);

        // 7. Street objects — streetlights along sidewalks.
        for (int x = 3; x < W - 2; x += 8)
        {
            PlaceOnTile(z, x, roadY - 2, TileType.Streetlight);
            PlaceOnTile(z, x, roadY + 1, TileType.Streetlight);
        }
        for (int y = 3; y < H - 2; y += 8)
        {
            PlaceOnTile(z, roadX - 2, y, TileType.Streetlight);
            PlaceOnTile(z, roadX + 1, y, TileType.Streetlight);
        }

        // 8. Benches — at corners and mid-block along sidewalks.
        PlaceOnTile(z, roadX - 2, roadY - 2, TileType.Bench);
        PlaceOnTile(z, roadX + 1, roadY - 2, TileType.Bench);
        PlaceOnTile(z, roadX - 2, roadY + 1, TileType.Bench);
        PlaceOnTile(z, roadX + 1, roadY + 1, TileType.Bench);
        // Mid-block benches (random placement along sidewalks)
        for (int i = 0; i < 4; i++)
        {
            int bx = rng.Next(3, W - 3);
            PlaceOnTile(z, bx, roadY - 2, TileType.Bench);
            PlaceOnTile(z, bx, roadY + 1, TileType.Bench);
        }

        // 9. Trash — scattered on sidewalks, alleys and cracked concrete.
        ScatterOnTileType(z, rng, TileType.Sidewalk,       W, H, TileType.Trash, 0.12);
        ScatterOnTileType(z, rng, TileType.Alley,          W, H, TileType.Trash, 0.18);
        ScatterOnTileType(z, rng, TileType.CrackedConcrete,W, H, TileType.Trash, 0.04);

        // 10. Jersey barriers blocking sections of the main road.
        PlaceBarrierRun(z, rng, 1,         roadY - 1, true,  W / 4);
        PlaceBarrierRun(z, rng, roadX + 4, roadY,     true,  W / 5);
        PlaceBarrierRun(z, rng, roadX - 1, 2,         false, H / 5);

        // 11. Manhole covers on road tiles.
        PlaceOnTile(z, roadX - 1, roadY / 2,     TileType.Manhole);
        PlaceOnTile(z, roadX,     H * 3 / 4,     TileType.Manhole);
        PlaceOnTile(z, W / 4,     roadY,          TileType.Manhole);
        PlaceOnTile(z, W * 3 / 4, roadY - 1,     TileType.Manhole);

        // 12. Chain-link fence sections along some block edges.
        StampFenceLine(z, rng, 2, alleyY - 1, true,  roadX - 3);
        StampFenceLine(z, rng, roadX + 2, roadY + alleyY - 1, true, W - roadX - 4);

        // 13. Rubble scatter in open areas outside buildings.
        ScatterRubble(z, rng, rooms, W, H);

        // 14. Context-aware indoor furnishing (apartment vs shop by room size).
        foreach (var room in rooms)
            FurnishUrbanRoom(z, rng, room);

        // 15. NPC spawns.
        SpawnUrbanNpcs(z, rng, rooms, W, H);

        // 16. Player spawns near bottom-left entry point.
        var (px, py) = z.FindSpawnNear(3, H - 6);
        return (px, py);
    }

    // ── Urban Ruins helpers ────────────────────────────────────────────

    /// <summary>Places tile only if the target is a passable non-blocked tile.</summary>
    private static void PlaceOnTile(ZoneManager z, int x, int y, TileType type)
    {
        if (x < 1 || y < 1 || x >= z.Width - 1 || y >= z.Height - 1) return;
        var t = z.GetTile(x, y, 0);
        if (!t.IsBlocked && !t.IsWall && !t.IsDoor) z.SetTile(x, y, 0, type);
    }

    /// <summary>Scatter a tile type randomly over all tiles matching sourceType.</summary>
    private static void ScatterOnTileType(ZoneManager z, Random rng, TileType sourceType,
        int W, int H, TileType placeType, double chance)
    {
        for (int y = 1; y < H - 1; y++)
        for (int x = 1; x < W - 1; x++)
        {
            if (z.GetTile(x, y, 0).Type != sourceType) continue;
            if (rng.NextDouble() < chance) z.SetTile(x, y, 0, placeType);
        }
    }

    /// <summary>Places a run of Barrier tiles along a road, with random gaps.</summary>
    private static void PlaceBarrierRun(ZoneManager z, Random rng, int startX, int startY,
        bool horizontal, int length)
    {
        for (int i = 0; i < length; i++)
        {
            int x = horizontal ? startX + i : startX;
            int y = horizontal ? startY     : startY + i;
            if (rng.Next(4) == 0) continue; // gaps in the barrier line
            PlaceOnTile(z, x, y, TileType.Barrier);
        }
    }

    /// <summary>Places a broken fence line, skipping some tiles for realism.</summary>
    private static void StampFenceLine(ZoneManager z, Random rng, int startX, int startY,
        bool horizontal, int length)
    {
        for (int i = 0; i < length; i++)
        {
            if (rng.Next(5) == 0) continue; // missing sections
            int x = horizontal ? startX + i : startX;
            int y = horizontal ? startY     : startY + i;
            PlaceOnTile(z, x, y, TileType.Fence);
        }
    }

    /// <summary>Stamps windows on the outer wall tiles of rooms that face a sidewalk or road.</summary>
    private static void StampUrbanWindows(ZoneManager z, Random rng, List<Rect> rooms)
    {
        foreach (var room in rooms)
        {
            // Top wall
            for (int x = room.X; x < room.X + room.W; x++)
            {
                if (rng.Next(3) != 0) continue;
                var t = z.GetTile(x, room.Y - 1, 0);
                if (t.IsWall) z.SetTile(x, room.Y - 1, 0, TileType.Window);
            }
            // Bottom wall
            for (int x = room.X; x < room.X + room.W; x++)
            {
                if (rng.Next(3) != 0) continue;
                var t = z.GetTile(x, room.Y + room.H, 0);
                if (t.IsWall) z.SetTile(x, room.Y + room.H, 0, TileType.Window);
            }
        }
    }

    /// <summary>
    /// Furnishes an Urban Ruins room based on size — small rooms are apartments,
    /// large rooms are stores or offices.
    /// </summary>
    private static void FurnishUrbanRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;
        int area = room.W * room.H;

        if (area <= 24)
        {
            // Small room — apartment unit fragment: bedroom or bathroom
            if (rng.Next(2) == 0)
            {
                // Bedroom
                PlaceFurniture(z, rng, room, FurnitureKind.Bed);
                PlaceFurniture(z, rng, room, FurnitureKind.Dresser);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
            }
            else
            {
                // Bathroom
                PlaceFurniture(z, rng, room, FurnitureKind.Toilet);
                PlaceFurniture(z, rng, room, FurnitureKind.Sink);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Shower);
            }
        }
        else if (area <= 60)
        {
            // Medium room — kitchen/living area or small shop back room
            if (rng.Next(2) == 0)
            {
                // Kitchen/living
                PlaceFurniture(z, rng, room, FurnitureKind.Stove);
                PlaceFurniture(z, rng, room, FurnitureKind.Sink);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Couch);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
            }
            else
            {
                // Back room / storage
                PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
            }
        }
        else
        {
            // Large room — shop floor or apartment common area
            PlaceFurniture(z, rng, room, FurnitureKind.Counter);
            PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
            PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
            PlaceFurniture(z, rng, room, FurnitureKind.Crate);
            if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Workbench);
            if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
        }
    }

    /// <summary>Tries to place a single furniture piece in a random open tile within the room.</summary>
    private static void PlaceFurniture(ZoneManager z, Random rng, Rect room, FurnitureKind kind)
    {
        if (room.W < 1 || room.H < 1) return;
        for (int attempt = 0; attempt < 12; attempt++)
        {
            int fx = rng.Next(room.X, room.X + Math.Max(1, room.W));
            int fy = rng.Next(room.Y, room.Y + Math.Max(1, room.H));
            var t = z.GetTile(fx, fy, 0);
            if (t.IsBlocked || t.IsWall || t.IsDoor || t.ObjectId != 0) continue;
            var furn = Furniture.Create(kind, fx, fy, 0);
            z.AddObject(furn);
            if (furn.IsContainer) PopulateContainer(furn, rng);
            return;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Suburbs — residential streets, wood-frame houses, sparse NPCs
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateSuburbs(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Grass everywhere — overgrown lawns.
        z.FillZ(0, TileType.Grass);
        DrawBorder(z, W, H);

        // 2. Street grid — 3 vertical + 2 horizontal roads, each 2 tiles wide.
        int ssx = W / 4;   // street spacing X
        int ssy = H / 3;   // street spacing Y
        int[] vRoads = { ssx, ssx * 2, ssx * 3 };
        int[] hRoads = { ssy, ssy * 2 };

        foreach (int rx in vRoads)
        {
            z.DrawVLine(rx,     1, H - 2, 0, TileType.Road);
            z.DrawVLine(rx + 1, 1, H - 2, 0, TileType.Road);
        }
        foreach (int ry in hRoads)
        {
            z.DrawHLine(1, ry,     W - 2, 0, TileType.Road);
            z.DrawHLine(1, ry + 1, W - 2, 0, TileType.Road);
        }

        // 3. Sidewalks flanking every road.
        foreach (int rx in vRoads)
        {
            for (int y = 1; y < H - 1; y++)
            { TrySidewalk(z, rx - 1, y); TrySidewalk(z, rx + 2, y); }
        }
        foreach (int ry in hRoads)
        {
            for (int x = 1; x < W - 1; x++)
            { TrySidewalk(z, x, ry - 1); TrySidewalk(z, x, ry + 2); }
        }

        // 4. Streetlights every 10 tiles along sidewalks.
        foreach (int rx in vRoads)
        {
            for (int y = 3; y < H - 2; y += 10)
            { PlaceOnTile(z, rx - 1, y, TileType.Streetlight); PlaceOnTile(z, rx + 2, y, TileType.Streetlight); }
        }
        foreach (int ry in hRoads)
        {
            for (int x = 3; x < W - 2; x += 10)
            { PlaceOnTile(z, x, ry - 1, TileType.Streetlight); PlaceOnTile(z, x, ry + 2, TileType.Streetlight); }
        }

        // 5. Trash along sidewalks and road edges.
        ScatterOnTileType(z, rng, TileType.Sidewalk, W, H, TileType.Trash, 0.08);
        ScatterOnTileType(z, rng, TileType.Road,     W, H, TileType.Trash, 0.03);

        // 6. Houses — one per block cell. 12 cells total (3 cols × 4 rows).
        var rooms = new List<Rect>();
        int[] cellsX = { 2, ssx + 2, ssx * 2 + 2, ssx * 3 + 2 };
        int[] cellsY = { 2, ssy + 2, ssy * 2 + 2 };
        int cellW = ssx - 4;
        int cellH = ssy - 4;

        foreach (int cellOriginY in cellsY)
        foreach (int cellOriginX in cellsX)
        {
            if (cellW < 12 || cellH < 10) continue;
            if (rng.Next(10) < 2) continue; // empty overgrown lot

            // House dimensions — smaller than cell to leave yard
            int hw = rng.Next(10, Math.Max(11, Math.Min(cellW - 2, 18)));
            int hh = rng.Next(8,  Math.Max(9,  Math.Min(cellH - 2, 14)));
            // Offset toward the back of the yard (away from road)
            int hx = cellOriginX + rng.Next(1, Math.Max(2, cellW - hw - 1));
            int hy = cellOriginY + rng.Next(1, Math.Max(2, cellH - hh - 1));

            if (hx + hw >= W - 1 || hy + hh >= H - 1) continue;

            // House shell
            z.DrawRect(hx, hy, hw, hh, 0, TileType.WoodWall, TileType.WoodFloor);
            PlaceDoor(z, rng, hx, hy, hw, hh, false);

            // Windows on front and back walls
            for (int wx = hx + 1; wx < hx + hw - 1; wx += 3)
            {
                var twt = z.GetTile(wx, hy, 0);
                if (twt.IsWall && rng.Next(2) == 0) z.SetTile(wx, hy, 0, TileType.Window);
                var twb = z.GetTile(wx, hy + hh - 1, 0);
                if (twb.IsWall && rng.Next(2) == 0) z.SetTile(wx, hy + hh - 1, 0, TileType.Window);
            }

            // Driveway — concrete strip from road sidewalk to house
            int driveX = hx + hw / 2;
            int driveStartY = cellOriginY;
            int driveEndY   = hy;
            for (int dy = driveStartY; dy < driveEndY; dy++)
                PlaceOnTile(z, driveX, dy, TileType.Concrete);

            // Yard fence along the sidewalk-facing edge.
            if (rng.Next(3) != 0)
            {
                int fenceY = cellOriginY;
                StampFenceLine(z, rng, cellOriginX, fenceY, true, cellW);
            }

            // Yard objects — bushes, stumps, trees scattered across the lawn.
            for (int ly = cellOriginY; ly < cellOriginY + cellH; ly++)
            for (int lx = cellOriginX; lx < cellOriginX + cellW; lx++)
            {
                var gt = z.GetTile(lx, ly, 0);
                if (gt.Type != TileType.Grass) continue;
                int roll = rng.Next(40);
                if      (roll == 0)  z.SetTile(lx, ly, 0, TileType.Tree);
                else if (roll == 1)  z.SetTile(lx, ly, 0, TileType.Bush);
                else if (roll == 2)  z.SetTile(lx, ly, 0, TileType.Stump);
            }

            // Tall grass creeping in — neglect.
            ScatterOnTileType(z, rng, TileType.Grass, W, H, TileType.TallGrass, 0.08);

            // Split house interior into rooms and furnish each.
            FurnishSuburbanHouse(z, rng, rooms, hx, hy, hw, hh);
        }

        // 7. Roadside benches at a few intersections.
        PlaceOnTile(z, ssx - 1,     ssy - 1, TileType.Bench);
        PlaceOnTile(z, ssx * 2 + 2, ssy - 1, TileType.Bench);
        PlaceOnTile(z, ssx - 1,     ssy * 2 + 2, TileType.Bench);

        // 8. NPC spawns.
        SpawnNpcsInRooms(z, rng, rooms, "scavenger", 5);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Road,     "raider",    2);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Sidewalk, "scavenger", 2);

        // 9. Player entry — bottom-left corner.
        var (px, py) = z.FindSpawnNear(3, H - 5);
        return (px, py);
    }

    // ── Suburbs helpers ────────────────────────────────────────────────

    /// <summary>
    /// Splits a house footprint into 2–3 named sections and furnishes each
    /// as a real room type: kitchen, living room, bedroom, bathroom, garage.
    /// </summary>
    private static void FurnishSuburbanHouse(ZoneManager z, Random rng, List<Rect> rooms,
        int hx, int hy, int hw, int hh)
    {
        int interior_x = hx + 1;
        int interior_y = hy + 1;
        int interior_w = hw - 2;
        int interior_h = hh - 2;
        if (interior_w < 4 || interior_h < 4) return;

        bool hasGarage = hw >= 14 && rng.Next(2) == 0;

        if (hasGarage)
        {
            // Right portion is a garage
            int garageW = interior_w / 3;
            int mainW   = interior_w - garageW - 1;

            // Interior dividing wall
            int wallX = interior_x + mainW;
            for (int dy = interior_y; dy < interior_y + interior_h; dy++)
                z.SetTile(wallX, dy, 0, TileType.WoodWall);
            PlaceDoor(z, rng, wallX, interior_y, 1, interior_h, false);

            // Garage section
            var garageRoom = new Rect(wallX + 1, interior_y, garageW - 1, interior_h);
            rooms.Add(garageRoom);
            PlaceFurniture(z, rng, garageRoom, FurnitureKind.Workbench);
            PlaceFurniture(z, rng, garageRoom, FurnitureKind.Crate);
            if (rng.Next(2) == 0) PlaceFurniture(z, rng, garageRoom, FurnitureKind.Locker);

            // Main section — split top/bottom
            SplitAndFurnishHouseSection(z, rng, rooms,
                interior_x, interior_y, mainW, interior_h);
        }
        else
        {
            // No garage — split the whole interior
            SplitAndFurnishHouseSection(z, rng, rooms,
                interior_x, interior_y, interior_w, interior_h);
        }
    }

    /// <summary>Splits a rectangular section horizontally and furnishes each half.</summary>
    private static void SplitAndFurnishHouseSection(ZoneManager z, Random rng, List<Rect> rooms,
        int ix, int iy, int iw, int ih)
    {
        if (iw < 4 || ih < 8)
        {
            // Too small to split — single room
            var r = new Rect(ix, iy, iw, ih);
            rooms.Add(r);
            FurnishSuburbanRoom(z, rng, r, SuburbanRoomType.Living);
            return;
        }

        // Horizontal split: upper = kitchen+living, lower = bedroom+bathroom
        int splitH = ih / 2;
        int wallY  = iy + splitH;

        // Dividing wall
        for (int dx = ix; dx < ix + iw; dx++)
            z.SetTile(dx, wallY, 0, TileType.WoodWall);
        // Internal door in dividing wall
        int doorX = ix + iw / 2 + rng.Next(-1, 2);
        z.SetTile(Math.Clamp(doorX, ix, ix + iw - 1), wallY, 0, TileType.DoorClosed);

        // Upper half — living/kitchen split
        var upper = new Rect(ix, iy, iw, splitH);
        rooms.Add(upper);
        FurnishSuburbanRoom(z, rng, upper,
            rng.Next(2) == 0 ? SuburbanRoomType.Kitchen : SuburbanRoomType.Living);

        // Lower half — bedroom or bathroom
        var lower = new Rect(ix, wallY + 1, iw, ih - splitH - 1);
        if (lower.H < 2) return;
        rooms.Add(lower);
        FurnishSuburbanRoom(z, rng, lower,
            rng.Next(3) == 0 ? SuburbanRoomType.Bathroom : SuburbanRoomType.Bedroom);
    }

    private enum SuburbanRoomType { Kitchen, Living, Bedroom, Bathroom }

    private static void FurnishSuburbanRoom(ZoneManager z, Random rng, Rect room, SuburbanRoomType type)
    {
        switch (type)
        {
            case SuburbanRoomType.Kitchen:
                PlaceFurniture(z, rng, room, FurnitureKind.Stove);
                PlaceFurniture(z, rng, room, FurnitureKind.Sink);
                PlaceFurniture(z, rng, room, FurnitureKind.Counter);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                break;

            case SuburbanRoomType.Living:
                PlaceFurniture(z, rng, room, FurnitureKind.Couch);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                break;

            case SuburbanRoomType.Bedroom:
                PlaceFurniture(z, rng, room, FurnitureKind.Bed);
                PlaceFurniture(z, rng, room, FurnitureKind.Dresser);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                if (rng.Next(3) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                break;

            case SuburbanRoomType.Bathroom:
                PlaceFurniture(z, rng, room, FurnitureKind.Toilet);
                PlaceFurniture(z, rng, room, FurnitureKind.Sink);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Shower);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Collapsed District — dense ruins, salvage-heavy
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateCollapsedDistrict(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Rubble everywhere — this block came down hard.
        z.FillZ(0, TileType.Rubble);
        DrawBorder(z, W, H);

        // 2. Ghost of the old road grid — barely passable cracked concrete
        //    underneath the rubble. Two main arteries still faintly visible.
        int ghostRoadY = H / 2;
        int ghostRoadX = W / 3;
        z.DrawHLine(1, ghostRoadY,     W - 2, 0, TileType.CrackedConcrete);
        z.DrawHLine(1, ghostRoadY + 1, W - 2, 0, TileType.CrackedConcrete);
        z.DrawVLine(ghostRoadX,     1, H - 2, 0, TileType.CrackedConcrete);
        z.DrawVLine(ghostRoadX + 1, 1, H - 2, 0, TileType.CrackedConcrete);
        // Secondary alley scar
        z.DrawHLine(1, ghostRoadY / 2, W - 2, 0, TileType.CrackedConcrete);

        // 3. Exposed building shells — grid offset so they feel haphazard.
        var rooms = new List<Rect>();
        int cols = W / 18;
        int rows = H / 14;
        for (int ry = 0; ry < rows; ry++)
        for (int rx = 0; rx < cols; rx++)
        {
            int jitter = rng.Next(0, 4);
            int bx = 2 + rx * 18 + jitter;
            int by = 2 + ry * 14 + rng.Next(0, 3);
            int bw = rng.Next(10, 17);
            int bh = rng.Next(8, 13);
            if (bx + bw >= W - 1 || by + bh >= H - 1) continue;

            TileType wall = rng.Next(3) == 0 ? TileType.ConcreteWall : TileType.BrickWall;
            // 60% collapsed, 40% standing-but-damaged
            bool collapsed = rng.Next(10) < 6;

            z.DrawRect(bx, by, bw, bh, 0, wall, TileType.CrackedConcrete);
            if (collapsed)
            {
                PunchWallHoles(z, rng, bx, by, bw, bh);
                // Fill collapsed interior with rubble piles
                for (int iy = by + 1; iy < by + bh - 1; iy++)
                for (int ix = bx + 1; ix < bx + bw - 1; ix++)
                    if (rng.Next(3) == 0) z.SetTile(ix, iy, 0, TileType.Rubble);
                PlaceDoor(z, rng, bx, by, bw, bh, true);
            }
            else
            {
                // Intact enough to still have recognisable rooms
                PlaceDoor(z, rng, bx, by, bw, bh, false);
                // Windows — cracked but present
                for (int wx = bx + 1; wx < bx + bw - 1; wx += 3)
                {
                    if (rng.Next(2) == 0 && z.GetTile(wx, by, 0).IsWall)
                        z.SetTile(wx, by, 0, TileType.Window);
                }

                var room = new Rect(bx + 1, by + 1, bw - 2, bh - 2);
                rooms.Add(room);
                FurnishCollapsedRoom(z, rng, room);
            }
        }

        // 4. Barriers — old police/military cordons, now half-buried.
        PlaceBarrierRun(z, rng, 1,            ghostRoadY,     true,  W / 3);
        PlaceBarrierRun(z, rng, W * 2 / 3,   ghostRoadY + 1, true,  W / 4);
        PlaceBarrierRun(z, rng, ghostRoadX,   2,              false, H / 4);

        // 5. Manhole covers exposed by collapse.
        PlaceOnTile(z, ghostRoadX,         ghostRoadY / 2,   TileType.Manhole);
        PlaceOnTile(z, ghostRoadX + 1,     ghostRoadY * 3/2, TileType.Manhole);
        PlaceOnTile(z, W / 2,              ghostRoadY,       TileType.Manhole);
        PlaceOnTile(z, W * 3 / 4,          ghostRoadY + 1,   TileType.Manhole);

        // 6. Fence shards — chain-link torn and jutting from rubble.
        StampFenceLine(z, rng, 2,              ghostRoadY / 2 - 1, true,  ghostRoadX - 3);
        StampFenceLine(z, rng, ghostRoadX + 3, H * 3 / 4,          true,  W / 4);
        StampFenceLine(z, rng, W * 2 / 3,     3,                   false, H / 5);

        // 7. Half-buried benches — occasional reminder of the old street life.
        PlaceOnTile(z, ghostRoadX - 2, ghostRoadY - 1, TileType.Bench);
        PlaceOnTile(z, W * 2 / 3,     ghostRoadY + 2,  TileType.Bench);
        PlaceOnTile(z, W / 4,         ghostRoadY / 2,  TileType.Bench);

        // 8. Trash in the paths and exposed ground.
        ScatterOnTileType(z, rng, TileType.CrackedConcrete, W, H, TileType.Trash, 0.10);

        // 9. NPC spawns — scavengers hide in intact rooms, raiders and brutes
        //    patrol the rubble field.
        SpawnNpcsInRooms(z, rng, rooms, "scavenger", 4);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Rubble,         "raider",    5);
        SpawnNpcsOnTile(z, rng, W, H, TileType.CrackedConcrete,"brute",     2);

        // 10. Player entry — south edge, central road ghost.
        var (px, py) = z.FindSpawnNear(ghostRoadX, H - 4);
        return (px, py);
    }

    /// <summary>
    /// Furnishes a collapsed-district room that is still standing.
    /// Could be a shop back room, an apartment fragment, or an office.
    /// </summary>
    private static void FurnishCollapsedRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;
        int roll = rng.Next(3);
        switch (roll)
        {
            case 0: // Looted apartment fragment
                PlaceFurniture(z, rng, room, FurnitureKind.Bed);
                PlaceFurniture(z, rng, room, FurnitureKind.Dresser);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                break;
            case 1: // Scavenger stash / storage
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Workbench);
                break;
            case 2: // Old office
                PlaceFurniture(z, rng, room, FurnitureKind.FilingCabinet);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Corporate Residential — executive housing blocks, gated compounds
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateCorporateResidential(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Manicured grass — estates have lawns, albeit overgrown.
        z.FillZ(0, TileType.Grass);
        DrawBorder(z, W, H);

        // 2. Main boulevard — 3 tiles wide with a central divider.
        int roadY = H / 2;
        z.DrawHLine(1, roadY - 1, W - 2, 0, TileType.Asphalt);
        z.DrawHLine(1, roadY,     W - 2, 0, TileType.Asphalt);
        z.DrawHLine(1, roadY + 1, W - 2, 0, TileType.Asphalt);
        // Sidewalks both sides
        for (int x = 1; x < W - 1; x++)
        {
            TrySidewalk(z, x, roadY - 2);
            TrySidewalk(z, x, roadY + 2);
        }

        // 3. Ornate streetlights every 7 tiles.
        for (int x = 3; x < W - 2; x += 7)
        {
            PlaceOnTile(z, x, roadY - 2, TileType.Streetlight);
            PlaceOnTile(z, x, roadY + 2, TileType.Streetlight);
        }

        // 4. Boulevard benches at intervals.
        for (int x = 8; x < W - 6; x += 16)
        {
            PlaceOnTile(z, x, roadY - 2, TileType.Bench);
            PlaceOnTile(z, x, roadY + 2, TileType.Bench);
        }

        // 5. Minimal trash — this was a clean district once.
        ScatterOnTileType(z, rng, TileType.Sidewalk, W, H, TileType.Trash, 0.04);

        // 6. Two large estate blocks — north and south of the boulevard.
        var rooms = new List<Rect>();
        PlaceMansionBlock(z, rng, rooms, 4, 2,          W - 8, roadY - 4);
        PlaceMansionBlock(z, rng, rooms, 4, roadY + 3,  W - 8, H - roadY - 5);

        // 7. Garden features on the estate grounds (between perimeter and mansion).
        ScatterOnTileType(z, rng, TileType.Grass, W, H, TileType.Bush,     0.04);
        ScatterOnTileType(z, rng, TileType.Grass, W, H, TileType.TallGrass,0.05);
        // Occasional decorative tree in garden area
        for (int y = 2; y < H - 2; y++)
        for (int x = 5; x < W - 5; x++)
        {
            if (z.GetTile(x, y, 0).Type == TileType.Grass && rng.Next(60) == 0)
                z.SetTile(x, y, 0, TileType.Tree);
        }

        // 8. Gatehouse barriers at boulevard entry points.
        PlaceBarrierRun(z, rng, 1,     roadY - 1, true, 4);
        PlaceBarrierRun(z, rng, W - 5, roadY - 1, true, 4);

        // 9. Room furnishing — context aware per room size.
        foreach (var room in rooms)
            FurnishMansionRoom(z, rng, room);

        // 10. Corp security patrols boulevard and estate grounds.
        SpawnNpcsInRooms(z, rng, rooms, "armed_raider", 6);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Asphalt,  "armed_raider", 3);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Sidewalk, "armed_raider", 2);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Grass,    "armed_raider", 2);

        // 11. Player entry — south sidewalk mid-point.
        var (px, py) = z.FindSpawnNear(W / 2, H - 3);
        return (px, py);
    }

    private static void PlaceMansionBlock(ZoneManager z, Random rng, List<Rect> rooms,
        int bx, int by, int bw, int bh)
    {
        if (bw < 20 || bh < 12) return;

        // Perimeter iron fence — broken in places.
        for (int x = bx; x < bx + bw; x++)
        {
            PlaceOnTile(z, x, by,          TileType.Fence);
            PlaceOnTile(z, x, by + bh - 1, TileType.Fence);
        }
        for (int y = by; y < by + bh; y++)
        {
            PlaceOnTile(z, bx,          y, TileType.Fence);
            PlaceOnTile(z, bx + bw - 1, y, TileType.Fence);
        }
        // Gate opening — clear a section of fence on the boulevard-facing side.
        int gateX = bx + bw / 2;
        int gateFaceY = (by + bh / 2 > z.Height / 2) ? by : by + bh - 1;
        for (int gx = gateX - 2; gx <= gateX + 2; gx++)
            if (gx >= 1 && gx < z.Width - 1) z.SetTile(gx, gateFaceY, 0, TileType.Grass);

        // Gatehouse barrier posts flanking the opening.
        PlaceOnTile(z, gateX - 3, gateFaceY, TileType.Barrier);
        PlaceOnTile(z, gateX + 3, gateFaceY, TileType.Barrier);

        // Driveway from gate to mansion.
        int driveLen = 3;
        int driveDir = (gateFaceY == by) ? 1 : -1;
        for (int i = 1; i <= driveLen; i++)
            PlaceOnTile(z, gateX, gateFaceY + driveDir * i, TileType.Concrete);

        // Mansion building — inset from perimeter fence.
        int pad = 4;
        int mx = bx + pad, my = by + pad, mw = bw - pad * 2, mh = bh - pad * 2;
        if (mw < 8 || mh < 6) return;
        z.DrawRect(mx, my, mw, mh, 0, TileType.BrickWall, TileType.TileFloor);
        PlaceDoor(z, rng, mx, my, mw, mh, false);

        // Windows on all four walls.
        for (int wx = mx + 1; wx < mx + mw - 1; wx += 2)
        {
            if (z.GetTile(wx, my,          0).IsWall && rng.Next(2) == 0)
                z.SetTile(wx, my,          0, TileType.Window);
            if (z.GetTile(wx, my + mh - 1, 0).IsWall && rng.Next(2) == 0)
                z.SetTile(wx, my + mh - 1, 0, TileType.Window);
        }
        for (int wy = my + 1; wy < my + mh - 1; wy += 2)
        {
            if (z.GetTile(mx,          wy, 0).IsWall && rng.Next(2) == 0)
                z.SetTile(mx,          wy, 0, TileType.Window);
            if (z.GetTile(mx + mw - 1, wy, 0).IsWall && rng.Next(2) == 0)
                z.SetTile(mx + mw - 1, wy, 0, TileType.Window);
        }

        // Interior rooms — split horizontally into 2–3 sections.
        int interiorW = mw - 2;
        int interiorH = mh - 2;
        int interiorX = mx + 1;
        int interiorY = my + 1;

        if (interiorH >= 8)
        {
            int splitH = interiorH / 2;
            int wallY  = interiorY + splitH;
            for (int dx = interiorX; dx < interiorX + interiorW; dx++)
                z.SetTile(dx, wallY, 0, TileType.BrickWall);
            int doorX = interiorX + interiorW / 2;
            z.SetTile(Math.Clamp(doorX, interiorX, interiorX + interiorW - 1), wallY, 0, TileType.DoorClosed);

            rooms.Add(new Rect(interiorX, interiorY,    interiorW, splitH));
            rooms.Add(new Rect(interiorX, wallY + 1,    interiorW, interiorH - splitH - 1));
        }
        else
        {
            rooms.Add(new Rect(interiorX, interiorY, interiorW, interiorH));
        }
    }

    /// <summary>Furnishes a mansion room — high-end furniture, corp files, locker banks.</summary>
    private static void FurnishMansionRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;
        int roll = rng.Next(4);
        switch (roll)
        {
            case 0: // Reception / office
                PlaceFurniture(z, rng, room, FurnitureKind.FilingCabinet);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                break;
            case 1: // Lounge
                PlaceFurniture(z, rng, room, FurnitureKind.Couch);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                break;
            case 2: // Master bedroom
                PlaceFurniture(z, rng, room, FurnitureKind.Bed);
                PlaceFurniture(z, rng, room, FurnitureKind.Dresser);
                PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                break;
            case 3: // Security locker room
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                PlaceFurniture(z, rng, room, FurnitureKind.FilingCabinet);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Industrial — warehouses, factory floors
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateIndustrial(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Gravel yard — the ground between buildings is packed gravel.
        z.FillZ(0, TileType.Gravel);
        DrawBorder(z, W, H);

        // 2. Two vertical access roads splitting the zone into three columns.
        int roadX1 = W / 3;
        int roadX2 = W * 2 / 3;
        z.DrawVLine(roadX1,     1, H - 2, 0, TileType.Asphalt);
        z.DrawVLine(roadX1 + 1, 1, H - 2, 0, TileType.Asphalt);
        z.DrawVLine(roadX2,     1, H - 2, 0, TileType.Asphalt);
        z.DrawVLine(roadX2 + 1, 1, H - 2, 0, TileType.Asphalt);
        // Cross road at mid-height — loading bay access.
        int crossY = H / 2;
        z.DrawHLine(1, crossY,     W - 2, 0, TileType.Asphalt);
        z.DrawHLine(1, crossY + 1, W - 2, 0, TileType.Asphalt);

        // 3. Five large warehouse blocks.
        var rooms = new List<Rect>();
        int[][] blocks = {
            new[]{ 2,          2,          roadX1 - 3,              crossY - 3 },
            new[]{ 2,          crossY + 3, roadX1 - 3,              H - crossY - 5 },
            new[]{ roadX1 + 3, 2,          roadX2 - roadX1 - 5,    H - 4 },
            new[]{ roadX2 + 3, 2,          W - roadX2 - 5,         crossY - 3 },
            new[]{ roadX2 + 3, crossY + 3, W - roadX2 - 5,         H - crossY - 5 },
        };
        foreach (var b in blocks)
        {
            int bx = b[0], by = b[1], bw = b[2], bh = b[3];
            if (bw < 8 || bh < 6) continue;
            z.DrawRect(bx, by, bw, bh, 0, TileType.MetalWall, TileType.Floor);
            // Loading door (always on road-facing side)
            PlaceDoor(z, rng, bx, by, bw, bh, false);
            // Windows — high industrial windows every 4 tiles.
            for (int wx = bx + 2; wx < bx + bw - 1; wx += 4)
            {
                if (z.GetTile(wx, by, 0).IsWall)          z.SetTile(wx, by,          0, TileType.Window);
                if (z.GetTile(wx, by + bh - 1, 0).IsWall) z.SetTile(wx, by + bh - 1, 0, TileType.Window);
            }
            var room = new Rect(bx + 1, by + 1, bw - 2, bh - 2);
            rooms.Add(room);
            FurnishIndustrialRoom(z, rng, room);
        }

        // 4. Outdoor crate yards — stacked crates along road edges.
        ScatterOnTileType(z, rng, TileType.Gravel, W, H, TileType.Trash,   0.03);
        // Crate stacks near loading bays
        for (int i = 0; i < 8; i++)
        {
            int cx = rng.Next(2, W - 2);
            int cy = rng.Next(2, H - 2);
            var t = z.GetTile(cx, cy, 0);
            if (t.Type == TileType.Gravel)
            {
                var crate = Furniture.Create(FurnitureKind.Crate, cx, cy, 0);
                z.AddObject(crate);
                PopulateContainer(crate, rng);
            }
        }

        // 5. Barriers — bollards at road junctions and loading bay mouths.
        PlaceBarrierRun(z, rng, 1,          crossY - 1, true,  roadX1 - 2);
        PlaceBarrierRun(z, rng, roadX2 + 3, crossY + 2, true,  W - roadX2 - 5);
        PlaceBarrierRun(z, rng, roadX1 - 1, 2,          false, crossY - 2);
        PlaceBarrierRun(z, rng, roadX2 + 1, crossY + 3, false, H - crossY - 5);

        // 6. Chain-link fences around yard perimeters.
        StampFenceLine(z, rng, 2,          3,          true,  roadX1 - 3);
        StampFenceLine(z, rng, roadX2 + 3, H - 3,      true,  W - roadX2 - 5);
        StampFenceLine(z, rng, 2,          H * 3/4,    true,  roadX1 - 3);

        // 7. Manhole covers on the main roads.
        PlaceOnTile(z, roadX1,     crossY / 2,   TileType.Manhole);
        PlaceOnTile(z, roadX2 + 1, crossY * 3/2, TileType.Manhole);
        PlaceOnTile(z, W / 2,      crossY,        TileType.Manhole);

        // 8. Rubble / waste scatter.
        ScatterRubble(z, rng, rooms, W, H);

        // 9. NPC spawns — armed crews inside, brutes patrol the roads.
        SpawnNpcsInRooms(z, rng, rooms, "raider",      3);
        SpawnNpcsInRooms(z, rng, rooms, "armed_raider",3);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Asphalt, "brute",        2);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Gravel,  "armed_raider", 2);

        // 10. Player entry — south-west corner.
        var (px, py) = z.FindSpawnNear(2, H - 4);
        return (px, py);
    }

    private static void FurnishIndustrialRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;
        int roll = rng.Next(3);
        switch (roll)
        {
            case 0: // Warehouse floor — crates and shelves
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                break;
            case 1: // Workshop / maintenance bay
                PlaceFurniture(z, rng, room, FurnitureKind.Workbench);
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                break;
            case 2: // Security / supervisor office
                PlaceFurniture(z, rng, room, FurnitureKind.FilingCabinet);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Wasteland — open map, sparse ruins, long sight lines
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateWasteland(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Open dirt — wide, exposed, nowhere to hide.
        z.FillZ(0, TileType.Dirt);
        DrawBorder(z, W, H);

        // 2. Broken highway scar cutting across — cracked concrete, 2 tiles wide.
        int roadY = H / 3 + rng.Next(-5, 6);
        z.DrawHLine(1, roadY,     W - 2, 0, TileType.CrackedConcrete);
        z.DrawHLine(1, roadY + 1, W - 2, 0, TileType.CrackedConcrete);
        // Faded road markings every 10 tiles.
        for (int x = 5; x < W - 2; x += 10)
            PlaceOnTile(z, x, roadY, TileType.RoadLine);

        // 3. Highway barriers along the road — rusted, half-buried.
        PlaceBarrierRun(z, rng, 1,         roadY - 1, true,  W / 3);
        PlaceBarrierRun(z, rng, W / 2 + 4, roadY + 2, true,  W / 4);

        // 4. Collapsed fence runs — farm fencing, long since fallen.
        StampFenceLine(z, rng, 3,          roadY + 4, true,  W / 2);
        StampFenceLine(z, rng, W / 2,      5,         false, roadY - 6);
        StampFenceLine(z, rng, W * 3 / 4,  H / 2,     false, H / 3);

        // 5. Rock outcrops — natural features breaking up long sight lines.
        for (int i = 0; i < W * H / 25; i++)
        {
            int rx = rng.Next(1, W - 1), ry = rng.Next(1, H - 1);
            var t = z.GetTile(rx, ry, 0);
            if (!t.IsBlocked && !t.IsWall && t.Type == TileType.Dirt)
                z.SetTile(rx, ry, 0, TileType.Rock);
        }

        // 6. Scrubland — bushes and stumps on the open ground.
        ScatterOnTileType(z, rng, TileType.Dirt, W, H, TileType.Bush,     0.04);
        ScatterOnTileType(z, rng, TileType.Dirt, W, H, TileType.Stump,    0.02);
        ScatterOnTileType(z, rng, TileType.Dirt, W, H, TileType.TallGrass,0.06);
        ScatterOnTileType(z, rng, TileType.Dirt, W, H, TileType.Trash,    0.02);

        // 7. Sparse ruined structures — old checkpoints, farmhouses, bus shelters.
        var rooms = new List<Rect>();
        int structCount = rng.Next(4, 8);
        for (int i = 0; i < structCount; i++)
        {
            int bx = rng.Next(4, W - 20);
            int by = rng.Next(4, H - 14);
            int bw = rng.Next(6, 16);
            int bh = rng.Next(5, 10);
            if (bx + bw >= W - 1 || by + bh >= H - 1) continue;
            bool ruined = rng.Next(10) < 7;
            z.DrawRect(bx, by, bw, bh, 0, TileType.ConcreteWall, TileType.Floor);
            if (ruined) PunchWallHoles(z, rng, bx, by, bw, bh);
            PlaceDoor(z, rng, bx, by, bw, bh, ruined);
            // Windows on intact structures
            if (!ruined)
            {
                for (int wx = bx + 1; wx < bx + bw - 1; wx += 3)
                    if (z.GetTile(wx, by, 0).IsWall && rng.Next(2) == 0)
                        z.SetTile(wx, by, 0, TileType.Window);
            }
            var room = new Rect(bx + 1, by + 1, bw - 2, bh - 2);
            if (!ruined)
            {
                rooms.Add(room);
                FurnishWastelandRoom(z, rng, room);
            }
        }

        // 8. Roadside bench remnant — rusted bus stop.
        PlaceOnTile(z, W / 4,     roadY - 1, TileType.Bench);
        PlaceOnTile(z, W * 3 / 4, roadY + 2, TileType.Bench);

        // 9. Manhole on the road — drainage.
        PlaceOnTile(z, W / 3,     roadY,     TileType.Manhole);
        PlaceOnTile(z, W * 2 / 3, roadY + 1, TileType.Manhole);

        // 10. NPC spawns — stalkers roam open ground, raiders hold the road.
        SpawnNpcsOnTile(z, rng, W, H, TileType.Dirt,          "stalker",  4);
        SpawnNpcsOnTile(z, rng, W, H, TileType.CrackedConcrete,"raider",  3);
        SpawnNpcsInRooms(z, rng, rooms, "scavenger",           3);

        // 11. Player entry — south edge, near road.
        var (px, py) = z.FindSpawnNear(W / 3, H - 4);
        return (px, py);
    }

    private static void FurnishWastelandRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;
        int roll = rng.Next(3);
        switch (roll)
        {
            case 0: // Abandoned checkpoint
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.FilingCabinet);
                break;
            case 1: // Scavenger cache
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                break;
            case 2: // Squatter shelter
                PlaceFurniture(z, rng, room, FurnitureKind.Bed);
                PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Workbench);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Forest — dense canopy, stalker territory, no roads
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateForest(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Grass base — forest floor, overgrown.
        z.FillZ(0, TileType.Grass);
        DrawBorder(z, W, H);

        // 2. Dense tree coverage — 40%, mix of pines and broadleaf.
        for (int y = 1; y < H - 1; y++)
        for (int x = 1; x < W - 1; x++)
        {
            if (rng.Next(100) < 40)
                z.SetTile(x, y, 0, rng.Next(2) == 0 ? TileType.PineTree : TileType.Tree);
        }

        // 3. Undergrowth — bushes, tall grass in clearings.
        ScatterOnTileType(z, rng, TileType.Grass, W, H, TileType.Bush,     0.08);
        ScatterOnTileType(z, rng, TileType.Grass, W, H, TileType.TallGrass,0.12);
        ScatterOnTileType(z, rng, TileType.Grass, W, H, TileType.Stump,    0.03);
        ScatterOnTileType(z, rng, TileType.Grass, W, H, TileType.Rock,     0.02);

        // 4. Dirt path cutting through east-west — the only reliable route.
        int pathY = H / 2 + rng.Next(-6, 7);
        for (int x = 1; x < W - 1; x++)
        {
            z.SetTile(x, pathY, 0, TileType.Dirt);
            // Widen path slightly with random variation.
            if (rng.Next(3) != 0) z.SetTile(x, pathY + 1, 0, TileType.Dirt);
            if (rng.Next(5) == 0) z.SetTile(x, pathY - 1, 0, TileType.Dirt);
        }
        // North-south trail branching off.
        int trailX = W / 3 + rng.Next(-5, 6);
        for (int y = 1; y < pathY; y++)
        {
            z.SetTile(trailX, y, 0, TileType.Dirt);
            if (rng.Next(4) == 0) z.SetTile(trailX + 1, y, 0, TileType.Dirt);
        }

        // 5. Fence remnant — old property boundary.
        StampFenceLine(z, rng, trailX - 8, pathY - 6, true, 12);
        StampFenceLine(z, rng, trailX - 8, pathY - 6, false, 6);

        // 6. Rock outcrops along the trail.
        for (int y = 3; y < pathY - 2; y += 7)
            PlaceOnTile(z, trailX + 2, y, TileType.Rock);

        // 7. Abandoned structures — 1–3 in the forest.
        var rooms = new List<Rect>();
        int structCount = rng.Next(1, 4);
        for (int i = 0; i < structCount; i++)
        {
            int cx = rng.Next(W / 5, 4 * W / 5);
            int cy = rng.Next(H / 5, 4 * H / 5);
            int cw = rng.Next(8, 14);
            int ch = rng.Next(6, 10);
            if (cx + cw >= W - 1 || cy + ch >= H - 1) continue;

            bool cabin = rng.Next(2) == 0;
            TileType wallType = cabin ? TileType.WoodWall  : TileType.ConcreteWall;
            TileType floorType= cabin ? TileType.WoodFloor : TileType.Floor;
            z.DrawRect(cx, cy, cw, ch, 0, wallType, floorType);
            // Clear trees on footprint
            for (int fy = cy; fy < cy + ch; fy++)
            for (int fx = cx; fx < cx + cw; fx++)
                if (z.GetTile(fx, fy, 0).Type == TileType.Tree || z.GetTile(fx, fy, 0).Type == TileType.PineTree)
                    z.SetTile(fx, fy, 0, floorType);

            PlaceDoor(z, rng, cx, cy, cw, ch, false);
            // Windows
            for (int wx = cx + 1; wx < cx + cw - 1; wx += 3)
                if (z.GetTile(wx, cy, 0).IsWall && rng.Next(2) == 0)
                    z.SetTile(wx, cy, 0, TileType.Window);

            var room = new Rect(cx + 1, cy + 1, cw - 2, ch - 2);
            rooms.Add(room);
            FurnishForestStructure(z, rng, room, cabin);
        }

        // 8. NPC spawns — stalkers lurk in trees, scavengers follow the path.
        SpawnNpcsOnTile(z, rng, W, H, TileType.Grass,    "stalker",   5);
        SpawnNpcsOnTile(z, rng, W, H, TileType.PineTree,  "stalker",   2);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Dirt,      "scavenger", 2);
        SpawnNpcsInRooms(z, rng, rooms, "scavenger",      2);

        // 9. Player entry — south end of the main trail.
        var (px, py) = z.FindSpawnNear(trailX, H - 4);
        return (px, py);
    }

    private static void FurnishForestStructure(ZoneManager z, Random rng, Rect room, bool cabin)
    {
        if (room.W < 2 || room.H < 2) return;
        if (cabin)
        {
            PlaceFurniture(z, rng, room, FurnitureKind.Bed);
            PlaceFurniture(z, rng, room, FurnitureKind.Stove);
            if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Workbench);
            if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
        }
        else
        {
            // Old ranger post / supply depot
            PlaceFurniture(z, rng, room, FurnitureKind.Crate);
            PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
            if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Locker);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Waterfront — docks, flooded warehouses, water hazards
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateWaterfront(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Sand/concrete base — derelict industrial shoreline.
        z.FillZ(0, TileType.Concrete);
        DrawBorder(z, W, H);

        // 2. Open water on the right third — harbour/estuary.
        int shoreLine = W * 2 / 3;
        for (int y = 1; y < H - 1; y++)
        for (int x = shoreLine; x < W - 1; x++)
            z.SetTile(x, y, 0, TileType.Water);

        // 3. Shore strip — shallow water and sand at the water's edge.
        for (int y = 1; y < H - 1; y++)
        {
            z.SetTile(shoreLine - 1, y, 0, TileType.ShallowWater);
            z.SetTile(shoreLine - 2, y, 0, TileType.Sand);
        }

        // 4. Quayside road running north-south along the shore.
        int quayX = shoreLine - 4;
        z.DrawVLine(quayX,     1, H - 2, 0, TileType.Asphalt);
        z.DrawVLine(quayX + 1, 1, H - 2, 0, TileType.Asphalt);
        for (int y = 1; y < H - 1; y++)
        { TrySidewalk(z, quayX - 1, y); TrySidewalk(z, quayX + 2, y); }

        // 5. Dock planks extending over the water at intervals.
        int dockCount = rng.Next(3, 6);
        for (int d = 0; d < dockCount; d++)
        {
            int dy = 4 + d * (H / (dockCount + 1));
            int dockLen = rng.Next(6, 14);
            for (int x = shoreLine - 3; x < Math.Min(W - 2, shoreLine + dockLen); x++)
                z.SetTile(x, dy, 0, TileType.WoodFloor);
            // Widen some docks.
            if (rng.Next(2) == 0 && dy + 1 < H - 1)
                for (int x = shoreLine - 2; x < Math.Min(W - 2, shoreLine + dockLen - 2); x++)
                    z.SetTile(x, dy + 1, 0, TileType.WoodFloor);
        }

        // 6. Dock safety barriers and bollards.
        for (int d = 0; d < dockCount; d++)
        {
            int dy = 4 + d * (H / (dockCount + 1));
            PlaceOnTile(z, shoreLine - 3, dy, TileType.Barrier);
            PlaceOnTile(z, shoreLine - 3, dy - 1, TileType.Barrier);
        }

        // 7. Quayside benches for dock workers.
        for (int y = 6; y < H - 4; y += 12)
            PlaceOnTile(z, quayX - 1, y, TileType.Bench);

        // 8. Streetlights along the quayside.
        for (int y = 3; y < H - 2; y += 8)
        { PlaceOnTile(z, quayX - 1, y, TileType.Streetlight); PlaceOnTile(z, quayX + 2, y, TileType.Streetlight); }

        // 9. Manhole covers on the quayside road.
        PlaceOnTile(z, quayX,     H / 4,     TileType.Manhole);
        PlaceOnTile(z, quayX + 1, H * 3 / 4, TileType.Manhole);

        // 10. Chain-link fence separating warehouses from the quayside.
        StampFenceLine(z, rng, 2, H / 3, true, quayX - 3);
        StampFenceLine(z, rng, 2, H * 2/3, true, quayX - 3);

        // 11. Warehouses on the land side — 4 buildings.
        var rooms = new List<Rect>();
        int warehouseW = quayX - 5;
        int[][] whouses = {
            new[]{ 2,           3,         warehouseW / 2, H / 2 - 4 },
            new[]{ 2,           H / 2 + 2, warehouseW / 2, H / 2 - 4 },
            new[]{ warehouseW/2 + 4, 3,   warehouseW / 2, H / 2 - 4 },
            new[]{ warehouseW/2 + 4, H/2+2, warehouseW/2, H / 2 - 4 },
        };
        foreach (var b in whouses)
        {
            int bx = b[0], by = b[1], bw = b[2], bh = b[3];
            if (bw < 6 || bh < 5 || bx + bw >= quayX - 1 || by + bh >= H - 1) continue;
            z.DrawRect(bx, by, bw, bh, 0, TileType.MetalWall, TileType.Floor);
            PlaceDoor(z, rng, bx, by, bw, bh, false);
            // High industrial windows.
            for (int wx = bx + 2; wx < bx + bw - 1; wx += 4)
                if (z.GetTile(wx, by, 0).IsWall) z.SetTile(wx, by, 0, TileType.Window);
            var room = new Rect(bx + 1, by + 1, bw - 2, bh - 2);
            rooms.Add(room);
            FurnishWaterfrontRoom(z, rng, room);
        }

        // 12. Outdoor crate stacks on the quayside and dock ends.
        ScatterOnTileType(z, rng, TileType.Concrete, W, H, TileType.Trash, 0.04);
        for (int i = 0; i < 6; i++)
        {
            int cx = rng.Next(quayX - 8, quayX);
            int cy = rng.Next(2, H - 2);
            var t = z.GetTile(cx, cy, 0);
            if (!t.IsBlocked && !t.IsWall)
            {
                var crate = Furniture.Create(FurnitureKind.Crate, cx, cy, 0);
                z.AddObject(crate);
                PopulateContainer(crate, rng);
            }
        }

        // 13. NPC spawns — raiders and scavengers contest the warehouses,
        //     armed raiders patrol the quayside.
        SpawnNpcsInRooms(z, rng, rooms, "raider",      3);
        SpawnNpcsInRooms(z, rng, rooms, "scavenger",   3);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Asphalt,   "armed_raider", 2);
        SpawnNpcsOnTile(z, rng, W, H, TileType.WoodFloor, "raider",       2);

        // 14. Player entry — south-west corner (land side).
        var (px, py) = z.FindSpawnNear(3, H - 4);
        return (px, py);
    }

    private static void FurnishWaterfrontRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;
        int roll = rng.Next(3);
        switch (roll)
        {
            case 0: // Shipping storage
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                break;
            case 1: // Dock office
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.FilingCabinet);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                break;
            case 2: // Worker locker room
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Workbench);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Subway — long platform tunnels, dark corridors, echo-heavy
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateSubway(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;

        // 1. Solid concrete — everything is carved out of the underground.
        z.FillZ(0, TileType.SewerWall);
        DrawBorder(z, W, H);

        // 2. Two long parallel tunnels with raised platform strips.
        int t1Y = H / 3;
        int t2Y = 2 * H / 3;
        int tunnelH = 5;

        // Tunnel 1 — track bed + platforms
        z.FillRect(1, t1Y - tunnelH / 2, W - 2, tunnelH, 0, TileType.Floor);
        z.DrawHLine(1, t1Y - tunnelH / 2 - 1, W - 2, 0, TileType.TileFloor); // north platform
        z.DrawHLine(1, t1Y + tunnelH / 2 + 1, W - 2, 0, TileType.TileFloor); // south platform

        // Tunnel 2
        z.FillRect(1, t2Y - tunnelH / 2, W - 2, tunnelH, 0, TileType.Floor);
        z.DrawHLine(1, t2Y - tunnelH / 2 - 1, W - 2, 0, TileType.TileFloor);
        z.DrawHLine(1, t2Y + tunnelH / 2 + 1, W - 2, 0, TileType.TileFloor);

        // 3. Platform furniture — benches and barriers evoke a real station.
        //    T1 north platform
        for (int x = 6; x < W - 4; x += 10)
        {
            PlaceOnTile(z, x, t1Y - tunnelH / 2 - 1, TileType.Bench);
            PlaceOnTile(z, x, t2Y - tunnelH / 2 - 1, TileType.Bench);
        }
        //    T1 south / T2 south platform benches
        for (int x = 10; x < W - 4; x += 10)
        {
            PlaceOnTile(z, x, t1Y + tunnelH / 2 + 1, TileType.Bench);
            PlaceOnTile(z, x, t2Y + tunnelH / 2 + 1, TileType.Bench);
        }
        // Turnstile barrier remnants at platform ends.
        PlaceOnTile(z, 3,     t1Y - tunnelH / 2 - 1, TileType.Barrier);
        PlaceOnTile(z, 3,     t2Y - tunnelH / 2 - 1, TileType.Barrier);
        PlaceOnTile(z, W - 4, t1Y + tunnelH / 2 + 1, TileType.Barrier);
        PlaceOnTile(z, W - 4, t2Y + tunnelH / 2 + 1, TileType.Barrier);

        // 4. Manhole/maintenance hatches on the platforms.
        PlaceOnTile(z, W / 4,     t1Y - tunnelH / 2 - 1, TileType.Manhole);
        PlaceOnTile(z, W * 3 / 4, t2Y + tunnelH / 2 + 1, TileType.Manhole);

        // 5. Trash scattered on platforms and tunnel floor.
        ScatterOnTileType(z, rng, TileType.TileFloor, W, H, TileType.Trash, 0.10);
        ScatterOnTileType(z, rng, TileType.Floor,     W, H, TileType.Trash, 0.06);

        // 6. Cross-passages connecting the two lines + service rooms.
        int passCount = W / 20;
        var rooms = new List<Rect>();
        for (int i = 0; i <= passCount; i++)
        {
            int px = 4 + i * 20;
            if (px >= W - 4) break;
            int py1 = t1Y + tunnelH / 2 + 2;
            int py2 = t2Y - tunnelH / 2 - 1;
            if (py2 - py1 < 2) continue;
            z.DrawVLine(px, py1, py2 - py1, 0, TileType.Floor);

            // Service room at roughly every other passage.
            if (rng.Next(2) == 0 && px + 7 < W - 2 && py1 + 5 < py2)
            {
                int rw = rng.Next(5, 8);
                int rh = rng.Next(4, 6);
                z.DrawRect(px + 1, py1 + 1, rw, rh, 0, TileType.ConcreteWall, TileType.Floor);
                PlaceDoor(z, rng, px + 1, py1 + 1, rw, rh, false);
                var room = new Rect(px + 2, py1 + 2, rw - 2, rh - 2);
                if (room.W >= 2 && room.H >= 2)
                {
                    rooms.Add(room);
                    FurnishSubwayRoom(z, rng, room);
                }
            }
        }

        // 7. Standing water puddles in tunnels and passages.
        for (int i = 0; i < 16; i++)
        {
            int wx = rng.Next(2, W - 2);
            int wy = rng.Next(t1Y - tunnelH / 2, t2Y + tunnelH / 2 + 2);
            var t = z.GetTile(wx, wy, 0);
            if (!t.IsBlocked && !t.IsWall) z.SetTile(wx, wy, 0, TileType.ShallowWater);
        }

        // 8. NPC spawns — raiders camp platforms, armed raiders patrol passages.
        SpawnNpcsOnTile(z, rng, W, H, TileType.TileFloor, "raider",       4);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Floor,     "armed_raider", 3);
        SpawnNpcsInRooms(z, rng, rooms, "scavenger",       2);

        // 9. Player entry — west end of tunnel 1 platform.
        var (spx, spy) = z.FindSpawnNear(3, t1Y - tunnelH / 2 - 1);
        return (spx, spy);
    }

    private static void FurnishSubwayRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;
        int roll = rng.Next(3);
        switch (roll)
        {
            case 0: // Maintenance locker room
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                PlaceFurniture(z, rng, room, FurnitureKind.Locker);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Workbench);
                break;
            case 1: // Old station office
                PlaceFurniture(z, rng, room, FurnitureKind.FilingCabinet);
                PlaceFurniture(z, rng, room, FurnitureKind.Table);
                PlaceFurniture(z, rng, room, FurnitureKind.Chair);
                break;
            case 2: // Raider stash
                PlaceFurniture(z, rng, room, FurnitureKind.Crate);
                PlaceFurniture(z, rng, room, FurnitureKind.Shelf);
                if (rng.Next(2) == 0) PlaceFurniture(z, rng, room, FurnitureKind.Cabinet);
                break;
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Sewer (stub — returns a simple tunnel grid for now)
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateSewer(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;
        z.FillZ(0, TileType.SewerWall);
        DrawBorder(z, W, H);

        // Central corridor cross
        z.DrawHLine(1, H / 2, W - 2, 0, TileType.SewerFloor);
        z.DrawVLine(W / 2, 1, H - 2, 0, TileType.SewerFloor);

        // Side branches
        for (int i = 1; i < 4; i++)
        {
            int bx = rng.Next(4, W - 8);
            int by = rng.Next(4, H - 8);
            int bw = rng.Next(6, 14);
            int bh = rng.Next(4, 8);
            if (bx + bw < W - 1 && by + bh < H - 1)
                z.FillRect(bx, by, bw, bh, 0, TileType.SewerFloor);
        }

        // Puddles of standing water
        for (int i = 0; i < 8; i++)
        {
            int wx = rng.Next(2, W - 2);
            int wy = rng.Next(2, H - 2);
            var t = z.GetTile(wx, wy, 0);
            if (!t.IsBlocked) z.SetTile(wx, wy, 0, TileType.ShallowWater);
        }

        SpawnSewerNpcs(z, rng, W, H);
        var (px, py) = z.FindSpawnNear(2, H / 2);
        return (px, py);
    }

    // ──────────────────────────────────────────────────────────────────
    // Corporate Tower (stub — single floor of offices)
    // ──────────────────────────────────────────────────────────────────

    private static (int, int) GenerateCorporateTower(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;
        z.FillZ(0, TileType.TileFloor);
        DrawBorder(z, W, H);

        // Corridor spine down the centre
        z.DrawVLine(W / 2, 1, H - 2, 0, TileType.TileFloor);

        // Office rooms on each side
        var rooms = new List<Rect>();
        int corridorX = W / 2;
        for (int row = 0; row < 4; row++)
        {
            int ry = 2 + row * (H / 5);
            int rh = H / 6;

            // Left office
            var left = new Rect(2, ry, corridorX - 3, rh);
            PlaceOfficeRoom(z, rng, left, doorSide: 1); // door on right wall
            rooms.Add(left);

            // Right office
            var right = new Rect(corridorX + 2, ry, W - corridorX - 4, rh);
            PlaceOfficeRoom(z, rng, right, doorSide: 0); // door on left wall
            rooms.Add(right);
        }

        foreach (var room in rooms)
            FurnishOffice(z, rng, room);

        SpawnCorpNpcs(z, rng, rooms, W, H);
        var (px, py) = z.FindSpawnNear(W / 2, H - 3);
        return (px, py);
    }

    // ──────────────────────────────────────────────────────────────────
    // Building block placement (Urban Ruins)
    // ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// Recursively splits a quadrant into buildings using a simple BSP.
    /// Minimum building size 6×5. Each leaf becomes a room with walls,
    /// a door, and interior floor.
    /// </summary>
    private static void PlaceBuildingBlock(ZoneManager z, Random rng, List<Rect> rooms,
        int bx, int by, int bw, int bh, int depth = 0)
    {
        if (bw < 6 || bh < 5 || depth > 3) return;

        bool splitH = bh > bw || (bw == bh && rng.Next(2) == 0);
        bool canSplitH = bh >= 10;
        bool canSplitV = bw >= 12;

        if (depth < 2 && (canSplitH || canSplitV))
        {
            if (splitH && canSplitH)
            {
                int split = rng.Next(bh / 3, 2 * bh / 3);
                PlaceBuildingBlock(z, rng, rooms, bx, by,          bw, split,        depth + 1);
                PlaceBuildingBlock(z, rng, rooms, bx, by + split + 1, bw, bh - split - 1, depth + 1);
            }
            else if (canSplitV)
            {
                int split = rng.Next(bw / 3, 2 * bw / 3);
                PlaceBuildingBlock(z, rng, rooms, bx,           by, split,        bh, depth + 1);
                PlaceBuildingBlock(z, rng, rooms, bx + split + 1, by, bw - split - 1, bh, depth + 1);
            }
            else
            {
                PlaceBuilding(z, rng, rooms, bx, by, bw, bh);
            }
        }
        else
        {
            // 70% chance to place a building; 30% leave as open rubble-ground.
            if (rng.Next(10) < 7)
                PlaceBuilding(z, rng, rooms, bx, by, bw, bh);
        }
    }

    private static void PlaceBuilding(ZoneManager z, Random rng, List<Rect> rooms,
        int bx, int by, int bw, int bh)
    {
        if (bw < 5 || bh < 4) return;

        // Vary building size slightly so the city doesn't look grid-perfect.
        int margin = rng.Next(0, 2);
        int rx = bx + margin;
        int ry = by + margin;
        int rw = bw - margin * 2;
        int rh = bh - margin * 2;
        if (rw < 5 || rh < 4) return;

        // Pick wall type — mostly brick, some concrete, rare metal.
        TileType wallType = rng.Next(10) switch
        {
            < 6 => TileType.BrickWall,
            < 9 => TileType.ConcreteWall,
            _   => TileType.MetalWall,
        };

        // Damaged/collapsed buildings — 30% chance the building is rubble-heavy.
        bool collapsed = rng.Next(10) < 3;

        z.DrawRect(rx, ry, rw, rh, 0, wallType, TileType.WoodFloor);

        if (collapsed)
        {
            // Punch several holes in the walls and fill interior with rubble.
            PunchWallHoles(z, rng, rx, ry, rw, rh);
            z.FillRect(rx + 1, ry + 1, rw - 2, rh - 2, 0, TileType.Rubble);
        }

        // Door on a random wall face.
        PlaceDoor(z, rng, rx, ry, rw, rh, collapsed);

        if (!collapsed)
        {
            var room = new Rect(rx + 1, ry + 1, rw - 2, rh - 2);
            rooms.Add(room);
        }
    }

    private static void PlaceDoor(ZoneManager z, Random rng, int rx, int ry, int rw, int rh, bool collapsed)
    {
        if (rw < 3 || rh < 3) return; // too small to place a door safely
        // Pick a random wall face and a random position along it.
        for (int attempt = 0; attempt < 10; attempt++)
        {
            int face = rng.Next(4);
            int dx, dy;
            switch (face)
            {
                case 0: dx = rng.Next(1, rw - 1); dy = 0;      break; // top
                case 1: dx = rng.Next(1, rw - 1); dy = rh - 1; break; // bottom
                case 2: dx = 0;      dy = rng.Next(1, rh - 1); break; // left
                default:dx = rw - 1; dy = rng.Next(1, rh - 1); break; // right
            }
            int wx = rx + dx, wy = ry + dy;
            var existing = z.GetTile(wx, wy, 0);
            if (!existing.IsWall) continue;

            if (collapsed)
            {
                // Just an opening in a ruined building.
                z.SetTile(wx, wy, 0, TileType.Floor);
            }
            else
            {
                z.SetTile(wx, wy, 0, TileType.DoorClosed);
                var door = Door.Create(DoorMaterial.WoodBasic, wx, wy, 0, exterior: false);
                z.AddObject(door);
            }
            return;
        }
    }

    private static void PunchWallHoles(ZoneManager z, Random rng, int rx, int ry, int rw, int rh)
    {
        int holes = rng.Next(2, 5);
        for (int i = 0; i < holes; i++)
        {
            int side = rng.Next(4);
            int hx, hy;
            switch (side)
            {
                case 0: hx = rng.Next(rx + 1, rx + rw - 1); hy = ry;       break;
                case 1: hx = rng.Next(rx + 1, rx + rw - 1); hy = ry + rh - 1; break;
                case 2: hx = rx;       hy = rng.Next(ry + 1, ry + rh - 1); break;
                default:hx = rx + rw - 1; hy = rng.Next(ry + 1, ry + rh - 1); break;
            }
            z.SetTile(hx, hy, 0, TileType.Rubble);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Rubble scatter
    // ──────────────────────────────────────────────────────────────────

    private static void ScatterRubble(ZoneManager z, Random rng, List<Rect> rooms, int W, int H)
    {
        int count = W * H / 20;
        for (int i = 0; i < count; i++)
        {
            int sx = rng.Next(1, W - 1);
            int sy = rng.Next(1, H - 1);
            var t = z.GetTile(sx, sy, 0);
            if (!t.IsBlocked && !t.IsWall && !t.IsDoor && !t.IsWater)
            {
                // Don't scatter inside rooms.
                bool inRoom = rooms.Any(r => r.Contains(sx, sy));
                if (!inRoom && rng.Next(5) == 0)
                    z.SetTile(sx, sy, 0, TileType.Rubble);
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Furnishing
    // ──────────────────────────────────────────────────────────────────

    private static void FurnishRoom(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 3 || room.H < 3) return;

        // Randomly pick 1-3 furniture pieces from a themed set.
        FurnitureKind[] furnKinds =
        {
            FurnitureKind.Cabinet,
            FurnitureKind.Shelf,
            FurnitureKind.Locker,
            FurnitureKind.Crate,
            FurnitureKind.Bed,
            FurnitureKind.Chair,
        };

        int pieces = rng.Next(1, 4);
        for (int i = 0; i < pieces; i++)
        {
            int tries = 0;
            while (tries++ < 10)
            {
                int fx = rng.Next(room.X, room.X + room.W);
                int fy = rng.Next(room.Y, room.Y + room.H);
                var t = z.GetTile(fx, fy, 0);
                if (t.IsBlocked || t.ObjectId != 0) continue;

                var kind = furnKinds[rng.Next(furnKinds.Length)];
                var furn = Furniture.Create(kind, fx, fy, 0);
                z.AddObject(furn);

                if (furn.IsContainer) PopulateContainer(furn, rng);
                break;
            }
        }
    }

    private static void FurnishOffice(ZoneManager z, Random rng, Rect room)
    {
        if (room.W < 2 || room.H < 2) return;

        // Office furniture: desks along walls, cabinets.
        FurnitureKind[] furnKinds =
        {
            FurnitureKind.FilingCabinet,
            FurnitureKind.Cabinet,
            FurnitureKind.Locker,
        };

        int pieces = rng.Next(1, 3);
        for (int i = 0; i < pieces; i++)
        {
            int tries = 0;
            while (tries++ < 10)
            {
                int fx = rng.Next(room.X, room.X + room.W);
                int fy = rng.Next(room.Y, room.Y + room.H);
                var t = z.GetTile(fx, fy, 0);
                if (t.IsBlocked || t.ObjectId != 0) continue;

                var kind = furnKinds[rng.Next(furnKinds.Length)];
                var furn = Furniture.Create(kind, fx, fy, 0);
                z.AddObject(furn);
                if (furn.IsContainer) PopulateContainerCorp(furn, rng);
                break;
            }
        }
    }

    private static void PopulateContainer(Furniture furn, Random rng)
    {
        if (!furn.IsContainer) return;
        var families = new[] { "beans", "water_bottle", "bandage", "knife", "flashlight", "can_opener" };
        int count = rng.Next(0, 4);
        for (int i = 0; i < count; i++)
        {
            var item = ItemCatalog.CreateByFamily(families[rng.Next(families.Length)]);
            if (item != null) AddToFurniture(furn, item);
        }
    }

    private static void PopulateContainerCorp(Furniture furn, Random rng)
    {
        if (!furn.IsContainer) return;
        var families = new[] { "medkit", "bandage", "painkiller", "flashlight", "lantern" };
        int count = rng.Next(0, 3);
        for (int i = 0; i < count; i++)
        {
            var item = ItemCatalog.CreateByFamily(families[rng.Next(families.Length)]);
            if (item != null) AddToFurniture(furn, item);
        }
    }

    private static void AddToFurniture(Furniture furn, Item item)
    {
        foreach (var pocket in furn.Pockets)
            if (pocket.TryAdd(item)) return;
    }

    // ──────────────────────────────────────────────────────────────────
    // Corporate Tower — office room helper
    // ──────────────────────────────────────────────────────────────────

    private static void PlaceOfficeRoom(ZoneManager z, Random rng, Rect room, int doorSide)
    {
        z.DrawRect(room.X, room.Y, room.W, room.H, 0, TileType.ConcreteWall, TileType.TileFloor);

        // Door on the specified wall face.
        int mid;
        int dx, dy;
        if (doorSide == 0) // left wall
        {
            mid = room.Y + room.H / 2;
            dx = room.X; dy = mid;
        }
        else // right wall
        {
            mid = room.Y + room.H / 2;
            dx = room.X + room.W - 1; dy = mid;
        }
        if (z.GetTile(dx, dy, 0).IsWall)
        {
            z.SetTile(dx, dy, 0, TileType.DoorClosed);
            z.AddObject(Door.Create(DoorMaterial.WoodBasic, dx, dy, 0, exterior: false));
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // NPC spawning
    // ──────────────────────────────────────────────────────────────────

    private static void SpawnUrbanNpcs(ZoneManager z, Random rng, List<Rect> rooms, int W, int H)
    {
        // Scavengers in rooms, raiders in open streets.
        SpawnNpcsInRooms(z, rng, rooms, "scavenger", 3);
        SpawnNpcsInRooms(z, rng, rooms, "raider",    2);
        SpawnNpcsOnTile(z, rng, W, H, TileType.Asphalt, "raider", 4);
        SpawnNpcsOnTile(z, rng, W, H, TileType.CrackedConcrete, "scavenger", 2);
    }

    private static void SpawnSewerNpcs(ZoneManager z, Random rng, int W, int H)
    {
        SpawnNpcsOnTile(z, rng, W, H, TileType.SewerFloor, "raider", 3);
    }

    private static void SpawnCorpNpcs(ZoneManager z, Random rng, List<Rect> rooms, int W, int H)
    {
        SpawnNpcsInRooms(z, rng, rooms, "armed_raider", 4);
    }

    private static void SpawnNpcsInRooms(ZoneManager z, Random rng, List<Rect> rooms,
        string npcKey, int total)
    {
        if (rooms.Count == 0) return;
        if (!NpcTypes.All.TryGetValue(npcKey, out var profile)) return;

        for (int i = 0; i < total; i++)
        {
            var room = rooms[rng.Next(rooms.Count)];
            for (int attempt = 0; attempt < 10; attempt++)
            {
                int nx = rng.Next(room.X, room.X + room.W);
                int ny = rng.Next(room.Y, room.Y + room.H);
                var t = z.GetTile(nx, ny, 0);
                if (!t.IsBlocked && !t.IsWater && t.ObjectId == 0 && z.GetNpcAt(nx, ny, 0) == null)
                {
                    z.AddNpc(new Npc(profile, nx, ny, 0, rng));
                    break;
                }
            }
        }
    }

    private static void SpawnNpcsOnTile(ZoneManager z, Random rng, int W, int H,
        TileType targetTile, string npcKey, int total)
    {
        if (!NpcTypes.All.TryGetValue(npcKey, out var profile)) return;

        for (int i = 0; i < total; i++)
        {
            for (int attempt = 0; attempt < 40; attempt++)
            {
                int nx = rng.Next(1, W - 1);
                int ny = rng.Next(1, H - 1);
                var t = z.GetTile(nx, ny, 0);
                if (t.Type == targetTile && t.ObjectId == 0 && z.GetNpcAt(nx, ny, 0) == null)
                {
                    z.AddNpc(new Npc(profile, nx, ny, 0, rng));
                    break;
                }
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────
    // Shared helpers
    // ──────────────────────────────────────────────────────────────────

    private static void DrawBorder(ZoneManager z, int W, int H)
    {
        z.DrawHLine(0, 0,     W, 0, TileType.ConcreteWall);
        z.DrawHLine(0, H - 1, W, 0, TileType.ConcreteWall);
        z.DrawVLine(0, 0,     H, 0, TileType.ConcreteWall);
        z.DrawVLine(W - 1, 0, H, 0, TileType.ConcreteWall);
    }

    private static void TrySidewalk(ZoneManager z, int x, int y)
    {
        if (x < 0 || y < 0 || x >= z.Width || y >= z.Height) return;
        var t = z.GetTile(x, y, 0);
        if (!t.IsRoad && !t.IsWall) z.SetTile(x, y, 0, TileType.Sidewalk);
    }

    // ──────────────────────────────────────────────────────────────────
    // Z-level generators
    // ──────────────────────────────────────────────────────────────────

    /// <summary>
    /// Generates a sewer tunnel network at Z=-1.
    /// Finds every Manhole on Z=0 and places a Ladder directly beneath it.
    /// Tunnels connect the ladder positions with SewerFloor corridors.
    /// </summary>
    private static void GenerateSewerLevel(ZoneManager z, Random rng)
    {
        int W = z.Width, H = z.Height;
        const int sz = -1;

        // Fill the entire underground level with solid rock.
        z.FillZ(sz, TileType.SewerWall);

        // Locate every manhole on the surface and carve a 3-wide tunnel network.
        var manholes = new List<(int x, int y)>();
        for (int y = 1; y < H - 1; y++)
        for (int x = 1; x < W - 1; x++)
            if (z.GetTile(x, y, 0).Type == TileType.Manhole)
                manholes.Add((x, y));

        if (manholes.Count == 0) return;

        // Main east-west trunk corridor at mid-height.
        int trunkY = H / 2;
        z.DrawHLine(1, trunkY - 1, W - 2, sz, TileType.SewerFloor);
        z.DrawHLine(1, trunkY,     W - 2, sz, TileType.SewerFloor);
        z.DrawHLine(1, trunkY + 1, W - 2, sz, TileType.SewerFloor);

        // North-south branches every ~20 tiles.
        for (int bx = 10; bx < W - 10; bx += rng.Next(16, 24))
        {
            z.DrawVLine(bx, 1, H - 2, sz, TileType.SewerFloor);
            z.DrawVLine(bx + 1, 1, H - 2, sz, TileType.SewerFloor);
        }

        // Connect each manhole to the nearest sewer floor tile with a shaft.
        foreach (var (mx, my) in manholes)
        {
            // Ladder directly below the manhole.
            z.SetTile(mx, my, sz, TileType.Ladder);

            // Carve a narrow shaft down from the manhole into the trunk.
            int y0 = Math.Min(my, trunkY);
            int y1 = Math.Max(my, trunkY);
            for (int cy = y0; cy <= y1; cy++)
                if (z.GetTile(mx, cy, sz).Type == TileType.SewerWall)
                    z.SetTile(mx, cy, sz, TileType.SewerFloor);
        }

        // Border walls (prevent walking off edge).
        z.DrawHLine(0, 0,     W, sz, TileType.SewerWall);
        z.DrawHLine(0, H - 1, W, sz, TileType.SewerWall);
        z.DrawVLine(0, 0,     H, sz, TileType.SewerWall);
        z.DrawVLine(W - 1, 0, H, sz, TileType.SewerWall);

        // Scatter standing water in wider cavities.
        for (int y = 2; y < H - 2; y++)
        for (int x = 2; x < W - 2; x++)
            if (z.GetTile(x, y, sz).Type == TileType.SewerFloor && rng.Next(14) == 0)
                z.SetTile(x, y, sz, TileType.ShallowWater);

        // A handful of NPCs lurking underground.
        if (!NpcTypes.All.TryGetValue("raider", out var lurker)) return;
        int npcCount = 2 + manholes.Count / 2;
        for (int i = 0; i < npcCount; i++)
        {
            for (int attempt = 0; attempt < 60; attempt++)
            {
                int nx = rng.Next(1, W - 1);
                int ny = rng.Next(1, H - 1);
                if (z.GetTile(nx, ny, sz).Type == TileType.SewerFloor
                    && z.GetNpcAt(nx, ny, sz) == null)
                {
                    z.AddNpc(new Npc(lurker, nx, ny, sz, rng));
                    break;
                }
            }
        }
    }

    /// <summary>
    /// Generates one upper floor of a corporate tower at the given Z level.
    /// Each floor is a grid of offices with a central corridor and stairs
    /// connecting to the floor below. Higher floors have better loot and harder security.
    /// </summary>
    private static void GenerateTowerFloor(ZoneManager z, Random rng, int floor)
    {
        int W = z.Width, H = z.Height;

        // Fill with tile floor.
        z.FillZ(floor, TileType.TileFloor);

        // Outer concrete shell.
        z.DrawHLine(0, 0,     W, floor, TileType.ConcreteWall);
        z.DrawHLine(0, H - 1, W, floor, TileType.ConcreteWall);
        z.DrawVLine(0, 0,     H, floor, TileType.ConcreteWall);
        z.DrawVLine(W - 1, 0, H, floor, TileType.ConcreteWall);

        // Central corridor running the length of the floor.
        int corridorX = W / 2;

        // Office grid — rooms left and right of the corridor.
        var rooms = new List<Rect>();
        int roomH = H / 5;
        for (int row = 0; row < 4; row++)
        {
            int ry = 2 + row * (H / 5);
            var left  = new Rect(2,             ry, corridorX - 3, roomH);
            var right = new Rect(corridorX + 2, ry, W - corridorX - 4, roomH);
            if (left.W >= 4 && left.H >= 3)
            {
                PlaceOfficeRoom(z, rng, left, doorSide: 1, zLevel: floor);
                rooms.Add(left);
            }
            if (right.W >= 4 && right.H >= 3)
            {
                PlaceOfficeRoom(z, rng, right, doorSide: 0, zLevel: floor);
                rooms.Add(right);
            }
        }

        // Furnish offices.
        foreach (var room in rooms)
            FurnishOfficeOnZ(z, rng, room, floor);

        // Stairs down to the floor below (always in a fixed spot so the player can find them).
        int stairX = corridorX;
        int stairY = H - 3;
        z.SetTile(stairX, stairY, floor, TileType.StairsDown);

        // Stairs up — only if this isn't the top floor.
        if (floor < z.MaxZ)
            z.SetTile(stairX, 3, floor, TileType.StairsUp);

        // On Z=0, place StairsUp to reach floor 1 (near south entry).
        if (floor == 1)
            z.SetTile(stairX, stairY, 0, TileType.StairsUp);

        // Security — more guards on higher floors.
        int guardCount = 2 + floor;
        if (!NpcTypes.All.TryGetValue("armed_raider", out var guard)) return;
        for (int i = 0; i < guardCount; i++)
        {
            for (int attempt = 0; attempt < 60; attempt++)
            {
                int nx = rng.Next(1, W - 1);
                int ny = rng.Next(1, H - 1);
                if (z.GetTile(nx, ny, floor).Type == TileType.TileFloor
                    && z.GetNpcAt(nx, ny, floor) == null)
                {
                    z.AddNpc(new Npc(guard, nx, ny, floor, rng));
                    break;
                }
            }
        }
    }

    /// <summary>Places an office room outline + door on a given Z level.</summary>
    private static void PlaceOfficeRoom(ZoneManager z, Random rng, Rect r, int doorSide, int zLevel = 0)
    {
        if (r.W < 4 || r.H < 3) return;
        z.DrawRect(r.X, r.Y, r.W, r.H, zLevel, TileType.ConcreteWall, TileType.TileFloor);
        // Door on the corridor-facing wall.
        int doorY = r.Y + r.H / 2;
        int doorX = doorSide == 1 ? r.X + r.W - 1 : r.X;
        if (doorY >= r.Y && doorY < r.Y + r.H)
            z.SetTile(doorX, doorY, zLevel, TileType.DoorClosed);
    }

    /// <summary>Furnishes an office room on a specific Z level.</summary>
    private static void FurnishOfficeOnZ(ZoneManager z, Random rng, Rect room, int zLevel)
    {
        if (room.W < 1 || room.H < 1) return;
        FurnitureKind kind = rng.Next(4) switch
        {
            0 => FurnitureKind.FilingCabinet,
            1 => FurnitureKind.Locker,
            2 => FurnitureKind.Shelf,
            _ => FurnitureKind.Table,
        };
        for (int attempt = 0; attempt < 12; attempt++)
        {
            int fx = rng.Next(room.X, room.X + room.W);
            int fy = rng.Next(room.Y, room.Y + room.H);
            var t = z.GetTile(fx, fy, zLevel);
            if (t.IsBlocked || t.IsWall || t.IsDoor || t.ObjectId != 0) continue;
            var furn = Furniture.Create(kind, fx, fy, zLevel);
            z.AddObject(furn);
            if (furn.IsContainer) PopulateContainer(furn, rng);
            return;
        }
    }

    /// <summary>Simple axis-aligned integer rectangle.</summary>
    public readonly record struct Rect(int X, int Y, int W, int H)
    {
        public bool Contains(int x, int y)
            => x >= X && x < X + W && y >= Y && y < Y + H;
    }
}
