import { ITEMS, item } from '../content/defs';
import type { Inventory, Stack } from './types';

export const INV_SLOTS = 15;
export const PACK_SLOTS = 8;

export function newInventory(): Inventory {
  return { slots: Array(INV_SLOTS).fill(null), equip: { hand: null, body: null, head: null }, pack: null, cursor: null };
}

export function makeStack(id: string, n = 1): Stack {
  const d = item(id);
  const s: Stack = { id, n };
  if (d.perish) s.fresh = 1;
  if (d.uses || d.time || d.armor) s.dur = 1;
  if (d.tags?.includes('heatrock')) s.temp = 25;
  return s;
}

export function maxStack(id: string): number {
  return ITEMS.get(id)?.stack ?? 1;
}

/** All slot arrays of an inventory, main first then backpack. */
export function allSlots(inv: Inventory): (Stack | null)[][] {
  return inv.pack ? [inv.slots, inv.pack] : [inv.slots];
}

/** Merge `s` into slot arrays. Returns leftover count (0 if fully stored). Mutates s.n. */
export function addToSlots(slots: (Stack | null)[], s: Stack): number {
  const max = maxStack(s.id);
  if (max > 1) {
    for (const t of slots) {
      if (!t || t.id !== s.id || t.n >= max) continue;
      const moved = Math.min(max - t.n, s.n);
      if (s.fresh !== undefined && t.fresh !== undefined) t.fresh = (t.fresh * t.n + s.fresh * moved) / (t.n + moved);
      t.n += moved;
      s.n -= moved;
      if (s.n <= 0) return 0;
    }
  }
  for (let i = 0; i < slots.length; i++) {
    if (slots[i]) continue;
    const moved = Math.min(max, s.n);
    slots[i] = { ...s, n: moved };
    s.n -= moved;
    if (s.n <= 0) return 0;
  }
  return s.n;
}

export function giveItem(inv: Inventory, s: Stack): number {
  let left = addToSlots(inv.slots, s);
  if (left > 0 && inv.pack) left = addToSlots(inv.pack, s);
  return left;
}

export function countItem(inv: Inventory, id: string): number {
  let n = 0;
  for (const arr of allSlots(inv)) for (const s of arr) if (s && s.id === id) n += s.n;
  return n;
}

export function hasItems(inv: Inventory, ingredients: [string, number][]): boolean {
  return ingredients.every(([id, n]) => countItem(inv, id) >= n);
}

/** Remove n of item id; takes from least-fresh stacks first. Returns removed count. */
export function takeItem(inv: Inventory, id: string, n: number): number {
  let need = n;
  const refs: { arr: (Stack | null)[]; i: number }[] = [];
  for (const arr of allSlots(inv)) arr.forEach((s, i) => s && s.id === id && refs.push({ arr, i }));
  refs.sort((a, b) => (a.arr[a.i]!.fresh ?? 1) - (b.arr[b.i]!.fresh ?? 1));
  for (const { arr, i } of refs) {
    const s = arr[i]!;
    const take = Math.min(s.n, need);
    s.n -= take;
    need -= take;
    if (s.n <= 0) arr[i] = null;
    if (need <= 0) break;
  }
  return n - need;
}

export function isFull(inv: Inventory, id: string): boolean {
  const max = maxStack(id);
  for (const arr of allSlots(inv))
    for (const s of arr) if (!s || (s.id === id && s.n < max)) return false;
  return true;
}
