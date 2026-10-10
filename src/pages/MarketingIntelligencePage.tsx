import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export function MarketingIntelligencePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const test = async () => {
    setLoading(true); setResult(null);
    const { data, error } = await supabase.functions.invoke('shopify-test');
    setResult(error ? { status: 'error', message: error.message } : data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Marketing Intelligence</h1>
      <Card>
        <CardHeader><CardTitle>Connexion Shopify</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Test en lecture seule : 5 produits et 5 commandes, rien n'est enregistré.</p>
          <Button onClick={test} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Tester la connexion Shopify
          </Button>
          {result?.status === 'error' && (
            <p className="text-sm text-destructive">Échec{result.step ? ` (${result.step})` : ''} : {result.message}</p>
          )}
          {result?.status === 'success' && (
            <div className="space-y-4 text-sm">
              <p>Connecté à <b>{result.shop?.name}</b> ({result.shop?.myshopifyDomain}) — droits : {result.scopes}</p>
              <div>
                <h3 className="font-semibold mb-1">Produits</h3>
                <ul className="list-disc pl-5">{result.products.map((p: any) => <li key={p.id}>{p.title} — {p.status} — stock {p.totalInventory ?? '—'}</li>)}</ul>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Commandes</h3>
                <ul className="list-disc pl-5">{result.orders.map((o: any) => (
                  <li key={o.id}>{o.name} — {new Date(o.createdAt).toLocaleDateString('fr-FR')} — {o.totalPriceSet?.shopMoney?.amount} {o.totalPriceSet?.shopMoney?.currencyCode} — {o.shippingAddress?.countryCodeV2 ?? '—'} — {o.displayFinancialStatus}</li>
                ))}</ul>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
