import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Phone, Mail, Calendar, StickyNote, Search, ArrowUpDown, ChevronRight, User, FileText, Copy, Check, Filter, BarChart3, Users, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, format, isWithinInterval, startOfYear, endOfYear } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

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
  deleted_at?: string | null;
}

interface Client {
  id: string;
  company_name: string;
  category_id?: string | null;
}

interface Category {
  id: string;
  name: string;
  color?: string | null;
}

interface Props {
  interactions: Interaction[];
  meetings: Meeting[];
  clients: Client[];
  categories?: Category[];
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

type PeriodPreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
type GroupBy = 'none' | 'client' | 'week' | 'month';

function getPresetRange(preset: PeriodPreset): { from: Date; to: Date } | null {
  const now = new Date();
  switch (preset) {
    case 'this_week':
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
    case 'last_week': {
      const lastWeek = new Date(now);
      lastWeek.setDate(lastWeek.getDate() - 7);
      return { from: startOfWeek(lastWeek, { weekStartsOn: 1 }), to: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    }
    case 'this_month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case 'last_month': {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case 'this_quarter':
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case 'this_year':
      return { from: startOfYear(now), to: endOfYear(now) };
    default:
      return null;
  }
}

// ──────────── Activity Report sub-component ────────────
function ActivityReport({
  entries,
  clients,
  categories = [],
  onNavigateToClient,
}: {
  entries: Array<{ clientName: string; customerId: string; title: string; content: string; type: string; date: string }>;
  clients: Client[];
  categories?: Category[];
  onNavigateToClient: (customerId: string) => void;
}) {
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('this_month');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<GroupBy>('client');
  const [copied, setCopied] = useState(false);

  // Build category map
  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach(c => { map[c.id] = c.name; });
    return map;
  }, [categories]);

