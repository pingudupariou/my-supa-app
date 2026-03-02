import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Layers } from 'lucide-react';

export interface DeclinationConfig {
  prefix: string;
  adjustmentType: 'percent' | 'fixed';
  adjustmentValue: number; // positive = surplus, negative = reduction
}

// Key format: `${categoryId}__${ruleId}`
export type DeclinationMap = Record<string, DeclinationConfig>;

export function makeDeclinationKey(categoryId: string, ruleId: string) {
  return `${categoryId}__${ruleId}`;
}

export function parseDeclinationKey(key: string) {
  const [categoryId, ruleId] = key.split('__');
  return { categoryId, ruleId };
}

export function getDeclinationName(
  prefix: string,
  categoryName: string,
  ruleName: string
) {
  if (prefix) return `${prefix} ${categoryName}`;
  return `${categoryName} — ${ruleName}`;
}

export function applyDeclinationAdjustment(
  baseCost: number,
  config: DeclinationConfig | undefined
): number {
  if (!config || config.adjustmentValue === 0) return baseCost;
  if (config.adjustmentType === 'percent') {
    return baseCost * (1 + config.adjustmentValue / 100);
  }
  return baseCost + config.adjustmentValue;
}

interface Props {
  declinations: DeclinationMap;
  onUpdate: (declinations: DeclinationMap) => void;
  categories: { id: string; name: string; color: string }[];
  salesRules: { id: string; name: string; type: string }[];
}

export function DeclinationConfigManager({ declinations, onUpdate, categories, salesRules }: Props) {
  if (categories.length === 0 || salesRules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Déclinaisons (catégorie × canal)
          </CardTitle>
          <CardDescription>Créez des catégories produit et des règles de vente pour configurer les déclinaisons.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const updateField = (key: string, field: keyof DeclinationConfig, value: any) => {
    const current = declinations[key] || { prefix: '', adjustmentType: 'percent' as const, adjustmentValue: 0 };
    onUpdate({
      ...declinations,
      [key]: { ...current, [field]: value },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Déclinaisons (catégorie × canal)
        </CardTitle>
        <CardDescription>
          Définissez un préfixe et un ajustement de coût par combinaison catégorie/canal de vente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Canal de vente</TableHead>
                <TableHead>Préfixe</TableHead>
                <TableHead>Type ajustement</TableHead>
                <TableHead className="text-right">Valeur</TableHead>
                <TableHead>Nom déclinaison</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map(cat =>
                salesRules.map(rule => {
                  const key = makeDeclinationKey(cat.id, rule.id);
                  const config = declinations[key] || { prefix: '', adjustmentType: 'percent' as const, adjustmentValue: 0 };
                  const displayName = getDeclinationName(config.prefix, cat.name, rule.name);

                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                          <span className="font-medium">{cat.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {rule.name} <span className="ml-1 opacity-60">({rule.type.toUpperCase()})</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={config.prefix}
                          onChange={e => updateField(key, 'prefix', e.target.value)}
                          placeholder="Ex: OEM-"
                          className="h-8 text-sm w-28"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={config.adjustmentType}
                          onValueChange={v => updateField(key, 'adjustmentType', v)}
                        >
                          <SelectTrigger className="h-8 text-sm w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percent">Pourcentage (%)</SelectItem>
                            <SelectItem value="fixed">Montant fixe (€)</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={config.adjustmentValue}
                          onChange={e => updateField(key, 'adjustmentValue', parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm font-mono w-24 text-right"
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground italic">{displayName}</span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
