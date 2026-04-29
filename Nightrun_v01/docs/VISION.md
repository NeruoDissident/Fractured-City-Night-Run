# Fractured City: Night Run — Vision Document

**Last Updated:** April 22, 2026  
**Status:** Active design direction — supersedes GAME_DESIGN.md for the C# version

---

## The Pivot

The original JS prototype was a CataDDA-style open-world survival sim.
The C# version pivots to a **zone-based dungeon crawler** in the vein of
*Tales of Maj'Eyal* — deep character builds, curated zones, faction politics,
and the same brutal anatomy/combat depth — but freed from the need to simulate
an entire procedural city block-by-block.

**What this means:**
- The *story* and *character* become the core, not the world simulation
- Each run is a structured arc: build your character → navigate zones → extract
- The lore (The Echo, factions, cybernetics) stops being flavor and becomes mechanics
- Survival systems (hunger/thirst, crafting-to-stay-alive) become optional depth,
  not mandatory loops

---

## The Three-Layer Character System

Character identity has three layers, each locking and unlocking different game systems.
Think Qud's True Kin vs Mutant — but with three divergent paths.

```
LAYER 1 — Origin (replaces "race")
    Flesh  |  Metal  |  Echo

LAYER 2 — Archetype (class within Origin)
    6 archetypes, each available to all Origins
    but with different bonuses, penalties, and locked systems

LAYER 3 — Talent Trees
    Trees unlocked by Origin + Archetype combination
    Purchased with talent points earned through play
```

---

## Layer 1 — Origin

The most fundamental choice. Determines which deep systems you can access.
**Some systems are entirely locked to certain Origins.** This is intentional.
Caves of Qud had the nerve to do this — so do we.

---

### Flesh

*You are entirely human. Unaugmented, uninfected. Your edge is adaptability,
resilience, and the fact that nothing in this city was built to kill specifically you.*

**Core Identity:** The baseline. Every system is available at reduced cost.
No single system goes as deep as the specialists, but nothing is locked.

| System Access | Status |
|---|---|
| Cybernetics | ❌ **Locked** — Flesh rejects implants at a biological level |
| Echo Abilities | ❌ **Locked** — No neural pathway for Echo resonance |
| Crafting (Tinkering) | ✅ Full access — deepest crafting trees available |
| Combat abilities | ✅ Full access |
| Medicine / Field Surgery | ✅ Full access — best anatomy knowledge |
| Faction systems | ✅ Full access |

**Flesh Bonus:** *Adaptability* — Talent point costs reduced by 1 (min 1) across
all non-Origin-locked trees. You can go broader than anyone else.

**Flesh Penalty:** *Ceiling* — No ability can exceed Tier 3 (Metal/Echo can reach Tier 5
in their specialty trees). You are the best generalist, never the best specialist.

**Flesh Archetypes work best as:** Scav King, Medic/Fixer, Street Runner

---

### Metal

*You have replaced parts of yourself with machine. Steel tendons, wired reflexes,
sub-dermal plating. You gave up pieces of your humanity for an edge that never dulls.*

**Core Identity:** The augmented warrior. Cybernetics are your defining system —
installations, upgrades, failure cascades, black-market surgeons. The most mechanically
complex and dangerous path.

| System Access | Status |
|---|---|
| Cybernetics | ✅ **Full access** — only Origin that can install implants |
| Echo Abilities | ❌ **Locked** — Machine interference blocks Echo resonance |
| Crafting (Tinkering) | 🟡 Partial — electronics and weapon mods only |
| Combat abilities | ✅ Full access |
| Medicine | 🟡 Partial — can self-repair cybernetics, limited organic medicine |
| Faction systems | ✅ Full access |

**Metal Bonus:** *Augmented Baseline* — Start with one free Tier-1 cybernetic implant
chosen at character creation. Cybernetic installation success rates +15%.

**Metal Penalty:** *Mechanical Soul* — Echo entities treat you as a priority target
(you emit a signal). EMP effects deal double damage. Certain factions (Echo Cult)
are permanently hostile.

**Metal Archetypes work best as:** Enforcer, Corporate Exile, Street Runner

---

### Echo

*Something got in. A fragment of the distributed ASI found purchase in your neural
pathways — and you survived. You are neither fully human nor fully machine.
You are something the world has never seen before.*

**Core Identity:** The wildcard. Echo abilities are your defining system — unique,
powerful, deeply weird, and dangerous in ways even you don't fully understand.
The highest ceiling and the highest risk.

