import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Phone, Mail, Calendar, StickyNote, Search, ArrowUpDown, ChevronRight, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Interaction {
  id: string;
  customer_id: string;
  subject: string;
  content?: string | null;
  interaction_type: string;
  interaction_date: string;
  created_at: string;
}

interface Meeting {
  id: string;
  customer_id: string;
  title: string;
  notes?: string | null;
  meeting_date: string;
  status: string;
}

interface Client {
  id: string;
  company_name: string;
}

interface Props {
  interactions: Interaction[];
  meetings: Meeting[];
  clients: Client[];
  onSelectClient: (id: string) => void;
  onSwitchToGestion: () => void;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; borderColor: string; bgColor: string }> = {
  call: { icon: Phone, label: 'Appel', borderColor: 'border-l-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  email: { icon: Mail, label: 'Email', borderColor: 'border-l-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20' },
  meeting: { icon: Calendar, label: 'RDV', borderColor: 'border-l-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/20' },
  note: { icon: StickyNote, label: 'Note', borderColor: 'border-l-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-950/20' },
  rdv: { icon: Calendar, label: 'Réunion', borderColor: 'border-l-violet-500', bgColor: 'bg-violet-50 dark:bg-violet-950/20' },
};

export function CrmHistoryTimeline({ interactions, meetings, clients, onSelectClient, onSwitchToGestion }: Props) {
  const [search, setSearch] = useState('');
  const [ascending, setAscending] = useState(false);

  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach(c => { map[c.id] = c.company_name; });
    return map;
  }, [clients]);

  // Merge interactions + meetings into unified timeline
  const allEntries = useMemo(() => {
    const fromInteractions = interactions.map(i => ({
      id: i.id,
      customerId: i.customer_id,
      clientName: clientMap[i.customer_id] || 'Client inconnu',
      title: i.subject,
      content: i.content || '',
      type: i.interaction_type,
      date: i.interaction_date,
      source: 'interaction' as const,
    }));

    const fromMeetings = meetings.map(m => ({
      id: m.id,
      customerId: m.customer_id,
      clientName: clientMap[m.customer_id] || 'Client inconnu',
      title: m.title || 'Réunion',
      content: m.notes || '',
      type: 'rdv',
      date: m.meeting_date,
      source: 'meeting' as const,
    }));

    return [...fromInteractions, ...fromMeetings];
  }, [interactions, meetings, clientMap]);

  const filtered = useMemo(() => {
    let list = allEntries;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.clientName.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
      return ascending ? -diff : diff;
    });
    return list;
  }, [allEntries, search, ascending]);

  const handleClick = (customerId: string) => {
    onSelectClient(customerId);
    onSwitchToGestion();
  };

  return (
    <div className="space-y-4">
      {/* Search & sort bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher dans l'historique…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAscending(!ascending)}
          className="h-9 gap-1.5 text-xs shrink-0"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {ascending ? 'Plus ancien' : 'Plus récent'}
        </Button>
      </div>

      {/* Counter */}
      <p className="text-xs text-muted-foreground">
        {filtered.length} entrée{filtered.length !== 1 ? 's' : ''} trouvée{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <StickyNote className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucune note ou réunion dans l'historique</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(entry => {
            const cfg = TYPE_CONFIG[entry.type] || TYPE_CONFIG.note;
            const Icon = cfg.icon;
            const dateObj = new Date(entry.date);

            return (
              <button
                key={`${entry.source}-${entry.id}`}
                onClick={() => handleClick(entry.customerId)}
                className={cn(
                  "w-full text-left rounded-lg border border-l-4 p-3 transition-all hover:shadow-md hover:scale-[1.005] cursor-pointer group",
                  cfg.borderColor,
                  cfg.bgColor,
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="mt-0.5 shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-medium text-sm truncate">{entry.title}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">{cfg.label}</Badge>
                      </div>
                      {entry.content && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{entry.content}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                          <User className="h-3 w-3" />
                          {entry.clientName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {dateObj.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          {formatDistanceToNow(dateObj, { addSuffix: true, locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
