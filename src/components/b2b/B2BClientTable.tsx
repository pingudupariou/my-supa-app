import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Upload, Edit2, Save, X, Settings, ChevronDown, ChevronRight, FolderPlus, Download } from 'lucide-react';
import { B2BClient, B2BClientProjection, B2BPaymentTermOption, B2BDeliveryMethod, B2BDeliveryFeeTier, B2BClientCategory } from '@/hooks/useB2BClientsData';
import { getCountryFlag } from '@/lib/countryFlags';
import { B2BClientImportDialog } from './B2BClientImportDialog';
import { B2BSettingsPanel } from './B2BSettingsPanel';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { toast } from 'sonner';

interface Props {
  clients: B2BClient[];
  projections: B2BClientProjection[];
  deliveryFeeTiers: B2BDeliveryFeeTier[];
  paymentTermsOptions: B2BPaymentTermOption[];
  deliveryMethods: B2BDeliveryMethod[];
  categories: B2BClientCategory[];
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
  onAddCategory: (name: string, color?: string) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onUpdateCategory: (id: string, data: Partial<B2BClientCategory>) => Promise<void>;
}

const revenueYears = [2022, 2023, 2024, 2025];

export function B2BClientTable({
  clients, projections, deliveryFeeTiers, paymentTermsOptions, deliveryMethods, categories,
  onUpsertClient, onDeleteClient, onBulkImport, onUpsertProjection, getClientProjections,
  onAddDeliveryFee, onDeleteDeliveryFee,
  onAddPaymentTerm, onDeletePaymentTerm,
  onAddDeliveryMethod, onDeleteDeliveryMethod,
  onAddCategory, onDeleteCategory, onUpdateCategory,
}: Props) {
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<B2BClient>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Revenue inline editing
  const [editingRevenue, setEditingRevenue] = useState<Record<string, Record<number, string>>>({});

  const { salesRules } = usePricingConfig();

  const [newForm, setNewForm] = useState({
    company_name: '', country: '', geographic_zone: '', contact_email: '',
    eer_date: '', client_type: '', pricing_rule: '', payment_terms: '',
    delivery_method: '', delivery_fee_rule: '', moq: '', category_id: '',
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
      category_id: newForm.category_id || null,
      is_active: true,
    });
    setShowAdd(false);
    setNewForm({ company_name: '', country: '', geographic_zone: '', contact_email: '', eer_date: '', client_type: '', pricing_rule: '', payment_terms: '', delivery_method: '', delivery_fee_rule: '', moq: '', category_id: '' });
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  };

  const getRevenue = (clientId: string, year: number) => {
    const proj = projections.find(p => p.client_id === clientId && p.year === year);
    return proj ? Number(proj.projected_revenue) : 0;
  };

  const handleRevenueBlur = async (clientId: string, year: number, value: string) => {
    const val = parseFloat(value);
    if (!isNaN(val)) {
      await onUpsertProjection(clientId, year, val);
    }
    setEditingRevenue(prev => {
      const copy = { ...prev };
      if (copy[clientId]) { delete copy[clientId][year]; }
      return copy;
    });
  };

  const deliveryFeeLabels = deliveryFeeTiers.map(t => t.label);
  const paymentTermLabels = paymentTermsOptions.map(t => t.label);
  const deliveryMethodLabels = deliveryMethods.map(m => m.label);

  const exportCSV = () => {
    const headers = ['Actif', 'Client', 'Pays', 'Zone Géo', 'Email', 'Pricing', 'Délai paiement', 'Livraison', 'Frais livraison', 'MOQ', ...revenueYears.map(y => `CA ${y}`), 'Catégorie'];
    const rows = clients.map(c => [
      c.is_active ? 'Oui' : 'Non',
      c.company_name,
      c.country || '',
      c.geographic_zone || '',
      c.contact_email || '',
      c.pricing_rule || '',
      c.payment_terms || '',
      c.delivery_method || '',
      c.delivery_fee_rule || '',
      c.moq || '',
      ...revenueYears.map(y => String(getRevenue(c.id, y) || '')),
      categories.find(cat => cat.id === c.category_id)?.name || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_b2b_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Fichier CSV exporté');
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId) {
      await onDeleteClient(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  // Group clients by category
  const uncategorized = clients.filter(c => !c.category_id);
  const grouped = categories.map(cat => ({
    category: cat,
    clients: clients.filter(c => c.category_id === cat.id),
  }));

  const renderClientRow = (c: B2BClient) => {
    const isEditing = editingId === c.id;
    const d = isEditing ? editData : c;

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
          {isEditing ? <Input className="h-7 text-xs w-32" value={d.company_name || ''} onChange={e => setEditData(p => ({ ...p, company_name: e.target.value }))} /> : c.company_name}
        </TableCell>
        <TableCell>
          {isEditing ? <Input className="h-7 text-xs w-20" value={d.country || ''} onChange={e => setEditData(p => ({ ...p, country: e.target.value }))} /> : (
            <span className="flex items-center gap-1">
              {getCountryFlag(c.country) && <span className="text-base leading-none">{getCountryFlag(c.country)}</span>}
              {c.country}
            </span>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? <Input className="h-7 text-xs w-20" value={d.geographic_zone || ''} onChange={e => setEditData(p => ({ ...p, geographic_zone: e.target.value }))} /> : c.geographic_zone}
        </TableCell>
        <TableCell>
          {isEditing ? <Input className="h-7 text-xs w-36" value={d.contact_email || ''} onChange={e => setEditData(p => ({ ...p, contact_email: e.target.value }))} /> : (
            c.contact_email ? <a href={`mailto:${c.contact_email}`} className="text-primary underline">{c.contact_email}</a> : '—'
          )}
        </TableCell>
        {/* Pricing rule dropdown */}
        <TableCell>
          {isEditing ? (
            <Select value={d.pricing_rule || ''} onValueChange={v => setEditData(p => ({ ...p, pricing_rule: v }))}>
              <SelectTrigger className="h-7 text-xs w-28"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {salesRules.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            c.pricing_rule || '—'
          )}
        </TableCell>
        {/* Délai paiement */}
        <TableCell>
          {isEditing ? (
            <Select value={d.payment_terms || ''} onValueChange={v => setEditData(p => ({ ...p, payment_terms: v }))}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {paymentTermLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : c.payment_terms || '—'}
        </TableCell>
        {/* Livraison */}
        <TableCell>
          {isEditing ? (
            <Select value={d.delivery_method || ''} onValueChange={v => setEditData(p => ({ ...p, delivery_method: v }))}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {deliveryMethodLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : c.delivery_method || '—'}
        </TableCell>
        {/* Frais livraison */}
        <TableCell>
          {isEditing ? (
            <Select value={d.delivery_fee_rule || ''} onValueChange={v => setEditData(p => ({ ...p, delivery_fee_rule: v }))}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {deliveryFeeLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : c.delivery_fee_rule || '—'}
        </TableCell>
        {/* MOQ */}
        <TableCell>
          {isEditing ? <Input className="h-7 text-xs w-16" value={d.moq || ''} onChange={e => setEditData(p => ({ ...p, moq: e.target.value }))} /> : c.moq || '—'}
        </TableCell>
        {/* CA 2022-2025 inline */}
        {revenueYears.map(year => {
          const rev = getRevenue(c.id, year);
          const editVal = editingRevenue[c.id]?.[year];
          return (
            <TableCell key={year} className="text-right font-mono">
              <Input
                className="h-7 text-xs w-20 text-right"
                type="number"
                value={editVal !== undefined ? editVal : (rev || '')}
                onChange={e => setEditingRevenue(prev => ({
                  ...prev,
                  [c.id]: { ...(prev[c.id] || {}), [year]: e.target.value },
                }))}
                onBlur={e => handleRevenueBlur(c.id, year, e.target.value)}
                placeholder="0"
              />
            </TableCell>
          );
        })}
        {/* Category */}
        <TableCell>
          {isEditing ? (
            <Select value={d.category_id || 'none'} onValueChange={v => setEditData(p => ({ ...p, category_id: v === 'none' ? null : v }))}>
              <SelectTrigger className="h-7 text-xs w-24"><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sans catégorie</SelectItem>
                {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : (
            categories.find(cat => cat.id === c.category_id)?.name || '—'
          )}
        </TableCell>
        {/* Actions */}
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
                <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const renderCategoryHeader = (cat: B2BClientCategory, count: number) => {
    const isCollapsed = collapsedCategories.has(cat.id);
    return (
      <TableRow key={`cat-${cat.id}`} className="bg-muted/40 hover:bg-muted/60 cursor-pointer" onClick={() => toggleCategory(cat.id)}>
        <TableCell colSpan={15} className="py-2">
          <div className="flex items-center gap-2">
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || '#6366f1' }} />
            <span className="font-semibold text-sm">{cat.name}</span>
            <Badge variant="secondary" className="text-[9px]">{count}</Badge>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-4 w-4 mr-1" /> Nouveau client</Button>
        <Button size="sm" variant="outline" onClick={() => setShowImport(true)}><Upload className="h-4 w-4 mr-1" /> Import copier-coller</Button>
        <Button size="sm" variant="outline" onClick={() => setShowCategoryDialog(true)}><FolderPlus className="h-4 w-4 mr-1" /> Catégorie</Button>
        <Button size="sm" variant="outline" onClick={() => setShowSettings(!showSettings)}><Settings className="h-4 w-4 mr-1" /> Paramètres</Button>
        <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
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

      {/* Categories management */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(cat => (
            <Badge key={cat.id} variant="outline" className="gap-1 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || '#6366f1' }} />
              {cat.name}
              <button onClick={() => onDeleteCategory(cat.id)} className="ml-1 text-destructive hover:text-destructive/80">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Main table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-[10px] min-w-[50px]">Actif</TableHead>
              <TableHead className="text-[10px] min-w-[130px]">Client</TableHead>
              <TableHead className="text-[10px] min-w-[80px]">Pays</TableHead>
              <TableHead className="text-[10px] min-w-[80px]">Zone Géo</TableHead>
              <TableHead className="text-[10px] min-w-[140px]">Mail contact</TableHead>
              <TableHead className="text-[10px] min-w-[100px]">Pricing</TableHead>
              <TableHead className="text-[10px] min-w-[90px]">Délai paie.</TableHead>
              <TableHead className="text-[10px] min-w-[80px]">Livraison</TableHead>
              <TableHead className="text-[10px] min-w-[80px]">Frais liv.</TableHead>
              <TableHead className="text-[10px] min-w-[60px]">MOQ</TableHead>
              {revenueYears.map(y => (
                <TableHead key={y} className="text-[10px] text-right min-w-[80px] bg-accent/20">CA {y}</TableHead>
              ))}
              <TableHead className="text-[10px] min-w-[90px]">Catégorie</TableHead>
              <TableHead className="text-[10px] min-w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} className="text-center text-muted-foreground py-8 text-sm">
                  Aucun client — Ajoutez-en ou importez via copier-coller
                </TableCell>
              </TableRow>
            )}
            {/* Categorized clients */}
            {grouped.map(({ category, clients: catClients }) => {
              if (catClients.length === 0) return null;
              const isCollapsed = collapsedCategories.has(category.id);
              return [
                renderCategoryHeader(category, catClients.length),
                ...(!isCollapsed ? catClients.map(renderClientRow) : []),
              ];
            })}
            {/* Uncategorized */}
            {uncategorized.length > 0 && (
              <>
                {categories.length > 0 && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={15} className="py-2">
                      <span className="text-xs text-muted-foreground font-medium">Sans catégorie ({uncategorized.length})</span>
                    </TableCell>
                  </TableRow>
                )}
                {uncategorized.map(renderClientRow)}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Import dialog */}
      <B2BClientImportDialog open={showImport} onOpenChange={setShowImport} onImport={onBulkImport} />

      {/* New client dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau Client</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Nom de l'entreprise *" value={newForm.company_name} onChange={e => setNewForm(f => ({ ...f, company_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Pays" value={newForm.country} onChange={e => setNewForm(f => ({ ...f, country: e.target.value }))} />
              <Input placeholder="Zone géographique" value={newForm.geographic_zone} onChange={e => setNewForm(f => ({ ...f, geographic_zone: e.target.value }))} />
            </div>
            <Input placeholder="Email contact" value={newForm.contact_email} onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <Select value={newForm.pricing_rule} onValueChange={v => setNewForm(f => ({ ...f, pricing_rule: v }))}>
                <SelectTrigger><SelectValue placeholder="Pricing rule" /></SelectTrigger>
                <SelectContent>
                  {salesRules.map(r => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={newForm.category_id} onValueChange={v => setNewForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sans catégorie</SelectItem>
                  {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Input placeholder="MOQ" value={newForm.moq} onChange={e => setNewForm(f => ({ ...f, moq: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={!newForm.company_name.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New category dialog */}
      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nouvelle catégorie</DialogTitle></DialogHeader>
          <Input placeholder="Nom de la catégorie" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Annuler</Button>
            <Button onClick={async () => {
              if (newCategoryName.trim()) {
                await onAddCategory(newCategoryName.trim());
                setNewCategoryName('');
                setShowCategoryDialog(false);
              }
            }} disabled={!newCategoryName.trim()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le client « {clients.find(c => c.id === deleteConfirmId)?.company_name} » et toutes ses données associées seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