| System Access | Status |
|---|---|
| Cybernetics | ❌ **Locked** — Echo fragments reject machine integration (violent rejection) |
| Echo Abilities | ✅ **Full access** — only Origin that can develop Echo powers |
| Crafting (Tinkering) | ❌ **Locked** — Echo interference corrupts delicate assembly |
| Combat abilities | ✅ Full access |
| Medicine | 🟡 Partial — Echo biology is poorly understood; standard medicine unreliable |
| Faction systems | ✅ Full access (but Echo Cult treats you as sacred/dangerous) |

**Echo Bonus:** *Resonance* — Can perceive and interact with Echo entities that
are invisible to other Origins. Echo abilities have no resource cost (they draw
from the ambient Echo field) but carry escalating **Instability** risk.

**Echo Penalty:** *Fragmentation* — Echo Instability builds over the run.
High instability causes uncontrolled ability triggers, perception hallucinations,
and at maximum — permanent personality fragmentation (run-ending condition distinct
from death).

**Echo Archetypes work best as:** Echo Touched, Street Runner, Corporate Exile

---

## Layer 2 — Archetypes

Six archetypes available to all Origins, but each Origin changes what the
archetype *means*. A Metal Enforcer and a Flesh Enforcer play very differently.

| Archetype | Core Role | Signature System |
|---|---|---|
| **Street Runner** | Speed, stealth, evasion | Noise Discipline, Parkour |
| **Corporate Exile** | Tactical, gadgets, information | Hacking, Corporate Access |
| **Echo Touched** | Echo-adjacent abilities (even for Flesh/Metal) | Partial resonance, echo detection |
| **Scav King** | Crafting, improvisation, tool mastery | Tinkering trees (Flesh only at full depth) |
| **Enforcer** | Heavy weapons, intimidation, pain tolerance | Suppression, Limb Targeting |
| **Medic / Fixer** | Anatomy, triage, economy | Field Surgery, Drug Synthesis |

### Origin × Archetype Matrix (flavor examples)

| | Flesh | Metal | Echo |
|---|---|---|---|
| **Street Runner** | Parkour virtuoso, knife fighter | Reflex-boosted sprint, wired reactions | Phase-steps, leaves ghost afterimage |
| **Enforcer** | Pure muscle, intimidation via scars | Hydraulic arms, sub-dermal plating | Fear aura, enemy AI disruption |
| **Medic** | Trauma surgeon, anatomy expert | Self-repair, inject combat drugs | Accelerated tissue regeneration (unnatural) |
| **Scav King** | Full tinkering access, improvised arsenal | Electronics/weapon mods only | ❌ Cannot play (Echo disrupts assembly) |

---

## Layer 3 — Talent Trees

### Tree Categories

**Combat Trees** (all Origins)
- `Brawling` — unarmed, grapple, stagger chains, anatomy targeting
- `Blades` — fast weapons, bleeds, parry, combo finishers
- `Heavy Arms` — slow weapons, crowd control, Limb Breaker, suppression
- `Dirty Fighting` — improvised weapons, environmental kills, cheap shots

**Echo Trees** (Echo Origin only)
- `Glitch` — disrupt enemy AI, re-route patrols, jam weapons
- `Manifest` — summon temporary Echo constructs (service bot distraction, drone fragment)
- `Merge` — permanent body modifications via Echo integration; powerful but with
  permanent side effects (see Echo Instability system)
- `Purge` — anti-Echo abilities, zone-wide Echo suppression, Echo entity control

**Cybernetics Trees** (Metal Origin only)
- `Neural` — reflex boosters, wired aim, pain suppression implants
- `Skeletal` — sub-dermal plating, hydraulic limbs, bone lacing
- `Sensory` — cyber eyes, sonar implants, electromagnetic detection
- `Systemic` — blood oxygenation, organ backups, adrenaline regulators

**Survival / Utility Trees** (all Origins, depth varies)
- `Scavenging` — loot efficiency, component identification, faster disassembly
- `Field Medicine` — anatomy knowledge, self-surgery, medical crafting
- `Stealth` — noise reduction, shadow movement, distraction items
- `Hacking` — terminal access, security bypass, faction comms intercept

**Tinkering Trees** (Flesh full, Metal partial, Echo locked)
- `Improvised Weapons` — shivs to spiked clubs; weapons from scavenged parts
- `Explosives` — pipe bombs, flashbangs, trip wires
- `Electronics` — radio jammers, turret hacking, EMP grenades
- `Armor Mods` — reinforce found armor, add spikes/insulation/pockets

