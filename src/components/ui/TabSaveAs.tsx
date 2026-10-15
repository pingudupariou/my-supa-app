import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFinancial } from '@/context/FinancialContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bookmark, RotateCcw, Trash2 } from 'lucide-react';

/** Champs de l'état financier propres à chaque onglet (sauvegarde locale à l'onglet). */
const TAB_FIELDS: Record<string, string[]> = {
  'product-plan': ['products', 'productCategories', 'revenueMode', 'globalRevenueConfig', 'clientRevenueConfig', 'roadmapBlocks'],
  charges: ['expenses', 'opexMode', 'simpleOpexConfig'],
  organisation: ['roles', 'hiringSimulation'],
};

interface TabSave { id: string; name: string; created_at: string; creator_email: string | null; data: Record<string, unknown> }

export function TabSaveAs({ tabKey, label }: { tabKey: keyof typeof TAB_FIELDS; label: string }) {
  const { state, applyTabData } = useFinancial();
  const { user, getTabPermission } = useAuth() as any;
  const canWrite = getTabPermission ? getTabPermission(tabKey) === 'write' : true;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saves, setSaves] = useState<TabSave[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('tab_saves' as any).select('*').eq('tab_key', tabKey).order('created_at', { ascending: false });
    setSaves((data as any) ?? []);
  }, [tabKey]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const save = async () => {
    if (!name.trim() || !user) return;
    setBusy(true);
    const data: Record<string, unknown> = {};
    for (const f of TAB_FIELDS[tabKey]) data[f] = (state as any)[f];
    const { error } = await supabase.from('tab_saves' as any).insert({ tab_key: tabKey, name: name.trim(), data, user_id: user.id, creator_email: user.email } as any);
    setBusy(false);
    if (error) { toast({ title: 'Erreur', description: "Sauvegarde de l'onglet impossible.", variant: 'destructive' }); return; }
    setName('');
    toast({ title: 'Version enregistrée', description: `« ${name.trim()} » (${label}) — la sauvegarde globale n'a pas changé.` });
    load();
  };

  const restore = (s: TabSave) => {
    const partial: Record<string, unknown> = {};
    for (const f of TAB_FIELDS[tabKey]) if (s.data[f] !== undefined) partial[f] = s.data[f];
    applyTabData(partial as any);
    setOpen(false);
    toast({ title: 'Version restaurée', description: `« ${s.name} » appliquée à ${label} uniquement. Cliquez « Sauvegarder » pour la garder dans le plan.` });
  };

  const remove = async (s: TabSave) => {
    const { error } = await supabase.from('tab_saves' as any).delete().eq('id', s.id);
    if (error) { toast({ title: 'Erreur', description: 'Suppression impossible.', variant: 'destructive' }); return; }
    setSaves(prev => prev.filter(x => x.id !== s.id));
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bookmark className="h-4 w-4 mr-1" /> Versions de l'onglet
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Versions — {label}</DialogTitle>
            <DialogDescription>
              « Enregistrer sous » garde une copie de cet onglet seulement. La sauvegarde globale et les autres onglets ne changent pas.
            </DialogDescription>
          </DialogHeader>
          {canWrite && (
            <div className="flex gap-2">
              <Input placeholder="Nom de la version (ex. Plan prudent)" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
              <Button onClick={save} disabled={busy || !name.trim()}>Enregistrer sous</Button>
            </div>
          )}
          <div className="max-h-80 overflow-y-auto divide-y rounded-md border">
            {saves.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucune version enregistrée pour cet onglet.</p>}
            {saves.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}{s.creator_email ? ` · ${s.creator_email}` : ''}
                  </div>
                </div>
                {canWrite && <Button size="sm" variant="secondary" onClick={() => restore(s)}><RotateCcw className="h-4 w-4 mr-1" />Revenir</Button>}
                {canWrite && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(s)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
