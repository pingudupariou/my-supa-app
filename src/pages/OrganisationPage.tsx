import { useRef, useState } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { Role, Department } from '@/engine/types';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { TabSaveAs, useSaveWithTabVersion } from '@/components/ui/TabSaveAs';
import { OrgChart } from '@/components/organisation/OrgChart';
import { RolePhoto, fileToAvatarDataUrl } from '@/components/organisation/RolePhoto';
import { HiringSimulator } from '@/components/organisation/HiringSimulator';
import { PageExportPDF, ExportableSection } from '@/components/export/PageExportPDF';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Users, Grid3x3, List, FlaskConical, Camera, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/data/financialConfig';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const DEPARTMENTS: Department[] = ['R&D', 'Production', 'Sales', 'Support', 'Admin'];

const EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'kpis', label: 'KPIs RH', elementId: 'org-kpis' },
  { id: 'payroll-chart', label: 'Évolution Masse Salariale', elementId: 'org-payroll-chart' },
  { id: 'hiring-plan', label: 'Plan de Recrutement', elementId: 'org-hiring-plan' },
  { id: 'team', label: 'Équipe / Organigramme', elementId: 'org-team' },
];

export function OrganisationPage() {
  const saveWithVersion = useSaveWithTabVersion('organisation');
  const { state, computed, updateRoles, addRole, removeRole, saveAll } = useFinancial();
  const [viewMode, setViewMode] = useState<'orgchart' | 'table'>('orgchart');
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Role>>({});
  const { startYear, durationYears } = state.scenarioSettings;
  const YEARS = Array.from({ length: durationYears }, (_, i) => startYear + i);
  const lastYear = startYear + durationYears - 1;

  const handleAddRole = (department?: Department) => {
    const newRole: Role = {
      id: `role-${Date.now()}`,
      title: 'Nouveau Poste',
      department: department || 'R&D',
      startYear: startYear + 1,
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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoLoading(true);
    try {
      const photo = await fileToAvatarDataUrl(file);
      setEditForm(prev => ({ ...prev, photo }));
    } catch (err) {
      toast({ title: 'Photo non ajoutée', description: err instanceof Error ? err.message : 'Image illisible.', variant: 'destructive' });
    } finally {
      setPhotoLoading(false);
    }
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

  const payrollChartData = computed.payrollByYear.map(p => ({
    year: p.year,
    payroll: p.payroll / 1000,
    headcount: p.headcount,
  }));

  const futureHires = state.roles.filter(r => r.startYear > startYear);
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

      <Tabs defaultValue="organisation" className="w-full">
        <div className="flex justify-between items-center">
          <TabsList>
            <TabsTrigger value="organisation">
              <Users className="h-4 w-4 mr-1" />
              Organisation
            </TabsTrigger>
            <TabsTrigger value="simulation">
              <FlaskConical className="h-4 w-4 mr-1" />
              Simulation
            </TabsTrigger>
          </TabsList>

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
            <TabSaveAs tabKey="organisation" label="Organisation" />
            <SaveButton
              onSave={saveWithVersion}
              hasUnsavedChanges={state.hasUnsavedChanges}
              lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
            />
          </div>
        </div>

        {/* ====== ONGLET ORGANISATION ====== */}
        <TabsContent value="organisation" className="space-y-6 mt-4">
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

          {/* KPIs */}
          <div id="org-kpis" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard label={`Masse Salariale ${startYear}`} value={formatCurrency(computed.currentPayroll, true)} subValue={`${computed.totalHeadcount} personnes`} />
            <KPICard label="Recrutements Prévus" value={futureHires.length.toString()} subValue={`${startYear + 1}-${lastYear}`} />
            <KPICard label="Coût Moyen / ETP" value={formatCurrency(computed.currentPayroll / (computed.totalHeadcount || 1), true)} subValue="Chargé" />
            <KPICard label={`Masse Salariale ${lastYear}`} value={formatCurrency(computed.payrollByYear.find(p => p.year === lastYear)?.payroll || 0, true)} subValue="Projection" trend="up" />
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
                    <Tooltip formatter={(value: number, name: string) => name === 'payroll' ? `${value.toFixed(0)}k€` : value} />
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

          {/* Vue conditionnelle */}
          <div id="org-team">
            {viewMode === 'orgchart' ? (
              <SectionCard title="Organigramme">
                <OrgChart roles={state.roles} startYear={startYear} onEdit={handleEdit} onRemove={removeRole} onAddToTeam={handleAddRole} />
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
                        <TableRow key={role.id} className={role.startYear > startYear ? 'bg-muted/20' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <RolePhoto photo={role.photo} name={role.personName || role.title} className="h-8 w-8" />
                              <div>
                                <div>
                                  {role.title}
                                  {role.startYear > startYear && <Badge variant="secondary" className="ml-2 text-xs">Prévu</Badge>}
                                </div>
                                {role.personName && <div className="text-xs text-muted-foreground font-normal">{role.personName}</div>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{role.department}</Badge></TableCell>
                          <TableCell>{role.startYear}</TableCell>
                          <TableCell className="text-right font-mono-numbers">{formatCurrency(role.annualCostLoaded)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(role)}>Modifier</Button>
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeRole(role.id)}>Suppr.</Button>
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
        </TabsContent>

        {/* ====== ONGLET SIMULATION ====== */}
        <TabsContent value="simulation" className="mt-4">
          <HiringSimulator />
        </TabsContent>
      </Tabs>

      {/* Dialog d'édition */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Modifier le poste' : 'Nouveau poste'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <RolePhoto photo={editForm.photo} name={editForm.personName || editForm.title} className="h-20 w-20" />
              <div className="space-y-2">
                <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => photoInputRef.current?.click()} disabled={photoLoading}>
                    {photoLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
                    {editForm.photo ? 'Changer la photo' : 'Ajouter une photo'}
                  </Button>
                  {editForm.photo && (
                    <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setEditForm({ ...editForm, photo: undefined })}>
                      <X className="h-4 w-4 mr-1" />Retirer
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Recadrée automatiquement en carré. Pensez à sauvegarder l'onglet.</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nom de la personne <span className="text-muted-foreground font-normal">(facultatif)</span></label>
              <Input
                value={editForm.personName || ''}
                onChange={(e) => setEditForm({ ...editForm, personName: e.target.value })}
                placeholder="Ex: Marie Dupont — vide si poste à recruter"
              />
            </div>
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
              <Select value={editForm.department} onValueChange={(v) => setEditForm({ ...editForm, department: v as Department })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un département" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => (<SelectItem key={dept} value={dept}>{dept}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Année de début</label>
                <Input type="number" value={editForm.startYear || startYear + 1} onChange={(e) => setEditForm({ ...editForm, startYear: Number(e.target.value) })} min={startYear - 5} max={lastYear} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Coût annuel chargé (€)</label>
                <Input type="number" value={editForm.annualCostLoaded || 50000} onChange={(e) => setEditForm({ ...editForm, annualCostLoaded: Number(e.target.value) })} step={1000} />
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
