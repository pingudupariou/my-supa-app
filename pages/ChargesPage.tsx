import { useState } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { Expense, ExpenseCategory, EvolutionType } from '@/engine/types';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { PageExportPDF, ExportableSection } from '@/components/export/PageExportPDF';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Edit2, Check, X, Info, ListTree, Calculator } from 'lucide-react';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

const CATEGORIES: ExpenseCategory[] = ['R&D', 'Production', 'Sales & Marketing', 'G&A', 'Logistics', 'IT & Tools'];
const EVOLUTION_TYPES: { value: EvolutionType; label: string }[] = [
  { value: 'fixed', label: 'Fixe' },
  { value: 'growth_rate', label: 'Taux de croissance' },
  { value: 'linked_to_revenue', label: 'Lié au CA' },
  { value: 'linked_to_volume', label: 'Lié aux volumes' },
  { value: 'step', label: 'Par paliers' },
];
const COLORS = ['hsl(0, 85%, 50%)', 'hsl(0, 0%, 30%)', 'hsl(38, 92%, 50%)', 'hsl(210, 70%, 50%)', 'hsl(150, 60%, 40%)', 'hsl(280, 60%, 50%)'];

const GROWTH_RATES = [0, 0.02, 0.03, 0.05, 0.07, 0.10, 0.15, 0.20];

const EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'kpis', label: 'KPIs Charges', elementId: 'charges-kpis' },
  { id: 'chart', label: 'Graphique OPEX', elementId: 'charges-chart' },
  { id: 'breakdown', label: 'Répartition par Catégorie', elementId: 'charges-breakdown' },
  { id: 'table', label: 'Tableau des Charges', elementId: 'charges-table' },
];

