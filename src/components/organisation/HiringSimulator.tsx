import { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { MONTHS } from '@/engine/monthlyTreasuryEngine';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

// Revenue mode label map
const REVENUE_MODE_LABELS: Record<string, string> = {
  'by-product': 'Par Produit',
  'by-channel-global': 'Global Canaux',
  'by-client': 'Par Client',
};

type VariableBasis = 'ca' | 'marge_brute';
type DisplayMode = 'annual_loaded' | 'monthly_loaded' | 'monthly_net';

interface VariableComp {
  enabled: boolean;
  name: string;
  basis: VariableBasis;
  percentOfBasis: number; // % of CA or gross margin
}

export function HiringSimulator() {
  const { state, computed } = useFinancial();
  const { startYear, durationYears } = state.scenarioSettings;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  const [selectedRoleId, setSelectedRoleId] = useState<string>(state.roles[0]?.id || '');
  const [salaryOverride, setSalaryOverride] = useState<number | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('annual_loaded');

  // Coefficients for conversion
  const [coefCharges, setCoefCharges] = useState(1.45); // brut -> chargé
  const [coefNet, setCoefNet] = useState(0.78); // brut -> net

  // Variable compensation
  const [variableComp, setVariableComp] = useState<VariableComp>({
    enabled: false,
    name: 'PER',
    basis: 'ca',
    percentOfBasis: 2,
  });

  const selectedRole = state.roles.find(r => r.id === selectedRoleId);

  const handleRoleChange = (id: string) => {
    setSelectedRoleId(id);
    setSalaryOverride(null);
  };

  const simSalary = salaryOverride ?? (selectedRole?.annualCostLoaded || 50000);

  // Conversion helpers
  const annualLoaded = simSalary;
  const annualBrut = annualLoaded / coefCharges;
  const monthlyLoaded = annualLoaded / 12;
  const monthlyBrut = annualBrut / 12;
  const monthlyNet = monthlyBrut * coefNet;
  const annualNet = monthlyNet * 12;

  // Variable comp: indexed on current year CA or gross margin
  // We use year 0 (current/first year) as reference for the summary display
  const currentYearRev = computed.revenueByYear[0]?.revenue || 0;
  const currentYearCogs = computed.revenueByYear[0]?.cogs || 0;
  const currentYearGM = currentYearRev - currentYearCogs;
  const variableBasisValue = variableComp.basis === 'ca' ? currentYearRev : currentYearGM;
  const variableAnnualLoaded = variableComp.enabled ? variableBasisValue * (variableComp.percentOfBasis / 100) : 0;
  const variableAnnualBrut = variableAnnualLoaded / coefCharges;
  const variableAnnualNet = variableAnnualBrut * coefNet;
  const variableMonthlyBrut = variableAnnualBrut / 12;
  const variableMonthlyLoaded = variableAnnualLoaded / 12;
  const variableMonthlyNet = variableAnnualNet / 12;

  // Total (fixe + variable)
  const totalAnnualLoaded = annualLoaded + variableAnnualLoaded;
  const totalAnnualBrut = annualBrut + variableAnnualBrut;
  const totalAnnualNet = annualNet + variableAnnualNet;
  const totalMonthlyLoaded = totalAnnualLoaded / 12;
  const totalMonthlyBrut = totalAnnualBrut / 12;
  const totalMonthlyNet = totalAnnualNet / 12;

  // Display value based on mode
  const displayValue = displayMode === 'annual_loaded' ? annualLoaded
    : displayMode === 'monthly_loaded' ? monthlyLoaded
    : monthlyNet;
  const displayLabel = displayMode === 'annual_loaded' ? 'Annuel brut chargé'
    : displayMode === 'monthly_loaded' ? 'Mensuel brut chargé'
    : 'Mensuel net';

  // ========== LOCAL SIMULATION ==========
  const simulation = useMemo(() => {
    if (!selectedRole) return null;

    const baseData = years.map((year, i) => {
      const rev = computed.revenueByYear[i]?.revenue || 0;
      const cogs = computed.revenueByYear[i]?.cogs || 0;
      const opex = computed.opexByYear[i]?.opex || 0;
      const depreciation = computed.capexByYear[i]?.depreciation || 0;
      const basePayroll = computed.payrollByYear[i]?.payroll || 0;
      const grossMargin = rev - cogs;

      const roleActive = selectedRole.startYear <= year;
      const fixedDelta = roleActive ? (simSalary - selectedRole.annualCostLoaded) : 0;

      let variableCost = 0;
      if (variableComp.enabled && roleActive) {
        const basis = variableComp.basis === 'ca' ? rev : grossMargin;
        variableCost = basis * (variableComp.percentOfBasis / 100);
      }

      const totalDelta = fixedDelta + variableCost;
      const simPayroll = basePayroll + totalDelta;

      const grossMarginRate = rev > 0 ? grossMargin / rev : 0;
      const baseEbitda = grossMargin - basePayroll - opex;
      const simEbitda = grossMargin - simPayroll - opex;
      const baseOpResult = baseEbitda - depreciation;
      const simOpResult = simEbitda - depreciation;
      const baseEbitdaMargin = rev > 0 ? baseEbitda / rev : 0;
      const simEbitdaMargin = rev > 0 ? simEbitda / rev : 0;

      return {
        year, revenue: rev, grossMargin, grossMarginRate,
        basePayroll, simPayroll, opex,
        baseEbitda, simEbitda, baseOpResult, simOpResult,
        baseEbitdaMargin, simEbitdaMargin,
        delta: totalDelta, fixedDelta, variableCost, depreciation,
      };
    });

    let baseCash = state.scenarioSettings.initialCash;
    let simCash = state.scenarioSettings.initialCash;
    const withCash = baseData.map(d => {
      const funding = state.fundingRounds.filter(r => r.year === d.year).reduce((s, r) => s + r.amount, 0);
      baseCash += funding + d.baseEbitda * 0.7;
      simCash += funding + d.simEbitda * 0.7;
      return { ...d, baseCash, simCash, cashDelta: simCash - baseCash };
    });

    // Monthly treasury simulation
    const baseMonthly = computed.monthlyTreasuryProjection.months;
    const monthlyData = baseMonthly.map(m => {
      const roleActive = selectedRole.startYear <= m.year;
      const annualDelta = roleActive ? (simSalary - selectedRole.annualCostLoaded) : 0;
      let monthlyVariable = 0;
      if (variableComp.enabled && roleActive) {
        const yearIndex = years.indexOf(m.year);
        const yearRev = computed.revenueByYear[yearIndex]?.revenue || 0;
        const yearCogs = computed.revenueByYear[yearIndex]?.cogs || 0;
        const yearGM = yearRev - yearCogs;
        const basis = variableComp.basis === 'ca' ? yearRev : yearGM;
        monthlyVariable = (basis * (variableComp.percentOfBasis / 100)) / 12;
      }
      const monthlyDelta = (annualDelta / 12) + monthlyVariable;
      return {
        monthKey: `${MONTHS[m.month].slice(0, 3)} ${m.year}`,
        year: m.year,
        month: m.month,
        baseTreasury: m.treasuryEnd,
        basePayroll: m.payroll,
        baseCashFlow: m.netCashFlow,
        monthlyDelta,
      };
    });

    // Recalculate cumulative sim treasury
    let cumDelta = 0;
    const monthlyWithSim = monthlyData.map(m => {
      cumDelta += m.monthlyDelta;
      return {
        ...m,
        simTreasury: m.baseTreasury - cumDelta,
        simCashFlow: m.baseCashFlow - m.monthlyDelta,
      };
    });

    return {
      data: withCash,
      monthlyData: monthlyWithSim,
      totalDeltaCost: withCash.reduce((s, d) => s + d.delta, 0),
      baseBreakEven: withCash.find(d => d.baseEbitda > 0)?.year || null,
      simBreakEven: withCash.find(d => d.simEbitda > 0)?.year || null,
      endCashDelta: withCash[withCash.length - 1]?.cashDelta || 0,
      minSimCash: Math.min(...monthlyWithSim.map(d => d.simTreasury)),
    };
  }, [selectedRole, simSalary, variableComp, computed, years, state.scenarioSettings, state.fundingRounds]);

  if (state.roles.length === 0) {
    return (
      <SectionCard title="Simulation d'embauche">
        <p className="text-muted-foreground text-center py-8">Aucun poste défini. Ajoutez des postes dans l'onglet Organisation.</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Revenue mode badge */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          Mode CA : {REVENUE_MODE_LABELS[state.revenueMode] || state.revenueMode}
        </Badge>
        <Badge variant="outline" className="text-xs">
          Scénario : {state.activeScenarioId}
        </Badge>
      </div>

      {/* Controls */}
      <SectionCard title="Paramètres de simulation">
        <div className="grid md:grid-cols-2 gap-8">
          {/* LEFT: Role selection + info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Poste à simuler</Label>
              <Select value={selectedRoleId} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un poste" />
                </SelectTrigger>
                <SelectContent>
                  {state.roles.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="flex items-center gap-2">
                        {r.title}
                        <Badge variant="outline" className="text-[10px]">{r.department}</Badge>
                        <span className="text-muted-foreground text-xs">— {r.startYear}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRole && (
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Département</span>
                  <Badge>{selectedRole.department}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Année de début</span>
                  <span className="font-mono-numbers font-medium">{selectedRole.startYear}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Coût actuel (plan)</span>
                  <span className="font-mono-numbers font-medium">{formatCurrency(selectedRole.annualCostLoaded)}</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Salary slider + display mode + coefficients */}
          <div className="space-y-4">
            {/* Display mode toggle */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Affichage</Label>
              <ToggleGroup type="single" value={displayMode} onValueChange={(v) => v && setDisplayMode(v as DisplayMode)} className="justify-start">
                <ToggleGroupItem value="annual_loaded" className="text-xs">Annuel chargé</ToggleGroupItem>
                <ToggleGroupItem value="monthly_loaded" className="text-xs">Mensuel chargé</ToggleGroupItem>
                <ToggleGroupItem value="monthly_net" className="text-xs">Mensuel net</ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Salary slider */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                {displayLabel} : <span className="text-primary font-mono-numbers">{formatCurrency(displayValue)}</span>
              </Label>
              <Slider
                value={[simSalary]}
                onValueChange={([v]) => setSalaryOverride(v)}
                min={20000}
                max={200000}
                step={1000}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>20k€</span>
                <span>200k€</span>
              </div>
            </div>

            {/* Conversion coefficients */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Coef. charges (brut→chargé)</Label>
                <Input
                  type="number"
                  value={coefCharges}
                  onChange={(e) => setCoefCharges(Number(e.target.value) || 1)}
                  step={0.01}
                  min={1}
                  max={2}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Coef. net (brut→net)</Label>
                <Input
                  type="number"
                  value={coefNet}
                  onChange={(e) => setCoefNet(Number(e.target.value) || 0.78)}
                  step={0.01}
                  min={0.5}
                  max={1}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            {/* Conversion summary */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Annuel chargé</div>
                <div className="text-sm font-bold font-mono-numbers text-primary">{formatCurrency(annualLoaded, true)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-accent/50 border border-border text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Mensuel brut</div>
                <div className="text-sm font-bold font-mono-numbers">{formatCurrency(monthlyBrut)}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Mensuel net</div>
                <div className="text-sm font-bold font-mono-numbers text-emerald-700 dark:text-emerald-400">{formatCurrency(monthlyNet)}</div>
              </div>
            </div>

            {selectedRole && (
              <div className="p-3 rounded-lg border border-border bg-muted/20">
                <div className="text-sm text-muted-foreground mb-1">Écart vs. plan</div>
                <div className={`text-xl font-bold font-mono-numbers ${simSalary > selectedRole.annualCostLoaded ? 'text-destructive' : simSalary < selectedRole.annualCostLoaded ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {simSalary >= selectedRole.annualCostLoaded ? '+' : ''}{formatCurrency(simSalary - selectedRole.annualCostLoaded)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ an</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Variable Compensation */}
      <SectionCard title="Rémunération variable">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Activer une part variable</Label>
              <p className="text-xs text-muted-foreground">Bonus indexé sur le CA ou la marge brute</p>
            </div>
            <Switch checked={variableComp.enabled} onCheckedChange={(v) => setVariableComp(prev => ({ ...prev, enabled: v }))} />
          </div>

          {variableComp.enabled && (
            <>
              <div className="grid md:grid-cols-3 gap-4 p-4 rounded-lg border border-border bg-muted/10">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Nom du dispositif</Label>
                  <Input
                    value={variableComp.name}
                    onChange={(e) => setVariableComp(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="ex: PER, Bonus, Commission"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Indexé sur</Label>
                  <ToggleGroup
                    type="single"
                    value={variableComp.basis}
                    onValueChange={(v) => v && setVariableComp(prev => ({ ...prev, basis: v as VariableBasis }))}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="ca" className="text-xs">Chiffre d'affaires</ToggleGroupItem>
                    <ToggleGroupItem value="marge_brute" className="text-xs">Marge brute</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">
                    % {variableComp.basis === 'ca' ? 'du CA' : 'de la marge brute'} : <span className="font-mono-numbers text-primary">{variableComp.percentOfBasis}%</span>
                  </Label>
                  <Slider
                    value={[variableComp.percentOfBasis]}
                    onValueChange={([v]) => setVariableComp(prev => ({ ...prev, percentOfBasis: v }))}
                    min={0}
                    max={20}
                    step={0.5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>20%</span>
                  </div>
                </div>
              </div>

              {/* Variable breakdown */}
              <div className="p-4 rounded-lg border border-border bg-muted/10 space-y-3">
                <div className="text-sm font-medium">{variableComp.name} — Décomposition</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Brut chargé / an</div>
                    <div className="text-sm font-bold font-mono-numbers text-primary">{formatCurrency(variableAnnualLoaded, true)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-accent/50 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Brut / mois</div>
                    <div className="text-sm font-bold font-mono-numbers">{formatCurrency(variableMonthlyBrut)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/50 border border-border text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Net / mois</div>
                    <div className="text-sm font-bold font-mono-numbers">{formatCurrency(variableMonthlyNet)}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* Total salary recap (fixe + variable) */}
      {variableComp.enabled && (
        <SectionCard title="Récapitulatif rémunération totale (fixe + variable)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 text-muted-foreground font-medium"></th>
                  <th className="text-right p-2 text-muted-foreground font-medium">Annuel chargé</th>
                  <th className="text-right p-2 text-muted-foreground font-medium">Mensuel brut</th>
                  <th className="text-right p-2 text-muted-foreground font-medium">Mensuel net</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="p-2 font-medium">Fixe</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(annualLoaded)}</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(monthlyBrut)}</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(monthlyNet)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="p-2 font-medium">{variableComp.name}</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(variableAnnualLoaded)}</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(variableMonthlyBrut)}</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(variableMonthlyNet)}</td>
                </tr>
                <tr className="bg-primary/5 font-bold">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-right font-mono-numbers text-primary">{formatCurrency(totalAnnualLoaded)}</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(totalMonthlyBrut)}</td>
                  <td className="p-2 text-right font-mono-numbers">{formatCurrency(totalMonthlyNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {simulation && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Impact cumulé sur la période"
              value={formatCurrency(simulation.totalDeltaCost, true)}
              subValue={`${years[0]}-${years[years.length - 1]}`}
            />
            <KPICard
              label="Impact Cash fin de période"
              value={formatCurrency(simulation.endCashDelta, true)}
              subValue={simulation.endCashDelta >= 0 ? 'Favorable' : 'Défavorable'}
              trend={simulation.endCashDelta >= 0 ? 'up' : 'down'}
            />
            <KPICard
              label="Break-even simulé"
              value={simulation.simBreakEven ? simulation.simBreakEven.toString() : 'N/A'}
              subValue={simulation.baseBreakEven ? `Plan: ${simulation.baseBreakEven}` : 'Plan: N/A'}
            />
            <KPICard
              label="Cash minimum"
              value={formatCurrency(simulation.minSimCash, true)}
              subValue={simulation.minSimCash < 0 ? '⚠️ Trésorerie négative' : 'OK'}
            />
          </div>

          {/* EBITDA Chart */}
          <SectionCard title="Impact sur l'EBITDA">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simulation.data} barGap={4}>
                  <defs>
                    <linearGradient id="gradPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="gradSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="hsl(210, 100%, 70%)" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="gradSimNeg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value, true), name]}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />
                  <Bar dataKey="baseEbitda" name="EBITDA Plan" fill="url(#gradPlan)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="simEbitda" name="EBITDA Simulé" fill="url(#gradSim)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Cash Position Chart */}
          <SectionCard title="Impact sur la Trésorerie">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulation.data}>
                  <defs>
                    <linearGradient id="gradCashPlan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCashSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
                  <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value, true), name]}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))' }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.6} />
                  <Area type="monotone" dataKey="baseCash" name="Cash Plan" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" fill="url(#gradCashPlan)" dot={false} />
                  <Area type="monotone" dataKey="simCash" name="Cash Simulé" stroke="hsl(160, 70%, 45%)" strokeWidth={2.5} fill="url(#gradCashSim)" dot={{ r: 4, fill: 'hsl(160, 70%, 45%)', strokeWidth: 2, stroke: 'hsl(var(--background))' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Monthly Treasury Projection */}
          <SectionCard title="Prévisionnel de Trésorerie Mensuel (impact simulation)">
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={simulation.monthlyData}>
                  <defs>
                    <linearGradient id="gradMonthlyBase" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.12} />
                      <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradMonthlySim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(210, 100%, 55%)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradCfBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="hsl(160, 70%, 45%)" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-15" />
                  <XAxis
                    dataKey="monthKey"
                    tick={{ fontSize: 9 }}
                    interval={2}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    yAxisId="treasury"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="cashflow"
                    orientation="right"
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value, true), name]}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', fontSize: 12 }}
                    labelStyle={{ fontSize: 11, fontWeight: 600 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine yAxisId="treasury" y={0} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Area yAxisId="treasury" type="monotone" dataKey="baseTreasury" name="Trésorerie Plan" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 4" fill="url(#gradMonthlyBase)" dot={false} />
                  <Area yAxisId="treasury" type="monotone" dataKey="simTreasury" name="Trésorerie Simulée" stroke="hsl(210, 100%, 55%)" strokeWidth={2} fill="url(#gradMonthlySim)" dot={false} />
                  <Bar yAxisId="cashflow" dataKey="simCashFlow" name="Cash Flow Simulé" fill="url(#gradCfBar)" radius={[2, 2, 0, 0]} opacity={0.6} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
          <SectionCard title="Synthèse P&L Simulé">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Indicateur</th>
                    {simulation.data.map(d => (
                      <th key={d.year} className="text-right py-3 px-2 font-medium">{d.year}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  <tr className="bg-muted/10">
                    <td className="py-2.5 px-2 font-medium">Chiffre d'affaires</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className="text-right py-2.5 px-2 font-mono-numbers">{formatCurrency(d.revenue, true)}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2">Marge brute</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className="text-right py-2.5 px-2 font-mono-numbers">
                        {formatCurrency(d.grossMargin, true)}
                        <span className="text-xs text-muted-foreground ml-1">({formatPercent(d.grossMarginRate)})</span>
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="py-2.5 px-2">Masse salariale (plan)</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className="text-right py-2.5 px-2 font-mono-numbers text-muted-foreground">{formatCurrency(d.basePayroll, true)}</td>
                    ))}
                  </tr>
                  <tr className="font-medium">
                    <td className="py-2.5 px-2 text-primary">Masse salariale (simulée)</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className="text-right py-2.5 px-2 font-mono-numbers text-primary">
                        {formatCurrency(d.simPayroll, true)}
                        {d.delta !== 0 && (
                          <span className={`text-xs ml-1 ${d.delta > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                            ({d.delta > 0 ? '+' : ''}{formatCurrency(d.delta, true)})
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {variableComp.enabled && (
                    <tr className="bg-amber-500/5">
                      <td className="py-2.5 px-2 text-amber-700 dark:text-amber-400">
                        └ dont {variableComp.name}
                      </td>
                      {simulation.data.map(d => (
                        <td key={d.year} className="text-right py-2.5 px-2 font-mono-numbers text-amber-700 dark:text-amber-400 text-xs">
                          {formatCurrency(d.variableCost, true)}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr>
                    <td className="py-2.5 px-2">OPEX</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className="text-right py-2.5 px-2 font-mono-numbers">{formatCurrency(d.opex, true)}</td>
                    ))}
                  </tr>
                  <tr className="bg-muted/10 font-semibold">
                    <td className="py-2.5 px-2">EBITDA simulé</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className={`text-right py-2.5 px-2 font-mono-numbers ${d.simEbitda < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(d.simEbitda, true)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">({formatPercent(d.simEbitdaMargin)})</span>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-2.5 px-2">Amortissements</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className="text-right py-2.5 px-2 font-mono-numbers">{formatCurrency(d.depreciation, true)}</td>
                    ))}
                  </tr>
                  <tr className="font-semibold border-t-2 border-border">
                    <td className="py-2.5 px-2">Résultat opérationnel simulé</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className={`text-right py-2.5 px-2 font-mono-numbers ${d.simOpResult < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(d.simOpResult, true)}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-primary/5 font-semibold">
                    <td className="py-2.5 px-2">Trésorerie simulée</td>
                    {simulation.data.map(d => (
                      <td key={d.year} className={`text-right py-2.5 px-2 font-mono-numbers ${d.simCash < 0 ? 'text-destructive' : ''}`}>
                        {formatCurrency(d.simCash, true)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
