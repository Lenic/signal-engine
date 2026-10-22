import type { ILinkedList } from '../utils';

import type { IAction } from './types';

import { BatchScope, ErrorScope } from '../utils';

export function notifyListeners<T>(
  list: ILinkedList<T> | undefined,
  action: IAction<[T]> | null,
  withCleanup: boolean = false,
): void {
  let node = list?.head;
  if (!node) return;

  const batchContext = BatchScope.begin();
  const errorContext = ErrorScope.begin();
  while (node) {
    try {
      action?.(node.value);
    } catch (e) {
      errorContext.push(e);
    }
    if (withCleanup) {
      node.removeSelf();
      node = list?.head;
    } else {
      node = node.next;
    }
  }
  try {
    ErrorScope.end(errorContext);
  } finally {
    BatchScope.end(batchContext);
  }
}
