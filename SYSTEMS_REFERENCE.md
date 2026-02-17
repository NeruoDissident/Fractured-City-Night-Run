# Systems Reference

## Overview

This document details how every system in Fractured City works and how they interact with each other.

---

## Core Systems

### Player System
**File:** `src/entities/Player.js`

**Purpose:** Manages player character state, stats, inventory, equipment, and combat.

**Key Properties:**
- `anatomy` - Anatomy instance (replaces HP — see Anatomy System)
- `hunger` / `maxHunger` - Hunger level (0-100), drains 0.1/turn
- `thirst` / `maxThirst` - Thirst level (0-100), drains 0.2/turn
- `stats` - Core attributes: strength, agility, endurance, intelligence, perception (default 10)
- `inventory` - Array of carried items
- `equipment` - Equipped items by slot (head, torso, legs, back, leftHand, rightHand)
- `carrying` - Items held in hands (leftHand, rightHand) — separate from equipment
- `traitEffects` - Active trait modifiers from character creation
- `statusEffects` - Active temporary effects (heal, sickness)
- `facing` - Direction player faces (north/south/east/west/ne/nw/se/sw) — used for flashlight cone
- `exploreMode` - Debug toggle (F key) — disables hunger/thirst drain

**Movement Modes** (M key cycles):
- `walk` — actionCost: 100, soundVolume: 3
- `run` — actionCost: 75, soundVolume: 8
- `crouch` — actionCost: 125, soundVolume: 1
- `prone` — actionCost: 150, soundVolume: 0

**Combat Stances** (T key cycles):
- `aggressive` — +25% damage, +5% hit, +3% crit, +20% incoming damage, +30% bleed, 50% intercept, off-balance on miss
- `defensive` — -30% damage, -5% hit, -2% crit, -30% incoming damage, -40% bleed, 150% intercept, can disengage without opportunity attack
- `opportunistic` — normal everything, bonus crit on already-wounded parts

**Key Methods:**
- `getMaxCarryWeight()` - Base 10000 + (STR × 1000), modified by `carryMod` trait
- `processStatusEffects()` - Processes hunger/thirst drain, starvation/dehydration organ damage, anatomy turn, heal/sickness effects
- `attack(target)` - Gets active weapon via EquipmentSystem, calls `combatSystem.resolveAttack()`
- `isDead()` - Delegates to `anatomy.isDead()`
- `cycleCombatStance()` - Cycles aggressive → defensive → opportunistic

**Death is anatomy-based** — no HP bar. Legacy `hp=999` kept for compatibility only.

**Starvation path:** hunger=0 → damages stomach → stomach destroyed → damages liver → organ failure cascade → brain death
**Dehydration path:** thirst=0 → damages kidneys → both kidneys destroyed → damages brain directly

**Opportunity Attacks:** Moving away from adjacent enemies triggers free attacks unless in defensive stance (`canDisengage: true`).

**Trait Integration:**
- `packRat` - +20% carry capacity via `carryMod`
- `ironStomach` - 50% poison resistance via `poisonResist`
- `slowHealer` - -50% healing via `healingMod`

---

### Anatomy System
**File:** `src/entities/Anatomy.js`

**Purpose:** Full body simulation replacing the HP bar. Every entity has blood, organs, and limbs. Death comes from physiological causes, not an HP counter.

**Key Properties:**
- `parts` - Hierarchical body structure (head, torso, leftArm, rightArm, leftLeg, rightLeg)
- `blood` / `maxBlood` - Blood level (100 = full), wounds drain blood per turn
- `wounds` - Array of active wounds, each bleeding at its own rate
- `painHistory` - Array of `{turn, amount}` for shock tracking
- `suffocationCounter` - Turns without functional lungs (death at `SUFFOCATION_TURNS = 8`)
- `causeOfDeath` - String describing how the entity died (null while alive)
- `regenCooldown` - Turns before natural blood regeneration kicks in

**Body Part Structure:**
Each part has: `hp`, `maxHP`, `functional`, `cybernetic`, `lastDamageType`

```
head:
  brain (hp:10, vital)
  jaw (hp:15)
  eyes[0,1] (hp:5 each)
  ears[0,1] (hp:5 each)
torso:
  heart (hp:15, vital)
  lungs[0,1] (hp:12 each, vital)
  stomach (hp:15, vital)
  liver (hp:12, vital)
  kidneys[0,1] (hp:10 each, vital)
leftArm / rightArm:
  arm (hp:20)
  hand (hp:10)
leftLeg / rightLeg:
  leg (hp:25)
  foot (hp:10)
```

**Blood Loss Thresholds (`BLOOD_THRESHOLDS`):**
| Range | Status | Effect |
|-------|--------|--------|
| 80-100% | Healthy | No effects |
| 60-80% | Lightheaded | Minor penalties |
| 40-60% | Woozy | Significant penalties, vision dims |
| 20-40% | Critical | Near unconscious, severe penalties |
| 10-20% | Unconscious | Passed out, helpless |
| 0-10% | Dead | Death from exsanguination |

**Wound Types & Clotting:**
| Type | Clot Delay (turns) | Clot Speed (severity/turn) | Source |
|------|-------------------|---------------------------|--------|
| arterial | 10 | 0.02 | Sharp hits on vital organs |
| internal | 8 | 0.03 | Blunt crits on vitals |
| puncture | 6 | 0.05 | Stab wounds on vitals |
| laceration | 3 | 0.08 | Sharp weapon hits |
| cut | 3 | 0.10 | Light sharp/default |

Each wound has: `{ type, bodyPart, severity, bleedRate, turnCreated, clotDelay, clotSpeed }`

**Death Causes:**
1. **Brain destruction** — instant death
2. **Blood loss** — bleeding out below 10% blood
3. **Cardiac arrest** — heart destroyed → massive internal bleed (5.0 severity) → rapid blood drain
4. **Suffocation** — both lungs destroyed → death in 8 turns
5. **Organ failure cascade** — liver + both kidneys destroyed → toxin buildup damages brain (1 hp/turn)
6. **Shock** — 80+ pain accumulated in 5-turn window → movement penalty, potential death
7. **Starvation** — stomach → liver → organ failure (driven by Player.processStatusEffects)
8. **Dehydration** — kidneys → brain (driven by Player.processStatusEffects)

**processTurn(currentTurn):**
1. Heart destroyed → add arterial wound (severity 5.0) if not already present
2. Suffocation counter increments if both lungs destroyed (death at 8 turns)
3. Organ failure: if liver + both kidneys gone → damage brain 1 hp/turn
4. Shock check: if pain > 80 in last 5 turns → shock effects
5. Process all wounds: after clot delay, reduce severity by clotSpeed; bleed = severity × bleedRate → drain blood
6. Blood regeneration: if regenCooldown expired and blood < maxBlood → +0.1 blood/turn
7. Blood status effects: log messages at threshold crossings
8. Returns `{ alive, effects[] }` — effects are `{type, msg}` for UI logging

**Context-Aware Status Labels (`Anatomy.getPartStatus(part, damageType)`):**
| Damage Type | 75%+ Part HP | 50-75% | 25-50% | <25% |
|-------------|---------|--------|--------|------|
| sharp | Nicked | Cut | Cut Deep | Mangled |
| stab | Pierced | Stabbed | Punctured | Perforated |
| blunt | Sore | Bruised | Battered | Crushed |
| default | Damaged | Damaged | Critical | DESTROYED |

**Sensory Methods:**
- `getVisionRange()` — base 8, -4 per destroyed eye, +/- trait modifiers (nightVision/nearSighted)
- `getHearingRange()` — base 12, -6 per destroyed ear
- `canUseHands()` — true if at least one hand is functional
- `getMovementPenalty()` — 0.5 per destroyed leg, 0.25 per destroyed foot

**Cybernetics:**
- `installCybernetic(partPath, cybernetic)` — replaces organic part, restores HP to max, marks `cybernetic: true`

**Trait Integration:**
- `nightVision` — +2 vision range
- `nearSighted` — -2 vision range

---

### Equipment System
**File:** `src/systems/EquipmentSystem.js`

**Purpose:** Handles equipping/unequipping items, slot validation, dual-wielding, two-handed grips, and stat calculations.

**Equipment Slots:** `head`, `torso`, `legs`, `back`, `leftHand`, `rightHand`

**Slot Mapping from Item `slots` Array:**
- `'hand'` → leftHand, rightHand (+ bothHands if `canTwoHand`)
- `'head'` → head
- `'torso'` → torso
- `'legs'` → legs
- `'back'` → back

**Two-Handed Grip:**
- Items with `canTwoHand: true` can be equipped as `bothHands`
- Sets `item.twoHandGrip = true`, stores same item ref in both leftHand and rightHand
- Two-handed weapons get bonus damage via `twoHandDamageBonus` dice string
- Two-handed weapons use `twoHandActionCost` instead of `actionCost`

**Hand Blocking:** Carrying items in hands (via `player.carrying`) blocks equipping to that hand slot. Must drop carried item first.

**Key Methods:**
- `equipItem(inventoryIndex, targetSlot, skipAutoUnequip)` — equips item, auto-unequips existing if needed
- `unequipSlot(slot)` — removes item from slot (handles two-handed unequip)
- `getActiveWeapon()` — returns primary weapon: two-handed grip > rightHand > leftHand > null (unarmed)
- `getEquippedDamage()` — rolls damage from equipped weapons using dice strings (e.g. "1d6", "2d4")
- `getEquippedDefense()` — sums `defense` + `defenseMod` from all armor-type equipment
- `getActionCostModifier()` — multiplies `weightMod` from all equipment × `actionCostMod` trait
- `getWeaponActionCost()` — returns action cost for current weapon setup (100 = baseline)
- `canEquipHandItem()` — checks `anatomy.canUseHands()`

**Unarmed Fallback:** If no weapons equipped, `getEquippedDamage()` returns 1-3 random damage.

