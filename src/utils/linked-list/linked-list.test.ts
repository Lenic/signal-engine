import { describe, expect, test } from 'vitest';
import type { ILinkedNode } from './types';
import { LinkedList } from './main';

describe('LinkedList (With Global Node Pooling)', () => {
  test('Basic functionality: add elements and maintain order', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    list.append(3);

    expect(list.size).toBe(3);
    expect(list.toArray()).toEqual([1, 2, 3]);
  });

  test('Node self-removal: remove via ILinkedNode.removeSelf()', () => {
    const list = new LinkedList<string>();
    const n1 = list.append('a');
    const n2 = list.append('b');
    const n3 = list.append('c');

    n2.removeSelf();

    expect(list.size).toBe(2);
    expect(list.toArray()).toEqual(['a', 'c']);

    n1.removeSelf();
    expect(list.toArray()).toEqual(['c']);

    n3.removeSelf();
    expect(list.size).toBe(0);
    expect(list.toArray()).toEqual([]);
  });

  test('LinkedList instance deletion: remove via list.remove(node)', () => {
    const list = new LinkedList<number>();
    const node = list.append(100);

    list.remove(node);

    expect(list.size).toBe(0);
    expect(list.toArray()).toEqual([]);
  });

  test('Safety: cannot delete a node that does not belong to the list', () => {
    const listA = new LinkedList<number>();
    const listB = new LinkedList<number>();

    const nodeA = listA.append(1);
    expect(() => listB.remove(nodeA)).toThrow('[LinkedNode]: the node does not belong to this list.');

    expect(listA.size).toBe(1);
    expect(listB.size).toBe(0);
  });

  test('A removed node is scrubbed and never handed to another list', () => {
    const list = new LinkedList<number>();

    const removed = list.append(10);
    removed.removeSelf();

    // Nothing about the node survives removal, so a stale reference cannot be mistaken for a
    // live entry.
    expect(removed.value).toBeUndefined();
    expect(removed.previous).toBeNull();
    expect(removed.next).toBeNull();
    expect(removed.onRemoved).toBeNull();

    const fresh = list.append(20);

    // A distinct object: recycling identities is what lets a reference held across a removal
    // silently start pointing at somebody else's data.
    expect(fresh).not.toBe(removed);
    expect(fresh.value).toBe(20);
    expect(list.size).toBe(1);
  });

  test('Lists of different types never share node identities', () => {
    const numList = new LinkedList<number>();
    const strList = new LinkedList<string>();

    const n1 = numList.append(123);
    n1.removeSelf();

    const s1 = strList.append('hello');

    expect(s1).not.toBe(n1);
    expect(s1.value).toBe('hello');
    expect(n1.value).toBeUndefined();
  });

  test('Complex operations: stability under frequent add/remove', () => {
    const list = new LinkedList<number>();
    const nodes: ILinkedNode<number>[] = [];

    for (let i = 0; i < 100; i++) {
      nodes.push(list.append(i));
    }
    expect(list.size).toBe(100);

    for (let i = 0; i < 50; i++) {
      nodes[i].removeSelf();
    }
    expect(list.size).toBe(50);
    expect(list.toArray()[0]).toBe(50);
  });

  test('Prepend: add elements to the front', () => {
    const list = new LinkedList<number>();

    // Prepend to empty list
    const n1 = list.prepend(1);
    expect(list.size).toBe(1);
    expect(list.head).toBe(n1);
    expect(list.tail).toBe(n1);
    expect(list.toArray()).toEqual([1]);

    // Prepend to non-empty list
    const n2 = list.prepend(2);
    expect(list.size).toBe(2);
    expect(list.head).toBe(n2);
    expect(list.tail).toBe(n1);
    expect(list.toArray()).toEqual([2, 1]);
  });

  test('InsertBefore & InsertAfter: insert node before/after a specific node', () => {
    const list = new LinkedList<number>();
    const n2 = list.append(2);

    // insertBefore
    const n1 = n2.insertBefore(1);
    expect(list.size).toBe(2);
    expect(list.head).toBe(n1);
    expect(list.toArray()).toEqual([1, 2]);

    // insertAfter
    const n3 = n2.insertAfter(3);
    expect(list.size).toBe(3);
    expect(list.tail).toBe(n3);
    expect(list.toArray()).toEqual([1, 2, 3]);

    // insert in between
    const n1_5 = n2.insertBefore(15);
    expect(list.size).toBe(4);
    expect(list.toArray()).toEqual([1, 15, 2, 3]);
  });

  test('Clear: removes all nodes and resets state', () => {
    const list = new LinkedList<number>();
    list.append(1);
    list.append(2);
    expect(list.size).toBe(2);

    list.clear();
    expect(list.size).toBe(0);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    expect(list.toArray()).toEqual([]);
  });

  test('Double Linked List properties: head, tail, prev, next links', () => {
    const list = new LinkedList<number>();
    const n1 = list.append(1);
    const n2 = list.append(2);
    const n3 = list.append(3);

    expect(list.head).toBe(n1);
    expect(list.tail).toBe(n3);

    expect(n1.previous).toBeNull();
    expect(n1.next).toBe(n2);
    expect(n2.previous).toBe(n1);
    expect(n2.next).toBe(n3);
    expect(n3.previous).toBe(n2);
    expect(n3.next).toBeNull();
  });

  test('Safety: cannot insert before/after on a removed node', () => {
    const list = new LinkedList<number>();
    const n1 = list.append(1);
    n1.removeSelf();

    expect(() => n1.insertBefore(2)).toThrow('[LinkedNode]: can not find the owning list.');
    expect(() => n1.insertAfter(3)).toThrow('[LinkedNode]: can not find the owning list.');
  });

  test('Safety: insertNodeBefore/After throws on non-matching owning list', () => {
    const listA = new LinkedList<number>();
    const listB = new LinkedList<number>();
    const nodeA = listA.append(1);

    expect(() => listB.insertNodeBefore(nodeA, 2)).toThrow('[LinkedNode]: the node does not belong to this list.');
    expect(() => listB.insertNodeAfter(nodeA, 2)).toThrow('[LinkedNode]: the node does not belong to this list.');
  });

  test('onRemoved callback: triggered when node is removed under different methods', () => {
    const list = new LinkedList<number>();

    // 1. Test removeSelf()
    const node1 = list.append(10);
    let called1 = 0;
    let valueInCallback1: number | undefined;
    node1.onRemoved = (n) => {
      called1++;
      valueInCallback1 = n.value;
    };
    node1.removeSelf();
    expect(called1).toBe(1);
    expect(valueInCallback1).toBe(10);
    expect(node1.onRemoved).toBeNull();
    expect(node1.value).toBeUndefined();

    // 2. Test list.remove(node)
    const node2 = list.append(20);
    let called2 = 0;
    let valueInCallback2: number | undefined;
    node2.onRemoved = (n) => {
      called2++;
      valueInCallback2 = n.value;
    };
    list.remove(node2);
    expect(called2).toBe(1);
    expect(valueInCallback2).toBe(20);
    expect(node2.onRemoved).toBeNull();
    expect(node2.value).toBeUndefined();

    // 3. Test list.clear()
    const node3 = list.append(30);
    let called3 = 0;
    let valueInCallback3: number | undefined;
    node3.onRemoved = (n) => {
      called3++;
      valueInCallback3 = n.value;
    };
    list.clear();
    expect(called3).toBe(1);
    expect(valueInCallback3).toBe(30);
    expect(node3.onRemoved).toBeNull();
    expect(node3.value).toBeUndefined();
  });

  test('forEach: iterates over all elements and receives values and indices', () => {
    const list = new LinkedList<string>();
    const values: string[] = [];
    const indices: number[] = [];

    // Empty list
    list.forEach((val, idx) => {
      values.push(val);
      indices.push(idx);
    });
    expect(values).toEqual([]);
    expect(indices).toEqual([]);

    // Elements present
    list.append('a');
    list.append('b');
    list.append('c');

    list.forEach((val, idx) => {
      values.push(val);
      indices.push(idx);
    });
    expect(values).toEqual(['a', 'b', 'c']);
    expect(indices).toEqual([0, 1, 2]);
  });

  test('Clear with callback: executes callback for all nodes during clear', () => {
    const list = new LinkedList<number>();
    const clearedItems: { item: number; index: number }[] = [];

    // Empty list
    list.clear((item, index) => {
      clearedItems.push({ item, index });
    });
    expect(clearedItems).toEqual([]);
    expect(list.size).toBe(0);

    // Multiple elements (Verifying the bug fix: all elements are processed)
    list.append(100);
    list.append(200);
    list.append(300);

    list.clear((item, index) => {
      clearedItems.push({ item, index });
    });

    expect(clearedItems).toEqual([
      { item: 100, index: 0 },
      { item: 200, index: 1 },
      { item: 300, index: 2 },
    ]);
    expect(list.size).toBe(0);
    expect(list.head).toBeNull();
    expect(list.tail).toBeNull();
    expect(list.toArray()).toEqual([]);
  });
});
