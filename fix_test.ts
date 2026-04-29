import { DepList, DepNode } from './src/lib/linked-list';
import { activeEffect, runWithEffect } from './src/lib/runtime';

export class ReactiveEffect {
  fn: () => void;
  deps: DepNode[] = [];
  children: ReactiveEffect[] = [];
  parent: ReactiveEffect | null = null;
  active = true;

  constructor(fn: () => void) {
    this.fn = fn;
  }

  run() {
    if (!this.active) return;
    cleanupEffect(this);
    runWithEffect(this, () => {
      this.fn();
    });
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    cleanupEffect(this);
  }
}

export function cleanupEffect(effect: ReactiveEffect) {
  for (const node of effect.deps) {
    node.depList?.remove(node);
  }
  effect.deps.length = 0;

  for (const child of effect.children) {
    child.stop();
  }
  effect.children.length = 0;
}

export function track(depList: DepList) {
  if (!activeEffect) return;
  const node = new DepNode(activeEffect, depList);
  depList.add(node);
  activeEffect.deps.push(node);
}

export function trigger(depList: DepList) {
  // wait we need to slice or not?
  const subs = [];
  depList.forEach(node => subs.push(node.subscriber));
  for (const sub of subs) {
    sub.run();
  }
}

export function effect(fn: () => void) {
  const e = new ReactiveEffect(fn);
  if (activeEffect) {
    e.parent = activeEffect;
    activeEffect.children.push(e);
  }
  e.run();
  return () => e.stop();
}
