import { useEffect, useState } from 'react';
import type { Product } from '@/engine/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

type Field = 'b2c' | 'b2b' | 'oem' | 'cost' | 'volume';
const EMPTY: Record<Field, string> = { b2c: '', b2b: '', oem: '', cost: '', volume: '' };

/** Accepts French decimals ("49,90"), spaces and an empty field (= 0). Returns NaN when unreadable. */
export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[\s\u00a0€]/g, '').replace(',', '.');
  if (!cleaned) return 0;
  return /^\d*\.?\d*$/.test(cleaned) ? Number(cleaned) : NaN;
}

function newId(): string {
  try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `product-${crypto.randomUUID()}`; } catch { /* older browser */ }
  return `product-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaultYear = (years: number[]) => years.find(y => y >= new Date().getFullYear()) ?? years[0];

export function ManualPlanProductDialog({ years, onAdd }: { years: number[]; onAdd: (product: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [values, setValues] = useState(EMPTY);
  const [year, setYear] = useState(() => defaultYear(years));
  const [errors, setErrors] = useState<string[]>([]);

  // The plan's years can change after loading a save: keep the launch year inside the plan.
  useEffect(() => { if (!years.includes(year)) setYear(defaultYear(years)); }, [years, year]);

  const reset = () => { setName(''); setValues(EMPTY); setErrors([]); setYear(defaultYear(years)); };

  const create = () => {
    const nums = Object.fromEntries((Object.keys(values) as Field[]).map(k => [k, parseAmount(values[k])])) as Record<Field, number>;
    const problems: string[] = [];
    if (!name.trim()) problems.push('Indiquez le nom du produit.');
    const labels: Record<Field, string> = { b2c: 'Prix B2C HT', b2b: 'Prix B2B HT', oem: 'Prix OEM HT', cost: 'Coût unitaire', volume: 'Volume B2C initial' };
    (Object.keys(nums) as Field[]).forEach(k => { if (!Number.isFinite(nums[k]) || nums[k] < 0) problems.push(`${labels[k]} : nombre positif attendu (ex. 49,90).`); });
    if (!years.includes(year)) problems.push(`Année de lancement à choisir entre ${years[0]} et ${years[years.length - 1]}.`);
    setErrors(problems);
    if (problems.length) return;
    const price = nums.b2c, volume = Math.round(nums.volume);
    try {
      onAdd({ id: newId(), name: name.trim(), category: 'B2C', launchYear: year, devCost: 0, unitCost: nums.cost, priceHT: price, priceTTC_B2C: price * 1.2, priceHT_B2B: nums.b2b, priceHT_OEM: nums.oem, vatRate: .2, coef_shop: 1.5, coef_dist: 1.3, coef_oem: 1.2, productStatus: 'validated', volumesByYear: { [year]: volume }, volumesByChannel: { B2C: { [year]: volume }, B2B: {}, OEM: {} } });
      toast.success(`« ${name.trim()} » ajouté au plan (lancement ${year}). Pensez à sauvegarder.`);
      setOpen(false); reset();
    } catch (e) {
      setErrors([`Création impossible : ${e instanceof Error ? e.message : String(e)}`]);
    }
  };

  const amountInput = (key: Field, label: string, placeholder = '0') => (
    <label key={key} className="text-sm space-y-2">{label}
      <Input aria-label={label} inputMode="decimal" placeholder={placeholder} value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} />
    </label>
  );

  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nouveau produit manuel</Button>
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) setErrors([]); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouveau produit manuel</DialogTitle><DialogDescription>Prix hors taxes · un champ vide compte pour 0</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); create(); }}>
          <label className="text-sm space-y-2 block">Nom du produit<Input aria-label="Nom du nouveau produit" value={name} onChange={e => setName(e.target.value)} autoFocus /></label>
          <div className="grid grid-cols-2 gap-4">
            {amountInput('b2c', 'Prix B2C HT', 'ex. 49,90')}
            {amountInput('b2b', 'Prix B2B HT')}
            {amountInput('oem', 'Prix OEM HT')}
            {amountInput('cost', 'Coût unitaire')}
            <label className="text-sm space-y-2">Année de lancement
              <select aria-label="Année de lancement" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={year} onChange={e => setYear(Number(e.target.value))}>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            {amountInput('volume', 'Volume B2C initial')}
          </div>
          {errors.length > 0 && <ul role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive space-y-1">{errors.map(err => <li key={err}>{err}</li>)}</ul>}
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button type="submit">Créer le produit</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}
