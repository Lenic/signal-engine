import { describe, expect, test } from 'vitest';
import { DirtyMarkable } from './dirty-markable';
import { VersionFollower } from './version-follower';

describe('DirtyMarkable', () => {
  test('marking dirty notifies the listener once, and staying dirty notifies nobody', () => {
    const markable = new DirtyMarkable(false);
    let notified = 0;

    markable.onDirty(() => void notified++);
    expect(markable.isDirty).toBe(false);
    expect(notified).toBe(0);

    markable.markDirty();
    expect(markable.isDirty).toBe(true);
    expect(notified).toBe(1);

    // Already dirty - there is no new edge to report.
    markable.markDirty();
    expect(notified).toBe(1);
  });

  test('a listener registered on an already-dirty object fires immediately', () => {
    const markable = new DirtyMarkable(true);
    let notified = 0;

    markable.onDirty(() => void notified++);
    expect(notified).toBe(1);
  });

  test('a second listener is refused rather than silently replacing the first', () => {
    const markable = new DirtyMarkable(false);
    let first = 0;

    markable.onDirty(() => void first++);

    expect(() => markable.onDirty(() => {})).toThrow('already has a dirty listener');

    // The original is still the one that gets told.
    markable.markDirty();
    expect(first).toBe(1);
  });

  test('unsubscribing frees the slot for a new listener', () => {
    const markable = new DirtyMarkable(false);
    let first = 0;
    let second = 0;

    const unsubscribe = markable.onDirty(() => void first++);
    unsubscribe();

    expect(() => markable.onDirty(() => void second++)).not.toThrow();

    markable.markDirty();
    expect(first).toBe(0);
    expect(second).toBe(1);
  });

  test('the error names the object when it has one', () => {
    const markable = new DirtyMarkable(false, 'counter');

    markable.onDirty(() => {});
    expect(() => markable.onDirty(() => {})).toThrow('counter');
  });

  test('clearDirty lets the next mark report a fresh edge', () => {
    const follower = new VersionFollower();
    let notified = 0;

    follower.onDirty(() => void notified++);

    follower.markDirty();
    expect(notified).toBe(1);

    follower.clearDirty();
    expect(follower.isDirty).toBe(false);
    // Clearing is not itself an event - only the next transition into dirty is.
    expect(notified).toBe(1);

    follower.markDirty();
    expect(notified).toBe(2);
  });
});
