import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { B2BClient } from '@/hooks/useB2BClientsData';

interface B2BTrashBinProps {
  trashedClients: B2BClient[];
  onRestore: (id: string) => Promise<void>;
  onPermanentDelete: (id: string) => Promise<void>;
  isAdmin: boolean;
}

export function B2BTrashBin({ trashedClients, onRestore, onPermanentDelete, isAdmin }: B2BTrashBinProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const clientToDelete = trashedClients.find(c => c.id === confirmDeleteId);

  if (trashedClients.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>La corbeille est vide</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="h-5 w-5" />
            Corbeille ({trashedClients.length} client{trashedClients.length > 1 ? 's' : ''})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {trashedClients.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                <div>
                  <div className="font-medium text-sm">{c.company_name}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    {c.country && <span>{c.country}</span>}
                    {c.contact_email && <span>• {c.contact_email}</span>}
                    {c.deleted_at && (
                      <span>• Supprimé le {new Date(c.deleted_at).toLocaleDateString('fr-FR')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onRestore(c.id)}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    Restaurer
                  </Button>
                  {isAdmin && (
                    <Button size="sm" variant="destructive" onClick={() => setConfirmDeleteId(c.id)}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Supprimer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Seul un administrateur peut supprimer définitivement un client.
            </p>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={open => !open && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement <strong>{clientToDelete?.company_name}</strong> ?
              Cette action est irréversible. Toutes les données associées seront perdues.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (confirmDeleteId) { onPermanentDelete(confirmDeleteId); setConfirmDeleteId(null); } }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
