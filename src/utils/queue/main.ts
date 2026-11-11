import type { TLinkedKey, TEndpointKey, TLinkedNode, TLinkedOwner } from './types';

import { EAddType } from './types';

export function unlink<
  X extends object,
  O extends object,
  P extends TLinkedKey<X, 'prev'>,
  N extends TLinkedKey<X, 'next'>,
  H extends TEndpointKey<O, X, 'Head'>,
  T extends TEndpointKey<O, X, 'Tail'>,
>(node: X, owner: O, prevKey: P, nextKey: N, headKey: H, tailKey: T): void {
  const target = node as TLinkedNode<X>;
  const endpoints = owner as TLinkedOwner<O, X>;
  const { [prevKey]: prev, [nextKey]: next } = target;

  if (prev) {
    prev[nextKey] = next;
  }

  if (next) {
    next[prevKey] = prev;
  }

  if (endpoints[headKey] === node) {
    endpoints[headKey] = next;
  }

  if (endpoints[tailKey] === node) {
    endpoints[tailKey] = prev;
  }

  target[prevKey] = undefined;
  target[nextKey] = undefined;
}

export function addNew<
  X extends object,
  O extends object,
  P extends TLinkedKey<X, 'prev'>,
  N extends TLinkedKey<X, 'next'>,
  H extends TEndpointKey<O, X, 'Head'>,
  T extends TEndpointKey<O, X, 'Tail'>,
>(node: X, owner: O, addType: EAddType, prevKey: P, nextKey: N, headKey: H, tailKey: T): void {
  const target = node as TLinkedNode<X>;
  const endpoints = owner as TLinkedOwner<O, X>;

  if (target[prevKey] || target[nextKey] || endpoints[headKey] === target) {
    throw new Error('[addNew]: node is already linked, unlink it before adding it again.');
  }

  // the vast majority of calls are to `append`
  if (addType === EAddType.append) {
    const tail = endpoints[tailKey];
    if (tail) {
      tail[nextKey] = target;
    } else {
      endpoints[headKey] = target;
    }

    target[prevKey] = tail;
    endpoints[tailKey] = target;
  } else if (addType === EAddType.prepend) {
    const head = endpoints[headKey];
    if (head) {
      head[prevKey] = target;
    } else {
      endpoints[tailKey] = target;
    }

    target[nextKey] = head;
    endpoints[headKey] = target;
  }
}
