# Fractured City — Design Brainstorm
**Date:** April 29, 2026  
**Source:** ChatGPT brainstorm session

---

## Core Design Philosophy

> Same map. Same combat. Same items. Different character goals make it a different game.

Every talent answers one plain question: **What new option does this give the player?**

- **Bad:** "+5% damage with swords."
- **Useful:** "You can target arms with swords to disarm enemies."
- **Better:** "You can cut a weapon hand. If the hand is damaged enough, the enemy drops their weapon."

Start with abilities that **unlock actions**, not tiny stat bonuses.

---

## Talent Job Categories

A talent should do one of these jobs:

| # | Role | Plain Purpose |
|---|------|---------------|
| 1 | Deal damage | Kill or disable enemies faster |
| 2 | Avoid damage | Survive combat |
| 3 | Control enemies | Stop enemies from doing what they want |
| 4 | Move better | Positioning and escape |
| 5 | Understand the situation | Make better decisions |
| 6 | Use gear better | Make equipment matter |
| 7 | Craft or modify things | Create solutions from junk |
| 8 | Heal or manage injuries | Stay functional after bad fights |
| 9 | Bypass obstacles | Open paths without fighting |
| 10 | Manipulate NPCs | Solve problems socially |
| 11 | Use Echo | Weird information/control powers |
| 12 | Use Chrome | Cybernetic advantage with maintenance costs |

---

## Talent Categories (Start Small)

### Combat — fight better
Basic Melee, Blocking, Dodging, Blades, Blunt Weapons, Unarmed, Firearms

### Movement — move, escape, sneak
Athletics, Stealth, Climbing, Disengage

### Awareness — know what is happening
Perception, Inspection, Enemy Reading, Trap Sense

### Crafting — make and repair things
Salvage, Basic Crafting, Repair, Electronics, Explosives

### Medical — manage body damage
First Aid, Surgery, Drug Use, Anatomy

### Social — NPC solutions
Intimidation, Bargaining, Lying, Faction Etiquette

### Chrome — cybernetic build path
Install Chrome, Maintain Chrome, Heat Control, Sensors, Integrated Weapons

### Echo — signal build path
Attunement, Strain Control, Prediction, Memory Reading, Signal Manipulation

---

## Archetype System

Each archetype has:
1. Starting kit
2. Core ability
3. Personal goal
4. Level-up talent pool
5. Unique win condition angle

### Prototype Archetypes (6 core)

#### Scavenger
- **Goal:** Recover valuable parts
- **Main loop:** Search buildings, identify useful junk, salvage parts, avoid fights
- **Special goals:** Recover 5 rare components / repair a broken extraction device / build a working escape tool / complete a salvage contract
- **Unique ability:** Better item inspection and salvage quality

#### Raider Defector
- **Goal:** Survive old enemies and prove separation from the gang
- **Main loop:** Combat, intimidation, avoiding bounty hunters, choosing mercy or brutality
- **Special goals:** Kill or evade a hunting squad / rescue someone from your old gang / destroy gang stash / clear your name with a faction
- **Unique ability:** Combat confidence, intimidation, dirty fighting

#### Field Medic
- **Goal:** Save people, stabilize bodies, recover medical data
- **Main loop:** Treat NPCs, harvest supplies, avoid unnecessary killing
- **Special goals:** Save 3 injured NPCs / retrieve medicine from clinic / stabilize yourself after major injury / extract with medical research
- **Unique ability:** Better injury diagnosis and treatment

#### Corpo Defector
- **Goal:** Erase your corporate trail or weaponize it
- **Main loop:** Hacking, social access, locked doors, corporate sites
- **Special goals:** Delete your ID from a server / steal blackmail data / spoof credentials / contact an extraction broker
- **Unique ability:** Access to terminals, credentials, social deception

