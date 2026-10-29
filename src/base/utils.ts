import type { ILinkedList } from '../utils';

import type { IAction, IDirtyMarkable } from './types';

import { BatchScope } from '../utils';

import { ErrorScope } from './error-scope';

let clock = 0;
export function getClock() {
  clock += 1;
  return clock;
}

export function notifyListeners<T>(
  list: ILinkedList<T> | undefined,
  action: IAction<[T]> | null,
  withCleanup: boolean = false,
): void {
  let node = list?.head;
  if (!node) return;

  // Dirty marking recurses once per memo, so only the outermost call opens scopes. A nested
  // BatchScope would exit without flushing, and a nested ErrorScope would only record and abort -
  // both are reproduced here without spending a depth level per node.
  const batchContext = BatchScope.isBatching ? undefined : BatchScope.begin();
  const errorLevel = ErrorScope.begin();
  while (node) {
    try {
      action?.(node.value);
    } catch (e) {
      ErrorScope.record(e);
    }
    if (withCleanup) {
      node.removeSelf();
      node = list?.head;
    } else {
      node = node.next;
    }
  }
  try {
    ErrorScope.end(errorLevel);
  } finally {
    if (batchContext) BatchScope.end(batchContext);
  }
}

function setDirty(instance: IDirtyMarkable) {
  instance.markDirty();
}
/**
 * notifyListeners() specialised for the hottest caller: a write marking its readers dirty. Calling
 * markDirty() directly keeps this call site to the two reader classes, where the generic one also
 * sees dispose and cleanup callbacks and stops being inlined.
 */
export function markListenersDirty(list: ILinkedList<IDirtyMarkable> | undefined): void {
  return notifyListeners(list, setDirty);
}
