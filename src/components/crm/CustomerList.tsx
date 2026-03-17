import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, Search, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { B2BClient } from '@/hooks/useB2BClientsData';
import { CrmMeeting } from '@/hooks/useCRMData';

interface CustomerListProps {
  clients: B2BClient[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRefresh: () => void;
  meetings?: CrmMeeting[];
}

export function CustomerList({ clients, selectedId, onSelect, onRefresh, meetings = [] }: CustomerListProps) {
  const [search, setSearch] = useState('');
  const [showLastNote, setShowLastNote] = useState(false);

  const filtered = clients.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.country || '').toLowerCase().includes(search.toLowerCase())
  );

  // Map client id -> last meeting with notes
  const lastMeetingNotes = useMemo(() => {
    const map: Record<string, string> = {};
    if (!showLastNote) return map;
    for (const client of clients) {
      const clientMeetings = meetings
        .filter(m => m.customer_id === client.id && m.notes && m.notes.trim().length > 0)
        .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
      if (clientMeetings.length > 0) {
        map[client.id] = clientMeetings[0].notes!;
      }
    }
    return map;
  }, [clients, meetings, showLastNote]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Clients B2B</CardTitle>
          <Button size="sm" variant="ghost" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {meetings.length > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <Switch id="show-last-note" checked={showLastNote} onCheckedChange={setShowLastNote} />
            <Label htmlFor="show-last-note" className="text-xs text-muted-foreground cursor-pointer">
              Dernière note RDV
            </Label>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1 max-h-[500px] overflow-y-auto">
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Aucun client</p>}
        {filtered.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={cn(
              'w-full text-left p-3 rounded-lg transition-colors',
              selectedId === c.id ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted/50'
            )}
          >
            <div className="font-medium text-sm">{c.company_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              {c.country && <span>{c.country}</span>}
              <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[10px]">
                {c.is_active ? 'Actif' : 'Inactif'}
              </Badge>
            </div>
            {showLastNote && lastMeetingNotes[c.id] && (
              <div className="mt-1.5 flex items-start gap-1 text-[11px] text-muted-foreground/80 leading-tight">
                <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{lastMeetingNotes[c.id]}</span>
              </div>
            )}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