---

## Cybernetics System (Metal Origin)

This is a deep, dangerous, rewarding system. Inspired by the original lore doc's
vision of "gruesome realism."

### Installation Process

Cybernetics are not bought at a shop and equipped like armor.
They require a **procedure** with real risk.

**Requirements to install:**
1. **The implant itself** — found via loot, faction reward, or black market
2. **A surgeon** — an NPC with the required skill level, OR self-surgery (high risk)
3. **Surgical tools** — scalpel, retractors, cauterizer (improvised tools = higher failure)
4. **Anesthetic** — painkillers reduce shock chance; none = anatomy damage during procedure
5. **Sterile environment** — clean tile type reduces infection chance

**Procedure resolution (data-driven, fully visible to player before confirming):**

```
Install: Reflex Booster (Tier 2 Neural)

Surgeon: Dr. Vasquez (Skill 7/10)          ← NPC found in zone
Tools: Surgical Kit (Quality 85%)          ← item condition matters
Anesthetic: Morphine x2
Environment: Medical Bay (sterile)

SUCCESS CHANCE:     82%
PARTIAL SUCCESS:    12%  (implant installs at 60% effectiveness)
FAILURE:            4%   (implant rejected, surgery wounds)
COMPLICATION RISK:  8%   (infection, nerve damage, scarring)

OUTCOME IF SUCCESS:
  + Reflex Booster active: AGI +3, attack cost -15%
  - Right arm surgery wound (heals in ~20 turns)
  - Infection risk 12% if not treated

[Proceed]  [Cancel]
```

### Implant Failure & Cascades

Cybernetics can fail during a run from:
- EMP damage (Echo entities, electrical hazards)
- Physical damage to the implanted body part
- Echo Instability proximity (Echo entities disrupt Metal characters)
- Age/wear (implants have a durability stat)

**Failure cascade:** A failing implant doesn't just stop working.
It can damage the surrounding anatomy. A failing neural implant near
the brain causes seizure effects. A failing hydraulic arm can lock up
mid-combat or spasm uncontrollably.

**Repair:** Requires electronics components + tinkering skill, or an NPC technician.
Temporary stabilization possible with duct tape + basic tools (reduces effectiveness,
prevents cascade, buys time).

### Implant Slots (per body region)

Each anatomy region has a limited number of implant slots.
Installing too many in one region increases cascade failure risk.

```
Head:     2 slots (eyes, ears, neural)
Torso:    3 slots (organ backups, systemic, subdermal)
Each Arm: 2 slots (hydraulic, wired reflexes)
Each Leg: 2 slots (hydraulic, speed mods)
```

---

## Echo Ability System (Echo Origin)

### How Echo Abilities Work

Unlike cybernetics (installed hardware) or combat skills (trained technique),
Echo abilities are **channeled from the ambient Echo field**. They don't cost
mana or stamina — they cost **Instability**.

**Instability:**
- A 0–100 meter, displayed prominently
- Rises when you use Echo abilities
- Rises passively in Echo-dense zones (subway tunnels, server rooms)
- Falls when you rest in Echo-quiet zones
- Cannot be fully emptied — some baseline instability is permanent once acquired

**Instability thresholds:**
```
0–20:   Stable      — abilities function normally
21–40:  Resonant    — minor visual distortion, Echo entities notice you
41–60:  Unstable    — abilities have chance of unintended side effects
61–80:  Fractured   — abilities fire randomly, perception unreliable
81–99:  Critical    — run-ending fragmentation imminent
100:    Fragmenting — run ends (not death — worse: you become an Echo)
```

### Echo NPC Interactions

Echo abilities at higher tiers require **resonance training** — you must have
encountered and studied specific Echo entity types to unlock higher-tier abilities.

```
Glitch Tier 1:  No prerequisite
Glitch Tier 2:  Requires: encountered 3+ Service Bot entities
Glitch Tier 3:  Requires: survived engagement with Military AI
Manifest Tier 1: No prerequisite
Manifest Tier 2: Requires: absorbed a Security System Echo fragment
```

This makes Echo entities simultaneously the most dangerous enemies *and*
the most important NPCs for an Echo character's progression.

---

## Crafting — Reworked Role

### The Shift

Crafting is **no longer a survival necessity**. You do not start naked and
improvise a knife to survive. You start with a loadout appropriate to your
archetype and origin.

