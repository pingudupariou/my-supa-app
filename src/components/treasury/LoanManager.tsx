import { useState } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit2, Landmark } from 'lucide-react';
import { formatCurrency } from '@/data/financialConfig';
import { LoanConfig, MonthIndex, MONTHS } from '@/engine/monthlyTreasuryEngine';
import { cn } from '@/lib/utils';

interface LoanManagerProps {
  loans: LoanConfig[];
  onChange: (loans: LoanConfig[]) => void;
  startYear: number;
  durationYears: number;
}

const EMPTY_LOAN: Omit<LoanConfig, 'id'> = {
  name: '',
  principalAmount: 50000,
  interestRate: 0.03,
  startDate: { year: 2025, month: 0 as MonthIndex },
  endDate: { year: 2028, month: 0 as MonthIndex },
  frequency: 'monthly',
};

export function LoanManager({ loans, onChange, startYear, durationYears }: LoanManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<LoanConfig, 'id'>>(EMPTY_LOAN);

  const years = Array.from({ length: durationYears + 2 }, (_, i) => startYear + i);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_LOAN, startDate: { year: startYear, month: 0 as MonthIndex }, endDate: { year: startYear + 3, month: 0 as MonthIndex } });
    setShowDialog(true);
  };

  const openEdit = (loan: LoanConfig) => {
    setEditingId(loan.id);
    setForm({ name: loan.name, principalAmount: loan.principalAmount, interestRate: loan.interestRate, startDate: loan.startDate, endDate: loan.endDate, frequency: loan.frequency });
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

  // Calculate monthly payment for display
  const calcMonthlyPayment = (loan: LoanConfig) => {
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
    const r = loan.interestRate / 12;
    if (r === 0) return loan.principalAmount / n;
    return loan.principalAmount * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
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
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Taux</TableHead>
                  <TableHead>Fréquence</TableHead>
                  <TableHead>Début</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead className="text-right">Échéance</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map(loan => {
                  const payment = calcMonthlyPayment(loan);
                  return (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">{loan.name}</TableCell>
                      <TableCell className="text-right font-mono-numbers">{formatCurrency(loan.principalAmount, true)}</TableCell>
                      <TableCell className="text-right font-mono-numbers">{(loan.interestRate * 100).toFixed(1)}%</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {loan.frequency === 'monthly' ? 'Mensuel' : 'Annuel'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{MONTHS[loan.startDate.month].slice(0, 3)} {loan.startDate.year}</TableCell>
                      <TableCell className="text-xs">{MONTHS[loan.endDate.month].slice(0, 3)} {loan.endDate.year}</TableCell>
                      <TableCell className="text-right font-mono-numbers font-medium">
                        {formatCurrency(payment)}
                        <span className="text-xs text-muted-foreground ml-1">/{loan.frequency === 'monthly' ? 'mois' : 'an'}</span>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le Prêt' : 'Nouveau Prêt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nom du prêt</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: BPI Innovation" />
            </div>
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
            <div className="space-y-2">
              <Label>Fréquence des échéances</Label>
              <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v as 'monthly' | 'annual' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensuel</SelectItem>
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
