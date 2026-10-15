import type { ILinkedList, ILinkedNode } from '../utils';

import type { IDirtyMarkable } from './types';

import { BatchScope, ErrorScope, LinkedList } from '../utils';

/** @internal */
export interface IChangeListenHost {
  _listeners?: ILinkedList<IDirtyMarkable>;
}

export function addChangeListener(host: IChangeListenHost, listener: IDirtyMarkable): ILinkedNode<IDirtyMarkable> {
  if (!host._listeners) {
    host._listeners = new LinkedList<IDirtyMarkable>();
  }
  return host._listeners.append(listener);
}

export function notifyListeners(host: IChangeListenHost): void {
  let node = host._listeners?.head;
  if (!node) return;

  const ctx = ErrorScope.begin();
  const batchContext = BatchScope.begin();
  while (node) {
    try {
      node.value.markDirty();
    } catch (e) {
      ctx.push(e);
    }
    node = node.next;
  }
  BatchScope.end(batchContext);
  ErrorScope.end(ctx);
}
