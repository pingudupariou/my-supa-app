import { useFinancial } from '@/context/FinancialContext';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { PageExportPDF, ExportableSection } from '@/components/export/PageExportPDF';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { Calendar, Clock, Wallet, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Bar,
} from 'recharts';

const EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'settings', label: 'Paramètres du Scénario', elementId: 'scenario-settings' },
  { id: 'treasury-params', label: 'Paramètres Trésorerie', elementId: 'treasury-params' },
  { id: 'kpis', label: 'KPIs par Scénario', elementId: 'scenario-kpis' },
  { id: 'adjustments', label: 'Ajustements', elementId: 'scenario-adjustments' },
  { id: 'chart', label: 'Comparaison des Scénarios', elementId: 'scenario-chart' },
  { id: 'cashflow', label: 'Projection Cash Flow', elementId: 'scenario-cashflow' },
];

export function ScenariosPage() {
  const { state, computed, setActiveScenario, updateScenarioConfig, updateScenarioSettings, updateFundingRounds, saveAll } = useFinancial();

  const activeConfig = state.scenarioConfigs[state.activeScenarioId];
  const { startYear, durationYears, initialCash } = state.scenarioSettings;
  
  // Récupérer le montant levé depuis le dernier tour de financement
  const latestRound = state.fundingRounds[state.fundingRounds.length - 1];
  const amountRaised = latestRound?.amount || 0;
  
  // Générer les années basées sur les paramètres
  const YEARS = Array.from({ length: durationYears }, (_, i) => startYear + i);

  // Calculate projections for each scenario
  const getScenarioMetrics = (scenarioId: string) => {
    const config = state.scenarioConfigs[scenarioId];
    const revenueByYear = YEARS.map(year => {
      let revenue = 0;
      state.products.forEach(product => {
        if (product.volumesByYear[year]) {
          const volume = Math.round(product.volumesByYear[year] * (1 + config.volumeAdjustment));
          const price = product.priceHT * (1 + config.priceAdjustment);
          revenue += volume * price;
        }
      });
      return revenue;
    });
    
    const lastYearRevenue = revenueByYear[revenueByYear.length - 1] || 0;
    const firstYearRevenue = revenueByYear[0] || 0;
    
    return {
      revenueLastYear: lastYearRevenue,
      totalRevenue: revenueByYear.reduce((a, b) => a + b, 0),
      cagr: lastYearRevenue > 0 && firstYearRevenue > 0 && durationYears > 1
        ? Math.pow(lastYearRevenue / firstYearRevenue, 1 / (durationYears - 1)) - 1 
        : 0,
    };
  };

  const scenarios = [
    { id: 'conservative', name: 'Prudent', color: 'hsl(38, 92%, 50%)' },
    { id: 'base', name: 'Base', color: 'hsl(0, 85%, 50%)' },
    { id: 'ambitious', name: 'Ambitieux', color: 'hsl(150, 60%, 40%)' },
  ];

  // Chart data comparing scenarios
  const comparisonData = YEARS.map(year => {
    const data: Record<string, number | string> = { year };
    
    scenarios.forEach(scenario => {
      const config = state.scenarioConfigs[scenario.id];
      let revenue = 0;
      state.products.forEach(product => {
        if (product.volumesByYear[year]) {
          const volume = Math.round(product.volumesByYear[year] * (1 + config.volumeAdjustment));
          const price = product.priceHT * (1 + config.priceAdjustment);
          revenue += volume * price;
        }
      });
      data[scenario.id] = revenue / 1000;
    });
    
    return data;
  });

  // Scenario comparison table data
  const scenarioComparison = scenarios.map(scenario => {
    const metrics = getScenarioMetrics(scenario.id);
    return {
      ...scenario,
      ...metrics,
      config: state.scenarioConfigs[scenario.id],
    };
  });

  const handleStartYearChange = (value: number) => {
    updateScenarioSettings({ startYear: value });
  };

  const handleDurationChange = (value: number) => {
    updateScenarioSettings({ durationYears: value });
  };

  const handleInitialCashChange = (value: number) => {
    updateScenarioSettings({ initialCash: value });
  };

  const handleAmountRaisedChange = (value: number) => {
    if (latestRound) {
      const updatedRounds = state.fundingRounds.map(r =>
        r.id === latestRound.id ? { ...r, amount: value } : r
      );
      updateFundingRounds(updatedRounds);
    }
  };

  // Utiliser la projection unifiée depuis le moteur (source unique)
  const { treasuryProjection } = computed;

  // Calcul projection Cash Flow basé sur le scénario actif - DEPUIS LE MOTEUR UNIFIÉ
  const cashFlowProjection = treasuryProjection.years.map(yp => ({
    year: yp.year,
    revenue: yp.revenue / 1000,
    cogs: yp.cogs / 1000,
    payroll: yp.payroll / 1000,
    opex: yp.opex / 1000,
    capex: yp.capex / 1000,
    depreciation: yp.depreciation / 1000,
    grossMargin: yp.grossMargin / 1000,
    ebitda: yp.ebitda / 1000,
    cashFlow: yp.cashFlow / 1000,
    treasury: yp.treasuryEnd / 1000,
  }));

  const minTreasury = treasuryProjection.minTreasury / 1000;
  const breakEvenYear = treasuryProjection.breakEvenYear || 'N/A';

  return (
    <ReadOnlyWrapper tabKey="scenarios">
    <div className="space-y-6">
      <HeroBanner
        image="rd"
        title="Scénarios"
        subtitle="Modulation des projections basées sur le Plan Produit"
        height="sm"
      />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Badge variant={state.revenueMode === 'by-product' ? 'outline' : 'secondary'} className="text-xs">
            CA: {state.revenueMode === 'by-product' ? 'Par Produit' : 'Global Canaux'}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {startYear} → {startYear + durationYears - 1} ({durationYears} ans)
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <PageExportPDF
            pageTitle="Scénarios"
            sections={EXPORT_SECTIONS}
            fileName="Scenarios"
          />
          <SaveButton
            onSave={saveAll}
            hasUnsavedChanges={state.hasUnsavedChanges}
            lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
          />
        </div>
      </div>

      {/* Paramètres de période */}
      <SectionCard title="Paramètres du Scénario" id="scenario-settings">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Label>Année de début</Label>
            </div>
            <div className="flex gap-2">
              {[2024, 2025, 2026, 2027].map(year => (
                <Button
                  key={year}
                  size="sm"
                  variant={startYear === year ? 'default' : 'outline'}
                  onClick={() => handleStartYearChange(year)}
                >
                  {year}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Première année des projections
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label>Durée (années)</Label>
            </div>
            <div className="flex gap-2">
              {[3, 4, 5, 6, 7].map(duration => (
                <Button
                  key={duration}
                  size="sm"
                  variant={durationYears === duration ? 'default' : 'outline'}
                  onClick={() => handleDurationChange(duration)}
                >
                  {duration} ans
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Horizon de projection: {startYear} → {startYear + durationYears - 1}
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Paramètres Trésorerie */}
      <SectionCard title="Paramètres Trésorerie" id="treasury-params">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <Label>Trésorerie initiale (T0)</Label>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Cash disponible au démarrage</span>
                <span className="text-lg font-bold font-mono-numbers">{formatCurrency(initialCash, true)}</span>
              </div>
              <Slider
                value={[initialCash / 1000]}
                onValueChange={([v]) => handleInitialCashChange(v * 1000)}
                min={0}
                max={1000}
                step={10}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0€</span>
                <span>1M€</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <Label>Montant Levé</Label>
              <Badge variant="outline" className="text-xs ml-auto">
                Depuis Financement
              </Badge>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">{latestRound?.name || 'Tour de table'}</span>
                <span className="text-lg font-bold font-mono-numbers">{formatCurrency(amountRaised, true)}</span>
              </div>
              <Slider
                value={[amountRaised / 1000]}
                onValueChange={([v]) => handleAmountRaisedChange(v * 1000)}
                min={100}
                max={5000}
                step={50}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>100k€</span>
                <span>5M€</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t grid md:grid-cols-4 gap-4">
          <KPICard
            label="Cash Total T0"
            value={formatCurrency(initialCash + amountRaised, true)}
            subValue="Tréso + Levée"
          />
          <KPICard
            label="Point Bas Tréso"
            value={formatCurrency(minTreasury * 1000, true)}
            subValue="Sur la période"
            trend={minTreasury < 0 ? 'down' : undefined}
          />
          <KPICard
            label="Break-even"
            value={breakEvenYear.toString()}
            subValue="Cash flow positif"
          />
          <KPICard
            label="Tréso Finale"
            value={formatCurrency((cashFlowProjection[cashFlowProjection.length - 1]?.treasury || 0) * 1000, true)}
            subValue={`En ${startYear + durationYears - 1}`}
          />
        </div>
      </SectionCard>

      {/* Scenario Selector */}
      <div className="grid md:grid-cols-3 gap-4">
        {scenarioComparison.map((scenario) => (
          <div
            key={scenario.id}
            className={cn(
              'p-4 rounded-lg border-2 transition-all cursor-pointer',
              state.activeScenarioId === scenario.id
                ? 'border-accent bg-accent/5'
                : 'border-border hover:border-accent/50'
            )}
            onClick={() => setActiveScenario(scenario.id as 'conservative' | 'base' | 'ambitious')}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">{scenario.name}</h3>
              {state.activeScenarioId === scenario.id && (
                <Badge>Actif</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">CA {startYear + durationYears - 1}</p>
                <p className="font-mono-numbers font-semibold">{formatCurrency(scenario.revenueLastYear, true)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">TCAM</p>
                <p className="font-mono-numbers font-semibold">{formatPercent(scenario.cagr)}</p>
              </div>
            </div>

            {/* Adjustments */}
            <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Volumes</span>
                  <span className={cn(
                    "font-mono-numbers",
                    scenario.config.volumeAdjustment > 0 ? 'text-green-600' : scenario.config.volumeAdjustment < 0 ? 'text-destructive' : ''
                  )}>
                    {scenario.config.volumeAdjustment > 0 ? '+' : ''}{(scenario.config.volumeAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[(scenario.config.volumeAdjustment + 0.5) * 100]}
                  onValueChange={([v]) => updateScenarioConfig(scenario.id, { volumeAdjustment: v / 100 - 0.5 })}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>Prix</span>
                  <span className={cn(
                    "font-mono-numbers",
                    scenario.config.priceAdjustment > 0 ? 'text-green-600' : scenario.config.priceAdjustment < 0 ? 'text-destructive' : ''
                  )}>
                    {scenario.config.priceAdjustment > 0 ? '+' : ''}{(scenario.config.priceAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[(scenario.config.priceAdjustment + 0.2) * 250]}
                  onValueChange={([v]) => updateScenarioConfig(scenario.id, { priceAdjustment: v / 250 - 0.2 })}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span>OPEX</span>
                  <span className={cn(
                    "font-mono-numbers",
                    scenario.config.opexAdjustment < 0 ? 'text-green-600' : scenario.config.opexAdjustment > 0 ? 'text-destructive' : ''
                  )}>
                    {scenario.config.opexAdjustment > 0 ? '+' : ''}{(scenario.config.opexAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[(scenario.config.opexAdjustment + 0.3) * 166]}
                  onValueChange={([v]) => updateScenarioConfig(scenario.id, { opexAdjustment: v / 166 - 0.3 })}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Comparison Chart */}
      <SectionCard title="Comparaison des Trajectoires CA" id="scenario-chart">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${v}k€`} />
              <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
              <Legend />
              {scenarios.map(scenario => (
                <Line
                  key={scenario.id}
                  type="monotone"
                  dataKey={scenario.id}
                  name={scenario.name}
                  stroke={scenario.color}
                  strokeWidth={state.activeScenarioId === scenario.id ? 3 : 1}
                  dot={{ fill: scenario.color }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Cash Flow Projection Chart */}
      <SectionCard title="Projection Cash Flow & Trésorerie" id="scenario-cashflow">
        <p className="text-sm text-muted-foreground mb-4">
          Basé sur le scénario <Badge variant="outline">{scenarios.find(s => s.id === state.activeScenarioId)?.name}</Badge> avec tréso initiale {formatCurrency(initialCash, true)} + levée {formatCurrency(amountRaised, true)}
        </p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={cashFlowProjection}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${v}k€`} />
              <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
              <Legend />
              <Bar dataKey="cashFlow" name="Cash Flow" fill="hsl(38, 92%, 50%)" />
              <Line 
                type="monotone" 
                dataKey="treasury" 
                name="Trésorerie" 
                stroke="hsl(0, 85%, 50%)" 
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        {scenarioComparison.map(scenario => (
          <SectionCard key={scenario.id} title={scenario.name}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">CA {startYear + durationYears - 1}</p>
                  <p className="text-xl font-bold font-mono-numbers">{formatCurrency(scenario.revenueLastYear, true)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">TCAM</p>
                  <p className="text-xl font-bold font-mono-numbers">{formatPercent(scenario.cagr)}</p>
                </div>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Volumes</span>
                  <span className="font-mono-numbers">
                    {scenario.config.volumeAdjustment > 0 ? '+' : ''}{(scenario.config.volumeAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Prix</span>
                  <span className="font-mono-numbers">
                    {scenario.config.priceAdjustment > 0 ? '+' : ''}{(scenario.config.priceAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>OPEX</span>
                  <span className="font-mono-numbers">
                    {scenario.config.opexAdjustment > 0 ? '+' : ''}{(scenario.config.opexAdjustment * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                {scenario.id === 'conservative' && 'Hypothèses prudentes avec volumes réduits de 20%'}
                {scenario.id === 'base' && 'Trajectoire nominale alignée sur le Plan Produit'}
                {scenario.id === 'ambitious' && 'Forte traction avec volumes augmentés de 25%'}
              </p>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
    </ReadOnlyWrapper>
  );
}
