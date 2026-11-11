import { describe, expect, test } from 'vitest';

import { appendNode, buildLinkMethods, prependNode, unlink } from './main';

/**
 * A node that sits in two independent lists at once, the same shape as `Connector`: one chain via
 * `prevA`/`nextA` owned by `OwnerA`, another via `prevB`/`nextB` owned by `OwnerB`.
 */
interface Node {
  id: string;
  prevA?: Node;
  nextA?: Node;
  prevB?: Node;
  nextB?: Node;
}

interface OwnerA {
  aHead?: Node;
  aTail?: Node;
}

interface OwnerB {
  bHead?: Node;
  bTail?: Node;
}

/** Owner using the bare lowercase `head` / `tail` names, which `EndpointKey` also accepts. */
interface PlainOwner {
  head?: Node;
  tail?: Node;
}

function node(id: string): Node {
  return { id };
}

/** Link `nodes` into list A of `owner`, in order. */
function linkA(owner: OwnerA, nodes: Node[]): void {
  nodes.forEach((current, i) => {
    current.prevA = nodes[i - 1];
    current.nextA = nodes[i + 1];
  });
  owner.aHead = nodes[0];
  owner.aTail = nodes[nodes.length - 1];
}

function linkB(owner: OwnerB, nodes: Node[]): void {
  nodes.forEach((current, i) => {
    current.prevB = nodes[i - 1];
    current.nextB = nodes[i + 1];
  });
  owner.bHead = nodes[0];
  owner.bTail = nodes[nodes.length - 1];
}

function unlinkA(target: Node, owner: OwnerA): void {
  unlink(target, owner, 'prevA', 'nextA', 'aHead', 'aTail');
}

/**
 * Check list A against its expected contents from both ends, plus the endpoints, so a fix that
 * repairs `nextA` while leaving `prevA` stale cannot pass on a one-sided assertion.
 */
function expectListA(owner: OwnerA, expected: Node[]): void {
  const forwards: string[] = [];
  for (let current = owner.aHead; current; current = current.nextA) forwards.push(current.id);

  const backwards: string[] = [];
  for (let current = owner.aTail; current; current = current.prevA) backwards.push(current.id);

  const ids = expected.map((n) => n.id);
  expect(forwards).toEqual(ids);
  expect(backwards).toEqual([...ids].reverse());

  expect(owner.aHead).toBe(expected[0]);
  expect(owner.aTail).toBe(expected[expected.length - 1]);
  if (expected.length > 0) {
    expect(owner.aHead!.prevA).toBeUndefined();
    expect(owner.aTail!.nextA).toBeUndefined();
  }
}

function expectDetachedA(target: Node): void {
  expect(target.prevA).toBeUndefined();
  expect(target.nextA).toBeUndefined();
}