export function ChargesPage() {
  const { 
    state, 
    computed, 
    updateExpenses, 
    addExpense, 
    removeExpense, 
    setOpexMode, 
    updateSimpleOpexConfig, 
    saveAll 
  } = useFinancial();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Expense>>({});
  
  // Générer les années depuis les paramètres de scénario
  const { startYear, durationYears } = state.scenarioSettings;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);
  const [selectedYear, setSelectedYear] = useState<number>(startYear);

  const handleAddExpense = () => {
    const newExpense: Expense = {
      id: `expense-${Date.now()}`,
      name: 'Nouvelle Charge',
      category: 'G&A',
      startYear: startYear,
      baseAnnualCost: 10000,
      evolutionType: 'fixed',
      description: 'Description de la charge',
    };
    addExpense(newExpense);
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditForm(expense);
  };

  const handleSaveEdit = () => {
    if (editingId && editForm) {
      const updatedExpenses = state.expenses.map(e =>
        e.id === editingId ? { ...e, ...editForm } : e
      );
      updateExpenses(updatedExpenses);
      setEditingId(null);
      setEditForm({});
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Total OPEX (utiliser les années dynamiques)
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const totalOpexFirst = computed.opexByYear.find(o => o.year === firstYear)?.opex || 0;
  const totalOpexLast = computed.opexByYear.find(o => o.year === lastYear)?.opex || 0;
  const revenueFirst = computed.revenueByYear.find(r => r.year === firstYear)?.revenue || 1;
  const opexRatio = totalOpexFirst / revenueFirst;

  // OPEX par catégorie pour l'année sélectionnée (depuis computed.opexByYear)
  const selectedYearData = computed.opexByYear.find(o => o.year === selectedYear);
  const opexByCategory = selectedYearData
    ? CATEGORIES.map((cat, i) => ({
        name: cat,
        value: selectedYearData.byCategory[cat] || 0,
        color: COLORS[i],
      })).filter(c => c.value > 0)
    : [];

  // OPEX projection chart
  const opexChartData = computed.opexByYear.map(o => ({
    year: o.year,
    opex: o.opex / 1000,
  }));

  return (
    <ReadOnlyWrapper tabKey="charges">
    <div className="space-y-6">
      <HeroBanner
        image="rd"
        title="Structure des Charges"
        subtitle="OPEX détaillées avec évolution automatique"
        height="sm"
      />

      <div className="flex justify-between items-center">
        <Badge variant="outline" className="text-xs">
          {state.opexMode === 'detailed' ? `${state.expenses.length} postes de charges` : 'Mode simplifié'} • Évolution automatique
        </Badge>
        <div className="flex items-center gap-2">
          <PageExportPDF
            pageTitle="Structure des Charges"
            sections={EXPORT_SECTIONS}
            fileName="Charges_OPEX"
          />
          {state.opexMode === 'detailed' && (
            <Button variant="outline" size="sm" onClick={handleAddExpense}>
              <Plus className="h-4 w-4 mr-1" />
              Ajouter Charge
            </Button>
          )}
          <SaveButton
            onSave={saveAll}
            hasUnsavedChanges={state.hasUnsavedChanges}
            lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
          />
        </div>
      </div>

      {/* Mode Toggle */}
      <SectionCard title="Mode de Calcul">
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setOpexMode('detailed')}
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all",
              state.opexMode === 'detailed'
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <ListTree className={cn("h-8 w-8 mb-2", state.opexMode === 'detailed' ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("font-medium", state.opexMode === 'detailed' ? "text-primary" : "text-foreground")}>
              Détail par Poste
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              Saisie poste par poste avec évolution spécifique
            </span>
          </button>
          
          <button
            onClick={() => setOpexMode('simple')}
            className={cn(
              "flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all",
              state.opexMode === 'simple'
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50"
            )}
          >
            <Calculator className={cn("h-8 w-8 mb-2", state.opexMode === 'simple' ? "text-primary" : "text-muted-foreground")} />
            <span className={cn("font-medium", state.opexMode === 'simple' ? "text-primary" : "text-foreground")}>
              Montant Global
            </span>
            <span className="text-xs text-muted-foreground mt-1">
              Un montant total avec taux d'évolution
            </span>
          </button>
        </div>
      </SectionCard>

      {/* Mode Simplifié - Configuration */}
      {state.opexMode === 'simple' && (
        <SectionCard title="Configuration Simplifiée">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Montant OPEX annuel de base ({firstYear})</Label>
              <Input
                type="number"
                value={state.simpleOpexConfig.baseAmount}
                onChange={(e) => updateSimpleOpexConfig({ baseAmount: Number(e.target.value) })}
                className="font-mono-numbers"
              />
              <p className="text-xs text-muted-foreground">
                Montant total des charges opérationnelles pour l'année de départ
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Évolution annuelle (%)</Label>
              <Select
                value={(state.simpleOpexConfig.growthRate * 100).toString()}
                onValueChange={(v) => updateSimpleOpexConfig({ growthRate: Number(v) / 100 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROWTH_RATES.map(rate => (
                    <SelectItem key={rate} value={(rate * 100).toString()}>
                      +{(rate * 100).toFixed(0)}% / an
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Taux d'augmentation appliqué chaque année
              </p>
            </div>
          </div>
          
          {/* Preview de la projection */}
          <div className="mt-6 p-4 bg-muted/50 rounded-lg">
            <h4 className="text-sm font-medium mb-3">Projection sur la période</h4>
            <div className="flex gap-4 flex-wrap">
              {years.map((year, index) => {
                const opex = state.simpleOpexConfig.baseAmount * Math.pow(1 + state.simpleOpexConfig.growthRate, index);
                return (
                  <div key={year} className="text-center">
                    <div className="text-xs text-muted-foreground">{year}</div>
                    <div className="font-mono-numbers text-sm font-medium">{formatCurrency(opex, true)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="charges-kpis">
        <KPICard
          label={`OPEX ${firstYear}`}
          value={formatCurrency(totalOpexFirst, true)}
          subValue={state.opexMode === 'detailed' ? `${state.expenses.length} postes` : 'Mode simplifié'}
        />
        <KPICard
          label="Ratio OPEX / CA"
          value={formatPercent(opexRatio)}
          subValue={firstYear.toString()}
        />
        <KPICard
          label={`OPEX ${lastYear}`}
          value={formatCurrency(totalOpexLast, true)}
          subValue="Projection"
          trend="up"
        />
        <KPICard
          label="Croissance OPEX"
          value={totalOpexFirst > 0 ? formatPercent((totalOpexLast / totalOpexFirst) - 1) : 'N/A'}
          subValue={`${firstYear}-${lastYear}`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* OPEX Projection */}
        <SectionCard title="Évolution des Charges" id="charges-chart">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opexChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${v}k€`} />
                <RechartsTooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                <Bar dataKey="opex" name="OPEX" fill="hsl(0, 85%, 50%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Category Distribution - Only show for detailed mode */}
        {state.opexMode === 'detailed' && opexByCategory.length > 0 && (
          <SectionCard title="Répartition par Catégorie" id="charges-breakdown">
            <div className="flex justify-end mb-4">
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={opexByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name }) => name}
                  >
                    {opexByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-center text-sm text-muted-foreground">
              Total {selectedYear}: <span className="font-mono-numbers font-medium">{formatCurrency(selectedYearData?.opex || 0, true)}</span>
            </div>
          </SectionCard>
        )}
        
        {/* Simple mode summary */}
        {state.opexMode === 'simple' && (
          <SectionCard title="Récapitulatif" id="charges-breakdown">
            <div className="flex flex-col items-center justify-center h-56">
              <div className="text-center space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">Montant de base</div>
                  <div className="text-3xl font-mono-numbers font-bold">{formatCurrency(state.simpleOpexConfig.baseAmount, true)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Évolution annuelle</div>
                  <div className="text-xl font-medium text-primary">+{(state.simpleOpexConfig.growthRate * 100).toFixed(0)}%</div>
                </div>
                <div className="text-xs text-muted-foreground pt-2">
                  Les données sont synchronisées avec les autres modules (Financement, Synthèse)
                </div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* Expenses Table - Only show for detailed mode */}
      {state.opexMode === 'detailed' && (
        <SectionCard title="Détail des Charges" id="charges-table">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Charge</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Type d'évolution</TableHead>
                  <TableHead className="text-right">Coût Base</TableHead>
                  <TableHead>Paramètre</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    {editingId === expense.id ? (
                      <>
                        <TableCell>
                          <Input
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editForm.category}
                            onValueChange={(v) => setEditForm({ ...editForm, category: v as ExpenseCategory })}
                          >
                            <SelectTrigger className="h-8 w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={editForm.evolutionType}
                            onValueChange={(v) => setEditForm({ ...editForm, evolutionType: v as EvolutionType })}
                          >
                            <SelectTrigger className="h-8 w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {EVOLUTION_TYPES.map(et => (
                                <SelectItem key={et.value} value={et.value}>{et.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={editForm.baseAnnualCost || 0}
                            onChange={(e) => setEditForm({ ...editForm, baseAnnualCost: Number(e.target.value) })}
                            className="h-8 w-28 text-right"
                          />
                        </TableCell>
                        <TableCell>
                          {editForm.evolutionType === 'growth_rate' && (
                            <Input
                              type="number"
                              step="0.01"
                              value={(editForm.growthRate || 0) * 100}
                              onChange={(e) => setEditForm({ ...editForm, growthRate: Number(e.target.value) / 100 })}
                              className="h-8 w-20"
                              placeholder="%"
                            />
                          )}
                          {editForm.evolutionType === 'linked_to_revenue' && (
                            <Input
                              type="number"
                              step="0.01"
                              value={(editForm.revenueRatio || 0) * 100}
                              onChange={(e) => setEditForm({ ...editForm, revenueRatio: Number(e.target.value) / 100 })}
                              className="h-8 w-20"
                              placeholder="% CA"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={handleSaveEdit}>
                              <Check className="h-4 w-4 text-accent" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={handleCancelEdit}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {expense.name}
                            {expense.description && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">{expense.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{expense.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {EVOLUTION_TYPES.find(et => et.value === expense.evolutionType)?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono-numbers">
                          {formatCurrency(expense.baseAnnualCost)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {expense.evolutionType === 'growth_rate' && `+${formatPercent(expense.growthRate || 0)}/an`}
                          {expense.evolutionType === 'linked_to_revenue' && `${formatPercent(expense.revenueRatio || 0)} du CA`}
                          {expense.evolutionType === 'linked_to_volume' && `${expense.volumeRatio || 0}€/unité`}
                          {expense.evolutionType === 'step' && `${expense.steps?.length || 0} paliers`}
                          {expense.evolutionType === 'fixed' && 'Constant'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(expense)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => removeExpense(expense.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </div>
    </ReadOnlyWrapper>
  );
}
