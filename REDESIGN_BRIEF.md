# Night Run Redesign Brief

**Date:** September 2026
**Status:** Direction adopted. Phase 0 shipped. Phases 1 to 5 are the roadmap.

This is the design record for the hub-and-run redesign that followed the
first-person pivot. It replaces the "Street Kid intro / journal / POI"
milestone that older docs still mention. When a doc disagrees with this one,
this one wins.

---

## 1. Findings that drove the redesign

Numbered so the roadmap can refer to them.

| # | Finding | Kind |
|---|---------|------|
| F-1 | Nothing outside the player persisted between visits. Every drop-in built a fresh `World` from the seed: cabinets refilled, doors relocked, dropped items vanished. **Fixed in Phase 0.** | blocker |
| F-2 | The starting hub was unreachable once you left it. Downstairs was built by a start-only code path on the centre tile, whose real zone was whatever the pool rolled. **Fixed in Phase 0.** | blocker |
| F-3 | The overworld is a 160x100 tile grid. 40% is open water. Landmark zones with proper-noun names recur hundreds of times (Old Town Hall 392x in one seed). Fine as a region map, wrong as the travel surface. | friction |
| F-4 | Street zones are 128x128 lots shaped for a top-down camera. In first person they read as a flat plane fading to fog. Open space is illegible in a grid crawler; walls give you position. | friction |
| F-5 | Sites exit to the map screen, not to a place. No spatial continuity between buildings. | friction |
| F-6 | No pull and no end: no extraction points generate, no NPCs spawn, sites have furniture but zero floor items. | friction |
| F-7 | Design docs disagreed with the code (locked milestone referenced removed systems). **Fixed alongside Phase 0.** | friction |
| F-8 | The simulation stack (anatomy combat, abilities, crafting, containers, survival, time, lighting) is deep and does not need to move. | asset |
| F-9 | The interior site generator already embodies the map philosophy first person needs: cell-kind grid, BFS halls, wall invariant, capped rooms, baked light. | asset |

---

## 2. The shape: hub and run

One persistent town and the places you can reach from it. The town is the
only place that is safe, the only place that persists from turn one, and the
only place with people who want things. Everything else is a site you go to
and come back from. That is what "Night Run" already says.

Three kinds of node, nothing else:

- **Hub.** One per run (Downstairs). Persistent from the first turn. Stash,
  bench, bed, board, four or five people with roles. Safe by default, not
  unconditionally.
- **Sites.** Multi-floor interiors from the existing generator, and street
  blocks rebuilt as corridors (section 3). Each has a profile, an encounter
  budget, and one or two set pieces. Persistent once visited.
- **Routes.** The edges. Travel costs time and may drop you into a short
  encounter slice or a walkable block. Some routes are locked behind a key, a
  project, or a faction state. Routes are how the district grows without
  adding tiles.

What this retires: the tile grid as the travel surface, edge-walking between
128x128 zones, drop-in from a cursor. What it keeps: `OverworldMap` as a
future region generator (multiple towns), the zone pools as a menu of site
profiles, and free travel. You still choose where to go and when; you choose
from a graph with names instead of a sea of tiles.

---

## 3. Maps and traversal

### Streets become corridors with sky

The site generator's invariants are first-person rules, not interior rules.
A street block is generated the same way: streets are corridors three to
five cells wide, building facades are the walls, storefronts and lobbies are
rooms hanging off the hall with one doorway each, alleys are one-wide side
corridors. Rubble and car husks are furniture against walls, never splitting
the hall. The only new concept is a `sky` flag on the level so the renderer
draws sky instead of ceiling and lighting treats the corridor as exterior.

Storefronts are **enterable rooms with their own interior design**: a bodega
has shelves and a counter, a pawn shop has cages and a bench, a clinic has an
exam room. `UrbanFragments.js` becomes the source of these room presets.

Size target: a block is about 48x40, a quarter of the current footprint.
That is what makes persistence cheap and a block learnable like a floor.

### Sites get more than one way in

Front door onto the street. Service door into the alley, locked. Fire escape
to floor 1. Manhole to the sublevel if the route came through the sewer.
Entrances are tagged with the route they serve; occupations and keys decide
which ones you can use.

### Routes: mixed, leaning abstract (decision taken)

Travelling an edge advances the clock by the route's length, drains hunger,
thirst, and light fuel accordingly, and rolls against the route's danger.

- A quiet roll lands you at the destination's entrance.
- A loud roll drops you into a **route slice**: a 20x28 corridor map, one
  screen of street, underpass, or lot, with an encounter and an exit.
- Some routes are **walkable blocks** end to end: the streets around the hub,
  a market strip, anywhere the place itself is the content. These are full
  block sites that happen to have two exits.

The mix is deliberate: more abstract than walkable, so travel is never a
chore, but enough walkable street that the district feels like a place and
storefronts are somewhere you walk past and into. Any route can be promoted
from abstract to walkable later; the graph does not care.

### Vertical stays the interesting axis

Sublevels connect. The Kiroshi server sublevel and the Henderson pump level
can share a maintenance tunnel, a route whose ends are stairwells. Metro
Depths is a natural spine under the district, reachable from several
basements once the pumps run.

### What the first-person view needs from the maps

