import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PlanB2BClient, Product } from '@/engine/types';
import { applyClientGrowth, b2bTotal, clientVolume, enableSplit, importErplainClients, erplainKeysOf, hasErplainHistory, type ErplainClientSale } from '@/engine/b2bClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { Download, Loader2, Plus, Trash2, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';

interface Props { product: Product; years: number[]; onChange: (product: Product) => void }

const num = (n: number) => n.toLocaleString('fr-FR');

export function B2BClientPanel({ product, years, onChange }: Props) {
  const thisYear = new Date().getFullYear();
  const split = product.b2bClients;
  const enabled = !!split?.enabled;
  const linked = hasErplainHistory(product);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [notes, setNotes] = useState<string[]>([]);
  const price = product.priceHT_B2B || product.priceHT;
  const history = new Set(split?.historyYears ?? []);
  const startOptions = years.slice(1);

  const save = (clients: PlanB2BClient[], extra: Partial<NonNullable<Product['b2bClients']>> = {}) =>
    onChange({ ...product, b2bClients: { ...(split ?? { historyYears: [] }), enabled: true, clients, ...extra } });
  const updateClient = (id: string, patch: Partial<PlanB2BClient>) =>
    save((split?.clients ?? []).map(c => c.id === id ? { ...c, ...patch } : c));

  const toggle = (on: boolean) => {
    if (on) onChange({ ...product, b2bClients: enableSplit(product, years) });
    else if (split) onChange({ ...product, b2bClients: { ...split, enabled: false } });
  };

  const importHistory = async () => {
    setLoading(true);
    try {
      const keys = erplainKeysOf(product);
      const fetchYears = [...new Set([...years.filter(y => y < thisYear), thisYear - 1, thisYear])].sort();
      const sales: ErplainClientSale[] = [];
      for (const y of fetchYears) {
        const to = y === thisYear ? new Date().toISOString().slice(0, 10) : `${y}-12-31`;
        const { data, error } = await supabase.rpc('sales_b2b_clients' as never, { _from: `${y}-01-01`, _to: to, _keys: keys } as never);
        if (error) throw error;
        for (const r of (data as unknown as { customer_id: string | null; customer_name: string; qty: number }[]) ?? [])
          sales.push({ year: y, customerId: r.customer_id, name: r.customer_name || 'Client sans nom', qty: Number(r.qty) || 0 });
      }
      if (!sales.length) { toast.info('Aucune vente B2B Erplain trouvée pour cette ligne.'); setLoading(false); return; }
      const res = importErplainClients(product, sales, years, thisYear);
      onChange({ ...product, b2bClients: res.split });
      setNotes(res.notes);
      toast.success(`${res.split.clients.filter(c => !c.remainder).length} client(s) B2B importé(s) d'Erplain`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      toast.error(m.includes('forbidden') ? "Accès à Statistiques commerciales requis pour lire les clients Erplain." : `Lecture impossible : ${m}`);
    }
    setLoading(false);
  };

  const addClient = () => {
    const name = newName.trim();
    if (!name) return;
    if (split?.clients.some(c => c.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) { toast.error('Ce client existe déjà dans cette ligne.'); return; }
    save([...(split?.clients ?? []), { id: `manual-${Date.now().toString(36)}`, name, volumes: {}, growthRate: 0, adjustment: 0, startYear: years.find(y => y >= thisYear) ?? startOptions[0] }]);
    setNewName('');
  };

  return (
    <section aria-label="B2B par client" className="rounded-lg border p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-success" />B2B par client</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {enabled ? 'Le volume B2B de cette ligne est la somme des clients ci-dessous. Prix B2B moyen appliqué à tous les clients.'
              : linked ? 'Répartissez le volume B2B entre vos clients, avec leur historique Erplain, leur croissance et un ajustement propre.'
              : 'Nouveau produit sans historique : ajoutez vos clients ou prospects, leurs volumes, leur croissance et un ajustement propre.'}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch aria-label="Détailler le B2B par client" checked={enabled} onCheckedChange={toggle} />Détailler par client</label>
      </div>

      {enabled && split && <>
        <div className="flex flex-wrap items-center gap-2">
          {linked && <Button size="sm" onClick={importHistory} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}{split.importedAt ? "Actualiser l'historique Erplain" : "Importer l'historique Erplain"}</Button>}
          <div className="flex gap-2">
            <Input aria-label="Nom du nouveau client" placeholder="Nouveau client ou prospect…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addClient(); }} className="h-9 w-56" />
            <Button size="sm" variant="outline" onClick={addClient} disabled={!newName.trim()}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => save(split.clients.map(c => c.remainder ? c : applyClientGrowth(c, years)))}><TrendingUp className="h-4 w-4 mr-2" />Appliquer la croissance à tous</Button>
          <Badge variant="secondary">Prix B2B {formatCurrency(price)} HT</Badge>
        </div>
        {notes.length > 0 && <ul className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground list-disc pl-6 space-y-1">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}

        <div className="overflow-x-auto border-y">
          <Table className="min-w-[900px]">
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="sticky left-0 bg-muted z-10 min-w-[190px]">Client</TableHead>
              <TableHead className="text-center min-w-[90px]">Croissance / an</TableHead>
              <TableHead className="text-center min-w-[100px]">À partir de</TableHead>
              <TableHead className="text-center min-w-[90px]">Ajustement</TableHead>
              {years.map(y => <TableHead key={y} className="text-center min-w-[96px]">{y}{history.has(y) && <span className="block text-[10px] font-normal text-success">Réalisé Erplain</span>}</TableHead>)}
              <TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {split.clients.map(c => <TableRow key={c.id}>
                <TableCell className="sticky left-0 bg-background z-10">
                  {c.customerId || c.remainder ? <span className={`text-sm font-medium break-words ${c.remainder ? 'text-muted-foreground' : ''}`}>{c.name}</span>
                    : <Input aria-label={`Nom du client ${c.name}`} value={c.name} onChange={e => updateClient(c.id, { name: e.target.value })} className="h-9" />}
                  {c.customerId && <span className="block text-[10px] text-muted-foreground mt-0.5">Client Erplain</span>}
                </TableCell>
                <TableCell className="px-2"><div className="relative"><Input aria-label={`${c.name} croissance / an`} type="number" step={1} value={c.growthRate} onChange={e => updateClient(c.id, { growthRate: Number(e.target.value) || 0 })} className="h-9 pr-6 text-center tabular-nums" /><span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span></div></TableCell>
                <TableCell className="px-2">
                  <select aria-label={`${c.name} à partir de`} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={c.startYear ?? startOptions[0] ?? ''} onChange={e => updateClient(c.id, { startYear: Number(e.target.value) })}>
                    {startOptions.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </TableCell>
                <TableCell className="px-2"><div className="relative"><Input aria-label={`${c.name} ajustement`} type="number" step={1} value={c.adjustment} onChange={e => updateClient(c.id, { adjustment: Number(e.target.value) || 0 })} className="h-9 pr-6 text-center tabular-nums" /><span className="absolute right-2 top-2 text-xs text-muted-foreground">%</span></div></TableCell>
                {years.map(y => {
                  const eff = clientVolume(c, y);
                  return <TableCell key={y} className="px-2 text-center">
                    <Input aria-label={`${c.name} ${y}`} type="number" min={0} step={1} inputMode="numeric" value={c.volumes[y] || 0} onFocus={e => e.target.select()}
                      onChange={e => updateClient(c.id, { volumes: { ...c.volumes, [y]: Math.max(0, Math.round(Number(e.target.value) || 0)) } })} className="h-9 text-center tabular-nums" />
                    {eff !== (c.volumes[y] || 0) && <span className="block text-[10px] text-muted-foreground mt-0.5">ajusté → {num(eff)}</span>}
                  </TableCell>;
                })}
                <TableCell className="px-1">
                  <div className="flex gap-1">
                    {!c.remainder && <Button size="icon" variant="ghost" className="h-8 w-8" title={`Appliquer la croissance à ${c.name}`} aria-label={`Appliquer la croissance à ${c.name}`} onClick={() => updateClient(c.id, applyClientGrowth(c, years))}><TrendingUp className="h-4 w-4" /></Button>}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title={`Retirer ${c.name}`} aria-label={`Retirer ${c.name}`} onClick={() => save(split.clients.filter(x => x.id !== c.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>)}
              {!split.clients.length && <TableRow><TableCell colSpan={years.length + 5} className="py-6 text-center text-sm text-muted-foreground">{linked ? "Aucun client : importez l'historique Erplain ou ajoutez un client." : 'Aucun client : ajoutez un client ou un prospect.'}</TableCell></TableRow>}
              <TableRow className="bg-muted/40">
                <TableCell className="sticky left-0 bg-muted text-xs font-semibold">Total B2B (unités)</TableCell><TableCell colSpan={3} />
                {years.map(y => <TableCell key={y} className="text-center text-sm font-semibold tabular-nums">{num(b2bTotal(split, y))}</TableCell>)}<TableCell />
              </TableRow>
              <TableRow>
                <TableCell className="sticky left-0 bg-background text-xs font-medium">CA B2B HT</TableCell><TableCell colSpan={3} />
                {years.map(y => <TableCell key={y} className="text-center text-sm tabular-nums">{formatCurrency(b2bTotal(split, y) * price)}</TableCell>)}<TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">Croissance : chaque année à partir de l'année choisie = année précédente × (1 + %). Ajustement : % appliqué aux volumes à partir de cette même année. Pensez à sauvegarder le plan.</p>
      </>}
    </section>
  );
}
