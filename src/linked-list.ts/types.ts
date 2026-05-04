/**
 * 对外公开的节点接口
 * 隐藏了 prev, next, list 等内部属性，防止外部误操作
 */
export interface ILinkedNode<T> {
  readonly value: T | undefined;
  remove(): void;
  clear(): void;
}

export interface ILinkedList<T> {
  readonly size: number;
  add(value: T): ILinkedNode<T>;
  remove(node: ILinkedNode<T>): void;
}
