import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { RotateCcw, Trash2, Package, Box } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { CostFlowProduct, CostFlowReference } from '@/hooks/useCostFlowData';

interface Props {
  trashedProducts: CostFlowProduct[];
  trashedReferences: CostFlowReference[];
  onRestoreProduct: (id: string) => Promise<void>;
  onPermanentDeleteProduct: (id: string) => Promise<void>;
  onRestoreReference: (id: string) => Promise<void>;
  onPermanentDeleteReference: (id: string) => Promise<void>;
}

export function TrashManager({
  trashedProducts, trashedReferences,
  onRestoreProduct, onPermanentDeleteProduct,
  onRestoreReference, onPermanentDeleteReference,
}: Props) {
  const totalItems = trashedProducts.length + trashedReferences.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Trash2 className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">Corbeille</h2>
          <p className="text-sm text-muted-foreground">
            {totalItems === 0 ? 'La corbeille est vide.' : `${totalItems} élément(s) — Restaurez ou supprimez définitivement.`}
          </p>
        </div>
      </div>

      {trashedProducts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4" /> Produits ({trashedProducts.length})
          </h3>
          <div className="border rounded overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Supprimé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trashedProducts.map(prod => (
                  <TableRow key={prod.id} className="opacity-70">
                    <TableCell className="font-medium">{prod.name}</TableCell>
                    <TableCell>{prod.main_supplier || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {prod.deleted_at ? format(new Date(prod.deleted_at), 'dd MMM yyyy HH:mm', { locale: fr }) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => onRestoreProduct(prod.id)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
                              <AlertDialogDescription>
                                Le produit « {prod.name} » et sa nomenclature seront supprimés définitivement. Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onPermanentDeleteProduct(prod.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Supprimer définitivement
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {trashedReferences.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Box className="h-4 w-4" /> Références ({trashedReferences.length})
          </h3>
          <div className="border rounded overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Supprimé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trashedReferences.map(ref => (
                  <TableRow key={ref.id} className="opacity-70">
                    <TableCell className="font-mono-numbers font-medium">{ref.code}</TableCell>
                    <TableCell>{ref.name}</TableCell>
                    <TableCell><Badge variant="secondary">{ref.category}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ref.deleted_at ? format(new Date(ref.deleted_at), 'dd MMM yyyy HH:mm', { locale: fr }) : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => onRestoreReference(ref.id)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Restaurer
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Suppression définitive</AlertDialogTitle>
                              <AlertDialogDescription>
                                La référence « {ref.code} — {ref.name} » sera supprimée définitivement. Cette action est irréversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onPermanentDeleteReference(ref.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Supprimer définitivement
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {totalItems === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>La corbeille est vide</p>
          <p className="text-xs mt-1">Les produits et références supprimés apparaîtront ici</p>
        </div>
      )}
    </div>
  );
}
