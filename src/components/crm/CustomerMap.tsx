import { Card, CardContent } from '@/components/ui/card';
import { MapPin } from 'lucide-react';

interface CustomerMapProps {
  customers: any[];
  selectedId: string | null;
  onSelectCustomer: (id: string) => void;
}

export function CustomerMap({ customers }: CustomerMapProps) {
  const withCoords = customers.filter((c: any) => c.latitude && c.longitude);

  return (
    <div className="h-[400px] bg-muted/30 rounded-lg flex items-center justify-center">
      <div className="text-center text-muted-foreground">
        <MapPin className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>{withCoords.length} clients géolocalisés</p>
        <p className="text-xs mt-1">Carte interactive (Leaflet)</p>
      </div>
    </div>
  );
}
