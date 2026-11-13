import type { IConnector } from './types';

import { BatchScope } from './batch';
import { ErrorScope } from './error';

let clock = 0;
export function getClock() {
  clock += 1;
  return clock;
}

function notifyDirtyWalk(head?: IConnector): void {
  let node = head;

  const level = ErrorScope.isActive ? null : ErrorScope.begin();
  try {
    while (node) {
      try {
        node.runnable.markDirty();
      } catch (e) {
        ErrorScope.record(e);
      }
      node = node.nextRunnable;
    }
  } finally {
    if (level !== null) {
      ErrorScope.end(level);
    }
  }
}

export function notifyDirty(head?: IConnector): void {
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
