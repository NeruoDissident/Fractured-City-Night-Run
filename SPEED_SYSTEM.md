# Turn-Based Speed System

## How Speed Works in Turn-Based Games

In traditional turn-based roguelikes, "speed" doesn't mean real-time velocity. Instead, it determines **how often an entity gets to act** relative to others.

### The Action Point System

**Baseline:** 100 action points = 1 turn
- Every entity has an "energy" counter
- Each game tick, entities gain energy based on their speed
- When energy >= 100, the entity takes an action and loses 100 energy
- Faster entities accumulate energy quicker and act more frequently

### Example (Cataclysm DDA Style)

```
Player Speed: 100 (baseline)
Fast Enemy Speed: 150 (acts 1.5x as often)
Slow Enemy Speed: 75 (acts 0.75x as often)

Turn 1: Player acts (100 energy), Fast Enemy acts (150 energy)
Turn 2: Player acts (200 energy), Fast Enemy acts (300 energy - acts twice!)
Turn 3: Player acts (300 energy), Slow Enemy finally acts (225 energy)
```

---

## Our Implementation (Simplified)

For now, we're using a **simpler model** where everyone acts once per turn, but **action costs** determine future turn order.

### Current System

- All entities act once per world tick
- Weapons have `actionCost` values (100 = baseline)
- Higher action cost = slower attacks (future expansion: skip turns)

### Weapon Action Costs

| Weapon | One-Handed | Two-Handed Grip | Notes |
|--------|-----------|-----------------|-------|
| Shiv | 100 | N/A | Fast, weak |
| Knife | 100 | 110 | Slightly slower two-handed |
| Pipe | 120 | 140 | Slow, heavy |

### Two-Handed Grip Tradeoff

**Benefits:**
- Extra damage (bonus dice roll)
- Better control and leverage

**Drawbacks:**
- Increased action cost (slower attacks)
- Cannot use other hand for items/shield

---

## Future Expansion: True Speed System

When we add a full energy-based system:

1. **Add energy counter to entities**
   ```javascript
   entity.energy = 0;
   entity.speed = 100; // baseline
   ```

2. **Modify turn processing**
   ```javascript
   processTurn() {
       for (entity of entities) {
           entity.energy += entity.speed;
           
           while (entity.energy >= 100) {
               entity.takeTurn();
               entity.energy -= entity.actionCost;
           }
       }
   }
   ```

3. **Speed modifiers from:**
   - Stats (AGI increases speed)
   - Equipment weight (heavy armor slows you down)
   - Status effects (bleeding, exhaustion)
   - Movement mode (running = faster, crouching = slower)
   - Cybernetics (reflex boosters, leg replacements)

4. **Action costs for different actions:**
   - Move: 100
   - Attack (light weapon): 100
   - Attack (heavy weapon): 140
   - Reload: 150
   - Use item: 80
   - Wait: 100

---

## Integration with Movement Modes

When we add movement modes, they'll modify speed:

| Mode | Speed Modifier | Sound Radius | Other Effects |
|------|---------------|--------------|---------------|
| Walk | 100% (baseline) | 3 tiles | Default |
| Run | 150% | 8 tiles | Stamina drain, can't attack |
| Crouch | 60% | 1 tile | Stealth bonus |
| Prone | 30% | 0 tiles | High defense, can't use weapons |

---

## Why This Matters

**Tactical Depth:**
- Fast weapons let you attack more often but deal less damage
- Slow weapons hit hard but leave you vulnerable
- Two-handing increases damage at the cost of speed
- Movement mode choice becomes a risk/reward decision

**Emergent Gameplay:**
- Kiting enemies with fast weapons
- Ambushing with slow, heavy hits
- Retreating with run mode when overwhelmed
- Sneaking past enemies in crouch mode

---

## Current Implementation Status

✅ **Implemented:**
- Action cost tracking on weapons
- Two-handed grip with increased action cost
- Helper methods for getting weapon action cost

⏳ **Not Yet Implemented (Future):**
- Energy-based turn system
- Speed stat affecting turn frequency
- Movement mode speed modifiers
- Stamina system
- Action cost actually affecting turn order

**For now:** Action costs are tracked but don't affect gameplay. This is intentional - we're building the foundation for a full speed system later.
