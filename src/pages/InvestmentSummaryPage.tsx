import { useMemo, useState } from 'react';
import { useFinancial, RevenueMode } from '@/context/FinancialContext';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { ExportPDFDialog } from '@/components/summary/ExportPDFDialog';
import { ProductRoadmap } from '@/components/product/ProductRoadmap';
import { aggregateByYear } from '@/engine/monthlyTreasuryEngine';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Area, AreaChart, PieChart, Pie, Cell,
} from 'recharts';
import { 
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Users, Package,
  Building2, Target, PiggyBank, Calendar, Settings2, Briefcase, UserPlus,
  BarChart3, LineChart as LineChartIcon,
} from 'lucide-react';
import { Department } from '@/engine/types';

// ===== PALETTE HAUTE DISTINCTION pour graphiques multi-séries =====
const CHART_COLORS = [
  '#e11d48', // Rose/Rouge racing
  '#2563eb', // Bleu vif
  '#16a34a', // Vert émeraude
  '#f59e0b', // Ambre/Or
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ea580c', // Orange brûlé
  '#64748b', // Gris ardoise
  '#d946ef', // Fuchsia
  '#0d9488', // Teal
];

const scenarioLabels = {
  conservative: 'Prudent',
  base: 'Base',
  ambitious: 'Ambitieux',
};

const revenueModeLabels: Record<RevenueMode, string> = {
  'by-product': 'Par Produit',
  'by-channel-global': 'Global Canaux',
  'by-client': 'Par Client',
};

type SectionKey = 'cash' | 'needs' | 'projection' | 'valuation' | 'clientDeck' | 'payroll' | 'evolution' | 'roadmap';

const defaultSections: Record<SectionKey, boolean> = {
  cash: true,
  clientDeck: true,
  evolution: true,
  needs: true,
  payroll: true,
  projection: true,
  roadmap: true,
  valuation: true,
};

const sectionLabels: Record<SectionKey, string> = {
  cash: 'Approche Cash',
  clientDeck: 'Deck CA Clients',
  evolution: 'Graphiques d\'Évolution',
  needs: 'Justification des Besoins',
  payroll: 'Masse Salariale',
  projection: 'Projection Détaillée',
  roadmap: 'Roadmap Produit',
  valuation: 'Valorisation & Tours',
};

