import type { ILinkedNode } from './types';

import { describe, expect, test } from 'vitest';

import { LinkedList } from './main';

function forwards<T>(list: LinkedList<T>): T[] {
  const values: T[] = [];
  for (let node = list.head; node; node = node.next) {
    values.push(node.value);
  }
  return values;
}

function backwards<T>(list: LinkedList<T>): T[] {
  const values: T[] = [];
  for (let node = list.tail; node; node = node.previous) {
    values.push(node.value);
  }
  return values;
}

/**
 * Check the list against its expected contents from every angle at once. Structural tests all go
 * through this, so a half-applied fix -- a `next` chain repaired while `previous` rots, or `size`
 * drifting away from the real length -- cannot slip through on a one-sided assertion.
 */
function expectList<T>(list: LinkedList<T>, expected: T[]): void {
  expect(forwards(list)).toEqual(expected);
  expect(backwards(list)).toEqual([...expected].reverse());
  expect(list.size).toBe(expected.length);

  if (expected.length === 0) {
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    return;
  }

  expect(list.head!.value).toBe(expected[0]);
  expect(list.tail!.value).toBe(expected[expected.length - 1]);
  expect(list.head!.previous).toBeNull();
  expect(list.tail!.next).toBeNull();
}

describe('LinkedList', () => {
  describe('construction and ordering', () => {
    test('a new list is empty', () => {
      expectList(new LinkedList<number>(), []);
    });

    test('append adds to the back', () => {
      const list = new LinkedList<number>();
      list.append(1);
      list.append(2);
      list.append(3);

      expectList(list, [1, 2, 3]);
    });

    test('prepend adds to the front', () => {
      const list = new LinkedList<number>();
      list.prepend(3);
      list.prepend(2);
      list.prepend(1);

      expectList(list, [1, 2, 3]);
    });

    test('append and prepend interleave correctly', () => {
      const list = new LinkedList<number>();
      list.append(2);
      list.prepend(1);
      list.append(3);
      list.prepend(0);

      expectList(list, [0, 1, 2, 3]);
    });

    test('the first node of a list becomes both head and tail', () => {
      const list = new LinkedList<string>();
      const only = list.append('a');

      expect(list.head).toBe(only);
      expect(list.tail).toBe(only);
      expectList(list, ['a']);
    });
  });

  describe('node insertion', () => {
    test('insertBefore on the head moves the head', () => {
      const list = new LinkedList<number>();
      const head = list.append(2);

      const inserted = head.insertBefore(1);

      expect(list.head).toBe(inserted);
      expectList(list, [1, 2]);
    });

    test('insertAfter on the tail moves the tail', () => {
      const list = new LinkedList<number>();
      const tail = list.append(1);

      const inserted = tail.insertAfter(2);

      expect(list.tail).toBe(inserted);
      expectList(list, [1, 2]);
    });

    test('inserting in the middle leaves head and tail untouched', () => {
      const list = new LinkedList<number>();
      const head = list.append(1);
      const middle = list.append(3);
      const tail = list.append(4);

      middle.insertBefore(2);
      middle.insertAfter(35);

      expect(list.head).toBe(head);
      expect(list.tail).toBe(tail);
      expectList(list, [1, 2, 3, 35, 4]);
    });

    test('repeated insertion around the same anchor keeps the list ordered', () => {
      const list = new LinkedList<number>();
      const anchor = list.append(0);

      // Each insertBefore lands immediately in front of the anchor, so the values pile up in the
      // order they were written; each insertAfter lands immediately behind it, so they reverse.
      anchor.insertBefore(-2);
      anchor.insertBefore(-1);
      anchor.insertAfter(2);
      anchor.insertAfter(1);

      expectList(list, [-2, -1, 0, 1, 2]);
    });

    test('links point at the neighbouring nodes themselves', () => {
      const list = new LinkedList<number>();
      const n1 = list.append(1);
      const n2 = list.append(2);
      const n3 = list.append(3);

      expect(n1.previous).toBeNull();
      expect(n1.next).toBe(n2);
      expect(n2.previous).toBe(n1);
      expect(n2.next).toBe(n3);
      expect(n3.previous).toBe(n2);
      expect(n3.next).toBeNull();
    });
  });

  describe('removal', () => {
    test('removeSelf detaches the head', () => {
      const list = new LinkedList<number>();
      const head = list.append(1);
      list.append(2);
      list.append(3);

      head.removeSelf();

      expectList(list, [2, 3]);
    });

    test('removeSelf detaches the tail', () => {
      const list = new LinkedList<number>();
      list.append(1);
      list.append(2);
      const tail = list.append(3);

      tail.removeSelf();

      expectList(list, [1, 2]);
    });

    test('removeSelf detaches a middle node', () => {
      const list = new LinkedList<number>();
      list.append(1);
      const middle = list.append(2);
      list.append(3);

      middle.removeSelf();

      expectList(list, [1, 3]);
    });

    test('list.remove accepts a node handed back to it', () => {
      const list = new LinkedList<number>();
      const node = list.append(100);

      list.remove(node);

      expectList(list, []);
    });

    test('removing every node empties the list', () => {
      const list = new LinkedList<string>();
      const nodes = ['a', 'b', 'c'].map((value) => list.append(value));

      nodes.forEach((node) => node.removeSelf());

      expectList(list, []);
    });

    test('an emptied list can be filled again', () => {
      const list = new LinkedList<number>();
      list.append(1).removeSelf();
      expectList(list, []);

      list.append(2);
      list.prepend(1);

      expectList(list, [1, 2]);
    });
  });

  describe('node lifecycle', () => {
    test('a removed node is scrubbed', () => {
      const list = new LinkedList<number>();
      const removed = list.append(10);

      removed.removeSelf();

      // Nothing about the node survives removal, so a stale reference cannot be mistaken for a
      // live entry.
      expect(removed.value).toBeUndefined();
      expect(removed.previous).toBeNull();
      expect(removed.next).toBeNull();
      expect(removed.onBeforeClear).toBeNull();
    });

    test('a removed node is never handed back out', () => {
      const list = new LinkedList<number>();
      const removed = list.append(10);
      removed.removeSelf();

      const fresh = list.append(20);

      // A distinct object: recycling identities is what lets a reference held across a removal
      // silently start pointing at somebody else's data.
      expect(fresh).not.toBe(removed);
      expect(fresh.value).toBe(20);
      expectList(list, [20]);
    });

    test('lists of different types never share node identities', () => {
      const numbers = new LinkedList<number>();
      const strings = new LinkedList<string>();

      const numberNode = numbers.append(123);
      numberNode.removeSelf();

      const stringNode = strings.append('hello');

      expect(stringNode).not.toBe(numberNode);
      expect(stringNode.value).toBe('hello');
      expect(numberNode.value).toBeUndefined();
    });

    test('every operation on a removed node is rejected', () => {
      const list = new LinkedList<number>();
      const node = list.append(1);
      node.removeSelf();

      // A scrubbed node has lost its owning list, so it can no longer say where an insertion
      // would even go.
      expect(() => node.insertBefore(2)).toThrow('[LinkedNode]: can not find the owning list.');
      expect(() => node.insertAfter(3)).toThrow('[LinkedNode]: can not find the owning list.');
      expect(() => node.removeSelf()).toThrow('[LinkedNode]: can not find the owning list.');
    });

    test('handing a removed node back to its former list is rejected', () => {
      const list = new LinkedList<number>();
      const node = list.append(1);
      list.append(2);
      node.removeSelf();

      expect(() => list.remove(node)).toThrow('[LinkedNode]: the node does not belong to this list.');
      expectList(list, [2]);
    });
  });

  describe('ownership safety', () => {
    test('a list refuses to remove a node it does not own', () => {
      const listA = new LinkedList<number>();
      const listB = new LinkedList<number>();
      const nodeA = listA.append(1);

      expect(() => listB.remove(nodeA)).toThrow('[LinkedNode]: the node does not belong to this list.');

      // The rejected call must not have touched either list on its way out.
      expectList(listA, [1]);
      expectList(listB, []);
    });

    test("inserting through a node always lands in that node's own list", () => {
      const listA = new LinkedList<number>();
      const listB = new LinkedList<number>();
      const nodeA = listA.append(1);
      listB.append(9);

      // Insertion is reached through the node, which carries its owning list with it, so there is
      // no way to aim an insert at the wrong list in the first place.
      nodeA.insertAfter(2);
      nodeA.insertBefore(0);

      expectList(listA, [0, 1, 2]);
      expectList(listB, [9]);
    });
  });

  describe('onRemoved', () => {
    test('fires once when the node removes itself', () => {
      const list = new LinkedList<number>();
      const node = list.append(10);

      let calls = 0;
      let seen: number | undefined;
      node.onBeforeClear = (target) => {
        calls += 1;
        seen = target.value;
      };

      node.removeSelf();

      // The callback still sees the value; the scrub happens after it has run.
      expect(calls).toBe(1);
      expect(seen).toBe(10);
      expect(node.onBeforeClear).toBeNull();
      expect(node.value).toBeUndefined();
    });

    test('fires once when the list removes the node', () => {
      const list = new LinkedList<number>();
      const node = list.append(20);

      let calls = 0;
      let seen: number | undefined;
      node.onBeforeClear = (target) => {
        calls += 1;
        seen = target.value;
      };

      list.remove(node);

      expect(calls).toBe(1);
      expect(seen).toBe(20);
      expect(node.onBeforeClear).toBeNull();
      expect(node.value).toBeUndefined();
    });

    test('a throwing callback still leaves the list consistent', () => {
      const list = new LinkedList<number>();
      const node = list.append(1);
      const survivor = list.append(2);

      node.onBeforeClear = () => {
        throw new Error('boom');
      };

      // The error reaches the caller, but the node is already unlinked and scrubbed by then -- a
      // misbehaving listener must not be able to strand a half-removed node in the list.
      expect(() => list.remove(node)).toThrow('boom');

      expect(list.head).toBe(survivor);
      expectList(list, [2]);
      expect(node.value).toBeUndefined();
      expect(node.onBeforeClear).toBeNull();
    });
  });

  describe('public surface', () => {
    test('size, head and tail are read-only from the outside', () => {
      const list = new LinkedList<number>();
      list.append(1);

      // Exposed as getters, so in an ES module (always strict mode) a write throws rather than
      // silently corrupting the list's bookkeeping.
      expect(() => ((list as unknown as { size: number }).size = 99)).toThrow(TypeError);
      expect(() => ((list as unknown as { head: null }).head = null)).toThrow(TypeError);
      expect(() => ((list as unknown as { tail: null }).tail = null)).toThrow(TypeError);

      expectList(list, [1]);
    });
  });

  describe('stability under load', () => {
    test('a thousand mixed insertions stay consistent', () => {
      const list = new LinkedList<number>();
      for (let i = 0; i < 500; i++) {
        list.append(i);
        list.prepend(-i - 1);
      }

      const expected = [
        ...Array.from({ length: 500 }, (_, i) => -500 + i),
        ...Array.from({ length: 500 }, (_, i) => i),
      ];
      expectList(list, expected);
    });

    test('removing every other node keeps both directions in step', () => {
      const list = new LinkedList<number>();
      const nodes: ILinkedNode<number>[] = [];
      for (let i = 0; i < 1000; i++) {
        nodes.push(list.append(i));
      }

      for (let i = 0; i < 1000; i += 2) {
        nodes[i].removeSelf();
      }

      expectList(
        list,
        Array.from({ length: 500 }, (_, i) => i * 2 + 1),
      );
    });

    test('draining the list node by node ends in a clean empty list', () => {
      const list = new LinkedList<number>();
      const nodes: ILinkedNode<number>[] = [];
      for (let i = 0; i < 200; i++) {
        nodes.push(i % 2 ? list.append(i) : list.prepend(i));
      }

      // Remove in a scattered order rather than head-first, so head, tail and interior fixups all
      // get exercised on the way down.
      for (let i = nodes.length - 1; i >= 0; i -= 3) {
        nodes[i].removeSelf();
      }
      nodes.filter((node) => node.value !== undefined).forEach((node) => node.removeSelf());

      expectList(list, []);
    });
  });
});
