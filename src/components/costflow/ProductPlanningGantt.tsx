import { useState, useRef, useCallback } from 'react';
import { usePlanningData, PlanningBlock, PlanningColor } from '@/hooks/usePlanningData';
import { usePlanningNotes } from '@/hooks/usePlanningNotes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Pencil, X, FileText, StickyNote } from 'lucide-react';
import { BlockNotesDialog } from './BlockNotesDialog';
import { RowNotesDialog } from './RowNotesDialog';

const ALL_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// Generate month labels with year for multi-year support
function buildMonthLabels(startMonth: number, endMonth: number): { label: string; globalIndex: number }[] {
  const result: { label: string; globalIndex: number }[] = [];
  for (let i = startMonth; i <= endMonth; i++) {
    result.push({ label: ALL_MONTHS[(i - 1) % 12], globalIndex: i });
  }
  return result;
}

export function ProductPlanningGantt() {
  const {
    colors, rows, blocks, loading,
    createColor, updateColor, deleteColor,
    createRow, updateRow, deleteRow,
    createBlock, updateBlock, deleteBlock,
  } = usePlanningData();

  const { notes, getNotesForBlock, getNotesForBlocks, upsertNote } = usePlanningNotes();

  // Calendar range
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(12);

  const [newRowLabel, setNewRowLabel] = useState('');
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingRowLabel, setEditingRowLabel] = useState('');
  const [showColorDialog, setShowColorDialog] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [newColorHex, setNewColorHex] = useState('#3b82f6');
  const [editingColorId, setEditingColorId] = useState<string | null>(null);

  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockForm, setBlockForm] = useState({ row_id: '', start_month: 1, duration: 1, color_id: '', label: '' });
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  // Notes dialogs
  const [noteBlock, setNoteBlock] = useState<PlanningBlock | null>(null);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [rowNotesRow, setRowNotesRow] = useState<{ id: string; label: string } | null>(null);
  const [showRowNotes, setShowRowNotes] = useState(false);

  // Drag state
  const [dragging, setDragging] = useState<{ blockId: string; offsetMonth: number } | null>(null);
  const ganttRef = useRef<HTMLDivElement>(null);

  const visibleMonths = buildMonthLabels(rangeStart, rangeEnd);
  const monthCount = visibleMonths.length;
  const monthLabelsFull = visibleMonths.map(m => m.label);

  const getColor = (color_id: string | null) => colors.find(c => c.id === color_id);

  // Compute vertical lanes for overlapping blocks in a row
  const getBlockLanes = (rowBlocks: PlanningBlock[]) => {
    const sorted = [...rowBlocks].sort((a, b) => a.start_month - b.start_month);
    const lanes: { blockId: string; lane: number }[] = [];
    const laneEnds: number[] = [];
    for (const block of sorted) {
      const blockEnd = block.start_month + block.duration;
      let placed = false;
      for (let i = 0; i < laneEnds.length; i++) {
        if (block.start_month >= laneEnds[i]) {
          laneEnds[i] = blockEnd;
          lanes.push({ blockId: block.id, lane: i });
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push({ blockId: block.id, lane: laneEnds.length });
        laneEnds.push(blockEnd);
      }
    }
    return { lanes, maxLane: laneEnds.length };
  };

  const handleAddRow = () => {
    if (!newRowLabel.trim()) return;
    createRow(newRowLabel.trim());
    setNewRowLabel('');
  };

  const handleSaveRowEdit = (id: string) => {
    if (editingRowLabel.trim()) updateRow(id, editingRowLabel.trim());
    setEditingRow(null);
  };

  const openNewBlock = (row_id: string, globalMonth: number) => {
    setBlockForm({ row_id, start_month: globalMonth, duration: 1, color_id: colors[0]?.id || '', label: '' });
    setEditingBlockId(null);
    setShowBlockDialog(true);
  };

  const openEditBlock = (block: PlanningBlock) => {
    setBlockForm({
      row_id: block.row_id,
      start_month: block.start_month,
      duration: block.duration,
      color_id: block.color_id || '',
      label: block.label,
    });
    setEditingBlockId(block.id);
    setShowBlockDialog(true);
  };

  const handleSaveBlock = () => {
    const { row_id, start_month, duration, color_id, label } = blockForm;
    const cid = color_id || null;
    if (editingBlockId) {
      updateBlock(editingBlockId, { row_id, start_month, duration, color_id: cid, label });
    } else {
      createBlock(row_id, start_month, duration, cid, label);
    }
    setShowBlockDialog(false);
  };

  const handleSaveColor = () => {
    if (!newColorName.trim()) return;
    if (editingColorId) {
      updateColor(editingColorId, { name: newColorName.trim(), color: newColorHex });
    } else {
      createColor(newColorName.trim(), newColorHex);
    }
    setNewColorName('');
    setNewColorHex('#3b82f6');
    setEditingColorId(null);
    setShowColorDialog(false);
  };

  const startEditColor = (c: PlanningColor) => {
    setEditingColorId(c.id);
    setNewColorName(c.name);
    setNewColorHex(c.color);
    setShowColorDialog(true);
  };

  const openBlockNote = (block: PlanningBlock) => {
    setNoteBlock(block);
    setShowNoteDialog(true);
  };

  // Drag handlers
  const handleDragStart = (e: React.MouseEvent, block: PlanningBlock) => {
    e.preventDefault();
    const ganttEl = ganttRef.current;
    if (!ganttEl) return;
    const rect = ganttEl.getBoundingClientRect();
    const cellWidth = rect.width / monthCount;
    const mouseMonth = Math.floor((e.clientX - rect.left) / cellWidth) + rangeStart;
    setDragging({ blockId: block.id, offsetMonth: mouseMonth - block.start_month });
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !ganttRef.current) return;
    const rect = ganttRef.current.getBoundingClientRect();
    const cellWidth = rect.width / monthCount;
    const mouseMonth = Math.floor((e.clientX - rect.left) / cellWidth) + rangeStart;
    let newStart = mouseMonth - dragging.offsetMonth;
    const block = blocks.find(b => b.id === dragging.blockId);
    if (!block) return;
    newStart = Math.max(1, Math.min(newStart, 36 - block.duration));
    if (newStart !== block.start_month) {
      updateBlock(dragging.blockId, { start_month: newStart });
    }
  }, [dragging, blocks, updateBlock, monthCount, rangeStart]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  if (loading) return <div className="text-muted-foreground text-center py-8">Chargement…</div>;

  // Generate month options for range selectors (up to 36 months / 3 years)
  const monthOptions = Array.from({ length: 36 }, (_, i) => {
    const m = i + 1;
    const year = Math.floor(i / 12) + 1;
    const label = `${ALL_MONTHS[i % 12]} (A${year})`;
    return { value: m, label };
  });

  return (
    <div className="space-y-4">
      {/* Legend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Légende des couleurs</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
              setEditingColorId(null);
              setNewColorName('');
              setNewColorHex('#3b82f6');
              setShowColorDialog(true);
            }}>
              <Plus className="h-3 w-3 mr-1" /> Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {colors.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ajoutez des couleurs pour catégoriser vos blocs.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {colors.map(c => (
                <div key={c.id} className="flex items-center gap-2 group">
                  <div className="w-5 h-5 rounded border" style={{ backgroundColor: c.color }} />
                  <span className="text-sm">{c.name}</span>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100"
                    onClick={() => startEditColor(c)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                    onClick={() => deleteColor(c.id)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gantt chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Planning développement produits</CardTitle>
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Nouveau produit…"
                  value={newRowLabel}
                  onChange={e => setNewRowLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddRow()}
                  className="h-7 text-xs w-48"
                />
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAddRow} disabled={!newRowLabel.trim()}>
                  <Plus className="h-3 w-3 mr-1" /> Ligne
                </Button>
              </div>
            </div>
            {/* Range selector */}
            <div className="flex gap-4 items-center">
              <div className="flex gap-2 items-center">
                <Label className="text-xs whitespace-nowrap">Début :</Label>
                <Select value={String(rangeStart)} onValueChange={v => {
                  const val = Number(v);
                  setRangeStart(val);
                  if (val > rangeEnd) setRangeEnd(val);
                }}>
                  <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 items-center">
                <Label className="text-xs whitespace-nowrap">Fin :</Label>
                <Select value={String(rangeEnd)} onValueChange={v => {
                  const val = Number(v);
                  setRangeEnd(val);
                  if (val < rangeStart) setRangeStart(val);
                }}>
                  <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.filter(o => o.value >= rangeStart).map(o => (
                      <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-muted-foreground">{monthCount} mois affichés</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <div
            className="min-w-[900px]"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Month headers */}
            <div className="border-b bg-muted/50" style={{ display: 'grid', gridTemplateColumns: `200px repeat(${monthCount}, 1fr)` }}>
              <div className="px-3 py-2 text-xs font-semibold border-r">Produit</div>
              {visibleMonths.map((m, i) => (
                <div key={i} className="px-1 py-2 text-xs font-semibold text-center border-r last:border-r-0">{m.label}</div>
              ))}
            </div>

            {/* Rows */}
            {rows.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                Ajoutez des lignes produit pour commencer le planning
              </div>
            )}
            {rows.map(row => {
              const rowBlocks = blocks.filter(b => b.row_id === row.id);
              const { lanes, maxLane } = getBlockLanes(rowBlocks);
              const rowHeight = Math.max(44, maxLane * 32 + 12);
              return (
                <div key={row.id} className="border-b group/row hover:bg-muted/20" style={{ display: 'grid', gridTemplateColumns: `200px repeat(${monthCount}, 1fr)`, minHeight: rowHeight }}>
                  {/* Row label */}
                  <div className="px-3 py-2 text-sm border-r flex items-center gap-1" style={{ minHeight: rowHeight }}>
                    {editingRow === row.id ? (
                      <Input
                        value={editingRowLabel}
                        onChange={e => setEditingRowLabel(e.target.value)}
                        onBlur={() => handleSaveRowEdit(row.id)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveRowEdit(row.id)}
                        autoFocus
                        className="h-6 text-xs"
                      />
                    ) : (
                      <>
                        <span className="truncate flex-1 font-medium">{row.label}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/row:opacity-100 shrink-0"
                          onClick={() => { setRowNotesRow({ id: row.id, label: row.label }); setShowRowNotes(true); }}
                          title="Voir toutes les notes">
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/row:opacity-100 shrink-0"
                          onClick={() => { setEditingRow(row.id); setEditingRowLabel(row.label); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover/row:opacity-100 shrink-0 text-destructive"
                          onClick={() => { if (confirm('Supprimer cette ligne ?')) deleteRow(row.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Gantt cells */}
                  <div className={`relative`} style={{ gridColumn: `2 / ${monthCount + 2}`, minHeight: rowHeight }} ref={ganttRef}>
                    {/* Grid lines */}
                    <div className="absolute inset-0" style={{ display: 'grid', gridTemplateColumns: `repeat(${monthCount}, 1fr)` }}>
                      {visibleMonths.map((m, i) => (
                        <div
                          key={i}
                          className="border-r last:border-r-0 cursor-pointer hover:bg-primary/5"
                          onDoubleClick={() => openNewBlock(row.id, m.globalIndex)}
                        />
                      ))}
                    </div>

                    {/* Blocks */}
                    {rowBlocks.map(block => {
                      // Only show blocks that overlap with visible range
                      const blockEnd = block.start_month + block.duration;
                      if (blockEnd <= rangeStart || block.start_month > rangeEnd) return null;

                      const colorObj = getColor(block.color_id);
                      const bgColor = colorObj?.color || '#94a3b8';
                      const clampedStart = Math.max(block.start_month, rangeStart);
                      const clampedEnd = Math.min(blockEnd, rangeEnd + 1);
                      const left = `${((clampedStart - rangeStart) / monthCount) * 100}%`;
                      const width = `${((clampedEnd - clampedStart) / monthCount) * 100}%`;
                      const laneInfo = lanes.find(l => l.blockId === block.id);
                      const lane = laneInfo?.lane || 0;
                      const top = 4 + lane * 32;
                      const blockNote = getNotesForBlock(block.id);
                      const hasNote = blockNote.length > 0 && blockNote[0].content.trim() !== '';

                      return (
                        <div
                          key={block.id}
                          className="absolute rounded-md flex items-center justify-center text-xs font-medium text-white shadow-sm select-none"
                          style={{ left, width, backgroundColor: bgColor, top, height: 28, cursor: dragging ? 'grabbing' : 'grab', zIndex: dragging?.blockId === block.id ? 10 : 1 }}
                          onMouseDown={e => handleDragStart(e, block)}
                          onDoubleClick={() => openEditBlock(block)}
                          onClick={e => { if (!dragging) { e.stopPropagation(); openBlockNote(block); } }}
                          title="Clic pour notes, double-clic pour modifier, glisser pour déplacer"
                        >
                          <span className="truncate px-1 drop-shadow-sm">{block.label || colorObj?.name || ''}</span>
                          {hasNote && <StickyNote className="h-3 w-3 ml-0.5 shrink-0 opacity-80" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Color dialog */}
      <Dialog open={showColorDialog} onOpenChange={setShowColorDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingColorId ? 'Modifier la couleur' : 'Nouvelle couleur'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nom / Définition</Label>
              <Input value={newColorName} onChange={e => setNewColorName(e.target.value)} placeholder="Ex: Sortie publique validée" />
            </div>
            <div>
              <Label>Couleur</Label>
              <div className="flex gap-2 items-center">
                <input type="color" value={newColorHex} onChange={e => setNewColorHex(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" />
                <Input value={newColorHex} onChange={e => setNewColorHex(e.target.value)} className="w-28 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveColor} disabled={!newColorName.trim()} className="flex-1">
                {editingColorId ? 'Mettre à jour' : 'Créer'}
              </Button>
              {editingColorId && (
                <Button variant="destructive" onClick={() => { deleteColor(editingColorId); setShowColorDialog(false); }}>
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBlockId ? 'Modifier le bloc' : 'Nouveau bloc'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label</Label>
              <Input value={blockForm.label} onChange={e => setBlockForm(f => ({ ...f, label: e.target.value }))} placeholder="Ex: Prototype" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Mois de début</Label>
                <Select value={String(blockForm.start_month)} onValueChange={v => setBlockForm(f => ({ ...f, start_month: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(o => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Durée (mois)</Label>
                <Select value={String(blockForm.duration)} onValueChange={v => setBlockForm(f => ({ ...f, duration: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d} mois</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Couleur</Label>
              <Select value={blockForm.color_id || 'none'} onValueChange={v => setBlockForm(f => ({ ...f, color_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sans couleur</SelectItem>
                  {colors.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveBlock} className="flex-1">
                {editingBlockId ? 'Mettre à jour' : 'Créer'}
              </Button>
              {editingBlockId && (
                <Button variant="destructive" onClick={() => { deleteBlock(editingBlockId); setShowBlockDialog(false); }}>
                  Supprimer
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Block notes dialog */}
      <BlockNotesDialog
        open={showNoteDialog}
        onOpenChange={setShowNoteDialog}
        block={noteBlock}
        color={noteBlock ? getColor(noteBlock.color_id) : undefined}
        existingNote={noteBlock ? getNotesForBlock(noteBlock.id)[0] : undefined}
        onSave={upsertNote}
        monthLabels={monthOptions.map(o => o.label)}
      />

      {/* Row notes overview */}
      {rowNotesRow && (
        <RowNotesDialog
          open={showRowNotes}
          onOpenChange={setShowRowNotes}
          rowLabel={rowNotesRow.label}
          rowBlocks={blocks.filter(b => b.row_id === rowNotesRow.id)}
          notes={getNotesForBlocks(blocks.filter(b => b.row_id === rowNotesRow.id).map(b => b.id))}
          colors={colors}
          monthLabels={monthOptions.map(o => o.label)}
          onOpenBlockNote={openBlockNote}
        />
      )}
    </div>
  );
}
