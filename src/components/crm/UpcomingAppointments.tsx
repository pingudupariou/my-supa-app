import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';

interface UpcomingAppointmentsProps {
  appointments: any[];
  customers: any[];
  onRefresh: () => void;
}

export function UpcomingAppointments({ appointments, customers }: UpcomingAppointmentsProps) {
  const upcoming = appointments
    .filter((a: any) => !a.is_completed && new Date(a.appointment_date) >= new Date())
    .slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Rendez-vous à venir
        </CardTitle>
      </CardHeader>
      <CardContent>
        {upcoming.length === 0 && <p className="text-muted-foreground text-center py-4">Aucun rendez-vous planifié</p>}
        <div className="space-y-2">
          {upcoming.map((apt: any) => {
            const customer = customers.find((c: any) => c.id === apt.customer_id);
            return (
              <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{apt.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {customer?.company_name} • {new Date(apt.appointment_date).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                {apt.location && <Badge variant="outline" className="text-xs">{apt.location}</Badge>}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
