import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PricingTiersProps {
  tiers: any[];
  onRefresh: () => void;
}

export function PricingTiers({ tiers }: PricingTiersProps) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {tiers.map((tier: any) => (
        <Card key={tier.id}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <Badge variant={tier.tier === 'gold' ? 'default' : 'outline'}>{tier.tier}</Badge>
              <span className="text-2xl font-bold font-mono-numbers">-{tier.discount_percentage}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{tier.description || 'Grille tarifaire'}</p>
          </CardContent>
        </Card>
      ))}
      {tiers.length === 0 && <p className="text-muted-foreground col-span-3 text-center py-8">Aucune grille tarifaire configurée</p>}
    </div>
  );
}
