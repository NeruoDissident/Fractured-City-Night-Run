# Fractured City - Game Design Philosophy

**Last Updated:** February 6, 2026

---

## Core Vision

**Fractured City** is a deterministic, knowledge-based survival roguelike in the vein of **Cataclysm: Dark Days Ahead**. The game rewards player mastery through understanding systems, not fighting RNG. Every action has predictable outcomes that the player can learn and exploit.

---

## Design Pillars

### 1. **Deterministic, Not Random**
- **No hidden RNG** - Player always knows the outcome before acting
- **No fail states without warning** - Every risk is clearly communicated
- **Predictable systems** - Same inputs = same outputs
- **Mastery through knowledge** - Learning the systems IS the progression

**Example:**
```
Disassemble Computer with Screwdriver:
✓ 8 Capacitors (100% quality)
✓ 1 Circuit Board (100% quality)
Time: 5 turns
Risk: None

Disassemble Computer with Butter Knife:
✓ 6 Capacitors (70% quality) - 2 damaged
✓ 1 Circuit Board (60% quality) - scratched
Time: 15 turns
Risk: 15% cut to right hand (5 damage + bleeding)
```

Player chooses with full information.

### 2. **Quality Over Rarity**
- **Every item has predictable components** - All computers have capacitors
- **Quality varies, not availability** - Pristine vs scavenged vs waterlogged
- **Challenge is finding the RIGHT TOOLS** - Not RNG loot drops
- **Item condition tells a story** - Waterlogged = corroded parts, sealed office = pristine

**Anti-Pattern:** "You found a computer! Roll d100 to see if it has RAM!"
**Our Way:** "This waterlogged computer has RAM (quality 15%), probably dead but you can try."

### 3. **Gruesome Realism**
- **DIY everything is possible** - But with severe consequences
- **Body-part specific injuries** - Cut your hand, burn your face, go blind
- **Cybernetics are brutal** - Install cyber eye with shiv? 40% chance of blindness
- **Pain and suffering are gameplay** - Injuries affect actions, require treatment
- **No hand-holding** - Game trusts player to make informed bad decisions

**Example:**
```
Install Cyber Eye (DIY Method)
Tools: Shiv, Rubbing Alcohol
Time: 45 turns

⚠️ EXTREME RISKS:
• 40% permanent blindness in left eye
• 35% facial scarring (moderate bleeding)
• 50% severe infection (needs antibiotics or death)

✓ SUCCESS: +2 vision, +1 perception (if you survive)

[Proceed] [Cancel]
```

### 4. **Complexity Through Depth**
- **Simple items are simple** - Bandage from cloth = 1 turn, no tools needed
- **Complex items are complex** - Helicopter engine = 30+ components, 20 turns, specific tools
- **No artificial difficulty** - Flashlight doesn't need sterile conditions
- **Logical requirements** - Can't craft electronics in swamp (wet), but dirt road is fine

**Crafting Tiers:**
- **Basic:** Bandages, rope, shiv - Anywhere, any tool or hands
- **Standard:** Flashlight, weapons - Solid surface, basic tools
- **Advanced:** Electronics, explosives - Indoor preferred, proper tools
- **Critical:** Cybernetics, precision instruments - Clean space, specialized tools

### 5. **Meaningful Extraction**
Extraction is not a simple "reach the exit" - it requires **work**:

**Extraction Paths:**
1. **Helicopter Repair** - Find parts, repair engine, fuel, escape
2. **Boat Repair** - Fix hull, repair motor, sail away
3. **Vault Access** - Craft explosives OR hacking tools, breach vault, escape via tunnel
4. **Corporate Bribe** - Gather valuable items, trade for safe passage
5. **Faction Alliance** - Complete quests, gain favor, get extracted
6. **Underground Escape** - Craft cutting torch, breach gates, navigate tunnels

Each path requires crafting, planning, and resource management.

---

## Anti-Patterns (What We DON'T Do)

### ❌ Random Loot Tables
**Bad:** "You found a computer! Rolling... you got 3 capacitors."
**Good:** "This pristine computer has 8 capacitors (quality 100%)."

### ❌ Hidden Mechanics
**Bad:** "Crafting failed! (You don't know why)"
**Good:** "Butter knife on electronics: 70% component quality, 15% injury risk."

### ❌ Artificial Difficulty
**Bad:** "You need a workbench to craft a bandage."
**Good:** "Tear cloth with hands (1 turn) or knife (faster, cleaner cut)."

### ❌ Meaningless Choices
**Bad:** "Use medkit? [Yes] [No]"
**Good:** "Treat right hand cut with: [Bandage] [Antiseptic + Bandage] [Ignore]"

### ❌ Shallow Progression
**Bad:** "Level up! +1 to all stats!"
**Good:** "You've disassembled 20 computers. You know exactly what tools to use."

---

## Body-Part Injury System

