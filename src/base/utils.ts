import type { ILinkedList, ILinkedNode } from '../utils';

import type { IAction, IDirtyMarkable } from './types';

import { BatchScope } from './batch';
import { ErrorScope } from './error';

let clock = 0;
export function getClock() {
  clock += 1;
  return clock;
}

export function notifyListeners<T>(list: ILinkedList<T> | undefined, action: IAction<[T]> | null): void {
  let node = list?.head;
  if (!node) return;

  const batchLevel = BatchScope.isBatching ? null : BatchScope.begin();
  // Join an enclosing scope instead of nesting one: a nested scope would end by throwing its
  // private abort signal into whatever user code called dispose() inside an effect.
  const errorLevel = ErrorScope.isActive ? null : ErrorScope.begin();

  while (node) {
    try {
      action?.(node.value);
    } catch (e) {
      ErrorScope.record(e);
    }

    node.removeSelf();
    node = list?.head;
  }

  try {
    if (errorLevel !== null) {
      ErrorScope.end(errorLevel);
    }
  } finally {
    if (batchLevel !== null) {
      BatchScope.end(batchLevel);
    }
  }
}

function notifyDirtyWalk(head: ILinkedNode<IDirtyMarkable>): void {
  let node: ILinkedNode<IDirtyMarkable> | null = head;

  const level = ErrorScope.isActive ? null : ErrorScope.begin();
  try {
    while (node) {
      try {
        node.value.markDirty();
      } catch (e) {
        ErrorScope.record(e);
      }
      node = node.next;
    }
  } finally {
    if (level !== null) {
      ErrorScope.end(level);
    }
  }
}

/**
 * notifyListeners() specialised for the hottest caller: a write marking its readers dirty.
 *
 * Marking dirty runs no user code -- memos only flip a flag and effects only queue themselves,
 * since the walk always runs inside a batch -- so it skips the error scope that notifyListeners()
 * opens per call. Errors are collected only when something actually throws.
 */
export function notifyDirty(list: ILinkedList<IDirtyMarkable> | undefined): void {
  const head = list?.head;
  if (!head) return;

  if (BatchScope.isBatching) {
    notifyDirtyWalk(head);
    return;
  }

  const level = BatchScope.begin();
  try {
    notifyDirtyWalk(head);
  } finally {
    BatchScope.end(level);
  }
}