**Trait Integration:**
- `quickReflexes` — -10% action cost via `actionCostMod`
- `clumsy` — +10% action cost via `actionCostMod`

---

### Combat System
**File:** `src/systems/CombatSystem.js`

**Purpose:** Handles all combat resolution — hit location targeting, damage calculation, armor mitigation, wound creation, rich combat log generation, and anatomy-based damage application.

**Attack Flow (`resolveAttack(attacker, target, weapon)`):**
1. **Hit check** — roll vs `calculateHitChance()`
2. **Roll hit location** — weapon-specific body region → sub-part (weighted random)
3. **Critical hit check** — roll vs `calculateCritChance()`
4. **Arm intercept** — if targeting head/torso and not a crit, arms may block
5. **Calculate damage** — `rollWeaponDamage()` × crit multiplier (1.5×) × stance damageMod
6. **Armor mitigation** — `calculateArmor()` reduces damage (minimum 1)
7. **Target stance modifier** — `incomingDamageMod` applied
8. **Apply anatomy damage** — `applyAnatomyDamage()` reduces part HP, tracks damage type
9. **Wound creation** — bleeding/wound logic based on attack type (see below)
10. **Pain tracking** — `target.anatomy.addPain(damage, turn)` for shock system
11. **Combat log** — randomized template messages with verb conjugation
12. **Visual effects** — shake, floating damage text, part destroyed callout
13. **Death check** — `target.anatomy.isDead()`
14. **Event recording** — structured event added to `combatEvents[]` (max 20)

**Hit Chance Formula:**
```
Base: 75%
+ (attacker.agility - 10) × 2     // attacker skill
- (target.agility - 10) × 1       // target dodge
+ stance.hitMod                     // stance bonus/penalty
- 10 if unarmed                    // unarmed penalty
+ attacker.anatomy.getCombatPenalties().hitChanceMod   // attacker injury penalties
+ target.anatomy.getCombatPenalties().dodgeMod         // target injury dodge penalties
Clamped: [20%, 95%]
```

**Critical Hit Formula:**
```
Base: 5%
+ floor((attacker.perception - 10) / 2)
+ stance.critMod
- 3 if unarmed
+ 10 if opportunistic stance AND target part already wounded
+ attacker.anatomy.getCombatPenalties().critChanceMod  // eye/blood/shock penalties
Clamped: [1%, 25%]
```

**Damage Formula (injury modifier applied last):**
```
rollWeaponDamage(weapon, attacker):
  Base dice roll + STR bonus
  × attacker.anatomy.getCombatPenalties().damageMod    // arm/hand/blood/shock
  Minimum: 1
```

**Injury Combat Modifiers (`Anatomy.getCombatPenalties()`):**
Centralized method returning all combat-relevant injury penalties. Applied to both players and NPCs.

| Source | Hit Chance | Crit Chance | Damage | Dodge (target) |
|--------|-----------|-------------|--------|----------------|
| Arm damage (per avg HP%) | up to -15% | — | down to ×0.5 | — |
| Hand damage (per avg HP%) | up to -10% | — | down to ×0.7 | — |
| Eye damage (per avg HP%) | — | up to -8% | — | — |
| Leg damage (per avg HP%) | — | — | — | up to +15% easier to hit |
| Foot damage (per avg HP%) | — | — | — | up to +8% easier to hit |
| Lightheaded (60-80% blood) | -5% | -1% | ×0.9 | +3% easier to hit |
| Woozy (40-60% blood) | -10% | -3% | ×0.8 | +8% easier to hit |
| Critical blood loss (<20%) | -20% | -5% | ×0.6 | +15% easier to hit |
| Shock | -20% | -5% | ×0.5 | +20% easier to hit |

Damage mod clamped at ×0.2 minimum. All penalties stack multiplicatively for damage, additively for hit/crit/dodge.

**Body Region Weights (`WEAPON_TARGETING`):**
| Region | Blunt | Sharp | Unarmed |
|--------|-------|-------|---------|
| head | 20 | 5 | 25 |
| torso | 30 | 45 | 35 |
| leftArm | 15 | 18 | 10 |
| rightArm | 15 | 18 | 10 |
| leftLeg | 10 | 7 | 10 |
| rightLeg | 10 | 7 | 10 |

**Sub-Parts (`REGION_PARTS`):**
Each region has weighted sub-parts. Some are `vital: true`, some are `glancing: true` (no specific organ, no anatomy path).

| Region | Sub-Parts (weight) |
|--------|-------------------|
| head | brain(5,vital), jaw(30), leftEye(10), rightEye(10), leftEar(20), rightEar(20), head(5,glancing) |
| torso | heart(5,vital), leftLung(10,vital), rightLung(10,vital), stomach(20,vital), liver(10,vital), leftKidney(5,vital), rightKidney(5,vital), torso(35,glancing) |
| leftArm | leftArm(50), leftHand(30), leftFingers(20,glancing) |
| rightArm | rightArm(50), rightHand(30), rightFingers(20,glancing) |
| leftLeg | leftLeg(65), leftFoot(35) |
| rightLeg | rightLeg(65), rightFoot(35) |

**Arm Intercept System:**
- Triggers on head/torso hits only, never on crits
- Both arms functional: 25% base chance, one arm: 12%, no arms: 0%
- Modified by stance `interceptMod` (defensive 1.5×, aggressive 0.5×)
- Capped at 60%
- Prefers arm with more HP (instinctive shield with stronger arm)
- Redirects hit to arm sub-part instead of original target

**Armor Coverage (`ARMOR_COVERAGE`):**
| Equipment Slot | Protects Regions |
|---------------|-----------------|
| head | head |
| torso | torso |
| legs | leftLeg, rightLeg |
| leftHand | leftArm |
| rightHand | rightArm |
| back | torso |
| feet | leftLeg, rightLeg |

**Damage Calculation:**
```
rollWeaponDamage(weapon, attacker):
  If weapon.baseDamage → rollDice(baseDamage) × (1 + damageMod)
  Else if weapon.weaponStats.damage → rollDice(damage)
  Else (unarmed) → 1d3
  + floor((STR - 10) / 3) strength bonus
  Minimum: 1
```

`rollDice()` supports compound dice strings like `"1d8+1d6"`.

**Wound Creation by Attack Type:**

*Sharp weapons:*
- bleedChance = weapon.weaponStats.bleedChance (default 0.4) × stance.bleedMod
- Vital hits: bleedChance = max(bleedChance, 0.8)
- Crits always bleed
- Severity: crit → damage×0.8, normal → damage×0.5, vital → ×1.5
- Wound type: vital+crit/20% → arterial, vital → puncture, else → 50/50 cut/laceration

*Blunt weapons:*
- Vital hits: 25% chance (or crit) → internal bleeding, severity crit→damage×0.6, normal→damage×0.3
- Head hits: 35% chance → surface laceration, severity damage×0.2

*Unarmed:*
- Only bleeds on crit to head → laceration, severity damage×0.15

**Damage Type Tracking:**
`applyAnatomyDamage()` sets `part.lastDamageType`:
- sharp → 'sharp' (or 'stab' if vital organ)
- blunt/unarmed → 'blunt'
- Used by `Anatomy.getPartStatus()` for context-aware status labels

**Engagement Tracking:**
- `engagedEnemies` Map — tracks entities in combat with player
- `engagementTimeout` = 5 turns of no combat before auto-disengage
- Dead enemies auto-removed from tracking
- `isInCombat()` — returns true if any engaged enemies remain

**Combat Log Templates:**
- Attack verbs by type (blunt/sharp/unarmed) × intensity (light/medium/heavy)
- Randomized sentence templates with `{a}`, `{t}`, `{w}`, `{p}`, `{d}` placeholders
- Verb conjugation: third-person for NPCs ("strikes"), base form for player ("strike")
- Separate templates for: attack, critical, miss, block, part destroyed, kill, wound

**NPC Weapons (from `NPC.rollRaiderWeapon()`):**
| Weapon | Chance | Damage | Type | Bleed |
|--------|--------|--------|------|-------|
| Shiv | 30% | 1d4 | sharp | 30% |
| Pipe | 30% | 1d8 | blunt | — |
| Knife | 20% | 1d6 | sharp | 40% |
| Unarmed | 20% | 1d3 | unarmed | — |

---

### Combat Effects System
**File:** `src/systems/CombatEffects.js`

**Purpose:** Visual feedback for combat events — entity shake and floating combat text.

**Entity Shake:**
- `shakeEntity(entity, intensity, duration)` — sprite offset on hit
- Typical: normal hit (3px, 200ms), crit (5px, 350ms)
- Decaying intensity over duration, rapid random oscillation
- `getShakeOffset(entity)` called by renderer each frame → returns `{dx, dy}` in pixels

**Floating Text:**
- `addFloatingText(worldX, worldY, text, color, duration)` — damage numbers, status text
- Floats upward over time (1.2× tileSize travel)
- Fades out in last 40% of duration
- Black outline for readability
- Used for: damage numbers (red/yellow for crit), "MISS" (gray), body part name (gray), "DESTROYED" (orange), "KILLED" (red), "OPP. ATTACK" (orange)

**Animation Loop:**
- `startAnimation()` triggers requestAnimationFrame loop
- `hasActiveEffects()` checks if any shakes or floating texts remain
- `drawFloatingTexts(ctx, cameraX, cameraY, tileSize)` called after entity rendering

---

### Ability System
**File:** `src/systems/AbilitySystem.js`

**Purpose:** Manages combat abilities tied to weapon types, stat thresholds, and stances. Data-driven — all abilities defined in `ABILITY_DATA` constant.