#### Street Kid
- **Goal:** Protect your block / crew / chosen family
- **Main loop:** Stealth, social shortcuts, street routes, favors
- **Special goals:** Find a missing friend / deliver medicine / recover a stash / settle a street debt
- **Unique ability:** Knows shortcuts, better with local NPCs

#### Echo-Touched
- **Goal:** Understand or control the signal inside you
- **Main loop:** Find fragments, interpret visions, manage strain
- **Special goals:** Attune 3 fragments / enter an Echo zone / speak to dead infrastructure / resist identity collapse
- **Unique ability:** Detect Echo residue and use fragments

### Future Archetypes
Chrome Drifter, Black Clinic Surgeon, Rooftop Runner, Bomb Maker, Signal Prophet, Debt Collector, Smuggler, Cult Escapee, Ex-Security, Junk Mechanic

---

## Goal Types

### Primary Goal
Big identity goal for that character.  
*Example — Field Medic: "Save lives and recover medical supplies."*

### Floor / District Goals (small local goals)
- Rescue injured NPC
- Recover data from clinic
- Destroy gang marker
- Open a locked stash
- Repair a generator
- Sabotage camera system
- Steal medicine / kill a specific enemy / avoid killing anyone
- Spread a rumor / plant explosives / recover Echo fragment

### Optional Personal Goals (extra XP, talents, faction favor)
- Do not kill civilians
- Avoid using chrome
- Never trigger alarm
- Extract with rare component
- Save someone from your old faction
- Use only improvised weapons
- Complete objective without being seen

---

## Zone Design

### Zone Tags Model
```js
zone: {
  name: "HelixCare Clinic",
  faction: "helixcare",
  tags: ["clean", "corporate", "medical", "security", "anti_echo"],
  baseDanger: 3,
  accessRules: {
    corpo: +2,
    medic: +2,
    chrome: +1,
    streetKid: -1,
    raider: -2,
    echo: -3
  }
}
```

Archetype modifies: guard suspicion, prices, dialogue options, enemy spawn type, alarm speed, loot access, hidden opportunities.

### Zone Design Questions
- Who feels at home here?
- Who feels hunted here?
- Who sees opportunities here?
- Who sees only danger here?

### Zone Challenge Types

| Type | Description | Good For | Bad For |
|------|-------------|----------|---------|
| Social | Checkpoints, etiquette, bribes | Corpo, Street Kid, Social | Raider, Echo, visibly Chrome |
| Physical | Climbing, rubble, melee ambush | Flesh, Nomad, Bruiser | Corpo, fragile Echo |
| Technical | Locks, cameras, terminals, drones | Chrome, Electronics, Corpo | Flesh without tools |
| Echo | Hallucination rooms, memory loops, fragments | Echo | Chrome, anti-Echo |
| Resource | Tolls, ammo, medicine costs | Scavenger, Trader, Crafting | Combat-only builds |
| Violence | Gang blocks, kill zones, monster nests | Raider, Bruiser | Medic, Social, stealth |

### Archetype Zone Safety

| Archetype | Safe Zones | Unsafe Zones |
|-----------|-----------|--------------|
| Street Kid | Slums, markets, alleys, squats, rooftop camps | Corporate towers, police districts, rich zones |
| Corpo Defector | Corporate ruins, offices, clinics, checkpoints | Gang zones, slums, anti-corp communes |
| Raider Defector | Gang territory, violent zones, black markets | Clinics, civilian shelters, bounty-posted zones |
| Field Medic | Clinics, shelters, neutral camps, humanitarian zones | Raider zones, black clinics, plague zones |
| Scavenger | Junkyards, ruins, industrial zones, abandoned apartments | Secured corporate zones, active gang loot zones |
| Echo-Touched | Signal-dead ruins, Echo zones, abandoned server districts | Chrome/firewall zones, religious anti-Echo zones |
| Chrome Drifter | Mechanic camps, black clinics, industrial zones | EMP zones, anti-chrome factions, Echo-heavy areas |

---

## Faction System

### Faction States
Welcome → Tolerated → Suspicious → Restricted → Hostile → Hunted

