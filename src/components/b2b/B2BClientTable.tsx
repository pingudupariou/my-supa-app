import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Upload, Edit2, Save, X, TrendingUp, Settings } from 'lucide-react';
import { B2BClient, B2BClientProjection, B2BPaymentTermOption, B2BDeliveryMethod, B2BDeliveryFeeTier } from '@/hooks/useB2BClientsData';
import { B2BClientImportDialog } from './B2BClientImportDialog';
import { B2BSettingsPanel } from './B2BSettingsPanel';

interface Props {
  clients: B2BClient[];
  projections: B2BClientProjection[];
  deliveryFeeTiers: B2BDeliveryFeeTier[];
  paymentTermsOptions: B2BPaymentTermOption[];
  deliveryMethods: B2BDeliveryMethod[];
  onUpsertClient: (data: Partial<B2BClient> & { company_name: string }) => Promise<B2BClient | null>;
  onDeleteClient: (id: string) => Promise<void>;
  onBulkImport: (rows: Partial<B2BClient>[]) => Promise<number>;
  onUpsertProjection: (clientId: string, year: number, revenue: number, notes?: string) => Promise<void>;
  getClientProjections: (clientId: string) => B2BClientProjection[];
  onAddDeliveryFee: (label: string, fee: number, min: number, max: number | null) => Promise<void>;
  onDeleteDeliveryFee: (id: string) => Promise<void>;
  onAddPaymentTerm: (label: string, desc?: string) => Promise<void>;
  onDeletePaymentTerm: (id: string) => Promise<void>;
  onAddDeliveryMethod: (label: string, desc?: string) => Promise<void>;
  onDeleteDeliveryMethod: (id: string) => Promise<void>;
}

const currentYear = new Date().getFullYear();
const projectionYears = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

