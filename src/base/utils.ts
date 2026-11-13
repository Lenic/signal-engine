import type { IConnector } from './types';

import { BatchScope } from './batch';

let clock = 0;
export function getClock() {
  clock += 1;
  return clock;
}

const stack: IConnector[] = [];

function notifyDirtyWalk(head?: IConnector): void {
  let node = head;
  if (!node) return;

  const baseLength = stack.length;
  while (true) {
    while (node) {
      const next = node.nextRunnable;
      const child = node.runnable.markDirty();
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
