import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Campaign, Daily, decisionSeries, Metric, METRICS, parameterHistory, Snapshot } from './decisionData';

export type DecisionData = { rows: Daily[]; campaigns: Campaign[]; snapshots: Snapshot[] };
const config = {
  campaign: { label: 'Cette campagne', color: 'hsl(var(--accent))' },
  peers: { label: 'Autres campagnes du même type', color: 'hsl(var(--muted-foreground))' },
  value: { label: 'Valeur observée', color: 'hsl(var(--accent))' },
};
const number = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const dateLabel = (s: string) => new Date(s.length === 10 ? s + 'T00:00:00Z' : s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });

export function PilotDecisionCharts({ action, data, loading, error, onLoad }: {
  action: any; data: DecisionData | null; loading: boolean; error: string | null; onLoad: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [metric, setMetric] = useState<Metric>(action.kind === 'budget' ? 'cost' : 'roas');
  const id = String(action.campaign_id ?? '');
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const model = useMemo(() => data ? decisionSeries(data.rows, data.campaigns, id, days, metric, yesterday) : null, [data, id, days, metric, yesterday]);
  const history = useMemo(() => data ? parameterHistory(data.snapshots, id, action.kind) : [], [data, id, action.kind]);
  const parameter = action.kind === 'budget' ? 'Budget quotidien' : 'ROAS cible';
  const unit = action.kind === 'budget' ? '€ / jour' : '%';
  const proposed = action.kind === 'budget' ? action.proposed_daily_budget : action.proposed_target_roas;
  const latest = data?.rows.reduce((last, r) => r.day > last ? r.day : last, '');
  const lastSync = data?.rows.reduce((last, r) => (r.synced_at ?? '') > last ? r.synced_at ?? '' : last, '');

  return <section className="border-t pt-2">
    <Button variant="ghost" size="sm" aria-expanded={open} onClick={() => { setOpen(!open); if (!open) onLoad(); }}>
      <BarChart3 className="mr-2 h-4 w-4" />Données pour décider{open ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
    </Button>
    {open && <div className="space-y-4 pt-3">
      {loading && <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement des données importées…</p>}
      {error && <div className="flex flex-wrap items-center gap-2 text-destructive">{error}<Button size="sm" variant="outline" onClick={onLoad}>Réessayer</Button></div>}
      {!loading && !error && model && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1" aria-label="Période des graphiques">{[30, 60, 90].map(n => <Button key={n} size="sm" variant={days === n ? 'secondary' : 'ghost'} aria-pressed={days === n} onClick={() => setDays(n)}>{n} j</Button>)}</div>
          <div className="flex flex-wrap gap-1" aria-label="Indicateur des graphiques">{(Object.keys(METRICS) as Metric[]).map(m => <Button key={m} size="sm" variant={metric === m ? 'secondary' : 'ghost'} aria-pressed={metric === m} onClick={() => setMetric(m)}>{METRICS[m].label}</Button>)}</div>
        </div>
        <p className="text-xs text-muted-foreground">Du {model.start} au {yesterday} · comparaison du {model.previousStart} au {new Date(Date.parse(model.start + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10)} · jours UTC, aujourd’hui exclu.</p>
        {latest && latest < yesterday && <p className="text-xs text-warning">Données incomplètes : dernier jour importé {latest}. Les dates absentes restent vides.</p>}
        {!id && <p className="text-muted-foreground">Pas de campagne existante identifiée pour cette proposition : aucun historique attribuable.</p>}
        {id && !model.comparison.some(c => c.id === id && c.days > 0) && <p className="text-muted-foreground">Aucune donnée importée pour cette campagne sur la période.</p>}
        {model.comparison.some(c => c.id === id && c.days > 0) && <>
          <div className="grid min-w-0 gap-6 xl:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <h4 className="font-medium">Évolution · {METRICS[metric].label} {METRICS[metric].unit}</h4>
              <ChartContainer config={config} className="h-60 w-full aspect-auto">
                <LineChart data={model.series} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                  <CartesianGrid vertical={false} /><XAxis dataKey="day" tickFormatter={dateLabel} minTickGap={24} /><YAxis width={54} tickFormatter={n => number(n)} />
                  <ChartTooltip content={<ChartTooltipContent labelFormatter={value => dateLabel(String(value))} />} />
                  <Line dataKey="campaign" stroke="var(--color-campaign)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                  <Line dataKey="peers" stroke="var(--color-peers)" strokeDasharray="5 4" dot={false} connectNulls={false} isAnimationActive={false} />
                </LineChart>
              </ChartContainer>
              <p className="text-xs text-muted-foreground">Trait plein : cette campagne · pointillés : autres campagnes du même type ({model.peerCount}). {metric === 'roas' || metric === 'cpa' ? 'Ratio des totaux quotidiens, pas une moyenne des ratios.' : 'Moyenne quotidienne par campagne ayant une donnée importée.'}</p>
            </div>
            <div className="min-w-0 space-y-2">
              <h4 className="font-medium">Comparaison · {METRICS[metric].label} {METRICS[metric].unit}</h4>
              <div className="max-h-60 overflow-auto">
                <Table><TableHeader><TableRow><TableHead>Campagne</TableHead><TableHead className="text-right">Période</TableHead><TableHead className="text-right">Précédente</TableHead><TableHead className="text-right">Écart</TableHead><TableHead className="text-right">Jours</TableHead></TableRow></TableHeader>
                  <TableBody>{model.comparison.map(c => <TableRow key={c.id} className={c.id === id ? 'bg-accent/10 font-medium' : ''}><TableCell className="min-w-40 whitespace-normal break-words">{c.name}{c.id === id && <span className="block text-xs text-muted-foreground">Cette campagne</span>}</TableCell><TableCell className="text-right whitespace-nowrap">{number(c.value)}</TableCell><TableCell className="text-right whitespace-nowrap">{number(c.prior)}</TableCell><TableCell className="text-right whitespace-nowrap">{c.delta == null ? '—' : `${c.delta > 0 ? '+' : ''}${number(c.delta)} %`}</TableCell><TableCell className="text-right">{c.days}/{days}</TableCell></TableRow>)}</TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">Même type de campagne, pas nécessairement les mêmes pays ou produits. Jours = dates présentes ; couverture différente : comparaison prudente.</p>
            </div>
          </div>
        </>}
        {id && ['budget', 'bidding'].includes(action.kind) && <div className="space-y-2">
          <h4 className="font-medium">{parameter} · historique observé</h4>
          <p className="text-sm">Dernière valeur observée : <b>{number([...history].reverse().find(h => h.value != null)?.value)} {unit}</b> · proposition : <b>{number(proposed)} {unit}</b></p>
          {history.some(h => h.value != null) ? <ChartContainer config={config} className="h-48 w-full aspect-auto"><LineChart data={history} margin={{ right: 60, top: 18, left: 0, bottom: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="at" tickFormatter={dateLabel} minTickGap={30} /><YAxis width={54} domain={['auto', 'auto']} tickFormatter={number} /><ChartTooltip content={<ChartTooltipContent labelFormatter={value => new Date(String(value)).toLocaleString('fr-FR')} />} /><Line type="stepAfter" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />{typeof proposed === 'number' && <ReferenceLine y={proposed} stroke="hsl(var(--warning))" strokeDasharray="5 4" ifOverflow="extendDomain" label={{ value: 'Proposé', fill: 'hsl(var(--muted-foreground))', position: 'right', fontSize: 11 }} />}</LineChart></ChartContainer> : <p className="text-xs text-muted-foreground">Historique de ce paramètre indisponible dans les lectures de structure conservées.</p>}
          <p className="text-xs text-muted-foreground">Valeurs relevées aux dates des audits conservés (30 lectures maximum), pas un historique exhaustif des modifications. Proposition non appliquée. Budget configuré ≠ dépense réelle ; ROAS cible en % ≠ ROAS attribué en ×.</p>
        </div>}
        <p className="text-xs text-muted-foreground">Source : Google Ads importé{lastSync ? ` · dernière synchronisation ${new Date(lastSync).toLocaleString('fr-FR')}` : ''}. Conversions et valeurs attribuées, pas le CA Shopify. Les évolutions observées ne prouvent pas un effet causal.</p>
      </>}
    </div>}
  </section>;
}