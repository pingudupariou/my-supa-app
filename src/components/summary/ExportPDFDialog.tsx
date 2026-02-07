import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function ExportPDFDialog() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()}>
      <Download className="h-4 w-4 mr-1" />
      Export PDF
    </Button>
  );
}
