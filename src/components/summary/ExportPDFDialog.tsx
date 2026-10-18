import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { BankCommentKey, BankReportSettings, saveBankReportSettings, useBankReportSettings } from './bankReportSettings';

function printWith(mode: 'standard' | 'bank') {
  if (mode === 'bank') document.body.classList.add('print-bank');
  const cleanup = () => { document.body.classList.remove('print-bank'); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.dispatchEvent(new Event('resize'));
  setTimeout(() => window.print(), 300);
}

const COMMENT_FIELDS: { key: BankCommentKey; label: string }[] = [
  { key: 'revenue', label: "Commentaire — Chiffre d'affaires et rentabilité" },
  { key: 'treasury', label: 'Commentaire — Trésorerie et financement' },
  { key: 'netResult', label: 'Commentaire — Compte de résultat' },
];

export function ExportPDFDialog({ autoComments }: { autoComments?: Record<BankCommentKey, string> }) {
  const settings = useBankReportSettings();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BankReportSettings>(settings);

  const openSettings = () => {
    setDraft({
      ...settings,
      comments: Object.fromEntries(COMMENT_FIELDS.map(f => [f.key, settings.comments[f.key] || autoComments?.[f.key] || ''])),
    });
    setOpen(true);
  };

  const onLogo = (file?: File) => {
    if (!file) return;
    if (file.size > 800_000) { toast.error('Logo trop lourd (800 Ko maximum).'); return; }
    const reader = new FileReader();
    reader.onload = () => setDraft(d => ({ ...d, logoDataUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const save = (thenPrint: boolean) => {
    // Un commentaire identique au calcul automatique n'est pas figé : il suivra les données.
    const comments = Object.fromEntries(COMMENT_FIELDS
      .map(f => [f.key, (draft.comments[f.key] || '').trim()])
      .filter(([k, v]) => v && v !== (autoComments?.[k as BankCommentKey] || '').trim()));
    saveBankReportSettings({ ...draft, comments });
    setOpen(false);
    if (thenPrint) printWith('bank');
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Export PDF</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => printWith('standard')}>Synthèse actuelle</DropdownMenuItem>
          <DropdownMenuItem onClick={() => printWith('bank')}>Dossier financier (bancaire)</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openSettings}><Settings2 className="h-4 w-4 mr-2" />Paramétrer le dossier…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Paramètres du dossier financier</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                {draft.logoDataUrl
                  ? <img src={draft.logoDataUrl} alt="Logo du dossier" className="h-12 max-w-[160px] object-contain border rounded p-1" />
                  : <span className="text-xs text-muted-foreground">Logo Novaride par défaut</span>}
                <Input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="max-w-xs" onChange={e => onLogo(e.target.files?.[0])} />
                {draft.logoDataUrl && <Button variant="ghost" size="sm" onClick={() => setDraft(d => ({ ...d, logoDataUrl: undefined }))}>Retirer</Button>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank-project">Nom du projet (couverture)</Label>
              <Input id="bank-project" placeholder="Novaride — Business plan" value={draft.projectName ?? ''} onChange={e => setDraft(d => ({ ...d, projectName: e.target.value }))} />
            </div>
            {COMMENT_FIELDS.map(f => (
              <div key={f.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`bank-${f.key}`}>{f.label}</Label>
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs"
                    onClick={() => setDraft(d => ({ ...d, comments: { ...d.comments, [f.key]: autoComments?.[f.key] || '' } }))}>
                    Revenir au texte calculé
                  </Button>
                </div>
                <Textarea id={`bank-${f.key}`} rows={3} value={draft.comments[f.key] ?? ''}
                  onChange={e => setDraft(d => ({ ...d, comments: { ...d.comments, [f.key]: e.target.value } }))} />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Enregistré sur cet appareil. Un commentaire laissé vide ou identique au texte calculé suit automatiquement les chiffres.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => save(false)}>Enregistrer</Button>
            <Button onClick={() => save(true)}><Download className="h-4 w-4 mr-1" />Enregistrer et exporter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
