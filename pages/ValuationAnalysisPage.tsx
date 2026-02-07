import React, { useState } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { PageExportPDF, ExportableSection } from '@/components/export/PageExportPDF';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { EditableHistoricalFinancials } from '@/components/valuation/EditableHistoricalFinancials';
import { DilutionSimulator, DilutionConfig, defaultDilutionConfig } from '@/components/valuation/DilutionSimulator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import {
  VALUATION_METHODS,
  ValuationMethod,
  calculateValuation,
  calculateAverageValuation,
  ValuationResult,
} from '@/engine/valuationMethods';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

const EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'kpis', label: 'KPIs Valorisation', elementId: 'valuation-kpis' },
  { id: 'historical', label: 'Données Historiques', elementId: 'valuation-historical' },
  { id: 'methods', label: 'Méthodes de Valorisation', elementId: 'valuation-methods' },
  { id: 'dilution', label: 'Simulation Dilution', elementId: 'valuation-dilution' },
];

export function ValuationAnalysisPage() {
  const { state, computed, updateHistoricalData, saveAll } = useFinancial();
  
  // État pour la méthode de valorisation sélectionnée
  const [selectedMethods, setSelectedMethods] = useState<ValuationMethod[]>(['revenue_multiple', 'ebitda_multiple']);
  const [valuationBasis, setValuationBasis] = useState<'historical' | 'projected' | 'mixed'>('projected');
  const [historicalYear, setHistoricalYear] = useState(2024);
  const [projectedYear, setProjectedYear] = useState(2028);
  const [mixWeight, setMixWeight] = useState(0.5);
  
  // Paramètres des méthodes de valorisation
  const [valuationParams, setValuationParams] = useState({
    revenue_multiple: { multiple: 4 },
    ebitda_multiple: { multiple: 8 },
    ebit_multiple: { multiple: 10 },
    dcf: { discountRate: 0.25, terminalGrowthRate: 0.03 },
    scorecard: { 
      baseValuation: 3000000,
      team: 0.15, market: 0.20, product: 0.10, competition: -0.10, marketing: 0, fundingNeed: 0 
    },
    berkus: { soundIdea: 400000, prototype: 350000, qualityManagement: 300000, strategicRelationships: 200000, productRollout: 250000 },
    risk_factor: { 
      baseValuation: 3000000,
      managementRisk: 1, businessStage: 0, legislation: 0, manufacturing: -1, salesMarketing: 1,
      fundingCapital: 0, competition: -1, technology: 1, litigation: 0, international: 0, reputation: 1, potentialExit: 1
    },
  });
  
  // Dilution config - synchronisé avec le montant à lever du financement
  const latestRound = state.fundingRounds[state.fundingRounds.length - 1];
  const totalRaiseFromFunding = latestRound?.amount || 1500000;
  
  // EBITDA de référence pour la valorisation
  const referenceEBITDA = (() => {
    const lastHistorical = state.historicalData[state.historicalData.length - 1];
    if (lastHistorical) {
      const grossProfit = lastHistorical.revenue * lastHistorical.grossMargin;
      return grossProfit - lastHistorical.payroll - lastHistorical.externalCosts;
    }
    return 500000;
  })();
  
  const [dilutionConfig, setDilutionConfig] = useState<DilutionConfig>({
    ...defaultDilutionConfig,
    totalRaise: totalRaiseFromFunding,
    referenceEBITDA,
  });

  // Synchroniser quand le montant à lever change
  React.useEffect(() => {
    setDilutionConfig(prev => ({
      ...prev,
      totalRaise: totalRaiseFromFunding,
      referenceEBITDA,
    }));
  }, [totalRaiseFromFunding, referenceEBITDA]);

  // Calculs de valorisation basés sur la config de dilution
  const preMoneyFromEBITDA = Math.max(200000, dilutionConfig.referenceEBITDA * dilutionConfig.ebitdaMultiple);
  const equityAmount = dilutionConfig.totalRaise * (1 - dilutionConfig.ocRatio);
  const postMoneyFromConfig = preMoneyFromEBITDA + equityAmount;
  const dilutionFromConfig = postMoneyFromConfig > 0 ? equityAmount / postMoneyFromConfig : 0;

  // Scénarios de sortie avec multiples EBITDA ajustables
  const [exitScenarios, setExitScenarios] = useState({
    conservative: { year: 2030, exitMultiple: 4, probability: 0.25 },
    base: { year: 2029, exitMultiple: 6, probability: 0.50 },
    ambitious: { year: 2028, exitMultiple: 10, probability: 0.25 },
  });

  // Années historiques disponibles
  const HISTORICAL_YEARS = state.historicalData.map(d => d.year);

  // Calcul des métriques selon la base choisie
  const getMetricsForValuation = () => {
    const getHistoricalMetrics = (year: number) => {
      const data = state.historicalData.find(d => d.year === year);
      if (!data) return { revenue: 0, ebitda: 0, ebit: 0 };
      const grossProfit = data.revenue * data.grossMargin;
      const ebitda = grossProfit - data.payroll - data.externalCosts;
      const ebit = ebitda - data.depreciation;
      return { revenue: data.revenue, ebitda, ebit };
    };

    const getProjectedMetrics = (year: number) => {
      const revData = computed.revenueByYear.find(r => r.year === year);
      const payData = computed.payrollByYear.find(p => p.year === year);
      const opData = computed.opexByYear.find(o => o.year === year);
      const capData = computed.capexByYear.find(c => c.year === year);
      
      const revenue = revData?.revenue || 0;
      const grossMargin = revenue - (revData?.cogs || 0);
      const ebitda = grossMargin - (payData?.payroll || 0) - (opData?.opex || 0);
      const ebit = ebitda - (capData?.depreciation || 0);
      
      return { revenue, ebitda, ebit };
    };

    if (valuationBasis === 'historical') {
      return getHistoricalMetrics(historicalYear);
    } else if (valuationBasis === 'projected') {
      return getProjectedMetrics(projectedYear);
    } else {
      const hist = getHistoricalMetrics(historicalYear);
      const proj = getProjectedMetrics(projectedYear);
      return {
        revenue: hist.revenue * (1 - mixWeight) + proj.revenue * mixWeight,
        ebitda: hist.ebitda * (1 - mixWeight) + proj.ebitda * mixWeight,
        ebit: hist.ebit * (1 - mixWeight) + proj.ebit * mixWeight,
      };
    }
  };

  const metrics = getMetricsForValuation();
  
  // Calcul des valorisations par méthode
  const getValuationResults = (): ValuationResult[] => {
    const results: ValuationResult[] = [];
    
    if (selectedMethods.includes('revenue_multiple')) {
      results.push(calculateValuation('revenue_multiple', {
        projectedRevenue: metrics.revenue,
        multiple: valuationParams.revenue_multiple.multiple,
      }));
    }
    
    if (selectedMethods.includes('ebitda_multiple')) {
      results.push(calculateValuation('ebitda_multiple', {
        projectedEBITDA: metrics.ebitda,
        multiple: valuationParams.ebitda_multiple.multiple,
      }));
    }
    
    if (selectedMethods.includes('dcf')) {
      const cashFlows = YEARS.map(year => {
        const r = computed.revenueByYear.find(d => d.year === year);
        const p = computed.payrollByYear.find(d => d.year === year);
        const o = computed.opexByYear.find(d => d.year === year);
        const c = computed.capexByYear.find(d => d.year === year);
        return (r?.revenue || 0) - (r?.cogs || 0) - (p?.payroll || 0) - (o?.opex || 0) - (c?.capex || 0);
      });
      results.push(calculateValuation('dcf', {
        cashFlows,
        discountRate: valuationParams.dcf.discountRate,
        terminalGrowthRate: valuationParams.dcf.terminalGrowthRate,
      }));
    }
    
    if (selectedMethods.includes('scorecard')) {
      results.push(calculateValuation('scorecard', {
        baseValuation: valuationParams.scorecard.baseValuation,
        factors: {
          team: valuationParams.scorecard.team,
          market: valuationParams.scorecard.market,
          product: valuationParams.scorecard.product,
          competition: valuationParams.scorecard.competition,
          marketing: valuationParams.scorecard.marketing,
          fundingNeed: valuationParams.scorecard.fundingNeed,
        },
      }));
    }
    
    if (selectedMethods.includes('berkus')) {
      results.push(calculateValuation('berkus', valuationParams.berkus));
    }
    
    if (selectedMethods.includes('risk_factor')) {
      results.push(calculateValuation('risk_factor', {
        baseValuation: valuationParams.risk_factor.baseValuation,
        factors: {
          managementRisk: valuationParams.risk_factor.managementRisk,
          businessStage: valuationParams.risk_factor.businessStage,
          legislation: valuationParams.risk_factor.legislation,
          manufacturing: valuationParams.risk_factor.manufacturing,
          salesMarketing: valuationParams.risk_factor.salesMarketing,
          fundingCapital: valuationParams.risk_factor.fundingCapital,
          competition: valuationParams.risk_factor.competition,
          technology: valuationParams.risk_factor.technology,
          litigation: valuationParams.risk_factor.litigation,
          international: valuationParams.risk_factor.international,
          reputation: valuationParams.risk_factor.reputation,
          potentialExit: valuationParams.risk_factor.potentialExit,
        },
      }));
    }
    
    return results;
  };
  
  const valuationResults = getValuationResults();
  const averageValuation = calculateAverageValuation(valuationResults);
  
  const toggleMethod = (method: ValuationMethod) => {
    setSelectedMethods(prev => 
      prev.includes(method) 
        ? prev.filter(m => m !== method)
        : [...prev, method]
    );
  };
  
  const valuationComparisonData = valuationResults.map(result => ({
    name: VALUATION_METHODS.find(m => m.id === result.method)?.name || result.method,
    value: result.value / 1000000,
    confidence: result.confidence,
  }));
  
  // Calcul TRI investisseur par scénario
  const calculateIRR = (investment: number, exitValue: number, years: number): number => {
    if (investment <= 0 || exitValue <= 0 || years <= 0) return 0;
    return Math.pow(exitValue / investment, 1 / years) - 1;
  };

  // Calcul EBITDA par année pour les scénarios de sortie
  const getEBITDAForYear = (year: number) => {
    const rev = computed.revenueByYear.find(r => r.year === year);
    const pay = computed.payrollByYear.find(p => p.year === year);
    const op = computed.opexByYear.find(o => o.year === year);
    if (!rev) return 0;
    return (rev.revenue - rev.cogs) - (pay?.payroll || 0) - (op?.opex || 0);
  };
  
  const exitAnalysis = Object.entries(exitScenarios).map(([scenario, params]) => {
    const exitYear = params.year;
    const ebitdaAtExit = getEBITDAForYear(exitYear);
    const exitValuation = ebitdaAtExit * params.exitMultiple;
    const investorShare = dilutionFromConfig;
    const investorReturn = exitValuation * investorShare;
    const holdingPeriod = exitYear - state.scenarioSettings.startYear;
    const irr = calculateIRR(equityAmount, investorReturn, holdingPeriod);
    const multiple = equityAmount > 0 ? investorReturn / equityAmount : 0;
    
    return {
      scenario,
      year: exitYear,
      exitMultiple: params.exitMultiple,
      probability: params.probability,
      ebitdaAtExit,
      exitValuation,
      investorReturn,
      irr,
      multiple,
    };
  });

  // Évolution P&L
  const plEvolution = YEARS.map(year => {
    const rev = computed.revenueByYear.find(r => r.year === year);
    const pay = computed.payrollByYear.find(p => p.year === year);
    const op = computed.opexByYear.find(o => o.year === year);
    const cap = computed.capexByYear.find(c => c.year === year);
    
    const revenue = rev?.revenue || 0;
    const grossMargin = revenue - (rev?.cogs || 0);
    const ebitda = grossMargin - (pay?.payroll || 0) - (op?.opex || 0);
    const ebit = ebitda - (cap?.depreciation || 0);
    
    return {
      year,
      revenue: revenue / 1000,
      grossMargin: grossMargin / 1000,
      ebitda: ebitda / 1000,
      ebit: ebit / 1000,
    };
  });
  
  return (
    <ReadOnlyWrapper tabKey="valuation">
    <div className="space-y-6">
      <HeroBanner
        image="rd"
        title="Valorisation & Analyse"
        subtitle="Méthodes de valorisation, historique et simulation de dilution"
        height="sm"
      />

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {selectedMethods.length} méthodes sélectionnées
          </Badge>
          <Badge variant="secondary" className="text-xs">
            Valorisation moyenne: {formatCurrency(averageValuation, true)}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <PageExportPDF
            pageTitle="Valorisation & Analyse"
            sections={EXPORT_SECTIONS}
            fileName="Valorisation"
          />
          <SaveButton
            onSave={saveAll}
            hasUnsavedChanges={state.hasUnsavedChanges}
            lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
          />
        </div>
      </div>

      {/* KPIs Valorisation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="valuation-kpis">
        <KPICard
          label="Pre-Money (EBITDA)"
          value={formatCurrency(preMoneyFromEBITDA, true)}
          subValue={`${dilutionConfig.ebitdaMultiple.toFixed(1)}x EBITDA`}
        />
        <KPICard
          label="Post-Money"
          value={formatCurrency(postMoneyFromConfig, true)}
          subValue="Après levée"
        />
        <KPICard
          label="Dilution Totale"
          value={formatPercent(dilutionFromConfig)}
          subValue="Part investisseur"
        />
        <KPICard
          label="TRI moyen"
          value={formatPercent(exitAnalysis.reduce((sum, e) => sum + e.irr * e.probability, 0))}
          subValue="Pondéré par probabilité"
        />
      </div>

      <Tabs defaultValue="historical" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="historical">Historique Financier</TabsTrigger>
          <TabsTrigger value="methods">Méthodes de Valorisation</TabsTrigger>
          <TabsTrigger value="dilution">Simulation Dilution</TabsTrigger>
          <TabsTrigger value="exit">Scénarios de Sortie</TabsTrigger>
        </TabsList>

        {/* Historique Financier Éditable */}
        <TabsContent value="historical" className="space-y-6">
          <EditableHistoricalFinancials
            data={state.historicalData}
            onChange={updateHistoricalData}
          />
        </TabsContent>

        {/* Méthodes de valorisation */}
        <TabsContent value="methods" className="space-y-6">
          {/* Sélection base de calcul */}
          <SectionCard title="Base de Calcul">
            <div className="grid md:grid-cols-3 gap-4 mb-4">
              {[
                { value: 'historical', label: 'Historique', desc: 'Basé sur les données passées' },
                { value: 'projected', label: 'Projeté', desc: 'Basé sur les projections futures' },
                { value: 'mixed', label: 'Mixte', desc: 'Combinaison historique + projeté' },
              ].map(option => (
                <button
                  key={option.value}
                  onClick={() => setValuationBasis(option.value as typeof valuationBasis)}
                  className={cn(
                    "p-4 rounded-lg text-left transition-colors border-2",
                    valuationBasis === option.value 
                      ? "bg-primary/10 border-primary" 
                      : "bg-muted/30 border-transparent hover:bg-muted/50"
                  )}
                >
                  <div className="font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.desc}</div>
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {(valuationBasis === 'historical' || valuationBasis === 'mixed') && (
                <div className="space-y-2">
                  <Label>Année historique de référence</Label>
                  <div className="flex gap-2">
                    {HISTORICAL_YEARS.map(year => (
                      <Button
                        key={year}
                        size="sm"
                        variant={historicalYear === year ? 'default' : 'outline'}
                        onClick={() => setHistoricalYear(year)}
                      >
                        {year}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {(valuationBasis === 'projected' || valuationBasis === 'mixed') && (
                <div className="space-y-2">
                  <Label>Année projetée de référence</Label>
                  <div className="flex gap-2">
                    {[2027, 2028, 2029, 2030].map(year => (
                      <Button
                        key={year}
                        size="sm"
                        variant={projectedYear === year ? 'default' : 'outline'}
                        onClick={() => setProjectedYear(year)}
                      >
                        {year}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {valuationBasis === 'mixed' && (
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Pondération</span>
                  <span>{Math.round((1 - mixWeight) * 100)}% historique / {Math.round(mixWeight * 100)}% projeté</span>
                </div>
                <Slider
                  value={[mixWeight * 100]}
                  onValueChange={([v]) => setMixWeight(v / 100)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
            )}

            {/* Métriques utilisées */}
            <div className="mt-4 p-4 bg-muted/30 rounded-lg grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">CA de référence</div>
                <div className="text-lg font-bold font-mono-numbers">{formatCurrency(metrics.revenue, true)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">EBITDA de référence</div>
                <div className={cn("text-lg font-bold font-mono-numbers", metrics.ebitda < 0 && "text-destructive")}>
                  {formatCurrency(metrics.ebitda, true)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">EBIT de référence</div>
                <div className={cn("text-lg font-bold font-mono-numbers", metrics.ebit < 0 && "text-destructive")}>
                  {formatCurrency(metrics.ebit, true)}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Sélection des méthodes */}
          <SectionCard title="Sélection des Méthodes">
            <div className="grid md:grid-cols-3 gap-3">
              {VALUATION_METHODS.map(method => {
                const isSelected = selectedMethods.includes(method.id);
                const result = valuationResults.find(r => r.method === method.id);
                
                return (
                  <button
                    key={method.id}
                    onClick={() => toggleMethod(method.id)}
                    className={cn(
                      "p-4 rounded-lg text-left transition-all border-2",
                      isSelected
                        ? "bg-primary/10 border-primary shadow-sm"
                        : "bg-muted/30 border-transparent hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{method.name}</span>
                      {isSelected && (
                        <Badge variant="default" className="text-xs">Actif</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{method.description}</p>
                    {result && (
                      <div className="text-lg font-bold font-mono-numbers">
                        {formatCurrency(result.value, true)}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </SectionCard>

          {/* Graphique comparatif */}
          {valuationResults.length > 0 && (
            <SectionCard title="Comparaison des Valorisations">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={valuationComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${v}M€`} />
                    <YAxis type="category" dataKey="name" width={120} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(1)}M€`} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}
        </TabsContent>

        {/* Dilution */}
        <TabsContent value="dilution" className="space-y-6">
          <DilutionSimulator
            config={dilutionConfig}
            onConfigChange={setDilutionConfig}
          />
        </TabsContent>

        {/* Scénarios de sortie */}
        <TabsContent value="exit" className="space-y-6">
          {/* Curseurs des multiples EBITDA */}
          <SectionCard title="Paramètres des Scénarios de Sortie">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { key: 'conservative', label: 'Prudent', color: 'text-muted-foreground' },
                { key: 'base', label: 'Base', color: 'text-primary' },
                { key: 'ambitious', label: 'Ambitieux', color: 'text-green-600 dark:text-green-400' },
              ].map(({ key, label, color }) => (
                <div key={key} className="space-y-3 p-4 bg-muted/30 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className={cn("font-medium", color)}>{label}</span>
                    <Badge variant="outline">{exitScenarios[key as keyof typeof exitScenarios].year}</Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Multiple EBITDA sortie</span>
                      <span className="font-mono-numbers font-bold">
                        {exitScenarios[key as keyof typeof exitScenarios].exitMultiple}x
                      </span>
                    </div>
                    <Slider
                      value={[exitScenarios[key as keyof typeof exitScenarios].exitMultiple]}
                      onValueChange={([v]) => setExitScenarios(prev => ({
                        ...prev,
                        [key]: { ...prev[key as keyof typeof prev], exitMultiple: v }
                      }))}
                      min={2}
                      max={15}
                      step={0.5}
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Résultats par scénario */}
          <div className="grid md:grid-cols-3 gap-4">
            {exitAnalysis.map((exit) => (
              <SectionCard 
                key={exit.scenario} 
                title={exit.scenario === 'conservative' ? 'Prudent' : exit.scenario === 'base' ? 'Base' : 'Ambitieux'}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Année sortie</p>
                      <p className="text-xl font-bold">{exit.year}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Multiple EBITDA</p>
                      <p className="text-xl font-bold">{exit.exitMultiple}x</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted/30 rounded">
                    <p className="text-xs text-muted-foreground">EBITDA à la sortie</p>
                    <p className="font-bold font-mono-numbers">{formatCurrency(exit.ebitdaAtExit, true)}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Valorisation sortie</p>
                      <p className="font-bold font-mono-numbers">{formatCurrency(exit.exitValuation, true)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Part investisseur</p>
                      <p className="font-bold font-mono-numbers">{formatCurrency(exit.investorReturn, true)}</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">TRI</span>
                      <span className={cn(
                        "font-bold font-mono-numbers",
                        exit.irr >= 0.25 ? "text-green-600 dark:text-green-400" : 
                        exit.irr >= 0.15 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
                      )}>
                        {formatPercent(exit.irr)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm">Multiple</span>
                      <span className="font-bold font-mono-numbers">{exit.multiple.toFixed(1)}x</span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-sm text-muted-foreground">Probabilité</span>
                      <span className="text-muted-foreground">{formatPercent(exit.probability)}</span>
                    </div>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>

          {/* Évolution P&L prévisionnel */}
          <SectionCard title="Évolution Prévisionnelle P&L">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={plEvolution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}k€`} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="CA" stackId="1" fill="hsl(0, 85%, 50%)" stroke="hsl(0, 85%, 50%)" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="ebitda" name="EBITDA" stackId="2" fill="hsl(38, 92%, 50%)" stroke="hsl(38, 92%, 50%)" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="ebit" name="EBIT" stackId="3" fill="hsl(210, 70%, 50%)" stroke="hsl(210, 70%, 50%)" fillOpacity={0.8} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
    </ReadOnlyWrapper>
  );
}
