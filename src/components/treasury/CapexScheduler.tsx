import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Plus, Trash2, Megaphone, FlaskConical } from 'lucide-react';
import { formatCurrency } from '@/data/financialConfig';
import { CapexPaymentConfig, MonthIndex, MONTHS, OpexPaymentConfig } from '@/engine/monthlyTreasuryEngine';
import { Product } from '@/engine/types';

// Re-export for backward compatibility
export type { OpexPaymentConfig } from '@/engine/monthlyTreasuryEngine';

interface CapexSchedulerProps {
  capexPayments: CapexPaymentConfig[];
  onChange: (payments: CapexPaymentConfig[]) => void;
  products: Product[];
  startYear: number;
  durationYears: number;
  opexPayments?: OpexPaymentConfig[];
  onOpexPaymentsChange?: (payments: OpexPaymentConfig[]) => void;
}

function PaymentTable({
  payments,
  years,
  onUpdate,
  onRemove,
}: {
  payments: any[];
  years: number[];
  onUpdate: (id: string, updates: any) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mois</TableHead>
          <TableHead>Année</TableHead>
          <TableHead className="text-right">% du total</TableHead>
          <TableHead className="text-right">Montant</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p: any) => (
          <TableRow key={p.id}>
            <TableCell>
              <Select value={p.month.toString()} onValueChange={v => onUpdate(p.id, { month: Number(v) as MonthIndex })}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <Select value={p.year.toString()} onValueChange={v => onUpdate(p.id, { year: Number(v) })}>
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="text-right">
              <Input
                type="number"
                className="h-8 w-20 text-right ml-auto"
                value={p.percentageOfTotal}
                min={1} max={100}
                onChange={e => onUpdate(p.id, { percentageOfTotal: Number(e.target.value) })}
              />
            </TableCell>
            <TableCell className="text-right font-mono-numbers font-medium">
              {formatCurrency(p.amount, true)}
            </TableCell>
            <TableCell>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onRemove(p.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CostSection({
  label,
  icon,
  totalCost,
  payments,
  years,
  onAdd,
  onUpdate,
  onRemove,
}: {
  label: string;
  icon: React.ReactNode;
  totalCost: number;
  payments: any[];
  years: number[];
  onAdd: () => void;
  onUpdate: (id: string, updates: any) => void;
  onRemove: (id: string) => void;
}) {
  const totalPercent = payments.reduce((s: number, p: any) => s + p.percentageOfTotal, 0);
  if (totalCost <= 0) return null;

  return (
    <div className="border rounded-md p-3 space-y-2 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          <span>{label}</span>
          <span className="text-muted-foreground font-normal">({formatCurrency(totalCost, true)})</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={totalPercent === 100 ? 'default' : 'secondary'} className="text-xs">{totalPercent}%</Badge>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd} disabled={totalPercent >= 100}>
            <Plus className="h-3 w-3 mr-1" /> Tranche
          </Button>
        </div>
      </div>
      {payments.length > 0 ? (
        <PaymentTable payments={payments} years={years} onUpdate={onUpdate} onRemove={onRemove} />
      ) : (
        <p className="text-xs text-muted-foreground text-center py-1">
          Non planifié — décaissé à l'année de lancement.
        </p>
      )}
    </div>
  );
}

export function CapexScheduler({ capexPayments, onChange, products, startYear, durationYears, opexPayments = [], onOpexPaymentsChange }: CapexSchedulerProps) {
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  // Products with any cost
  const relevantProducts = products.filter(p => p.devCost > 0 || (p.opexRD || 0) > 0 || (p.opexMarketing || 0) > 0);

  // CAPEX helpers
  const addCapexPayment = (product: Product) => {
    const existing = capexPayments.filter(p => p.productId === product.id);
    const usedPercent = existing.reduce((s, p) => s + p.percentageOfTotal, 0);
    const percent = Math.min(Math.max(0, 100 - usedPercent), 25);
    onChange([...capexPayments, {
      id: `capex-${Date.now()}`,
      productId: product.id, productName: product.name,
      year: product.launchYear, month: 0 as MonthIndex,
      percentageOfTotal: percent, amount: product.devCost * percent / 100,
    }]);
  };

  const updateCapexPayment = (id: string, updates: Partial<CapexPaymentConfig>) => {
    onChange(capexPayments.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      const product = products.find(pr => pr.id === updated.productId);
      if (product) updated.amount = product.devCost * updated.percentageOfTotal / 100;
      return updated;
    }));
  };

  const removeCapexPayment = (id: string) => {
    onChange(capexPayments.filter(p => p.id !== id));
  };

  // OPEX helpers
  const addOpexPayment = (product: Product, type: 'rd' | 'marketing') => {
    if (!onOpexPaymentsChange) return;
    const totalAmount = type === 'rd' ? (product.opexRD || 0) : (product.opexMarketing || 0);
    const existing = opexPayments.filter(p => p.productId === product.id && p.type === type);
    const usedPercent = existing.reduce((s, p) => s + p.percentageOfTotal, 0);
    const percent = Math.min(Math.max(0, 100 - usedPercent), 50);
    onOpexPaymentsChange([...opexPayments, {
      id: `opex-${type}-${Date.now()}`,
      productId: product.id, productName: product.name, type,
      year: product.launchYear, month: 0 as MonthIndex,
      percentageOfTotal: percent, amount: totalAmount * percent / 100,
    }]);
  };

  const updateOpexPayment = (id: string, updates: Partial<OpexPaymentConfig>) => {
    if (!onOpexPaymentsChange) return;
    onOpexPaymentsChange(opexPayments.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      const product = products.find(pr => pr.id === updated.productId);
      if (product) {
        const total = updated.type === 'rd' ? (product.opexRD || 0) : (product.opexMarketing || 0);
        updated.amount = total * updated.percentageOfTotal / 100;
      }
      return updated;
    }));
  };

  const removeOpexPayment = (id: string) => {
    if (!onOpexPaymentsChange) return;
    onOpexPaymentsChange(opexPayments.filter(p => p.id !== id));
  };

  if (relevantProducts.length === 0) {
    return (
      <SectionCard title="Déblocage CAPEX & OPEX Produits">
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Aucun produit avec des coûts CAPEX ou OPEX</p>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Déblocage CAPEX & OPEX Produits">
      <div className="space-y-6">
        {relevantProducts.map(product => {
          const capexPmts = capexPayments.filter(p => p.productId === product.id);
          const opexRDPmts = opexPayments.filter(p => p.productId === product.id && p.type === 'rd');
          const opexMktgPmts = opexPayments.filter(p => p.productId === product.id && p.type === 'marketing');

          return (
            <div key={product.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{product.name}</h4>
                  <p className="text-xs text-muted-foreground">Lancement : {product.launchYear}</p>
                </div>
              </div>

              <div className="space-y-3">
                {/* CAPEX R&D */}
                <CostSection
                  label="CAPEX R&D"
                  icon={<Package className="h-4 w-4 text-primary" />}
                  totalCost={product.devCost}
                  payments={capexPmts}
                  years={years}
                  onAdd={() => addCapexPayment(product)}
                  onUpdate={updateCapexPayment}
                  onRemove={removeCapexPayment}
                />

                {/* OPEX R&D */}
                {onOpexPaymentsChange && (
                  <CostSection
                    label="OPEX R&D"
                    icon={<FlaskConical className="h-4 w-4 text-blue-500" />}
                    totalCost={product.opexRD || 0}
                    payments={opexRDPmts}
                    years={years}
                    onAdd={() => addOpexPayment(product, 'rd')}
                    onUpdate={updateOpexPayment}
                    onRemove={removeOpexPayment}
                  />
                )}

                {/* OPEX Marketing */}
                {onOpexPaymentsChange && (
                  <CostSection
                    label="OPEX Marketing"
                    icon={<Megaphone className="h-4 w-4 text-orange-500" />}
                    totalCost={product.opexMarketing || 0}
                    payments={opexMktgPmts}
                    years={years}
                    onAdd={() => addOpexPayment(product, 'marketing')}
                    onUpdate={updateOpexPayment}
                    onRemove={removeOpexPayment}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
