import { useState } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { Role, Department } from '@/engine/types';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { OrgChart } from '@/components/organisation/OrgChart';
import { PageExportPDF, ExportableSection } from '@/components/export/PageExportPDF';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Grid3x3, List } from 'lucide-react';
import { formatCurrency } from '@/data/financialConfig';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const DEPARTMENTS: Department[] = ['R&D', 'Production', 'Sales', 'Support', 'Admin'];
const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

const EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'kpis', label: 'KPIs RH', elementId: 'org-kpis' },
  { id: 'payroll-chart', label: 'Évolution Masse Salariale', elementId: 'org-payroll-chart' },
  { id: 'hiring-plan', label: 'Plan de Recrutement', elementId: 'org-hiring-plan' },
  { id: 'team', label: 'Équipe / Organigramme', elementId: 'org-team' },
];

export function OrganisationPage() {
  const { state, computed, updateRoles, addRole, removeRole, saveAll } = useFinancial();
  const [viewMode, setViewMode] = useState<'orgchart' | 'table'>('orgchart');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Role>>({});

  const handleAddRole = (department?: Department) => {
    const newRole: Role = {
      id: `role-${Date.now()}`,
      title: 'Nouveau Poste',
      department: department || 'R&D',
      startYear: 2026,
      annualCostLoaded: 50000,
    };
    setEditForm(newRole);
    setEditingRole(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setEditForm(role);
    setIsDialogOpen(true);
  };

  const handleSaveRole = () => {
    if (editForm.title && editForm.department) {
      if (editingRole) {
        const updatedRoles = state.roles.map(r =>
          r.id === editingRole.id ? { ...r, ...editForm } : r
        );
        updateRoles(updatedRoles);
      } else {
        addRole(editForm as Role);
      }
      setIsDialogOpen(false);
      setEditForm({});
      setEditingRole(null);
    }
  };

  // Payroll projection chart
  const payrollChartData = computed.payrollByYear.map(p => ({
    year: p.year,
    payroll: p.payroll / 1000,
    headcount: p.headcount,
  }));

  // Future hires
  const futureHires = state.roles.filter(r => r.startYear > 2025);
  const hiresByYear = YEARS.slice(1).map(year => ({
    year,
    count: state.roles.filter(r => r.startYear === year).length,
    cost: state.roles.filter(r => r.startYear === year).reduce((sum, r) => sum + r.annualCostLoaded, 0),
  })).filter(h => h.count > 0);

  return (
    <ReadOnlyWrapper tabKey="organisation">
    <div className="space-y-6">
      <HeroBanner
        image="rd"
        title="Organisation & Masse Salariale"
        subtitle="Structure de l'équipe et projection des coûts RH"
        height="sm"
      />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {computed.totalHeadcount} collaborateurs
          </Badge>
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as 'orgchart' | 'table')}>
            <ToggleGroupItem value="orgchart" aria-label="Vue organigramme">
              <Grid3x3 className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Vue tableau">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="flex items-center gap-2">
          <PageExportPDF
            pageTitle="Organisation & RH"
            sections={EXPORT_SECTIONS}
            fileName="Organisation_RH"
          />
          <Button variant="outline" size="sm" onClick={() => handleAddRole()}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter Poste
          </Button>
          <SaveButton
            onSave={saveAll}
            hasUnsavedChanges={state.hasUnsavedChanges}
            lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
          />
        </div>
      </div>

      {/* KPIs */}
      <div id="org-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Masse Salariale 2025"
          value={formatCurrency(computed.currentPayroll, true)}
          subValue={`${computed.totalHeadcount} personnes`}
        />
        <KPICard
          label="Recrutements Prévus"
          value={futureHires.length.toString()}
          subValue="2026-2030"
        />
        <KPICard
          label="Coût Moyen / ETP"
          value={formatCurrency(computed.currentPayroll / (computed.totalHeadcount || 1), true)}
          subValue="Chargé"
        />
        <KPICard
          label="Masse Salariale 2030"
          value={formatCurrency(computed.payrollByYear.find(p => p.year === 2030)?.payroll || 0, true)}
          subValue="Projection"
          trend="up"
        />
      </div>

      {/* Payroll Projection */}
      <div id="org-payroll-chart">
        <SectionCard title="Évolution de la Masse Salariale">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={payrollChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${v}k€`} />
                <Tooltip formatter={(value: number, name: string) => 
                  name === 'payroll' ? `${value.toFixed(0)}k€` : value
                } />
                <Legend />
                <Area type="monotone" dataKey="payroll" name="Masse salariale" fill="hsl(var(--primary))" stroke="hsl(var(--primary))" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      {/* Future Hires Summary */}
      <div id="org-hiring-plan">
        {hiresByYear.length > 0 && (
          <SectionCard title="Plan de Recrutement">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {hiresByYear.map(({ year, count, cost }) => (
                <div key={year} className="p-4 bg-muted/30 rounded-lg text-center">
                  <div className="text-lg font-semibold">{year}</div>
                  <div className="text-2xl font-bold text-primary">+{count}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(cost, true)}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Vue conditionnelle: Organigramme ou Table */}
      <div id="org-team">
        {viewMode === 'orgchart' ? (
          <SectionCard title="Organigramme">
            <OrgChart
              roles={state.roles}
              onEdit={handleEdit}
              onRemove={removeRole}
              onAddToTeam={handleAddRole}
            />
          </SectionCard>
        ) : (
          <SectionCard title="Équipe & Recrutements">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Poste</TableHead>
                    <TableHead>Département</TableHead>
                    <TableHead>Début</TableHead>
                    <TableHead className="text-right">Coût Annuel</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.roles.map((role) => (
                    <TableRow key={role.id} className={role.startYear > 2025 ? 'bg-muted/20' : ''}>
                      <TableCell className="font-medium">
                        {role.title}
                        {role.startYear > 2025 && (
                          <Badge variant="secondary" className="ml-2 text-xs">Prévu</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{role.department}</Badge>
                      </TableCell>
                      <TableCell>{role.startYear}</TableCell>
                      <TableCell className="text-right font-mono-numbers">{formatCurrency(role.annualCostLoaded)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(role)}>
                            Modifier
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeRole(role.id)}>
                            Suppr.
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
      </div>

      {/* Dialog d'édition */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Modifier le poste' : 'Nouveau poste'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Titre du poste</label>
              <Input
                value={editForm.title || ''}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Ex: Développeur Full Stack"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Département</label>
              <Select
                value={editForm.department}
                onValueChange={(v) => setEditForm({ ...editForm, department: v as Department })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un département" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Année de début</label>
                <Input
                  type="number"
                  value={editForm.startYear || 2026}
                  onChange={(e) => setEditForm({ ...editForm, startYear: Number(e.target.value) })}
                  min={2025}
                  max={2030}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Coût annuel chargé (€)</label>
                <Input
                  type="number"
                  value={editForm.annualCostLoaded || 50000}
                  onChange={(e) => setEditForm({ ...editForm, annualCostLoaded: Number(e.target.value) })}
                  step={1000}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveRole}>Sauvegarder</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </ReadOnlyWrapper>
  );
}
