import { useState } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit2, Landmark, Calculator, PenLine } from 'lucide-react';
import { formatCurrency } from '@/data/financialConfig';
import { LoanConfig, LoanInputMode, MonthIndex, MONTHS } from '@/engine/monthlyTreasuryEngine';
import { cn } from '@/lib/utils';

interface LoanManagerProps {
  loans: LoanConfig[];
  onChange: (loans: LoanConfig[]) => void;
  startYear: number;
  durationYears: number;
}

const EMPTY_LOAN: Omit<LoanConfig, 'id'> = {
  name: '',
  inputMode: 'calculated',
  principalAmount: 50000,
  interestRate: 0.03,
  fixedPaymentAmount: 0,
  startDate: { year: 2025, month: 0 as MonthIndex },
  endDate: { year: 2028, month: 0 as MonthIndex },
  frequency: 'monthly',
};

const FREQ_LABELS: Record<string, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  annual: 'Annuel',
};

const FREQ_SHORT: Record<string, string> = {
  monthly: '/mois',
  quarterly: '/trim.',
  annual: '/an',
};

export function LoanManager({ loans, onChange, startYear, durationYears }: LoanManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<LoanConfig, 'id'>>(EMPTY_LOAN);

  const years = Array.from({ length: durationYears + 2 }, (_, i) => startYear + i);

  const openAdd = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_LOAN,
      startDate: { year: startYear, month: 0 as MonthIndex },
      endDate: { year: startYear + 3, month: 0 as MonthIndex },
    });
    setShowDialog(true);
  };

  const openEdit = (loan: LoanConfig) => {
    setEditingId(loan.id);
    const { id, ...rest } = loan;
    setForm({ ...EMPTY_LOAN, ...rest });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editingId) {
      onChange(loans.map(l => l.id === editingId ? { ...l, ...form } : l));
    } else {
      onChange([...loans, { id: `loan-${Date.now()}`, ...form }]);
    }
    setShowDialog(false);
  };

  const handleDelete = (id: string) => {
    onChange(loans.filter(l => l.id !== id));
  };

  const calcDisplayPayment = (loan: LoanConfig): number => {
    if (loan.inputMode === 'fixed') return loan.fixedPaymentAmount || 0;

    const startMonth = loan.startDate.year * 12 + loan.startDate.month;
    const endMonth = loan.endDate.year * 12 + loan.endDate.month;
    const n = endMonth - startMonth;
    if (n <= 0) return 0;

    if (loan.frequency === 'annual') {
      const numYears = Math.max(1, Math.round(n / 12));
      const r = loan.interestRate;
      if (r === 0) return loan.principalAmount / numYears;
      return loan.principalAmount * r * Math.pow(1 + r, numYears) / (Math.pow(1 + r, numYears) - 1);
    }
    if (loan.frequency === 'quarterly') {
      const numQ = Math.max(1, Math.round(n / 3));
      const r = loan.interestRate / 4;
      if (r === 0) return loan.principalAmount / numQ;
      return loan.principalAmount * r * Math.pow(1 + r, numQ) / (Math.pow(1 + r, numQ) - 1);
    }
    // monthly
    const r = loan.interestRate / 12;
    if (r === 0) return loan.principalAmount / n;
    return loan.principalAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  };

  const calcTotalCost = (loan: LoanConfig): number => {
    const payment = calcDisplayPayment(loan);
    const startMonth = loan.startDate.year * 12 + loan.startDate.month;
    const endMonth = loan.endDate.year * 12 + loan.endDate.month;
    const n = endMonth - startMonth;
    if (n <= 0) return 0;
    if (loan.frequency === 'annual') return payment * Math.max(1, Math.round(n / 12));
    if (loan.frequency === 'quarterly') return payment * Math.max(1, Math.round(n / 3));
    return payment * n;
  };

  return (
    <>
      <SectionCard
        title="Gestion des Prêts"
        action={
          <Button variant="outline" size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter un Prêt
          </Button>
        }
      >
        {loans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Landmark className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Aucun prêt configuré</p>
            <p className="text-xs mt-1">Ajoutez vos prêts pour intégrer les échéances dans le plan de trésorerie.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="text-right">Capital</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Échéance</TableHead>
                  <TableHead className="text-right">Coût Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map(loan => {
                  const payment = calcDisplayPayment(loan);
                  const totalCost = calcTotalCost(loan);
                  return (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {loan.inputMode === 'fixed' ? (
                            <><PenLine className="h-3 w-3 mr-1" />Fixe</>
                          ) : (
                            <><Calculator className="h-3 w-3 mr-1" />Calculé</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono-numbers">
                        {loan.inputMode === 'calculated' ? formatCurrency(loan.principalAmount, true) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono-numbers">
                        {loan.inputMode === 'calculated' ? `${(loan.interestRate * 100).toFixed(1)}%` : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {FREQ_LABELS[loan.frequency]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {MONTHS[loan.startDate.month].slice(0, 3)} {loan.startDate.year}
                        {' → '}
                        {MONTHS[loan.endDate.month].slice(0, 3)} {loan.endDate.year}
                      </TableCell>
                      <TableCell className="text-right font-mono-numbers font-medium">
                        {formatCurrency(payment)}
                        <span className="text-xs text-muted-foreground ml-1">{FREQ_SHORT[loan.frequency]}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono-numbers text-muted-foreground">
                        {formatCurrency(totalCost, true)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(loan)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(loan.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le Prêt' : 'Nouveau Prêt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom du prêt</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: BPI Innovation" />
            </div>

            {/* Mode selector */}
            <div className="space-y-2">
              <Label>Mode de saisie</Label>
              <Tabs value={form.inputMode} onValueChange={v => setForm(f => ({ ...f, inputMode: v as LoanInputMode }))}>
                <TabsList className="w-full">
                  <TabsTrigger value="calculated" className="flex-1">
                    <Calculator className="h-4 w-4 mr-1" />
                    Calculer l'échéance
                  </TabsTrigger>
                  <TabsTrigger value="fixed" className="flex-1">
                    <PenLine className="h-4 w-4 mr-1" />
                    Saisir l'échéance
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Mode calculated fields */}
            {form.inputMode === 'calculated' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Montant emprunté (€)</Label>
                  <Input type="number" value={form.principalAmount} onChange={e => setForm(f => ({ ...f, principalAmount: Number(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Taux d'intérêt annuel (%)</Label>
                  <Input type="number" step="0.1" value={(form.interestRate * 100).toFixed(1)} onChange={e => setForm(f => ({ ...f, interestRate: Number(e.target.value) / 100 }))} />
                </div>
              </div>
            )}

            {/* Mode fixed fields */}
            {form.inputMode === 'fixed' && (
              <div className="space-y-2">
                <Label>Montant de l'échéance (€)</Label>
                <Input
                  type="number"
                  value={form.fixedPaymentAmount || 0}
                  onChange={e => setForm(f => ({ ...f, fixedPaymentAmount: Number(e.target.value) }))}
                  placeholder="Montant fixe par période"
                />
                <p className="text-xs text-muted-foreground">
                  Ce montant sera appliqué à chaque échéance ({FREQ_LABELS[form.frequency].toLowerCase()}).
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Fréquence des échéances</Label>
              <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v as LoanConfig['frequency'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensuel</SelectItem>
                  <SelectItem value="quarterly">Trimestriel</SelectItem>
                  <SelectItem value="annual">Annuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <div className="flex gap-2">
                  <Select value={form.startDate.month.toString()} onValueChange={v => setForm(f => ({ ...f, startDate: { ...f.startDate, month: Number(v) as MonthIndex } }))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m.slice(0, 3)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.startDate.year.toString()} onValueChange={v => setForm(f => ({ ...f, startDate: { ...f.startDate, year: Number(v) } }))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date de fin</Label>
                <div className="flex gap-2">
                  <Select value={form.endDate.month.toString()} onValueChange={v => setForm(f => ({ ...f, endDate: { ...f.endDate, month: Number(v) as MonthIndex } }))}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m.slice(0, 3)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={form.endDate.year.toString()} onValueChange={v => setForm(f => ({ ...f, endDate: { ...f.endDate, year: Number(v) } }))}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Preview */}
            {form.name.trim() && (
              <div className="p-3 rounded-lg bg-muted/40 border text-sm space-y-1">
                <div className="font-medium">Aperçu</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Échéance {FREQ_LABELS[form.frequency].toLowerCase()} :</span>
                  <span className="font-mono-numbers font-medium">
                    {formatCurrency(calcDisplayPayment({ id: '', ...form }))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Coût total :</span>
                  <span className="font-mono-numbers">
                    {formatCurrency(calcTotalCost({ id: '', ...form }), true)}
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!form.name.trim()}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
