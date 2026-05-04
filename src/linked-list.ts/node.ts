import { ILinkedList, ILinkedNode } from './types';

/**
 * 内部节点类，实现 ILinkedNode 接口
 */
export class ListNode<T> implements ILinkedNode<T> {
  public value: T | undefined;
  public prev: ListNode<T> | null = null;
  public next: ListNode<T> | null = null;
  public list: ILinkedList<T> | null = null;

  constructor(value?: T) {
    this.value = value;
  }

  /**
   * 实现接口的 remove 方法
   */
  public remove(): void {
    if (this.list) {
      // 这里的 this 就是当前的 ListNode 实例
      this.list.remove(this);
      this.clear();
    }
  }

  /**
   * 清理节点数据，准备回归对象池
   */
  public clear(): void {
    this.value = undefined;
    this.prev = null;
    this.next = null;
    this.list = null;
  }
}
