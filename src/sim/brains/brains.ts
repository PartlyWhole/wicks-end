import { ITEMS, hasTag, prefab } from '../../content/defs';
import { T } from '../../content/tuning';
import { dist } from '../../engine/math';
import { action, guard, selector, type Node } from '../../engine/bt';
import type { Entity } from '../types';
import { isAlive, isDead, setState } from '../combat';
import { removeEntity, dropStack } from '../spawn';
import { makeStack } from '../inventory';
import {
  type BrainCtx,
  busy,
  currentTarget,
  fight,
  findNear,
  flee,
  goHome,
  home,
  isHostile,
  moveTo,
  setTarget,
  stop,
  wander,
} from './common';

const anchor = (c: BrainCtx): [number, number] => {
  const h = home(c);
  if (h) return [h.x, h.y];
  c.bb.ax ??= c.e.x;
  c.bb.ay ??= c.e.y;
  return [c.bb.ax, c.bb.ay];
};

const lateDusk = (c: BrainCtx) => {
  const k = c.g.clock;
  return k.phase === 'night' || (k.phase === 'dusk' && k.tod > (k.segs[0] + k.segs[1] * 0.5) * T.SEG);
};
const isDay = (c: BrainCtx) => c.g.clock.phase === 'day';

const fightTarget = (leash: number): Node<BrainCtx> =>
  action((c) => {
    const t = currentTarget(c, leash);
    return t ? fight(c, t) : 'failure';
  });

const wanderHome = (r: number): Node<BrainCtx> =>
  action((c) => {
    const [x, y] = anchor(c);
    return wander(c, x, y, r);
  });

// ------------------------------------------------------------------ rabbit
const rabbit = selector<BrainCtx>(
  guard((c) => lateDusk(c) && !!home(c), action((c) => goHome(c, true))),
  action((c) => {
    const threat = findNear(c, 5, (o) => !!o.player || isHostile(o) || o.prefab === 'hog');
    const scared = c.bb.fleeUntil > c.g.time ? c.g.world.get(c.bb.fleeFrom) : undefined;
    const t = threat ?? scared;
    if (!t) return 'failure';
    const h = home(c);
    // bolt for the hole if it's closer than the threat
    if (h && dist(c.e.x, c.e.y, h.x, h.y) < 6 && dist(t.x, t.y, h.x, h.y) > 2) return goHome(c, true);
    return flee(c, t, 7);
  }),
  wanderHome(8),
);

// ------------------------------------------------------------------ bird (ambient)
const bird = action<BrainCtx>((c) => {
  const { g, e, bb } = c;
  if (bb.flying) {
    e.y -= 0.35;
    e.x += (bb.fdx ?? 1) * 0.3;
    g.world.moved(e);
    return 'running';
  }
  const threat = findNear(c, 4.5, (o) => !!o.player || isHostile(o));
  if (threat || g.clock.phase === 'night' || g.weather.precip > 0.6) {
    bb.flying = true;
    bb.fdx = e.x > (threat?.x ?? e.x - 1) ? 1 : -1;
    setState(g, e, 'walk');
    g.world.set(e, 'ttl', g.time + 1.8);
    g.sfx('flap', e.x, e.y);
    if (g.rng.chance(0.25)) dropStack(g, makeStack('seeds'), e.x, e.y, 0.3);
    return 'running';
  }
  // hop and peck
  if ((bb.nextHop ?? 0) < g.time) {
    bb.nextHop = g.time + g.rng.range(0.8, 3);
    if (g.rng.chance(0.5)) {
      e.facing = g.rng.chance(0.5) ? 1 : -1;
      moveTo(c, e.x + e.facing * g.rng.range(0.3, 0.9), e.y + g.rng.range(-0.3, 0.3));
    } else setState(g, e, 'work', 0.4);
  }
  return 'running';
});

// ------------------------------------------------------------------ hogfolk
function leaderOf(c: BrainCtx): Entity | undefined {
  const f = c.e.follower;
  if (!f) return undefined;
  const l = c.g.world.get(f.leader);
  if (!isAlive(c.g, l) || c.g.time > f.until) {
    c.g.world.unset(c.e, 'follower');
    if (l?.player) c.g.say(c.e, 'Bye friend.', true);
    return undefined;
  }
  return l;
}

const hog = selector<BrainCtx>(
  fightTarget(20),
  action((c) => {
    const l = leaderOf(c);
    if (!l) return 'failure';
    // defend the leader
    const lt = l.combat?.target ? c.g.world.get(l.combat.target) : undefined;
    if (lt && isAlive(c.g, lt) && lt !== c.e && lt.follower?.leader !== l.id && l.state?.name === 'attack') {
      setTarget(c, lt, 15);
      return 'running';
    }
    const threat = findNear(c, 8, (o) => isHostile(o) && !o.shadow && (o.combat?.target === l.id || o.combat?.target === c.e.id || hasTag(prefab(o.prefab), 'spider')));
    if (threat) {
      setTarget(c, threat, 15);
      return 'running';
    }
    // help chop: if leader is chopping a tree, chop it too
    const d = dist(c.e.x, c.e.y, l.x, l.y);
    if (d > 4) moveTo(c, l.x + c.g.rng.range(-1.5, 1.5), l.y + c.g.rng.range(-1.5, 1.5), d > 8);
    else if (!c.e.locomotor!.dest) stop(c);
    return 'running';
  }),
  guard(lateDusk, action((c) => goHome(c, true))),
  action((c) => {
    const spider = findNear(c, 8, (o) => hasTag(prefab(o.prefab), 'spider') || (isHostile(o) && o.prefab !== 'frog' && !o.shadow));
    if (!spider) return 'failure';
    setTarget(c, spider, 15);
    return 'running';
  }),
  action((c) => {
    // eat food lying on the ground
    const food = findNear(c, 6, (o) => !!o.item && !!ITEMS.get(o.item.id)?.food && ITEMS.get(o.item.id)!.food!.type !== 'seeds');
    if (!food) return 'failure';
    if (dist(c.e.x, c.e.y, food.x, food.y) < 1) {
      stop(c);
      if (food.item!.n > 1) food.item!.n--;
      else removeEntity(c.g, food);
      setState(c.g, c.e, 'eat', 0.8);
      c.g.sfx('eat', c.e.x, c.e.y);
      return 'running';
    }
    moveTo(c, food.x, food.y, false);
    return 'running';
  }),
  wanderHome(10),
);

