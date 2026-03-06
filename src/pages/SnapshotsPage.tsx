import { useState } from 'react';
import { useSnapshots, type Snapshot } from '@/hooks/useSnapshots';
import { useAuth } from '@/context/AuthContext';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Save, Download, Trash2, Plus, Loader2, Database, Copy, Shield, FileText, FileDown } from 'lucide-react';
import type { SnapshotType } from '@/hooks/useSnapshotData';

const SCENARIO_MODULES = ['Plan Produit', 'Organisation', 'Charges', 'Scénarios', 'Prévisionnel', 'Financement', 'Valorisation'];
const SYSTEM_MODULES = ['CRM', 'Plan Produit', 'Organisation', 'Charges', 'Scénarios', 'Prévisionnel', 'Financement', 'Valorisation', 'Pricing', 'Production & BE', 'Planning Dev', 'Suivi d\'activité'];

export function SnapshotsPage() {
  const {
    snapshots, isLoading, isSaving, activeSnapshotName,
    createSnapshot, restoreSnapshot, deleteSnapshot, duplicateSnapshot, downloadSnapshot, formatDate,
  } = useSnapshots();
  const { getTabPermission, isAdmin } = useAuth();
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const [newType, setNewType] = useState<SnapshotType>('scenario');

  const permission = getTabPermission('snapshots');
  const canWrite = permission === 'write';

  const systemSnapshots = snapshots.filter(s => s.snapshotType === 'system');
  const scenarioSnapshots = snapshots.filter(s => s.snapshotType === 'scenario');

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    const ok = await createSnapshot(name.trim(), comment.trim() || undefined, newType);
    if (ok) { setName(''); setComment(''); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderSnapshotRow = (snap: Snapshot) => {
    const isSystem = snap.snapshotType === 'system';
    const modules = isSystem ? SYSTEM_MODULES : SCENARIO_MODULES;
    const canRestore = isSystem ? isAdmin : canWrite;
    const canDelete = isSystem ? isAdmin : canWrite;
    const canDuplicate = snap.snapshotType === 'scenario' && canWrite;

    return (
      <div key={snap.id} className="flex flex-col gap-3 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
        <div className="flex items-center justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium truncate">{snap.name}</span>
              <Badge variant={isSystem ? 'destructive' : 'default'} className="text-[10px] shrink-0">
                {isSystem ? '🔒 Système' : '📋 Scénario'}
              </Badge>
              <Badge variant="outline" className="text-[10px] shrink-0">{formatDate(snap.createdAt)}</Badge>
            </div>
            {snap.creatorEmail && (
              <p className="text-xs text-muted-foreground">par {snap.creatorEmail}</p>
            )}
            {snap.comment && <p className="text-sm text-muted-foreground">{snap.comment}</p>}
            <div className="flex flex-wrap gap-1 mt-1">
              {modules.map(m => (
                <Badge key={m} variant="secondary" className="text-[9px] py-0 px-1.5">{m}</Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {canRestore && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" disabled={isSaving}>
                    <Download className="h-3.5 w-3.5 mr-1" />Charger
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restaurer « {snap.name} » ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {isSystem
                        ? 'Toutes les données de l\'application seront remplacées. Cette action est majeure.'
                        : 'Les données de scénario (prévisions, produits, charges...) seront remplacées.'}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => restoreSnapshot(snap.id)}>Restaurer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            {canDuplicate && (
              <Button variant="ghost" size="sm" disabled={isSaving} onClick={() => duplicateSnapshot(snap.id)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}

            {isAdmin && isSystem && (
              <Button variant="ghost" size="sm" onClick={() => downloadSnapshot(snap.id)}>
                <FileDown className="h-3.5 w-3.5" />
              </Button>
            )}

            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer « {snap.name} » ?</AlertDialogTitle>
                    <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteSnapshot(snap.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ReadOnlyWrapper tabKey="snapshots">
      <div className="space-y-6">
        <HeroBanner
          image="rd"
          title="Sauvegardes"
          subtitle={activeSnapshotName ? `Version en cours : ${activeSnapshotName}` : 'Aucune version chargée'}
          height="sm"
        />

        {canWrite && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" />Nouvelle sauvegarde</CardTitle>
              <CardDescription>
                {isAdmin
                  ? 'Créez une sauvegarde système (complète) ou scénario (données de prévision).'
                  : 'Créez une sauvegarde scénario pour figer vos données de prévision.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Nom</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Budget V2 validé" />
                </div>
                <div className="space-y-2">
                  <Label>Commentaire</Label>
                  <Textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Notes..." rows={1} />
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newType} onValueChange={(v) => setNewType(v as SnapshotType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="scenario">📋 Scénario</SelectItem>
                        <SelectItem value="system">🔒 Système</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button onClick={handleCreate} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin ? (
          <Tabs defaultValue="scenario" className="w-full">
            <TabsList>
              <TabsTrigger value="scenario" className="gap-1.5">
                <FileText className="h-4 w-4" />Scénarios ({scenarioSnapshots.length})
              </TabsTrigger>
              <TabsTrigger value="system" className="gap-1.5">
                <Shield className="h-4 w-4" />Système ({systemSnapshots.length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="scenario">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Snapshots scénario</CardTitle>
                  <CardDescription>Versions de travail — Plan Produit, Organisation, Charges, Scénarios, Prévisionnel, Financement, Valorisation</CardDescription>
                </CardHeader>
                <CardContent>
                  {scenarioSnapshots.length === 0
                    ? <p className="text-center text-muted-foreground py-8">Aucun snapshot scénario</p>
                    : <div className="space-y-3">{scenarioSnapshots.map(renderSnapshotRow)}</div>}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="system">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-destructive" />Snapshots système</CardTitle>
                  <CardDescription>Sauvegarde complète de la base de données — tous les modules inclus</CardDescription>
                </CardHeader>
                <CardContent>
                  {systemSnapshots.length === 0
                    ? <p className="text-center text-muted-foreground py-8">Aucun snapshot système</p>
                    : <div className="space-y-3">{systemSnapshots.map(renderSnapshotRow)}</div>}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Snapshots scénario</CardTitle>
              <CardDescription>{scenarioSnapshots.length} sauvegarde{scenarioSnapshots.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              {scenarioSnapshots.length === 0
                ? <p className="text-center text-muted-foreground py-8">Aucun snapshot scénario</p>
                : <div className="space-y-3">{scenarioSnapshots.map(renderSnapshotRow)}</div>}
            </CardContent>
          </Card>
        )}
      </div>
    </ReadOnlyWrapper>
  );
}
