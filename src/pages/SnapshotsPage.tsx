import { useState } from 'react';
import { useSnapshots } from '@/hooks/useSnapshots';
import { useAuth } from '@/context/AuthContext';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Save, Download, Trash2, Plus, Loader2, Database } from 'lucide-react';

export function SnapshotsPage() {
  const { snapshots, isLoading, createSnapshot, restoreSnapshot, deleteSnapshot, formatDate } = useSnapshots();
  const { getTabPermission } = useAuth();
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [creating, setCreating] = useState(false);

  const permission = getTabPermission('snapshots');
  const canWrite = permission === 'write';

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    setCreating(true);
    const ok = await createSnapshot(name.trim(), comment.trim() || undefined);
    if (ok) { setName(''); setComment(''); }
    setCreating(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ReadOnlyWrapper tabKey="snapshots">
      <div className="space-y-6">
        <HeroBanner image="rd" title="Sauvegardes" subtitle="Gérez vos sauvegardes de scénarios financiers" height="sm" />

        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Nouvelle sauvegarde</CardTitle>
              <CardDescription>Sauvegardez l'état actuel de vos données financières</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Budget V2 validé" />
                </div>
                <div className="space-y-2">
                  <Label>Commentaire (optionnel)</Label>
                  <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Notes..." rows={1} />
                </div>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Sauvegardes existantes</CardTitle>
            <CardDescription>{snapshots.length} sauvegarde{snapshots.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {snapshots.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune sauvegarde pour le moment</p>
            ) : (
              <div className="space-y-3">
                {snapshots.map(snap => (
                  <div key={snap.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{snap.name}</span>
                        <Badge variant="outline" className="text-xs">{formatDate(snap.createdAt)}</Badge>
                      </div>
                      {snap.comment && <p className="text-sm text-muted-foreground">{snap.comment}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {canWrite && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Download className="h-4 w-4 mr-1" />Charger
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Restaurer cette sauvegarde ?</AlertDialogTitle>
                              <AlertDialogDescription>Les données actuelles seront remplacées par « {snap.name} ». Cette action rechargera la page.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => restoreSnapshot(snap.id)}>Restaurer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {canWrite && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Supprimer « {snap.name} » ?</AlertDialogTitle>
                              <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteSnapshot(snap.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ReadOnlyWrapper>
  );
}