// ------------------------------------------------------------------ shagbeast
const shagbeast = selector<BrainCtx>(
  fightTarget(22),
  action((c) => {
    const { g, e } = c;
    if (g.clock.phase === 'night') {
      if (e.state?.name !== 'sleep' && !busy(c)) {
        stop(c);
        setState(g, e, 'sleep');
      }
      return 'running';
    }
    if (e.state?.name === 'sleep') setState(g, e, 'idle');
    return 'failure';
  }),
  wanderHome(10),
);

// ------------------------------------------------------------------ spider
const spider = selector<BrainCtx>(
  fightTarget(20),
  guard((c) => isDay(c) && !!home(c), action((c) => goHome(c, false))),
  action((c) => {
    const night = !isDay(c);
    const prey = findNear(c, night ? 11 : 4, (o) => (!!o.player && o.state?.name !== 'dead') || o.prefab === 'hog' || o.prefab === 'rabbit');
    if (!prey) return 'failure';
    setTarget(c, prey, 12);
    return 'running';
  }),
  wanderHome(10),
);

// ------------------------------------------------------------------ frog
const frog = selector<BrainCtx>(
  guard((c) => c.g.clock.phase === 'night' && !!home(c), action((c) => goHome(c, false))),
  fightTarget(12),
  action((c) => {
    const p = findNear(c, 5, (o) => !!o.player && o.state?.name !== 'dead');
    if (!p) return 'failure';
    setTarget(c, p, 10);
    return 'running';
  }),
  wanderHome(6),
);

// ------------------------------------------------------------------ hound
const hound = selector<BrainCtx>(
  fightTarget(100),
  action((c) => {
    const p = c.g.player;
    if (c.e.wave && !isDead(p)) {
      setTarget(c, p, 9999);
      return 'running';
    }
    return 'failure';
  }),
  action((c) => wander(c, c.e.x, c.e.y, 10)),
);

// ------------------------------------------------------------------ shadow creatures
const shadow = selector<BrainCtx>(
  fightTarget(40),
  action((c) => {
    const p = c.g.player;
    if (!c.g.player.sanity?.insane || isDead(p)) return 'failure';
    // circle for a while before striking
    if ((c.bb.stalkUntil ??= c.g.time + c.g.rng.range(3, 8)) > c.g.time) {
      const a = c.g.time * 0.4 + c.e.id;
      moveTo(c, p.x + Math.cos(a) * 7, p.y + Math.sin(a) * 7, false);
      return 'running';
    }
    setTarget(c, p, 30);
    return 'running';
  }),
  action((c) => wander(c, c.e.x, c.e.y, 5)),
);

// ------------------------------------------------------------------ Frostmaw (winter giant)
const giant = selector<BrainCtx>(
  action((c) => {
    // anything built right next to it gets flattened, even mid-chase
    const s = findNear(c, 2.8, (o) => hasTag(prefab(o.prefab), 'structure') && !o.item);
    if (!s || busy(c) || c.g.time < c.e.combat!.cooldownUntil) return 'failure';
    c.e.combat!.cooldownUntil = c.g.time + c.e.combat!.period;
    stop(c);
    c.e.facing = s.x > c.e.x ? 1 : -1;
    setState(c.g, c.e, 'attack', 0.9, { target: s.id, hit: false });
    return 'running';
  }),
  fightTarget(35),
  action((c) => {
    // smash structures in its way: it comes for your base
    const s = findNear(c, 3.5, (o) => hasTag(prefab(o.prefab), 'structure') && !o.item);
    if (s) {
      if (!busy(c) && c.g.time >= c.e.combat!.cooldownUntil) {
        c.e.combat!.cooldownUntil = c.g.time + c.e.combat!.period;
        setState(c.g, c.e, 'attack', 0.9, { target: s.id, hit: false, smash: true });
        c.e.facing = s.x > c.e.x ? 1 : -1;
      }
      stop(c);
      return 'running';
    }
    const p = findNear(c, 24, (o) => !!o.player && o.state?.name !== 'dead');
    if (p) {
      setTarget(c, p, 30);
      return 'running';
    }
    const base = findNear(c, 30, (o) => hasTag(prefab(o.prefab), 'structure'));
    if (base) {
      moveTo(c, base.x, base.y, false);
      return 'running';
    }
    return 'failure';
  }),
  action((c) => wander(c, c.e.x, c.e.y, 12)),
);

export const BRAINS: Record<string, Node<BrainCtx>> = { rabbit, bird, hog, shagbeast, spider, frog, hound, shadow, giant };
