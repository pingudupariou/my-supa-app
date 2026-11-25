import { describe, expect, it } from 'vitest';
import { reminderQueue } from './reminderQueue';
import type { CrmReminder } from '@/hooks/useCRMData';

const r = (id: string, due: string, done = false) => ({ id, due_date: due, is_completed: done, completed_at: done ? '2026-11-20T10:00:00Z' : null, updated_at: '' }) as unknown as CrmReminder;

describe('file des relances', () => {
  const list = [r('a', '2026-11-10'), r('b', '2026-11-25'), r('c', '2026-11-26'), r('d', '2026-11-01', true)];
  it('liste les non traitées antérieures ou égales à la date choisie', () => {
    expect(reminderQueue(list, '2026-11-25').pending.map(x => x.id)).toEqual(['a', 'b']);
  });
  it('une relance cochée quitte la liste mais reste dans les traitées', () => {
    const q = reminderQueue(list, '2026-12-31');
    expect(q.pending.map(x => x.id)).not.toContain('d');
    expect(q.done.map(x => x.id)).toEqual(['d']);
  });
  it('compte les relances futures', () => {
    expect(reminderQueue(list, '2026-11-25').later).toBe(1);
  });
});