*Example: Corpo Defector enters a clinic.*
- Default: Tolerated
- Wearing corpo suit: Welcome
- Carrying stolen medical data: Suspicious
- ID burned: Restricted
- Exposed as defector: Hunted

### Core Factions

#### The Downstairs (street/slum faction)
- **Controls:** Alleys, basements, squats, informal markets
- **Likes:** Street Kid, Scavenger, Medic
- **Dislikes:** Corpo, obvious Chrome security
- **Hates:** Raiders, debt collectors
- **Access:** Street slang, favors, food, medicine, local rep
- **Punishment:** Ambush, stolen gear, blocked routes

#### HelixCare Remnant (corporate medical/security)
- **Controls:** Clinics, labs, medical storage, clean rooms
- **Likes:** Corpo, Medic, Chrome
- **Dislikes:** Street Kid, Scavenger
- **Hates:** Echo-Touched, Raider Defector
- **Access:** Credentials, medical knowledge, clean clothing, patient records
- **Punishment:** Security drones, sedation, containment

#### Rust Choir (chrome cult / mechanic faction)
- **Controls:** Garages, factories, machine shrines
- **Likes:** Chrome, Mechanist, Scavenger
- **Dislikes:** Pure Flesh extremists
- **Hates:** Echo-Touched if they corrupt machines
- **Access:** Machine offerings, spare parts, cybernetic proof
- **Punishment:** EMP traps, limb theft, forced upgrades

#### The Pale Static (echo cult / signal-haunted)
- **Controls:** Server ruins, broadcast towers, subway dead zones
- **Likes:** Echo-Touched, Medium, Prophet
- **Dislikes:** Chrome, Corpo
- **Hates:** Signal suppressors, machine priests
- **Access:** Fragments, strain tolerance, memory rituals
- **Punishment:** Hallucination traps, false paths, identity attacks

#### Black Sash (raider network)
- **Controls:** Violent markets, toll roads, stash houses
- **Likes:** Raider Defector, Bruiser, weapon-heavy builds
- **Dislikes:** Medic, Corpo
- **Hates:** Traitors, weak-looking civilians
- **Access:** Intimidation, violence, old signs, tribute
- **Punishment:** Bounty squads, beatdowns, gear stripping

#### Civic Ghost Authority (dead automated government)
- **Controls:** Checkpoints, transit gates, municipal buildings
- **Likes:** Valid IDs, uniforms, clean records
- **Dislikes:** Everyone else
- **Hates:** Stolen credentials, detected Echo spoofing
- **Access:** ID cards, terminals, social engineering, hacks
- **Punishment:** Alarms, drones, lockdowns

---

## Same Zone, Different Archetype — Examples

### Abandoned Hospital
| Archetype | What They See |
|-----------|--------------|
| Medic | Triage rooms, patient logs, medicine caches |
| Scavenger | Copper wiring, tool cabinets, old batteries |
| Echo | Dead patients in the PA system, memory residue |
| Chrome | Surgical robots, implant parts, clean install room |
| Raider | Gets recognized by wounded survivor, possible revenge event |
| Street Kid | Knows kids used to hide in laundry tunnels |

### Gang Market
| Archetype | Experience |
|-----------|-----------|
| Raider Defector | Can speak gang language but risks being recognized |
| Street Kid | Can blend in and trade |
| Corpo | Gets overcharged or targeted |
| Medic | Can trade healing for passage |
| Echo | Overhears hidden emotional/signal residue |
| Chrome | May be invited to black clinic stall |

### Server Ruin
| Archetype | Experience |
|-----------|-----------|
| Echo | Safe-ish, strong powers, high rewards |
| Chrome | Dangerous — signal interference, module glitches |
| Flesh | Neutral but confused, needs light/map/discipline |
| Corpo | Can understand old labels and security layouts |
| Scavenger | Can strip electronics |
| Raider | Probably hates it, may brute-force through |
