/**
 * Represents a node in a doubly linked list.
 * This interface hides internal properties like the list reference to prevent accidental misuse.
 */
export interface ILinkedNode<T> {
  /**
   * The value stored in this node.
   */
  value: T;

  /**
   * Pointer to the previous node in the list, or null if this is the head.
   */
  prev: ILinkedNode<T> | null;

  /**
   * Pointer to the next node in the list, or null if this is the tail.
   */
  next: ILinkedNode<T> | null;

  /**
   * Inserts a new value before the current node.
   * @param value The value to add.
   * @returns The newly created node.
   */
  insertBefore(value: T): ILinkedNode<T>;

  /**
   * Inserts a new value after the current node.
   * @param value The value to add.
   * @returns The newly created node.
   */
  insertAfter(value: T): ILinkedNode<T>;

  /**
   * Removes this node from its parent linked list.
   */
  removeSelf(): void;

  /**
   * Callback function to be executed when the node is removed
   *
   * - the callback would trigger once only
   * - it will be called just after removed from the list
   * - the callback will be set to null after trigger to prevent multiple triggers
   * - the node will set the onRemoved, prev, next, value to null after trigger to break all references
   */
  onRemoved: ((node: ILinkedNode<T>) => void) | null;
}

/**
 * Interface for a doubly linked list data structure.
 */
export interface ILinkedList<T> {
  /**
   * The total number of nodes currently in the linked list.
   */
  readonly size: number;
  /**
   * The first node in the linked list, or null if empty.
   */
  readonly head: ILinkedNode<T> | null;
  /**
   * The last node in the linked list, or null if empty.
   */
  readonly tail: ILinkedNode<T> | null;

  /**
   * Inserts a new value at the beginning of the linked list.
   * @param value The value to add.
   * @returns The newly created node.
   */
  prepend(value: T): ILinkedNode<T>;

  /**
   * Appends a new value to the end of the linked list.
   * @param value The value to add.
   * @returns The newly created node.
   */
  append(value: T): ILinkedNode<T>;

  /**
   * Removes a specific node from the linked list.
   * @param node The node to remove.
   */
  remove(node: ILinkedNode<T>): void;

  /**
   * Removes all nodes from the linked list.
   * @param callback Optional callback function to be executed for each removed node.
   *                 The callback receives the removed node and its index in the list.
   */
  clear(callback?: (item: T, index: number) => void): void;

  /**
   * Executes a callback function for each node in the linked list.
   * @param callback The callback function to execute for each node.
   *                 The callback receives the node's value and index.
   */
  forEach(callback: (item: T, index: number) => void): void;
}

/**
 * Internal actions interface for linked list operations.
 * This interface is used internally by the LinkedList class for node management.
 * @template T The type of values stored in the linked list.
 */
export interface ILinkedListInternalActions<T> {
  /**
   * Inserts a new value before the specified node.
   * @param node The node before which to insert the value.
   * @param value The value to insert.
   * @returns The newly created node.
   */
  insertNodeBefore(node: ILinkedNode<T> | null, value: T): ILinkedNode<T>;

  /**
   * Inserts a new value after the specified node.
   * @param node The node after which to insert the value.
   * @param value The value to insert.
   * @returns The newly created node.
   */
  insertNodeAfter(node: ILinkedNode<T> | null, value: T): ILinkedNode<T>;

  /**
   * Converts the linked list to an array.
   * @returns An array containing all the values in the linked list.
   */
  toArray(): T[];
}
