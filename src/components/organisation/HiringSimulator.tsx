import { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { Role } from '@/engine/types';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, CheckCircle } from 'lucide-react';

export function HiringSimulator() {
  const { state, computed } = useFinancial();
  const { startYear, durationYears } = state.scenarioSettings;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  const [selectedRoleId, setSelectedRoleId] = useState<string>(state.roles[0]?.id || '');
  const [salaryOverride, setSalaryOverride] = useState<number | null>(null);

  const selectedRole = state.roles.find(r => r.id === selectedRoleId);

  // When role changes, reset salary override
  const handleRoleChange = (id: string) => {
    setSelectedRoleId(id);
    setSalaryOverride(null);
  };

  const simSalary = salaryOverride ?? (selectedRole?.annualCostLoaded || 50000);

  // ========== LOCAL SIMULATION ==========
  // Take external data from computed (revenue, opex, capex) as-is
  // Recompute payroll locally with salary override for the selected role
  const simulation = useMemo(() => {
    if (!selectedRole) return null;

    const baseData = years.map((year, i) => {
      const rev = computed.revenueByYear[i]?.revenue || 0;
      const cogs = computed.revenueByYear[i]?.cogs || 0;
      const opex = computed.opexByYear[i]?.opex || 0;
      const capex = computed.capexByYear[i]?.capex || 0;
      const depreciation = computed.capexByYear[i]?.depreciation || 0;

      // Base payroll (unchanged)
      const basePayroll = computed.payrollByYear[i]?.payroll || 0;

      // Simulated payroll: replace the selected role's cost
      const roleActive = selectedRole.startYear <= year;
      const delta = roleActive ? (simSalary - selectedRole.annualCostLoaded) : 0;
      const simPayroll = basePayroll + delta;

      const grossMargin = rev - cogs;
      const grossMarginRate = rev > 0 ? grossMargin / rev : 0;

      const baseEbitda = grossMargin - basePayroll - opex;
      const simEbitda = grossMargin - simPayroll - opex;

      const baseOpResult = baseEbitda - depreciation;
      const simOpResult = simEbitda - depreciation;

      const baseEbitdaMargin = rev > 0 ? baseEbitda / rev : 0;
      const simEbitdaMargin = rev > 0 ? simEbitda / rev : 0;

      return {
        year,
        revenue: rev,
        grossMargin,
        grossMarginRate,
        basePayroll,
        simPayroll,
        opex,
        capex,
        baseEbitda,
        simEbitda,
        baseOpResult,
        simOpResult,
        baseEbitdaMargin,
        simEbitdaMargin,
        delta,
        depreciation,
      };
    });

    // Cash flow projection
    let baseCash = state.scenarioSettings.initialCash;
    let simCash = state.scenarioSettings.initialCash;
    const withCash = baseData.map(d => {
      // Add funding rounds
      const fundingThisYear = state.fundingRounds
        .filter(r => r.year === d.year)
        .reduce((s, r) => s + r.amount, 0);
      baseCash += fundingThisYear + d.baseEbitda * 0.7;
      simCash += fundingThisYear + d.simEbitda * 0.7;
      return {
        ...d,
        baseCash,
        simCash,
        cashDelta: simCash - baseCash,
      };
    });

    // Summary KPIs
    const totalDeltaCost = withCash.reduce((s, d) => s + d.delta, 0);
    const baseBreakEven = withCash.find(d => d.baseEbitda > 0)?.year || null;
    const simBreakEven = withCash.find(d => d.simEbitda > 0)?.year || null;
    const endCashDelta = withCash[withCash.length - 1]?.cashDelta || 0;
    const minSimCash = Math.min(...withCash.map(d => d.simCash));

    return {
      data: withCash,
      totalDeltaCost,
      baseBreakEven,
      simBreakEven,
      endCashDelta,
      minSimCash,
    };
  }, [selectedRole, simSalary, computed, years, state.scenarioSettings, state.fundingRounds]);

  if (state.roles.length === 0) {
    return (
      <SectionCard title="Simulation d'embauche">
        <p className="text-muted-foreground text-center py-8">
          Aucun poste défini. Ajoutez des postes dans l'onglet Organisation.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <SectionCard title="Paramètres de simulation">
        <div className="grid md:grid-cols-2 gap-8">
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

          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">
                Salaire annuel brut chargé simulé : <span className="text-primary font-mono-numbers">{formatCurrency(simSalary)}</span>
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

            {selectedRole && (
              <div className="p-4 rounded-lg border border-border bg-muted/20">
                <div className="text-sm text-muted-foreground mb-1">Écart vs. plan</div>
                <div className={`text-2xl font-bold font-mono-numbers ${simSalary > selectedRole.annualCostLoaded ? 'text-destructive' : simSalary < selectedRole.annualCostLoaded ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {simSalary >= selectedRole.annualCostLoaded ? '+' : ''}{formatCurrency(simSalary - selectedRole.annualCostLoaded)}
                  <span className="text-sm font-normal text-muted-foreground ml-1">/ an</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {simulation && (
        <>
          {/* Impact KPIs */}
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

          {/* EBITDA Comparison Chart */}
          <SectionCard title="Impact sur l'EBITDA">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={simulation.data} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value, true), name]}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                  <Bar dataKey="baseEbitda" name="EBITDA Plan" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
                  <Bar dataKey="simEbitda" name="EBITDA Simulé" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Cash Position Chart */}
          <SectionCard title="Impact sur la Trésorerie">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulation.data}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value, true), name]}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                  />
                  <Legend />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="baseCash" name="Cash Plan" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                  <Line type="monotone" dataKey="simCash" name="Cash Simulé" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Detailed P&L Table */}
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
