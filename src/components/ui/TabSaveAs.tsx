import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFinancial } from '@/context/FinancialContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bookmark, RotateCcw, Trash2 } from 'lucide-react';
import { TAB_FIELDS, pickTabData, type SavedTabKey } from '@/lib/tabSaveData';


interface TabSave { id: string; name: string; created_at: string; creator_email: string | null; data: Record<string, unknown> }

export function TabSaveAs({ tabKey, label }: { tabKey: keyof typeof TAB_FIELDS; label: string }) {
  const { state, applyTabData, setActiveTabSave } = useFinancial();
  const active = state.activeTabSaves[tabKey];
  const { user, getTabPermission } = useAuth() as any;
  const canWrite = getTabPermission ? getTabPermission(tabKey) === 'write' : true;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [saves, setSaves] = useState<TabSave[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('tab_saves' as any).select('*').eq('tab_key', tabKey).order('created_at', { ascending: false });
    if (error) { toast({ title: 'Chargement impossible', description: error.message, variant: 'destructive' }); return; }
    setSaves((data as any) ?? []);
  }, [tabKey]);

  useEffect(() => { if (open) load(); }, [open, load]);
  useEffect(() => {
    const requestOpen = () => setOpen(true);
    window.addEventListener(`tab-save-as:${tabKey}`, requestOpen);
    return () => window.removeEventListener(`tab-save-as:${tabKey}`, requestOpen);
  }, [tabKey]);

  const save = async () => {
    if (!name.trim() || !user || !canWrite || busy) return;
    setBusy(true);
    const { data: saved, error } = await supabase.from('tab_saves' as any).insert({ tab_key: tabKey, name: name.trim(), data: pickTabData(state, tabKey), user_id: user.id, creator_email: user.email } as any).select('id,name').single();
    setBusy(false);
    if (error || !saved) { toast({ title: 'Erreur', description: "Sauvegarde de l'onglet impossible.", variant: 'destructive' }); return; }
    setActiveTabSave(tabKey, saved as unknown as { id: string; name: string });
    setName('');
    toast({ title: 'Version enregistrée', description: `« ${name.trim()} » (${label}) — la sauvegarde globale n'a pas changé.` });
    load();
  };

  const restore = (s: TabSave) => {
    const partial: Record<string, unknown> = {};
    for (const f of TAB_FIELDS[tabKey]) if (s.data[f] !== undefined) partial[f] = s.data[f];
    applyTabData(partial as any);
    setActiveTabSave(tabKey, { id: s.id, name: s.name });
    setOpen(false);
    toast({ title: 'Sauvegarde ouverte', description: `« ${s.name} » — ${label}.` });
  };

  const remove = async (s: TabSave) => {
    if (!canWrite || !window.confirm(`Supprimer « ${s.name} » ?`)) return;
    const { data, error } = await supabase.from('tab_saves' as any).delete().eq('id', s.id).select('id');
    if (error || !data?.length) { toast({ title: 'Erreur', description: 'Suppression impossible.', variant: 'destructive' }); return; }
    if (active?.id === s.id) setActiveTabSave(tabKey, null);
    setSaves(prev => prev.filter(x => x.id !== s.id));
  };

  return (
    <>
      <div className="text-sm min-w-0 max-w-full" aria-label={`Sauvegarde ouverte — ${label}`}>
        <span className="text-muted-foreground">Sauvegarde ouverte : </span>
        <strong className="break-words">{active?.name ?? 'Non enregistrée'}</strong>
      </div>
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
                {canWrite && <Button size="sm" variant="secondary" onClick={() => restore(s)}><RotateCcw className="h-4 w-4 mr-1" />{active?.id === s.id ? 'Ouverte' : 'Ouvrir'}</Button>}
                {canWrite && <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(s)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Met à jour uniquement la sauvegarde ouverte ; aucun nouvel exemplaire implicite. */
export function useSaveWithTabVersion(tabKey: SavedTabKey) {
  const { state, persistLocal } = useFinancial();
  const { user, getTabPermission } = useAuth();
  const [busy, setBusy] = useState(false);
  return useCallback(async () => {
    if (!user || getTabPermission(tabKey) !== 'write' || busy) return;
    const active = state.activeTabSaves[tabKey];
    if (!active) { window.dispatchEvent(new Event(`tab-save-as:${tabKey}`)); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from('tab_saves' as any)
        .update({ data: pickTabData(state, tabKey) } as any).eq('id', active.id).eq('tab_key', tabKey).select('id').single();
      if (error || !data) throw new Error(error?.message ?? 'La sauvegarde n’existe plus ou vous ne pouvez pas la modifier.');
      persistLocal();
      toast({ title: 'Onglet sauvegardé', description: `« ${active.name} » mis à jour. La sauvegarde globale n’a pas changé.` });
    } catch (error) {
      toast({ title: 'Sauvegarde impossible', description: error instanceof Error ? error.message : 'Veuillez réessayer.', variant: 'destructive' });
    } finally { setBusy(false); }
  }, [persistLocal, state, user, getTabPermission, tabKey, busy]);
}
