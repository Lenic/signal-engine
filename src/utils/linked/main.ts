import type { TLinkedKey, TEndpointKey, TLinkedNode, TLinkedOwner, TNodeOf } from './types';

export function unlink<X extends object, O extends object>(
  node: X,
  owner: O,
  prevKey: TLinkedKey<X, 'prev'>,
  nextKey: TLinkedKey<X, 'next'>,
  headKey: TEndpointKey<O, X, 'Head'>,
  tailKey: TEndpointKey<O, X, 'Tail'>,
): void {
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

export function appendNode<X extends object, O extends object>(
  node: X,
  owner: O,
  prevKey: TLinkedKey<X, 'prev'>,
  nextKey: TLinkedKey<X, 'next'>,
  headKey: TEndpointKey<O, X, 'Head'>,
  tailKey: TEndpointKey<O, X, 'Tail'>,
): void {
  const target = node as TLinkedNode<X>;
  const endpoints = owner as TLinkedOwner<O, X>;

  if (target[prevKey] || target[nextKey] || endpoints[headKey] === target) {
    throw new Error('[appendNode]: node is already linked, unlink it before adding it again.');
  }

  const tail = endpoints[tailKey];
  if (tail) {
    tail[nextKey] = target;
  } else {
    endpoints[headKey] = target;
  }

  target[prevKey] = tail;
  endpoints[tailKey] = target;
}

export function prependNode<X extends object, O extends object>(
  node: X,
  owner: O,
  prevKey: TLinkedKey<X, 'prev'>,
  nextKey: TLinkedKey<X, 'next'>,
  headKey: TEndpointKey<O, X, 'Head'>,
  tailKey: TEndpointKey<O, X, 'Tail'>,
): void {
  const target = node as TLinkedNode<X>;
  const endpoints = owner as TLinkedOwner<O, X>;

  if (target[prevKey] || target[nextKey] || endpoints[headKey] === target) {
    throw new Error('[prependNode]: node is already linked, unlink it before adding it again.');
  }

  const head = endpoints[headKey];
  if (head) {
    head[prevKey] = target;
  } else {
    endpoints[tailKey] = target;
  }

  target[nextKey] = head;
  endpoints[headKey] = target;
}

export function buildLinkMethods<O extends object>() {
  return function build<
    H extends TEndpointKey<O, object, 'Head'> = TEndpointKey<O, object, 'Head'>,
    X extends TNodeOf<O, H> = TNodeOf<O, H>,
  >(
    headKey: H & TEndpointKey<O, X, 'Head'>,
    tailKey: TEndpointKey<O, X, 'Tail'>,
    prevKey: TLinkedKey<X, 'prev'>,
    nextKey: TLinkedKey<X, 'next'>,
  ) {
    return {
      append(node: X, owner: O) {
        return appendNode(node, owner, prevKey, nextKey, headKey, tailKey);
      },
      prepend(node: X, owner: O) {
        return prependNode(node, owner, prevKey, nextKey, headKey, tailKey);
      },
      remove(node: X, owner: O) {
        return unlink(node, owner, prevKey, nextKey, headKey, tailKey);
      },
    };
  };
}
