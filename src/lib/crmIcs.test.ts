import { describe, it, expect } from 'vitest';
import { buildIcs } from './crmIcs';

describe('buildIcs', () => {
  it('writes an all-day reminder ending the next day', () => {
    const ics = buildIcs([{ uid: 'r1', title: 'Relance devis', date: '2026-12-31', allDay: true }]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261231');
    expect(ics).toContain('DTEND;VALUE=DATE:20270101');
  });
  it('escapes commas and line breaks in text', () => {
    const ics = buildIcs([{ uid: 'r2', title: 'A, B', date: '2026-12-01', allDay: true, description: 'l1\nl2' }]);
    expect(ics).toContain('SUMMARY:A\\, B');
    expect(ics).toContain('DESCRIPTION:l1\\nl2');
  });
});
