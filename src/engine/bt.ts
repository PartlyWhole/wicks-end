/**
 * Tiny behavior-tree library. Nodes are stateless functions over a context;
 * running state lives in the per-entity blackboard, so trees are shared between entities.
 */
export type Status = 'success' | 'failure' | 'running';

export type Node<C> = (ctx: C) => Status;

/** Tries children in order; returns the first non-failure. */
export const selector =
  <C>(...children: Node<C>[]): Node<C> =>
  (ctx) => {
    for (const c of children) {
      const s = c(ctx);
      if (s !== 'failure') return s;
    }
    return 'failure';
  };

/** Runs children in order; stops at the first non-success. */
export const sequence =
  <C>(...children: Node<C>[]): Node<C> =>
  (ctx) => {
    for (const c of children) {
      const s = c(ctx);
      if (s !== 'success') return s;
    }
    return 'success';
  };

export const condition =
  <C>(pred: (ctx: C) => boolean): Node<C> =>
  (ctx) =>
    pred(ctx) ? 'success' : 'failure';

/** Runs `child` only while `pred` holds. */
export const guard =
  <C>(pred: (ctx: C) => boolean, child: Node<C>): Node<C> =>
  (ctx) =>
    pred(ctx) ? child(ctx) : 'failure';

export const action =
  <C>(fn: (ctx: C) => Status | void): Node<C> =>
  (ctx) =>
    fn(ctx) ?? 'success';

export const invert =
  <C>(child: Node<C>): Node<C> =>
  (ctx) => {
    const s = child(ctx);
    return s === 'success' ? 'failure' : s === 'failure' ? 'success' : s;
  };
