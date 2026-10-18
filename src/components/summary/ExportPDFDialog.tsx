import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export function ExportPDFDialog() {
  return (
    <Button variant="outline" size="sm" onClick={() => { window.dispatchEvent(new Event("resize")); setTimeout(() => window.print(), 300); }}>
      <Download className="h-4 w-4 mr-1" />
      Export PDF
    </Button>
  );
}
