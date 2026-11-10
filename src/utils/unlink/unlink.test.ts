import { describe, expect, test } from 'vitest';

import { unlink } from './main';

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
