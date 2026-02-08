import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, Trash2, ArrowLeft, FileText } from 'lucide-react';
import type { CostFlowReference, CostFlowReferenceFile } from '@/hooks/useCostFlowData';

const VOLUME_TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

interface Props {
  reference: CostFlowReference;
  files: CostFlowReferenceFile[];
  onUploadFile: (referenceId: string, file: File) => Promise<void>;
  onDeleteFile: (fileId: string, filePath: string) => Promise<void>;
  onGetSignedUrl: (filePath: string) => Promise<string | null>;
  onBack: () => void;
}

export function ReferenceDetail({ reference, files, onUploadFile, onDeleteFile, onGetSignedUrl, onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFiles = files.filter(f => f.reference_id === reference.id);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await onUploadFile(reference.id, file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = async (file: CostFlowReferenceFile) => {
    const url = await onGetSignedUrl(file.file_path);
    if (url) window.open(url, '_blank');
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h3 className="text-lg font-semibold">{reference.code} — {reference.name}</h3>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary">{reference.category}</Badge>
            <Badge variant="outline">Rév. {reference.revision}</Badge>
            {reference.supplier && <Badge variant="outline">{reference.supplier}</Badge>}
          </div>
        </div>
      </div>

      {/* Price grid */}
      <div className="financial-card p-4">
        <h4 className="section-title">Grille de prix ({reference.currency})</h4>
        <div className="grid grid-cols-8 gap-2">
          {VOLUME_TIERS.map(vol => (
            <div key={vol} className="text-center">
              <div className="text-xs text-muted-foreground mb-1">{vol} u.</div>
              <div className="font-mono-numbers font-medium">{reference.prices[vol]?.toFixed(2) || '—'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comments */}
      {reference.comments && (
        <div className="financial-card p-4">
          <h4 className="section-title">Commentaires</h4>
          <p className="text-sm text-muted-foreground">{reference.comments}</p>
        </div>
      )}

      {/* Technical plans */}
      <div className="financial-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h4 className="section-title mb-0">Plans techniques</h4>
          <div>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.png,.jpg,.jpeg" />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-3 w-3 mr-1" /> Ajouter un fichier
            </Button>
          </div>
        </div>

        {refFiles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun fichier. Cliquez sur "Ajouter un fichier" pour uploader un plan.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fichier</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Taille</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refFiles.map(file => (
                <TableRow key={file.id}>
                  <TableCell className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {file.file_name}
                  </TableCell>
                  <TableCell><Badge variant="outline">v{file.version}</Badge></TableCell>
                  <TableCell className="font-mono-numbers text-muted-foreground">{formatSize(file.file_size)}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(file.uploaded_at).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(file)}><Download className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => onDeleteFile(file.id, file.file_path)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