**Design Principles:**
- Abilities unlock at **stat thresholds** (no XP/leveling)
- All abilities **always visible** in UI — grayed out with requirements shown if locked
- **Soft stance lock** — abilities work in any stance but get a bonus in the preferred stance (penalty otherwise)
- **Variable action cost** per ability (120–180 AP vs 100 AP for basic attack)
- **Per-ability cooldowns** — each ability has a cooldown in turns (2–5), tracked per entity

**Keybind:** `[Q]` opens the ability panel. Number keys `[1-5]` activate abilities directly during combat.

**Ability Resolution Flow (`resolveAbility()`):**
1. Validate stat requirements, weapon type match, and cooldown
2. Compute hit chance = base hit chance + ability hitChanceMod + stance hitMod/penalty
3. Roll to hit (clamped [10%, 95%])
4. On hit: resolve effects (damage, targeted body part, special effects)
5. Apply stance damage/bleed/stun modifiers
6. Record combat event (`ability_hit` or `ability_miss`)
7. Set action cost on attacker and start cooldown

**Blunt Weapon Abilities:**
| Ability | Requirements | Preferred Stance | AP Cost | CD | Effect |
|---------|-------------|-----------------|---------|-----|--------|
| Limb Breaker | STR 12 | Aggressive | 150 | 3t | Target specific limb, 1.4× damage, +50% pain |
| Concussion | STR 14, AGI 11 | Aggressive | 180 | 4t | Head strike, stun 1 turn, -15% hit |
| Sweeping Strike | STR 11, AGI 12 | Aggressive | 160 | 3t | Hit both legs at 0.7× damage each, knock prone |
| Guard Break | PER 12 | Opportunistic | 140 | 4t | Hit blocking arm, halve intercept for 3 turns |
| Measured Strike | PER 13, AGI 11 | Defensive | 130 | 2t | Auto-target wounded part, +15% hit, exploit wounds |

**Sharp Weapon Abilities:**
| Ability | Requirements | Preferred Stance | AP Cost | CD | Effect |
|---------|-------------|-----------------|---------|-----|--------|
| Hamstring | AGI 12 | Opportunistic | 140 | 3t | Leg slash, 2× bleed severity |
| Throat Slash | AGI 14, PER 12 | Opportunistic | 180 | 5t | Head hit, 3× bleed, arterial bleed, -25% hit |
| Disarm | AGI 12, STR 11 | Defensive | 150 | 4t | Hit weapon hand, drop weapon if hand <50% HP |
| Flurry | AGI 14 | Aggressive | 170 | 3t | 2 strikes at 0.6× damage each, 1.5× bleed |
| Precision Stab | PER 13 | Opportunistic | 160 | 3t | Target wounded part, bypass armor on wounds |

**Unarmed Abilities:**
| Ability | Requirements | Preferred Stance | AP Cost | CD | Effect |
|---------|-------------|-----------------|---------|-----|--------|
| Tackle | STR 12, END 11 | Aggressive | 160 | 4t | Knock target prone (self too), 0.6× damage |
| Eye Gouge | AGI 12 | Opportunistic | 130 | 3t | Target eyes, 0.5× damage, impair vision |
| Chokehold | STR 13, AGI 12 | Defensive | 180 | 5t | Grapple 3 turns, suffocation damage, breakable |
| Kidney Shot | STR 11, PER 11 | Opportunistic | 140 | 2t | Organ hit, 2.5× pain (shock trigger) |
| Headbutt | STR 12, END 12 | Aggressive | 120 | 3t | Head hit, stun 1 turn, self-damage 40% |

**Stance Modifiers (soft lock):**
- **Preferred stance** → bonus (e.g., +10% hit, +15% damage, +1 stun turn)
- **Wrong stance** → penalty (e.g., -15% hit, -15% damage)
- Player can gamble on using wrong-stance abilities — clearly shown in UI

**Cooldown System:**
- `cooldowns` Map tracks per-entity, per-ability remaining turns
- Cooldown starts on use (hit or miss) — missing doesn't skip the cooldown
- `tickCooldowns()` called each turn in `processTurn()` to decrement all cooldowns
- UI shows remaining turns in red when on cooldown; use buttons disabled
- Cooldown values: 2t (quick abilities) to 5t (powerful abilities like Throat Slash, Chokehold)

**Active Effects System:**
- `activeEffects` Map tracks timed effects per entity (stunned, prone, guard_break, grappled, grappling)
- `processTurn()` ticks all effects and cooldowns, handles grapple suffocation and break-free checks

**Implemented Status Effects:**
| Effect | Duration | Gameplay Impact | Checked By |
|--------|----------|----------------|------------|
| **Stunned** | 1–2t | NPC skips turn entirely | `NPC.executeAI()` → `isStunned()` |
| **Prone** | 2t | NPC skips turn + 15% easier to hit | `NPC.executeAI()` → `hasEffect('prone')`, `CombatSystem.calculateHitChance()` |
| **Guard Break** | 3–4t | Halves arm intercept chance | `CombatSystem.getArmInterceptChance()` → `getInterceptModifier()` |
| **Grappled** | 3t | Suffocation damage per turn, STR break-free roll | `AbilitySystem.processTurn()` |
| **Disarm** | Permanent | NPC weapon nulled (`this.weapon = null`), weapon dropped as lootable ground item | `NPC.attack()` uses `this.weapon` |

**Anatomy-Based Combat Penalties (via `getCombatPenalties()`):**
| Injury | Effect | Applied In |
|--------|--------|-----------|
| Arm damage | Up to -15% hit, down to 0.5× damage | `calculateHitChance()`, `resolveAttack()` damage calc |
| Hand damage | Up to -10% hit, down to 0.7× damage | `calculateHitChance()`, `resolveAttack()` damage calc |
| Eye damage | Up to -8% crit chance | `calculateCritChance()` |
| Leg damage | Up to +15% easier to hit (dodge penalty) | `calculateHitChance()` dodge mod |
| Blood loss | -5 to -20% hit, -1 to -5% crit, 0.6–0.9× damage, +3–15% easier to hit | All combat calculations |
| Shock | -20% hit, -5% crit, 0.5× damage, +20% easier to hit | All combat calculations |

**Floating Text Feedback:**
- All status effects show floating text over the target: STUNNED, PRONE, GUARD BROKEN, DISARMED, GRAPPLED, ARTERIAL BLEED
- Damage numbers float in red (yellow for crits), self-damage in orange
- Part destroyed callouts in orange

**Ability Popup:**
- Persistent notification shown at top of screen after using an ability
- Displays ability name, hit/miss, damage, body parts hit, and special effects with mechanical descriptions
- Stays visible until the player's next action (`clearAbilityPopup()` called in `Game.processTurn()`)

---

### NPC System
**File:** `src/entities/NPC.js`

**Purpose:** Manages NPC entities with anatomy, energy-based speed, detection state AI, morale, and combat.

**Data-Driven NPC Types (`NPC_TYPES` config):**
Add new enemy types by adding entries to `NPC_TYPES` — no code changes needed.

| Parameter | Scavenger | Raider | Description |
|-----------|-----------|--------|-------------|
| `speed` | 70 | 85 | Energy gained per game tick (player walk = 100) |
| `attackCost` | 100 | 100 | Energy cost to attack |
| `moveCost` | 100 | 100 | Energy cost to move one tile |
| `visionRange` | 6 | 8 | Base vision range in tiles |
| `hearingRange` | 10 | 14 | Max distance to hear sounds |
| `hostile` | false | true | Will attack on sight? |
| `aggression` | 0.0 | 0.8 | Chance to engage when first spotting player |
| `courage` | 1.0 | 0.35 | Blood% threshold to flee (1.0 = never flees) |
| `leashRange` | 15 | 25 | Max chase distance from spawn |
| `giveUpTurns` | 5 | 15 | Turns without sight before returning to wander |
| `wanderChance` | 0.3 | 0.3 | Chance to move randomly when idle |
| `weaponTable` | null | weighted table | Weighted random weapon selection |

**Energy-Based Speed System:**
- Each game tick, NPCs gain energy = `speed × (playerActionCost / 100)`
- When energy ≥ `moveCost`, NPC acts (move, attack, etc.) and spends energy
- Fast player actions (running, cost 75) → NPCs gain less energy → player outruns them
- Slow player actions (crouching, cost 125) → NPCs gain more energy → they catch up
- Energy capped at `moveCost × 2` to prevent idle NPCs from banking huge reserves
- Max 3 actions per tick (safety cap)

**Detection State Machine:**
```
UNAWARE → ALERT → SEARCHING → ENGAGED
                                  ↓
                               FLEEING
```
- `UNAWARE` — idle, wandering. Hasn't noticed player.
- `ALERT` — heard a sound or glimpsed movement. Moves to investigate.
- `SEARCHING` — lost sight of player. Checks last known position, then wanders nearby.
- `ENGAGED` — actively chasing/fighting player.
- `FLEEING` — retreating due to low morale (blood < courage threshold or 3+ destroyed parts).

**NPC Vision (independent of player FoV):**
- Uses `FoVSystem.hasLineOfSight()` from NPC position to player position
- Effective range = `visionRange × lightingFactor × stealthFactor`
- Lighting: `getLightLevel()` at player tile (0.0–1.0), min 0.25 multiplier
- Stealth modifiers: crouch ×0.6, prone ×0.35, run ×1.25, walk ×1.0

**Sound Response:**
- All NPC types can hear sounds (not just raiders)
- `hearSound()` checks distance against `hearingRange`
- Alert level builds up from repeated sounds (volume / distance × 30)
- Loud sounds (volume ≥ 6) or alert level ≥ 40 → sets investigate target → ALERT state
- Already ENGAGED or FLEEING NPCs ignore sounds

**Morale / Retreat:**
- `shouldFlee()` checks blood% against `courage` threshold
- Also flees if 3+ body parts destroyed
- FLEEING NPCs move away from player
- Once far enough away (75% of leashRange), calms down → UNAWARE
- Fleeing NPCs try perpendicular directions if blocked

