import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { B2BClient } from '@/hooks/useB2BClientsData';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (rows: Partial<B2BClient>[]) => Promise<number>;
}

const COLUMNS = [
  'Actif', 'Clients B2B', 'Pays', 'Zone Géographique', 'Mail du contact',
  'Date d\'EER', 'Date dernier achat', 'Type de Client', 'Pricing rules',
  'Delais de paiement', 'Modalités de livraison', 'Règles transport',
  'Frais de livraison', 'Contrat/Exclusivité', 'MOQ', 'Avantages Spécifiques',
];

export function B2BClientImportDialog({ open, onOpenChange, onImport }: Props) {
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState<Partial<B2BClient>[]>([]);
  const [importing, setImporting] = useState(false);

  const parseRaw = (text: string) => {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const rows: Partial<B2BClient>[] = [];
    for (const line of lines) {
      const cols = line.split('\t');
      if (cols.length < 2) continue;
      rows.push({
        is_active: (cols[0] || '').toLowerCase().includes('oui'),
        company_name: cols[1]?.trim() || 'Sans nom',
        country: cols[2]?.trim() || null,
        geographic_zone: cols[3]?.trim() || null,
        contact_email: cols[4]?.trim() || null,
        eer_date: parseInt(cols[5]) || null,
        last_purchase_date: parseInt(cols[6]) || null,
        client_type: cols[7]?.trim() || null,
        pricing_rule: cols[8]?.trim() || null,
        payment_terms: cols[9]?.trim() || null,
        delivery_method: cols[10]?.trim() || null,
        transport_rules: cols[11]?.trim() || null,
        delivery_fee_rule: cols[12]?.trim() || null,
        contract_exclusivity: (cols[13] || '').toLowerCase().includes('oui'),
        moq: cols[14]?.trim() || null,
        specific_advantages: cols[15]?.trim() || null,
      });
    }
    setPreview(rows);
  };

  const handleImport = async () => {
    setImporting(true);
    const count = await onImport(preview);
    setImporting(false);
    if (count > 0) {
      setRaw('');
      setPreview([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Clients B2B (copier-coller)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Collez les lignes depuis Excel/Google Sheets (séparées par tabulations). Colonnes attendues :
          </p>
          <div className="flex flex-wrap gap-1">
            {COLUMNS.map((c, i) => (
              <Badge key={i} variant="outline" className="text-[10px]">{c}</Badge>
            ))}
          </div>
          <Textarea
            placeholder="Collez vos lignes ici..."
            rows={6}
            value={raw}
            onChange={e => { setRaw(e.target.value); parseRaw(e.target.value); }}
          />
          {preview.length > 0 && (
            <div className="border rounded p-3">
              <p className="text-sm font-medium mb-2">{preview.length} client(s) détecté(s) :</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {preview.map((r, i) => (
                  <div key={i} className="text-xs flex gap-2 items-center">
                    <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-[9px]">
                      {r.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                    <span className="font-medium">{r.company_name}</span>
                    <span className="text-muted-foreground">{r.country}</span>
                    <span className="text-muted-foreground">{r.client_type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleImport} disabled={preview.length === 0 || importing}>
            {importing ? 'Import...' : `Importer ${preview.length} client(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
