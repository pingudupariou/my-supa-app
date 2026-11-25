import type { CrmReminder } from '@/hooks/useCRMData';

/** Relances à traiter jusqu'à une date (incluse), plus anciennes d'abord ; et relances déjà traitées. */
export function reminderQueue(reminders: CrmReminder[], asOf: string) {
  const day = (r: CrmReminder) => r.due_date.slice(0, 10);
  const pending = reminders.filter(r => !r.is_completed && day(r) <= asOf)
    .sort((a, b) => day(a).localeCompare(day(b)));
  const done = reminders.filter(r => r.is_completed)
    .sort((a, b) => (b.completed_at ?? b.updated_at ?? '').localeCompare(a.completed_at ?? a.updated_at ?? ''));
  const later = reminders.filter(r => !r.is_completed && day(r) > asOf).length;
  return { pending, done, later };
}
