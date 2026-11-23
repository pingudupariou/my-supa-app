import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BellPlus, Download } from 'lucide-react';
import { CrmMeeting, REMINDER_TYPES } from '@/hooks/useCRMData';
import { downloadIcs } from '@/lib/crmIcs';

/** Schedules a follow-up action on another date directly from a meeting note. */
export function MeetingReminderForm({ meeting, actionText, onCreate }: { meeting: CrmMeeting; actionText: string; onCreate: (r: any) => Promise<any> }) {
  const inAWeek = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const firstAction = actionText.split('\n').map(l => l.replace(/^[\s•\-*]+/, '').trim()).find(Boolean) ?? '';
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(inAWeek);
  const [type, setType] = useState('follow_up');
  const [priority, setPriority] = useState('moyenne');
  const [last, setLast] = useState<{ id: string; title: string; date: string } | null>(null);

  const submit = async () => {
    const t = (title || firstAction || `Suite RDV : ${meeting.title}`).trim();
    const r = await onCreate({
      customer_id: meeting.customer_id, title: t, due_date: date, reminder_type: type, priority,
      description: `Suite au RDV « ${meeting.title} » du ${new Date(meeting.meeting_date).toLocaleDateString('fr-FR')}${actionText ? '\n' + actionText : ''}`,
    });
    if (r) { setLast({ id: r.id, title: t, date }); setTitle(''); setOpen(false); }
  };

  return (
    <div className="rounded-md border border-dashed p-2 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button size="sm" variant={open ? 'secondary' : 'outline'} className="h-7 text-xs" onClick={() => setOpen(!open)}>
          <BellPlus className="h-3.5 w-3.5 mr-1" /> Programmer un rappel d'action
        </Button>
        {last && (
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => downloadIcs([{ uid: `rem-${last.id}`, title: last.title, date: last.date, allDay: true }], 'rappel.ics')}>
            <Download className="h-3 w-3 mr-1" /> Ajouter à Outlook
          </Button>
        )}
      </div>
      {open && (
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto] items-center">
          <Input className="h-8 text-sm" placeholder={firstAction || 'Action à faire'} value={title} onChange={e => setTitle(e.target.value)} />
          <Input className="h-8 text-sm" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-8 text-sm w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>{REMINDER_TYPES.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-8 text-sm w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="haute">Haute</SelectItem><SelectItem value="moyenne">Moyenne</SelectItem><SelectItem value="basse">Basse</SelectItem></SelectContent>
          </Select>
          <Button size="sm" className="h-8" onClick={submit} disabled={!date}>Programmer</Button>
        </div>
      )}
    </div>
  );
}
