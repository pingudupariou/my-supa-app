import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar, Clock, MapPin, Trash2, CheckCircle2, Filter } from 'lucide-react';
import { CrmMeeting } from '@/hooks/useCRMData';
import { cn } from '@/lib/utils';

interface CrmCalendarRecapProps {
  meetings: CrmMeeting[];
  clients: { id: string; company_name: string }[];
  onDelete: (id: string) => Promise<boolean>;
  onSelectClient?: (id: string) => void;
  onSwitchToGestion?: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; dot: string }> = {
  planned: { label: 'Planifié', variant: 'outline', dot: 'bg-blue-500' },
  completed: { label: 'Réalisé', variant: 'default', dot: 'bg-emerald-500' },
  cancelled: { label: 'Annulé', variant: 'destructive', dot: 'bg-destructive' },
};

export function CrmCalendarRecap({ meetings, clients, onDelete, onSelectClient, onSwitchToGestion }: CrmCalendarRecapProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = meetings
    .filter(m => statusFilter === 'all' || m.status === statusFilter)
    .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());

  const plannedCount = meetings.filter(m => m.status === 'planned').length;
  const completedCount = meetings.filter(m => m.status === 'completed').length;
  const cancelledCount = meetings.filter(m => m.status === 'cancelled').length;

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    await onDelete(confirmDeleteId);
    setConfirmDeleteId(null);
  };

  const meetingToDelete = meetings.find(m => m.id === confirmDeleteId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendrier des RDV
          </CardTitle>
          <div className="flex items-center gap-3">
            {/* Summary badges */}
            <div className="flex gap-1.5">
              <Badge variant="outline" className="text-xs gap-1.5 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'planned' ? 'all' : 'planned')}>
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Planifiés ({plannedCount})
              </Badge>
              <Badge variant="outline" className="text-xs gap-1.5 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Réalisés ({completedCount})
              </Badge>
              {cancelledCount > 0 && (
                <Badge variant="outline" className="text-xs gap-1.5 cursor-pointer" onClick={() => setStatusFilter(statusFilter === 'cancelled' ? 'all' : 'cancelled')}>
                  <span className="h-2 w-2 rounded-full bg-destructive" />
                  Annulés ({cancelledCount})
                </Badge>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-8 text-sm">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous ({meetings.length})</SelectItem>
                <SelectItem value="planned">📅 Planifiés ({plannedCount})</SelectItem>
                <SelectItem value="completed">✅ Réalisés ({completedCount})</SelectItem>
                <SelectItem value="cancelled">❌ Annulés ({cancelledCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Aucun RDV trouvé</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(m => {
              const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.planned;
              const client = clients.find(c => c.id === m.customer_id);
              const date = new Date(m.meeting_date);
              const isPast = date < new Date();

              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-start justify-between p-3 rounded-lg border transition-colors",
                    m.status === 'completed' ? 'bg-muted/20' : m.status === 'cancelled' ? 'bg-destructive/5 opacity-60' : isPast ? 'bg-amber-500/5 border-amber-500/20' : 'bg-background'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", st.dot)} />
                      <span className="font-medium text-sm truncate">{m.title}</span>
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        {' '}
                        {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {m.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />{m.duration_minutes}min
                        </span>
                      )}
                      {m.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{m.location}
                        </span>
                      )}
                      {client && (
                        <button
                          className="text-primary hover:underline cursor-pointer font-medium"
                          onClick={() => {
                            onSelectClient?.(client.id);
                            onSwitchToGestion?.();
                          }}
                        >
                          {client.company_name}
                        </button>
                      )}
                    </div>
                    {m.notes && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 italic">{m.notes}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    title="Supprimer"
                    onClick={() => setConfirmDeleteId(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce RDV ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le RDV <strong>{meetingToDelete?.title}</strong> sera envoyé à la corbeille.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
