import { describe, expect, test } from 'vitest';
import type { ILinkedNode } from './types';
import { LinkedList } from './main';

describe('LinkedList (With Global Node Pooling)', () => {
  test('Basic functionality: add elements and maintain order', () => {
    const list = new LinkedList<number>();
    list.add(1);
    list.add(2);
    list.add(3);

    expect(list.size).toBe(3);
    expect(list.toArray()).toEqual([1, 2, 3]);
  });

  test('Node self-removal: remove via ILinkedNode.removeSelf()', () => {
    const list = new LinkedList<string>();
    const n1 = list.add('a');
    const n2 = list.add('b');
    const n3 = list.add('c');

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
    const node = list.add(100);

    list.remove(node);

    expect(list.size).toBe(0);
    expect(list.toArray()).toEqual([]);
  });

  test('Safety: cannot delete a node that does not belong to the list', () => {
    const listA = new LinkedList<number>();
    const listB = new LinkedList<number>();

    const nodeA = listA.add(1);
    listB.remove(nodeA);

    expect(listA.size).toBe(1);
    expect(listB.size).toBe(0);
  });

  test('Object pool reuse: verify node recycling and reuse', () => {
    const list = new LinkedList<number>();

    const node1 = list.add(10);
    const node1Ref = node1;
    node1.removeSelf();
    expect(node1.value).toBeUndefined();
    const node2 = list.add(20);

    expect(node2).toBe(node1Ref);
    expect(node2.value).toBe(20);
    expect(list.size).toBe(1);
  });

  test('Different type linked lists share object pool', () => {
    const numList = new LinkedList<number>();
    const strList = new LinkedList<string>();

    const n1 = numList.add(123);
    n1.removeSelf();

    const s1 = strList.add('hello');

    expect(s1.value).toBe('hello');
    expect(typeof s1.value).toBe('string');
  });

  test('Complex operations: stability under frequent add/remove', () => {
    const list = new LinkedList<number>();
    const nodes: ILinkedNode<number>[] = [];

    for (let i = 0; i < 100; i++) {
      nodes.push(list.add(i));
    }
    expect(list.size).toBe(100);

    for (let i = 0; i < 50; i++) {
      nodes[i].removeSelf();
    }
    expect(list.size).toBe(50);
    expect(list.toArray()[0]).toBe(50);
  });
});