### Philosophy
- **Specific injuries to specific body parts** - Not generic "HP damage"
- **Injuries affect gameplay** - Blind = can't see, crippled hand = can't craft
- **Treatment is meaningful** - Bandage stops bleeding, antiseptic prevents infection
- **Permanent consequences possible** - DIY cybernetics can cause permanent blindness

### Injury Types
- **Cut** - Hands, arms - Bleeding, pain - Treat with bandage
- **Burn** - Hands, face - Pain, scarring - Treat with burn gel
- **Puncture** - Hands, eyes - Bleeding, possible permanent damage - Treat with surgery
- **Chemical** - Hands, face, eyes - Pain, corrosion - Treat with water, antiseptic
- **Infection** - Any part - Fever, damage over time - Treat with antibiotics
- **Fracture** - Arms, legs - Immobility, pain - Treat with splint, time

### Status Effects
- **Bleeding** - Lose HP per turn until treated
- **Pain** - Slows actions, reduces accuracy
- **Infection** - Spreads if untreated, can be fatal
- **Blindness** - Cannot see (permanent if eye destroyed)
- **Crippled** - Cannot use limb until healed

---

## Crafting Philosophy

### Environmental Context (Not Workstations)
- **Location matters logically** - Can't build electronics in swamp (wet)
- **No arbitrary restrictions** - Flashlight on dirt road? Fine.
- **Size-appropriate spaces** - Helicopter engine needs large indoor space
- **Future furniture bonuses** - Workbench gives +20% quality, not required

### Tool-Based Outcomes
- **Perfect tool** - 100% component quality, no injury risk, fast
- **Improvised tool** - 60-80% quality, minor injury risk, slow
- **Wrong tool** - 30-50% quality, high injury risk, very slow
- **Smashing** - 0-40% quality, destroys fragile parts, injury risk

### Multi-Turn Crafting
- **Simple items** - 1-3 turns
- **Standard items** - 3-10 turns
- **Complex items** - 10-30 turns
- **Critical items** - 15-60 turns
- **Can be interrupted** - Resume later or lose progress

---

## End-Game Vision

### Extraction Requires Effort
The game doesn't end when you "reach the exit" - you must **build** your escape:

**Example: Helicopter Repair**
1. Find crashed helicopter (rare spawn in ruins)
2. Inspect damage (requires multimeter)
3. Craft/find replacement parts:
   - Motor assembly (15 components, 20 turns, indoor space)
   - Fuel pump (8 components, 10 turns)
   - Wiring harness (12 components, 15 turns)
4. Install parts (30 turns, requires wrench + screwdriver)
5. Find fuel (5 canisters, scattered across map)
6. Escape!

**Example: Vault Breach**
1. Locate corporate vault
2. Choose approach:
   - **Explosives:** Craft C4 (dangerous, loud, destroys some loot)
   - **Hacking:** Craft hacking terminal (safe, quiet, preserves loot)
3. Breach vault
4. Loot high-value items
5. Escape via secret tunnel

---

## Player Mastery Curve

### Early Game (Turns 1-500)
- **Learning systems** - How crafting works, what tools do
- **Basic survival** - Food, water, avoiding death
- **Tool acquisition** - Finding screwdriver, knife, basic tools
- **Simple crafting** - Bandages, shivs, basic repairs

### Mid Game (Turns 500-2000)
- **System mastery** - Knowing exact outcomes, optimal tool usage
- **Resource gathering** - Collecting components for complex crafts
- **Advanced crafting** - Electronics, weapons, explosives
- **Exploration** - Finding rare items, mapping world

### Late Game (Turns 2000+)
- **Extraction planning** - Choosing path, gathering requirements
- **Complex projects** - Helicopter repair, vault breach
- **Risk management** - DIY cybernetics, dangerous crafts
- **Final push** - Executing extraction plan

---

## Inspiration & References

### Primary Inspiration
- **Cataclysm: Dark Days Ahead** - Deterministic crafting, quality system, body parts
- **Project Zomboid** - Realistic injuries, multi-turn actions
- **Dwarf Fortress** - Emergent gameplay, detailed simulation

### What We Take
- **CDDA:** Predictable outcomes, component quality, tool requirements
- **PZ:** Body-part injuries, status effects, realistic healing
- **DF:** Detailed item descriptions, component-level tracking

