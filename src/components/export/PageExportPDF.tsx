import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export interface ExportableSection {
  id: string;
  label: string;
  elementId: string;
}

interface PageExportPDFProps {
  pageTitle: string;
  sections: ExportableSection[];
  fileName: string;
}

export function PageExportPDF({ pageTitle, fileName }: PageExportPDFProps) {
  const handleExport = () => {
    window.print();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4 mr-1" />
      PDF
    </Button>
  );
}