**Leash System:**
- NPCs track their spawn position
- If chase takes them beyond `leashRange` from spawn → give up → UNAWARE

**Opportunity Attacks:**
- Only ENGAGED NPCs get opportunity attacks when player moves away
- UNAWARE/ALERT NPCs do not strike

**Per-Turn Processing:**
1. Process anatomy (bleeding, organ effects) via `anatomy.processTurn()`
2. If anatomy reports not alive → `die()`
3. Accumulate energy proportional to player's action cost
4. While energy ≥ moveCost: execute AI behavior, spend energy

**All NPCs have:**
- Full anatomy system (same as player)
- Equipment slots (for armor coverage)
- Weapon item (null = unarmed, or rolled from `weaponTable`)
- Detection state, alert level, spawn position tracking

---

### Container System
**File:** `src/systems/ContainerSystem.js`

**Purpose:** Manages nested container storage (backpacks, pockets, etc.).

**Key Methods:**
- `addItem()` - Adds item to container with weight/volume checks
- `removeItem()` - Removes item from container
- `getAllStoredItems()` - Gets all items in all containers
- `canFit()` - Checks if item fits in container

---

### Item System
**File:** `src/systems/ItemSystem.js`

**Purpose:** Handles item operations (splitting, opening, consuming, smart consumption).

**Key Methods:**
- `splitItem(item, amount)` - Splits stackable items into portions
- `getAvailableOpeningTools(player, container)` - Finds tools that can open container
- `openContainer(container, tool, player)` - Opens sealed container with consequences
- `calculateOptimalConsumption(item, player)` - Calculates optimal amount to consume based on needs
- `consumeFood(item, player, amount)` - Consumes food/drink with nutrition and contamination

**Opening System:**
```javascript
openMethods: {
    can_opener: { yield: 1.0, durabilityDamage: 0 },
    knife: { yield: 0.8, durabilityDamage: 5 },
    pipe: { yield: 0.5, durabilityDamage: 3 },
    ground: { yield: 0.15, durabilityDamage: 0 }
}
```

**Smart Consumption System:**
- Automatically calculates optimal amount to consume to fill hunger/thirst
- If player is full or needs less than available, consumes only what's needed
- If item won't fill player, consumes all remaining
- Formula: `amountNeeded = Math.ceil(statNeeded / nutritionPerUnit)`
- No UI required - works invisibly when amount parameter is null

**Contamination System:**
- Food on ground gets `state.contaminated = true`
- Food in opened containers gradually spoils (see World System)
- Eating contaminated food applies sickness status effect
- `ironStomach` trait reduces contamination effect by 50%

---

### Content Manager
**File:** `src/content/ContentManager.js`

**Purpose:** Loads and manages all game content (items, materials, modifiers, traits).

**Item Creation:**
- `createItem(familyId, materialId, modifierId)` - Creates item instance
- Sealed containers (`can_sealed`, `bottle_sealed`) get random contents
- Materials and modifiers affect item properties

**Generic Containers:**
- `can_sealed` - Contains random food (beans, soup, mystery_meat)
- `bottle_sealed` - Contains random drink (water, soda, juice)

---

### Character Creation System
**File:** `src/systems/CharacterCreationSystem.js`

**Purpose:** Manages backgrounds and traits for character creation.

**Backgrounds:**
- Apply stat modifiers
- Grant starting gear
- Provide background traits

**Traits:**
- **Positive Traits (cost points):**
  - `nightVision` - +2 vision range
  - `quickReflexes` - -10% action cost
  - `ironStomach` - 50% poison resistance
  - `packRat` - +20% carry capacity
  - `lucky` - Better loot/crits (not yet implemented)

- **Negative Traits (give points):**
  - `nearSighted` - -2 vision range
  - `weakConstitution` - -10 max HP (legacy effect — `maxHPMod`, no current anatomy impact)
  - `slowHealer` - -50% healing effectiveness
  - `clumsy` - +10% action cost
  - `lightSleeper` - Reduced rest benefits (not yet implemented)

**Trait Application:**
- `applyTraitsToCharacter()` - Merges trait effects into `player.traitEffects`
- All systems check `player.traitEffects` for modifiers

---

### Field of View (FoV) System
**File:** `src/systems/FoVSystem.js`

**Purpose:** Calculates which tiles are visible to the player.

**Algorithm:**
- Simple circular FoV based on vision range
- Vision range from `Anatomy.getVisionRange()`
- Recalculated after each player action

---

### Sound System
**File:** `src/systems/SoundSystem.js`

**Purpose:** Tracks sound events and propagation for stealth/detection.

**Key Concepts:**
- Actions generate sound with volume (movement, combat, items)
- Movement mode affects sound volume: walk=3, run=8, crouch=1, prone=0
- `makeSound(x, y, volume, type, source)` creates a sound event
- `alertNearbyNPCs(sound)` notifies all NPCs within `sound.volume` radius
- NPCs filter sounds against their own `hearingRange` parameter
- Sound events decay after 2 turns
- Loud sounds (volume ≥ 6) immediately trigger NPC investigation
- Repeated quieter sounds build up NPC `alertLevel` over time

---

### World System
**File:** `src/world/World.js`

**Purpose:** Manages world state, entities, and turn-based environmental effects.

**Key Methods:**
- `processTurn()` - Processes all turn-based systems
- `processFoodSpoilage(player)` - Handles food degradation in opened containers
- `processLiquidSpillage(player)` - Handles liquid leakage from unsealed containers
- `getItemsAt(x, y)` - Gets items at specific coordinates

**Food Spoilage System:**
- Only affects food items in **opened** containers
- Progressive contamination tracked in `state.contaminationLevel`
- Spoilage rates (per turn):
  - Protein foods (meat, beans): 0.03 (~10 turns to contaminate)
  - Liquid foods (soup): 0.05 (~6 turns to contaminate)
  - Default: 0.04
- Contamination threshold: 0.3 (becomes `state.contaminated = true`)
- Creates strategic pressure to consume opened food quickly

**Liquid Spillage System:**
- Only affects drinks in **opened and unsealed** containers
- Spillage rate: 7ml per turn
- Bottles can be resealed to stop spillage (plastic containers)
- Cans cannot be resealed (metal containers)
- Empty items automatically removed from container
- Creates strategic choice: reseal bottles or risk losing contents

**Turn Processing Order:**
```javascript
processTurn() {
    processFoodSpoilage(player);    // Food degrades
    processLiquidSpillage(player);  // Liquids leak
    // Process entity turns...
}
```

---

## System Interactions

### Food & Hunger System Flow

```
Player Turn
    ↓
Player.processStatusEffects()
    ↓
Hunger -= 0.1, Thirst -= 0.2 (skipped in exploreMode)
    ↓
If hunger <= 0:
    → Damage stomach (1 hp/turn)
    → If stomach destroyed → damage liver
    → Set causeOfDeath = 'starvation'
    ↓
If thirst <= 0:
    → Damage kidneys (1 hp/turn to first functional kidney)
    → If both kidneys destroyed → damage brain directly
    → Set causeOfDeath = 'dehydration'
    ↓
anatomy.processTurn() — bleeding, organ effects, suffocation, shock
    ↓
Process status effects (heal patches wounds / restores blood, sickness damages stomach)
```

### Opening Container Flow

```
Player clicks [Actions] → [Open]
    ↓
UIManager.showOpenToolSelection()
    ↓
ItemSystem.getAvailableOpeningTools()
    ↓
Player selects tool
    ↓
ItemSystem.openContainer()
    ↓
Apply yield percentage to contents
    ↓
Spilled items get contaminated state
    ↓
Apply durability damage to tool
    ↓
Update UI
```

### Consuming Food Flow

```
Player clicks [Actions] → [Consume]
    ↓
UIManager.handleConsumeAction()
    ↓
Check if item is in sealed container → Block if sealed
    ↓
If contaminated → Show warning modal
    ↓
UIManager.executeConsumeAction()
    ↓
ItemSystem.consumeFood(item, player, amount=null)
    ↓
If amount is null → calculateOptimalConsumption()
    ↓
Calculate hunger/thirst needed
    ↓
Calculate optimal amount to consume
    ↓
Consume optimal amount or all if won't fill
    ↓
Apply nutrition (hunger/thirst restoration)
    ↓
If contaminated → Calculate sickness
    ↓
Apply ironStomach trait resistance
    ↓
Add sickness status effect if applicable
    ↓
Reduce item quantity or remove if empty
    ↓
Update UI and refresh inventory display
```

### Healing Flow

```
Player uses medkit
    ↓
UIManager.handleUseAction()
    ↓
Calculate healPerTurn from item.healAmount / item.healDuration
    ↓
Apply slowHealer trait modifier (×0.5 if present)
    ↓
Player.addStatusEffect({ type: 'heal', value, duration })
    ↓
Each turn: Player.processStatusEffects()
    ↓
If wounds exist:
    → Reduce each wound.severity by (value × 0.15)
    → Remove wounds with severity < 0.01
    → Log: "{name} helps close your wounds."
Else (no wounds):
    → Restore blood by (value × 0.3), capped at maxBlood
    → Reset regenCooldown to 0 (bypass natural regen delay)
    → Log: "+{amount} blood restored by {name}"
    ↓
Decrement duration
    ↓
Remove effect when duration reaches 0
```

### Trait Effect Propagation

```
Character Creation
    ↓
CharacterCreationSystem.applyTraitsToCharacter()
    ↓
Merge trait.effect into player.traitEffects
    ↓
Systems check player.traitEffects:
    - Player.getMaxCarryWeight() → checks carryMod
    - Anatomy.getVisionRange() → checks visionBonus/visionPenalty
    - EquipmentSystem.getActionCostModifier() → checks actionCostMod
    - UIManager.handleUseAction() → checks healingMod
    - ItemSystem.consumeFood() → checks poisonResist
```

### Combat Flow