  // Client category lookup
  const clientCategoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach(c => {
      if (c.category_id) map[c.id] = c.category_id;
    });
    return map;
  }, [clients]);

  const uniqueClients = useMemo(() => {
    const names = new Map<string, string>();
    entries.forEach(e => {
      if (!names.has(e.customerId)) names.set(e.customerId, e.clientName);
    });
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [entries]);

  const uniqueTypes = useMemo(() => [...new Set(entries.map(e => e.type))], [entries]);

  const filtered = useMemo(() => {
    // Determine date range
    let fromDate: Date | null = null;
    let toDate: Date | null = null;

    if (periodPreset === 'custom') {
      if (dateFrom) fromDate = new Date(dateFrom);
      if (dateTo) toDate = new Date(dateTo + 'T23:59:59');
    } else {
      const range = getPresetRange(periodPreset);
      if (range) {
        fromDate = range.from;
        toDate = range.to;
      }
    }

    return entries.filter(e => {
      const eDate = new Date(e.date);
      if (fromDate && eDate < fromDate) return false;
      if (toDate && eDate > toDate) return false;
      if (selectedClient !== 'all' && e.customerId !== selectedClient) return false;
      if (selectedCategory !== 'all') {
        const catId = clientCategoryMap[e.customerId];
        if (catId !== selectedCategory) return false;
      }
      if (selectedType !== 'all' && e.type !== selectedType) return false;
      return true;
    });
  }, [entries, periodPreset, dateFrom, dateTo, selectedClient, selectedCategory, selectedType, clientCategoryMap]);

  // Grouping
  const grouped = useMemo(() => {
    if (groupBy === 'none') {
      return [{ label: '', items: filtered }];
    }
    if (groupBy === 'client') {
      const map: Record<string, typeof filtered> = {};
      filtered.forEach(e => {
        if (!map[e.clientName]) map[e.clientName] = [];
        map[e.clientName].push(e);
      });
      return Object.entries(map)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, items]) => ({ label, items }));
    }
    // Week or month grouping
    const map: Record<string, typeof filtered> = {};
    filtered.forEach(e => {
      const d = new Date(e.date);
      let key: string;
      if (groupBy === 'week') {
        const ws = startOfWeek(d, { weekStartsOn: 1 });
        key = `Sem. du ${format(ws, 'dd MMM yyyy', { locale: fr })}`;
      } else {
        key = format(d, 'MMMM yyyy', { locale: fr });
      }
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    // Sort groups by most recent first
    return Object.entries(map)
      .sort((a, b) => {
        const da = new Date(a[1][0].date).getTime();
        const db = new Date(b[1][0].date).getTime();
        return db - da;
      })
      .map(([label, items]) => ({ label, items }));
  }, [filtered, groupBy]);

  // Summary stats
  const stats = useMemo(() => {
    const clientSet = new Set(filtered.map(e => e.customerId));
    const typeCounts: Record<string, number> = {};
    filtered.forEach(e => {
      const label = TYPE_CONFIG[e.type]?.label || e.type;
      typeCounts[label] = (typeCounts[label] || 0) + 1;
    });
    return { total: filtered.length, clients: clientSet.size, typeCounts };
  }, [filtered]);

  // Build tab-separated text for Excel paste
  const handleCopy = () => {
    const header = ['Client', 'Date', 'Type', 'Sujet', 'Contenu'].join('\t');
    const rows = filtered.map(e => {
      const d = new Date(e.date);
      const dateStr = d.toLocaleDateString('fr-FR');
      const typeLabel = TYPE_CONFIG[e.type]?.label || e.type;
      const content = (e.content || '').replace(/\n/g, ' ').replace(/\t/g, ' ');
      const subject = e.title.replace(/\t/g, ' ');
      return [e.clientName, dateStr, typeLabel, subject, content].join('\t');
    });
    const text = [header, ...rows].join('\n');
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    setCopied(true);
    toast.success(`${filtered.length} lignes copiées — collez dans Excel`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Période</label>
          <Select value={periodPreset} onValueChange={(v) => setPeriodPreset(v as PeriodPreset)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="this_week">Cette semaine</SelectItem>
              <SelectItem value="last_week">Semaine dernière</SelectItem>
              <SelectItem value="this_month">Ce mois</SelectItem>
              <SelectItem value="last_month">Mois dernier</SelectItem>
              <SelectItem value="this_quarter">Ce trimestre</SelectItem>
              <SelectItem value="this_year">Cette année</SelectItem>
              <SelectItem value="custom">Personnalisé</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {periodPreset === 'custom' && (
          <>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Du</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Au</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs" />
            </div>
          </>
        )}

        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Client</label>
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les clients</SelectItem>
              {uniqueClients.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {categories.length > 0 && (
          <div>
            <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Catégorie</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Type</label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              {uniqueTypes.map(t => (
                <SelectItem key={t} value={t}>{TYPE_CONFIG[t]?.label || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground mb-1 block">Grouper par</label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="week">Semaine</SelectItem>
              <SelectItem value="month">Mois</SelectItem>
              <SelectItem value="none">Aucun</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 py-2 px-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" />
            {stats.total} action{stats.total !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {stats.clients} client{stats.clients !== 1 ? 's' : ''}
          </span>
          {Object.entries(stats.typeCounts).map(([label, count]) => (
            <Badge key={label} variant="secondary" className="text-[10px] font-normal">
              {label}: {count}
            </Badge>
          ))}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          disabled={filtered.length === 0}
          className="h-7 text-[11px] gap-1.5"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copié !' : 'Copier Excel'}
        </Button>
      </div>

      {/* Report content */}
      {grouped.length === 0 || (grouped.length === 1 && grouped[0].items.length === 0) ? (
        <div className="text-center py-10 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Aucune activité pour cette période</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item, idx) => {
                  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.note;
                  const Icon = cfg.icon;
                  const d = new Date(item.date);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        const client = clients.find(c => c.id === item.customerId);
                        if (client) onNavigateToClient(client.id);
                      }}
                      className={cn(
                        "w-full text-left flex items-center gap-3 rounded-md px-3 py-2 border-l-3 text-xs cursor-pointer hover:bg-accent/50 transition-colors",
                        cfg.borderColor,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                        {d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                      </span>
                      {groupBy !== 'client' && (
                        <span className="text-[11px] font-medium text-primary w-28 truncate shrink-0">{item.clientName}</span>
                      )}
                      <span className="font-medium truncate flex-1">{item.title}</span>
                      {item.content && (
                        <span className="text-muted-foreground truncate max-w-[200px] hidden lg:inline">{item.content}</span>
                      )}
                      <Badge variant="outline" className="text-[9px] shrink-0">{cfg.label}</Badge>
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────── Main Timeline component ────────────
export function CrmHistoryTimeline({ interactions, meetings, clients, categories = [], onSelectClient, onSwitchToGestion }: Props) {
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

    const fromMeetings = meetings
      .filter(m => !m.deleted_at)
      .map(m => ({
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
          <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
          Rapport d'activité
        </Button>
      </div>

      {showReport ? (
        <ActivityReport
          entries={allEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())}
          clients={clients}
          categories={categories}
          onNavigateToClient={(customerId) => handleClick(customerId)}
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