describe('unlink', () => {
  describe('position in the list', () => {
    test('only node: owner becomes empty', () => {
      const owner: OwnerA = {};
      const a = node('a');
      linkA(owner, [a]);

      unlinkA(a, owner);

      expectListA(owner, []);
      expectDetachedA(a);
    });

    test('head node: next node becomes the head', () => {
      const owner: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(owner, [a, b, c]);

      unlinkA(a, owner);

      expectListA(owner, [b, c]);
      expectDetachedA(a);
    });

    test('tail node: previous node becomes the tail', () => {
      const owner: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(owner, [a, b, c]);

      unlinkA(c, owner);

      expectListA(owner, [a, b]);
      expectDetachedA(c);
    });

    test('middle node: neighbours are joined, endpoints untouched', () => {
      const owner: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(owner, [a, b, c]);

      unlinkA(b, owner);

      expectListA(owner, [a, c]);
      expectDetachedA(b);
    });

    test('two-node list: removing either leaves a single-node list', () => {
      const ownerX: OwnerA = {};
      const [a1, b1] = [node('a'), node('b')];
      linkA(ownerX, [a1, b1]);
      unlinkA(a1, ownerX);
      expectListA(ownerX, [b1]);

      const ownerY: OwnerA = {};
      const [a2, b2] = [node('a'), node('b')];
      linkA(ownerY, [a2, b2]);
      unlinkA(b2, ownerY);
      expectListA(ownerY, [a2]);
    });
  });

  describe('sequences', () => {
    test('removing every node head-first empties the list', () => {
      const owner: OwnerA = {};
      const nodes = ['a', 'b', 'c', 'd'].map(node);
      linkA(owner, nodes);

      for (let i = 0; i < nodes.length; i++) {
        unlinkA(nodes[i]!, owner);
        expectListA(owner, nodes.slice(i + 1));
      }
    });

    test('removing every node tail-first empties the list', () => {
      const owner: OwnerA = {};
      const nodes = ['a', 'b', 'c', 'd'].map(node);
      linkA(owner, nodes);

      for (let i = nodes.length - 1; i >= 0; i--) {
        unlinkA(nodes[i]!, owner);
        expectListA(owner, nodes.slice(0, i));
      }
    });

    test('removing in mixed order keeps the list consistent', () => {
      const owner: OwnerA = {};
      const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map(node) as [Node, Node, Node, Node, Node];
      linkA(owner, [a, b, c, d, e]);

      unlinkA(c, owner);
      expectListA(owner, [a, b, d, e]);

      unlinkA(a, owner);
      expectListA(owner, [b, d, e]);

      unlinkA(e, owner);
      expectListA(owner, [b, d]);

      unlinkA(d, owner);
      expectListA(owner, [b]);

      unlinkA(b, owner);
      expectListA(owner, []);
    });

    test('unlinking an already detached node is a no-op', () => {
      const owner: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(owner, [a, b, c]);

      unlinkA(b, owner);
      unlinkA(b, owner);

      expectListA(owner, [a, c]);
      expectDetachedA(b);
    });

    test('a detached node can be re-linked and unlinked again', () => {
      const owner: OwnerA = {};
      const [a, b] = [node('a'), node('b')];
      linkA(owner, [a, b]);

      unlinkA(a, owner);
      linkA(owner, [b, a]);
      expectListA(owner, [b, a]);

      unlinkA(a, owner);
      expectListA(owner, [b]);
      expectDetachedA(a);
    });
  });

  describe('independent link sets', () => {
    test('unlinking from list A leaves list B on the same nodes untouched', () => {
      const ownerA: OwnerA = {};
      const ownerB: OwnerB = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(ownerA, [a, b, c]);
      linkB(ownerB, [c, b, a]);

      unlinkA(b, ownerA);

      expectListA(ownerA, [a, c]);
      expect(ownerB.bHead).toBe(c);
      expect(ownerB.bTail).toBe(a);
      expect(c.nextB).toBe(b);
      expect(b.prevB).toBe(c);
      expect(b.nextB).toBe(a);
      expect(a.prevB).toBe(b);
    });

    test('a node can be unlinked from both lists independently', () => {
      const ownerA: OwnerA = {};
      const ownerB: OwnerB = {};
      const [a, b] = [node('a'), node('b')];
      linkA(ownerA, [a, b]);
      linkB(ownerB, [a, b]);

      unlinkA(a, ownerA);
      unlink(a, ownerB, 'prevB', 'nextB', 'bHead', 'bTail');

      expectListA(ownerA, [b]);
      expect(ownerB.bHead).toBe(b);
      expect(ownerB.bTail).toBe(b);
      expect(b.prevB).toBeUndefined();
      expect(a.prevB).toBeUndefined();
      expect(a.nextB).toBeUndefined();
    });
  });

  test('owner with bare `head` / `tail` keys', () => {
    const owner: PlainOwner = {};
    const [a, b, c] = [node('a'), node('b'), node('c')];
    [a, b, c].forEach((current, i, all) => {
      current.prevA = all[i - 1];
      current.nextA = all[i + 1];
    });
    owner.head = a;
    owner.tail = c;

    unlink(a, owner, 'prevA', 'nextA', 'head', 'tail');
    expect(owner.head).toBe(b);
    expect(b.prevA).toBeUndefined();

    unlink(c, owner, 'prevA', 'nextA', 'head', 'tail');
    expect(owner.tail).toBe(b);
    expect(b.nextA).toBeUndefined();
  });

  /**
   * Compile-time contract. These calls never run (the function is not invoked); `tsc` fails on an
   * unused `@ts-expect-error`, so each line proves the key constraints still reject bad input.
   */
  test('key constraints (type-level)', () => {
    const typeChecks = (n: Node, o: OwnerA, b: OwnerB) => {
      // valid
      unlink(n, o, 'prevA', 'nextA', 'aHead', 'aTail');
      unlink(n, b, 'prevB', 'nextB', 'bHead', 'bTail');

      // @ts-expect-error prev key must start with `prev`
      unlink(n, o, 'nextA', 'nextA', 'aHead', 'aTail');
      // @ts-expect-error next key must start with `next`
      unlink(n, o, 'prevA', 'prevA', 'aHead', 'aTail');
      // @ts-expect-error prev key must point at the node type, not a string
      unlink(n, o, 'id', 'nextA', 'aHead', 'aTail');
      // @ts-expect-error unknown prev key
      unlink(n, o, 'prevZ', 'nextA', 'aHead', 'aTail');
      // @ts-expect-error head key must end with `Head`
      unlink(n, o, 'prevA', 'nextA', 'aTail', 'aTail');
      // @ts-expect-error tail key must end with `Tail`
      unlink(n, o, 'prevA', 'nextA', 'aHead', 'aHead');
      // @ts-expect-error tail key must exist on the owner
      unlink(n, o, 'prevA', 'nextA', 'aHead', 'oops');
      // @ts-expect-error endpoint keys belong to a different owner
      unlink(n, o, 'prevA', 'nextA', 'bHead', 'bTail');
    };

    expect(typeof typeChecks).toBe('function');
  });
});


