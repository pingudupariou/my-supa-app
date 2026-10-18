import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Download } from 'lucide-react';

function printWith(mode: 'standard' | 'bank') {
  if (mode === 'bank') document.body.classList.add('print-bank');
  const cleanup = () => { document.body.classList.remove('print-bank'); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.dispatchEvent(new Event('resize'));
  setTimeout(() => window.print(), 300);
}

export function ExportPDFDialog() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export PDF</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => printWith('standard')}>Synthèse actuelle</DropdownMenuItem>
        <DropdownMenuItem onClick={() => printWith('bank')}>Dossier financier (bancaire)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
