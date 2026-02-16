import { useState, useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SaveButton } from '@/components/ui/SaveButton';
import { PageExportPDF, ExportableSection } from '@/components/export/PageExportPDF';
import { ReadOnlyWrapper } from '@/components/auth/ReadOnlyWrapper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowDownUp,
  Settings2,
  Eye,
  EyeOff,
  CalendarDays,
  BarChart3,
  Landmark,
  Package,
} from 'lucide-react';
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Area,
} from 'recharts';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { MonthlyTreasuryPlan } from '@/components/treasury/MonthlyTreasuryPlan';
import { LoanManager } from '@/components/treasury/LoanManager';
import { CapexScheduler } from '@/components/treasury/CapexScheduler';
import { TreasuryDetailChart } from '@/components/treasury/TreasuryDetailChart';
import { DetailedTreasuryBreakdown } from '@/components/treasury/DetailedTreasuryBreakdown';
import { SeasonalityEditor } from '@/components/treasury/SeasonalityEditor';
import { PaymentTermsEditor } from '@/components/treasury/PaymentTermsEditor';
import { aggregateByYear } from '@/engine/monthlyTreasuryEngine';

// Définition des indicateurs SIG disponibles
interface SIGIndicator {
  id: string;
  name: string;
  description: string;
  calculate: (data: YearData) => number;
  format: 'currency' | 'percent';
  category: 'margin' | 'profitability' | 'cash' | 'ratio';
  defaultVisible: boolean;
}

interface YearData {
  year: number;
  revenue: number;
  cogs: number;
  grossMargin: number;
  payroll: number;
  opex: number;
  capex: number;
  depreciation: number;
  ebitda: number;
  operatingResult: number;
  cashFlow: number;
  treasuryStart: number;
  treasuryEnd: number;
  fundingInjection: number;
}

