import type { IBatchSnapshot, IConnectible, IEffectAction, IEffectOwner, IRunnable } from './types';

import { BatchScope } from './batch';
import { Connector } from './connector';
import { ErrorScope } from './error';
import { SignalValue } from './signal';

const MAX_ITERATION_DEPTH = 100;

let batchSnapshotHead: IBatchSnapshot | undefined = undefined;
let batchSnapshotTail: IBatchSnapshot | undefined = undefined;

function restoreFromBatch() {
  for (let node = batchSnapshotHead; node; node = batchSnapshotHead) {
    batchSnapshotHead = node.next;
    node.next = undefined;

    SignalValue.restoreFromBatch(node);
  }

  batchSnapshotTail = undefined;
}

let effectHead: IEffectAction | undefined = undefined;
let effectTail: IEffectAction | undefined = undefined;

function clearEffectList() {
  for (let node = effectHead; node; node = effectHead) {
    effectHead = node.nextEffect;
    node.nextEffect = undefined;

    node.isEnqueued = false;
  }

  effectTail = undefined;
}

function flushEffectList() {
  let iterationLevel = 0;
  while (effectHead) {
    if (iterationLevel > MAX_ITERATION_DEPTH) {
      clearEffectList();

      throw new Error('[ConsumeTail]: more than the max iteration.');
    }
    iterationLevel += 1;

    let head: IEffectAction | undefined = effectHead;
    effectHead = undefined;
    effectTail = undefined;

    const errorLevel = ErrorScope.begin();
    try {
      while (head) {
        const effect = head;
        effect.isEnqueued = false;

        const next = effect.nextEffect;
        head.nextEffect = undefined;
        head = next;

        if (effect.isDisposed) continue;
        try {
          effect.run();
        } catch (e) {
          ErrorScope.record(e);
        }
      }
    } finally {
      if (batchSnapshotHead) restoreFromBatch();

      if (ErrorScope.hasError) {
        clearEffectList();
      }
      ErrorScope.end(errorLevel);
    }
  }
}

export const globalContext = {
  activeOwner: undefined as IEffectOwner | undefined,
  enqueueBatchSnapshot(snapshot: IBatchSnapshot) {
    if (batchSnapshotTail) {
      batchSnapshotTail.next = snapshot;
      batchSnapshotTail = snapshot;
    } else {
      batchSnapshotHead = batchSnapshotTail = snapshot;
    }
  },
  activeEffect: undefined as IRunnable | undefined,
  enqueueToEffectList(effect: IEffectAction) {
    if (effectTail) {
      effectTail.nextEffect = effect;
      effectTail = effect;
    } else {
      effectHead = effectTail = effect;
    }
  },
  track(source: IConnectible, sourceVersion: number): void {
    const effect = this.activeEffect;
    if (effect === undefined || effect.isDisposed) return;

    const runId = effect.runId;
    const current = effect.connectibleCurrent;

    if (source.lastRunnable === effect && source.lastRunId === runId) return;

    if (!current) {
      new Connector(source, effect, sourceVersion);
      effect.connectibleCurrent = undefined;
    } else {
      if (source === current.connectible) {
        current.connectibleVersion = sourceVersion;
      } else {
        current.updateConnectible(source, sourceVersion);
      }
      effect.connectibleCurrent = current.nextConnectible;
    }

    source.lastRunnable = effect;
    source.lastRunId = runId;
  },
  untracked<T>(fn: () => T) {
    const previousActiveEffect = this.activeEffect;
    const previousActiveOwner = this.activeOwner;
    this.activeEffect = undefined;
    this.activeOwner = undefined;
    try {
      return fn();
    } finally {
      this.activeEffect = previousActiveEffect;
      this.activeOwner = previousActiveOwner;
    }
  },
};

let isConsuming = false;
function consumeTail() {
  if (batchSnapshotHead) restoreFromBatch();

  if (isConsuming) return;
  isConsuming = true;

  try {
    flushEffectList();
  } finally {
    if (batchSnapshotHead) {
      restoreFromBatch();
      clearEffectList();
    }

    isConsuming = false;
  }
}
BatchScope.onBeforeExit = consumeTail;
