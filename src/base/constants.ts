import type { IDisposable, IEffectOwner, ILinked } from './types';

export const childrenMethods = {
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
