import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

type Ch = 'B2C' | 'B2B' | 'OEM';
const CHS: Ch[] = ['B2C', 'B2B', 'OEM'];
type Method = 'prorata' | 'season' | 'recent';
const METHODS: { id: Method; label: string; help: string }[] = [
  { id: 'prorata', label: 'Prorata simple', help: 'Ventes à ce jour ÷ part de l’année écoulée' },
  { id: 'season', label: 'Saisonnalité N-1', help: 'Ventes à ce jour × (total N-1 ÷ N-1 à la même date)' },
  { id: 'recent', label: 'Rythme récent', help: 'Ventes à ce jour + rythme des 90 derniers jours × jours restants' },
];
type Qty = Record<string, Record<Ch, number>>; // erplain key -> channel -> qty

interface Props { products: Product[]; years: number[]; onApply: (products: Product[]) => void }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86400000;

export function CurrentYearProjection({ products, years, onApply }: Props) {
  const today = new Date();
  const year = today.getFullYear();
  const [data, setData] = useState<{ ytd: Qty; n1: Qty; n1same: Qty; recent: Qty } | null>(null);
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<Method>('season');
  const [adj, setAdj] = useState<Record<Ch, number>>({ B2C: 0, B2B: 0, OEM: 0 });

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  const elapsedDays = Math.max(1, Math.round((today.getTime() - start.getTime()) / DAY));
  const totalDays = Math.round((end.getTime() - start.getTime()) / DAY);
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const fraction = elapsedDays / totalDays;

  const keysOf = (p: Product): string[] => p.erplainMembers?.length ? p.erplainMembers : p.id.startsWith('erplain-') ? [p.id.slice(8)] : [];
  const planProducts = products.filter(p => p.productStatus === 'validated' && keysOf(p).length);

  const fetchQty = async (from: string, to: string): Promise<Qty> => {
    const { data, error } = await supabase.rpc('sales_breakdown' as any, { _from: from, _to: to });
    if (error) throw error;
    const q: Qty = {};
    for (const r of (data as any[]) ?? []) {
      const k = String(r.key ?? r.label ?? 'sans-reference');
      const c = r.channel as Ch; if (!CHS.includes(c)) continue;
      (q[k] ??= { B2C: 0, B2B: 0, OEM: 0 })[c] += Number(r.qty) || 0;
    }
    return q;
  };

  const load = async () => {
    setLoading(true);
    try {
      const sameN1 = new Date(today); sameN1.setFullYear(year - 1);
      const [ytd, n1, n1same, recent] = await Promise.all([
        fetchQty(`${year}-01-01`, iso(today)),
        fetchQty(`${year - 1}-01-01`, `${year - 1}-12-31`),
        fetchQty(`${year - 1}-01-01`, iso(sameN1)),
        fetchQty(iso(new Date(today.getTime() - 90 * DAY)), iso(today)),
      ]);
      setData({ ytd, n1, n1same, recent });
    } catch (e: any) { toast.error(`Lecture des ventes impossible : ${e.message}`); }
    setLoading(false);
  };

  const sum = (q: Qty, p: Product, c: Ch) => keysOf(p).reduce((s, k) => s + (q[k]?.[c] ?? 0), 0);
  const project = (p: Product, c: Ch, m: Method): number => {
    if (!data) return 0;
    const ytd = sum(data.ytd, p, c);
    if (m === 'prorata') return ytd / fraction;
    if (m === 'recent') return ytd + (sum(data.recent, p, c) / 90) * remainingDays;
    const same = sum(data.n1same, p, c), full = sum(data.n1, p, c);
    return same > 0 ? ytd * (full / same) : ytd / fraction; // no N-1 base → prorata
  };
  const final = (p: Product, c: Ch) => Math.round(project(p, c, method) * (1 + adj[c] / 100));

  const apply = () => {
    if (!years.includes(year)) { toast.error(`L’année ${year} n’est pas dans le plan`); return; }
    const ids = new Set(planProducts.map(p => p.id));
    onApply(products.map(p => {
      if (!ids.has(p.id)) return p;
      const vc = p.volumesByChannel ?? { B2C: {}, B2B: {}, OEM: {} };
      const next = { B2C: { ...vc.B2C, [year]: final(p, 'B2C') }, B2B: { ...vc.B2B, [year]: final(p, 'B2B') }, OEM: { ...vc.OEM, [year]: final(p, 'OEM') } };
      return { ...p, volumesByChannel: next, volumesByYear: { ...p.volumesByYear, [year]: CHS.reduce((s, c) => s + next[c][year], 0) } };
    }));
    toast.success(`Volumes ${year} projetés pour ${planProducts.length} produit(s). Pensez à sauvegarder.`);
  };

  const tot = (fn: (p: Product, c: Ch) => number) => planProducts.reduce((s, p) => s + CHS.reduce((t, c) => t + fn(p, c), 0), 0);

  return (
    <SectionCard title={`Base étalon — projection de l’année ${year} entière`}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Part de l’année écoulée au {today.toLocaleDateString('fr-FR')} : <b>{Math.round(fraction * 100)} %</b> ({remainingDays} jours restants).
          Seule l’année {year} est remplacée ; les autres années ne changent pas. Produits du plan liés à Erplain uniquement.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <Button size="sm" onClick={load} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}Calculer la base</Button>
          <div className="flex gap-2">
            {METHODS.map(m => (
              <Button key={m.id} size="sm" variant={method === m.id ? 'default' : 'outline'} onClick={() => setMethod(m.id)} title={m.help}>{m.label}</Button>
            ))}
          </div>
          <div className="flex gap-3">
            {CHS.map(c => (
              <label key={c} className="text-xs flex items-center gap-1">Ajust. {c}
                <Input type="number" value={adj[c]} onChange={e => setAdj({ ...adj, [c]: Number(e.target.value) || 0 })} className="h-8 w-16 text-xs" />%
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{METHODS.find(m => m.id === method)?.help}. Sans historique N-1, la saisonnalité retombe sur le prorata.</p>

        {data && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead><TableHead>Canal</TableHead>
                    <TableHead className="text-right">N-1 ({year - 1})</TableHead>
                    <TableHead className="text-right">À ce jour</TableHead>
                    {METHODS.map(m => <TableHead key={m.id} className={`text-right ${m.id === method ? 'text-primary' : ''}`}>{m.label}</TableHead>)}
                    <TableHead className="text-right">Retenu {year}</TableHead>
                    <TableHead className="text-right">vs N-1</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planProducts.flatMap(p => CHS.filter(c => sum(data.n1, p, c) || sum(data.ytd, p, c)).map((c, i) => {
                    const n1 = sum(data.n1, p, c), f = final(p, c);
                    return (
                      <TableRow key={p.id + c}>
                        <TableCell className="font-medium">{i === 0 ? p.name : ''}</TableCell>
                        <TableCell className="text-xs">{c}</TableCell>
                        <TableCell className="text-right">{n1}</TableCell>
                        <TableCell className="text-right">{sum(data.ytd, p, c)}</TableCell>
                        {METHODS.map(m => <TableCell key={m.id} className={`text-right ${m.id === method ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>{Math.round(project(p, c, m.id))}</TableCell>)}
                        <TableCell className="text-right font-semibold">{f}</TableCell>
                        <TableCell className="text-right text-xs">{n1 > 0 ? `${f >= n1 ? '+' : ''}${Math.round((f / n1 - 1) * 100)} %` : '—'}</TableCell>
                      </TableRow>
                    );
                  }))}
                  <TableRow className="font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{tot((p, c) => sum(data.n1, p, c))}</TableCell>
                    <TableCell className="text-right">{tot((p, c) => sum(data.ytd, p, c))}</TableCell>
                    {METHODS.map(m => <TableCell key={m.id} className="text-right">{Math.round(tot((p, c) => project(p, c, m.id)))}</TableCell>)}
                    <TableCell className="text-right">{tot(final)}</TableCell><TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <Button size="sm" onClick={apply} disabled={!planProducts.length}>Appliquer « Retenu » à l’année {year}</Button>
          </>
        )}
      </div>
    </SectionCard>
  );
}
