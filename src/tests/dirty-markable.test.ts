import { describe, expect, test } from 'vitest';
import { DirtyMarkable } from '../core/dirty-markable';
import { VersionFollower } from '../core/version-follower';

describe('DirtyMarkable', () => {
  test('marking dirty notifies the listener once, and staying dirty notifies nobody', () => {
    const markable = new DirtyMarkable(false);
    let notified = 0;

    markable.onDirty = () => void notified++;
    expect(markable.isDirty).toBe(false);
    expect(notified).toBe(0);

    markable.markDirty();
    expect(markable.isDirty).toBe(true);
    expect(notified).toBe(1);

    // Already dirty - there is no new edge to report.
    markable.markDirty();
    expect(notified).toBe(1);
  });

  test('an object with no listener still tracks its own state', () => {
    const markable = new DirtyMarkable(false);

    expect(() => markable.markDirty()).not.toThrow();
    expect(markable.isDirty).toBe(true);
  });

  test('clearing the listener stops the notifications', () => {
    const follower = new VersionFollower();
    let notified = 0;

    follower.onDirty = () => void notified++;
    follower.markDirty();
    expect(notified).toBe(1);

    follower.onDirty = null;
    follower.clearDirty();
    follower.markDirty();

    expect(follower.isDirty).toBe(true);
    expect(notified).toBe(1);
  });

  test('disposal drops the listener', () => {
    const markable = new DirtyMarkable(false);

    markable.onDirty = () => {};
    markable.dispose();

    expect(markable.onDirty).toBeNull();
  });

  test('clearDirty lets the next mark report a fresh edge', () => {
    const follower = new VersionFollower();
    let notified = 0;

    follower.onDirty = () => void notified++;

    follower.markDirty();
    expect(notified).toBe(1);

    follower.clearDirty();
    expect(follower.isDirty).toBe(false);
    // Clearing is not itself an event - only the next transition into dirty is.
    expect(notified).toBe(1);

    follower.markDirty();
    expect(notified).toBe(2);
  });

  test('a follower can start out dirty', () => {
    const follower = new VersionFollower({ isDirty: true });

    expect(follower.isDirty).toBe(true);
  });
});
