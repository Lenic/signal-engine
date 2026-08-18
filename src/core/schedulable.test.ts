import { describe, expect, test } from 'vitest';
import { Schedulable } from './schedulable';

describe('Schedulable', () => {
  test('the listener sees each flip of the scheduled state', () => {
    const task = new Schedulable();
    const seen: boolean[] = [];

    task.onScheduleChange((scheduled) => seen.push(scheduled));
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

    task.onScheduleChange((scheduled) => seen.push(scheduled));

    task.markScheduled();
    task.markScheduled();
    task.markScheduled();
    expect(seen).toEqual([true]);

    task.clearScheduled();
    task.clearScheduled();
    expect(seen).toEqual([true, false]);
  });

  test('a second listener is refused rather than silently replacing the first', () => {
    const task = new Schedulable('flush');
    const seen: boolean[] = [];

    task.onScheduleChange((scheduled) => seen.push(scheduled));

    expect(() => task.onScheduleChange(() => {})).toThrow('flush');

    task.markScheduled();
    expect(seen).toEqual([true]);
  });

  test('unsubscribing frees the slot for a new listener', () => {
    const task = new Schedulable();
    const first: boolean[] = [];
    const second: boolean[] = [];

    const unsubscribe = task.onScheduleChange((scheduled) => first.push(scheduled));
    unsubscribe();

    expect(() => task.onScheduleChange((scheduled) => second.push(scheduled))).not.toThrow();

    task.markScheduled();
    expect(first).toEqual([]);
    expect(second).toEqual([true]);
  });

  test('a disposed task stops reporting', () => {
    const task = new Schedulable();
    const seen: boolean[] = [];

    task.onScheduleChange((scheduled) => seen.push(scheduled));
    task.dispose();

    task.markScheduled();
    expect(seen).toEqual([]);
  });
});
