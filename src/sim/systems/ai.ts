import { prefab } from '../../content/defs';
import type { System } from '../game';
import { BRAINS } from '../brains/brains';
import { isDead, setState, updateAttack } from '../combat';
import { updatePlayer, handleCommand } from '../player';

/** Brains tick at 10 Hz for awake entities. Actor states (attack hits, timers) tick every frame. */
export const aiSystem: System = {
  name: 'ai',
  interval: 0.1,
  update(g) {
    for (const e of g.world.query('brain')) {
      if (isDead(e) || !g.inAwakeRange(e)) continue;
      const s = e.state?.name;
      if (s === 'hit' || s === 'attack' || s === 'eat') continue;
      if (s === 'sleep' && e.prefab !== 'shagbeast') continue;
      const tree = BRAINS[e.brain!.id];
      if (tree) tree({ g, e, def: prefab(e.prefab), bb: e.brain!.bb });
    }
  },
};

export const actorSystem: System = {
  name: 'actors',
  update(g, dt) {
    // commands first (they only ever target the local player in single-player)
    const p = g.player;
    const cmds = g.commands;
    g.commands = [];
    for (const c of cmds) handleCommand(g, p, c);
    updatePlayer(g, p, dt);
    for (const e of g.world.query('state')) {
      const s = e.state!;
      if (s.name === 'attack') {
        updateAttack(g, e);
        if (s.until !== undefined && g.time >= s.until) setState(g, e, 'idle');
      } else if ((s.name === 'hit' || s.name === 'eat' || (s.name === 'work' && !e.player)) && s.until !== undefined && g.time >= s.until) {
        if (!e.player) setState(g, e, 'idle');
      }
    }
  },
};
