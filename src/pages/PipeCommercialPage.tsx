import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { PipeSheet } from '@/components/pipe/PipeSheet';
import { countBy, filterOrders, pipeTotals, type PipeOrder } from '@/components/pipe/pipeModel';

const eur = (v: number) => v.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const LABELS: Record<string, string> = {
  active: 'En cours', pending_validation: 'À valider', completed: 'Terminée', cancelled: 'Annulée', draft: 'Brouillon', archived: 'Archivée',
  not_billed: 'Non facturé', partially_billed: 'Facturé en partie', billed: 'Facturé', fully_billed: 'Facturé',
  not_paid: 'Non payé', unpaid: 'Non payé', partially_paid: 'Payé en partie', paid: 'Payé', fully_paid: 'Payé',
  b2b: 'B2B', oem: 'OEM', b2c: 'B2C / à classer', '—': 'Non renseigné',
};
const lab = (k: string) => LABELS[k] ?? k;
const PERIODS = [
  { key: 'month', label: 'Mois en cours' }, { key: '3m', label: '3 derniers mois' }, { key: 'year', label: 'Année en cours' }, { key: '12m', label: '12 derniers mois' },
];
function periodFrom(key: string) {
  const d = new Date();
  if (key === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (key === '3m') return new Date(d.getFullYear(), d.getMonth() - 2, 1);
  if (key === 'year') return new Date(d.getFullYear(), 0, 1);
  return new Date(d.getFullYear() - 1, d.getMonth(), d.getDate());
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function Chips({ title, items, selected, onChange }: { title: string; items: [string, number][]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={selected.length ? 'outline' : 'default'} className="h-7" onClick={() => onChange([])}>Tous</Button>
        {items.map(([k, n]) => {
          const on = selected.includes(k);
          return <Button key={k} size="sm" variant={on ? 'default' : 'outline'} className="h-7" onClick={() => onChange(on ? selected.filter((x) => x !== k) : [...selected, k])}>{lab(k)} <span className="ml-1 opacity-70">{n}</span></Button>;
        })}
      </div>
    </div>
  );
}

export function PipeCommercialPage() {
  const [orders, setOrders] = useState<PipeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ partial: boolean; total: number | null; read_at: string } | null>(null);
  const [period, setPeriod] = useState('month');
  const [statuses, setStatuses] = useState<string[]>(['active', 'pending_validation']);
  const [billing, setBilling] = useState<string[]>([]);
  const [payment, setPayment] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<'dated_at' | 'unbilled' | 'unpaid' | 'total_ht'>('unbilled');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'pipe_orders', from: iso(periodFrom('12m')) } });
      if (error) throw error;
      if (data?.status !== 'success' && data?.status !== 'partial') throw new Error(data?.message ?? 'Lecture Erplain impossible');
      setOrders(data.orders ?? []);
      setInfo({ partial: data.status === 'partial', total: data.total, read_at: data.read_at });
    } catch (e) { toast.error(`Commandes Erplain : ${(e as Error).message}`); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const inPeriod = useMemo(() => filterOrders(orders, { from: iso(periodFrom(period)), statuses: [], billing: [], payment: [], channels: [], search: '' }), [orders, period]);
  const filtered = useMemo(() => filterOrders(inPeriod, { from: null, statuses, billing, payment, channels, search }), [inPeriod, statuses, billing, payment, channels, search]);
  const t = pipeTotals(filtered);
  const sorted = [...filtered].sort((a, b) => sort === 'dated_at' ? (b.dated_at ?? '').localeCompare(a.dated_at ?? '') : (b[sort] ?? 0) - (a[sort] ?? 0));

  const max = Math.max(t.sum.total_ht, t.sum.billed + t.sum.unbilled, 1);
  const stages = [
    { label: 'Commandé HT', value: t.sum.total_ht, cls: 'bg-primary', miss: t.missing.total_ht },
    { label: 'Déjà facturé', value: t.sum.billed, cls: 'bg-primary/70', miss: t.missing.billed },
    { label: 'Reste à facturer', value: t.sum.unbilled, cls: 'bg-destructive/80', miss: t.missing.unbilled, key: true },
    { label: 'Encaissé', value: t.sum.paid, cls: 'bg-primary/50', miss: t.missing.paid },
    { label: 'Reste à encaisser', value: t.sum.unpaid, cls: 'bg-destructive/60', miss: t.missing.unpaid, key: true },
  ];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pipe commercial</h1>
          <p className="text-sm text-muted-foreground">Bons de commande Erplain, lus en direct (lecture seule). Montants tels que fournis par Erplain.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={load} disabled={loading} variant="outline">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Actualiser</Button>
        </div>
      </div>
      {info && <p className="text-xs text-muted-foreground">Lu le {new Date(info.read_at).toLocaleString('fr-FR')} · {orders.length} commandes sur 12 mois{info.partial && <span className="ml-2 inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />lecture partielle ({orders.length}/{info.total ?? '?'}) — actualisez</span>}</p>}

      <Card>
        <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
          <Chips title="Statut de la commande" items={countBy(inPeriod, 'status')} selected={statuses} onChange={setStatuses} />
          <Chips title="Facturation" items={countBy(inPeriod, 'billing_status')} selected={billing} onChange={setBilling} />
          <Chips title="Paiement" items={countBy(inPeriod, 'payment_status')} selected={payment} onChange={setPayment} />
          <Chips title="Type de client" items={countBy(inPeriod, 'channel')} selected={channels} onChange={setChannels} />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stages.map((s) => (
          <Card key={s.label} className={s.key ? 'border-destructive/40' : ''}>
            <CardContent className="pt-4">
              <div className="text-xs text-muted-foreground">{s.label}</div>
              <div className="text-xl font-bold">{eur(s.value)}</div>
              {s.miss > 0 && <div className="text-xs text-destructive">{s.miss} montant(s) absent(s)</div>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Pipe — {t.count} commande(s) filtrée(s)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {stages.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="w-36 shrink-0 text-sm">{s.label}</div>
              <div className="h-7 flex-1 rounded bg-muted">
                <div className={`flex h-7 items-center rounded px-2 text-xs font-medium text-primary-foreground ${s.cls}`} style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }}>{eur(s.value)}</div>
              </div>
            </div>
          ))}
          <p className="pt-1 text-xs text-muted-foreground">« Encaissé » et « Reste à encaisser » suivent les montants de paiement Erplain (souvent TTC) ; « Commandé » et « Facturé » sont HT.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Détail des commandes</CardTitle>
          <div className="flex gap-2">
            <Input placeholder="N° ou client…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />

          </div>
        </CardHeader>
        <CardContent>
          <PipeSheet orders={filtered} />
        </CardContent>
      </Card>
    </div>
  );
}