- **Floor props** per room type so a room is recognisable from the doorway.
- **Daylight leaks** through doors and glass so interiors are not black at
  08:00. (Hub buildings got baked lights in Phase 0 as a stopgap.)
- **Landmark walls**: one wall material per site, one per district.
- **Cone FoV and facing combat**, already planned; they matter more once
  corridors are the norm.

---

## 4. The run flow

A run is a day. Leave the hub with a reason, spend light and time inside a
site, come back and bank it, or don't.

**Prepare** at the hub: board, craft, stash, eat, sleep to dusk or dawn,
pick a site and a route, kit for the light budget.
**Travel** the route: time passes; maybe a slice or a block.
**Run** the site: floors, doors, occupants, one set piece; weight and light
are the timers.
**Return** and bank it: the site's state is saved with it; hand in what was
asked; needs tick down; the board changes.

**Start.** Occupation picks your hub role, first contact, and first pull.
One line of "who at the hub knows you" and one of "what you owe or want"
per background. No quest system: a contact, a site, a want.

**Pull.** Two data sources. *Hub needs* are standing pulls (water, food,
meds, parts, power) that drain per day and read off item tags. *Contracts*
are one-shot pulls posted by hub NPCs. Inside a site, the pull is the *set
piece*: a keyed door, a patient, a generator, placed by the generator into a
reserved room.

**Pressure.** Three clocks, all existing systems: light, weight, night.
Night is soft for now (routes roll worse after dark), medium once the gate
role exists (gate closes, late return costs something).

**End.** Permadeath, or *extraction as a project*: the five extraction paths
become hub projects with component lists. Same data shape as a colony
project, which is the point of section 5.

---

## 5. Hub to colony

The colony layer is the natural sink for the crafting system. Nothing in the
game asked for a tier-4 object except convenience. A town does.

**Persistence first.** Done in Phase 0: `Game.zoneCache` keeps every
visited zone's `World` and FoV alive; the player entity moves between them.
Serialising that map is the save system later.

**The hub is people, not buildings.** Roles are what the NPC catalog becomes
first, before hostiles:

| Role | Talks to | Later becomes |
|------|----------|---------------|
| Quartermaster | stash, needs board, parts contracts | stockpile and rationing |
| Doc | treatment beyond your kit, med contracts | clinic project, chrome |
| Mechanic | bench bonus, repairs, tool contracts | power and water projects, vehicle extraction |
| Fixer | route intel, keys, faction state | opening routes, faction contracts |
| Gate | who is in, what time it is | defence project, night attacks |

**Needs and projects are one data shape.** A *need* is a level, a daily
drain, and item tags that refill it. A *project* is a recipe with a location:
component requirements in the crafting system's property language, a turn
cost, a tool, and an effect (a route opens, a light comes on, a service
unlocks). `CraftingSystem.canCraftItem` logic evaluates a project against
the stash. That is the whole colony layer in v1. Hub rooms as projects and
followers who take roles come after, if v1 earns it.

**What keeps it Night Run.** You never manage the hub from a menu while time
passes. Everything happens in first person, in turns. The hub is a site you
own.

---

## 6. Decisions taken

1. **Tile overworld:** shelved behind the existing Tab map for now; returns
   later as a region map between towns. Code kept.
2. **Routes:** mixed, leaning abstract. Slices by default; walkable blocks
   where the place earns it (streets around the hub, storefront strips).
3. **Night:** soft now, medium once the gate role exists.
4. **Persistence:** in memory now (Phase 0), serialised save in Phase 4.
   Cache holds plain data on the worlds, no closures in state.

---

## 7. Roadmap

Each phase leaves the game playable and smoke-testable per `CLAUDE.md`.

**Phase 0 (done): zones persist and the hub is a node.**
`Game.zoneCache`; hub pinned to the overworld centre tile as `safe_hub`;
arrival at the South Gate; baked hub lights; Crew Stash; bunks with Rest and
Sleep (metabolism halved, wakes on hostiles, cost shown before you commit).

**Phase 1: district graph replaces overworld travel.**
`DistrictCatalog` (nodes, entrances, routes with length, danger, lock);
travel screen replaces the Tab map (grid behind a debug key); site exit
returns to the node you came from or to the route; route resolution with
time cost, survival drain, danger roll; slices stubbed.

**Phase 2: streets as corridors, slices, and light.**
`block` layout in the interior generator (wide halls, shopfront rooms,
alley side-halls, `sky`); retire the seven hand-placed street generators
and port Corner Block, Market Corner, Neon Row as block profiles with
fragment-based room presets; route slice profiles; walkable routes; daylight
leak; wall material per site; floor props per room type.

**Phase 3: people, pull, and the run.**
Roster v1 (five hub roles, three site occupants, two roamers); hub needs;
contracts and the board; one start contract per occupation; set pieces in
reserved rooms; encounter budget per floor; night danger on routes.

**Phase 4: projects and extraction.**
Projects as recipes with a location; three district projects; one
extraction path end to end (boat at the marina); save and load from the
zone cache.

**Phase 5: colony layer proper, if Phase 4 earns it.**
Hub rooms as projects; followers; factions as route and entrance modifiers;
the region map returns for a second town.

Parallel to all of it: cone FoV, facing combat, wall faces.