```
Player bumps into entity (tryMove detects blocked tile with entity)
    ↓
Player.attack(target)
    ↓
EquipmentSystem.getActiveWeapon() → weapon or null
    ↓
CombatSystem.resolveAttack(player, target, weapon)
    ↓
[Full attack resolution — see Combat System section]
    ↓
If result.killed → target.die()
    ↓
Opportunity attacks: if player moves away from adjacent ENGAGED enemies
    → Only ENGAGED NPCs get free attack (UNAWARE/ALERT NPCs do not)
    → Skipped if player is in defensive stance (canDisengage)
    → CombatEffects floating text "OPP. ATTACK"
```

---

## Data Flow

### Turn Processing (Energy-Based)

```
Game.processTurn(action)
    ↓
Player performs action (move, pickup, wait, cycle_movement, ascend, descend)
    ↓
Each action has an energy cost (stored in player.lastActionCost):
    - Walk move: 100 (baseline)
    - Run move: 75 (faster — fewer NPC actions)
    - Crouch move: 125 (slower — more NPC actions)
    - Prone move: 150
    - Attack: weapon actionCost × equipment modifier
    - Wait: 100
    - Pickup/GrabAll: 50
    - Cycle movement mode: 0 (free action — no world tick)
    ↓
If player acted AND actionCost > 0:
    1. turnCount++
    2. timeSystem.tick()                    // advance day/night clock
    3. lightingSystem.consumeFuel()         // drain batteries/fuel from active lights
    4. player.processStatusEffects()        // hunger, thirst, anatomy, heal/sickness
    5. updateFoV()                          // recalculate vision + lighting
    6. world.processTurn(actionCost)        // NPC turns (energy-scaled), food spoilage
    7. soundSystem.processTurn()            // decay active sounds
    8. checkGameOver()                      // anatomy.isDead() → game over screen
    ↓
world.processTurn(actionCost):
    For each NPC within 30 tiles:
        NPC gains energy = NPC.speed × (actionCost / 100)
        While energy ≥ moveCost (max 3 actions):
            Execute AI behavior → spend energy
    ↓
Render updated game state

Game.advanceTurn(turns) — same loop with actionCost=100 per turn (crafting, smashing, etc.)
```

**Speed Examples:**
- Player running (cost 75) vs Raider (speed 85): Raider gains 63.75 energy/tick → ~1.57 ticks per move → **player outruns raider**
- Player walking (cost 100) vs Raider (speed 85): Raider gains 85 energy/tick → ~1.18 ticks per move → **raider slightly slower**
- Player crouching (cost 125) vs Raider (speed 85): Raider gains 106.25 energy/tick → acts every tick → **raider catches up**

### Item Creation

```
ContentManager.createItem(familyId, materialId, modifierId)
    ↓
Copy item family definition
    ↓
Apply material properties (color, durability, weight mod)
    ↓
Apply modifier properties (name prefix, weight mod)
    ↓
If sealed container → Add random contents
    ↓
Deep copy state object
    ↓
Return item instance
```

### World Generation

```
World.init()
    ↓
Generate chunks around spawn
    ↓
For each chunk:
    - Select biome (zone-based: urban_core, suburbs, industrial, etc.)
    - Generate clean terrain
    - Generate road network
    - Generate sewer system (z=-1)
    - Generate buildings along roads
        → Try prefab match (size + biome + door orientation)
        → Fallback to procedural rectangular building
    - Add obstacles and debris
    - Spawn items (building-aware loot tables)
```

### Prefab Building System
**Files:** `src/content/BuildingPrefabs.js`, `src/world/Chunk.js`

**Prefabs:** 9 validated ASCII layouts
- **Small:** studio_apartment (10×8), corner_store (12×10), pharmacy (10×10), garage (12×10)
- **Medium:** two_bedroom_apartment (16×14), small_office (14×14), clinic (16×14)
- **Large:** warehouse (20×20), large_apartment (20×18)

**Layout Symbols:**
- `#` = exterior wall, `|`/`-` = interior walls
- `+` = exterior door (WorldObject via createDoor, biome-based type, lock chance)
- `d` = interior door (WorldObject, always unlocked)
- `.` = floor, `<`/`>` = stairs, `~` = skip tile

**Door Types by Biome (`BIOME_DOOR_TYPES`):**
- urban_core: glass exterior, wood_basic interior
- suburbs/rural/forest/ruins: wood_basic both
- industrial: metal exterior, wood_basic interior
- rich_neighborhood: wood_reinforced exterior, wood_basic interior

**Prefab Selection:** `findMatchingPrefab(width, height, biome, doorSide)` — only matches when door should be on bottom (doorSide=2), ensuring doors face the road.

### Loot Table System
**File:** `src/content/LootTables.js`

**Room Types (16):**
- Residential: living, bedroom, kitchen, bathroom
- Commercial: store, backroom
- Office: office, reception
- Medical: store, storage, waiting, exam
- Industrial: garage_bay, garage_tools, warehouse_floor, warehouse_storage

**How It Works:**
```
Chunk.spawnItems(biome)
    ↓
Scan all floor tiles at z=0
    ↓
Group by tile.roomType
    ↓
For tagged tiles → generateRoomLoot(roomType, floorTiles)
    → Weighted random from room-specific item pools
    → Respects maxItems per room and spawnChance per tile
    ↓
For untagged tiles → OUTDOOR_LOOT (2% per-tile chance)
    → Sparse random items on roads/sidewalks/outdoors
```

**Each room type defines:**
- `spawnChance` — per-tile probability of attempting a spawn
- `maxItems` — cap per room instance
- `pools` — weighted list of `{ familyId, weight }` entries

---

## Status Effects

### Effect Types

**heal:**
- Applied by: Medkit (and other medical items)
- Effect: Patches wounds (reduces wound severity) or restores blood if no wounds
- Wound healing: each wound.severity reduced by `value × 0.15` per turn
- Blood restoration: `value × 0.3` blood per turn (bypasses regenCooldown)
- Modified by: `slowHealer` trait (×0.5 value)
- Duration: Item-specific (medkit = 4 turns)

**sickness:**
- Applied by: Contaminated food
- Effect: Damages stomach via `anatomy.damagePart('torso.stomach', value)`
- Modified by: `ironStomach` trait (50% reduction in contamination effect)
- Duration: Based on contamination level

### Status Effect Processing

Each turn in `Player.processStatusEffects()`:
1. Process hunger/thirst drain (skipped in exploreMode)
2. Starvation: hunger=0 → damage stomach → liver → organ failure
3. Dehydration: thirst=0 → damage kidneys → brain
4. `anatomy.processTurn()` — bleeding, organ effects, suffocation, shock, blood regen
5. Iterate through active status effects:
   - `heal` → patch wounds or restore blood
   - `sickness` → damage stomach
6. Decrement duration, remove expired effects

---

## UI System

### Container Display Pattern (CONSISTENCY RULE)

**All containers use the same inline display pattern:**

1. **Pockets** (on wearable containers like coats, backpacks)
   - Display inline in inventory view
   - Show capacity, volume, and contents
   - Each item in pocket gets its own [Actions] button
   - Source type: `actions-pocket-item`

2. **Opened Containers** (cans, bottles, boxes)
   - Display inline in inventory view (same as pockets)
   - Show contents list with quantity and contamination warnings
   - Each item in container gets its own [Actions] button
   - Source type: `actions-container-item`

**Why this matters:**
- Consistency: Users interact with all container contents the same way
- No special cases: Food in cans works exactly like items in pockets
- Reusable code: Same event handlers and display logic

**Implementation:**
```javascript
// In renderInventoryTab() or showInspectModal()
if (item.state && item.state.opened && item.contents && item.contents.length > 0) {
    // Display contents inline with Actions buttons
    for (let ci = 0; ci < item.contents.length; ci++) {
        const contentItem = item.contents[ci];
        html += `<button data-action="actions-container-item" 
                         data-container-id="${item.id}" 
                         data-item-index="${ci}">Actions</button>`;
    }
}
```

### Modal Flow

```
Detailed Inventory (I key)
    ↓
Click [Actions] button on item
    ↓
UIManager.showActionsModal()
    ↓
Display context-aware actions:
    - Always: Inspect, Move, Drop, Throw
    - If sealed: Open
    - If food/drink: Consume
    - If consumable: Use
    ↓
Player selects action
    ↓
UIManager.handleItemAction()
    ↓
Route to specific handler
```

### Action Handlers

- `handleDropAction()` - Removes item from inventory, adds to ground
- `handleUseAction()` - Uses consumable (medkit, etc.)
- `showOpenToolSelection()` - Shows available opening methods
- `handleOpenAction()` - Opens container with selected tool
- `handleConsumeAction()` - Consumes food/drink
- `handleConsumeContentsAction()` - Consumes food from opened container

---

## Time System
**File:** `src/systems/TimeSystem.js`

**Purpose:** Manages day/night cycle and time-of-day tracking.

**Key Properties:**
- `currentTick` - Current tick count
- `ticksPerHour` - 30 ticks per game hour (1 turn ≈ 2 minutes)
- `hour` / `minute` - Current time of day

**Key Methods:**
- `tick()` - Advances time by one turn
- `getAmbientLight()` - Returns 0.0-1.0 light level based on time of day
- `getTimeOfDay()` - Returns period name (dawn, morning, noon, afternoon, dusk, night)
- `getFormattedTime()` - Returns "HH:MM" string

**Light Levels by Time:**
- Night (22:00-5:00): 0.05-0.1
- Dawn (5:00-7:00): 0.1-0.6
- Day (7:00-17:00): 0.8-1.0
- Dusk (17:00-20:00): 0.6-0.1
- Evening (20:00-22:00): 0.1-0.05

---

## Lighting System
**File:** `src/systems/LightingSystem.js`

**Purpose:** Calculates per-tile light levels from ambient and point sources, manages fuel consumption.

