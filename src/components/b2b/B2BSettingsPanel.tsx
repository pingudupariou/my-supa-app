import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, X } from 'lucide-react';
import {
  B2BDeliveryFeeTier, B2BPaymentTermOption, B2BDeliveryMethod,
  B2BCustomColumn, B2BCustomColumnType,
} from '@/hooks/useB2BClientsData';

interface Props {
  deliveryFeeTiers: B2BDeliveryFeeTier[];
  paymentTermsOptions: B2BPaymentTermOption[];
  deliveryMethods: B2BDeliveryMethod[];
  customColumns?: B2BCustomColumn[];
  onAddDeliveryFee: (label: string, fee: number, min: number, max: number | null) => Promise<void>;
  onDeleteDeliveryFee: (id: string) => Promise<void>;
  onAddPaymentTerm: (label: string, desc?: string) => Promise<void>;
  onDeletePaymentTerm: (id: string) => Promise<void>;
  onAddDeliveryMethod: (label: string, desc?: string) => Promise<void>;
  onDeleteDeliveryMethod: (id: string) => Promise<void>;
  onAddCustomColumn?: (name: string, type: B2BCustomColumnType, options: string[]) => Promise<void>;
  onUpdateCustomColumn?: (id: string, data: Partial<B2BCustomColumn>) => Promise<void>;
  onDeleteCustomColumn?: (id: string) => Promise<void>;
}

export function B2BSettingsPanel({
  deliveryFeeTiers, paymentTermsOptions, deliveryMethods, customColumns = [],
  onAddDeliveryFee, onDeleteDeliveryFee,
  onAddPaymentTerm, onDeletePaymentTerm,
  onAddDeliveryMethod, onDeleteDeliveryMethod,
  onAddCustomColumn, onUpdateCustomColumn, onDeleteCustomColumn,
}: Props) {
  const [dfLabel, setDfLabel] = useState('');
  const [dfFee, setDfFee] = useState('');
  const [dfMin, setDfMin] = useState('');
  const [dfMax, setDfMax] = useState('');
  const [ptLabel, setPtLabel] = useState('');
  const [dmLabel, setDmLabel] = useState('');
  const [ccName, setCcName] = useState('');
  const [ccType, setCcType] = useState<B2BCustomColumnType>('text');
  const [ccOptions, setCcOptions] = useState<string[]>([]);
  const [ccOptionDraft, setCcOptionDraft] = useState('');

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Custom columns */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Colonnes personnalisées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {customColumns.map(col => (
            <div key={col.id} className="text-xs p-2 bg-muted/30 rounded space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{col.name}</span>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {col.column_type === 'text' && 'Texte'}
                  {col.column_type === 'select' && 'Menu'}
                  {col.column_type === 'checkbox' && 'Case'}
                </Badge>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => onDeleteCustomColumn?.(col.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              {col.column_type === 'select' && col.options.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {col.options.map(o => (
                    <Badge key={o} variant="secondary" className="text-[9px] gap-1">
                      {o}
                      <button
                        onClick={() => onUpdateCustomColumn?.(col.id, { options: col.options.filter(x => x !== o) })}
                        className="hover:text-destructive"
                      ><X className="h-2.5 w-2.5" /></button>
                    </Badge>
                  ))}
                  <AddOptionInline onAdd={v => onUpdateCustomColumn?.(col.id, { options: [...col.options, v] })} />
                </div>
              )}
            </div>
          ))}
          <div className="space-y-1 pt-1 border-t">
            <Input placeholder="Nom de la colonne" value={ccName} onChange={e => setCcName(e.target.value)} className="text-xs h-8" />
            <Select value={ccType} onValueChange={v => { setCcType(v as B2BCustomColumnType); setCcOptions([]); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Texte libre</SelectItem>
                <SelectItem value="select">Menu déroulant</SelectItem>
                <SelectItem value="checkbox">Case à cocher</SelectItem>
              </SelectContent>
            </Select>
            {ccType === 'select' && (
              <div className="space-y-1">
                <div className="flex flex-wrap gap-1">
                  {ccOptions.map(o => (
                    <Badge key={o} variant="secondary" className="text-[9px] gap-1">
                      {o}
                      <button onClick={() => setCcOptions(ccOptions.filter(x => x !== o))} className="hover:text-destructive">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Input
                    placeholder="Option…" value={ccOptionDraft}
                    onChange={e => setCcOptionDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && ccOptionDraft.trim()) {
                        setCcOptions([...ccOptions, ccOptionDraft.trim()]);
                        setCcOptionDraft('');
                      }
                    }}
                    className="text-xs h-7"
                  />
                  <Button size="sm" variant="outline" className="h-7"
                    onClick={() => {
                      if (ccOptionDraft.trim()) {
                        setCcOptions([...ccOptions, ccOptionDraft.trim()]);
                        setCcOptionDraft('');
                      }
                    }}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            <Button size="sm" className="w-full" variant="outline"
              disabled={!ccName.trim() || !onAddCustomColumn}
              onClick={async () => {
                await onAddCustomColumn?.(ccName.trim(), ccType, ccType === 'select' ? ccOptions : []);
                setCcName(''); setCcType('text'); setCcOptions([]); setCcOptionDraft('');
              }}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter la colonne
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddOptionInline({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="flex gap-1 items-center">
      <Input
        value={v} onChange={e => setV(e.target.value)} placeholder="+"
        onKeyDown={e => { if (e.key === 'Enter' && v.trim()) { onAdd(v.trim()); setV(''); } }}
        className="h-5 text-[10px] w-20"
      />
    </div>
  );
}
