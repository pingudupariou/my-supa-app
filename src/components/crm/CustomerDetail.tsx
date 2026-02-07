import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/data/financialConfig';

interface CustomerDetailProps {
  customer: any;
  orders: any[];
  onRefresh: () => void;
}

export function CustomerDetail({ customer, orders }: CustomerDetailProps) {
  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {customer.company_name}
          <Badge>{customer.status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Contact:</span>
            <span className="ml-2">{customer.contact_name || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Email:</span>
            <span className="ml-2">{customer.email || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Ville:</span>
            <span className="ml-2">{customer.city || '-'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">CA Total:</span>
            <span className="ml-2 font-mono-numbers">{formatCurrency(totalRevenue, true)}</span>
          </div>
        </div>
        {orders.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-2">Commandes ({orders.length})</h4>
            <div className="space-y-1">
              {orders.slice(0, 5).map((order: any) => (
                <div key={order.id} className="flex justify-between text-sm p-2 bg-muted/30 rounded">
                  <span>{order.order_reference}</span>
                  <span className="font-mono-numbers">{formatCurrency(order.total_amount, true)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