### What We Don't Take
- **CDDA:** Overwhelming complexity (we're more focused)
- **PZ:** Slow pacing (we're turn-based, faster)
- **DF:** ASCII-only (we have colored glyphs)

---

## Implementation Guidelines

### Item Design Principles
1. **Generic over specific** - Containers should hold varied contents
   - ❌ Bad: `can_beans`, `can_soup`, `can_meat` (specific items)
   - ✅ Good: `can_sealed` with randomized contents
2. **Properties over types** - Use tags, states, and properties to define behavior
3. **Emergent combinations** - Let systems interact to create new possibilities
4. **Multi-purpose items** - Every item should have multiple uses

### System Design Principles
1. **Modular and composable** - Systems should work independently but interact cleanly
2. **Data-driven** - Define content in data, not code
3. **Trait integration points** - All systems should check for relevant trait effects
4. **Never block actions** - Apply consequences instead of preventing actions

### Balance Philosophy
1. **Risk vs Reward** - Riskier actions should have higher potential payoffs
2. **Scarcity creates value** - Proper tools should be valuable because they're rare
3. **No dead ends** - Player should always have options, even if suboptimal
4. **Meaningful trade-offs** - No "strictly better" options

---

## Code Examples (Good vs Bad)

### ✅ Multiple Solutions
```javascript
// BAD: Only one way to open
if (!hasCanOpener) {
    return "Cannot open can";
}

// GOOD: Multiple solutions with consequences
const methods = {
    can_opener: { yield: 1.0, damage: 0, time: 1 },
    knife: { yield: 0.8, damage: 5, time: 2 },
    pipe: { yield: 0.5, damage: 3, time: 1 },
    ground: { yield: 0.15, damage: 0, time: 10 }
};
```

### ✅ Generic Items
```javascript
// BAD: Hardcoded specific items
createItem('can_beans');
createItem('can_soup');
createItem('can_meat');

// GOOD: Generic with variation
const can = createItem('can_sealed');
can.contents = randomChoice(['beans', 'soup', 'meat']);
```

### ✅ Spectrum of Outcomes
```javascript
// BAD: Binary success/failure
if (hasKey) {
    openDoor();
} else {
    fail();
}

// GOOD: Multiple approaches with trade-offs
const methods = {
    key: { success: 1.0, noise: 0, time: 1 },
    lockpick: { success: 0.7, noise: 1, time: 3 },
    crowbar: { success: 0.9, noise: 8, time: 2, breaks_door: true },
    explosives: { success: 1.0, noise: 10, time: 1, destroys_loot: true }
};
```

### ✅ Systemic Interactions
```javascript
// BAD: Hardcoded specific scenario
if (item.name === 'beans' && item.onGround) {
    player.getSick();
}

// GOOD: System-based interactions
if (item.tags.includes('food') && item.contaminated) {
    const resistance = player.traits.includes('iron_stomach') ? 0.5 : 1.0;
    player.applyEffect('food_poisoning', severity * resistance);
}
```

---

## Design Checklist

Before implementing any new feature, verify:

- [ ] **Multiple Solutions** - Does it offer at least 2-3 different approaches?
- [ ] **Meaningful Consequences** - Does each choice have clear pros and cons?
- [ ] **Generic Design** - Can this be made more generic to avoid bloat?
- [ ] **System Integration** - Does it integrate with existing systems?
- [ ] **Trait Compatibility** - Does it check for relevant trait modifiers?
- [ ] **Emergent Gameplay** - Does it create unexpected interaction opportunities?
- [ ] **Player Agency** - Does it respect player choice and knowledge?
- [ ] **Predictable Outcomes** - Can player predict results before acting?
- [ ] **No Artificial Blocks** - Are consequences used instead of hard blocks?
- [ ] **Logical Requirements** - Do restrictions make real-world sense?

---

## Session Continuity Checklist

When starting a new session, remember:

✅ **Deterministic outcomes** - Player always knows before acting
✅ **Quality not rarity** - Every computer has capacitors, quality varies
✅ **Body-part injuries** - Specific parts, specific treatments
✅ **Gruesome cybernetics** - DIY possible but dangerous
✅ **Environmental context** - Location matters logically
✅ **Tool-based success** - Right tool = perfect, wrong tool = consequences
✅ **Extraction requires work** - Craft your escape
✅ **No artificial difficulty** - If it makes sense, allow it
✅ **Player mastery** - Learning systems IS progression
✅ **Cataclysm DDA style** - Complex but predictable
✅ **Multiple solutions** - Every task has 2+ approaches
✅ **Generic items** - Containers hold varied contents
✅ **Systemic interactions** - Systems interact, not hardcoded
✅ **Never block actions** - Consequences, not prevention

---

## Future Systems (Planned)

### Phase 3: World Expansion ✅ (Partially Complete)
- ✅ Building interiors via prefab system (9 layouts with room-type tagging)
- ✅ Context-aware loot spawning (16 room types with weighted item pools)
- ✅ Interactive doors as WorldObjects (biome-based types, lock chance, HP)
- ✅ Location UI panel (biome, floor, room/area display)
- Furniture as WorldObjects (chairs, desks, shelves — planned)
- Furniture disassembly (chairs → legs, screws, wood — planned)
- Enhanced sewer generation (rooms, corridors — planned)

### Phase 4: NPC Systems
- Z-level pathfinding for NPCs
- Biome-specific enemy types
- Above/below ground enemy variants
- Loot system for corpses

### Phase 5: Social Systems
- NPC dialogue and trading
- Faction reputation
- Quest system
- Bribery and negotiation

### Phase 6: End-Game Content
- Helicopter repair path
- Boat repair path
- Vault breach path
- Corporate bribe path
- Faction extraction path
- Underground escape path

---

**End of Game Design Document**
*This document defines the core philosophy and should be referenced at the start of every session.*
