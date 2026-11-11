import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, Unlink } from 'lucide-react';
import type { ClassifiedCustomer } from './classificationModel';

export function ErplainCustomerPicker({ customers, value, disabled, onChange }: {
  customers: ClassifiedCustomer[];
  value: string | null;
  disabled: boolean;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = customers.find(c => c.customer_id === value);
  const matches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fr');
    return customers.filter(c => `${c.customer_name ?? ''} ${c.customer_id}`.toLocaleLowerCase('fr').includes(query));
  }, [customers, search]);
  const choose = (id: string | null) => { onChange(id); setOpen(false); };
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" disabled={disabled} className="w-64 justify-between" aria-label="Choisir le client Erplain lié"><span className="truncate">{value ? selected?.customer_name || value : 'Non lié à Erplain'}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" /></Button></PopoverTrigger>
    <PopoverContent className="w-80 space-y-2" align="start">
      {open && <><Input aria-label="Rechercher le client Erplain à lier" placeholder="Nom ou ID Erplain…" value={search} onChange={e => setSearch(e.target.value)} />
        <Button variant="ghost" size="sm" onClick={() => choose(null)}><Unlink className="mr-2 h-4 w-4" />Non lié à Erplain</Button>
        <div className="max-h-64 overflow-y-auto">{matches.slice(0, 50).map(c => <Button key={c.customer_id} variant="ghost" className="h-auto w-full justify-start whitespace-normal text-left" onClick={() => choose(c.customer_id)}><span>{c.customer_name || 'Sans nom'}<span className="block text-xs text-muted-foreground">{c.customer_id}</span></span></Button>)}</div>
        <p className="text-xs text-muted-foreground">{Math.min(matches.length, 50)} / {matches.length} clients</p></>}
    </PopoverContent>
  </Popover>;
}