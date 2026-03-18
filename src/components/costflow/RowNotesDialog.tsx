import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlanningNote } from '@/hooks/usePlanningNotes';
import { PlanningBlock, PlanningColor } from '@/hooks/usePlanningData';
import { FileText } from 'lucide-react';

interface RowNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowLabel: string;
  rowBlocks: PlanningBlock[];
  notes: PlanningNote[];
  colors: PlanningColor[];
  monthLabels: string[];
  onOpenBlockNote: (block: PlanningBlock) => void;
}

export function RowNotesDialog({ open, onOpenChange, rowLabel, rowBlocks, notes, colors, monthLabels, onOpenBlockNote }: RowNotesDialogProps) {
  const getColor = (colorId: string | null) => colors.find(c => c.id === colorId);

  const sortedBlocks = [...rowBlocks].sort((a, b) => a.start_month - b.start_month);
  const notesCount = notes.filter(n => n.content.trim() !== '').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Récap notes — {rowLabel}
            {notesCount > 0 && (
              <span className="text-xs font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {notesCount} note{notesCount > 1 ? 's' : ''}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] pr-2">
          {sortedBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Aucun bloc sur cette ligne.</p>
          ) : (
            <div className="space-y-4">
              {sortedBlocks.map(block => {
                const color = getColor(block.color_id);
                const note = notes.find(n => n.block_id === block.id);
                const startLabel = monthLabels[block.start_month - 1] || `M${block.start_month}`;
                const endMonth = block.start_month + block.duration - 1;
                const endLabel = monthLabels[endMonth - 1] || `M${endMonth}`;
                const hasNote = note && note.content.trim() !== '';

                return (
                  <div
                    key={block.id}
                    className="border rounded-lg p-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => { onOpenChange(false); onOpenBlockNote(block); }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {color && <div className="w-3 h-3 rounded" style={{ backgroundColor: color.color }} />}
                      <span className="font-medium text-sm">{block.label || color?.name || 'Bloc'}</span>
                      <span className="text-xs text-muted-foreground">
                        {startLabel} → {endLabel} ({block.duration} mois)
                      </span>
                    </div>
                    {hasNote ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Aucune note — cliquez pour en ajouter</p>
                    )}
                    {hasNote && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Mis à jour le {new Date(note.updated_at).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
