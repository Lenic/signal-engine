import { DependencyList, DependencyNode, Subscriber } from './types';

/**
 * Creates a new dependency node for a subscriber.
 */
export function createDependencyNode(subscriber: Subscriber, list: DependencyList): DependencyNode {
  return {
    subscriber,
    dependencyList: list,
    prev: null,
    next: null,
  };
}

/**
 * Appends a node to the dependency list.
 */
export function appendToDependencyList(list: DependencyList, node: DependencyNode) {
  node.dependencyList = list;
  if (!list.head) {
    list.head = list.tail = node;
  } else {
    node.prev = list.tail;
    if (list.tail) {
      list.tail.next = node;
    }
    list.tail = node;
  }
}

/**
 * Removes a node from its current dependency list.
 */
export function removeFromDependencyList(node: DependencyNode) {
  const list = node.dependencyList;
  if (!list) return;

  if (node.prev) node.prev.next = node.next;
  if (node.next) node.next.prev = node.prev;

  if (list.head === node) list.head = node.next;
  if (list.tail === node) list.tail = node.prev;

  node.next = null;
  node.prev = null;
  node.dependencyList = null;
  node.subscriber = null;
}

/**
 * Iterates over each node in the list.
 */
export function forEachSubscriber(list: DependencyList, callback: (node: DependencyNode) => void) {
  let current = list.head;
  while (current) {
    const next = current.next;
    callback(current);
    current = next;
  }
}
