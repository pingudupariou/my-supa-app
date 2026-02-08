import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/data/financialConfig';
import { CapexPaymentConfig, MonthIndex, MONTHS } from '@/engine/monthlyTreasuryEngine';
import { Product } from '@/engine/types';

interface CapexSchedulerProps {
  capexPayments: CapexPaymentConfig[];
  onChange: (payments: CapexPaymentConfig[]) => void;
  products: Product[];
  startYear: number;
  durationYears: number;
}

export function CapexScheduler({ capexPayments, onChange, products, startYear, durationYears }: CapexSchedulerProps) {
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  // Group payments by product
  const paymentsByProduct = useMemo(() => {
    const map = new Map<string, CapexPaymentConfig[]>();
    capexPayments.forEach(p => {
      const existing = map.get(p.productId) || [];
      existing.push(p);
      map.set(p.productId, existing);
    });
    return map;
  }, [capexPayments]);

  // Products with devCost > 0
  const capexProducts = products.filter(p => p.devCost > 0);

  const addPayment = (product: Product) => {
    const existingForProduct = capexPayments.filter(p => p.productId === product.id);
    const usedPercent = existingForProduct.reduce((s, p) => s + p.percentageOfTotal, 0);
    const remaining = Math.max(0, 100 - usedPercent);
    const percent = Math.min(remaining, 25);

    const newPayment: CapexPaymentConfig = {
      id: `capex-${Date.now()}`,
      productId: product.id,
      productName: product.name,
      year: product.launchYear,
      month: 0 as MonthIndex,
      percentageOfTotal: percent,
      amount: product.devCost * percent / 100,
    };
    onChange([...capexPayments, newPayment]);
  };

  const updatePayment = (id: string, updates: Partial<CapexPaymentConfig>) => {
    onChange(capexPayments.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...updates };
      // Recalculate amount
      const product = products.find(pr => pr.id === updated.productId);
      if (product) {
        updated.amount = product.devCost * updated.percentageOfTotal / 100;
      }
      return updated;
    }));
  };

  const removePayment = (id: string) => {
    onChange(capexPayments.filter(p => p.id !== id));
  };

  return (
    <SectionCard title="Déblocage CAPEX Produits">
      {capexProducts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Aucun produit avec coût de développement</p>
        </div>
      ) : (
        <div className="space-y-6">
          {capexProducts.map(product => {
            const payments = paymentsByProduct.get(product.id) || [];
            const totalPercent = payments.reduce((s, p) => s + p.percentageOfTotal, 0);
            const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

            return (
              <div key={product.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{product.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      R&D : {formatCurrency(product.devCost, true)} • Lancement : {product.launchYear}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={totalPercent === 100 ? 'default' : 'secondary'}>
                      {totalPercent}% planifié
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => addPayment(product)} disabled={totalPercent >= 100}>
                      <Plus className="h-3 w-3 mr-1" />
                      Tranche
                    </Button>
                  </div>
                </div>

                {payments.length > 0 && (
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
                      {payments.map(p => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <Select value={p.month.toString()} onValueChange={v => updatePayment(p.id, { month: Number(v) as MonthIndex })}>
                              <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select value={p.year.toString()} onValueChange={v => updatePayment(p.id, { year: Number(v) })}>
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
                              onChange={e => updatePayment(p.id, { percentageOfTotal: Number(e.target.value) })}
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono-numbers font-medium">
                            {formatCurrency(p.amount, true)}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removePayment(p.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {payments.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Aucune tranche planifiée. Le CAPEX sera considéré à l'année de lancement.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
