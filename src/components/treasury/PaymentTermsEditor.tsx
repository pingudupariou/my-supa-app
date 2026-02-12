import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PaymentTermsConfig, PaymentTermLine } from '@/engine/monthlyTreasuryEngine';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaymentTermsEditorProps {
  terms: PaymentTermsConfig;
  onChange: (terms: PaymentTermsConfig) => void;
}

export function PaymentTermsEditor({ terms, onChange }: PaymentTermsEditorProps) {
  const totalPct = terms.reduce((s, t) => s + t.percentage, 0);
  const isValid = Math.abs(totalPct - 100) < 0.1;

  const addLine = () => {
    const remaining = Math.max(0, 100 - totalPct);
    const maxDelay = terms.length > 0 ? Math.max(...terms.map(t => t.delayMonths)) + 1 : 0;
    onChange([...terms, { delayMonths: maxDelay, percentage: remaining }]);
  };

  const removeLine = (index: number) => {
    onChange(terms.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof PaymentTermLine, value: number) => {
    const updated = terms.map((t, i) => i === index ? { ...t, [field]: value } : t);
    onChange(updated);
  };

  return (
    <SectionCard
      title="Conditions de Paiement Fournisseur"
      action={
        <div className="flex items-center gap-2">
          <Badge variant={isValid ? 'default' : 'destructive'} className="text-xs">
            Total: {totalPct.toFixed(0)}%
          </Badge>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Ajouter échéance
          </Button>
        </div>
      }
    >
      <p className="text-xs text-muted-foreground mb-4">
        Définissez comment les achats matière sont payés. Chaque ligne indique le décalage en mois et le pourcentage du montant total.
      </p>

      {terms.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucune condition configurée — paiement comptant par défaut.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <Label className="text-xs">Délai (mois)</Label>
            <Label className="text-xs">% du paiement</Label>
            <div className="w-8" />
          </div>
          {terms.map((term, index) => (
            <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">M+</span>
                <Input
                  type="number"
                  min={0}
                  max={12}
                  value={term.delayMonths}
                  onChange={(e) => updateLine(index, 'delayMonths', parseInt(e.target.value) || 0)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={term.percentage}
                  onChange={(e) => updateLine(index, 'percentage', parseFloat(e.target.value) || 0)}
                  className={cn("h-8 text-sm", !isValid && "border-destructive")}
                />
                <span className="text-xs text-muted-foreground">%</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeLine(index)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {!isValid && terms.length > 0 && (
        <p className="text-xs text-destructive mt-3">
          ⚠ Le total doit être égal à 100%. Actuellement : {totalPct.toFixed(0)}%.
        </p>
      )}

      {/* Visualisation timeline */}
      {terms.length > 0 && (
        <div className="mt-4 p-3 bg-muted/30 rounded-lg">
          <Label className="text-xs mb-2 block">Échéancier de paiement</Label>
          <div className="flex items-end gap-1 h-16">
            {terms.sort((a, b) => a.delayMonths - b.delayMonths).map((term, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className="w-full bg-primary/60 rounded-t transition-all"
                  style={{ height: `${(term.percentage / 100) * 48}px` }}
                />
                <span className="text-[10px] text-muted-foreground mt-1">M+{term.delayMonths}</span>
                <span className="text-[10px] font-bold font-mono-numbers">{term.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
