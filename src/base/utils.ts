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
  let node = head;
  if (!node) return;

  let nextDirtyType = dirtyType;
  const baseLength = stack.length;
  while (true) {
    while (node) {
      const next = node.nextRunnable;
      const child = node.runnable.markDirty(nextDirtyType);
      nextDirtyType = DIRTY_TYPE_UNCHECKED;
      if (child) {
        if (next) {
          stack.push(next);
        }
        node = child;
      } else {
        node = next;
      }
    }

    if (stack.length === baseLength) break;
    node = stack.pop();
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
