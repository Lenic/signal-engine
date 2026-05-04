import { ListNode } from './node';
import { ListNodePool } from './pool';
import { ILinkedList, ILinkedNode } from './types';

/**
 * 双向链表类
 */
export class LinkedList<T> implements ILinkedList<T> {
  private head: ListNode<T> | null = null;
  private tail: ListNode<T> | null = null;
  private _size: number = 0;

  public get size(): number {
    return this._size;
  }

  /**
   * 添加元素到末尾
   * @returns 返回 ILinkedNode 接口，限制外部访问范围
   */
  public add(value: T): ILinkedNode<T> {
    const newNode = ListNodePool.acquire(value, this);

    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.prev = this.tail;
      if (this.tail) {
        this.tail.next = newNode;
      }
      this.tail = newNode;
    }

    this._size++;
    return newNode;
  }

  /**
   * 移除节点
   * @param node 符合 ILinkedNode 接口的对象
   */
  public remove(node: ILinkedNode<T>): void {
    // 将接口强制转换为内部实现类以便操作指针
    const internalNode = node as ListNode<T>;

    // 严谨性检查：确保该节点属于当前链表实例
    if (!internalNode || internalNode.list !== this) {
      return;
    }

    // 处理前驱节点的指向
    if (internalNode.prev) {
      internalNode.prev.next = internalNode.next;
    } else {
      this.head = internalNode.next;
    }

    // 处理后继节点的指向
    if (internalNode.next) {
      internalNode.next.prev = internalNode.prev;
    } else {
      this.tail = internalNode.prev;
    }

    this._size--;

    // 回收节点到全局对象池
    ListNodePool.release(internalNode);
  }

  /**
   * 辅助方法：转换为数组进行观察
   */
  public toArray(): T[] {
    const result: T[] = [];
    let current = this.head;
    while (current) {
      if (current.value !== undefined) {
        result.push(current.value);
      }
      current = current.next;
    }
    return result;
  }
}
