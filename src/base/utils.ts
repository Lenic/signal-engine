import type { IConnector, TMarkableDirtyType } from './types';

import { BatchScope } from './batch';
import { DIRTY_TYPE_UNCHECKED } from './types';

let clock = 0;
export function getClock() {
  clock += 1;
  return clock;
}

const stack: IConnector[] = [];

function notifyDirtyWalk(head: IConnector | undefined, dirtyType: TMarkableDirtyType): void {
  const baseLength = stack.length;
  for (let item: IConnector | undefined = head; item; item = item.nextRunnable) {
    let inner = item.runnable.markDirty(dirtyType);

    while (inner) {
      const next = inner.nextRunnable;
      const child = inner.runnable.markDirty(DIRTY_TYPE_UNCHECKED);
      if (child) {
        if (next) stack.push(next);
        inner = child;
      } else {
        inner = next;

        if (!inner && stack.length > baseLength) {
          inner = stack.pop();
        }
      }
    }
  }
}

export function notifyDirty(head: IConnector | undefined, dirtyType: TMarkableDirtyType): void {
  if (!head) return;

  if (BatchScope.isBatching) {
    notifyDirtyWalk(head, dirtyType);
    return;
  }

  const level = BatchScope.begin();
  try {
    notifyDirtyWalk(head, dirtyType);
  } finally {
    BatchScope.end(level);
  }
}