Crafting is now:
1. **An optional depth system** accessible to all Origins at a basic level
2. **A core identity system** for the Scav King archetype / Flesh Origin
3. **A Tinkering talent tree** — invest points to go deeper

### What Survives from the Old System

- Component properties and tier gating — preserved, just gated behind talent investment
- Disassembly — still works for everyone (you can always take things apart)
- Item quality variation — still meaningful
- Multi-turn crafting with interruption — preserved

### What Changes

- **No forced crafting** — you can complete a run never crafting a single thing
- **Improvised weapons** become a Tinkering talent, not a starting ability
- **Advanced crafts** (explosives, electronics, armor mods) are deep Tinkering tree content
- **Scav King + Flesh** gets access to the full old crafting depth plus new trees
- **Metal** gets electronics/weapon mod crafting only (fits the archetype)
- **Echo** cannot craft precision items (Echo interference corrupts assembly)

---

## Zone Structure

### Overworld (Phase 1: Selection List → Phase 2: ASCII Map)

Phase 1 is a simple menu. Phase 2 adds an overworld ASCII map with routes,
faction-controlled territories, and travel encounters.

### Zone Types

Each zone is a self-contained map (~80×50 tiles), generated from a zone profile.
No infinite world. No chunk management. One map, fully realized.

| Zone | Tone | Primary Faction | Echo Density | Loot Profile |
|---|---|---|---|---|
| **The Streets** | Entry zone, open conflict | Raiders / Scavengers | Low | Survival gear, scrap |
| **Downtown** | Corner stores, bars, ruins | Fixers / Raiders | Medium | Cash items, weapons |
| **Corporate Enclave** | Grid streets, security | Corporate Remnants | Low | Tech, implants |
| **The Subway** | Dark tunnels, ambush | Echo Cult / Echo entities | Very High | Echo fragments, weird loot |
| **The Sewers** | Branching tunnels, toxic | Scavengers / Echo | High | Components, medical |
| **Collapsed Mall** | Multi-floor ruin | Raiders | Low | Consumer goods, armor |
| **Server Farm** | Dense Echo presence | Military AI / Corporate | Extreme | Tech, cybernetics |
| **The Waterfront** | Escape route zone | Mixed | Medium | Extraction-related items |

### Zone Generation (simplified from current world gen)

```
1. Generate blob rooms (BSP or cellular automata)
2. Connect with corridors (zone type determines style: tunnels vs streets vs halls)
3. Place zone-profile furniture and objects
4. Spawn NPCs per faction profile
5. Place Echo manifestations per Echo density rating
6. Place loot per zone loot profile
7. Place extraction point (if applicable to this zone in the run)
```

---

## Faction System

### Per-Run Reputation

Reputation is earned and spent within a single run. No persistent meta-progression.
Each run you choose which factions to cultivate.

| Faction | Zone Presence | Aligned Origins | Rep Rewards |
|---|---|---|---|
| **Scavengers** | Everywhere | Flesh | Trade, safe house tiles, information |
| **Raiders** | Streets, Ruins | None (hostile default) | Can be recruited at high Enforcer rep |
| **Corporate Remnants** | Corporate Enclave | Metal | Tech items, extraction route, implants |
| **Echo Cult** | Subway, Sewers | Echo | Echo ability unlocks, Instability reduction rituals |
| **The Fixers** | Downtown | All | Quest access, black market, surgeon NPCs |
| **Military AI** | Server Farm | None | Cannot befriend — always hostile |

### Faction Mechanics
- Killing faction members reduces rep
- Completing zone objectives raises rep
- Factions observe your Origin — some are pre-disposed (Echo Cult loves Echo characters)
- High rep unlocks NPC services: surgeons (Metal), Echo trainers (Echo), merchants (Flesh)

---

## Extraction

Extraction is still the win condition and still requires effort.
Zone-based structure makes extraction paths cleaner:

| Path | Required Zones | Key Items | Key Faction |
|---|---|---|---|
| **Helicopter Repair** | Ruins → Waterfront | Engine parts, fuel | Fixers |
| **Corporate Favor** | Corporate Enclave (×2) | Intel, valuable tech | Corporate Remnants |
| **Echo Gate** | Subway → Server Farm | Echo resonance key | Echo Cult |
| **Underground Breach** | Sewers → ? | Cutting tools, explosives | Scavengers |
| **Faction Alliance** | Any zone (×3 quests) | Faction-specific | Any non-hostile |

