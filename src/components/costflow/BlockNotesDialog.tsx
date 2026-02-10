import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PlanningNote } from '@/hooks/usePlanningNotes';
import { PlanningBlock, PlanningColor } from '@/hooks/usePlanningData';
import { Save } from 'lucide-react';

interface BlockNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: PlanningBlock | null;
  color: PlanningColor | undefined;
  existingNote: PlanningNote | undefined;
  onSave: (blockId: string, content: string) => void;
  monthLabels: string[];
}

export function BlockNotesDialog({ open, onOpenChange, block, color, existingNote, onSave, monthLabels }: BlockNotesDialogProps) {
  const [content, setContent] = useState('');

  useEffect(() => {
    setContent(existingNote?.content || '');
  }, [existingNote, open]);

  if (!block) return null;

  const startLabel = monthLabels[block.start_month - 1] || `M${block.start_month}`;
  const endMonth = block.start_month + block.duration - 1;
  const endLabel = monthLabels[endMonth - 1] || `M${endMonth}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {color && <div className="w-4 h-4 rounded" style={{ backgroundColor: color.color }} />}
            <span>{block.label || color?.name || 'Bloc'}</span>
            <span className="text-sm font-normal text-muted-foreground">
              ({startLabel} → {endLabel})
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Notes sur l'avancement de cette phase…"
            className="min-h-[250px] text-sm"
          />
          <div className="flex justify-between items-center">
            {existingNote && (
              <span className="text-xs text-muted-foreground">
                Dernière mise à jour : {new Date(existingNote.updated_at).toLocaleDateString('fr-FR')}
              </span>
            )}
            <Button onClick={() => { onSave(block.id, content); onOpenChange(false); }} className="ml-auto">
              <Save className="h-4 w-4 mr-1" /> Sauvegarder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
