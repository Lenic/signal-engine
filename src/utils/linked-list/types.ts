/**
 * Represents a node in a doubly linked list.
 * This interface hides internal properties like the list reference to prevent accidental misuse.
 */
export interface ILinkedNode<T> {
  /** The value stored in this node. */
  value: T;
  /** Pointer to the previous node in the list, or null if this is the head. */
  prev: ILinkedNode<T> | null;
  /** Pointer to the next node in the list, or null if this is the tail. */
  next: ILinkedNode<T> | null;

  /**
   * Removes this node from its parent linked list.
   */
  removeSelf(): void;

  /**
   * Clears the node's references and value.
   */
  clear(): void;
}

/**
 * Interface for a doubly linked list data structure.
 */
export interface ILinkedList<T> {
  /** The total number of nodes currently in the linked list. */
  readonly size: number;
  /** The first node in the linked list, or null if empty. */
  readonly head: ILinkedNode<T> | null;
  /** The last node in the linked list, or null if empty. */
  readonly tail: ILinkedNode<T> | null;

  /**
   * Appends a new value to the end of the linked list.
   * @param value The value to add.
   * @returns The newly created node.
   */
  add(value: T): ILinkedNode<T>;

  /**
   * Removes a specific node from the linked list.
   * @param node The node to remove.
   */
  remove(node: ILinkedNode<T>): void;

  /**
   * Removes all nodes from the linked list.
   */
  clear(): void;
}
