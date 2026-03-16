import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { BarChart3, Filter, Eye, EyeOff, FileText, TrendingUp, Users, Globe, X } from 'lucide-react';
import { B2BClient, B2BClientProjection, B2BClientCategory } from '@/hooks/useB2BClientsData';
import { CustomerInteraction, CrmMeeting } from '@/hooks/useCRMData';
import { getCountryFlag } from '@/lib/countryFlags';

interface CrmAnalyticsDashboardProps {
  clients: B2BClient[];
  projections: B2BClientProjection[];
  categories: B2BClientCategory[];
  interactions: CustomerInteraction[];
  meetings: CrmMeeting[];
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
  'hsl(200, 70%, 50%)',
  'hsl(100, 60%, 45%)',
  'hsl(45, 90%, 50%)',
  'hsl(320, 60%, 55%)',
  'hsl(170, 60%, 40%)',
];

type ChartMode = 'bar' | 'line';
type GroupBy = 'client' | 'country' | 'category' | 'status';

export function CrmAnalyticsDashboard({ clients, projections, categories, interactions, meetings }: CrmAnalyticsDashboardProps) {
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<GroupBy>('client');
  const [chartMode, setChartMode] = useState<ChartMode>('bar');
  const [showInactive, setShowInactive] = useState(false);
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [detailClientId, setDetailClientId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Available years from projections
  const years = useMemo(() => {
    const ys = new Set(projections.map(p => p.year));
    if (ys.size === 0) {
      const cy = new Date().getFullYear();
      [cy - 1, cy, cy + 1, cy + 2].forEach(y => ys.add(y));
    }
    return Array.from(ys).sort();
  }, [projections]);

  // Available countries
  const countries = useMemo(() => {
    const cs = new Set(clients.map(c => c.country).filter(Boolean) as string[]);
    return Array.from(cs).sort();
  }, [clients]);

  // Filtered clients
  const filteredClients = useMemo(() => {
    let list = clients;
    if (!showInactive) list = list.filter(c => c.is_active);
    if (countryFilter !== 'all') list = list.filter(c => c.country === countryFilter);
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'none') list = list.filter(c => !c.category_id);
      else list = list.filter(c => c.category_id === categoryFilter);
    }
    return list;
  }, [clients, showInactive, countryFilter, categoryFilter]);

  // Selected or all
  const displayClients = useMemo(() => {
    if (selectedClientIds.size === 0) return filteredClients;
    return filteredClients.filter(c => selectedClientIds.has(c.id));
  }, [filteredClients, selectedClientIds]);

  // Chart data by groupBy
  const chartData = useMemo(() => {
    if (groupBy === 'client') {
      return years.map(year => {
        const row: Record<string, any> = { year: year.toString() };
        displayClients.forEach(client => {
          const proj = projections.find(p => p.client_id === client.id && p.year === year);
          row[client.company_name] = proj ? Number(proj.projected_revenue) : 0;
        });
        return row;
      });
    }
    if (groupBy === 'country') {
      const countryGroups = new Map<string, string[]>();
      displayClients.forEach(c => {
        const key = c.country || 'Non défini';
        if (!countryGroups.has(key)) countryGroups.set(key, []);
        countryGroups.get(key)!.push(c.id);
      });
      return years.map(year => {
        const row: Record<string, any> = { year: year.toString() };
        countryGroups.forEach((ids, country) => {
          row[country] = projections
            .filter(p => ids.includes(p.client_id) && p.year === year)
            .reduce((s, p) => s + Number(p.projected_revenue || 0), 0);
        });
        return row;
      });
    }
    if (groupBy === 'category') {
      const catGroups = new Map<string, string[]>();
      displayClients.forEach(c => {
        const cat = categories.find(cat => cat.id === c.category_id);
        const key = cat?.name || 'Sans catégorie';
        if (!catGroups.has(key)) catGroups.set(key, []);
        catGroups.get(key)!.push(c.id);
      });
      return years.map(year => {
        const row: Record<string, any> = { year: year.toString() };
        catGroups.forEach((ids, catName) => {
          row[catName] = projections
            .filter(p => ids.includes(p.client_id) && p.year === year)
            .reduce((s, p) => s + Number(p.projected_revenue || 0), 0);
        });
        return row;
      });
    }
    // status
    const statusGroups = new Map<string, string[]>();
    displayClients.forEach(c => {
      const key = c.is_active ? 'Actif' : 'Inactif';
      if (!statusGroups.has(key)) statusGroups.set(key, []);
      statusGroups.get(key)!.push(c.id);
    });
    return years.map(year => {
      const row: Record<string, any> = { year: year.toString() };
      statusGroups.forEach((ids, status) => {
        row[status] = projections
          .filter(p => ids.includes(p.client_id) && p.year === year)
          .reduce((s, p) => s + Number(p.projected_revenue || 0), 0);
      });
      return row;
    });
  }, [displayClients, projections, years, groupBy, categories]);

  // Series keys (all keys except 'year')
  const seriesKeys = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter(k => k !== 'year');
  }, [chartData]);

  // Pie data for country distribution
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    displayClients.forEach(c => {
      const key = c.country || 'Non défini';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, value]) => ({
      name: `${getCountryFlag(name)} ${name}`,
      value,
    }));
  }, [displayClients]);

  // Detail panel data
  const detailClient = clients.find(c => c.id === detailClientId);
  const detailInteractions = interactions.filter(i => i.customer_id === detailClientId);
  const detailMeetings = meetings.filter(m => m.customer_id === detailClientId);
  const detailProjections = projections.filter(p => p.client_id === detailClientId);

  const toggleClient = (id: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
  const selectNone = () => setSelectedClientIds(new Set());

  const formatCurrency = (v: number) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)} M€`;
    if (v >= 1000) return `${(v / 1000).toFixed(0)} k€`;
    return `${v.toFixed(0)} €`;
  };

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant={showFilters ? 'default' : 'outline'} onClick={() => setShowFilters(!showFilters)}>
              <Filter className="h-3.5 w-3.5 mr-1" /> Filtres
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Label className="text-xs">Regrouper par</Label>
              <Select value={groupBy} onValueChange={v => setGroupBy(v as GroupBy)}>
                <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="country">Pays</SelectItem>
                  <SelectItem value="category">Catégorie</SelectItem>
                  <SelectItem value="status">Statut</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Graphique</Label>
              <Select value={chartMode} onValueChange={v => setChartMode(v as ChartMode)}>
                <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Barres</SelectItem>
                  <SelectItem value="line">Courbes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive" className="text-xs cursor-pointer">Inclure inactifs</Label>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Pays</Label>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {countries.map(c => (
                    <SelectItem key={c} value={c}>{getCountryFlag(c)} {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Catégorie</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="none">Sans catégorie</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        {/* Left: client selector */}
        {showFilters && (
          <Card className="lg:row-span-2">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Users className="h-4 w-4" /> Clients ({filteredClients.length})</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={selectAll}>Tous</Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={selectNone}>Aucun</Button>
                </div>
              </CardTitle>
            </CardHeader>
            <ScrollArea className="h-[500px]">
              <div className="px-3 pb-3 space-y-1">
                {filteredClients.map(c => {
                  const isSelected = selectedClientIds.size === 0 || selectedClientIds.has(c.id);
                  const totalCA = projections
                    .filter(p => p.client_id === c.id)
                    .reduce((s, p) => s + Number(p.projected_revenue || 0), 0);
                  const isDetail = detailClientId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-center gap-2 p-2 rounded-md border transition-colors cursor-pointer ${
                        isDetail ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleClient(c.id)}
                        className="shrink-0"
                      />
                      <div className="flex-1 min-w-0" onClick={() => setDetailClientId(isDetail ? null : c.id)}>
                        <div className="flex items-center gap-1.5">
                          {c.country && <span className="text-sm">{getCountryFlag(c.country)}</span>}
                          <span className="text-xs font-medium truncate">{c.company_name}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[9px] h-4">
                            {c.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                          {totalCA > 0 && <span className="text-[10px] text-muted-foreground">{formatCurrency(totalCA)}</span>}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => setDetailClientId(isDetail ? null : c.id)}
                        title="Voir historique"
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </Card>
        )}

        {/* Center: main chart */}
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Évolution CA — par {groupBy === 'client' ? 'Client' : groupBy === 'country' ? 'Pays' : groupBy === 'category' ? 'Catégorie' : 'Statut'}
              <Badge variant="outline" className="text-[10px] ml-auto">
                {displayClients.length} client{displayClients.length > 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <ResponsiveContainer width="100%" height={360}>
              {chartMode === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis tickFormatter={v => formatCurrency(v)} className="text-xs" width={65} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatCurrency(v), name]}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {seriesKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                  <XAxis dataKey="year" className="text-xs" />
                  <YAxis tickFormatter={v => formatCurrency(v)} className="text-xs" width={65} />
                  <Tooltip
                    formatter={(v: number, name: string) => [formatCurrency(v), name]}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {seriesKeys.map((key, i) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 4 }} />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bottom row: pie + detail panel */}
        <div className={`${showFilters ? '' : 'lg:col-span-2'} grid gap-4 ${detailClientId ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          {/* Pie chart — country distribution */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4" /> Répartition par pays
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Detail panel */}
          {detailClientId && detailClient && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    {detailClient.country && <span>{getCountryFlag(detailClient.country)}</span>}
                    {detailClient.company_name}
                    <Badge variant={detailClient.is_active ? 'default' : 'secondary'} className="text-[9px]">
                      {detailClient.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDetailClientId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <ScrollArea className="h-[350px]">
                  {/* Revenue per year */}
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">CA par année</h5>
                    {detailProjections.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucune projection.</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {detailProjections
                          .sort((a, b) => a.year - b.year)
                          .map(p => (
                            <div key={p.id} className="rounded-md border p-2 text-center">
                              <div className="text-[10px] text-muted-foreground">{p.year}</div>
                              <div className="text-sm font-bold">{formatCurrency(Number(p.projected_revenue))}</div>
                              {p.notes && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{p.notes}</div>}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <Separator className="my-3" />

                  {/* Client notes */}
                  {detailClient.notes && (
                    <div className="mb-4">
                      <h5 className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Notes client</h5>
                      <p className="text-xs whitespace-pre-wrap bg-muted/30 rounded p-2">{detailClient.notes}</p>
                    </div>
                  )}

                  {/* Meetings */}
                  <div className="mb-4">
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                      RDV / Réunions ({detailMeetings.length})
                    </h5>
                    {detailMeetings.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucun RDV.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detailMeetings.slice(0, 10).map(m => (
                          <div key={m.id} className="text-xs border rounded p-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{m.title}</span>
                              <Badge variant="outline" className="text-[9px]">{m.status}</Badge>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(m.meeting_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            {m.notes && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{m.notes}</p>}
                            {m.action_items && (
                              <p className="text-[10px] mt-1">
                                <span className="text-muted-foreground">Actions:</span> {m.action_items}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator className="my-3" />

                  {/* Interactions */}
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                      Historique interactions ({detailInteractions.length})
                    </h5>
                    {detailInteractions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucune interaction.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detailInteractions.slice(0, 15).map(int => (
                          <div key={int.id} className="text-xs border rounded p-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">{int.interaction_type}</Badge>
                              <span className="font-medium truncate">{int.subject}</span>
                            </div>
                            {int.content && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{int.content}</p>}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(int.interaction_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
