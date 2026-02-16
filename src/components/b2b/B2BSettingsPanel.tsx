import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { B2BDeliveryFeeTier, B2BPaymentTermOption, B2BDeliveryMethod } from '@/hooks/useB2BClientsData';

interface Props {
  deliveryFeeTiers: B2BDeliveryFeeTier[];
  paymentTermsOptions: B2BPaymentTermOption[];
  deliveryMethods: B2BDeliveryMethod[];
  onAddDeliveryFee: (label: string, fee: number, min: number, max: number | null) => Promise<void>;
  onDeleteDeliveryFee: (id: string) => Promise<void>;
  onAddPaymentTerm: (label: string, desc?: string) => Promise<void>;
  onDeletePaymentTerm: (id: string) => Promise<void>;
  onAddDeliveryMethod: (label: string, desc?: string) => Promise<void>;
  onDeleteDeliveryMethod: (id: string) => Promise<void>;
}

export function B2BSettingsPanel({
  deliveryFeeTiers, paymentTermsOptions, deliveryMethods,
  onAddDeliveryFee, onDeleteDeliveryFee,
  onAddPaymentTerm, onDeletePaymentTerm,
  onAddDeliveryMethod, onDeleteDeliveryMethod,
}: Props) {
  const [dfLabel, setDfLabel] = useState('');
  const [dfFee, setDfFee] = useState('');
  const [dfMin, setDfMin] = useState('');
  const [dfMax, setDfMax] = useState('');
  const [ptLabel, setPtLabel] = useState('');
  const [dmLabel, setDmLabel] = useState('');

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Delivery Fees */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Frais de livraison (tranches)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {deliveryFeeTiers.map(t => (
            <div key={t.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
              <span>{t.label} — {t.fee_amount}€ ({t.min_pieces}{t.max_pieces ? `-${t.max_pieces}` : '+'} pcs)</span>
              <Button size="sm" variant="ghost" onClick={() => onDeleteDeliveryFee(t.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="grid grid-cols-4 gap-1">
            <Input placeholder="Label" value={dfLabel} onChange={e => setDfLabel(e.target.value)} className="text-xs h-8" />
            <Input placeholder="€" type="number" value={dfFee} onChange={e => setDfFee(e.target.value)} className="text-xs h-8" />
            <Input placeholder="Min" type="number" value={dfMin} onChange={e => setDfMin(e.target.value)} className="text-xs h-8" />
            <Input placeholder="Max" type="number" value={dfMax} onChange={e => setDfMax(e.target.value)} className="text-xs h-8" />
          </div>
          <Button size="sm" className="w-full" variant="outline" disabled={!dfLabel}
            onClick={async () => {
              await onAddDeliveryFee(dfLabel, parseFloat(dfFee) || 0, parseInt(dfMin) || 0, dfMax ? parseInt(dfMax) : null);
              setDfLabel(''); setDfFee(''); setDfMin(''); setDfMax('');
            }}>
            <Plus className="h-3 w-3 mr-1" /> Ajouter
          </Button>
        </CardContent>
      </Card>

      {/* Payment Terms */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Délais de paiement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {paymentTermsOptions.map(t => (
            <div key={t.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
              <span>{t.label}</span>
              <Button size="sm" variant="ghost" onClick={() => onDeletePaymentTerm(t.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="flex gap-1">
            <Input placeholder="Ex: 30 jours fin de mois" value={ptLabel} onChange={e => setPtLabel(e.target.value)} className="text-xs h-8" />
            <Button size="sm" variant="outline" disabled={!ptLabel}
              onClick={async () => { await onAddPaymentTerm(ptLabel); setPtLabel(''); }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Methods */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Modalités de livraison</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {deliveryMethods.map(m => (
            <div key={m.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
              <span>{m.label}</span>
              <Button size="sm" variant="ghost" onClick={() => onDeleteDeliveryMethod(m.id)}><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          <div className="flex gap-1">
            <Input placeholder="Ex: DHL, TNT..." value={dmLabel} onChange={e => setDmLabel(e.target.value)} className="text-xs h-8" />
            <Button size="sm" variant="outline" disabled={!dmLabel}
              onClick={async () => { await onAddDeliveryMethod(dmLabel); setDmLabel(''); }}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
