import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { CustomerClassificationButton } from '@/components/customers/CustomerClassification';
import { useCustomerClassification } from '@/components/customers/useCustomerClassification';
import { effectiveChannel } from '@/components/customers/classificationModel';
import { PIPE_PERIODS, pipePeriod, validPeriod } from '@/components/pipe/pipePeriods';
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
  const { getTabPermission } = useAuth();
  const canWrite = getTabPermission('pipe-commercial') === 'write';
  const { customers, reload: reloadCustomers, error: customerError } = useCustomerClassification();
  const request = useRef(0);
  const [orders, setOrders] = useState<PipeOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [info, setInfo] = useState<{ partial: boolean; total: number | null; read_at: string } | null>(null);
  const [period, setPeriod] = useState('month');
  const [month, setMonth] = useState(() => iso(new Date()).slice(0, 7));
  const [customFrom, setCustomFrom] = useState(() => iso(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [customTo, setCustomTo] = useState(() => iso(new Date()));
  const range = pipePeriod(period, month, customFrom, customTo);
  const periodValid = validPeriod(range.from, range.to);
  const [statuses, setStatuses] = useState<string[]>(['active', 'pending_validation']);
  const [billing, setBilling] = useState<string[]>([]);
  const [payment, setPayment] = useState<string[]>([]);
  const [channels, setChannels] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [sort, setSort] = useState<'dated_at' | 'unbilled' | 'unpaid' | 'total_ht'>('unbilled');

  const load = useCallback(async () => {
    const run = ++request.current;
    if (!validPeriod(range.from, range.to)) { setLoading(false); return; }
    setLoading(true);
    setLoadError(null);
    setProgress(0);
    const collected = new Map<string, PipeOrder>();
    let cursor: { page: number; size: number } | undefined;
    try {
      for (let batch = 0; batch < 1000; batch++) {
        const { data, error } = await supabase.functions.invoke('erplain-sync', { body: { action: 'pipe_orders', from: range.from, to: range.to, cursor } });
        if (run !== request.current) return;
        if (error) {
          const context = 'context' in error ? error.context : null;
          const detail = context instanceof Response ? await context.json().catch(() => null) : null;
          throw new Error(detail?.message ?? detail?.error ?? error.message);
        }
        if (data?.status !== 'success' && data?.status !== 'partial') throw new Error(data?.message ?? 'Lecture Erplain impossible');
        for (const order of data.orders ?? []) collected.set(String(order.id), order);
        setOrders([...collected.values()]);
        setProgress(collected.size);
        setInfo({ partial: data.status === 'partial', total: data.total, read_at: data.read_at });
        if (data.message) throw new Error(data.message);
        if (data.status === 'success') return;
        if (!data.next || (cursor && data.next.page <= cursor.page)) throw new Error('Lecture interrompue : actualisez pour réessayer.');
        cursor = data.next;
      }
      throw new Error('Lecture incomplète : trop de pages Erplain.');
    } catch (e) {
      if (run !== request.current) return;
      const message = (e as Error).message;
      setLoadError(message);
      toast.error(`Commandes Erplain : ${message}`);
    }
    finally { if (run === request.current) setLoading(false); }
  }, [range.from, range.to]);
  useEffect(() => { setOrders([]); setInfo(null); setLoadError(null); void load(); return () => { request.current++; }; }, [load]);

  const periodOrders = useMemo(() => filterOrders(orders, { from: range.from, to: range.to, statuses: [], billing: [], payment: [], channels: [], search: '' }), [orders, range.from, range.to]);
  const inPeriod = useMemo(() => {
    const channelsById = new Map(customers.map(c => [c.customer_id, c.channel]));
    return periodOrders.map(o => ({ ...o, channel: (channelsById.has(String(o.customer_id)) ? effectiveChannel(channelsById.get(String(o.customer_id))).toLowerCase() : o.channel) as PipeOrder['channel'], channel_rule: null }));
  }, [periodOrders, customers]);
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
        <div className="flex flex-wrap items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>{PIPE_PERIODS.map((p) => <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          {period === 'pick_month' && <Input type="month" aria-label="Mois à consulter" value={month} onChange={e => setMonth(e.target.value)} className="w-44" />}
          {period === 'custom' && <><Input type="date" aria-label="Date de début" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="w-40" /><span className="text-sm text-muted-foreground">au</span><Input type="date" aria-label="Date de fin" value={customTo} onChange={e => setCustomTo(e.target.value)} className="w-40" /></>}
          <CustomerClassificationButton orders={periodOrders} />
          <Button onClick={() => { void reloadCustomers(); void load(); }} disabled={loading || !periodValid} variant="outline">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Actualiser</Button>
        </div>
      </div>
      {!periodValid && <p role="alert" className="text-sm text-destructive">Choisissez une période valide : le début doit précéder la fin.</p>}
      {periodValid && <p className="text-sm text-muted-foreground">Date du bon de commande · du {new Date(`${range.from}T12:00:00`).toLocaleDateString('fr-FR')} au {new Date(`${range.to}T12:00:00`).toLocaleDateString('fr-FR')}</p>}
      {customerError && <p role="alert" className="text-sm text-destructive">Classement clients indisponible : {customerError}</p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">Lecture Erplain en cours · {progress} commande(s) reçue(s)</p>}
      {loadError && <div role="alert" className="flex items-center gap-2 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />Actualisation Erplain échouée : {loadError}</div>}
      {info && <p className="text-xs text-muted-foreground">Lu le {new Date(info.read_at).toLocaleString('fr-FR')} · {orders.length} commandes sur la période{info.partial && !loading && <span className="ml-2 inline-flex items-center gap-1 text-destructive"><AlertTriangle className="h-3 w-3" />lecture partielle ({orders.length}/{info.total ?? '?'}) — actualisez</span>}</p>}

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
          {!loading && !loadError && inPeriod.length > 0 && !filtered.length && <div className="mb-3 flex flex-wrap items-center gap-3 text-sm"><span>{inPeriod.length} commande(s) reçue(s), masquée(s) par les filtres.</span><Button variant="outline" size="sm" onClick={() => { setStatuses([]); setBilling([]); setPayment([]); setChannels([]); setSearch(''); }}>Afficher toutes les commandes</Button></div>}
          <PipeSheet orders={filtered} />
        </CardContent>
      </Card>
    </div>
  );
}
