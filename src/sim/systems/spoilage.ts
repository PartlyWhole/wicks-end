import { ITEMS, hasTag, prefab } from '../../content/defs';
import { T } from '../../content/tuning';
import type { System } from '../game';
import type { Stack } from '../types';
import { allSlots } from '../inventory';
import { removeEntity } from '../spawn';
import { updateEquipLight } from '../player';

function perish(s: Stack, dt: number, mult: number): boolean {
  if (s.fresh === undefined) return false;
  const def = ITEMS.get(s.id);
  if (!def?.perish) return false;
  s.fresh -= (dt / def.perish) * mult;
  return s.fresh <= 0;
}

type Packed = Stack & { contents?: (Stack | null)[] };

/** Spoil the contents of a backpack stack that isn't currently worn. */
function perishContents(s: Stack | null | undefined, dt: number, mult: number, worn: (Stack | null)[] | null): void {
  const c = (s as Packed | null | undefined)?.contents;
  if (!c || c === worn) return;
  for (let i = 0; i < c.length; i++) if (c[i] && perish(c[i]!, dt, mult)) rotSlot(c, i);
}

function rotSlot(arr: (Stack | null)[], i: number): void {
  const s = arr[i]!;
  const to = ITEMS.get(s.id)?.spoilsTo ?? 'rot';
  if (ITEMS.get(s.id)?.equip) arr[i] = null;
  else arr[i] = { id: to, n: s.n };
}

/** Spoilage of food, wear of timed equipment, and thermal stone temperature. 1 Hz. */
export const spoilageSystem: System = {
  name: 'spoilage',
  interval: 1,
  update(g, dt) {
    const season = g.clock.season;
    const smult = season === 'winter' ? T.PERISH_WINTER : season === 'summer' ? T.PERISH_SUMMER : 1;
    const p = g.player;
    let changed = false;
    if (p.inventory) {
      const inv = p.inventory;
      for (const arr of allSlots(inv))
        for (let i = 0; i < arr.length; i++) {
          const s = arr[i];
          if (s && perish(s, dt, smult)) {
            rotSlot(arr, i);
            changed = true;
          }
        }
      for (const s of inv.slots) perishContents(s, dt, smult, inv.pack);
      perishContents(inv.cursor, dt, smult, inv.pack);
      if (inv.cursor && perish(inv.cursor, dt, smult)) {
        inv.cursor = { id: 'rot', n: inv.cursor.n };
        changed = true;
      }
      // equipment
      for (const slot of ['hand', 'body', 'head'] as const) {
        const s = inv.equip[slot];
        if (!s) continue;
        const def = ITEMS.get(s.id)!;
        let gone = false;
        if (def.perish && perish(s, dt, smult)) gone = true;
        if (def.time && s.dur !== undefined) {
          const rainMult = s.id === 'torch' ? 1 + g.weather.precip * 0.5 : 1;
          s.dur -= (dt / def.time) * rainMult;
          if (s.dur <= 0) gone = true;
        }
        if (gone) {
          inv.equip[slot] = null;
          if (slot === 'body' && s.id === 'backpack') inv.pack = null;
          g.say(p, s.id === 'torch' ? 'My torch burned out.' : `My ${def.name.toLowerCase()} fell apart.`, true);
          if (slot === 'hand') updateEquipLight(g, p);
          changed = true;
        }
      }
      // thermal stone drifts toward the temperature around the player
      for (const arr of allSlots(inv))
        for (const s of arr) {
          if (s?.temp === undefined) continue;
          const env = p.temperature!.cur;
          s.temp += Math.sign(env - s.temp) * Math.min(Math.abs(env - s.temp), 0.25 * dt);
        }
    }
    // containers
    for (const e of g.world.query('container')) {
      const mult = hasTag(prefab(e.prefab), 'fridge') ? T.PERISH_ICEBOX : 1;
      const slots = e.container!.slots;
      for (let i = 0; i < slots.length; i++) {
        perishContents(slots[i], dt, smult * mult, null);
        if (slots[i] && perish(slots[i]!, dt, smult * mult)) rotSlot(slots, i);
      }
      // backpack contents stay with the stack; handled when equipped
    }
    // ground items
    for (const e of g.world.query('item')) {
      const s = e.item!;
      perishContents(s, dt, smult * T.PERISH_GROUND, null);
      if (s.fresh === undefined) continue;
      if (perish(s, dt, smult * T.PERISH_GROUND)) {
        const to = ITEMS.get(s.id)?.spoilsTo ?? 'rot';
        if (ITEMS.get(s.id)?.equip) removeEntity(g, e);
        else e.item = { id: to, n: s.n };
      }
    }
    if (changed) g.events.emit('inv', {});
  },
};
