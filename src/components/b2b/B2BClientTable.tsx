import { useState, useRef, useEffect, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Upload, Save, X, Settings, ChevronDown, ChevronRight, FolderPlus, Download, Columns3, Eye, Calendar, Bell, MessageSquare, AlertTriangle, FileText, Lock, LockOpen, GripVertical } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CrmMeeting, CrmReminder, CustomerInteraction } from '@/hooks/useCRMData';
import { B2BClient, B2BClientProjection, B2BPaymentTermOption, B2BDeliveryMethod, B2BDeliveryFeeTier, B2BClientCategory } from '@/hooks/useB2BClientsData';
import { getCountryFlag } from '@/lib/countryFlags';
import { B2BClientImportDialog } from './B2BClientImportDialog';
import { B2BSettingsPanel } from './B2BSettingsPanel';
import { usePricingConfig } from '@/hooks/usePricingConfig';
import { B2BClientDetailDialog } from './B2BClientDetailDialog';
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
  // CRM activity data (optional)
  meetings?: CrmMeeting[];
  reminders?: CrmReminder[];
  interactions?: CustomerInteraction[];
  // Admin & column editability
  isAdmin?: boolean;
  isColumnEditableByOthers?: (columnKey: string) => boolean;
  onToggleColumnPermission?: (columnKey: string, value: boolean) => Promise<void>;
}

const revenueYears = [2022, 2023, 2024, 2025];

type ColumnKey = 'is_active' | 'company_name' | 'country' | 'geographic_zone' | 'contact_email' | 'contact_phone' | 'pricing_rule' | 'payment_terms' | 'delivery_method' | 'delivery_fee_rule' | 'moq' | 'ca_2022' | 'ca_2023' | 'ca_2024' | 'ca_2025' | 'category' | 'account_manager' | 'crm_activity' | 'last_note' | 'actions';

const ALL_COLUMNS: { key: ColumnKey; label: string; minWidth: string; canHide: boolean }[] = [
  { key: 'is_active', label: 'Statut', minWidth: '90px', canHide: true },
  { key: 'company_name', label: 'Client', minWidth: '130px', canHide: false },
  { key: 'country', label: 'Pays', minWidth: '80px', canHide: true },
  { key: 'geographic_zone', label: 'Zone Géo', minWidth: '80px', canHide: true },
  { key: 'contact_email', label: 'Mail contact', minWidth: '140px', canHide: true },
  { key: 'contact_phone', label: 'Tél contact', minWidth: '120px', canHide: true },
  { key: 'pricing_rule', label: 'Pricing', minWidth: '100px', canHide: true },
  { key: 'payment_terms', label: 'Délai paie.', minWidth: '90px', canHide: true },
  { key: 'delivery_method', label: 'Livraison', minWidth: '80px', canHide: true },
  { key: 'delivery_fee_rule', label: 'Frais liv.', minWidth: '80px', canHide: true },
  { key: 'moq', label: 'MOQ', minWidth: '60px', canHide: true },
  { key: 'ca_2022', label: 'CA 2022', minWidth: '80px', canHide: true },
  { key: 'ca_2023', label: 'CA 2023', minWidth: '80px', canHide: true },
  { key: 'ca_2024', label: 'CA 2024', minWidth: '80px', canHide: true },
  { key: 'ca_2025', label: 'CA 2025', minWidth: '80px', canHide: true },
  { key: 'category', label: 'Catégorie', minWidth: '90px', canHide: true },
  { key: 'account_manager', label: 'Gestionnaire', minWidth: '120px', canHide: true },
  { key: 'crm_activity', label: 'Suivi CRM', minWidth: '120px', canHide: true },
  { key: 'last_note', label: 'Dernière note RDV', minWidth: '180px', canHide: true },
  { key: 'actions', label: 'Actions', minWidth: '70px', canHide: false },
];

