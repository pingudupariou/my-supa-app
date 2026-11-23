export interface IcsItem { uid: string; title: string; date: string; description?: string | null; allDay?: boolean; durationMin?: number }

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, m => '\\' + m);
const pad = (n: number) => String(n).padStart(2, '0');
const stampUtc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

/** Builds an iCalendar file that Outlook, Google Agenda and Apple Calendar can import. */
export function buildIcs(items: IcsItem[], now = new Date()): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NOVARIDE//CRM//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const it of items) {
    lines.push('BEGIN:VEVENT', `UID:${it.uid}@novaride-crm`, `DTSTAMP:${stampUtc(now)}`);
    if (it.allDay) {
      const [y, m, d] = it.date.slice(0, 10).split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 1));
      lines.push(`DTSTART;VALUE=DATE:${y}${pad(m)}${pad(d)}`, `DTEND;VALUE=DATE:${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}`);
    } else {
      const s = new Date(it.date);
      lines.push(`DTSTART:${stampUtc(s)}`, `DTEND:${stampUtc(new Date(s.getTime() + (it.durationMin ?? 60) * 60000))}`);
    }
    lines.push(`SUMMARY:${esc(it.title)}`);
    if (it.description) lines.push(`DESCRIPTION:${esc(it.description)}`);
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(it.title)}`, 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadIcs(items: IcsItem[], filename: string) {
  const blob = new Blob([buildIcs(items)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
