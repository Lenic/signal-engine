import { describe, expect, test } from 'vitest';
import { Schedulable } from '../core/schedulable';

describe('Schedulable', () => {
  test('the listener sees each flip of the scheduled state', () => {
    const task = new Schedulable();
    const seen: boolean[] = [];

    task.onScheduleChange = (scheduled) => void seen.push(scheduled);
    expect(task.isScheduled).toBe(false);

    task.markScheduled();
    expect(task.isScheduled).toBe(true);

    task.clearScheduled();
    expect(task.isScheduled).toBe(false);

    expect(seen).toEqual([true, false]);
  });

  test('re-marking an already scheduled task reports nothing', () => {
    // This is what keeps one queue entry from becoming several, and what makes a task that was
    // scheduled but skipped recoverable rather than wedged.
    const task = new Schedulable();
    const seen: boolean[] = [];

    task.onScheduleChange = (scheduled) => void seen.push(scheduled);

    task.markScheduled();
    task.markScheduled();
    task.markScheduled();
    expect(seen).toEqual([true]);

    task.clearScheduled();
    task.clearScheduled();
    expect(seen).toEqual([true, false]);
  });

  test('a task with no listener still tracks its own state', () => {
    const task = new Schedulable();

    expect(() => task.markScheduled()).not.toThrow();
    expect(task.isScheduled).toBe(true);

    task.clearScheduled();
    expect(task.isScheduled).toBe(false);
  });

  test('clearing the listener stops the notifications', () => {
    const task = new Schedulable();
    const seen: boolean[] = [];

    task.onScheduleChange = (scheduled) => void seen.push(scheduled);
    task.markScheduled();

    task.onScheduleChange = null;
    task.clearScheduled();

    expect(seen).toEqual([true]);
  });

  test('a disposed task drops its listener and stops reporting', () => {
    const task = new Schedulable();
    const seen: boolean[] = [];

    task.onScheduleChange = (scheduled) => void seen.push(scheduled);
    task.dispose();

    expect(task.onScheduleChange).toBeNull();

    task.markScheduled();
    expect(seen).toEqual([]);
  });
});