// Inline editable cell component
function EditableCell({ value, onSave, type = 'text', className = '' }: {
  value: string;
  onSave: (val: string) => void;
  type?: 'text' | 'number';
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:bg-accent/40 px-1 py-0.5 rounded transition-colors inline-block min-w-[2rem] ${className}`}
        onClick={() => setEditing(true)}
        title="Cliquer pour modifier"
      >
        {value || '—'}
      </span>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <Input
      ref={inputRef}
      className="h-7 text-xs w-full"
      type={type}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
    />
  );
}

// Inline select cell
function EditableSelectCell({ value, options, optionItems, onSave, placeholder = '—' }: {
  value: string;
  options?: string[];
  optionItems?: { value: string; label: string }[];
  onSave: (val: string) => void;
  placeholder?: string;
}) {
  const items = optionItems || (options || []).map(o => ({ value: o, label: o }));
  return (
    <Select value={value || 'none'} onValueChange={v => onSave(v === 'none' ? '' : v)}>
      <SelectTrigger className="h-7 text-xs w-full border-dashed">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">{placeholder}</SelectItem>
        {items.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function B2BClientTable({
  clients, projections, deliveryFeeTiers, paymentTermsOptions, deliveryMethods, categories,
  onUpsertClient, onDeleteClient, onBulkImport, onUpsertProjection, getClientProjections,
  onAddDeliveryFee, onDeleteDeliveryFee,
  onAddPaymentTerm, onDeletePaymentTerm,
  onAddDeliveryMethod, onDeleteDeliveryMethod,
  onAddCategory, onDeleteCategory, onUpdateCategory,
  meetings = [], reminders = [], interactions = [],
  isAdmin = false, isColumnEditableByOthers, onToggleColumnPermission,
}: Props) {
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnKey>>(new Set());
  const [detailClient, setDetailClient] = useState<B2BClient | null>(null);

  // Column order — persisted in localStorage
  const COLUMN_ORDER_KEY = 'b2b_column_order';
  const [columnOrder, setColumnOrder] = useState<ColumnKey[]>(() => {
    try {
      const saved = localStorage.getItem(COLUMN_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ColumnKey[];
        // Merge: keep saved order for known keys, append any new columns
        const allKeys = ALL_COLUMNS.map(c => c.key);
        const ordered = parsed.filter(k => allKeys.includes(k));
        const missing = allKeys.filter(k => !ordered.includes(k));
        return [...ordered, ...missing];
      }
    } catch {}
    return ALL_COLUMNS.map(c => c.key);
  });

  const saveColumnOrder = useCallback((order: ColumnKey[]) => {
    setColumnOrder(order);
    localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order));
  }, []);

  // Drag-and-drop state for column reordering
  const dragColRef = useRef<ColumnKey | null>(null);
  const dragOverColRef = useRef<ColumnKey | null>(null);

  const handleDragStart = (key: ColumnKey) => {
    dragColRef.current = key;
  };

  const handleDragOver = (e: React.DragEvent, key: ColumnKey) => {
    e.preventDefault();
    dragOverColRef.current = key;
  };

  const handleDrop = () => {
    const from = dragColRef.current;
    const to = dragOverColRef.current;
    if (!from || !to || from === to) return;
    const newOrder = [...columnOrder];
    const fromIdx = newOrder.indexOf(from);
    const toIdx = newOrder.indexOf(to);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, from);
    saveColumnOrder(newOrder);
    dragColRef.current = null;
    dragOverColRef.current = null;
  };

  const { salesRules } = usePricingConfig();

  const [newForm, setNewForm] = useState({
    company_name: '', country: '', geographic_zone: '', contact_email: '', contact_phone: '',
    eer_date: '', client_type: '', pricing_rule: '', payment_terms: '',
    delivery_method: '', delivery_fee_rule: '', moq: '', category_id: '',
  });

  // Use columnOrder to sort visible columns
  const orderedAllColumns = columnOrder
    .map(key => ALL_COLUMNS.find(c => c.key === key)!)
    .filter(Boolean);
  const visibleColumns = orderedAllColumns.filter(c => !hiddenColumns.has(c.key));
  const hiddenList = orderedAllColumns.filter(c => hiddenColumns.has(c.key) && c.canHide);
  const colSpan = visibleColumns.length;

  const toggleColumn = (key: ColumnKey) => {
    setHiddenColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const isVisible = (key: ColumnKey) => !hiddenColumns.has(key);

  const saveField = async (client: B2BClient, field: keyof B2BClient, value: string) => {
    await onUpsertClient({ id: client.id, company_name: client.company_name, [field]: value || null });
  };

  // Determine if the current user can edit a specific column
  const canEditColumn = (colKey: string): boolean => {
    if (isAdmin) return true;
    if (!isColumnEditableByOthers) return true; // no permission system = editable
    return isColumnEditableByOthers(colKey);
  };

  // Editable column keys that can be permission-controlled
  const EDITABLE_COLUMN_KEYS = ['company_name', 'country', 'geographic_zone', 'contact_email', 'contact_phone', 'pricing_rule', 'payment_terms', 'delivery_method', 'delivery_fee_rule', 'moq', 'is_active', 'category', 'account_manager', 'notes'];

  const handleCreate = async () => {
    if (!newForm.company_name.trim()) return;
    await onUpsertClient({
      company_name: newForm.company_name,
      country: newForm.country || null,
      geographic_zone: newForm.geographic_zone || null,
      contact_email: newForm.contact_email || null,
      contact_phone: newForm.contact_phone || null,
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
    setNewForm({ company_name: '', country: '', geographic_zone: '', contact_email: '', contact_phone: '', eer_date: '', client_type: '', pricing_rule: '', payment_terms: '', delivery_method: '', delivery_fee_rule: '', moq: '', category_id: '' });
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

  const handleRevenueSave = async (clientId: string, year: number, value: string) => {
    const val = parseFloat(value);
    if (!isNaN(val)) await onUpsertProjection(clientId, year, val);
  };

  const deliveryFeeLabels = deliveryFeeTiers.map(t => t.label);
  const paymentTermLabels = paymentTermsOptions.map(t => t.label);
  const deliveryMethodLabels = deliveryMethods.map(m => m.label);

  const exportCSV = () => {
    const headers = ['Statut', 'Client', 'Pays', 'Zone Géo', 'Email', 'Pricing', 'Délai paiement', 'Livraison', 'Frais livraison', 'MOQ', ...revenueYears.map(y => `CA ${y}`), 'Catégorie'];
    const rows = clients.map(c => [
      c.client_type?.toLowerCase() === 'prospect' ? 'Prospect' : c.is_active ? 'Actif' : 'Inactif',
      c.company_name, c.country || '', c.geographic_zone || '',
      c.contact_email || '', c.pricing_rule || '', c.payment_terms || '', c.delivery_method || '',
      c.delivery_fee_rule || '', c.moq || '', ...revenueYears.map(y => String(getRevenue(c.id, y) || '')),
      categories.find(cat => cat.id === c.category_id)?.name || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `clients_b2b_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Fichier CSV exporté');
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmId) { await onDeleteClient(deleteConfirmId); setDeleteConfirmId(null); }
  };

  const uncategorized = clients.filter(c => !c.category_id);
  const grouped = categories.map(cat => ({ category: cat, clients: clients.filter(c => c.category_id === cat.id) }));

  // Read-only cell for locked columns
  const ReadOnlyCell = ({ value, className = '' }: { value: string; className?: string }) => (
    <span className={`px-1 py-0.5 inline-block min-w-[2rem] text-muted-foreground ${className}`}>{value || '—'}</span>
  );

  const renderCell = (c: B2BClient, key: ColumnKey): React.ReactNode => {
    switch (key) {
      case 'is_active':
        return (
          <TableCell key={key}>
            <Select
              value={c.client_type?.toLowerCase() === 'prospect' ? 'prospect' : c.is_active ? 'active' : 'inactive'}
              onValueChange={v => {
                if (!canEditColumn('is_active')) return;
                onUpsertClient({
                  id: c.id, company_name: c.company_name,
                  is_active: v !== 'inactive',
                  client_type: v === 'prospect' ? 'Prospect' : c.client_type?.toLowerCase() === 'prospect' ? null : c.client_type,
                });
              }}
              disabled={!canEditColumn('is_active')}
            >
              <SelectTrigger className="h-6 text-[11px] w-[85px] px-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />Actif</span></SelectItem>
                <SelectItem value="inactive"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground shrink-0" />Inactif</span></SelectItem>
                <SelectItem value="prospect"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />Prospect</span></SelectItem>
              </SelectContent>
            </Select>
          </TableCell>
        );
      case 'company_name':
        return (
          <TableCell key={key} className="font-medium">
            <button className="text-primary hover:underline cursor-pointer text-left text-xs font-medium truncate max-w-[140px]" onClick={() => setDetailClient(c)} title="Ouvrir la fiche client">{c.company_name}</button>
          </TableCell>
        );
      case 'country':
        return (
          <TableCell key={key}>
            <span className="flex items-center gap-1">
              {getCountryFlag(c.country) && <span className="text-base leading-none">{getCountryFlag(c.country)}</span>}
              {canEditColumn('country') ? <EditableCell value={c.country || ''} onSave={v => saveField(c, 'country', v)} /> : <ReadOnlyCell value={c.country || ''} />}
            </span>
          </TableCell>
        );
      case 'geographic_zone':
        return <TableCell key={key}>{canEditColumn('geographic_zone') ? <EditableCell value={c.geographic_zone || ''} onSave={v => saveField(c, 'geographic_zone', v)} /> : <ReadOnlyCell value={c.geographic_zone || ''} />}</TableCell>;
      case 'contact_email':
        return <TableCell key={key}>{canEditColumn('contact_email') ? <EditableCell value={c.contact_email || ''} onSave={v => saveField(c, 'contact_email', v)} /> : <ReadOnlyCell value={c.contact_email || ''} />}</TableCell>;
      case 'contact_phone':
        return <TableCell key={key}>{canEditColumn('contact_phone') ? <EditableCell value={c.contact_phone || ''} onSave={v => saveField(c, 'contact_phone', v)} /> : <ReadOnlyCell value={c.contact_phone || ''} />}</TableCell>;
      case 'pricing_rule':
        return <TableCell key={key}>{canEditColumn('pricing_rule') ? <EditableSelectCell value={c.pricing_rule || ''} options={salesRules.map(r => r.name)} onSave={v => saveField(c, 'pricing_rule', v)} /> : <ReadOnlyCell value={c.pricing_rule || ''} />}</TableCell>;
      case 'payment_terms':
        return <TableCell key={key}>{canEditColumn('payment_terms') ? <EditableSelectCell value={c.payment_terms || ''} options={paymentTermLabels} onSave={v => saveField(c, 'payment_terms', v)} /> : <ReadOnlyCell value={c.payment_terms || ''} />}</TableCell>;
      case 'delivery_method':
        return <TableCell key={key}>{canEditColumn('delivery_method') ? <EditableSelectCell value={c.delivery_method || ''} options={deliveryMethodLabels} onSave={v => saveField(c, 'delivery_method', v)} /> : <ReadOnlyCell value={c.delivery_method || ''} />}</TableCell>;
      case 'delivery_fee_rule':
        return <TableCell key={key}>{canEditColumn('delivery_fee_rule') ? <EditableSelectCell value={c.delivery_fee_rule || ''} options={deliveryFeeLabels} onSave={v => saveField(c, 'delivery_fee_rule', v)} /> : <ReadOnlyCell value={c.delivery_fee_rule || ''} />}</TableCell>;
      case 'moq':
        return <TableCell key={key}>{canEditColumn('moq') ? <EditableCell value={c.moq || ''} onSave={v => saveField(c, 'moq', v)} /> : <ReadOnlyCell value={c.moq || ''} />}</TableCell>;
      case 'ca_2022': case 'ca_2023': case 'ca_2024': case 'ca_2025': {
        const year = parseInt(key.split('_')[1]);
        const rev = getRevenue(c.id, year);
        return <TableCell key={key} className="text-right font-mono"><EditableCell value={rev ? String(rev) : ''} type="number" onSave={v => handleRevenueSave(c.id, year, v)} className="text-right" /></TableCell>;
      }
      case 'category':
        return (
          <TableCell key={key}>
            {canEditColumn('category') ? (
              <EditableSelectCell value={c.category_id || ''} optionItems={categories.map(cat => ({ value: cat.id, label: cat.name }))} onSave={v => onUpsertClient({ id: c.id, company_name: c.company_name, category_id: v || null })} placeholder="—" />
            ) : (
              <ReadOnlyCell value={categories.find(cat => cat.id === c.category_id)?.name || ''} />
            )}
          </TableCell>
        );
      case 'account_manager':
        return <TableCell key={key}>{canEditColumn('account_manager') ? <EditableCell value={c.account_manager || ''} onSave={v => saveField(c, 'account_manager', v)} /> : <ReadOnlyCell value={c.account_manager || ''} />}</TableCell>;
      case 'crm_activity': {
        const today = new Date().toISOString().slice(0, 10);
        const clientMeetings = meetings.filter(m => m.customer_id === c.id);
        const plannedMeetings = clientMeetings.filter(m => m.status === 'planned');
        const clientReminders = reminders.filter(r => r.customer_id === c.id && !r.is_completed);
        const overdueReminders = clientReminders.filter(r => r.due_date < today);
        const clientInteractions = interactions.filter(i => i.customer_id === c.id);
        return (
          <TableCell key={key}>
            <div className="flex items-center gap-1.5 flex-wrap">
              {plannedMeetings.length > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium"><Calendar className="h-3 w-3" />{plannedMeetings.length}</span>}
              {overdueReminders.length > 0 ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium"><AlertTriangle className="h-3 w-3" />{overdueReminders.length}</span>
              ) : clientReminders.length > 0 ? (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-700 text-[10px] font-medium"><Bell className="h-3 w-3" />{clientReminders.length}</span>
              ) : null}
              {clientInteractions.length > 0 && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px] font-medium"><MessageSquare className="h-3 w-3" />{clientInteractions.length}</span>}
              {plannedMeetings.length === 0 && clientReminders.length === 0 && clientInteractions.length === 0 && <span className="text-[10px] text-muted-foreground">—</span>}
            </div>
          </TableCell>
        );
      }
      case 'last_note': {
        const clientMeetingsWithNotes = meetings
          .filter(m => m.customer_id === c.id && m.notes && m.notes.trim().length > 0)
          .sort((a, b) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime());
        const lastNote = clientMeetingsWithNotes[0]?.notes || null;
        return (
          <TableCell key={key}>
            {lastNote ? (
              <div className="flex items-start gap-1 max-w-[200px]">
                <FileText className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-[11px] text-muted-foreground line-clamp-2 leading-tight">{lastNote}</span>
              </div>
            ) : <span className="text-[10px] text-muted-foreground">—</span>}
          </TableCell>
        );
      }
      case 'actions':
        return (
          <TableCell key={key}>
            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(c.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </TableCell>
        );
      default:
        return null;
    }
  };

  const renderClientRow = (c: B2BClient) => (
    <TableRow key={c.id} className="text-xs">
      {visibleColumns.map(col => renderCell(c, col.key))}
    </TableRow>
  );

  const renderCategoryHeader = (cat: B2BClientCategory, count: number) => {
    const isCollapsed = collapsedCategories.has(cat.id);
    return (
      <TableRow key={`cat-${cat.id}`} className="bg-muted/40 hover:bg-muted/60 cursor-pointer" onClick={() => toggleCategory(cat.id)}>
        <TableCell colSpan={colSpan} className="py-2">
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

        {/* Column visibility toggle */}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="ml-auto">
              <Columns3 className="h-4 w-4 mr-1" />
              Colonnes
              {hiddenList.length > 0 && (
                <Badge variant="secondary" className="ml-1 text-[9px] px-1.5">{hiddenList.length} masquée{hiddenList.length > 1 ? 's' : ''}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="end">
            <p className="text-xs font-medium mb-2 text-muted-foreground">Afficher / Masquer</p>
            <div className="space-y-1.5">
              {ALL_COLUMNS.filter(c => c.canHide).map(col => (
                <label key={col.key} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-accent/40 px-1.5 py-1 rounded">
                  <Checkbox
                    checked={!hiddenColumns.has(col.key)}
                    onCheckedChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <span className="text-xs text-muted-foreground">{clients.length} client(s)</span>
      </div>

      {/* Hidden columns bar */}
      {hiddenList.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground">Colonnes masquées :</span>
          {hiddenList.map(col => (
            <Badge
              key={col.key}
              variant="outline"
              className="text-[10px] cursor-pointer hover:bg-accent gap-1 px-2 py-0.5"
              onClick={() => toggleColumn(col.key)}
            >
              <Eye className="h-3 w-3" />
              {col.label}
            </Badge>
          ))}
        </div>
      )}

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

      {/* Categories */}
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
               {visibleColumns.map(col => {
                 const isPermColumn = EDITABLE_COLUMN_KEYS.includes(col.key);
                 const colEditable = isPermColumn ? isColumnEditableByOthers?.(col.key) ?? false : false;
                 return (
                   <TableHead
                     key={col.key}
                     className={`text-[10px] min-w-[${col.minWidth}] ${col.key.startsWith('ca_') ? 'text-right bg-accent/20' : ''}`}
                     draggable
                     onDragStart={() => handleDragStart(col.key)}
                     onDragOver={e => handleDragOver(e, col.key)}
                     onDrop={handleDrop}
                     style={{ cursor: 'grab' }}
                   >
                     <div className="flex items-center gap-1">
                       <GripVertical className="h-3 w-3 text-muted-foreground/40 shrink-0 cursor-grab" />
                       {col.canHide && (
                         <Checkbox
                           checked={true}
                           onCheckedChange={() => toggleColumn(col.key)}
                           className="h-3 w-3 shrink-0"
                           title={`Masquer "${col.label}"`}
                         />
                       )}
                       <span>{col.label}</span>
                       {isAdmin && isPermColumn && onToggleColumnPermission && (
                         <Tooltip>
                           <TooltipTrigger asChild>
                             <button
                               onClick={() => onToggleColumnPermission(col.key, !colEditable)}
                               className={`ml-auto p-0.5 rounded transition-colors ${colEditable ? 'text-primary hover:text-primary/80' : 'text-muted-foreground/40 hover:text-muted-foreground'}`}
                             >
                               {colEditable ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                             </button>
                           </TooltipTrigger>
                           <TooltipContent side="top" className="text-xs">
                             {colEditable ? 'Colonne ouverte en écriture (cliquer pour verrouiller)' : 'Colonne verrouillée (cliquer pour ouvrir en écriture)'}
                           </TooltipContent>
                         </Tooltip>
                       )}
                     </div>
                   </TableHead>
                 );
               })}
             </TableRow>
           </TableHeader>
          <TableBody>
            {clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={colSpan} className="text-center text-muted-foreground py-8 text-sm">
                  Aucun client — Ajoutez-en ou importez via copier-coller
                </TableCell>
              </TableRow>
            )}
            {grouped.map(({ category, clients: catClients }) => {
              if (catClients.length === 0) return null;
              const isCollapsed = collapsedCategories.has(category.id);
              return [
                renderCategoryHeader(category, catClients.length),
                ...(!isCollapsed ? catClients.map(renderClientRow) : []),
              ];
            })}
            {uncategorized.length > 0 && (
              <>
                {categories.length > 0 && (
                  <TableRow className="bg-muted/20">
                    <TableCell colSpan={colSpan} className="py-2">
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
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Email contact" value={newForm.contact_email} onChange={e => setNewForm(f => ({ ...f, contact_email: e.target.value }))} />
              <Input placeholder="Tél contact" value={newForm.contact_phone} onChange={e => setNewForm(f => ({ ...f, contact_phone: e.target.value }))} />
            </div>
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
      {/* Client detail dialog */}
      <B2BClientDetailDialog
        client={detailClient}
        open={!!detailClient}
        onOpenChange={open => { if (!open) setDetailClient(null); }}
        onSave={onUpsertClient}
        categories={categories}
        paymentTermsOptions={paymentTermsOptions}
        deliveryMethods={deliveryMethods}
        deliveryFeeTiers={deliveryFeeTiers}
        readOnly={!canEditColumn('company_name')}
      />
    </div>
  );
}
