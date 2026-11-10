import type { LinkedKey, EndpointKey, LinkedNode, LinkedOwner } from './types';

export function unlink<
  X extends object,
  O extends object,
  P extends LinkedKey<X, 'prev'>,
  N extends LinkedKey<X, 'next'>,
  H extends EndpointKey<O, X, 'Head'>,
  T extends EndpointKey<O, X, 'Tail'>,
>(node: X, owner: O, prevKey: P, nextKey: N, headKey: H, tailKey: T): void {
  const target = node as LinkedNode<X>;
  const endpoints = owner as LinkedOwner<O, X>;
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