type TAddFn = (target: Node, owner: OwnerA) => void;

const ALREADY_LINKED = /already linked/;

function appendA(target: Node, owner: OwnerA): void {
  appendNode(target, owner, 'prevA', 'nextA', 'aHead', 'aTail');
}

function prependA(target: Node, owner: OwnerA): void {
  prependNode(target, owner, 'prevA', 'nextA', 'aHead', 'aTail');
}

const ADDERS: [string, TAddFn][] = [
  ['appendNode', appendA],
  ['prependNode', prependA],
];

describe('appendNode', () => {
  test('into an empty list: node becomes both head and tail', () => {
    const owner: OwnerA = {};
    const a = node('a');

    appendA(a, owner);

    expectListA(owner, [a]);
  });

  test('into a non-empty list: node becomes the new tail', () => {
    const owner: OwnerA = {};
    const [a, b, c] = [node('a'), node('b'), node('c')];
    linkA(owner, [a, b]);

    appendA(c, owner);

    expectListA(owner, [a, b, c]);
  });

  test('repeated appends keep insertion order', () => {
    const owner: OwnerA = {};
    const nodes = ['a', 'b', 'c', 'd'].map(node);

    for (let i = 0; i < nodes.length; i++) {
      appendA(nodes[i]!, owner);
      expectListA(owner, nodes.slice(0, i + 1));
    }
  });
});

