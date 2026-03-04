import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Bell, CheckCircle2 } from 'lucide-react';
import { CrmReminder } from '@/hooks/useCRMData';

interface ReminderBannerProps {
  reminders: CrmReminder[];
  customers: { id: string; company_name: string }[];
}

export function ReminderBanner({ reminders, customers }: ReminderBannerProps) {
  const today = new Date().toISOString().slice(0, 10);

  const { overdue, dueToday, upcoming } = useMemo(() => {
    const pending = reminders.filter(r => !r.is_completed);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);
    const upcomingDate = tomorrow.toISOString().slice(0, 10);
    return {
      overdue: pending.filter(r => r.due_date < today),
      dueToday: pending.filter(r => r.due_date === today),
      upcoming: pending.filter(r => r.due_date > today && r.due_date <= upcomingDate),
    };
  }, [reminders, today]);

  if (overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0) return null;

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4" />
        Rappels
      </div>
      <div className="flex flex-wrap gap-2">
        {overdue.length > 0 && (
          <Badge variant="destructive" className="text-xs flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {overdue.length} en retard
          </Badge>
        )}
        {dueToday.length > 0 && (
          <Badge className="text-xs bg-amber-500/10 text-amber-700 border-amber-500/30 flex items-center gap-1">
            <Bell className="h-3 w-3" />
            {dueToday.length} aujourd'hui
          </Badge>
        )}
        {upcoming.length > 0 && (
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {upcoming.length} dans les 3 jours
          </Badge>
        )}
      </div>

      {/* Show overdue + today details */}
      {(overdue.length > 0 || dueToday.length > 0) && (
        <div className="space-y-1 mt-1">
          {[...overdue, ...dueToday].slice(0, 5).map(r => {
            const customerName = customers.find(c => c.id === r.customer_id)?.company_name;
            const isOverdue = r.due_date < today;
            return (
              <div key={r.id} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                <div className="flex items-center gap-2">
                  {isOverdue ? <AlertTriangle className="h-3 w-3 text-destructive shrink-0" /> : <Bell className="h-3 w-3 text-amber-600 shrink-0" />}
                  <span className="font-medium">{r.title}</span>
                  {customerName && <span className="text-muted-foreground">— {customerName}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.assigned_to && <span className="text-muted-foreground">{r.assigned_to}</span>}
                  <span className={isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                    {new Date(r.due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