export function InvestmentSummaryPage() {
  const { state, computed, setRevenueMode } = useFinancial();
  const [visibleSections, setVisibleSections] = useState(defaultSections);
  const [showSectionSettings, setShowSectionSettings] = useState(false);

  const toggleSection = (key: SectionKey) => {
    setVisibleSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ======== SOURCE UNIQUE: monthlyTreasuryProjection (moteur mensuel unifié) ========
  const { monthlyTreasuryProjection } = computed;
  const { startYear, durationYears, initialCash } = state.scenarioSettings;
  const lastYear = startYear + durationYears - 1;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  // Agréger par année
  const yearlyData = useMemo(() => {
    const aggregated = aggregateByYear(monthlyTreasuryProjection.months);
    return years.map(year => {
      const data = aggregated.get(year);
      if (!data) return {
        year, revenue: 0, cogs: 0, grossMargin: 0, payroll: 0, opex: 0,
        variableCharges: 0, loanPayments: 0, fundingInjection: 0,
        netCashFlow: 0, treasuryStart: 0, treasuryEnd: 0, ebitda: 0, capex: 0,
      };
      const yearMonths = monthlyTreasuryProjection.months.filter(m => m.year === year);
      const capex = yearMonths.reduce((sum, m) => sum + m.capexPayments, 0);
      return { ...data, capex };
    });
  }, [monthlyTreasuryProjection, years]);

  const amountRaised = monthlyTreasuryProjection.totalFundingRaised;
  const startingCash = initialCash + amountRaised;
  const minTreasury = monthlyTreasuryProjection.minTreasury;
  const breakEvenYear = monthlyTreasuryProjection.breakEvenMonth?.year || 'N/A';
  const hasNegativeTreasury = minTreasury < 0;
  const criticalYear = yearlyData.find(t => t.treasuryEnd < 0)?.year;

  const maxMonthlyBurn = useMemo(() => {
    const negativeMonths = monthlyTreasuryProjection.months.filter(m => m.netCashFlow < 0);
    if (negativeMonths.length === 0) return 0;
    return Math.max(...negativeMonths.map(m => Math.abs(m.netCashFlow)));
  }, [monthlyTreasuryProjection]);

  const avgMonthlyBurn = useMemo(() => {
    const negativeMonths = monthlyTreasuryProjection.months.filter(m => m.netCashFlow < 0);
    if (negativeMonths.length === 0) return 0;
    return negativeMonths.reduce((sum, m) => sum + Math.abs(m.netCashFlow), 0) / negativeMonths.length;
  }, [monthlyTreasuryProjection]);

  const runway = avgMonthlyBurn > 0 ? Math.round(startingCash / avgMonthlyBurn) : 99;

  const totalRevenue = yearlyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalPayroll = yearlyData.reduce((sum, d) => sum + d.payroll, 0);
  const totalOpex = yearlyData.reduce((sum, d) => sum + d.opex, 0);
  const totalCapex = monthlyTreasuryProjection.totalCapexPayments;
  const totalCogs = yearlyData.reduce((sum, d) => sum + d.cogs, 0);
  const totalCosts = totalPayroll + totalOpex + totalCapex + totalCogs;

  const totalNeed = Math.max(0, -minTreasury);
  const surplus = amountRaised - totalNeed;

  const chartData = yearlyData.map(d => ({
    year: d.year,
    'Cash Flow': d.netCashFlow / 1000,
    'Trésorerie': d.treasuryEnd / 1000,
  }));

  const latestRound = state.fundingRounds[state.fundingRounds.length - 1];
  const postMoney = latestRound ? latestRound.preMoneyValuation + latestRound.amount : 0;
  const dilution = latestRound ? latestRound.amount / postMoney : 0;

  // ===== Evolution chart data =====
  const evolutionChartData = useMemo(() => yearlyData.map(d => ({
    year: d.year,
    'CA': d.revenue / 1000,
    'Marge Brute': d.grossMargin / 1000,
    'EBITDA': d.ebitda / 1000,
    'Trésorerie': d.treasuryEnd / 1000,
    'COGS': d.cogs / 1000,
    'Masse Sal.': d.payroll / 1000,
    'OPEX': d.opex / 1000,
  })), [yearlyData]);

  // Pie chart data for cost breakdown
  const pieData = useMemo(() => [
    { name: 'Masse Salariale', value: totalPayroll, color: CHART_COLORS[1] },
    { name: 'COGS', value: totalCogs, color: CHART_COLORS[3] },
    { name: 'OPEX', value: totalOpex, color: CHART_COLORS[4] },
    { name: 'CAPEX', value: totalCapex, color: CHART_COLORS[0] },
  ].filter(d => d.value > 0), [totalPayroll, totalCogs, totalOpex, totalCapex]);

  // Client revenue deck data
  const clientDeckData = useMemo(() => {
    if (state.revenueMode !== 'by-client') return null;
    const cfg = state.clientRevenueConfig;
    if (!cfg?.entries?.length) return null;

    const getRevenue = (e: typeof cfg.entries[0], year: number) => {
      if (e.revenueByYear[year] !== undefined) return e.revenueByYear[year];
      const rate = e.individualGrowthRate ?? cfg.growthRate;
      const baseYear = years[0];
      const diff = year - baseYear + 1; // baseRevenue = CA N-1, growth applies from year 1
      return e.baseRevenue * Math.pow(1 + rate, diff);
    };

    const getMarginRate = (e: typeof cfg.entries[0]) => {
      if (e.channel === 'B2C') return cfg.marginB2C ?? cfg.marginRate;
      if (e.categoryId && cfg.marginByCategory?.[e.categoryId] !== undefined)
        return cfg.marginByCategory[e.categoryId];
      return cfg.marginRate;
    };

    const channels = ['B2C', 'B2B', 'OEM'] as const;
    const channelData = channels.map(ch => {
      const entries = cfg.entries.filter(e => e.channel === ch);
      return {
        channel: ch,
        count: entries.length,
        revenueByYear: years.map(y => entries.reduce((s, e) => s + getRevenue(e, y), 0)),
        totalRevenue: years.reduce((s, y) => s + entries.reduce((s2, e) => s2 + getRevenue(e, y), 0), 0),
      };
    }).filter(c => c.count > 0);

    const clientTotals = cfg.entries.map(e => ({
      name: e.clientName,
      channel: e.channel,
      category: e.categoryName || 'Sans catégorie',
      marginRate: getMarginRate(e),
      total: years.reduce((s, y) => s + getRevenue(e, y), 0),
      revenueByYear: years.map(y => getRevenue(e, y)),
    })).sort((a, b) => b.total - a.total);

    const stackedChartData = years.map((y, yi) => {
      const row: Record<string, any> = { year: y };
      channelData.forEach(c => { row[c.channel] = c.revenueByYear[yi] / 1000; });
      return row;
    });

    return { channelData, clientTotals, stackedChartData };
  }, [state.revenueMode, state.clientRevenueConfig, years]);

  const channelColors: Record<string, string> = {
    B2C: CHART_COLORS[0],
    B2B: CHART_COLORS[1],
    OEM: CHART_COLORS[3],
  };

  // ===== Animated number helper =====
  const BigKPI = ({ label, value, sub, icon: Icon, accent, className }: {
    label: string; value: string; sub?: string; icon: any; accent?: string; className?: string;
  }) => (
    <div className={cn("relative overflow-hidden p-5 rounded-xl border-2 transition-all hover:shadow-lg", className)}>
      <div className="absolute top-3 right-3 opacity-10">
        <Icon className="h-12 w-12" />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Icon className="h-4 w-4" style={accent ? { color: accent } : undefined} />
        {label}
      </div>
      <div className="text-3xl font-bold font-mono-numbers tracking-tight" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-6">
      <HeroBanner
        image="ccd-evo"
        title="Synthèse Investisseur"
        subtitle="Vue consolidée du projet - Approche Cash"
        height="sm"
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default">{scenarioLabels[state.activeScenarioId]}</Badge>
          <Select value={state.revenueMode} onValueChange={(v) => setRevenueMode(v as RevenueMode)}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="by-product">Par Produit</SelectItem>
              <SelectItem value="by-channel-global">Global Canaux</SelectItem>
              <SelectItem value="by-client">Par Client</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="text-xs">{startYear} → {lastYear} ({durationYears} ans)</Badge>
          <Badge variant="secondary" className="text-xs gap-1">
            <Calendar className="h-3 w-3" />{state.products.length} produits
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowSectionSettings(!showSectionSettings)} className="gap-1">
            <Settings2 className="h-4 w-4" />Sections
          </Button>
          <ExportPDFDialog />
        </div>
      </div>

      {/* Section toggles */}
      {showSectionSettings && (
        <div className="p-4 bg-muted/30 border rounded-lg">
          <h4 className="text-sm font-semibold mb-3">Afficher / Masquer les sections du rapport</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(Object.keys(sectionLabels) as SectionKey[]).map(key => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch checked={visibleSections[key]} onCheckedChange={() => toggleSection(key)} />
                <span className={cn(!visibleSections[key] && 'text-muted-foreground line-through')}>{sectionLabels[key]}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ALERTE TRÉSORERIE */}
      {hasNegativeTreasury && (
        <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0" />
          <div>
            <span className="font-semibold text-destructive">Alerte : Trésorerie Négative</span>
            <p className="text-sm text-muted-foreground">
              Solde prévu négatif en {criticalYear}. Point bas: {formatCurrency(minTreasury, true)}. 
              Financement additionnel de {formatCurrency(Math.abs(minTreasury), true)} requis.
            </p>
          </div>
        </div>
      )}

      {/* =============== SECTION: APPROCHE CASH =============== */}
      {visibleSections.cash && (
        <SectionCard title="Approche Cash" id="cash-approach">
          <div className="grid md:grid-cols-5 gap-4 mb-6">
            <BigKPI label="Cash Initial (T0)" value={formatCurrency(initialCash, true)} icon={Wallet} className="bg-muted/30" />
            <BigKPI label="Montant Levé" value={formatCurrency(amountRaised, true)} sub={`${state.fundingRounds.length} tour(s)`} icon={PiggyBank} accent={CHART_COLORS[1]} className="bg-blue-500/5 border-blue-500/20" />
            <BigKPI label="Tréso Départ" value={formatCurrency(startingCash, true)} icon={Target} accent={CHART_COLORS[2]} className="bg-emerald-500/5 border-emerald-500/20" />
            <BigKPI 
              label="Point Bas" 
              value={formatCurrency(minTreasury, true)} 
              icon={minTreasury < 0 ? TrendingDown : TrendingUp}
              accent={minTreasury < 0 ? CHART_COLORS[0] : CHART_COLORS[2]}
              className={minTreasury < 0 ? "bg-destructive/5 border-destructive/30" : "bg-muted/30"}
            />
            <BigKPI label="Break-even" value={String(breakEvenYear)} sub={`Runway: ${runway > 60 ? '60+' : runway} mois`} icon={Calendar} className="bg-muted/30" />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Cash Flow & Treasury chart */}
            <div className="h-72">
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Cash Flow & Trésorerie
              </h4>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" />
                  <YAxis tickFormatter={(v) => `${v}k€`} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                  <Legend />
                  <Bar dataKey="Cash Flow" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Trésorerie" stroke={CHART_COLORS[1]} strokeWidth={3} dot={{ r: 5, fill: CHART_COLORS[1] }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Burn rate metrics */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                Métriques de Burn
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-muted/30 border">
                  <div className="text-xs text-muted-foreground mb-1">Burn Max / mois</div>
                  <div className="text-xl font-bold font-mono-numbers text-destructive">{formatCurrency(maxMonthlyBurn, true)}</div>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border">
                  <div className="text-xs text-muted-foreground mb-1">Burn Moyen / mois</div>
                  <div className="text-xl font-bold font-mono-numbers text-amber-500">{formatCurrency(avgMonthlyBurn, true)}</div>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border">
                  <div className="text-xs text-muted-foreground mb-1">CA Total Période</div>
                  <div className="text-xl font-bold font-mono-numbers" style={{ color: CHART_COLORS[2] }}>{formatCurrency(totalRevenue, true)}</div>
                </div>
                <div className="p-4 rounded-xl bg-muted/30 border">
                  <div className="text-xs text-muted-foreground mb-1">Coûts Totaux</div>
                  <div className="text-xl font-bold font-mono-numbers">{formatCurrency(totalCosts, true)}</div>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* =============== SECTION: GRAPHIQUES D'ÉVOLUTION =============== */}
      {visibleSections.evolution && (
        <SectionCard title="Graphiques d'Évolution" id="evolution-charts">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Revenue & Margin evolution */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <LineChartIcon className="h-4 w-4" style={{ color: CHART_COLORS[0] }} />
                Évolution CA, Marge & EBITDA
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionChartData}>
                    <defs>
                      <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradMargin" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[2]} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `${v}k€`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                    <Legend />
                    <Area type="monotone" dataKey="CA" stroke={CHART_COLORS[0]} fill="url(#gradCA)" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Area type="monotone" dataKey="Marge Brute" stroke={CHART_COLORS[2]} fill="url(#gradMargin)" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="EBITDA" stroke={CHART_COLORS[4]} strokeWidth={2.5} dot={{ r: 4 }} strokeDasharray="6 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Costs stacked bar */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" style={{ color: CHART_COLORS[1] }} />
                Répartition des Coûts par Année
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={evolutionChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `${v}k€`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                    <Legend />
                    <Bar dataKey="COGS" stackId="costs" fill={CHART_COLORS[3]} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Masse Sal." stackId="costs" fill={CHART_COLORS[1]} />
                    <Bar dataKey="OPEX" stackId="costs" fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Treasury monthly evolution */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4" style={{ color: CHART_COLORS[5] }} />
                Trésorerie Mensuelle
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyTreasuryProjection.months.map(m => ({
                    label: `${m.month}/${m.year}`,
                    Trésorerie: m.treasuryEnd / 1000,
                  }))}>
                    <defs>
                      <linearGradient id="gradTreso" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS[5]} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={CHART_COLORS[5]} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tickFormatter={(v) => `${v}k€`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                    <Area type="monotone" dataKey="Trésorerie" stroke={CHART_COLORS[5]} fill="url(#gradTreso)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Cost breakdown pie */}
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" />
                Répartition des Coûts (Période)
              </h4>
              <div className="h-64 flex items-center">
                <ResponsiveContainer width="50%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value, true)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {pieData.map(item => {
                    const pct = totalCosts > 0 ? (item.value / totalCosts) * 100 : 0;
                    return (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% — {formatCurrency(item.value, true)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* =============== SECTION: DECK CA CLIENTS =============== */}
      {visibleSections.clientDeck && (
        <SectionCard title="Deck — Chiffre d'Affaires" id="client-deck">
          {state.revenueMode === 'by-client' && clientDeckData ? (
            <div className="space-y-6">
              {/* Channel summary cards */}
              <div className="grid md:grid-cols-3 gap-4">
                {clientDeckData.channelData.map(ch => (
                  <div key={ch.channel} className="p-5 rounded-xl border-2" style={{ borderColor: channelColors[ch.channel] + '40', background: channelColors[ch.channel] + '08' }}>
                    <div className="flex items-center justify-between mb-2">
                      <Badge style={{ backgroundColor: channelColors[ch.channel], color: 'white' }}>{ch.channel}</Badge>
                      <span className="text-xs text-muted-foreground">{ch.count} client(s)</span>
                    </div>
                    <div className="text-2xl font-bold font-mono-numbers mb-1">
                      {formatCurrency(ch.totalRevenue, true)}
                    </div>
                    <div className="text-xs text-muted-foreground">CA cumulé {startYear}–{lastYear}</div>
                    <div className="flex gap-2 mt-3">
                      {ch.revenueByYear.map((r, i) => (
                        <div key={years[i]} className="text-center flex-1">
                          <div className="text-[10px] text-muted-foreground">{years[i]}</div>
                          <div className="text-xs font-mono-numbers font-medium">{(r / 1000).toFixed(0)}k</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Stacked bar chart */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={clientDeckData.stackedChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `${v}k€`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                    <Legend />
                    {clientDeckData.channelData.map(ch => (
                      <Bar key={ch.channel} dataKey={ch.channel} stackId="a" fill={channelColors[ch.channel]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top clients table */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Top Clients</h4>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-3 font-semibold text-xs">Client</th>
                        <th className="text-left py-2 px-3 font-semibold text-xs">Canal</th>
                        <th className="text-left py-2 px-3 font-semibold text-xs">Catégorie</th>
                        <th className="text-right py-2 px-3 font-semibold text-xs">Marge</th>
                        {years.map(y => (
                          <th key={y} className="text-right py-2 px-3 font-semibold text-xs">{y}</th>
                        ))}
                        <th className="text-right py-2 px-3 font-semibold text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientDeckData.clientTotals.slice(0, 15).map((c, i) => (
                        <tr key={i} className="border-b hover:bg-muted/20 text-xs">
                          <td className="py-2 px-3 font-medium">{c.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-[10px]" style={{ borderColor: channelColors[c.channel] }}>
                              {c.channel}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{c.category}</td>
                          <td className="py-2 px-3 text-right font-mono-numbers">{(c.marginRate * 100).toFixed(0)}%</td>
                          {c.revenueByYear.map((r, yi) => (
                            <td key={years[yi]} className="py-2 px-3 text-right font-mono-numbers">
                              {formatCurrency(r, true)}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right font-mono-numbers font-semibold">
                            {formatCurrency(c.total, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">
                {state.revenueMode === 'by-client'
                  ? 'Aucun client configuré — ajoutez des entrées dans le Plan Produit'
                  : `Mode actuel : ${revenueModeLabels[state.revenueMode]}`}
              </p>
              <p className="text-sm mt-1">
                Passez en mode « Par Client » pour afficher le deck CA détaillé par client.
              </p>
            </div>
          )}
        </SectionCard>
      )}

      {/* =============== SECTION: JUSTIFICATION DES BESOINS =============== */}
      {visibleSections.needs && (
        <SectionCard title="Justification des Besoins" id="needs-justification">
          <div className="grid lg:grid-cols-2 gap-6 mb-6">
            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Répartition Globale ({startYear}-{lastYear})
              </h4>
              <div className="space-y-3">
                {[
                  { label: 'Masse Salariale', value: totalPayroll, icon: Users, color: CHART_COLORS[1] },
                  { label: 'COGS (Coût des ventes)', value: totalCogs, icon: Package, color: CHART_COLORS[3] },
                  { label: 'OPEX (Charges)', value: totalOpex, icon: Building2, color: CHART_COLORS[4] },
                  { label: 'CAPEX (R&D)', value: totalCapex, icon: Target, color: CHART_COLORS[0] },
                ].map(item => {
                  const Icon = item.icon;
                  const pct = totalCosts > 0 ? (item.value / totalCosts) * 100 : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between items-center mb-1">
                        <div className="flex items-center gap-2 text-sm">
                          <Icon className="h-4 w-4" style={{ color: item.color }} />
                          <span>{item.label}</span>
                        </div>
                        <span className="font-mono-numbers font-medium">{formatCurrency(item.value, true)}</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                      </div>
                      <div className="text-xs text-muted-foreground text-right">{pct.toFixed(0)}%</div>
                    </div>
                  );
                })}
                <div className="pt-3 border-t flex justify-between font-semibold">
                  <span>Total Coûts</span>
                  <span className="font-mono-numbers">{formatCurrency(totalCosts, true)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <PiggyBank className="h-4 w-4" />
                Adéquation Besoin / Financement
              </h4>
              <div className="space-y-4">
                <div className="p-5 bg-muted/30 rounded-xl border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Besoin de Financement</span>
                    <Badge variant="secondary">Calculé</Badge>
                  </div>
                  <div className="text-3xl font-bold font-mono-numbers">{formatCurrency(totalNeed, true)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Somme des cash-flows négatifs sur la période</p>
                </div>
                <div className="p-5 rounded-xl border-2" style={{ background: CHART_COLORS[1] + '08', borderColor: CHART_COLORS[1] + '30' }}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Montant Levé</span>
                    <Badge variant="default">{latestRound?.name || 'Round'}</Badge>
                  </div>
                  <div className="text-3xl font-bold font-mono-numbers" style={{ color: CHART_COLORS[1] }}>{formatCurrency(amountRaised, true)}</div>
                </div>
                <div className={cn(
                  "p-5 rounded-xl border-2",
                  surplus >= 0 ? "border-emerald-500/30 bg-emerald-500/5" : "bg-destructive/10 border-destructive/30"
                )}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{surplus >= 0 ? 'Marge de Sécurité' : 'Déficit'}</span>
                    <span className={cn("text-2xl font-bold font-mono-numbers", surplus >= 0 ? "text-emerald-600" : "text-destructive")}>
                      {surplus >= 0 ? '+' : ''}{formatCurrency(surplus, true)}
                    </span>
                  </div>
                  {surplus >= 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Buffer de {formatPercent(surplus / amountRaised)} sur le montant levé
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Yearly cost breakdown table */}
          <div className="mt-6">
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4" />
              Détail Année par Année
            </h4>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-2 px-3 font-semibold text-xs">Année</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">CA</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">COGS</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">Masse Sal.</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">OPEX</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">CAPEX</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">Total Coûts</th>
                    <th className="text-right py-2 px-3 font-semibold text-xs">Cash Flow</th>
                  </tr>
                </thead>
                <tbody>
                  {yearlyData.map(row => {
                    const yearCosts = row.cogs + row.payroll + row.opex + row.capex;
                    return (
                      <tr key={row.year} className="border-b hover:bg-muted/20 text-xs">
                        <td className="py-2 px-3 font-semibold">{row.year}</td>
                        <td className="py-2 px-3 text-right font-mono-numbers">{formatCurrency(row.revenue, true)}</td>
                        <td className="py-2 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.cogs, true)}</td>
                        <td className="py-2 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.payroll, true)}</td>
                        <td className="py-2 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.opex, true)}</td>
                        <td className="py-2 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.capex, true)}</td>
                        <td className="py-2 px-3 text-right font-mono-numbers font-medium">{formatCurrency(yearCosts, true)}</td>
                        <td className={cn("py-2 px-3 text-right font-mono-numbers font-medium", row.netCashFlow >= 0 ? "text-emerald-600" : "text-destructive")}>
                          {row.netCashFlow >= 0 ? '+' : ''}{formatCurrency(row.netCashFlow, true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Strategic OPEX detail */}
          {state.opexMode === 'simple' && (state.simpleOpexConfig.strategicOpex || []).length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4" />
                OPEX Stratégiques (inclus dans le budget)
              </h4>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-3 font-semibold text-xs">Poste</th>
                      <th className="text-right py-2 px-3 font-semibold text-xs">Montant Base</th>
                      {years.map(y => (
                        <th key={y} className="text-right py-2 px-3 font-semibold text-xs">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(state.simpleOpexConfig.strategicOpex || []).map(line => (
                      <tr key={line.id} className="border-b hover:bg-muted/20 text-xs">
                        <td className="py-2 px-3 font-medium">{line.name}</td>
                        <td className="py-2 px-3 text-right font-mono-numbers">{formatCurrency(line.amount, true)}</td>
                        {years.map((y, i) => (
                          <td key={y} className="py-2 px-3 text-right font-mono-numbers text-muted-foreground">
                            {formatCurrency(line.amount * Math.pow(1 + state.simpleOpexConfig.growthRate, i), true)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    <tr className="bg-muted/20 font-medium text-xs">
                      <td className="py-2 px-3">Total Stratégique</td>
                      <td className="py-2 px-3 text-right font-mono-numbers">
                        {formatCurrency((state.simpleOpexConfig.strategicOpex || []).reduce((s, l) => s + l.amount, 0), true)}
                      </td>
                      {years.map((y, i) => {
                        const total = (state.simpleOpexConfig.strategicOpex || []).reduce((s, l) => s + l.amount, 0);
                        return (
                          <td key={y} className="py-2 px-3 text-right font-mono-numbers">
                            {formatCurrency(total * Math.pow(1 + state.simpleOpexConfig.growthRate, i), true)}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* =============== SECTION: MASSE SALARIALE =============== */}
      {visibleSections.payroll && (
        <SectionCard title="Masse Salariale & Embauches" id="payroll-detail">
          {(() => {
            const roles = state.roles || [];
            const deptColorMap: Record<string, string> = {
              'R&D': CHART_COLORS[0],
              'Production': CHART_COLORS[2],
              'Sales': CHART_COLORS[3],
              'Support': CHART_COLORS[5],
              'Admin': CHART_COLORS[1],
            };

            const payrollByYearDept = years.map(year => {
              const activeRoles = roles.filter(r => r.startYear <= year);
              const byDept: Record<string, number> = {};
              activeRoles.forEach(r => {
                byDept[r.department] = (byDept[r.department] || 0) + r.annualCostLoaded;
              });
              return { year, total: activeRoles.reduce((s, r) => s + r.annualCostLoaded, 0), byDept, headcount: activeRoles.length };
            });

            const hiresByYear = years.map(year => ({
              year,
              hires: roles.filter(r => r.startYear === year),
            }));

            const depts = [...new Set(roles.map(r => r.department))];
            const payrollChartData = payrollByYearDept.map(d => {
              const row: Record<string, any> = { year: d.year, Effectif: d.headcount };
              depts.forEach(dept => { row[dept] = (d.byDept[dept] || 0) / 1000; });
              return row;
            });

            return (
              <div className="space-y-6">
                <div className="grid md:grid-cols-4 gap-4">
                  <BigKPI label="Effectif Final" value={String(payrollByYearDept[payrollByYearDept.length - 1]?.headcount || 0)} sub={`en ${lastYear}`} icon={Users} accent={CHART_COLORS[1]} className="bg-blue-500/5 border-blue-500/20" />
                  <BigKPI label="Masse Sal. Finale" value={formatCurrency(payrollByYearDept[payrollByYearDept.length - 1]?.total || 0, true)} sub={`/an en ${lastYear}`} icon={Wallet} accent={CHART_COLORS[0]} className="bg-rose-500/5 border-rose-500/20" />
                  <BigKPI label="Coût Total Période" value={formatCurrency(totalPayroll, true)} sub={`${startYear}–${lastYear}`} icon={Building2} className="bg-muted/30" />
                  <BigKPI label="Coût Moyen / ETP" value={roles.length > 0 ? formatCurrency(totalPayroll / durationYears / (roles.length || 1), true) : '—'} sub="/an moyen" icon={Target} className="bg-muted/30" />
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={payrollChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" />
                      <YAxis yAxisId="left" tickFormatter={(v) => `${v}k€`} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip formatter={(value: number, name: string) => name === 'Effectif' ? value : `${value.toFixed(0)}k€`} />
                      <Legend />
                      {depts.map((dept, idx) => (
                        <Bar key={dept} yAxisId="left" dataKey={dept} stackId="a" fill={deptColorMap[dept] || CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                      <Line yAxisId="right" type="monotone" dataKey="Effectif" stroke="hsl(var(--foreground))" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Hiring timeline */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                    <UserPlus className="h-4 w-4" />
                    Planning des Embauches
                  </h4>
                  <div className="space-y-4">
                    {hiresByYear.filter(h => h.hires.length > 0).map(({ year, hires }) => (
                      <div key={year}>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs">{year}</Badge>
                          <span className="text-xs text-muted-foreground">{hires.length} embauche(s)</span>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {hires.map(role => (
                            <div key={role.id} className="p-3 bg-muted/30 rounded-lg border flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium">{role.title}</div>
                                <div className="flex items-center gap-1 mt-1">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deptColorMap[role.department] || CHART_COLORS[0] }} />
                                  <span className="text-[10px] text-muted-foreground">{role.department}</span>
                                </div>
                              </div>
                              <div className="text-sm font-mono-numbers font-semibold">
                                {formatCurrency(role.annualCostLoaded, true)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {hiresByYear.every(h => h.hires.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">Aucun poste configuré — rendez-vous dans l'onglet Organisation</p>
                    )}
                  </div>
                </div>

                {/* Summary table */}
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-3 font-semibold">Poste</th>
                        <th className="text-left py-2 px-3 font-semibold">Département</th>
                        <th className="text-right py-2 px-3 font-semibold">Arrivée</th>
                        <th className="text-right py-2 px-3 font-semibold">Coût chargé /an</th>
                        {years.map(y => (
                          <th key={y} className="text-center py-2 px-3 font-semibold">{y}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {roles.sort((a, b) => a.startYear - b.startYear || a.department.localeCompare(b.department)).map(role => (
                        <tr key={role.id} className="border-b hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium">{role.title}</td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deptColorMap[role.department] || CHART_COLORS[0] }} />
                              {role.department}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono-numbers">{role.startYear}</td>
                          <td className="py-2 px-3 text-right font-mono-numbers">{formatCurrency(role.annualCostLoaded, true)}</td>
                          {years.map(y => (
                            <td key={y} className="py-2 px-3 text-center">
                              {role.startYear <= y ? (
                                <span className="inline-block w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] leading-4">✓</span>
                              ) : (
                                <span className="text-muted-foreground/30">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30 font-semibold text-xs">
                        <td className="py-2 px-3" colSpan={3}>Total</td>
                        <td className="py-2 px-3 text-right font-mono-numbers">—</td>
                        {payrollByYearDept.map(d => (
                          <td key={d.year} className="py-2 px-3 text-center font-mono-numbers">
                            {(d.total / 1000).toFixed(0)}k
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </SectionCard>
      )}

      {/* =============== SECTION: TABLEAU DÉTAILLÉ =============== */}
      {visibleSections.projection && (
        <SectionCard title="Projection Détaillée" id="detailed-projection">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left py-3 px-3 font-semibold">Année</th>
                  <th className="text-right py-3 px-3 font-semibold">CA</th>
                  <th className="text-right py-3 px-3 font-semibold">COGS</th>
                  <th className="text-right py-3 px-3 font-semibold">Marge Brute</th>
                  <th className="text-right py-3 px-3 font-semibold">Masse Sal.</th>
                  <th className="text-right py-3 px-3 font-semibold">OPEX</th>
                  <th className="text-right py-3 px-3 font-semibold">EBITDA</th>
                  <th className="text-right py-3 px-3 font-semibold">Amort.</th>
                  <th className="text-right py-3 px-3 font-semibold">CAPEX</th>
                  <th className="text-right py-3 px-3 font-semibold">Cash Flow</th>
                  <th className="text-right py-3 px-3 font-semibold">Trésorerie</th>
                </tr>
              </thead>
              <tbody>
                {yearlyData.map((row) => (
                  <tr key={row.year} className={cn("border-b hover:bg-muted/20", row.treasuryEnd < 0 && "bg-destructive/5")}>
                    <td className="py-3 px-3 font-semibold">{row.year}</td>
                    <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(row.revenue, true)}</td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.cogs, true)}</td>
                    <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(row.grossMargin, true)}</td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.payroll, true)}</td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.opex, true)}</td>
                    <td className={cn("py-3 px-3 text-right font-mono-numbers font-medium", row.ebitda >= 0 ? "text-emerald-600" : "text-destructive")}>
                      {formatCurrency(row.ebitda, true)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">-</td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.capex, true)}</td>
                    <td className={cn("py-3 px-3 text-right font-mono-numbers font-medium", row.netCashFlow >= 0 ? "text-emerald-600" : "text-destructive")}>
                      {row.netCashFlow >= 0 ? '+' : ''}{formatCurrency(row.netCashFlow, true)}
                    </td>
                    <td className={cn("py-3 px-3 text-right font-mono-numbers font-bold", row.treasuryEnd < 0 && "text-destructive")}>
                      {formatCurrency(row.treasuryEnd, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/30 font-semibold">
                  <td className="py-3 px-3">TOTAL</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalRevenue, true)}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalCogs, true)}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalRevenue - totalCogs, true)}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalPayroll, true)}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalOpex, true)}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">-</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">-</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalCapex, true)}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">-</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(yearlyData[yearlyData.length - 1]?.treasuryEnd || 0, true)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </SectionCard>
      )}

      {/* =============== SECTION: ROADMAP PRODUIT =============== */}
      {visibleSections.roadmap && (
        <ProductRoadmap
          products={state.products}
          years={years}
          persistedBlocks={state.roadmapBlocks}
          readOnly
        />
      )}

      {/* =============== SECTION: VALORISATION =============== */}
      {visibleSections.valuation && (
        <SectionCard title="Valorisation & Tours" id="valuation">
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <BigKPI label="Pre-Money" value={formatCurrency(latestRound?.preMoneyValuation || 0, true)} sub={latestRound?.name || '-'} icon={Target} accent={CHART_COLORS[4]} className="bg-violet-500/5 border-violet-500/20" />
            <BigKPI label="Post-Money" value={formatCurrency(postMoney, true)} sub="Après levée" icon={PiggyBank} accent={CHART_COLORS[1]} className="bg-blue-500/5 border-blue-500/20" />
            <BigKPI label="Dilution" value={formatPercent(dilution)} sub="Part cédée" icon={TrendingDown} accent={dilution > 0.25 ? CHART_COLORS[0] : CHART_COLORS[2]} className={dilution > 0.25 ? "bg-rose-500/5 border-rose-500/20" : "bg-emerald-500/5 border-emerald-500/20"} />
            <BigKPI
              label="Multiple CA"
              value={totalRevenue > 0 ? `${(postMoney / (yearlyData[yearlyData.length - 1]?.revenue || 1)).toFixed(1)}x` : '-'}
              sub={`sur CA ${lastYear}`}
              icon={TrendingUp}
              className="bg-muted/30"
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.fundingRounds.map((round, idx) => (
              <div key={round.id} className="p-5 rounded-xl border-2 transition-all hover:shadow-md" style={{ borderColor: CHART_COLORS[idx % CHART_COLORS.length] + '30' }}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-semibold">{round.name}</h5>
                    <Badge variant="outline" className="text-xs mt-1">{round.year}</Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono-numbers" style={{ color: CHART_COLORS[idx % CHART_COLORS.length] }}>{formatCurrency(round.amount, true)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span>Pre-money:</span>
                    <span className="font-mono-numbers ml-1">{formatCurrency(round.preMoneyValuation, true)}</span>
                  </div>
                  <div className="text-right">
                    <span>Dilution:</span>
                    <span className="font-mono-numbers ml-1">{formatPercent(round.amount / (round.preMoneyValuation + round.amount))}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
