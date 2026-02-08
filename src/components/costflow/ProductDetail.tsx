import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { CostFlowProduct, CostFlowReference, CostFlowBomEntry } from '@/hooks/useCostFlowData';

const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

interface Props {
  product: CostFlowProduct;
  references: CostFlowReference[];
  bom: CostFlowBomEntry[];
  onAddBomEntry: (productId: string, referenceId: string, quantity: number) => Promise<void>;
  onUpdateBomEntry: (id: string, quantity: number) => Promise<void>;
  onRemoveBomEntry: (id: string) => Promise<void>;
  calculateProductCosts: (productId: string) => Record<number, number>;
  onBack: () => void;
}

export function ProductDetail({ product, references, bom, onAddBomEntry, onUpdateBomEntry, onRemoveBomEntry, calculateProductCosts, onBack }: Props) {
  const [newRefId, setNewRefId] = useState('');
  const [newQty, setNewQty] = useState(1);

  const productBom = bom.filter(b => b.product_id === product.id);
  const costs = calculateProductCosts(product.id);
  const priceHT = product.price_ttc / 1.2;

  const chartData = VOLUME_TIERS.map(vol => ({
    volume: `${vol}`,
    cost: costs[vol] || 0,
    margin: priceHT > 0 ? Math.max(0, priceHT - (costs[vol] || 0)) : 0,
  }));

  const handleAddBom = async () => {
    if (!newRefId) return;
    await onAddBomEntry(product.id, newRefId, newQty);
    setNewRefId('');
    setNewQty(1);
  };

  const usedRefIds = new Set(productBom.map(b => b.reference_id));
  const availableRefs = references.filter(r => !usedRefIds.has(r.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h3 className="text-lg font-semibold">{product.name}</h3>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary">{product.family}</Badge>
            <Badge variant="outline">Coef. {product.coefficient}</Badge>
            <Badge variant="outline">Prix TTC {product.price_ttc.toFixed(2)} €</Badge>
          </div>
        </div>
      </div>

      {/* BOM Table */}
      <div className="financial-card p-4">
        <h4 className="section-title">Nomenclature (BOM)</h4>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Référence</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              {VOLUME_TIERS.map(vol => (
                <TableHead key={vol} className="text-right text-xs">@{vol}</TableHead>
              ))}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {productBom.map(entry => {
              const ref = references.find(r => r.id === entry.reference_id);
              if (!ref) return null;
              return (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono-numbers">{ref.code}</TableCell>
                  <TableCell>{ref.name}</TableCell>
                  <TableCell className="text-right">
                    <Input type="number" min={1} className="w-16 text-right font-mono-numbers inline-block" value={entry.quantity} onChange={e => onUpdateBomEntry(entry.id, parseFloat(e.target.value) || 1)} />
                  </TableCell>
                  {VOLUME_TIERS.map(vol => (
                    <TableCell key={vol} className="text-right font-mono-numbers text-xs">
                      {((ref.prices[vol] || 0) * entry.quantity).toFixed(2)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => onRemoveBomEntry(entry.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {/* Total row */}
            <TableRow className="font-semibold bg-muted/30">
              <TableCell colSpan={3} className="text-right">Coût total (× coef. {product.coefficient})</TableCell>
              {VOLUME_TIERS.map(vol => (
                <TableCell key={vol} className="text-right font-mono-numbers text-xs">{(costs[vol] || 0).toFixed(2)}</TableCell>
              ))}
              <TableCell></TableCell>
            </TableRow>
            {priceHT > 0 && (
              <TableRow className="font-semibold">
                <TableCell colSpan={3} className="text-right">Marge (€)</TableCell>
                {VOLUME_TIERS.map(vol => {
                  const margin = priceHT - (costs[vol] || 0);
                  return (
                    <TableCell key={vol} className={`text-right font-mono-numbers text-xs ${margin >= 0 ? 'positive-value' : 'negative-value'}`}>
                      {margin.toFixed(2)}
                    </TableCell>
                  );
                })}
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Add BOM entry */}
        <div className="flex items-end gap-2 mt-4 pt-4 border-t">
          <div className="flex-1">
            <Label className="text-xs">Référence</Label>
            <Select value={newRefId} onValueChange={setNewRefId}>
              <SelectTrigger><SelectValue placeholder="Choisir une référence..." /></SelectTrigger>
              <SelectContent>
                {availableRefs.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-20">
            <Label className="text-xs">Qté</Label>
            <Input type="number" min={1} className="font-mono-numbers" value={newQty} onChange={e => setNewQty(parseInt(e.target.value) || 1)} />
          </div>
          <Button size="sm" onClick={handleAddBom} disabled={!newRefId}><Plus className="h-3 w-3 mr-1" /> Ajouter</Button>
        </div>
      </div>

      {/* Cost chart */}
      {productBom.length > 0 && (
        <div className="financial-card p-4">
          <h4 className="section-title">Coût vs Marge par volume</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="volume" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(val: number) => `${val.toFixed(2)} €`} />
              <Bar dataKey="cost" name="Coût" fill="hsl(var(--accent))" stackId="a" />
              {priceHT > 0 && <Bar dataKey="margin" name="Marge" fill="hsl(var(--positive))" stackId="a" />}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
