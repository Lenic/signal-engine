import { describe, expect, test } from 'vitest';
import type { ILinkedNode } from './types';
import { LinkedList } from './main';

describe('LinkedList (With Global Node Pooling)', () => {
  // 每次测试前可以根据需要重置环境

  test('基础功能：添加元素并保持顺序', () => {
    const list = new LinkedList<number>();
    list.add(1);
    list.add(2);
    list.add(3);

    expect(list.size).toBe(3);
    expect(list.toArray()).toEqual([1, 2, 3]);
  });

  test('节点自删除：通过 ILinkedNode.remove() 移除', () => {
    const list = new LinkedList<string>();
    const n1 = list.add('a');
    const n2 = list.add('b');
    const n3 = list.add('c');

    n2.removeSelf(); // 删除中间节点

    expect(list.size).toBe(2);
    expect(list.toArray()).toEqual(['a', 'c']);

    n1.removeSelf(); // 删除头节点
    expect(list.toArray()).toEqual(['c']);

    n3.removeSelf(); // 删除尾节点（最后一个节点）
    expect(list.size).toBe(0);
    expect(list.toArray()).toEqual([]);
  });

  test('链表实例删除：通过 list.remove(node) 移除', () => {
    const list = new LinkedList<number>();
    const node = list.add(100);

    list.remove(node);

    expect(list.size).toBe(0);
    expect(list.toArray()).toEqual([]);
  });

  test('安全性：不能删除不属于自己的节点', () => {
    const listA = new LinkedList<number>();
    const listB = new LinkedList<number>();

    const nodeA = listA.add(1);
    listB.remove(nodeA); // 尝试用 listB 删除 listA 的节点

    expect(listA.size).toBe(1); // listA 应该不受影响
    expect(listB.size).toBe(0);
  });

  test('对象池复用：验证节点回收与再次利用', () => {
    const list = new LinkedList<number>();

    // 1. 添加并删除一个节点，使其进入对象池
    const node1 = list.add(10);
    const node1Ref = node1; // 记录引用
    node1.removeSelf();

    // 验证节点已被清理（通过接口无法直接访问，但逻辑上它已回池）
    expect(node1.value).toBeUndefined();

    // 2. 再次添加新节点，观察是否复用了之前的对象
    const node2 = list.add(20);

    // 在 JavaScript 中，如果引用地址相同，则说明复用了内存对象
    // 注意：这里需要 node2 as any 或者是修改测试结构来对比内存引用
    expect(node2).toBe(node1Ref);
    expect(node2.value).toBe(20);
    expect(list.size).toBe(1);
  });

  test('不同类型的链表共用对象池', () => {
    const numList = new LinkedList<number>();
    const strList = new LinkedList<string>();

    const n1 = numList.add(123);
    n1.removeSelf(); // number 节点回池

    const s1 = strList.add('hello'); // 应该复用之前的那个节点对象

    expect(s1.value).toBe('hello');
    expect(typeof s1.value).toBe('string');
  });

  test('复杂操作：频繁增删下的稳定性', () => {
    const list = new LinkedList<number>();
    const nodes: ILinkedNode<number>[] = [];

    // 填充 100 个
    for (let i = 0; i < 100; i++) {
      nodes.push(list.add(i));
    }
    expect(list.size).toBe(100);

    // 随机删除一半
    for (let i = 0; i < 50; i++) {
      nodes[i].removeSelf();
    }
    expect(list.size).toBe(50);
    expect(list.toArray()[0]).toBe(50); // 因为前 50 个删了，现在第一个应该是 50
  });
});
