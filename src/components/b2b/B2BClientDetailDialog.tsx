import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Save, Building2 } from 'lucide-react';
import { B2BClient, B2BClientCategory } from '@/hooks/useB2BClientsData';
import { B2BPaymentTermOption, B2BDeliveryMethod, B2BDeliveryFeeTier } from '@/hooks/useB2BClientsData';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { toast } from 'sonner';

interface Props {
  client: B2BClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Partial<B2BClient> & { company_name: string }) => Promise<B2BClient | null>;
  categories: B2BClientCategory[];
  paymentTermsOptions: B2BPaymentTermOption[];
  deliveryMethods: B2BDeliveryMethod[];
  deliveryFeeTiers: B2BDeliveryFeeTier[];
  readOnly?: boolean;
}

export function B2BClientDetailDialog({
  client, open, onOpenChange, onSave,
  categories, paymentTermsOptions, deliveryMethods, deliveryFeeTiers,
  readOnly = false,
}: Props) {
  const { salesRules } = usePricingConfig();
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (client) {
      setForm({
        company_name: client.company_name || '',
        country: client.country || '',
        geographic_zone: client.geographic_zone || '',
        contact_email: client.contact_email || '',
        contact_phone: client.contact_phone || '',
        client_type: client.client_type || '',
        pricing_rule: client.pricing_rule || '',
        payment_terms: client.payment_terms || '',
        delivery_method: client.delivery_method || '',
        delivery_fee_rule: client.delivery_fee_rule || '',
        moq: client.moq || '',
        specific_advantages: client.specific_advantages || '',
        termination_notice: client.termination_notice || '',
        transport_rules: client.transport_rules || '',
        notes: client.notes || '',
        category_id: client.category_id || '',
        is_active: client.is_active,
        contract_exclusivity: client.contract_exclusivity || false,
        contract_sign_date: client.contract_sign_date || '',
      });
    }
  }, [client]);

  if (!client) return null;

  const set = (key: string, val: any) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.company_name?.trim()) return;
    setSaving(true);
    try {
      await onSave({
        id: client.id,
        company_name: form.company_name,
        country: form.country || null,
        geographic_zone: form.geographic_zone || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        client_type: form.client_type || null,
        pricing_rule: form.pricing_rule || null,
        payment_terms: form.payment_terms || null,
        delivery_method: form.delivery_method || null,
        delivery_fee_rule: form.delivery_fee_rule || null,
        moq: form.moq || null,
        specific_advantages: form.specific_advantages || null,
        termination_notice: form.termination_notice || null,
        transport_rules: form.transport_rules || null,
        notes: form.notes || null,
        category_id: form.category_id || null,
        is_active: form.is_active,
        contract_exclusivity: form.contract_exclusivity,
        contract_sign_date: form.contract_sign_date || null,
      });
      toast.success('Client mis à jour');
      onOpenChange(false);
    } catch {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const statusLabel = form.client_type?.toLowerCase() === 'prospect' ? 'Prospect' : form.is_active ? 'Actif' : 'Inactif';
  const statusColor = form.client_type?.toLowerCase() === 'prospect' ? 'bg-blue-500' : form.is_active ? 'bg-emerald-500' : 'bg-muted-foreground';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Fiche client
            <Badge variant="outline" className="ml-2 gap-1.5">
              <span className={`h-2 w-2 rounded-full ${statusColor}`} />
              {statusLabel}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Identité */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Identité</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom de l'entreprise *</Label>
                <Input value={form.company_name} onChange={e => set('company_name', e.target.value)} disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type de client</Label>
                <Select value={form.client_type || 'none'} onValueChange={v => set('client_type', v === 'none' ? '' : v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    <SelectItem value="Prospect">Prospect</SelectItem>
                    <SelectItem value="Distributeur">Distributeur</SelectItem>
                    <SelectItem value="Revendeur">Revendeur</SelectItem>
                    <SelectItem value="Direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pays</Label>
                <Input value={form.country} onChange={e => set('country', e.target.value)} disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Zone géographique</Label>
                <Input value={form.geographic_zone} onChange={e => set('geographic_zone', e.target.value)} disabled={readOnly} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Email contact</Label>
                <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Téléphone contact</Label>
                <Input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} disabled={readOnly} />
              </div>
            </div>
          </section>

          {/* Commercial */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Commercial</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Catégorie</Label>
                <Select value={form.category_id || 'none'} onValueChange={v => set('category_id', v === 'none' ? '' : v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sans catégorie</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pricing rule</Label>
                <Select value={form.pricing_rule || 'none'} onValueChange={v => set('pricing_rule', v === 'none' ? '' : v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {salesRules.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Délai de paiement</Label>
                <Select value={form.payment_terms || 'none'} onValueChange={v => set('payment_terms', v === 'none' ? '' : v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {paymentTermsOptions.map(o => <SelectItem key={o.id} value={o.label}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Méthode de livraison</Label>
                <Select value={form.delivery_method || 'none'} onValueChange={v => set('delivery_method', v === 'none' ? '' : v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {deliveryMethods.map(m => <SelectItem key={m.id} value={m.label}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Frais de livraison</Label>
                <Select value={form.delivery_fee_rule || 'none'} onValueChange={v => set('delivery_fee_rule', v === 'none' ? '' : v)} disabled={readOnly}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {deliveryFeeTiers.map(t => <SelectItem key={t.id} value={t.label}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">MOQ</Label>
                <Input value={form.moq} onChange={e => set('moq', e.target.value)} disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Règles de transport</Label>
                <Input value={form.transport_rules} onChange={e => set('transport_rules', e.target.value)} disabled={readOnly} />
              </div>
            </div>
          </section>

          {/* Contrat */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contrat</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date signature</Label>
                <Input type="date" value={form.contract_sign_date} onChange={e => set('contract_sign_date', e.target.value)} disabled={readOnly} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Préavis de résiliation</Label>
                <Input value={form.termination_notice} onChange={e => set('termination_notice', e.target.value)} disabled={readOnly} />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.contract_exclusivity} onCheckedChange={v => set('contract_exclusivity', v)} disabled={readOnly} />
                <Label className="text-xs">Exclusivité</Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Avantages spécifiques</Label>
              <Textarea value={form.specific_advantages} onChange={e => set('specific_advantages', e.target.value)} rows={2} disabled={readOnly} />
            </div>
          </section>

          {/* Statut & Notes */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Statut & Notes</h3>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={v => set('is_active', v)} disabled={readOnly} />
                <Label className="text-xs">{form.is_active ? 'Actif' : 'Inactif'}</Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} disabled={readOnly} />
            </div>
          </section>
        </div>

        {!readOnly && (
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving || !form.company_name?.trim()}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