describe('prependNode', () => {
  test('into an empty list: node becomes both head and tail', () => {
    const owner: OwnerA = {};
    const a = node('a');

    prependA(a, owner);

    expectListA(owner, [a]);
  });

  test('into a non-empty list: node becomes the new head', () => {
    const owner: OwnerA = {};
    const [a, b, c] = [node('a'), node('b'), node('c')];
    linkA(owner, [b, c]);

    prependA(a, owner);

    expectListA(owner, [a, b, c]);
  });

  test('repeated prepends reverse insertion order', () => {
    const owner: OwnerA = {};
    const nodes = ['a', 'b', 'c', 'd'].map(node);

    for (let i = 0; i < nodes.length; i++) {
      prependA(nodes[i]!, owner);
      expectListA(owner, nodes.slice(0, i + 1).reverse());
    }
  });

  test('does not write endpoint keys onto the node', () => {
    const owner: OwnerA = {};
    const [a, b] = [node('a'), node('b')];
    appendA(a, owner);

    prependA(b, owner);

    expect(b).not.toHaveProperty('aHead');
    expect(b).not.toHaveProperty('aTail');
  });
});

describe('appendNode / prependNode', () => {
  test('mixed append and prepend keep the list consistent', () => {
    const owner: OwnerA = {};
    const [a, b, c, d, e] = ['a', 'b', 'c', 'd', 'e'].map(node) as [Node, Node, Node, Node, Node];

    appendA(c, owner);
    expectListA(owner, [c]);

    prependA(b, owner);
    expectListA(owner, [b, c]);

    appendA(d, owner);
    expectListA(owner, [b, c, d]);

    prependA(a, owner);
    expectListA(owner, [a, b, c, d]);

    appendA(e, owner);
    expectListA(owner, [a, b, c, d, e]);
  });

  describe('already linked nodes are rejected', () => {
    test.each(ADDERS)('%s: head of a multi-node list', (_, add) => {
      const owner: OwnerA = {};
      const [a, b] = [node('a'), node('b')];
      linkA(owner, [a, b]);

      expect(() => add(a, owner)).toThrow(ALREADY_LINKED);
      expectListA(owner, [a, b]);
    });

    test.each(ADDERS)('%s: tail of a multi-node list', (_, add) => {
      const owner: OwnerA = {};
      const [a, b] = [node('a'), node('b')];
      linkA(owner, [a, b]);

      expect(() => add(b, owner)).toThrow(ALREADY_LINKED);
      expectListA(owner, [a, b]);
    });

    test.each(ADDERS)('%s: middle node', (_, add) => {
      const owner: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(owner, [a, b, c]);

      expect(() => add(b, owner)).toThrow(ALREADY_LINKED);
      expectListA(owner, [a, b, c]);
    });

    test.each(ADDERS)('%s: only node of the same owner (no self-loop)', (_, add) => {
      const owner: OwnerA = {};
      const a = node('a');
      appendA(a, owner);

      expect(() => add(a, owner)).toThrow(ALREADY_LINKED);
      expectListA(owner, [a]);
      expectDetachedA(a);
    });

    test('error message names the function that threw', () => {
      const owner: OwnerA = {};
      const a = node('a');
      appendA(a, owner);

      expect(() => appendA(a, owner)).toThrow('[appendNode]');
      expect(() => prependA(a, owner)).toThrow('[prependNode]');
    });

    test('node linked into another owner of the same chain is rejected', () => {
      const ownerX: OwnerA = {};
      const ownerY: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(ownerX, [a, b]);
      linkA(ownerY, [c]);

      expect(() => appendA(a, ownerY)).toThrow(ALREADY_LINKED);
      expectListA(ownerX, [a, b]);
      expectListA(ownerY, [c]);
    });
  });

  describe('interaction with unlink', () => {
    test('an unlinked node can be added again', () => {
      const owner: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      linkA(owner, [a, b, c]);

      unlinkA(b, owner);
      appendA(b, owner);
      expectListA(owner, [a, c, b]);

      unlinkA(a, owner);
      prependA(a, owner);
      expectListA(owner, [a, c, b]);
    });

    test('building with append/prepend then draining with unlink empties the list', () => {
      const owner: OwnerA = {};
      const [a, b, c] = [node('a'), node('b'), node('c')];
      appendA(b, owner);
      prependA(a, owner);
      appendA(c, owner);

      unlinkA(b, owner);
      expectListA(owner, [a, c]);
      unlinkA(a, owner);
      expectListA(owner, [c]);
      unlinkA(c, owner);
      expectListA(owner, []);

      appendA(a, owner);
      expectListA(owner, [a]);
    });
  });

  test('a node can sit in list A and list B at the same time', () => {
    const ownerA: OwnerA = {};
    const ownerB: OwnerB = {};
    const [a, b] = [node('a'), node('b')];

    appendA(a, ownerA);
    appendA(b, ownerA);
    appendNode(b, ownerB, 'prevB', 'nextB', 'bHead', 'bTail');
    prependNode(a, ownerB, 'prevB', 'nextB', 'bHead', 'bTail');

    expectListA(ownerA, [a, b]);
    expect(ownerB.bHead).toBe(a);
    expect(ownerB.bTail).toBe(b);
    expect(a.nextB).toBe(b);
    expect(b.prevB).toBe(a);
    expect(a.prevB).toBeUndefined();
    expect(b.nextB).toBeUndefined();
  });

  test('owner with bare `head` / `tail` keys', () => {
    const owner: PlainOwner = {};
    const [a, b, c] = [node('a'), node('b'), node('c')];

    appendNode(b, owner, 'prevA', 'nextA', 'head', 'tail');
    appendNode(c, owner, 'prevA', 'nextA', 'head', 'tail');
    prependNode(a, owner, 'prevA', 'nextA', 'head', 'tail');

    expect(owner.head).toBe(a);
    expect(owner.tail).toBe(c);
    expect(a.nextA).toBe(b);
    expect(b.nextA).toBe(c);
    expect(c.prevA).toBe(b);
    expect(b.prevA).toBe(a);
  });

  test('key constraints (type-level)', () => {
    const typeChecks = (n: Node, o: OwnerA) => {
      // valid
      appendNode(n, o, 'prevA', 'nextA', 'aHead', 'aTail');
      prependNode(n, o, 'prevA', 'nextA', 'aHead', 'aTail');

      // @ts-expect-error prev key must start with `prev`
      appendNode(n, o, 'nextA', 'nextA', 'aHead', 'aTail');
      // @ts-expect-error head key must end with `Head`
      prependNode(n, o, 'prevA', 'nextA', 'aTail', 'aTail');
      // @ts-expect-error endpoint keys belong to a different owner
      appendNode(n, o, 'prevA', 'nextA', 'bHead', 'bTail');
    };

    expect(typeof typeChecks).toBe('function');
  });
});