**Key Methods:**
- `calculate(px, py, pz, range)` - Calculates light levels for visible area
- `getEffectiveVisionRadius(baseRange)` - Modulates vision by ambient light + player light
- `isLightActive(item)` - Checks if light source is on and has fuel
- `consumeFuel()` - Drains batteries/fuel from active light sources each turn
- `getPlayerLightSources()` - Returns active light items in player's hands

**Light Source Types:**
- **Flashlight** - Cone-shaped, radius 12, uses batteries (durability drain), fuelPerTurn 0.02
- **Lantern** - Radial, radius 7, uses lantern_fuel (quantity drain), fuelPerTurn 0.03

**Fuel Consumption:**
- Batteries: `fuel.durability -= item.fuelPerTurn` per turn (removed at 0)
- Lantern fuel: `fuel.quantity -= item.fuelPerTurn * 10` per turn (removed at 0)

**Integration:**
- `Game.advanceTurn()` calls `lightingSystem.consumeFuel()` each turn
- `Game.updateFoV()` calls `lightingSystem.getEffectiveVisionRadius()` and `lightingSystem.calculate()`
- `TimeSystem.getAmbientLight()` provides base ambient level

---

## World Object System
**File:** `src/systems/WorldObjectSystem.js`

**Purpose:** Handles interactions with doors, furniture, and other world objects.

**Key Methods:**
- `performAction(worldObject, action, player)` - Routes to specific action handler
- `smashObject(object, player, weapon)` - Auto-completes: loops hits until destroyed or weapon breaks
- `disassembleObject(object, player, tool)` - Careful removal with full material yield
- `searchFurniture(object, player)` - Opens furniture contents transfer UI

**Smash Auto-Complete:**
- Loops damage until object durability reaches 0 or weapon durability reaches 0
- Reports summary: hit count, total turns, materials dropped, contents spilled
- Lock breaks at <30% object durability
- All turns advance at once via `advanceTurn(totalTime)`

---

## Future Systems (Planned)

### Sleep/Rest System
- Will use `lightSleeper` trait
- Natural healing during rest (wound patching + blood regen)
- Modified by `slowHealer` trait

### Ranged Combat
- Accuracy falloff with distance
- Ammunition system
- Cover mechanics

### Advanced NPC AI (Phase 2)
- Faction system (hostile, neutral, friendly) — core detection/aggression implemented
- NPC-to-NPC combat
- Trading with friendly NPCs
- Patrol routes and territory
- Group tactics (flanking, coordinated attacks)

### Status Effects & Injuries (Phase 3)
- Infection from untreated wounds
- Fractures and splinting
- Tourniquet system
- Medical treatment using existing anatomy + medical items

### Cybernetics & Echo Effects (Phase 4)
- Cybernetic organ replacements (framework exists in `Anatomy.installCybernetic()`)
- Blood type / transfusion
- Echo effects (TBD)

### Other Planned Features
- `lucky` trait for better loot/crit rolls
- Weapon durability degradation in combat
- Equipment set bonuses
- Equipment stat requirements (cybernetic prerequisites)
- Stamina system tied to movement modes

---

## Crafting System
**Files:** `src/systems/CraftingSystem.js`, `src/ui/CraftingUI.js`, `src/content/ContentManager.js`

**Purpose:** Manages tiered component-based crafting and disassembly with quality mechanics.

**Cache:** v19

### Core Concepts

**Component Property System:**
- Components have numeric properties (e.g., `cutting: 3`, `grip: 2`, `fastening: 1`)
- 16 property categories: cutting, piercing, grip, fastening, binding, structural, padding, insulation, container, blunt, grinding, fuel, electrical, conductor, chemical, medical
- Recipes require minimum property values
- Multiple components can satisfy the same requirement

**Tier Gating (maxValue):**
- Requirements can specify `maxValue` to exclude high-tier components from low-tier recipes
- Example: Shiv requires `cutting: 1, maxValue: 1` — Metal Shard (1) works, Crude Blade (2) is blocked
- Prevents wasting good components on cheap items
- `matchesRequirement()` checks both minValue and maxValue

**Craftable Intermediates:**
- Some recipes produce components used in higher-tier recipes
- Intermediates have `craftedComponentId` and `craftedProperties`
- `getComponentProperty()` checks `craftedProperties` first, then base `properties`
- Example: Crude Blade (craftedProperties: {cutting: 2, piercing: 1}) satisfies Knife's cutting:2+ requirement
- 4 intermediates: Crude Blade, Sharpened Stick, Wrapped Handle, Strap

**Raw Materials (spawn in world via loot tables):**
- glass_shard, wood_piece, stone, bone_shard, rubber_piece, duct_tape, nail, cloth_wrap
- LootTables entries use `componentId` instead of `familyId`
- `rollLootPool()` returns `{familyId}` or `{componentId}`, Chunk.js calls `createComponent()` or `createItem()`

**Specific Component Requirements:**
- Some recipes require exact component types (e.g., `component: 'fabric_panel'`)
- Matched by `componentId` field, not properties
- Example: Backpack requires exactly 2 Strap components, not just any item with binding property

**Mixed Requirements:**
- Recipes can combine both requirement types
- Example: Backpack needs specific fabric_panel + strap components AND any fasteners with fastening +2

### Component Properties

**Available Properties:**
```javascript
cutting: 1-3      // Sharp edges (Metal Shard: 1, Blade: 3)
piercing: 1-2     // Sharp points (Metal Shard: 1, Blade: 2)
grip: 1-3         // Handle quality (Cloth Wrap: 1, Handle: 3)
fastening: 1-3    // Fastener strength (Button: 1, Zipper: 2, Bolt: 3)
binding: 1-3      // Binding strength (Thread: 1, Wire: 2, Strap: 3)
structural: 1-3   // Support strength (Handle: 1, Metal Tube: 2)
padding: 1-3      // Cushioning (Cloth Wrap: 1, Fabric Panel: 2)
medical: 1-3      // Medical value (Bandage: 1, Antiseptic: 2)
container: 1-3    // Container capacity (Metal Casing: 1)
chemical: 1-3     // Chemical potency (Antiseptic: 1, Acid: 2)
conductor: 1-3    // Electrical conductivity (Wire: 1, Carbon Rod: 2)
electrical: 1-3   // Electrical complexity (Wire: 1, Circuit: 2)
insulation: 1-3   // Insulation quality (Fabric Panel: 1)
```

### Quality & Durability System

**Component Quality:**
- All components have quality value (0-100)
- Quality degrades during disassembly based on tool
- Quality affects crafted item durability

**Disassembly Quality Modifiers:**
```javascript
qualityMod values in disassemblyMethods:
- Hand: 0.60-0.75 (loses 25-40% quality)
- Knife: 0.80-0.90 (loses 10-20% quality)  
- Proper tool: 0.85-1.00 (loses 0-15% quality)
```

**Crafting Quality Calculation:**
```javascript
// Average all component qualities
const avgQuality = componentsUsed.reduce((sum, c) => sum + c.quality, 0) / componentsUsed.length;
craftedItem.durability = Math.floor(avgQuality);
```

**Quality Degradation Loop:**
```
1. Find pristine knife (100% durability)
2. Disassemble with hands (qualityMod: 0.6)
   → Components: 60 quality
3. Craft new knife from degraded parts
   → New knife: 60% durability
4. Disassemble again
   → Components: 36 quality (60 * 0.6)
5. Eventually unusable
```

### Component Matching Logic

**Property-Based Matching (with maxValue):**
```javascript
// Requirement: { property: 'cutting', minValue: 1, maxValue: 1, quantity: 1 }
// matchesRequirement() in CraftingSystem.js:
const value = getComponentProperty(comp, requirement.property);
if (value < requirement.minValue) return false;
if (requirement.maxValue && value > requirement.maxValue) return false;
return true;
```

**craftedProperties Priority:**
```javascript
// getComponentProperty() checks craftedProperties first:
getComponentProperty(comp, property) {
    if (comp.craftedProperties && comp.craftedProperties[property] !== undefined)
        return comp.craftedProperties[property];
    if (comp.properties && comp.properties[property] !== undefined)
        return comp.properties[property];
    return 0;
}
```

**Specific Component Matching:**
```javascript
// Requirement: { component: 'fabric_panel', quantity: 3 }
matchingComponents = availableComponents.filter(comp => 
    comp.componentId === 'fabric_panel' || 
    comp.id.startsWith('fabric_panel')
);
```

### Component Creation

**From Disassembly:**
```javascript
CraftingSystem.createComponentItem(compDef, quality, quantity) {
    return {
        id: `${compDef.id}_${Date.now()}_${Math.random()}`,
        componentId: compDef.id,           // For matching
        name: compDef.name,
        type: 'component',
        properties: componentTemplate.properties || {},  // Copy properties
        quality: quality,
        quantity: quantity,
        isComponent: true
    };
}
```

**From Crafting:**
```javascript
ContentManager.createItem(familyId) {
    // If component-type item, add componentId and properties
    if (family.type === 'component' && this.components[familyId]) {
        item.componentId = familyId;
        item.properties = this.components[familyId].properties || {};
        item.isComponent = true;
    }
}
```

### Recipe Structure

**Tier-Gated Recipe (Shiv — maxValue blocks high-tier components):**
```javascript
shiv: {
    componentRequirements: [
        { property: 'cutting', minValue: 1, maxValue: 1, quantity: 1, name: 'Sharp Edge' },
        { property: 'grip', minValue: 1, quantity: 1, name: 'Handle/Grip' }
    ],
    components: [
        { id: 'scrap_metal_shard', quantity: 1, quality: 100 },
        { id: 'cloth_wrap', quantity: 1, quality: 100 }
    ],
    disassemblyMethods: {
        hand: { componentYield: 1.0, qualityMod: 0.7, timeRequired: 1 },
        knife: { componentYield: 1.0, qualityMod: 0.9, timeRequired: 1 }
    }
}
```

