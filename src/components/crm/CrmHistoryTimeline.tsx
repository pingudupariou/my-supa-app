import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Mail, Calendar, StickyNote, Search, ArrowUpDown, ChevronRight, User, FileText, Copy, Check, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  action_items?: string | null;
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

// ──────────── Activity Report sub-component ────────────
function ActivityReport({
  entries,
  clients,
}: {
  entries: Array<{ clientName: string; title: string; content: string; type: string; date: string }>;
  clients: Client[];
}) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const uniqueClients = useMemo(() => {
    const names = new Set(entries.map(e => e.clientName));
    return [...names].sort();
  }, [entries]);

  const uniqueTypes = useMemo(() => {
    const types = new Set(entries.map(e => e.type));
    return [...types];
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo + 'T23:59:59') return false;
      if (selectedClients.length > 0 && !selectedClients.includes(e.clientName)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(e.type)) return false;
      return true;
    });
  }, [entries, dateFrom, dateTo, selectedClients, selectedTypes]);

  // Group by client
  const groupedByClient = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(e => {
      if (!map[e.clientName]) map[e.clientName] = [];
      map[e.clientName].push(e);
    });
    // Sort clients alphabetically
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // Stats
  const stats = useMemo(() => {
    const typeCounts: Record<string, number> = {};
    filtered.forEach(e => {
      const label = TYPE_CONFIG[e.type]?.label || e.type;
      typeCounts[label] = (typeCounts[label] || 0) + 1;
    });
    return { total: filtered.length, clients: groupedByClient.length, typeCounts };
  }, [filtered, groupedByClient]);

  const toggleClient = (name: string) => {
    setSelectedClients(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  const toggleType = (type: string) => {
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // Build tab-separated text for Excel paste
  const buildExportText = () => {
    const header = ['Client', 'Date', 'Type', 'Sujet', 'Contenu'].join('\t');
    const rows = filtered.map(e => {
      const d = new Date(e.date);
      const dateStr = d.toLocaleDateString('fr-FR');
      const typeLabel = TYPE_CONFIG[e.type]?.label || e.type;
      const content = (e.content || '').replace(/\n/g, ' ').replace(/\t/g, ' ');
      const subject = e.title.replace(/\t/g, ' ');
      return [e.clientName, dateStr, typeLabel, subject, content].join('\t');
    });
    return [header, ...rows].join('\n');
  };

  const handleCopy = async () => {
    const text = buildExportText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${filtered.length} lignes copiées — collez dans Excel`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-3.5 w-3.5" />
          Filtres
          {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
        <Button
          size="sm"
          onClick={handleCopy}
          disabled={filtered.length === 0}
          className="h-8 text-xs gap-1.5"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copié !' : `Copier pour Excel (${filtered.length})`}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {/* Date range */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground w-16">Période :</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="h-7 text-xs w-[140px]"
                placeholder="Du"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="h-7 text-xs w-[140px]"
                placeholder="Au"
              />
              {(dateFrom || dateTo) && (
                <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  ✕ Période
                </Badge>
              )}
            </div>

            {/* Type filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground w-16">Type :</span>
              {uniqueTypes.map(t => {
                const cfg = TYPE_CONFIG[t] || TYPE_CONFIG.note;
                const isSelected = selectedTypes.includes(t);
                return (
                  <Badge
                    key={t}
                    variant={isSelected ? 'default' : 'outline'}
                    className="text-[11px] cursor-pointer gap-1 transition-colors"
                    onClick={() => toggleType(t)}
                  >
                    {cfg.label}
                  </Badge>
                );
              })}
              {selectedTypes.length > 0 && (
                <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => setSelectedTypes([])}>
                  ✕ Types
                </Badge>
              )}
            </div>

            {/* Client filter */}
            <div className="flex items-start gap-2 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground w-16 mt-0.5">Clients :</span>
              <div className="flex flex-wrap gap-1 flex-1">
                {uniqueClients.map(name => {
                  const isSelected = selectedClients.includes(name);
                  return (
                    <Badge
                      key={name}
                      variant={isSelected ? 'default' : 'outline'}
                      className="text-[11px] cursor-pointer transition-colors"
                      onClick={() => toggleClient(name)}
                    >
                      {name}
                    </Badge>
                  );
                })}
                {selectedClients.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => setSelectedClients([])}>
                    ✕ Clients
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className="text-xs gap-1">
          <FileText className="h-3 w-3" />
          {stats.total} actions
        </Badge>
        <Badge variant="outline" className="text-xs gap-1">
          <User className="h-3 w-3" />
          {stats.clients} client{stats.clients !== 1 ? 's' : ''}
        </Badge>
        {Object.entries(stats.typeCounts).map(([label, count]) => (
          <Badge key={label} variant="secondary" className="text-[10px]">
            {label}: {count}
          </Badge>
        ))}
      </div>

      {/* Report grouped by client */}
      {groupedByClient.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucune activité pour cette période</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedByClient.map(([clientName, items]) => (
            <Card key={clientName}>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {clientName}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">{items.length} action{items.length > 1 ? 's' : ''}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 px-4 pb-3">
                <div className="space-y-1.5">
                  {items.map((item, idx) => {
                    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.note;
                    const Icon = cfg.icon;
                    const d = new Date(item.date);
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "flex items-start gap-2.5 rounded-md p-2 border-l-3 text-xs",
                          cfg.borderColor,
                          cfg.bgColor,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{item.title}</span>
                            <Badge variant="outline" className="text-[9px]">{cfg.label}</Badge>
                          </div>
                          {item.content && (
                            <p className="text-muted-foreground mt-0.5 line-clamp-3 whitespace-pre-wrap">{item.content}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────── Main Timeline component ────────────
export function CrmHistoryTimeline({ interactions, meetings, clients, onSelectClient, onSwitchToGestion }: Props) {
  const [search, setSearch] = useState('');
  const [ascending, setAscending] = useState(false);
  const [showReport, setShowReport] = useState(false);

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
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={showReport ? 'outline' : 'default'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowReport(false)}
        >
          <StickyNote className="h-3.5 w-3.5 mr-1.5" />
          Timeline
        </Button>
        <Button
          variant={showReport ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => setShowReport(true)}
        >
          <FileText className="h-3.5 w-3.5 mr-1.5" />
          Rapport d'activité
        </Button>
      </div>

      {showReport ? (
        <ActivityReport
          entries={allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
          clients={clients}
        />
      ) : (
        <>
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

          <p className="text-xs text-muted-foreground">
            {filtered.length} entrée{filtered.length !== 1 ? 's' : ''} trouvée{filtered.length !== 1 ? 's' : ''}
          </p>

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
        </>
      )}
    </div>
  );
}
