import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SlidersHorizontal } from 'lucide-react';
import { DEFAULT_CRM_FILTER, type CrmDisplayFilter } from './crmDisplayFilter';

const toggle = (list: string[], v: string) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" size="sm" variant={on ? 'default' : 'outline'} className="h-7" onClick={onClick}>{children}</Button>;
}
export function CrmDisplaySettings({ value, onChange, categories, shown, total }: { value: CrmDisplayFilter; onChange: (f: CrmDisplayFilter) => void; categories: { id: string; name: string }[]; shown: number; total: number }) {
  const active = JSON.stringify(value) !== JSON.stringify(DEFAULT_CRM_FILTER);
  return <Popover><PopoverTrigger asChild><Button variant={active ? 'default' : 'outline'} size="sm" data-readonly-allow="true"><SlidersHorizontal className="mr-2 h-4 w-4" />Clients affichés {active ? `(${shown}/${total})` : ''}</Button></PopoverTrigger>
    <PopoverContent className="w-80 space-y-3" align="start">
      <div><p className="mb-1 text-xs font-medium text-muted-foreground">Canal (aucun = tous)</p><div className="flex flex-wrap gap-1">{['B2C','B2B','OEM'].map(c => <Chip key={c} on={value.channels.includes(c)} onClick={() => onChange({ ...value, channels: toggle(value.channels, c) })}>{c}</Chip>)}</div></div>
      <div><p className="mb-1 text-xs font-medium text-muted-foreground">Catégorie CRM (aucune = toutes)</p><div className="flex flex-wrap gap-1">{[...categories, { id: 'none', name: 'Sans catégorie' }].map(c => <Chip key={c.id} on={value.categories.includes(c.id)} onClick={() => onChange({ ...value, categories: toggle(value.categories, c.id) })}>{c.name}</Chip>)}</div></div>
      <div><p className="mb-1 text-xs font-medium text-muted-foreground">Statut</p><div className="flex gap-1">{([['all','Tous'],['active','Actifs'],['inactive','Inactifs']] as const).map(([k,l]) => <Chip key={k} on={value.activity === k} onClick={() => onChange({ ...value, activity: k })}>{l}</Chip>)}</div></div>
      <div><p className="mb-1 text-xs font-medium text-muted-foreground">Lien Erplain</p><div className="flex gap-1">{([['all','Tous'],['linked','Rattachés'],['new','Nouveaux']] as const).map(([k,l]) => <Chip key={k} on={value.link === k} onClick={() => onChange({ ...value, link: k })}>{l}</Chip>)}</div></div>
      <div className="flex items-center justify-between border-t pt-2 text-xs text-muted-foreground"><span>{shown} / {total} clients affichés</span><Button size="sm" variant="ghost" disabled={!active} onClick={() => onChange(DEFAULT_CRM_FILTER)}>Tout afficher</Button></div>
    </PopoverContent></Popover>;
}