// Liste des indicateurs SIG calculables
const SIG_INDICATORS: SIGIndicator[] = [
  // Marges
  {
    id: 'grossMargin',
    name: 'Marge Brute',
    description: 'CA - Coût des ventes',
    calculate: (d) => d.grossMargin,
    format: 'currency',
    category: 'margin',
    defaultVisible: true,
  },
  {
    id: 'grossMarginRate',
    name: 'Taux de Marge Brute',
    description: 'Marge Brute / CA',
    calculate: (d) => d.revenue > 0 ? d.grossMargin / d.revenue : 0,
    format: 'percent',
    category: 'margin',
    defaultVisible: true,
  },
  {
    id: 'valueAdded',
    name: 'Valeur Ajoutée',
    description: 'Marge Brute - Charges externes (OPEX hors salaires)',
    calculate: (d) => d.grossMargin - d.opex,
    format: 'currency',
    category: 'margin',
    defaultVisible: true,
  },
  {
    id: 'valueAddedRate',
    name: 'Taux de Valeur Ajoutée',
    description: 'Valeur Ajoutée / CA',
    calculate: (d) => d.revenue > 0 ? (d.grossMargin - d.opex) / d.revenue : 0,
    format: 'percent',
    category: 'margin',
    defaultVisible: false,
  },
  // Rentabilité
  {
    id: 'ebitda',
    name: 'EBITDA (EBE)',
    description: 'Excédent Brut d\'Exploitation',
    calculate: (d) => d.ebitda,
    format: 'currency',
    category: 'profitability',
    defaultVisible: true,
  },
  {
    id: 'ebitdaMargin',
    name: 'Marge EBITDA',
    description: 'EBITDA / CA',
    calculate: (d) => d.revenue > 0 ? d.ebitda / d.revenue : 0,
    format: 'percent',
    category: 'profitability',
    defaultVisible: true,
  },
  {
    id: 'operatingResult',
    name: 'Résultat d\'Exploitation',
    description: 'EBITDA - Amortissements',
    calculate: (d) => d.operatingResult,
    format: 'currency',
    category: 'profitability',
    defaultVisible: true,
  },
  {
    id: 'operatingMargin',
    name: 'Marge Opérationnelle',
    description: 'Résultat d\'Exploitation / CA',
    calculate: (d) => d.revenue > 0 ? d.operatingResult / d.revenue : 0,
    format: 'percent',
    category: 'profitability',
    defaultVisible: false,
  },
  // Trésorerie
  {
    id: 'cashFlow',
    name: 'Cash Flow Opérationnel',
    description: 'CA - COGS - OPEX - Salaires - CAPEX',
    calculate: (d) => d.cashFlow,
    format: 'currency',
    category: 'cash',
    defaultVisible: true,
  },
  {
    id: 'freeCashFlow',
    name: 'Free Cash Flow',
    description: 'Cash Flow hors financement',
    calculate: (d) => d.cashFlow,
    format: 'currency',
    category: 'cash',
    defaultVisible: false,
  },
  {
    id: 'treasuryEnd',
    name: 'Trésorerie Fin de Période',
    description: 'Position de trésorerie en fin d\'année',
    calculate: (d) => d.treasuryEnd,
    format: 'currency',
    category: 'cash',
    defaultVisible: true,
  },
  {
    id: 'cashBurn',
    name: 'Cash Burn',
    description: 'Consommation de trésorerie (si négatif)',
    calculate: (d) => d.cashFlow < 0 ? Math.abs(d.cashFlow) : 0,
    format: 'currency',
    category: 'cash',
    defaultVisible: false,
  },
  // Ratios
  {
    id: 'payrollRatio',
    name: 'Ratio Masse Salariale / CA',
    description: 'Poids des salaires dans le CA',
    calculate: (d) => d.revenue > 0 ? d.payroll / d.revenue : 0,
    format: 'percent',
    category: 'ratio',
    defaultVisible: true,
  },
  {
    id: 'opexRatio',
    name: 'Ratio OPEX / CA',
    description: 'Poids des charges opérationnelles',
    calculate: (d) => d.revenue > 0 ? d.opex / d.revenue : 0,
    format: 'percent',
    category: 'ratio',
    defaultVisible: true,
  },
  {
    id: 'capexRatio',
    name: 'Ratio CAPEX / CA',
    description: 'Intensité capitalistique',
    calculate: (d) => d.revenue > 0 ? d.capex / d.revenue : 0,
    format: 'percent',
    category: 'ratio',
    defaultVisible: false,
  },
  {
    id: 'productivityRatio',
    name: 'Productivité par €',
    description: 'CA / Masse Salariale',
    calculate: (d) => d.payroll > 0 ? d.revenue / d.payroll : 0,
    format: 'currency',
    category: 'ratio',
    defaultVisible: false,
  },
];

const ANNUAL_EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'kpis', label: 'KPIs Prévisionnel', elementId: 'previsionnel-kpis' },
  { id: 'treasury', label: 'Évolution Trésorerie', elementId: 'previsionnel-treasury' },
  { id: 'cashflow', label: 'Cash Flow', elementId: 'previsionnel-cashflow' },
  { id: 'sig', label: 'Tableau SIG', elementId: 'previsionnel-sig' },
];

const MONTHLY_EXPORT_SECTIONS: ExportableSection[] = [
  { id: 'monthly-kpis', label: 'KPIs Trésorerie', elementId: 'monthly-treasury-kpis' },
  { id: 'monthly-chart', label: 'Graphique Trésorerie', elementId: 'monthly-treasury-chart' },
  { id: 'monthly-summary', label: 'Résumé', elementId: 'monthly-treasury-summary' },
];

const CATEGORY_LABELS = {
  margin: 'Marges',
  profitability: 'Rentabilité',
  cash: 'Trésorerie',
  ratio: 'Ratios',
};

