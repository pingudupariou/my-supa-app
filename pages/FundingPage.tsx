import { useFinancial } from '@/context/FinancialContext';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { Quarter } from '@/engine/types';
import { QUARTERS } from '@/engine/treasuryEngine';
import { FundsAllocationDisplay } from '@/components/funding/FundsAllocationDisplay';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { AlertTriangle, Calendar } from 'lucide-react';

export function FundingPage() {
  const { state, computed, updateFundingRounds, updateScenarioSettings } = useFinancial();
  const fundingDisabled = state.excludeFundingFromTreasury;

  // Générer les années depuis les paramètres de scénario
  const { startYear, durationYears, initialCash } = state.scenarioSettings;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  // Une seule levée (la première/unique)
  const currentRound = state.fundingRounds[0] || {
    id: 'round-1',
    name: 'Levée',
    amount: 1500000,
    preMoneyValuation: 4000000,
    year: startYear,
    quarter: 'Q1' as Quarter,
  };

  // Projection unifiée depuis le moteur
  const { treasuryProjection } = computed;
  
  // Calculs dérivés
  const totalRaise = currentRound.amount;
  const preMoneyValuation = currentRound.preMoneyValuation;
  const postMoneyValuation = preMoneyValuation + totalRaise;
  const dilution = totalRaise / postMoneyValuation;
  const calculatedNeed = treasuryProjection.fundingNeed;
  const coverageRatio = calculatedNeed > 0 ? totalRaise / calculatedNeed : 1;

  // Data pour les graphiques (depuis la projection unifiée)
  const treasuryData = treasuryProjection.years.map(yp => ({
    year: yp.year,
    revenue: yp.revenue / 1000,
    costs: yp.totalCosts / 1000,
    cashFlow: yp.cashFlow / 1000,
    treasury: yp.treasuryEnd / 1000,
    isNegative: yp.treasuryEnd < 0,
  }));

  // Handlers
  const handleAmountChange = (value: number) => {
    updateFundingRounds([{ ...currentRound, amount: value }]);
  };

  const handleValuationChange = (value: number) => {
    updateFundingRounds([{ ...currentRound, preMoneyValuation: value }]);
  };

  const handleYearChange = (value: string) => {
    updateFundingRounds([{ ...currentRound, year: parseInt(value) }]);
  };

  const handleQuarterChange = (value: Quarter) => {
    updateFundingRounds([{ ...currentRound, quarter: value }]);
  };

  const handleInitialCashChange = (value: number) => {
    updateScenarioSettings({ initialCash: value });
  };

  // Alertes
  const hasNegativeTreasury = treasuryProjection.minTreasury < 0;
  const minTreasuryYear = treasuryProjection.years.find(y => y.minTreasuryInYear === treasuryProjection.minTreasury)?.year;

  return (
    <ReadOnlyWrapper tabKey="funding">
    <div className="space-y-6">
      <HeroBanner
        image="rd"
        title="Besoin de Financement"
        subtitle="Calculé automatiquement • Autosave activé"
        height="sm"
      />

      {fundingDisabled && (
        <div className="p-3 bg-muted/50 border border-border rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <div>
            <span className="font-medium text-muted-foreground">Levée désactivée</span>
            <span className="text-sm text-muted-foreground ml-2">
              Activez la levée dans l'onglet Scénarios pour modifier le calibrage.
            </span>
          </div>
        </div>
      )}

      {hasNegativeTreasury && !fundingDisabled && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <div>
            <span className="font-medium text-destructive">Alerte Trésorerie</span>
            <span className="text-sm text-muted-foreground ml-2">
              Point bas de {formatCurrency(treasuryProjection.minTreasury, true)} en {minTreasuryYear}
            </span>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard
          label="Besoin Calculé"
          value={formatCurrency(calculatedNeed, true)}
          subValue="max(0, -tréso min)"
          trend={calculatedNeed > 0 ? 'down' : undefined}
        />
        <KPICard
          label="Montant à Lever"
          value={fundingDisabled ? '-' : formatCurrency(totalRaise, true)}
          subValue={fundingDisabled ? 'Désactivé' : 'Ajustable ci-dessous'}
        />
        <KPICard
          label="Pre-Money"
          value={fundingDisabled ? '-' : formatCurrency(preMoneyValuation, true)}
          subValue="Valorisation"
        />
        <KPICard
          label="Post-Money"
          value={fundingDisabled ? '-' : formatCurrency(postMoneyValuation, true)}
          subValue="Après levée"
        />
        <KPICard
          label="Dilution"
          value={fundingDisabled ? '-' : formatPercent(dilution)}
          subValue="Sur le round"
        />
      </div>

      {/* Calibrage */}
      <SectionCard title="Calibrage de la Levée">
        <div className={cn("grid md:grid-cols-2 gap-6", fundingDisabled && "opacity-40 pointer-events-none select-none")}>
          <div className="space-y-6">
            {/* Trésorerie initiale */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Trésorerie Initiale T0</span>
                <span className="text-lg font-bold font-mono-numbers">{formatCurrency(initialCash, true)}</span>
              </div>
              <Slider
                value={[initialCash / 1000]}
                onValueChange={([v]) => handleInitialCashChange(v * 1000)}
                min={0}
                max={500}
                step={10}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0€</span>
                <span>500k€</span>
              </div>
            </div>

            {/* Montant à lever */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Montant à lever</span>
                <span className="text-lg font-bold font-mono-numbers">{formatCurrency(totalRaise, true)}</span>
              </div>
              <Slider
                value={[totalRaise / 1000]}
                onValueChange={([v]) => handleAmountChange(v * 1000)}
                min={0}
                max={5000}
                step={50}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0€</span>
                <span>5M€</span>
              </div>
              {totalRaise === 0 && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  💡 Montant à lever réglé à 0€ — Les projections de trésorerie n'incluent aucune levée de fonds.
                </p>
              )}
            </div>

            {/* Valorisation Pre-Money */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Valorisation Pre-Money</span>
                <span className="text-lg font-bold font-mono-numbers">{formatCurrency(preMoneyValuation, true)}</span>
              </div>
              <Slider
                value={[preMoneyValuation / 1000]}
                onValueChange={([v]) => handleValuationChange(v * 1000)}
                min={200}
                max={20000}
                step={100}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>200k€</span>
                <span>20M€</span>
              </div>
            </div>

            {/* Timing de la levée */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Année
                </label>
                <Select value={currentRound.year.toString()} onValueChange={handleYearChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Trimestre</label>
                <Select value={currentRound.quarter} onValueChange={handleQuarterChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUARTERS.map(q => (
                      <SelectItem key={q} value={q}>{q}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Indicateurs résultants */}
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Besoin calculé (depuis hypothèses)</span>
                <Badge variant="secondary">Auto</Badge>
              </div>
              <div className="text-3xl font-bold font-mono-numbers">
                {formatCurrency(calculatedNeed, true)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                = max(0, -trésorerie minimale projetée)
              </p>
            </div>

            <div className="p-4 bg-muted/30 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Couverture du besoin</span>
                <span className="font-mono-numbers">{formatPercent(Math.min(coverageRatio, 2))}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
              <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    coverageRatio >= 1 ? "bg-accent" : coverageRatio >= 0.8 ? "bg-primary" : "bg-destructive"
                  )}
                  style={{ width: `${Math.min(coverageRatio * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/30 rounded-lg text-center">
                <div className="text-xs text-muted-foreground mb-1">Break-even</div>
                <div className="text-lg font-bold">
                  {treasuryProjection.breakEvenYear || 'N/A'}
                </div>
              </div>
              <div className="p-3 bg-muted/30 rounded-lg text-center">
                <div className="text-xs text-muted-foreground mb-1">Point bas tréso</div>
                <div className={cn(
                  "text-lg font-bold font-mono-numbers",
                  treasuryProjection.minTreasury < 0 ? "text-destructive" : ""
                )}>
                  {formatCurrency(treasuryProjection.minTreasury, true)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Graphiques */}
      <div className="grid lg:grid-cols-2 gap-6">
        <SectionCard title="Projection Cash Flow & Trésorerie">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={treasuryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${v}k€`} />
                <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                <Legend />
                <Bar dataKey="cashFlow" name="Cash Flow" fill="hsl(var(--accent))" />
                <Line type="monotone" dataKey="treasury" name="Trésorerie" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <FundsAllocationDisplay />
      </div>

      {/* Tableau détaillé */}
      <SectionCard title="Projection Détaillée">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-3">Année</th>
                <th className="text-right py-2 px-3">CA</th>
                <th className="text-right py-2 px-3">Coûts Totaux</th>
                <th className="text-right py-2 px-3">Cash Flow</th>
                <th className="text-right py-2 px-3">Levée</th>
                <th className="text-right py-2 px-3">Tréso Début</th>
                <th className="text-right py-2 px-3">Tréso Fin</th>
              </tr>
            </thead>
            <tbody>
              {treasuryProjection.years.map((yp) => (
                <tr key={yp.year} className={cn(
                  "border-b",
                  yp.treasuryEnd < 0 && "bg-destructive/5"
                )}>
                  <td className="py-2 px-3 font-medium">{yp.year}</td>
                  <td className="py-2 px-3 text-right font-mono-numbers">
                    {formatCurrency(yp.revenue, true)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-numbers text-muted-foreground">
                    {formatCurrency(yp.totalCosts, true)}
                  </td>
                  <td className={cn(
                    "py-2 px-3 text-right font-mono-numbers font-medium",
                    yp.cashFlow >= 0 ? "text-accent" : "text-destructive"
                  )}>
                    {yp.cashFlow >= 0 ? '+' : ''}{formatCurrency(yp.cashFlow, true)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-numbers text-accent">
                    {yp.fundingInjection > 0 ? `+${formatCurrency(yp.fundingInjection, true)}` : '-'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono-numbers">
                    {formatCurrency(yp.treasuryStart, true)}
                  </td>
                  <td className={cn(
                    "py-2 px-3 text-right font-mono-numbers font-bold",
                    yp.treasuryEnd < 0 ? "text-destructive" : ""
                  )}>
                    {formatCurrency(yp.treasuryEnd, true)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
    </ReadOnlyWrapper>
  );
}
