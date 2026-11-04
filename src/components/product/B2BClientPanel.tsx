import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CurrentYearMethod, PlanB2BClient, Product } from '@/engine/types';
import { applyClientGrowth, b2bTotal, clientVolume, CURRENT_YEAR_METHODS, currentYearValue, differsFromOrigin, enableSplit, existingClientOptions, importErplainClients, erplainKeysOf, hasErplainHistory, lockedYears, restoreOrigin, setCurrentYearMethod, yearProgress, type ErplainClientSale, type ExistingClientOption } from '@/engine/b2bClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CalendarClock, ChevronsUpDown, Download, Loader2, Plus, RotateCcw, Trash2, TrendingUp, UserPlus, Users } from 'lucide-react';
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [existing, setExisting] = useState<{ erplain: { customer_id: string; customer_name: string | null; channel: string }[]; crm: { id: string; company_name: string; country: string | null }[] } | null>(null);

  // Clients existants : Erplain classés B2B/OEM (Statistiques commerciales) + fiches clients B2B.
  useEffect(() => {
    if (!enabled || existing) return;
    let cancelled = false;
    (async () => {
      const [e, c] = await Promise.all([
        supabase.from('erplain_sales_customers').select('customer_id, customer_name, channel').in('channel', ['B2B', 'OEM']),
        supabase.from('b2b_clients').select('id, company_name, country').is('deleted_at', null),
      ]);
      if (!cancelled) setExisting({ erplain: e.error ? [] : (e.data ?? []), crm: c.error ? [] : (c.data ?? []) });
    })();
    return () => { cancelled = true; };
  }, [enabled, existing]);
  const options = useMemo(() => existing ? existingClientOptions(existing.erplain, existing.crm, split?.clients ?? []) : [], [existing, split?.clients]);

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
      const today = new Date();
      const iso = (d: Date) => d.toISOString().slice(0, 10);
      const read = async (from: string, to: string, year: number) => {
        const { data, error } = await supabase.rpc('sales_b2b_clients' as never, { _from: from, _to: to, _keys: keys } as never);
        if (error) throw error;
        return ((data as unknown as { customer_id: string | null; customer_name: string; qty: number }[]) ?? [])
          .map(r => ({ year, customerId: r.customer_id, name: r.customer_name || 'Client sans nom', qty: Number(r.qty) || 0 }));
      };
      const sales: ErplainClientSale[] = [];
      for (const y of fetchYears) sales.push(...await read(`${y}-01-01`, y === thisYear ? iso(today) : `${y}-12-31`, y));
      if (!sales.length) { toast.info('Aucune vente B2B Erplain trouvée pour cette ligne.'); setLoading(false); return; }
      // Lectures pour extrapoler l'année en cours : N-1 à la même date et 90 derniers jours.
      const sameN1 = new Date(today); sameN1.setFullYear(thisYear - 1);
      const [n1Same, recent] = await Promise.all([
        read(`${thisYear - 1}-01-01`, iso(sameN1), thisYear - 1),
        read(iso(new Date(today.getTime() - 90 * 86400000)), iso(today), thisYear),
      ]);
      const res = importErplainClients(product, sales, years, thisYear, { asOf: iso(today), n1Same, recent });
      onChange({ ...product, b2bClients: res.split });
      setNotes(res.notes);
      toast.success(`${res.split.clients.filter(c => !c.remainder).length} client(s) B2B importé(s) d'Erplain`);
    } catch (e) {
      const m = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
      toast.error(m.includes('forbidden') ? "Accès à Statistiques commerciales requis pour lire les clients Erplain." : `Lecture impossible : ${m}`);
    }
    setLoading(false);
  };

  const addClient = (picked?: ExistingClientOption) => {
    const name = (picked?.name ?? newName).trim();
    if (!name) return;
    if (split?.clients.some(c => c.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr'))) { toast.error('Ce client existe déjà dans cette ligne.'); return; }
    save([...(split?.clients ?? []), {
      id: picked?.customerId ? `client-${picked.customerId}` : `manual-${Date.now().toString(36)}`, name,
      ...(picked?.customerId ? { customerId: picked.customerId } : {}), ...(picked?.crmClientId ? { crmClientId: picked.crmClientId } : {}),
      volumes: {}, growthRate: 0, adjustment: 0, startYear: years.find(y => y >= thisYear) ?? startOptions[0],
    }]);
    if (picked) { setPickerOpen(false); toast.success(`${name} ajouté`); } else setNewName('');
  };
  const erplainOpts = options.filter(o => o.customerId);
  // Croissance : le réalisé Erplain (années passées, année en cours si chiffre Erplain) n'est jamais écrasé.
  const grow = (c: PlanB2BClient) => applyClientGrowth(c, years, lockedYears(c, split ?? { historyYears: [] }));
  const withActual = (split?.clients ?? []).filter(c => c.actual?.year === thisYear);
  // Seuls les clients avec un % saisi sont recalculés : un client à 0 % garde ses volumes tels quels.
  const growing = (split?.clients ?? []).filter(c => !c.remainder && !!c.growthRate);
  const anyChanged = (split?.clients ?? []).some(differsFromOrigin);
  const setMethodAll = (m: CurrentYearMethod) => save((split?.clients ?? []).map(c => c.actual ? setCurrentYearMethod(c, m) : c));
  const methodLabel = (m?: CurrentYearMethod) => CURRENT_YEAR_METHODS.find(x => x.id === (m ?? 'ytd'))?.label;
  const asOf = withActual[0]?.actual?.asOf;
  const progress = asOf ? yearProgress(thisYear, asOf) : null;
  const commonMethod = withActual.length && withActual.every(c => (c.cyMethod ?? 'ytd') === (withActual[0].cyMethod ?? 'ytd')) ? (withActual[0].cyMethod ?? 'ytd') : null;
  const crmOpts = options.filter(o => !o.customerId);

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
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" role="combobox" aria-expanded={pickerOpen} disabled={!existing}>
                {existing ? <UserPlus className="h-4 w-4 mr-2" /> : <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Client existant<ChevronsUpDown className="h-3.5 w-3.5 ml-2 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
              <Command>
                <CommandInput placeholder="Rechercher un client…" />
                <CommandList>
                  <CommandEmpty>Aucun client disponible.</CommandEmpty>
                  {erplainOpts.length > 0 && <CommandGroup heading="Clients Erplain (B2B / OEM)">
                    {erplainOpts.map(o => <CommandItem key={o.key} value={`${o.name} ${o.key}`} onSelect={() => addClient(o)}>
                      <span className="truncate">{o.name}</span><span className="ml-auto text-[10px] text-muted-foreground">{o.detail}</span>
                    </CommandItem>)}
                  </CommandGroup>}
                  {crmOpts.length > 0 && <CommandGroup heading="Fiches clients B2B">
                    {crmOpts.map(o => <CommandItem key={o.key} value={`${o.name} ${o.key}`} onSelect={() => addClient(o)}>
                      <span className="truncate">{o.name}</span>{o.detail && <span className="ml-auto text-[10px] text-muted-foreground">{o.detail}</span>}
                    </CommandItem>)}
                  </CommandGroup>}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="flex gap-2">
            <Input aria-label="Nom du nouveau client" placeholder="Nouveau prospect…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addClient(); }} className="h-9 w-48" />
            <Button size="sm" variant="outline" onClick={() => addClient()} disabled={!newName.trim()}><Plus className="h-4 w-4 mr-2" />Ajouter</Button>
          </div>
          <Button size="sm" variant="outline" disabled={!growing.length} title="Recalcule les années à partir de « À partir de » pour les clients ayant un % de croissance ; le réalisé Erplain n’est jamais modifié"
            onClick={() => { save(split.clients.map(c => growing.includes(c) ? grow(c) : c)); toast.success(`Croissance appliquée à ${growing.length} client${growing.length > 1 ? 's' : ''}`); }}>
            <TrendingUp className="h-4 w-4 mr-2" />Appliquer la croissance{growing.length ? ` (${growing.length} client${growing.length > 1 ? 's' : ''})` : ''}</Button>
          {anyChanged && <Button size="sm" variant="outline" onClick={() => { save(split.clients.map(restoreOrigin)); toast.success('Réalisé Erplain d’origine rétabli'); }}><RotateCcw className="h-4 w-4 mr-2" />Revenir au réalisé Erplain</Button>}
          <Badge variant="secondary">Prix B2B {formatCurrency(price)} HT</Badge>
        </div>
        {notes.length > 0 && <ul className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground list-disc pl-6 space-y-1">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}

        {withActual.length > 0 && progress && <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" />Année {thisYear} : quel chiffre retenir ?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Erplain lu le {new Date(asOf!).toLocaleDateString('fr-FR')} · {Math.round(progress.fraction * 100)} % de l’année écoulée ({progress.remaining} jours restants). Cliquez sur une valeur pour la choisir client par client, ou sur une méthode pour tous.</p>
            </div>
            <div className="flex flex-wrap gap-1" role="group" aria-label={`Méthode ${thisYear} pour tous les clients`}>
              {CURRENT_YEAR_METHODS.filter(m => m.id !== 'manual').map(m => <Button key={m.id} size="sm" variant={commonMethod === m.id ? 'default' : 'outline'} title={m.help} onClick={() => setMethodAll(m.id)}>{m.label}</Button>)}
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">N-1 ({thisYear - 1})</TableHead>
                <TableHead className="text-right">N-1 même date</TableHead>
                {CURRENT_YEAR_METHODS.filter(m => m.id !== 'manual').map(m => <TableHead key={m.id} className="text-right" title={m.help}>{m.label}</TableHead>)}
                <TableHead className="text-right">Retenu {thisYear}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {withActual.map(c => {
                  const a = c.actual!, m = c.cyMethod ?? 'ytd';
                  return <TableRow key={c.id}>
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{num(a.n1)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{num(a.n1Same)}</TableCell>
                    {CURRENT_YEAR_METHODS.filter(x => x.id !== 'manual').map(x => <TableCell key={x.id} className="text-right p-1">
                      <button type="button" aria-label={`${c.name} : ${x.label}`} aria-pressed={m === x.id} onClick={() => updateClient(c.id, setCurrentYearMethod(c, x.id))}
                        className={`w-full rounded-md px-2 py-1 text-right tabular-nums text-sm transition-colors ${m === x.id ? 'bg-primary text-primary-foreground font-semibold' : 'hover:bg-muted'}`}>
                        {num(currentYearValue(a, x.id) ?? 0)}
                      </button>
                    </TableCell>)}
                    <TableCell className="text-right">
                      <span className="font-semibold tabular-nums">{num(c.volumes[thisYear] || 0)}</span>
                      <span className="block text-[10px] text-muted-foreground">{methodLabel(m)}</span>
                    </TableCell>
                  </TableRow>;
                })}
                <TableRow className="bg-muted/50 font-semibold border-t-2">
                  <TableCell className="text-sm">Total ({withActual.length} clients)</TableCell>
                  <TableCell className="text-right tabular-nums">{num(withActual.reduce((s, c) => s + (c.actual!.n1 || 0), 0))}</TableCell>
                  <TableCell className="text-right tabular-nums">{num(withActual.reduce((s, c) => s + (c.actual!.n1Same || 0), 0))}</TableCell>
                  {CURRENT_YEAR_METHODS.filter(x => x.id !== 'manual').map(x => <TableCell key={x.id} className="text-right tabular-nums px-3">{num(withActual.reduce((s, c) => s + (currentYearValue(c.actual!, x.id) ?? 0), 0))}</TableCell>)}
                  <TableCell className="text-right tabular-nums">
                    {num(withActual.reduce((s, c) => s + (c.volumes[thisYear] || 0), 0))}
                    {split.clients.length > withActual.length && <span className="block text-[10px] font-normal text-muted-foreground">Total B2B ligne : {num(split.clients.reduce((s, c) => s + (c.volumes[thisYear] || 0), 0))}</span>}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">Le chiffre Erplain retenu pour {thisYear} n’est jamais modifié par « Appliquer la croissance » : la croissance part de lui pour {thisYear + 1} et après. Taper une autre valeur dans le tableau passe le client en « Saisie libre ».</p>
        </div>}

        <div className="overflow-x-auto border-y">
          <Table className="min-w-[900px]">
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead className="sticky left-0 bg-muted z-10 min-w-[190px]">Client</TableHead>
              <TableHead className="text-center min-w-[90px]">Croissance / an</TableHead>
              <TableHead className="text-center min-w-[100px]">À partir de</TableHead>
              <TableHead className="text-center min-w-[90px]">Ajustement</TableHead>
              {years.map(y => <TableHead key={y} className="text-center min-w-[96px]">{y}{history.has(y) ? <span className="block text-[10px] font-normal text-success">Réalisé Erplain</span>
                : y === thisYear && withActual.length > 0 && <span className="block text-[10px] font-normal text-primary">{commonMethod ? methodLabel(commonMethod) : 'Mixte'}</span>}</TableHead>)}
              <TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {split.clients.map(c => <TableRow key={c.id}>
                <TableCell className="sticky left-0 bg-background z-10">
                  {c.customerId || c.remainder ? <span className={`text-sm font-medium break-words ${c.remainder ? 'text-muted-foreground' : ''}`}>{c.name}</span>
                    : <Input aria-label={`Nom du client ${c.name}`} value={c.name} onChange={e => updateClient(c.id, { name: e.target.value })} className="h-9" />}
                  {c.customerId ? <span className="block text-[10px] text-muted-foreground mt-0.5">Client Erplain</span>
                    : c.crmClientId && <span className="block text-[10px] text-muted-foreground mt-0.5">Fiche client B2B</span>}
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
                  const orig = c.origin?.[y];
                  const isCy = y === thisYear && c.actual?.year === y;
                  return <TableCell key={y} className={`px-2 text-center ${isCy && (c.cyMethod ?? 'ytd') !== 'manual' ? 'bg-primary/5' : ''}`}>
                    <Input aria-label={`${c.name} ${y}`} type="number" min={0} step={1} inputMode="numeric" value={c.volumes[y] || 0} onFocus={e => e.target.select()}
                      onChange={e => updateClient(c.id, { volumes: { ...c.volumes, [y]: Math.max(0, Math.round(Number(e.target.value) || 0)) }, ...(isCy ? { cyMethod: 'manual' as const } : {}) })} className="h-9 text-center tabular-nums" />
                    {eff !== (c.volumes[y] || 0) && <span className="block text-[10px] text-muted-foreground mt-0.5">ajusté → {num(eff)}</span>}
                    {orig !== undefined && orig !== (c.volumes[y] || 0) && <button type="button" className="block w-full text-[10px] text-primary underline-offset-2 hover:underline mt-0.5" title="Revenir au chiffre Erplain"
                      onClick={() => updateClient(c.id, { volumes: { ...c.volumes, [y]: orig }, ...(isCy ? { cyMethod: 'ytd' as const } : {}) })}>Erplain {isCy ? 'à date ' : ''}: {num(orig)} ↺</button>}
                  </TableCell>;
                })}
                <TableCell className="px-1">
                  <div className="flex gap-1">
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
        <p className="text-xs text-muted-foreground">Croissance : tapez un % par client puis « Appliquer la croissance » (un seul bouton pour tous) — chaque année à partir de l'année choisie = année précédente × (1 + %), sans toucher au réalisé Erplain. Pour revenir à Erplain : lien « Erplain ↺ » sous une case, ou « Revenir au réalisé Erplain ». Ajustement : % appliqué aux volumes à partir de cette même année. Pensez à sauvegarder le plan.</p>
      </>}
    </section>
  );
}
