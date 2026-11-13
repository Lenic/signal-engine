import type { IConnectible, IConnector, IDisposable, IEffectOwner, ILinked, IRunnable } from './types';

const ALREADY_LINKED = '[appendNode]: node is already linked, unlink it before adding it again.';

export const runnableMethods = {
  append(node: IConnector, owner: IRunnable): void {
    if (node.prevConnectible || node.nextConnectible || owner.connectibleHead === node) {
      throw new Error(ALREADY_LINKED);
    }

    const tail = owner.connectibleTail;
    if (tail) {
      tail.nextConnectible = node;
    } else {
      owner.connectibleHead = node;
    }

    node.prevConnectible = tail;
    owner.connectibleTail = node;
  },

  remove(node: IConnector, owner: IRunnable): void {
    const prev = node.prevConnectible;
    const next = node.nextConnectible;

    if (prev) prev.nextConnectible = next;
    if (next) next.prevConnectible = prev;

    if (owner.connectibleHead === node) owner.connectibleHead = next;
    if (owner.connectibleTail === node) owner.connectibleTail = prev;

    node.prevConnectible = undefined;
    node.nextConnectible = undefined;
  },
};

export const connectibleMethods = {
  append(node: IConnector, owner: IConnectible): void {
    if (node.prevRunnable || node.nextRunnable || owner.runnableHead === node) {
      throw new Error(ALREADY_LINKED);
    }

    const tail = owner.runnableTail;
    if (tail) {
      tail.nextRunnable = node;
    } else {
      owner.runnableHead = node;
    }

    node.prevRunnable = tail;
    owner.runnableTail = node;
  },

  remove(node: IConnector, owner: IConnectible): void {
    const prev = node.prevRunnable;
    const next = node.nextRunnable;

    if (prev) prev.nextRunnable = next;
    if (next) next.prevRunnable = prev;

    if (owner.runnableHead === node) owner.runnableHead = next;
    if (owner.runnableTail === node) owner.runnableTail = prev;

    node.prevRunnable = undefined;
    node.nextRunnable = undefined;
  },
};

export const childrenMethods = {
  append(node: ILinked<IDisposable>, owner: IEffectOwner): void {
    if (node.prev || node.next || owner.childrenHead === node) {
      throw new Error(ALREADY_LINKED);
    }

    const tail = owner.childrenTail;
    if (tail) {
      tail.next = node;
    } else {
      owner.childrenHead = node;
    }

    node.prev = tail;
    owner.childrenTail = node;
  },

  remove(node: ILinked<IDisposable>, owner: IEffectOwner): void {
    const prev = node.prev;
    const next = node.next;

    if (prev) prev.next = next;
    if (next) next.prev = prev;

    if (owner.childrenHead === node) owner.childrenHead = next;
    if (owner.childrenTail === node) owner.childrenTail = prev;

    node.prev = undefined;
    node.next = undefined;
  },
};
