import { useState } from 'react';
import type { Product } from '@/engine/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

export function ManualPlanProductDialog({ years, onAdd }: { years: number[]; onAdd: (product: Product) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [values, setValues] = useState({ b2c: '', b2b: '', oem: '', cost: '', volume: '' });
  const [year, setYear] = useState(years.find(y => y >= new Date().getFullYear()) ?? years[0]);
  const valid = name.trim() && Object.values(values).every(v => Number.isFinite(Number(v)) && Number(v) >= 0);
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nouveau produit manuel</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nouveau produit manuel</DialogTitle></DialogHeader>
        <label className="text-sm space-y-2">Nom du produit<Input aria-label="Nom du nouveau produit" value={name} onChange={e => setName(e.target.value)} /></label>
        <div className="grid grid-cols-2 gap-4">
          {([['b2c', 'Prix B2C HT'], ['b2b', 'Prix B2B HT'], ['oem', 'Prix OEM HT'], ['cost', 'Coût unitaire']] as const).map(([key, label]) => <label key={key} className="text-sm space-y-2">{label}<Input aria-label={label} type="number" min="0" step="0.01" value={values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} /></label>)}
          <label className="text-sm space-y-2">Année de lancement<Input aria-label="Année de lancement" type="number" min={years[0]} max={years[years.length - 1]} value={year} onChange={e => setYear(Number(e.target.value))} /></label>
          <label className="text-sm space-y-2">Volume B2C initial<Input aria-label="Volume B2C initial" type="number" min="0" step="1" value={values.volume} onChange={e => setValues(v => ({ ...v, volume: e.target.value }))} /></label>
        </div>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button><Button disabled={!valid || !years.includes(year)} onClick={() => {
          const price = Number(values.b2c), volume = Math.round(Number(values.volume));
          onAdd({ id: `product-${crypto.randomUUID()}`, name: name.trim(), category: 'B2C', launchYear: year, devCost: 0, unitCost: Number(values.cost), priceHT: price, priceTTC_B2C: price * 1.2, priceHT_B2B: Number(values.b2b), priceHT_OEM: Number(values.oem), vatRate: .2, coef_shop: 1.5, coef_dist: 1.3, coef_oem: 1.2, productStatus: 'validated', volumesByYear: { [year]: volume }, volumesByChannel: { B2C: { [year]: volume }, B2B: {}, OEM: {} } });
          setOpen(false); setName(''); setValues({ b2c: '', b2b: '', oem: '', cost: '', volume: '' });
        }}>Créer le produit</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}