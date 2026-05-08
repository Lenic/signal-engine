import { LinkedNode } from './node';
import { ILinkedList } from './types';

/**
 * 全局节点对象池
 */
export class LinkedNodePool {
  private static pool: LinkedNode<any>[] = [];
  public static maxPoolSize: number = 1000;

  public static acquire<T>(value: T, list: ILinkedList<T>): LinkedNode<T> {
    let node: LinkedNode<T>;
    if (this.pool.length > 0) {
      node = this.pool.pop()!;
      node.value = value;
      node.list = list;
    } else {
      node = new LinkedNode(value);
      node.list = list;
    }
    return node;
  }

  public static release<T>(node: LinkedNode<T>): void {
    if (this.pool.length < this.maxPoolSize) {
      node.clear();
      this.pool.push(node);
    } else {
      node.clear();
    }
  }
}
