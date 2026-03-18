import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Plus, Trash2, Megaphone, FlaskConical } from 'lucide-react';
import { formatCurrency } from '@/data/financialConfig';
import { CapexPaymentConfig, MonthIndex, MONTHS } from '@/engine/monthlyTreasuryEngine';
import { Product } from '@/engine/types';

export interface OpexPaymentConfig {
  id: string;
  productId: string;
  productName: string;
  type: 'rd' | 'marketing';
  year: number;
  month: MonthIndex;
  percentageOfTotal: number;
  amount: number;
}

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

export function CapexScheduler({ capexPayments, onChange, products, startYear, durationYears, opexPayments = [], onOpexPaymentsChange }: CapexSchedulerProps) {
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  const capexProducts = products.filter(p => p.devCost > 0);
  const opexRDProducts = products.filter(p => (p.opexRD || 0) > 0);
  const opexMktgProducts = products.filter(p => (p.opexMarketing || 0) > 0);
  const hasOpex = (opexRDProducts.length > 0 || opexMktgProducts.length > 0) && onOpexPaymentsChange;

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

  const renderProducts = (
    productList: Product[],
    allPayments: any[],
    getCost: (p: Product) => number,
    onAdd: (p: Product) => void,
    onUpdate: (id: string, u: any) => void,
    onRemove: (id: string) => void,
    costLabel: string,
    filterPayment?: (p: any) => boolean,
  ) => {
    if (productList.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Aucun produit avec {costLabel}</p>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        {productList.map(product => {
          const pmts = allPayments.filter((p: any) => p.productId === product.id && (!filterPayment || filterPayment(p)));
          const totalPercent = pmts.reduce((s: number, p: any) => s + p.percentageOfTotal, 0);
          const cost = getCost(product);
          return (
            <div key={`${product.id}-${costLabel}`} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">{product.name}</h4>
                  <p className="text-xs text-muted-foreground">{costLabel} : {formatCurrency(cost, true)} • Lancement : {product.launchYear}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={totalPercent === 100 ? 'default' : 'secondary'}>{totalPercent}% planifié</Badge>
                  <Button size="sm" variant="outline" onClick={() => onAdd(product)} disabled={totalPercent >= 100}>
                    <Plus className="h-3 w-3 mr-1" /> Tranche
                  </Button>
                </div>
              </div>
              {pmts.length > 0 ? (
                <PaymentTable payments={pmts} years={years} onUpdate={onUpdate} onRemove={onRemove} />
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Aucune tranche planifiée. Le montant sera considéré à l'année de lancement.
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <SectionCard title="Déblocage CAPEX & OPEX Produits">
      {hasOpex ? (
        <Tabs defaultValue="capex" className="space-y-4">
          <TabsList>
            <TabsTrigger value="capex" className="gap-1.5"><Package className="h-3.5 w-3.5" /> CAPEX R&D</TabsTrigger>
            {opexRDProducts.length > 0 && (
              <TabsTrigger value="opex-rd" className="gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> OPEX R&D</TabsTrigger>
            )}
            {opexMktgProducts.length > 0 && (
              <TabsTrigger value="opex-mktg" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> OPEX Marketing</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="capex">
            {renderProducts(capexProducts, capexPayments, p => p.devCost, addCapexPayment, updateCapexPayment, id => onChange(capexPayments.filter(p => p.id !== id)), 'R&D')}
          </TabsContent>
          <TabsContent value="opex-rd">
            {renderProducts(opexRDProducts, opexPayments, p => p.opexRD || 0, p => addOpexPayment(p, 'rd'), updateOpexPayment, removeOpexPayment, 'OPEX R&D', (p: OpexPaymentConfig) => p.type === 'rd')}
          </TabsContent>
          <TabsContent value="opex-mktg">
            {renderProducts(opexMktgProducts, opexPayments, p => p.opexMarketing || 0, p => addOpexPayment(p, 'marketing'), updateOpexPayment, removeOpexPayment, 'OPEX Marketing', (p: OpexPaymentConfig) => p.type === 'marketing')}
          </TabsContent>
        </Tabs>
      ) : (
        renderProducts(capexProducts, capexPayments, p => p.devCost, addCapexPayment, updateCapexPayment, id => onChange(capexPayments.filter(p => p.id !== id)), 'R&D')
      )}
    </SectionCard>
  );
}
