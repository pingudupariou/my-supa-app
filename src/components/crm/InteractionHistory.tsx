import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Phone, Mail, Calendar, FileText, ArrowUpDown, Clock, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { CustomerInteraction } from '@/hooks/useCRMData';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; border: string; bg: string }> = {
  call: { label: 'Appel', icon: Phone, color: 'text-blue-600', border: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  email: { label: 'Email', icon: Mail, color: 'text-emerald-600', border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  meeting: { label: 'RDV', icon: Calendar, color: 'text-violet-600', border: 'border-l-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  note: { label: 'Note', icon: FileText, color: 'text-amber-600', border: 'border-l-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30' },
};

interface InteractionHistoryProps {
  interactions: CustomerInteraction[];
  customerId: string;
  onCreate: (interaction: { customer_id: string; interaction_type: string; subject: string; content?: string; interaction_date?: string }) => Promise<any>;
}

export function InteractionHistory({ interactions, customerId, onCreate }: InteractionHistoryProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({ interaction_type: 'note', subject: '', content: '', interaction_date: new Date().toISOString().slice(0, 16) });
  const isMobile = useIsMobile();

  const sorted = [...interactions].sort((a, b) => {
    const diff = new Date(b.interaction_date).getTime() - new Date(a.interaction_date).getTime();
    return sortAsc ? -diff : diff;
  });

  const handleCreate = async () => {
    if (!form.subject.trim()) return;
    await onCreate({
      customer_id: customerId,
      interaction_type: form.interaction_type,
      subject: form.subject,
      content: form.content || undefined,
      interaction_date: form.interaction_date || undefined,
    });
    setShowAdd(false);
    setForm({ interaction_type: 'note', subject: '', content: '', interaction_date: new Date().toISOString().slice(0, 16) });
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffH < 1) return 'À l\'instant';
    if (diffH < 24) return `Il y a ${diffH}h`;
    if (diffD < 7) return `Il y a ${diffD}j`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatFullDate = (date: string) =>
    new Date(date).toLocaleString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  // Form content shared between Dialog and Drawer
  const formContent = (
    <div className="space-y-4 py-2">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Type d'interaction</label>
        <Select value={form.interaction_type} onValueChange={v => setForm(f => ({ ...f, interaction_type: v }))}>
          <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                    {cfg.label}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Sujet *</label>
        <Input
          placeholder="Ex: Appel de suivi, Relance devis…"
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
          className="h-10"
          autoFocus={!isMobile}
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Détails / Notes</label>
        <Textarea
          placeholder="Écrire le détail de l'interaction…"
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          rows={isMobile ? 5 : 6}
          className="text-sm resize-y min-h-[120px]"
        />
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Date & heure</label>
        <Input
          type="datetime-local"
          value={form.interaction_date}
          onChange={e => setForm(f => ({ ...f, interaction_date: e.target.value }))}
          className="h-10"
        />
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-sm flex items-center gap-1.5">
          <MessageSquare className="h-4 w-4" />
          Historique ({interactions.length})
        </h4>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSortAsc(!sortAsc)}
            className="h-7 text-xs gap-1"
          >
            <ArrowUpDown className="h-3 w-3" />
            {sortAsc ? 'Ancien → Récent' : 'Récent → Ancien'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="h-7">
            <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
          </Button>
        </div>
      </div>

      {/* Interaction cards */}
      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <MessageSquare className="h-10 w-10 opacity-20 mb-2" />
          <p className="text-sm">Aucune interaction enregistrée</p>
          <Button size="sm" variant="link" onClick={() => setShowAdd(true)} className="mt-1 text-xs">
            Ajouter la première
          </Button>
        </div>
      ) : (
        <ScrollArea className="max-h-[500px] pr-1">
          <div className="space-y-2">
            {sorted.map(int => {
              const cfg = TYPE_CONFIG[int.interaction_type] || TYPE_CONFIG.note;
              const Icon = cfg.icon;
              const isExpanded = expandedId === int.id;
              const hasContent = int.content && int.content.trim() !== '';

              return (
                <div
                  key={int.id}
                  className={cn(
                    "rounded-lg border border-l-4 p-3 transition-all cursor-pointer hover:shadow-sm",
                    cfg.border,
                    isExpanded ? cfg.bg : 'bg-card'
                  )}
                  onClick={() => setExpandedId(isExpanded ? null : int.id)}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className={cn("mt-0.5 p-1.5 rounded-md", cfg.bg)}>
                        <Icon className={cn("h-4 w-4", cfg.color)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{int.subject}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0 font-normal">
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(int.interaction_date)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 mt-1">
                      {hasContent && (
                        isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Preview (collapsed) */}
                  {!isExpanded && hasContent && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2 pl-9">
                      {int.content}
                    </p>
                  )}

                  {/* Full content (expanded) */}
                  {isExpanded && hasContent && (
                    <div className="mt-3 pl-9">
                      <div className="p-3 rounded-md bg-background/80 border">
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{int.content}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {formatFullDate(int.interaction_date)}
                      </p>
                    </div>
                  )}

                  {isExpanded && !hasContent && (
                    <p className="text-xs text-muted-foreground italic mt-2 pl-9">
                      Aucun détail ajouté
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Add interaction — Dialog on desktop, Drawer on mobile */}
      {isMobile ? (
        <Drawer open={showAdd} onOpenChange={setShowAdd}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Nouvelle interaction
              </DrawerTitle>
            </DrawerHeader>
            <div className="px-4 overflow-y-auto flex-1">
              {formContent}
            </div>
            <DrawerFooter className="flex-row gap-2">
              <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.subject.trim()} className="flex-1">Ajouter</Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Nouvelle interaction
              </DialogTitle>
            </DialogHeader>
            {formContent}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={!form.subject.trim()}>Ajouter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
