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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Notes — {rowLabel}
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
                        {startLabel} → {endLabel}
                      </span>
                    </div>
                    {note ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Aucune note — cliquez pour en ajouter</p>
                    )}
                    {note && (
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