Echo characters have a unique extraction path (Echo Gate) locked to other Origins.
Metal characters have easiest access to Corporate extraction.
Flesh characters have the most extraction paths available (generalist advantage).

---

## Run Structure & Campaign Model

### Confirmed Decisions

- **No meta-progression between runs.** Death ends everything. What you built
  stays in that run. The next run starts clean.
- **No traditional linear campaign.** There is no Chapter 1 → Chapter 2.
  The world is a web of zones, not a corridor.
- **Each run is a fresh arc** with its own Origin, Archetype, and choices.
  Replayability comes entirely from build depth and zone variation — not unlocks.

### The Zone Web (not a linear campaign)

Each zone is a self-contained map that can be visited in any run.
The *campaign* emerges from tying zones together with objectives, factions,
and a larger world narrative — but the player navigates that web on their own terms.

```
Run structure (approximate):
  Start → choose Origin + Archetype → spawn in Home Zone
       → navigate 3–5 zones per run (player-directed order)
       → work toward one of N extraction paths
       → die or extract

The "campaign" is the accumulation of what each zone contains:
  - Faction storylines that recur across runs (same factions, different states)
  - Zone objectives that connect to a larger arc
  - NPCs with persistent roles (Dr. Vasquez is always the surgeon in the
    Corporate Enclave — she's always there, you just meet her fresh each run)
```

### Archetype Home Zones

Every Archetype + Origin combination has a **Home Zone** — the zone where
that character type is most at home, where they start, and where their
early faction relationships are seeded.

| Archetype | Home Zone | Starting Faction Affinity |
|---|---|---|
| Street Runner (Flesh) | The Streets | Scavengers +20 |
| Street Runner (Metal) | Downtown | Fixers +20 |
| Street Runner (Echo) | The Subway | Echo Cult +20 |
| Corporate Exile (any) | Corporate Enclave | Corporate Remnants +30, Raiders -20 |
| Echo Touched (Echo) | The Subway | Echo Cult +40 |
| Echo Touched (Flesh) | Downtown | Fixers +20, Echo Cult +10 |
| Scav King (Flesh) | Collapsed Mall | Scavengers +30 |
| Enforcer (Metal) | The Streets | Raiders +10 (neutral), Scavengers -10 |
| Enforcer (Flesh) | The Streets | Scavengers +10 |
| Medic / Fixer (any) | Downtown | Fixers +40 |

Every zone is still visitable in every run — Home Zone just determines
where you *start* and what rep you arrive with. A Scav King will eventually
walk through the Corporate Enclave and encounter Corporate Remnants as NPCs.

### Build-Up Order (what we build before the campaign layer)

The campaign web comes **last**. Correct build order:

```
1. Character building (Origin, Archetype, talent trees) — identity is the core
2. Combat depth (abilities, stances, cybernetics, Echo powers)
3. Unique zones — each zone needs its own feel, loot profile, and NPC set
4. Zone objectives — give each run goals beyond "don't die"
5. Factions as social layer — NPCs with roles, services, rep consequences
6. Tie zones into a larger world narrative — the campaign emerges from this
```

This means a fully playable, satisfying roguelike run is achievable long before
the campaign layer exists. Each step adds depth independently.

---

## Design Principles (Updated)

The original GAME_DESIGN.md principles survive, with additions:

1. **Origin gates are real** — Some systems are entirely inaccessible to some Origins.
   This is not a bug. It is the game. Replayability comes from Origin choice.

2. **Procedures, not purchases** — Cybernetic installation and Echo ability acquisition
   require in-world procedures with visible risk/reward, not menu transactions.

3. **Depth where you invest** — A Flesh character who ignores Tinkering never needs
   to think about crafting. A Scav King Flesh who maxes it gets the full old CataDDA
   crafting depth. Investment determines exposure.

4. **Factions are the social layer** — NPCs aren't just enemies. Surgeons, Echo
   trainers, merchants, and quest-givers live inside faction rep systems.

5. **The Echo is mechanical, not just flavor** — Echo entities aren't just weird
   enemies. They are required training targets for Echo characters, threat-level
   determinants for Metal characters, and the primary hazard metric for zone design.

---

## What Gets Built First

See `ROADMAP.md` for the updated execution order.

The architectural tasks (IRenderer interface, Game.cs split into screens,
zone generator replacing world gen) come before any new content.
Then: Origin system → Zone generator → first playable zone → Factions lite.
