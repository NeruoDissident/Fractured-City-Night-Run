# Design Philosophy

## Core Principles

### 1. Multiple Solutions for Every Task
**"This game has absolutely no one way to do a task."**

Every challenge, obstacle, or problem in the game must have multiple viable solutions with varying consequences. Players should never feel forced into a single approach.

**Examples:**
- **Opening a sealed can:**
  - Can opener: 100% yield, no spillage, no tool damage
  - Knife: 80% yield, 20% spills, damages knife
  - Pipe: 50% yield, 50% spills, damages pipe
  - Smash on ground: 15% yield, 85% spills, can destroyed
  
- **Healing wounds:**
  - Medkit: Heal-over-time effect
  - Natural healing: (future) Slow regeneration when resting
  - Cybernetic implants: (future) Enhanced healing
  - Stimpaks: (future) Instant but risky healing

### 2. Consequences-Based Gameplay
**"The worse of a tool you use for the task, the less effective the outcome."**

Every action has consequences. Using the wrong tool for a job should work, but with penalties:
- **Efficiency loss** - Less yield, more waste
- **Tool degradation** - Durability damage to improvised tools
- **Secondary effects** - Contamination, noise, time cost

**Design Rule:** Never block a player action. Instead, apply appropriate consequences.

### 3. No Single-Purpose Items
**"can_beans goes against design goals. Just can_sealed contains beans."**

Items should be generic and multi-purpose where possible:
- ❌ **Bad:** `can_beans`, `can_soup`, `can_meat` (specific items)
- ✅ **Good:** `can_sealed` with randomized contents (beans, soup, meat, etc.)

This creates:
- **Emergent gameplay** - Same container, different contents
- **Replayability** - Varied loot each run
- **Reduced bloat** - Fewer item definitions needed

### 4. Systemic Interactions Over Hardcoded Content
Build systems that interact with each other rather than hardcoding specific scenarios.

**Example - Food Contamination:**
- ❌ **Bad:** Hardcode "eating beans from ground = sick"
- ✅ **Good:** System where ANY food on ground becomes contaminated, ANY contaminated food can cause sickness, traits can modify resistance

### 5. Meaningful Choices with Trade-offs
Every decision should have pros and cons. No "strictly better" options.

**Examples:**
- **Traits:** Positive traits cost points, negative traits give points
- **Tools:** Better tools are rarer, improvised tools are common but inefficient
- **Food:** Fresh food is safe but rare, contaminated food is risky but available

## Implementation Guidelines

### Item Design
1. **Generic over specific** - Containers should hold varied contents
2. **Properties over types** - Use tags, states, and properties to define behavior
3. **Emergent combinations** - Let systems interact to create new possibilities

### System Design
1. **Modular and composable** - Systems should work independently but interact cleanly
2. **Data-driven** - Define content in data, not code
3. **Trait integration points** - All systems should check for relevant trait effects

### Balance Philosophy
1. **Risk vs Reward** - Riskier actions should have higher potential payoffs
2. **Scarcity creates value** - Proper tools should be valuable because they're rare
3. **No dead ends** - Player should always have options, even if suboptimal

## Anti-Patterns to Avoid

### ❌ Single Solution Problems
```javascript
// BAD: Only one way to open
if (!hasCanOpener) {
    return "Cannot open can";
}
```

```javascript
// GOOD: Multiple solutions with consequences
const methods = {
    can_opener: { yield: 1.0, damage: 0 },
    knife: { yield: 0.8, damage: 5 },
    ground: { yield: 0.15, damage: 0 }
};
```

### ❌ Hardcoded Content
```javascript
// BAD: Specific item types
createItem('can_beans');
createItem('can_soup');
createItem('can_meat');
```

```javascript
// GOOD: Generic with variation
createItem('can_sealed'); // Randomly contains beans, soup, or meat
```

### ❌ Binary Outcomes
```javascript
// BAD: Success or failure only
if (hasKey) {
    openDoor();
} else {
    fail();
}
```

```javascript
// GOOD: Spectrum of outcomes
const methods = {
    key: { success: 1.0, noise: 0, time: 1 },
    lockpick: { success: 0.7, noise: 1, time: 3 },
    crowbar: { success: 0.9, noise: 8, time: 2, breaks_door: true }
};
```

## Future Expansion Principles

When adding new features, always ask:
1. **Does this have multiple solutions?**
2. **What are the consequences of each approach?**
3. **Can this be made more generic?**
4. **How does this interact with existing systems?**
5. **Does this respect player agency?**

## Examples in Current Systems

### ✅ Food & Consumables System
- Generic sealed containers with varied contents
- Multiple opening methods with different yields
- Contamination system applies to all food types
- Trait modifiers (Iron Stomach) affect outcomes

### ✅ Trait System
- Mix positive and negative traits for customization
- Traits modify existing systems, don't create new ones
- Point-buy system creates meaningful trade-offs

### ✅ Item Durability
- All tools can be used for multiple purposes
- Durability degradation varies by use case
- No "unbreakable" items (except where thematic)

## Design Checklist

Before implementing a new feature:
- [ ] Does it offer multiple solutions?
- [ ] Are there meaningful consequences for each choice?
- [ ] Is it generic enough to avoid bloat?
- [ ] Does it integrate with existing systems?
- [ ] Does it respect the trait system?
- [ ] Does it create emergent gameplay opportunities?
- [ ] Does it maintain player agency?