describe('buildLinkMethods', () => {
  /** Owner holding two lists of different node types, to prove `X` is derived from the head key. */
  interface Item {
    value: number;
    prevItem?: Item;
    nextItem?: Item;
  }

  interface MixedOwner {
    aHead?: Node;
    aTail?: Node;
    itemHead?: Item;
    itemTail?: Item;
    count: number;
  }

  const listA = buildLinkMethods<OwnerA>()('aHead', 'aTail', 'prevA', 'nextA');

  test('append / prepend / remove drive the bound list', () => {
    const owner: OwnerA = {};
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(node) as [Node, Node, Node, Node];

    listA.append(b, owner);
    listA.append(c, owner);
    listA.prepend(a, owner);
    listA.append(d, owner);
    expectListA(owner, [a, b, c, d]);

    listA.remove(b, owner);
    expectListA(owner, [a, c, d]);
    expectDetachedA(b);

    listA.remove(a, owner);
    listA.remove(d, owner);
    expectListA(owner, [c]);

    listA.remove(c, owner);
    expectListA(owner, []);
  });

  test('one set of methods is shared across owners', () => {
    const ownerX: OwnerA = {};
    const ownerY: OwnerA = {};
    const [a, b, c] = [node('a'), node('b'), node('c')];

    listA.append(a, ownerX);
    listA.append(b, ownerY);
    listA.prepend(c, ownerY);

    expectListA(ownerX, [a]);
    expectListA(ownerY, [c, b]);
  });

  test('behaves the same as the underlying functions', () => {
    const owner: OwnerA = {};
    const [a, b] = [node('a'), node('b')];
    listA.append(a, owner);

    expect(() => listA.append(a, owner)).toThrow('[appendNode]');
    expect(() => listA.prepend(a, owner)).toThrow('[prependNode]');

    listA.remove(a, owner);
    listA.remove(a, owner); // already detached: no-op
    expectListA(owner, []);

    listA.append(b, owner);
    expectListA(owner, [b]);
  });

  test('lists on the same owner stay independent', () => {
    const owner: MixedOwner = { count: 0 };
    const nodes = buildLinkMethods<MixedOwner>()('aHead', 'aTail', 'prevA', 'nextA');
    const items = buildLinkMethods<MixedOwner>()('itemHead', 'itemTail', 'prevItem', 'nextItem');
    const [a, b] = [node('a'), node('b')];
    const [one, two]: Item[] = [{ value: 1 }, { value: 2 }];

    nodes.append(a, owner);
    items.append(one, owner);
    nodes.append(b, owner);
    items.prepend(two, owner);

    expectListA(owner, [a, b]);
    expect(owner.itemHead).toBe(two);
    expect(owner.itemTail).toBe(one);
    expect(two.nextItem).toBe(one);
    expect(one.prevItem).toBe(two);

    items.remove(two, owner);
    expect(owner.itemHead).toBe(one);
    expectListA(owner, [a, b]);
    expect(owner.count).toBe(0);
  });

  test('owner with bare `head` / `tail` keys', () => {
    const owner: PlainOwner = {};
    const methods = buildLinkMethods<PlainOwner>()('head', 'tail', 'prevB', 'nextB');
    const [a, b] = [node('a'), node('b')];

    methods.append(b, owner);
    methods.prepend(a, owner);

    expect(owner.head).toBe(a);
    expect(owner.tail).toBe(b);
    expect(a.nextB).toBe(b);
    expect(b.prevB).toBe(a);
    expect(a.prevA).toBeUndefined();
  });

  /**
   * Compile-time contract: the node type is inferred from the head key, so each method only accepts
   * that node type, and every key must match it. `tsc` fails on an unused `@ts-expect-error`.
   */
  test('node type inference and key constraints (type-level)', () => {
    const typeChecks = (n: Node, item: Item, o: MixedOwner) => {
      const nodes = buildLinkMethods<MixedOwner>()('aHead', 'aTail', 'prevA', 'nextA');
      const items = buildLinkMethods<MixedOwner>()('itemHead', 'itemTail', 'prevItem', 'nextItem');

      // valid
      nodes.append(n, o);
      items.prepend(item, o);

      // @ts-expect-error `nodes` was inferred as a list of `Node`, not `Item`
      nodes.append(item, o);
      // @ts-expect-error `items` was inferred as a list of `Item`, not `Node`
      items.remove(n, o);
      // @ts-expect-error owner must be the bound owner type
      nodes.append(n, {} as OwnerB);

      // @ts-expect-error head key must end with `Head`
      buildLinkMethods<MixedOwner>()('aTail', 'aTail', 'prevA', 'nextA');
      // @ts-expect-error non-node field is not a head key
      buildLinkMethods<MixedOwner>()('count', 'aTail', 'prevA', 'nextA');
      // @ts-expect-error tail key belongs to a different node type than the head key
      buildLinkMethods<MixedOwner>()('aHead', 'itemTail', 'prevA', 'nextA');
      // @ts-expect-error prev key must exist on the inferred node type
      buildLinkMethods<MixedOwner>()('itemHead', 'itemTail', 'prevA', 'nextItem');
      // @ts-expect-error next key must start with `next`
      buildLinkMethods<MixedOwner>()('aHead', 'aTail', 'prevA', 'prevA');
    };

    expect(typeof typeChecks).toBe('function');
  });
});
