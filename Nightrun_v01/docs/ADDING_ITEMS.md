# How to Add a New Item

Step-by-step checklist for adding any new item to Fractured City. The Spiked Club was used as the reference implementation.

---

## 1. Define the Item — `src/content/ContentManager.js`

Add the item to `this.itemFamilies` inside `loadItemFamilies()`.

**Required fields:**
- `name`, `type` (`'weapon'`, `'armor'`, `'tool'`, `'consumable'`, etc.)
- `glyph`, `slots`, `tags`, `weight`, `volume`

**If it's a weapon**, add `weaponStats`:
```js
weaponStats: {
    damage: '1d10',        // dice notation
    actionCost: 140,       // AP per attack
    attackType: 'blunt',   // 'blunt', 'sharp', or 'unarmed'
    accuracy: -8,          // hit chance modifier
    critBonus: 0,          // crit chance modifier
    staggerChance: 0.25,   // blunt weapons only
    bleedChance: 0.20,     // chance to cause bleeding
    parryBonus: 0.12,      // sharp weapons only — defensive parry chance
    canTwoHand: true,
    twoHandDamage: '1d10+1d6',
    twoHandActionCost: 160
}
```

**If it's craftable**, add:
- `components` — specific component items consumed (id, name, quantity, quality, maxQuality, weight, volume)
- `componentRequirements` — property-based requirements (property, minValue, quantity, name)
- `craftTime` — turns to craft
- `disassemblyMethods` — how it can be taken apart (hand, knife, etc.)

**Example (Spiked Club):**
```js
spiked_club: {
    name: 'Spiked Club',
    type: 'weapon',
    baseDamage: '1d10',
    actionCost: 140,
    glyph: '!',
    slots: ['hand'],
    canTwoHand: true,
    twoHandDamageBonus: '1d6',
    twoHandActionCost: 160,
    tags: ['melee', 'blunt', 'crafted'],
    weight: 600,
    volume: 350,
    components: [
        { id: 'wood_plank', name: 'Wood Plank', quantity: 1, ... },
        { id: 'nail', name: 'Nail', quantity: 3, ... }
    ],
    componentRequirements: [
        { property: 'structural', minValue: 2, quantity: 1, name: 'Sturdy Wood' },
        { property: 'piercing', minValue: 1, quantity: 3, name: 'Nails' },
        { property: 'hammering', minValue: 1, quantity: 1, name: 'Hammering Tool' }
    ],
    craftTime: 3,
    disassemblyMethods: { ... },
    weaponStats: { ... }
}
```

---

## 2. New Components (if needed) — `src/content/ContentManager.js`

Add to `this.components` inside `loadComponents()`.

Each component needs: `name`, `type: 'component'`, `isComponent: true`, `weight`, `volume`, `tags`, `stackable`, and `properties` (the key-value pairs the crafting system checks).

---

## 3. New Properties (if needed) — `src/content/ContentManager.js`

If the recipe uses a property that doesn't exist yet:

1. Add it to `PROPERTY_LABELS` at the top of the file with tier labels:
   ```js
   hammering: { 1: 'Makeshift Hammer', 2: 'Heavy Hammer' }
   ```
2. Add the property to any existing components that should have it (e.g. `wood_piece`, `stone`).

---

## 4. Loot Tables — `src/content/LootTables.js`

If new components need to spawn in the world, add them to appropriate room loot pools:
```js
{ componentId: 'wood_plank', weight: 6 }
```

---

## 5. Furniture/Door Drop Tables — Two places

### a. Drop table definitions — `src/world/objects/Furniture.js` or `Door.js`
These use **display names** in their `dropTable.materials` arrays:
```js
{ name: 'Wood Plank', quantity: [2, 3], quality: [60, 90] }
```

### b. Name-to-ID mapping — `src/systems/WorldObjectSystem.js`
The `DROP_NAME_TO_COMPONENT` map in `dropMaterials()` translates display names to component IDs:
```js
'Wood Plank': 'wood_plank',
```
**Every display name used in a drop table MUST have an entry here**, or it falls back to a generic item without properties.

---

## 6. NPC Weapon Tables (if applicable) — `src/entities/NPC.js`

Add to appropriate NPC type `weaponTable` arrays:
```js
{ weight: 30, weapon: {
    name: 'Spiked Club',
    type: 'weapon',
    baseDamage: '1d10',
    weaponStats: { attackType: 'blunt', bleedChance: 0.20, staggerChance: 0.25, accuracy: -8 }
}}
```

---

## 7. Abilities — `src/systems/AbilitySystem.js`

Abilities are tied to `weaponType` (`'blunt'`, `'sharp'`, `'unarmed'`), **not** individual items. If your new weapon uses an existing attackType, it automatically gets all abilities for that type.

Only add new ability definitions if you're creating a unique combat move.

---

## 8. Starting Gear (optional) — `src/core/Game.js`

To give the item as starting gear for a background, update `LOADOUTS` in `giveStartingLoadout()`:
```js
raiderDefector: {
    equip: { rightHand: 'knife' },
    inventory: ['pipe'],
}
```

Also update `GEAR_LABELS` in `src/ui/UIManager.js` for the character creation screen.

---

## 9. Bump Cache — `sw.js`

Increment the version number:
```js
const CACHE_NAME = 'fractured-city-vXX';
```

---

## Quick Checklist

- [ ] Item definition in `ContentManager.js` → `itemFamilies`
- [ ] New components in `ContentManager.js` → `components` (if needed)
- [ ] New properties in `PROPERTY_LABELS` + added to existing components (if needed)
- [ ] Loot table entries in `LootTables.js` (if components should spawn)
- [ ] Furniture/door drop table names in `Furniture.js` / `Door.js` (if from destruction)
- [ ] `DROP_NAME_TO_COMPONENT` mapping in `WorldObjectSystem.js` (if new drop names)
- [ ] NPC weapon tables in `NPC.js` (if NPCs should carry it)
- [ ] Abilities: automatic if using existing `weaponType`; new entry in `AbilitySystem.js` if unique
- [ ] Starting gear in `Game.js` + UI label in `UIManager.js` (if background gear)
- [ ] Cache bump in `sw.js`