**Mixed Recipe (Backpack):**
```javascript
backpack: {
    componentRequirements: [
        { component: 'fabric_panel', quantity: 3, name: 'Fabric Panel' },  // Specific
        { component: 'strap', quantity: 2, name: 'Strap' },                // Specific
        { property: 'fastening', minValue: 2, quantity: 2, name: 'Fasteners' },  // Property
        { component: 'thread', quantity: 1, name: 'Thread' }               // Specific
    ],
    components: [
        { id: 'fabric_panel', quantity: 3, quality: 100 },
        { id: 'strap', quantity: 2, quality: 100 },
        { id: 'buckle', quantity: 2, quality: 100 },
        { id: 'zipper', quantity: 2, quality: 100 },
        { id: 'thread', quantity: 1, quality: 100 }
    ],
    disassemblyMethods: {
        hand: { componentYield: 0.75, qualityMod: 0.6, timeRequired: 3, excludeComponents: ['thread'] },
        knife: { componentYield: 1.0, qualityMod: 0.85, timeRequired: 2 }
    }
}
```

### Key Methods

**CraftingSystem:**
- `getPlayerComponents(player)` - Gathers all components from equipped, carried, stored, and ground
- `canCraftItem(player, itemFamilyId)` - Checks if player has required components
- `craftItem(player, itemFamilyId)` - Consumes components and creates item
- `canDisassembleItem(item)` - Checks if item has components array
- `disassembleItem(item, tool, player)` - Breaks item into components with quality loss
- `createComponentItem(compDef, quality, quantity)` - Creates component with properties

**Component Gathering:**
```javascript
getPlayerComponents(player) {
    const components = [];
    
    // 1. Equipped items
    for (const slot in player.equipment) {
        if (item && item.isComponent) components.push(item);
    }
    
    // 2. Carried items (hands)
    if (player.carrying.leftHand?.isComponent) components.push(...);
    if (player.carrying.rightHand?.isComponent) components.push(...);
    
    // 3. Stored items (pockets/containers)
    const storedItems = player.containerSystem.getAllStoredItems(player);
    for (const stored of storedItems) {
        if (stored.item.isComponent) components.push(stored.item);
    }
    
    // 4. Ground items at player location
    const groundItems = world.getItemsAt(player.x, player.y, player.z);
    for (const item of groundItems) {
        if (item.isComponent) components.push(item);
    }
    
    return components;
}
```

### Disassembly Methods

**Structure:**
```javascript
disassemblyMethods: {
    hand: {
        componentYield: 0.75,           // 75% of components returned
        qualityMod: 0.6,                // Components at 60% quality
        timeRequired: 3,                // Takes 3 turns
        excludeComponents: ['thread']   // Thread is lost
    },
    knife: {
        componentYield: 1.0,            // 100% of components returned
        qualityMod: 0.85,               // Components at 85% quality
        timeRequired: 1                 // Takes 1 turn
    }
}
```

**Exclude Options:**
- `excludeComponents: ['thread', 'rivet']` - Specific components lost
- `excludeProperties: ['fastening']` - All components with property lost

### UI Integration

**Workshop Panel (V key):**
- Shows all craftable items with requirement status (have/need)
- Lists valid components for property requirements with property values
- Shows disassemblable items
- Shows `craftTime` for each recipe
- Shows `maxValue` ranges (e.g., "cutting 1-1" instead of "cutting +1")
- Shows `craftedProperties` on intermediate recipes

**Sub-Recipe Drill-Down:**
- If a requirement can be satisfied by a craftable intermediate, shows "⚒ Craft" button
- Clicking navigates to the sub-recipe detail view
- Back button returns to parent recipe
- After crafting a sub-component, navigates back to parent recipe automatically

**Crafting UI:**
```javascript
showRecipeDetails(uiManager, recipeId, parentRecipeId) {
    // parentRecipeId enables back-to-parent navigation
    // For each requirement:
    //   - Shows maxValue range if present
    //   - Shows sub-recipe buttons for craftable intermediates
    //   - Shows valid items with property values
}
```

### Equipment Integration

**Back Slot:**
- Added to `Player.equipment` object
- Backpack equips to `back` slot
- `EquipmentSystem.getValidSlotsForItem()` recognizes 'back' slot type
- `EquipmentSystem.getSlotDisplayName()` shows "Back"

**Container Access:**
- Equipped items with pockets accessible via `ContainerSystem.getAllStoredItems()`
- Backpack pockets appear in "Stored Items" section when equipped
- Items can be moved to/from backpack pockets

### Strategic Implications

**Quality Management:**
- Use proper tools to preserve component quality
- Knife is best general-purpose disassembly tool (0.85-0.9 quality retention)
- Hand disassembly degrades quality significantly (0.6-0.75)
- Fresh items are valuable - quality loss is permanent

**Component Economy:**
- Disassemble found items for components
- Craft needed items from components
- Quality degrades with each craft/disassemble cycle
- Eventually need to find fresh items

**Recipe Design:**
- Property-based requirements allow flexibility
- Specific component requirements ensure exact items
- Mixed requirements balance flexibility and specificity

---

## Debugging & Testing

### Trait Testing Checklist

- [ ] `weakConstitution` - Legacy maxHPMod effect (no current anatomy impact — may need rework)
- [ ] `packRat` - Check carry capacity increased by 20%
- [ ] `slowHealer` - Use medkit, verify heal is halved
- [ ] `ironStomach` - Eat contaminated food, verify reduced sickness
- [ ] `quickReflexes` - Check action cost modifier
- [ ] `clumsy` - Check action cost modifier
- [ ] `nightVision` - Check vision range increased by 2
- [ ] `nearSighted` - Check vision range decreased by 2

### System Integration Tests

- [ ] Open can with different tools, verify yield percentages
- [ ] Eat contaminated food, verify sickness applied
- [ ] Use medkit with slowHealer trait, verify reduced healing
- [ ] Consume partial food, verify quantity tracking
- [ ] Split food item, verify weight/volume recalculation

---

## Performance Considerations

### Optimization Points

1. **FoV Calculation** - Only recalculate when player moves
2. **Status Effects** - Process only active effects
3. **Container Searches** - Cache stored item lists
4. **Trait Checks** - Single object lookup, not array iteration

### Memory Management

- Deep copy item states to avoid shared references
- Remove expired status effects immediately
- Clean up dropped items from world when appropriate

---

## Extension Guidelines

### Adding a New Trait

1. Define in `CharacterCreationSystem.js` traits object
2. Add effect property (e.g., `{ myNewMod: 1.5 }`)
3. Find relevant system that should use the trait
4. Add check for `player.traitEffects.myNewMod`
5. Apply modifier to calculation
6. Test with and without trait

### Adding a New Item Type

1. Define in `ContentManager.js` itemFamilies
2. Add glyph, color, type, tags
3. Add to weight/volume defaults
4. If container, define openMethods
5. If consumable, define nutrition
6. Add to world generation spawn list
7. Test spawning and interactions

### Adding a New System

1. Create system file in `src/systems/`
2. Initialize in `Game.js` startGame()
3. Add integration points in relevant systems
4. Check for trait modifiers where applicable
5. Update this documentation
6. Add to turn processing if needed

---

## Item Addition Workflows

### How to Add a New Food Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the item in `itemFamilies` object**
```javascript
my_new_food: {
    name: 'My New Food',
    type: 'food',              // 'food' for solid foods
    glyph: 'f',                // Single character display
    color: '#ffaa00',          // Hex color code
    quantity: 250,             // Amount in grams
    quantityUnit: 'g',         // Unit (g for grams)
    nutrition: {
        hunger: 25,            // Total hunger restoration
        thirst: -5             // Negative = makes you thirsty
    },
    tags: ['food', 'protein'], // Tags affect spoilage rate
    state: {}                  // Empty state object
}
```

**Step 2: Add to weight/volume defaults (if needed)**
```javascript
const WEIGHT_DEFAULTS = {
    food: 250  // Default weight in grams
};

const VOLUME_DEFAULTS = {
    food: 200  // Default volume in ml
};
```

**Step 3: Add to container contents (if spawning in containers)**
```javascript
can_sealed: {
    // ...
    contents: [
        { family: 'beans', weight: 0.8 },
        { family: 'soup', weight: 0.15 },
        { family: 'my_new_food', weight: 0.05 }  // Add here
    ]
}
```

**Spoilage Rates by Tag:**
- `protein` tag: 0.03/turn (~10 turns)
- `liquid` tag: 0.05/turn (~6 turns)
- No tag: 0.04/turn (~7-8 turns)

**Nutrition Guidelines:**
- Hunger restoration: 15-35 per item
- Thirst: Positive for wet foods, negative for dry foods
- Per-gram calculation: `nutrition.hunger / quantity`

---

### How to Add a New Drink Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the item in `itemFamilies` object**
```javascript
my_new_drink: {
    name: 'My New Drink',
    type: 'drink',             // 'drink' for liquids
    glyph: '~',                // Single character display
    color: '#00aaff',          // Hex color code
    quantity: 350,             // Amount in milliliters
    quantityUnit: 'ml',        // Unit (ml for milliliters)
    nutrition: {
        thirst: 30,            // Total thirst restoration
        hunger: 5              // Optional hunger bonus
    },
    tags: ['drink', 'liquid'], // Tags for categorization
    state: {}                  // Empty state object
}
```

**Step 2: Add to bottle contents**
```javascript
bottle_sealed: {
    // ...
    contents: [
        { family: 'water', weight: 0.4 },
        { family: 'soda', weight: 0.3 },
        { family: 'juice', weight: 0.2 },
        { family: 'my_new_drink', weight: 0.1 }  // Add here
    ]
}
```

**Important: Drinks spill from unsealed containers at 7ml/turn**

---

