/**
 * Commands are the only way the outside world (input, UI, network) changes the simulation.
 */
export type SlotRef =
  | { where: 'inv'; i: number }
  | { where: 'pack'; i: number }
  | { where: 'equip'; slot: 'hand' | 'body' | 'head' }
  | { where: 'container'; id: number; i: number };

export type Command =
  /** continuous movement direction (keyboard); 0,0 = stop */
  | { t: 'move'; dx: number; dy: number }
  /** click in world: primary (left) or alternate (right) action on a target entity or point */
  | { t: 'click'; alt: boolean; target?: number; x: number; y: number; force?: boolean }
  /** space: act on nearest interactable */
  | { t: 'autoAct' }
  /** F: attack nearest hostile */
  | { t: 'autoAttack' }
  | { t: 'craft'; recipe: string }
  | { t: 'place'; x: number; y: number }
  | { t: 'cancelPlace' }
  /** click an inventory/container slot. alt = right click (use), split = shift */
  | { t: 'slot'; ref: SlotRef; alt: boolean; split?: boolean }
  | { t: 'useSlot'; i: number }
  | { t: 'dropCursor'; x: number; y: number }
  | { t: 'returnCursor' }
  | { t: 'closeContainer' }
  | { t: 'cook'; id: number }
  | { t: 'stop' };