export function B2BClientTable({
  clients, projections, deliveryFeeTiers, paymentTermsOptions, deliveryMethods,
  onUpsertClient, onDeleteClient, onBulkImport, onUpsertProjection, getClientProjections,
  onAddDeliveryFee, onDeleteDeliveryFee,
  onAddPaymentTerm, onDeletePaymentTerm,
  onAddDeliveryMethod, onDeleteDeliveryMethod,
}: Props) {
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<B2BClient>>({});
  const [projectionClient, setProjectionClient] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({
    company_name: '', country: '', geographic_zone: '', contact_email: '',
    eer_date: '', client_type: '', pricing_rule: '', payment_terms: '',
    delivery_method: '', delivery_fee_rule: '', moq: '',
  });

  const startEdit = (c: B2BClient) => {
    setEditingId(c.id);
    setEditData({ ...c });
  };

  const saveEdit = async () => {
    if (!editingId || !editData.company_name) return;
    await onUpsertClient({ ...editData, id: editingId, company_name: editData.company_name! });
    setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newForm.company_name.trim()) return;
    await onUpsertClient({
      company_name: newForm.company_name,
      country: newForm.country || null,
      geographic_zone: newForm.geographic_zone || null,
      contact_email: newForm.contact_email || null,
      eer_date: parseInt(newForm.eer_date) || null,
      client_type: newForm.client_type || null,
      pricing_rule: newForm.pricing_rule || null,
      payment_terms: newForm.payment_terms || null,
      delivery_method: newForm.delivery_method || null,
      delivery_fee_rule: newForm.delivery_fee_rule || null,
      moq: newForm.moq || null,
      is_active: true,
    });
    setShowAdd(false);
    setNewForm({ company_name: '', country: '', geographic_zone: '', contact_email: '', eer_date: '', client_type: '', pricing_rule: '', payment_terms: '', delivery_method: '', delivery_fee_rule: '', moq: '' });
  };

  const deliveryFeeLabels = deliveryFeeTiers.map(t => t.label);
  const paymentTermLabels = paymentTermsOptions.map(t => t.label);
  const deliveryMethodLabels = deliveryMethods.map(m => m.label);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau client</Button>
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Import Excel</Button>
        <Button size="sm" variant="outline" onClick={() => setShowSettings(!showSettings)}><Settings className="h-4 w-4 mr-1" /> Paramètres</Button>
        <span className="text-xs text-muted-foreground ml-auto">{clients.length} client(s)</span>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <B2BSettingsPanel
          deliveryFeeTiers={deliveryFeeTiers}
          paymentTermsOptions={paymentTermsOptions}
          deliveryMethods={deliveryMethods}
          onAddDeliveryFee={onAddDeliveryFee}
          onDeleteDeliveryFee={onDeleteDeliveryFee}
          onAddPaymentTerm={onAddPaymentTerm}
          onDeletePaymentTerm={onDeletePaymentTerm}
          onAddDeliveryMethod={onAddDeliveryMethod}
          onDeleteDeliveryMethod={onDeleteDeliveryMethod}
        />
      )}

      {/* Main table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] bg-green-50 dark:bg-green-950/30 min-w-[50px]">Actif</TableHead>
              <TableHead className="text-[10px] bg-green-50 dark:bg-green-950/30 min-w-[120px]">Client B2B</TableHead>
              <TableHead className="text-[10px] bg-green-50 dark:bg-green-950/30 min-w-[80px]">Pays</TableHead>
              <TableHead className="text-[10px] bg-green-50 dark:bg-green-950/30 min-w-[80px]">Zone Géo</TableHead>
              <TableHead className="text-[10px] bg-green-50 dark:bg-green-950/30 min-w-[120px]">Email</TableHead>
              <TableHead className="text-[10px] bg-green-50 dark:bg-green-950/30 min-w-[60px]">EER</TableHead>
              <TableHead className="text-[10px] bg-green-50 dark:bg-green-950/30 min-w-[60px]">Dern. achat</TableHead>
              <TableHead className="text-[10px] bg-blue-50 dark:bg-blue-950/30 min-w-[80px]">Type</TableHead>
              <TableHead className="text-[10px] bg-blue-50 dark:bg-blue-950/30 min-w-[100px]">Pricing rule</TableHead>
              <TableHead className="text-[10px] bg-pink-50 dark:bg-pink-950/30 min-w-[100px]">Délai paie.</TableHead>
              <TableHead className="text-[10px] bg-purple-50 dark:bg-purple-950/30 min-w-[80px]">Livraison</TableHead>
              <TableHead className="text-[10px] bg-yellow-50 dark:bg-yellow-950/30 min-w-[100px]">Frais liv.</TableHead>
              <TableHead className="text-[10px] bg-orange-50 dark:bg-orange-950/30 min-w-[70px]">Contrat</TableHead>
              <TableHead className="text-[10px] bg-orange-50 dark:bg-orange-950/30 min-w-[60px]">MOQ</TableHead>
              <TableHead className="text-[10px] bg-cyan-50 dark:bg-cyan-950/30 min-w-[80px]">Projections</TableHead>
              <TableHead className="text-[10px] min-w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={16} className="text-center text-muted-foreground py-8 text-sm">
                  Aucun client B2B — Ajoutez-en ou importez via Excel
                </TableCell>
              </TableRow>
            )}
            {clients.map(c => {
              const isEditing = editingId === c.id;
              const d = isEditing ? editData : c;
              const clientProj = getClientProjections(c.id);
              const currentProj = clientProj.find(p => p.year === currentYear);

              return (
                <TableRow key={c.id} className="text-xs">
                  <TableCell>
                    {isEditing ? (
                      <Switch checked={d.is_active} onCheckedChange={v => setEditData(p => ({ ...p, is_active: v }))} />
                    ) : (
                      <Badge variant={c.is_active ? 'default' : 'secondary'} className="text-[9px]">
                        {c.is_active ? 'Oui' : 'Non'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {isEditing ? <Input className="h-7 text-xs" value={d.company_name || ''} onChange={e => setEditData(p => ({ ...p, company_name: e.target.value }))} /> : c.company_name}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs" value={d.country || ''} onChange={e => setEditData(p => ({ ...p, country: e.target.value }))} /> : c.country}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs" value={d.geographic_zone || ''} onChange={e => setEditData(p => ({ ...p, geographic_zone: e.target.value }))} /> : c.geographic_zone}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs" value={d.contact_email || ''} onChange={e => setEditData(p => ({ ...p, contact_email: e.target.value }))} /> : c.contact_email}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs w-16" type="number" value={d.eer_date || ''} onChange={e => setEditData(p => ({ ...p, eer_date: parseInt(e.target.value) || null }))} /> : c.eer_date}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs w-16" type="number" value={d.last_purchase_date || ''} onChange={e => setEditData(p => ({ ...p, last_purchase_date: parseInt(e.target.value) || null }))} /> : c.last_purchase_date}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs" value={d.client_type || ''} onChange={e => setEditData(p => ({ ...p, client_type: e.target.value }))} /> : c.client_type}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs" value={d.pricing_rule || ''} onChange={e => setEditData(p => ({ ...p, pricing_rule: e.target.value }))} /> : c.pricing_rule}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select value={d.payment_terms || ''} onValueChange={v => setEditData(p => ({ ...p, payment_terms: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {paymentTermLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : c.payment_terms}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select value={d.delivery_method || ''} onValueChange={v => setEditData(p => ({ ...p, delivery_method: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {deliveryMethodLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : c.delivery_method}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Select value={d.delivery_fee_rule || ''} onValueChange={v => setEditData(p => ({ ...p, delivery_fee_rule: v }))}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {deliveryFeeLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : c.delivery_fee_rule}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Switch checked={d.contract_exclusivity} onCheckedChange={v => setEditData(p => ({ ...p, contract_exclusivity: v }))} />
                    ) : (c.contract_exclusivity ? 'Oui' : 'Non')}
                  </TableCell>
                  <TableCell>
                    {isEditing ? <Input className="h-7 text-xs w-16" value={d.moq || ''} onChange={e => setEditData(p => ({ ...p, moq: e.target.value }))} /> : c.moq}
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" className="text-[10px] h-6" onClick={() => setProjectionClient(c.id)}>
                      <TrendingUp className="h-3 w-3 mr-1" />
                      {currentProj ? `${(Number(currentProj.projected_revenue) / 1000).toFixed(0)}k€` : 'NC'}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={saveEdit}><Save className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-3 w-3" /></Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Edit2 className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => onDeleteClient(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Import dialog */}
      <B2BClientImportDialog open={showImport} onOpenChange={setShowImport} onImport={onBulkImport} />

      {/* New client dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau Client B2B</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Nom de l'entreprise *" value={newForm.company_name} onChange={e => setNewForm(f => ({ ...f, company_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Pays" value={newForm.country} onChange={e => setNewForm(f => ({ ...f, country: e.target.value }))} />
              <Input placeholder="Zone géographique" value={newForm.geographic_zone} onChange={e => setNewForm(f => ({ ...f, geographic_zone: e.target.value }))} />
            </div>
            <Input placeholder="Email contact" value={newForm.contact_email} onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Date EER" type="number" value={newForm.eer_date} onChange={e => setNewForm(f => ({ ...f, eer_date: e.target.value }))} />
              <Input placeholder="Type (Shop, Distri...)" value={newForm.client_type} onChange={e => setNewForm(f => ({ ...f, client_type: e.target.value }))} />
            </div>
            <Input placeholder="Pricing rule" value={newForm.pricing_rule} onChange={e => setNewForm(f => ({ ...f, pricing_rule: e.target.value }))} />
            <Input placeholder="MOQ" value={newForm.moq} onChange={e => setNewForm(f => ({ ...f, moq: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!newForm.company_name.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Projections dialog */}
      <ProjectionsDialog
        clientId={projectionClient}
        clients={clients}
        projections={projections}
        onClose={() => setProjectionClient(null)}
        onSave={onUpsertProjection}
      />
    </div>
  );
}

function ProjectionsDialog({ clientId, clients, projections, onClose, onSave }: {
  clientId: string | null;
  clients: B2BClient[];
  projections: B2BClientProjection[];
  onClose: () => void;
  onSave: (clientId: string, year: number, revenue: number, notes?: string) => Promise<void>;
}) {
  const client = clients.find(c => c.id === clientId);
  const clientProj = projections.filter(p => p.client_id === clientId);

  if (!client) return null;

  return (
    <Dialog open={!!clientId} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Projections CA — {client.company_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {projectionYears.map(year => {
            const existing = clientProj.find(p => p.year === year);
            return (
              <div key={year} className="flex items-center gap-3">
                <Badge variant={year === currentYear ? 'default' : 'outline'} className="min-w-[50px] justify-center">
                  {year}
                </Badge>
                <Input
                  type="number"
                  placeholder="CA projeté (€)"
                  className="h-8 text-sm"
                  defaultValue={existing ? Number(existing.projected_revenue) : ''}
                  onBlur={e => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) onSave(client.id, year, val);
                  }}
                />
                <span className="text-xs text-muted-foreground w-20">
                  {year < currentYear ? 'Historique' : year === currentYear ? 'En cours' : 'Projection'}
                </span>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
