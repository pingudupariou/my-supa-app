import { useState } from 'react';
import { useSAVData, SAVTicket } from '@/hooks/useSAVData';
import { useB2BClientsData } from '@/hooks/useB2BClientsData';
import { useCostFlowData } from '@/hooks/useCostFlowData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { KPICard } from '@/components/ui/KPICard';
import { Plus, Trash2, Pencil, Wrench, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export function SAVPage() {
  const { tickets, isLoading, createTicket, updateTicket, deleteTicket, generateTicketNumber } = useSAVData();
  const b2b = useB2BClientsData();
  const b2bClients = b2b.clients || [];
  const costflow = useCostFlowData();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<SAVTicket>>({});

  const openCreate = () => {
    setForm({
      ticket_number: generateTicketNumber(),
      open_date: new Date().toISOString().slice(0, 10),
      customer_type: 'B2C',
      is_under_warranty: false,
      media_received: false,
      client_returned_product: false,
      status: 'open',
    });
    setEditingId(null);
    setShowCreate(true);
  };

  const openEdit = (t: SAVTicket) => {
    setForm({ ...t });
    setEditingId(t.id);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.ticket_number) return;
    if (editingId) {
      const { id, user_id, created_at, updated_at, ...updates } = form as any;
      await updateTicket(editingId, updates);
    } else {
      await createTicket(form);
    }
    setShowCreate(false);
  };

  const statusCfg: Record<string, { label: string; color: string }> = {
    open: { label: 'Ouvert', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    in_progress: { label: 'En cours', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    waiting_return: { label: 'Attente retour', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    resolved: { label: 'Résolu', color: 'bg-green-100 text-green-800 border-green-300' },
    closed: { label: 'Clôturé', color: 'bg-muted text-muted-foreground border-border' },
  };

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress' || t.status === 'waiting_return').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
  const warrantyCount = tickets.filter(t => t.is_under_warranty).length;

  const getCustomerDisplay = (t: SAVTicket) => {
    if (t.customer_type === 'B2B' && t.customer_id) {
      return b2bClients.find(c => c.id === t.customer_id)?.company_name || '—';
    }
    return t.customer_name || '—';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SAV</h1>
          <p className="text-muted-foreground">Suivi des tickets de service après-vente</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Nouveau ticket</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <KPICard label="Tickets ouverts" value={openCount} trend={openCount > 0 ? 'down' : 'neutral'} />
        <KPICard label="En traitement" value={inProgressCount} />
        <KPICard label="Résolus / Clôturés" value={resolvedCount} trend="up" />
        <KPICard label="Sous garantie" value={warrantyCount} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Tickets SAV ({tickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Ticket</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>B2B/B2C</TableHead>
                  <TableHead>N° Facture</TableHead>
                  <TableHead>Produit / SKU</TableHead>
                  <TableHead>Garantie</TableHead>
                  <TableHead>Médias</TableHead>
                  <TableHead>Problème</TableHead>
                  <TableHead>Retour client</TableHead>
                  <TableHead>Pièces renvoyées</TableHead>
                  <TableHead>Réf. BL / Date</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                      Aucun ticket SAV. Cliquez sur "Nouveau ticket" pour en créer un.
                    </TableCell>
                  </TableRow>
                )}
                {tickets.map(t => {
                  const st = statusCfg[t.status] || statusCfg.open;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs font-medium">{t.ticket_number}</TableCell>
                      <TableCell className="text-xs">{t.open_date}</TableCell>
                      <TableCell className="text-xs">{getCustomerName(t.customer_id)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{t.customer_type}</Badge></TableCell>
                      <TableCell className="text-xs">{t.invoice_number || '—'}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{t.product_sku || '—'}</TableCell>
                      <TableCell>{t.is_under_warranty ? <CheckCircle className="h-4 w-4 text-green-600" /> : <span className="text-muted-foreground text-xs">Non</span>}</TableCell>
                      <TableCell>{t.media_received ? <CheckCircle className="h-4 w-4 text-green-600" /> : <span className="text-muted-foreground text-xs">Non</span>}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{t.problem_description || '—'}</TableCell>
                      <TableCell>{t.client_returned_product ? <CheckCircle className="h-4 w-4 text-green-600" /> : <span className="text-muted-foreground text-xs">Non</span>}</TableCell>
                      <TableCell className="text-xs max-w-[120px] truncate">{t.parts_sent_for_repair || '—'}</TableCell>
                      <TableCell className="text-xs">{t.bl_reference ? `${t.bl_reference}${t.bl_send_date ? ` (${t.bl_send_date})` : ''}` : '—'}</TableCell>
                      <TableCell><Badge className={`text-[10px] ${st.color}`}>{st.label}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(t)}><Pencil className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTicket(t.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le ticket' : 'Nouveau ticket SAV'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">N° Ticket</label>
                <Input value={form.ticket_number || ''} onChange={e => setForm(p => ({ ...p, ticket_number: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Date d'ouverture</label>
                <Input type="date" value={form.open_date || ''} onChange={e => setForm(p => ({ ...p, open_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Client concerné</label>
                <Select value={form.customer_id || 'none'} onValueChange={v => setForm(p => ({ ...p, customer_id: v === 'none' ? null : v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Aucun —</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Type client</label>
                <Select value={form.customer_type || 'B2C'} onValueChange={v => setForm(p => ({ ...p, customer_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2B">B2B</SelectItem>
                    <SelectItem value="B2C">B2C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">N° Facture</label>
                <Input value={form.invoice_number || ''} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Produit / SKU</label>
                <Input value={form.product_sku || ''} onChange={e => setForm(p => ({ ...p, product_sku: e.target.value }))} placeholder="Référence ou SKU" />
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.is_under_warranty || false} onCheckedChange={v => setForm(p => ({ ...p, is_under_warranty: !!v }))} />
                Produit garanti ?
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.media_received || false} onCheckedChange={v => setForm(p => ({ ...p, media_received: !!v }))} />
                Photos / Vidéos reçues ?
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.client_returned_product || false} onCheckedChange={v => setForm(p => ({ ...p, client_returned_product: !!v }))} />
                Client a renvoyé le produit ?
              </label>
            </div>

            <div>
              <label className="text-sm font-medium">Problème identifié</label>
              <Textarea value={form.problem_description || ''} onChange={e => setForm(p => ({ ...p, problem_description: e.target.value }))} rows={2} />
            </div>

            <div>
              <label className="text-sm font-medium">Pièces renvoyées pour traitement</label>
              <Input value={form.parts_sent_for_repair || ''} onChange={e => setForm(p => ({ ...p, parts_sent_for_repair: e.target.value }))} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Réf. BL</label>
                <Input value={form.bl_reference || ''} onChange={e => setForm(p => ({ ...p, bl_reference: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Date d'envoi</label>
                <Input type="date" value={form.bl_send_date || ''} onChange={e => setForm(p => ({ ...p, bl_send_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Statut</label>
                <Select value={form.status || 'open'} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Ouvert</SelectItem>
                    <SelectItem value="in_progress">En cours</SelectItem>
                    <SelectItem value="waiting_return">Attente retour</SelectItem>
                    <SelectItem value="resolved">Résolu</SelectItem>
                    <SelectItem value="closed">Clôturé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Annuler</Button>
              <Button onClick={handleSave}>{editingId ? 'Enregistrer' : 'Créer'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