export function PrevisionnelPage() {
  const { state, computed, saveAll, updateMonthlyTreasuryConfig } = useFinancial();
  
  // État pour les indicateurs visibles (personnalisation)
  const [visibleIndicators, setVisibleIndicators] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    SIG_INDICATORS.forEach(ind => {
      if (ind.defaultVisible) defaults.add(ind.id);
    });
    return defaults;
  });
  
  // État pour l'onglet actif (annuel vs mensuel)
  const [activeView, setActiveView] = useState<'annual' | 'monthly' | 'params'>('annual');
  
  const { startYear, durationYears } = state.scenarioSettings;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);
  
  // Option pour exclure le financement des calculs
  const excludeFunding = state.excludeFundingFromTreasury;
  
  // Construire les données par année depuis le moteur de trésorerie mensuel (source unique)
  const { monthlyTreasuryProjection } = computed;
  
  const yearlyData: YearData[] = useMemo(() => {
    const aggregated = aggregateByYear(monthlyTreasuryProjection.months);
    
    return years.map(year => {
      const data = aggregated.get(year);
      if (!data) {
        return {
          year,
          revenue: 0,
          cogs: 0,
          grossMargin: 0,
          payroll: 0,
          opex: 0,
          capex: 0,
          depreciation: 0,
          ebitda: 0,
          operatingResult: 0,
          cashFlow: 0,
          treasuryStart: 0,
          treasuryEnd: 0,
          fundingInjection: 0,
        };
      }
      
      // Récupérer CAPEX depuis le moteur existant
      const treasuryYearData = computed.treasuryProjection.years.find(y => y.year === year);
      const capex = treasuryYearData?.capex || 0;
      const depreciation = treasuryYearData?.depreciation || 0;
      
      return {
        year: data.year,
        revenue: data.revenue,
        cogs: data.cogs,
        grossMargin: data.grossMargin,
        payroll: data.payroll,
        opex: data.opex,
        capex,
        depreciation,
        ebitda: data.ebitda,
        operatingResult: data.ebitda - depreciation,
        cashFlow: data.netCashFlow,
        treasuryStart: data.treasuryStart,
        treasuryEnd: data.treasuryEnd,
        fundingInjection: data.fundingInjection,
      };
    });
  }, [monthlyTreasuryProjection, computed.treasuryProjection, years]);
  
  // Données pour les graphiques (depuis le plan de trésorerie mensuel)
  const treasuryChartData = yearlyData.map(d => ({
    year: d.year,
    tresorerie: d.treasuryEnd / 1000,
    cashFlow: d.cashFlow / 1000,
    levee: d.fundingInjection / 1000,
  }));
  
  const sigChartData = yearlyData.map(d => ({
    year: d.year,
    ca: d.revenue / 1000,
    margeBrute: d.grossMargin / 1000,
    ebitda: d.ebitda / 1000,
    resultat: d.operatingResult / 1000,
  }));
  
  // KPIs clés (depuis le plan de trésorerie mensuel)
  const firstYear = yearlyData[0];
  const lastYear = yearlyData[yearlyData.length - 1];
  const totalCashFlow = yearlyData.reduce((sum, d) => sum + d.cashFlow, 0);
  const breakEvenYear = monthlyTreasuryProjection.breakEvenMonth?.year || null;
  const minTreasury = monthlyTreasuryProjection.minTreasury;
  
  // Toggle un indicateur
  const toggleIndicator = (id: string) => {
    setVisibleIndicators(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  
  // Filtrer les indicateurs visibles
  const activeIndicators = SIG_INDICATORS.filter(ind => visibleIndicators.has(ind.id));
  
  // Formater une valeur selon son type
  const formatValue = (value: number, format: 'currency' | 'percent') => {
    if (format === 'percent') return formatPercent(value);
    return formatCurrency(value, true);
  };

  return (
    <ReadOnlyWrapper tabKey="previsionnel">
      <div className="space-y-6">
        <HeroBanner
          image="rd"
          title="Prévisionnel Financier"
          subtitle="Projections de trésorerie, cash flow et SIG"
          height="sm"
        />

        {/* Navigation et contrôles */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-6">
            {/* Sélecteur de vue */}
            <Tabs value={activeView} onValueChange={(v) => setActiveView(v as 'annual' | 'monthly' | 'params')}>
              <TabsList>
                <TabsTrigger value="annual" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Vue Annuelle
                </TabsTrigger>
                <TabsTrigger value="monthly" className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Plan de Trésorerie
                </TabsTrigger>
                <TabsTrigger value="params" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Prêts & CAPEX
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            {/* Indicateur du mode CA */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Mode CA :</span>
              <Badge variant={state.revenueMode === 'by-product' ? 'default' : 'secondary'}>
                {state.revenueMode === 'by-product' ? 'Par Produit' : state.revenueMode === 'by-channel-global' ? 'Global Canaux' : 'Par Client'}
              </Badge>
            </div>
            
            {/* Indicateur levée (piloté depuis Scénarios) */}
            <div className="flex items-center gap-2">
              <Badge variant={excludeFunding ? 'outline' : 'default'} className="text-xs">
                {excludeFunding ? 'Levée désactivée' : 'Levée activée'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                (configurable dans Scénarios)
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {durationYears} années • {activeIndicators.length} indicateurs actifs
            </Badge>
            <PageExportPDF
              pageTitle={activeView === 'monthly' ? 'Plan de Trésorerie Mensuel' : 'Prévisionnel Financier'}
              sections={activeView === 'monthly' ? MONTHLY_EXPORT_SECTIONS : ANNUAL_EXPORT_SECTIONS}
              fileName={activeView === 'monthly' ? 'Plan_Tresorerie_Mensuel' : 'Previsionnel_Financier'}
            />
            <SaveButton
              onSave={saveAll}
              hasUnsavedChanges={state.hasUnsavedChanges}
              lastSaved={state.lastSaved ? new Date(state.lastSaved) : null}
            />
          </div>
        </div>

        {/* Contenu conditionnel selon la vue */}
        {activeView === 'params' ? (
          <div className="space-y-6">
            <LoanManager
              loans={state.monthlyTreasuryConfig.loans}
              onChange={(loans) => updateMonthlyTreasuryConfig({ ...state.monthlyTreasuryConfig, loans })}
              startYear={startYear}
              durationYears={durationYears}
            />
            <CapexScheduler
              capexPayments={state.monthlyTreasuryConfig.capexPayments}
              onChange={(capexPayments) => updateMonthlyTreasuryConfig({ ...state.monthlyTreasuryConfig, capexPayments })}
              products={state.products}
              startYear={startYear}
              durationYears={durationYears}
            />
          </div>
        ) : activeView === 'monthly' ? (
          <div className="space-y-6">
            <TreasuryDetailChart
              projection={monthlyTreasuryProjection}
              startYear={startYear}
              durationYears={durationYears}
            />

            {/* Saisonnalité CA */}
            <SeasonalityEditor
              title="Saisonnalité du CA"
              description="Ajustez la répartition mensuelle du chiffre d'affaires. Par défaut, le CA est réparti uniformément (1/12e par mois)."
              seasonality={state.monthlyTreasuryConfig.revenueSeasonality}
              onChange={(revenueSeasonality) => updateMonthlyTreasuryConfig({ ...state.monthlyTreasuryConfig, revenueSeasonality })}
            />
            
            {/* Saisonnalité Achats Matière */}
            <SeasonalityEditor
              title="Saisonnalité des Achats Matière"
              description="Modulation mensuelle des achats. Les achats peuvent suivre la même saisonnalité que le CA ou être décalés (anticipation, stockage…)."
              seasonality={state.monthlyTreasuryConfig.cogsSeasonality}
              onChange={(cogsSeasonality) => updateMonthlyTreasuryConfig({ ...state.monthlyTreasuryConfig, cogsSeasonality })}
            />
            
            {/* Conditions de paiement fournisseur */}
            <PaymentTermsEditor
              terms={state.monthlyTreasuryConfig.cogsPaymentTerms || [{ delayMonths: 0, percentage: 100 }]}
              onChange={(cogsPaymentTerms) => updateMonthlyTreasuryConfig({ ...state.monthlyTreasuryConfig, cogsPaymentTerms })}
            />

            {/* Vérification cohérence annuelle */}
            <SectionCard title="Vérification Cohérence Annuelle" action={
              <Badge variant="outline" className="text-xs">Plan Produit vs Trésorerie</Badge>
            }>
              <p className="text-xs text-muted-foreground mb-3">
                Vérifiez que la somme annuelle du CA et des achats matière correspond aux données du Plan Produit / moteur financier.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Année</th>
                      <th className="text-right py-2 px-2">CA Plan Produit</th>
                      <th className="text-right py-2 px-2">CA Trésorerie (Σ mois)</th>
                      <th className="text-right py-2 px-2">Écart CA</th>
                      <th className="text-right py-2 px-2">Achats Plan Produit</th>
                      <th className="text-right py-2 px-2">Achats Trésorerie (Σ mois)</th>
                      <th className="text-right py-2 px-2">Écart Achats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {years.map(year => {
                      const revPlan = computed.revenueByYear.find(r => r.year === year);
                      const planRevenue = revPlan?.revenue || 0;
                      const planCogs = revPlan?.cogs || 0;

                      const yearMonths = monthlyTreasuryProjection.months.filter(m => m.year === year);
                      const tresoRevenue = yearMonths.reduce((s, m) => s + m.revenue, 0);
                      const tresoCogs = yearMonths.reduce((s, m) => s + m.cogs, 0);

                      const revDiff = tresoRevenue - planRevenue;
                      const cogsDiff = tresoCogs - planCogs;
                      const revOk = Math.abs(revDiff) < 1;
                      const cogsOk = Math.abs(cogsDiff) < planCogs * 0.01 + 1;

                      return (
                        <tr key={year} className="border-b">
                          <td className="py-1.5 px-2 font-medium">{year}</td>
                          <td className="py-1.5 px-2 text-right font-mono-numbers">{formatCurrency(planRevenue, true)}</td>
                          <td className="py-1.5 px-2 text-right font-mono-numbers">{formatCurrency(tresoRevenue, true)}</td>
                          <td className={cn("py-1.5 px-2 text-right font-mono-numbers", revOk ? "text-[hsl(var(--positive))]" : "text-destructive")}>
                            {revOk ? '✓' : formatCurrency(revDiff, true)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono-numbers">{formatCurrency(planCogs, true)}</td>
                          <td className="py-1.5 px-2 text-right font-mono-numbers">{formatCurrency(tresoCogs, true)}</td>
                          <td className={cn("py-1.5 px-2 text-right font-mono-numbers", cogsOk ? "text-[hsl(var(--positive))]" : "text-amber-600")}>
                            {cogsOk ? '✓' : formatCurrency(cogsDiff, true)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Note : les écarts sur les achats peuvent être normaux si des conditions de paiement avec délais sont configurées (report entre années).
              </p>
            </SectionCard>

            <DetailedTreasuryBreakdown
              projection={monthlyTreasuryProjection}
              startYear={startYear}
              durationYears={durationYears}
            />
            <MonthlyTreasuryPlan />
          </div>
        ) : (
          <>
            {/* KPIs principaux */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="previsionnel-kpis">
          <KPICard
            label={`CA ${lastYear?.year || ''}`}
            value={formatCurrency(lastYear?.revenue || 0, true)}
            subValue={`vs ${formatCurrency(firstYear?.revenue || 0, true)} en ${firstYear?.year}`}
            trend="up"
          />
          <KPICard
            label="Cash Flow Cumulé"
            value={formatCurrency(totalCashFlow, true)}
            subValue={`${firstYear?.year}-${lastYear?.year}`}
            trend={totalCashFlow >= 0 ? 'up' : 'down'}
          />
          <KPICard
            label="Trésorerie Min"
            value={formatCurrency(minTreasury, true)}
            subValue="Point bas projeté"
            trend={minTreasury >= 0 ? 'neutral' : 'down'}
          />
          <KPICard
            label="Break-even"
            value={breakEvenYear ? breakEvenYear.toString() : 'N/A'}
            subValue="Cash flow positif"
          />
        </div>

        {/* Graphiques principaux */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Évolution Trésorerie */}
          <SectionCard title="Évolution de la Trésorerie" id="previsionnel-treasury">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={treasuryChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}k€`} />
                  <RechartsTooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="tresorerie" 
                    name="Trésorerie" 
                    fill="hsl(210, 70%, 50%)" 
                    fillOpacity={0.3}
                    stroke="hsl(210, 70%, 50%)"
                    strokeWidth={2}
                  />
                  <Bar dataKey="levee" name="Levée" fill="hsl(150, 60%, 40%)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          {/* Cash Flow */}
          <SectionCard title="Cash Flow Annuel" id="previsionnel-cashflow">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={treasuryChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}k€`} />
                  <RechartsTooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                  <Bar 
                    dataKey="cashFlow" 
                    name="Cash Flow"
                    fill="hsl(0, 85%, 50%)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Graphique SIG */}
        <SectionCard title="Soldes Intermédiaires de Gestion">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sigChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${v}k€`} />
                <RechartsTooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                <Legend />
                <Line type="monotone" dataKey="ca" name="CA" stroke="hsl(210, 70%, 50%)" strokeWidth={2} />
                <Line type="monotone" dataKey="margeBrute" name="Marge Brute" stroke="hsl(150, 60%, 40%)" strokeWidth={2} />
                <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke="hsl(38, 92%, 50%)" strokeWidth={2} />
                <Line type="monotone" dataKey="resultat" name="Rés. Exploitation" stroke="hsl(0, 85%, 50%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Tableau SIG avec personnalisation */}
        <SectionCard 
          title="Tableau des Indicateurs" 
          id="previsionnel-sig"
          action={
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 mr-2" />
                  Personnaliser
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-96 overflow-y-auto" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Indicateurs visibles</h4>
                  
                  {Object.entries(CATEGORY_LABELS).map(([category, label]) => (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {label}
                      </p>
                      {SIG_INDICATORS.filter(ind => ind.category === category).map(indicator => (
                        <div key={indicator.id} className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <Label htmlFor={indicator.id} className="text-sm cursor-pointer">
                              {indicator.name}
                            </Label>
                            <p className="text-xs text-muted-foreground truncate">
                              {indicator.description}
                            </p>
                          </div>
                          <Switch
                            id={indicator.id}
                            checked={visibleIndicators.has(indicator.id)}
                            onCheckedChange={() => toggleIndicator(indicator.id)}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Indicateur</TableHead>
                  {years.map(year => (
                    <TableHead key={year} className="text-right min-w-24">{year}</TableHead>
                  ))}
                  <TableHead className="text-right min-w-28">Évolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeIndicators.map(indicator => {
                  const values = yearlyData.map(d => indicator.calculate(d));
                  const firstVal = values[0] || 0;
                  const lastVal = values[values.length - 1] || 0;
                  const evolution = firstVal !== 0 ? (lastVal - firstVal) / Math.abs(firstVal) : 0;
                  
                  return (
                    <TableRow key={indicator.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        <div>
                          <span>{indicator.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {indicator.description}
                          </span>
                        </div>
                      </TableCell>
                      {values.map((value, i) => (
                        <TableCell 
                          key={i} 
                          className={cn(
                            "text-right font-mono-numbers",
                            indicator.format === 'currency' && value < 0 && "text-destructive"
                          )}
                        >
                          {formatValue(value, indicator.format)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className={cn(
                          "flex items-center justify-end gap-1",
                          evolution > 0 ? "text-green-600" : evolution < 0 ? "text-destructive" : "text-muted-foreground"
                        )}>
                          {evolution > 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : evolution < 0 ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : null}
                          <span className="font-mono-numbers text-sm">
                            {evolution > 0 ? '+' : ''}{formatPercent(evolution)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          
          {activeIndicators.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <EyeOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Aucun indicateur sélectionné</p>
              <p className="text-sm">Cliquez sur "Personnaliser" pour ajouter des indicateurs</p>
            </div>
          )}
        </SectionCard>

        {/* Tableau P&L Simplifié */}
        <SectionCard title="Compte de Résultat Simplifié">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Poste</TableHead>
                  {years.map(year => (
                    <TableHead key={year} className="text-right min-w-24">{year}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-muted/30">
                  <TableCell className="sticky left-0 bg-muted/30 z-10 font-medium">Chiffre d'Affaires</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers font-medium">
                      {formatCurrency(d.revenue, true)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-muted-foreground">- Coût des Ventes</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-muted-foreground">
                      ({formatCurrency(d.cogs, true)})
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="border-t-2">
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">= Marge Brute</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers font-medium">
                      {formatCurrency(d.grossMargin, true)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-muted-foreground">- Masse Salariale</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-muted-foreground">
                      ({formatCurrency(d.payroll, true)})
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-muted-foreground">- Charges Opérationnelles</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-muted-foreground">
                      ({formatCurrency(d.opex, true)})
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="border-t-2 bg-muted/30">
                  <TableCell className="sticky left-0 bg-muted/30 z-10 font-medium">= EBITDA</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className={cn(
                      "text-right font-mono-numbers font-medium",
                      d.ebitda < 0 && "text-destructive"
                    )}>
                      {formatCurrency(d.ebitda, true)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-muted-foreground">- Amortissements</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-muted-foreground">
                      ({formatCurrency(d.depreciation, true)})
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="border-t-2 bg-primary/5">
                  <TableCell className="sticky left-0 bg-primary/5 z-10 font-bold">= Résultat d'Exploitation</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className={cn(
                      "text-right font-mono-numbers font-bold",
                      d.operatingResult < 0 && "text-destructive"
                    )}>
                      {formatCurrency(d.operatingResult, true)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {/* Tableau Flux de Trésorerie */}
        <SectionCard title="Tableau des Flux de Trésorerie">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Flux</TableHead>
                  {years.map(year => (
                    <TableHead key={year} className="text-right min-w-24">{year}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10">Trésorerie Début</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers">
                      {formatCurrency(d.treasuryStart, true)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell className="sticky left-0 bg-muted/30 z-10 font-medium">+ Encaissements (CA)</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-green-600">
                      +{formatCurrency(d.revenue, true)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-muted-foreground">- Décaissements Exploitation</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-destructive">
                      -{formatCurrency(d.cogs + d.payroll + d.opex, true)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="sticky left-0 bg-background z-10 text-muted-foreground">- Investissements (CAPEX)</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-destructive">
                      {d.capex > 0 ? `-${formatCurrency(d.capex, true)}` : '-'}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="border-t">
                  <TableCell className="sticky left-0 bg-background z-10 font-medium">= Cash Flow Opérationnel</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className={cn(
                      "text-right font-mono-numbers font-medium",
                      d.cashFlow < 0 ? "text-destructive" : "text-green-600"
                    )}>
                      {d.cashFlow >= 0 ? '+' : ''}{formatCurrency(d.cashFlow, true)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="bg-green-50 dark:bg-green-950/20">
                  <TableCell className="sticky left-0 bg-green-50 dark:bg-green-950/20 z-10">+ Levée de Fonds</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className="text-right font-mono-numbers text-green-600">
                      {d.fundingInjection > 0 ? `+${formatCurrency(d.fundingInjection, true)}` : '-'}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow className="border-t-2 bg-primary/5">
                  <TableCell className="sticky left-0 bg-primary/5 z-10 font-bold">= Trésorerie Fin</TableCell>
                  {yearlyData.map((d, i) => (
                    <TableCell key={i} className={cn(
                      "text-right font-mono-numbers font-bold",
                      d.treasuryEnd < 0 && "text-destructive"
                    )}>
                      {formatCurrency(d.treasuryEnd, true)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </SectionCard>
          </>
        )}
      </div>
    </ReadOnlyWrapper>
  );
}
