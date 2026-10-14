import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product } from '@/engine/types';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/data/financialConfig';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type Ch = 'B2C' | 'B2B' | 'OEM';
const CHS: Ch[] = ['B2C', 'B2B', 'OEM'];
interface Agg { key: string; label: string; byYear: Record<number, Record<Ch, { qty: number; ca: number }>>; cogs: number; cogsQty: number }

interface Props { products: Product[]; years: number[]; onApply: (products: Product[]) => void }

export function ErplainActualsImport({ products, years, onApply }: Props) {
  const thisYear = new Date().getFullYear();
  const pastYears = years.filter(y => y <= thisYear);
  const futureYears = years.filter(y => y > thisYear);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Agg[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [project, setProject] = useState(true);
  const [growth, setGrowth] = useState(0);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const map = new Map<string, Agg>();
    try {
      for (const y of pastYears) {
        const to = y === thisYear ? new Date().toISOString().slice(0, 10) : `${y}-12-31`;
        const { data, error } = await supabase.rpc('sales_breakdown' as any, { _from: `${y}-01-01`, _to: to });
        if (error) throw error;
        for (const r of (data as any[]) ?? []) {
          const a = map.get(r.key) ?? { key: r.key, label: r.label || r.key, byYear: {}, cogs: 0, cogsQty: 0 };
          const yy = a.byYear[y] ??= { B2C: { qty: 0, ca: 0 }, B2B: { qty: 0, ca: 0 }, OEM: { qty: 0, ca: 0 } };
          const c = yy[r.channel as Ch]; if (!c) continue;
          c.qty += Number(r.qty) || 0; c.ca += Number(r.prod_ht) || 0;
          if (Number(r.cov_ht) > 0 && Number(r.cogs) > 0) { a.cogs += Number(r.cogs); a.cogsQty += Number(r.qty) || 0; }
          map.set(r.key, a);
        }
      }
      const list = [...map.values()].filter(a => Object.values(a.byYear).some(y => CHS.some(c => y[c].qty > 0)));
      list.sort((a, b) => total(b) - total(a));
      setRows(list);
    } catch (e: any) { toast.error(`Lecture des ventes impossible : ${e.message}`); }
    setLoading(false);
  };

  const total = (a: Agg) => Object.values(a.byYear).reduce((s, y) => s + CHS.reduce((t, c) => t + y[c].ca, 0), 0);
  const lastYearOf = (a: Agg) => Math.max(...Object.keys(a.byYear).map(Number));
  // Average HT price per channel: latest full sale year where that channel sold, else all years.
  const avgPrice = (a: Agg, ch: Ch) => {
    const ys = Object.keys(a.byYear).map(Number).sort((x, y) => y - x);
    for (const y of ys) { const v = a.byYear[y][ch]; if (v.qty > 0) return v.ca / v.qty; }
    return 0;
  };

  const apply = () => {
    if (!rows) return;
    const chosen = rows.filter(r => sel.has(r.key));
    let next = [...products];
    for (const a of chosen) {
      const id = `erplain-${a.key}`;
      const existing = next.find(p => p.id === id);
      const vbc = existing?.volumesByChannel ? structuredClone(existing.volumesByChannel) : { B2C: {}, B2B: {}, OEM: {} } as Product['volumesByChannel'] & object;
      for (const y of pastYears) for (const c of CHS) vbc[c][y] = Math.round(a.byYear[y]?.[c].qty || 0);
      const last = lastYearOf(a);
      if (project) for (const y of futureYears) for (const c of CHS) {
        const n = y - last; vbc[c][y] = Math.round((a.byYear[last]?.[c].qty || 0) * Math.pow(1 + growth / 100, n));
      }
      const vby: Record<number, number> = {};
      years.forEach(y => { vby[y] = CHS.reduce((s, c) => s + (vbc[c][y] || 0), 0); });
      const b2c = avgPrice(a, 'B2C'), b2b = avgPrice(a, 'B2B'), oem = avgPrice(a, 'OEM');
      const firstYear = Math.min(...Object.keys(a.byYear).map(Number));
      const p: Product = {
        ...(existing ?? {
          id, category: 'B2C', devCost: 0, vatRate: 0.2, coef_shop: 1.5, coef_dist: 1.3, coef_oem: 1.2, productStatus: 'validated',
          productComment: `Importé d'Erplain (variante ${a.key})`,
        } as Product),
        name: a.label, launchYear: Math.min(existing?.launchYear ?? firstYear, firstYear),
        priceHT: round(b2c || b2b || oem), priceTTC_B2C: round((b2c || b2b || oem) * 1.2),
        priceHT_B2B: round(b2b || b2c), priceHT_OEM: round(oem || b2b || b2c),
        unitCost: a.cogsQty > 0 ? round(a.cogs / a.cogsQty) : existing?.unitCost ?? 0,
        volumesByChannel: vbc, volumesByYear: vby, productStatus: 'validated',
      };
      next = existing ? next.map(x => x.id === id ? p : x) : [...next, p];
    }
    onApply(next);
    toast.success(`${chosen.length} produit(s) appliqué(s) au plan`);
  };

  const shown = (rows ?? []).filter(r => r.label.toLowerCase().includes(search.toLowerCase()));

  return (
    <SectionCard title="Réalisé Erplain (années passées et en cours)">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Button size="sm" onClick={load} disabled={loading || !pastYears.length}>
          {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          Charger les ventes {pastYears[0]}–{pastYears[pastYears.length - 1]}
        </Button>
        <span className="text-xs text-muted-foreground">Mêmes ventes et canaux que Statistiques commerciales (factures − avoirs, HT hors livraison).</span>
      </div>
      {rows && (
        <>
          <div className="flex flex-wrap items-center gap-4 mb-3 p-3 bg-muted/30 rounded-lg border text-sm">
            <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 w-48" />
            <label className="flex items-center gap-2"><Checkbox checked={project} onCheckedChange={v => setProject(!!v)} />Dupliquer sur les années suivantes</label>
            {project && <span className="flex items-center gap-1">croissance <Input type="number" value={growth} onChange={e => setGrowth(Number(e.target.value))} className="h-7 w-16 text-center" step={5} /> %/an</span>}
            <Button size="sm" variant="secondary" onClick={() => setSel(new Set(sel.size ? [] : shown.map(r => r.key)))}>{sel.size ? 'Tout décocher' : 'Tout cocher'}</Button>
            <Button size="sm" onClick={apply} disabled={!sel.size}>Appliquer au plan ({sel.size})</Button>
          </div>
          <div className="overflow-x-auto max-h-[480px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Produit</TableHead>
                  {pastYears.map(y => CHS.map(c => <TableHead key={`${y}${c}`} className="text-center text-xs">{y} {c}<br />qté · prix moy. HT</TableHead>))}
                  <TableHead className="text-right">Coût unit. Erplain</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map(a => (
                  <TableRow key={a.key}>
                    <TableCell><Checkbox checked={sel.has(a.key)} onCheckedChange={v => { const s = new Set(sel); v ? s.add(a.key) : s.delete(a.key); setSel(s); }} /></TableCell>
                    <TableCell className="text-xs max-w-[240px]">{a.label}{products.some(p => p.id === `erplain-${a.key}`) && <span className="ml-1 text-primary">· déjà au plan</span>}</TableCell>
                    {pastYears.map(y => CHS.map(c => { const v = a.byYear[y]?.[c]; return (
                      <TableCell key={`${y}${c}`} className="text-center text-xs font-mono-numbers">
                        {v?.qty ? <>{Math.round(v.qty)}<div className="text-muted-foreground">{formatCurrency(v.ca / v.qty)}</div></> : '–'}
                      </TableCell>); }))}
                    <TableCell className="text-right text-xs">{a.cogsQty > 0 ? formatCurrency(a.cogs / a.cogsQty) : <span className="text-muted-foreground">non validé</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Le prix appliqué par canal est le prix moyen HT de la dernière année vendue sur ce canal ; modifiable ensuite dans Pricing. Les volumes passés sont remplacés par le réalisé ; les nouveaux produits manuels restent inchangés.</p>
        </>
      )}
    </SectionCard>
  );
}

const round = (n: number) => Math.round(n * 100) / 100;