### How to Add a New Tool Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the item in `itemFamilies` object**
```javascript
my_new_tool: {
    name: 'My New Tool',
    type: 'tool',              // Type: tool
    glyph: 't',                // Single character display
    color: '#888888',          // Hex color code
    weight: 500,               // Weight in grams
    volume: 300,               // Volume in ml
    durability: 100,           // Max durability
    tags: ['tool', 'metal'],   // Tags for categorization
    toolType: 'my_tool_type',  // Unique tool type identifier
    actions: []                // Available actions
}
```

**Step 2: Add to container opening methods (if it can open containers)**
```javascript
can_sealed: {
    // ...
    openMethods: {
        can_opener: { yield: 1.0, durabilityDamage: 0 },
        my_tool_type: { yield: 0.9, durabilityDamage: 3 }  // Add here
    }
}
```

**Step 3: Add to world generation spawn list**
```javascript
// In Chunk.js generateRandomItem()
const itemPool = [
    'pipe', 'knife', 'medkit', 'my_new_tool'  // Add here
];
```

**Tool Properties:**
- `durability`: How many uses before breaking
- `yield`: Percentage of contents preserved when opening (0.0-1.0)
- `durabilityDamage`: How much durability lost per use

---

### How to Add a New Container Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the container in `itemFamilies` object**
```javascript
my_container: {
    name: 'My Container',
    type: 'container',
    glyph: 'C',
    color: '#666666',
    isContainer: true,         // Required flag
    state: { 
        opened: false,         // Starts sealed
        sealed: true 
    },
    openMethods: {             // How to open it
        hand: { yield: 1.0, durabilityDamage: 0 },
        knife: { yield: 0.95, durabilityDamage: 2 }
    },
    contents: [                // What's inside (random selection)
        { family: 'item1', weight: 0.5 },
        { family: 'item2', weight: 0.5 }
    ],
    tags: ['container', 'plastic']  // 'plastic' = resealable
}
```

**Container Tags:**
- `plastic`: Can be resealed (bottles)
- `metal`: Cannot be resealed (cans)
- `sealed`: Starts sealed

**Container State:**
- `state.opened`: true/false - Has been opened
- `state.sealed`: true/false - Currently sealed (prevents spillage)

---

### How to Add a New Weapon Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the weapon in `itemFamilies` object**
```javascript
my_weapon: {
    name: 'My Weapon',
    type: 'weapon',
    glyph: '/',
    color: '#ff0000',
    weight: 1200,
    volume: 800,
    durability: 150,
    damage: {
        min: 5,
        max: 15
    },
    attackCost: 100,           // Action cost to attack
    range: 1,                  // Attack range in tiles
    tags: ['weapon', 'melee'], // or 'ranged'
    actions: ['equip', 'attack']
}
```

**Weapon Properties:**
- `damage.min/max`: Damage range
- `attackCost`: Action points to use
- `range`: How far it can attack
- `durability`: Uses before breaking

---

### How to Add a New Wearable/Armor Item

**File:** `src/content/ContentManager.js`

**Step 1: Define the wearable in `itemFamilies` object**
```javascript
my_armor: {
    name: 'My Armor',
    type: 'wearable',
    glyph: '[',
    color: '#0088ff',
    weight: 2000,
    volume: 1500,
    slot: 'torso',             // 'head', 'torso', 'legs'
    defense: 5,                // Damage reduction
    durability: 200,
    pockets: [                 // Optional storage
        {
            name: 'Pocket',
            maxWeight: 1000,
            maxVolume: 500,
            contents: []
        }
    ],
    tags: ['wearable', 'armor'],
    actions: ['equip']
}
```

**Wearable Slots:**
- `head`: Helmets, hats, masks
- `torso`: Jackets, vests, shirts
- `legs`: Pants, shorts

**Pockets (Optional):**
- Add `pockets` array for storage containers
- Each pocket has `maxWeight`, `maxVolume`, `contents`

---

## Quick Reference: Files to Touch When Adding Items

### Adding ANY Item:
1. **`src/content/ContentManager.js`** - Define item in `itemFamilies`
2. **`src/content/LootTables.js`** - Add to room-type loot pools (building spawns) and/or `OUTDOOR_LOOT` (outdoor spawns)

### Adding Food/Drink:
3. **`src/content/ContentManager.js`** - Add to container contents (cans/bottles)
4. **Check spoilage rates** - Ensure tags match desired spoilage behavior

### Adding Tools:
3. **`src/content/ContentManager.js`** - Add to container `openMethods` (if opener)
4. **`src/systems/ItemSystem.js`** - Add tool-specific logic (if special behavior)

### Adding Containers:
3. **`src/content/ContentManager.js`** - Define contents and opening methods
4. **`src/systems/ItemSystem.js`** - Verify opening logic handles new container

### Adding Weapons:
3. **`src/content/ContentManager.js`** - Define weapon with required properties:
   - `type: 'weapon'` — required for EquipmentSystem to recognize it
   - `baseDamage: '1d6'` — dice string for damage roll
   - `weaponStats.attackType` — `'sharp'`, `'blunt'`, or `'unarmed'` (determines targeting profile, wound types, bleed behavior)
   - `weaponStats.bleedChance` — 0.0-1.0 (sharp weapons only, default 0.4)
   - `slots: ['hand']` — equippable in hand slots
   - Optional: `canTwoHand: true`, `twoHandDamageBonus: '1d4'`, `twoHandActionCost: 120`
   - Optional: `damageMod: 0.2` — flat damage multiplier bonus
   - Optional: `actionCost: 100` — turn cost (higher = slower)
4. **`src/systems/CombatSystem.js`** - No changes needed unless adding a new `attackType` (would need new entry in `WEAPON_TARGETING` and `ATTACK_VERBS`)
5. **`src/content/LootTables.js`** - Add to appropriate room type loot pools

### Adding Wearables:
3. **`src/systems/EquipmentSystem.js`** - Verify slot compatibility

---

## Item Property Reference

### Required Properties (All Items):
```javascript
{
    name: 'Item Name',         // Display name
    type: 'food',              // Item category
    glyph: 'i',                // Single character
    color: '#ffffff',          // Hex color
    tags: ['tag1', 'tag2']     // Categorization
}
```

### Optional Properties:
```javascript
{
    weight: 100,               // Grams (defaults by type)
    volume: 50,                // Milliliters (defaults by type)
    quantity: 250,             // Amount (food/drink)
    quantityUnit: 'g',         // 'g' or 'ml'
    durability: 100,           // Tool/weapon durability
    nutrition: {               // Food/drink only
        hunger: 20,
        thirst: 10
    },
    state: {},                 // Dynamic state (contamination, opened, etc.)
    isContainer: true,         // Container flag
    contents: [],              // Container contents
    openMethods: {},           // How to open container
    pockets: [],               // Wearable storage
    slots: ['hand'],           // Equipment slots array ('hand', 'head', 'torso', 'legs', 'back')
    defense: 5,                // Armor value (armor-type items)
    defenseMod: 0,             // Bonus armor value
    baseDamage: '1d6',         // Weapon damage dice string
    damageMod: 0.2,            // Weapon damage multiplier bonus
    weaponStats: {             // Weapon combat properties
        attackType: 'sharp',   // 'sharp', 'blunt', or 'unarmed'
        bleedChance: 0.4       // Chance to cause bleeding (sharp only)
    },
    canTwoHand: true,          // Can be equipped in both hands
    twoHandGrip: false,        // Currently held two-handed (runtime)
    twoHandDamageBonus: '1d4', // Extra damage dice when two-handed
    twoHandActionCost: 120,    // Action cost when two-handed
    actionCost: 100,           // Turn cost for weapon attacks
    weightMod: 1.0,            // Action cost multiplier from equipment weight
    actions: []                // Available actions
}
```

---

## Testing Checklist for New Items

### Food Items:
- [ ] Item spawns in world or containers
- [ ] Quantity displays correctly
- [ ] Nutrition values restore hunger/thirst appropriately
- [ ] Spoilage rate matches tag (protein/liquid/default)
- [ ] Freshness indicator shows correct colors
- [ ] Smart consumption calculates optimal amount
- [ ] Empty items are removed from containers

### Drink Items:
- [ ] Item spawns in bottles
- [ ] Quantity displays in ml
- [ ] Thirst restoration works correctly
- [ ] Spillage occurs at 7ml/turn when unsealed
- [ ] Resealing stops spillage (bottles only)
- [ ] Empty items are removed from containers

### Tool Items:
- [ ] Item spawns in world
- [ ] Can be equipped/carried
- [ ] Durability decreases with use
- [ ] Opening containers works with correct yield
- [ ] Tool breaks when durability reaches 0

### Container Items:
- [ ] Starts sealed with correct state
- [ ] Opening methods work correctly
- [ ] Contents spawn with correct yield
- [ ] Spilled items become contaminated
- [ ] Resealing works (plastic only)
- [ ] Contents display inline with Actions buttons

### Weapon Items:
- [ ] Item spawns in world (loot tables or crafting)
- [ ] Can be equipped in hand slot(s)
- [ ] `baseDamage` dice string rolls correctly
- [ ] `weaponStats.attackType` matches intended type (sharp/blunt/unarmed)
- [ ] Weapon-specific targeting profile feels right (check `WEAPON_TARGETING` weights)
- [ ] Bleed chance creates wounds at expected rate (sharp only)
- [ ] Two-handed grip works if `canTwoHand: true` (bonus damage, action cost)
- [ ] Damage feels balanced vs NPC anatomy part HP values
- [ ] Combat log verbs match attack type (sharp/blunt/unarmed verb pools)
- [ ] Armor mitigation interacts correctly with weapon damage range

### Wearable Items:
- [ ] Item spawns in world
- [ ] Equips to correct slot
- [ ] Defense bonus applies
- [ ] Pockets function correctly (if present)
- [ ] Unequipping works properly
