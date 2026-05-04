import { ListNode } from './node';
import { ILinkedList } from './types';

/**
 * 全局节点对象池
 */
export class ListNodePool {
  private static pool: ListNode<any>[] = [];
  public static maxPoolSize: number = 1000;

  public static acquire<T>(value: T, list: ILinkedList<T>): ListNode<T> {
    let node: ListNode<T>;
    if (this.pool.length > 0) {
      node = this.pool.pop()!;
      node.value = value;
      node.list = list;
    } else {
      node = new ListNode(value);
      node.list = list;
    }
    return node;
  }

  public static release<T>(node: ListNode<T>): void {
    if (this.pool.length < this.maxPoolSize) {
      node.clear();
      this.pool.push(node);
    } else {
      node.clear();
    }
  }
}
