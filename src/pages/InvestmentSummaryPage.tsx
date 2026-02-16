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
import { aggregateByYear } from '@/engine/monthlyTreasuryEngine';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart,
} from 'recharts';
import { 
  Wallet, TrendingUp, TrendingDown, AlertTriangle, Users, Package,
  Building2, Target, PiggyBank, Calendar, Settings2, Briefcase, UserPlus,
} from 'lucide-react';
import { Department } from '@/engine/types';

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

type SectionKey = 'cash' | 'needs' | 'projection' | 'valuation' | 'clientDeck' | 'payroll';

const defaultSections: Record<SectionKey, boolean> = {
  cash: true,
  clientDeck: true,
  needs: true,
  payroll: true,
  projection: true,
  valuation: true,
};

const sectionLabels: Record<SectionKey, string> = {
  cash: 'Approche Cash',
  clientDeck: 'Deck CA Clients',
  needs: 'Justification des Besoins',
  payroll: 'Masse Salariale',
  projection: 'Projection Détaillée',
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

  // Client revenue deck data
  const clientDeckData = useMemo(() => {
    if (state.revenueMode !== 'by-client') return null;
    const cfg = state.clientRevenueConfig;
    if (!cfg?.entries?.length) return null;

    const getRevenue = (e: typeof cfg.entries[0], year: number) => {
      if (e.revenueByYear[year] !== undefined) return e.revenueByYear[year];
      const rate = e.individualGrowthRate ?? cfg.growthRate;
      const baseYear = years[0];
      const diff = year - baseYear;
      if (diff <= 0) return e.baseRevenue;
      return e.baseRevenue * Math.pow(1 + rate, diff);
    };

    const getMarginRate = (e: typeof cfg.entries[0]) => {
      if (e.channel === 'B2C') return cfg.marginB2C ?? cfg.marginRate;
      if (e.categoryId && cfg.marginByCategory?.[e.categoryId] !== undefined)
        return cfg.marginByCategory[e.categoryId];
      return cfg.marginRate;
    };

    // By channel
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

    // Top clients
    const clientTotals = cfg.entries.map(e => ({
      name: e.clientName,
      channel: e.channel,
      category: e.categoryName || 'Sans catégorie',
      marginRate: getMarginRate(e),
      total: years.reduce((s, y) => s + getRevenue(e, y), 0),
      revenueByYear: years.map(y => getRevenue(e, y)),
    })).sort((a, b) => b.total - a.total);

    // Chart data for stacked bar
    const stackedChartData = years.map((y, yi) => {
      const row: Record<string, any> = { year: y };
      channelData.forEach(c => { row[c.channel] = c.revenueByYear[yi] / 1000; });
      return row;
    });

    return { channelData, clientTotals, stackedChartData };
  }, [state.revenueMode, state.clientRevenueConfig, years]);

  const channelColors: Record<string, string> = {
    B2C: '#e11d48',    // Rouge racing (rose-600)
    B2B: 'hsl(var(--primary))',
    OEM: '#f59e0b',    // Amber-500
  };

  return (
    <div className="space-y-6">
      <HeroBanner
        image="ccd-evo"
        title="Synthèse Investisseur"
        subtitle="Vue consolidée du projet - Approche Cash"
        height="sm"
      />

      {/* Header avec contexte + mode selector + section toggles */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default">
            {scenarioLabels[state.activeScenarioId]}
          </Badge>

          {/* Revenue mode selector */}
          <Select value={state.revenueMode} onValueChange={(v) => setRevenueMode(v as RevenueMode)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="by-product">Par Produit</SelectItem>
              <SelectItem value="by-channel-global">Global Canaux</SelectItem>
              <SelectItem value="by-client">Par Client</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="outline" className="text-xs">
            {startYear} → {lastYear} ({durationYears} ans)
          </Badge>
          <Badge variant="secondary" className="text-xs gap-1">
            <Calendar className="h-3 w-3" />
            {state.products.length} produits
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSectionSettings(!showSectionSettings)}
            className="gap-1"
          >
            <Settings2 className="h-4 w-4" />
            Sections
          </Button>
          <ExportPDFDialog />
        </div>
      </div>

      {/* Section visibility toggles */}
      {showSectionSettings && (
        <div className="p-4 bg-muted/30 border rounded-lg">
          <h4 className="text-sm font-semibold mb-3">Afficher / Masquer les sections du rapport</h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.keys(sectionLabels) as SectionKey[]).map(key => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={visibleSections[key]}
                  onCheckedChange={() => toggleSection(key)}
                />
                <span className={cn(!visibleSections[key] && 'text-muted-foreground line-through')}>
                  {sectionLabels[key]}
                </span>
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
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Wallet className="h-4 w-4" />
                Cash Initial (T0)
              </div>
              <div className="text-2xl font-bold font-mono-numbers">
                {formatCurrency(initialCash, true)}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <PiggyBank className="h-4 w-4" />
                Montant Levé
              </div>
              <div className="text-2xl font-bold font-mono-numbers text-primary">
                {formatCurrency(amountRaised, true)}
              </div>
              <div className="text-xs text-muted-foreground">{state.fundingRounds.length} tour(s)</div>
            </div>
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Target className="h-4 w-4" />
                Tréso Départ
              </div>
              <div className="text-2xl font-bold font-mono-numbers">{formatCurrency(startingCash, true)}</div>
            </div>
            <div className={cn("p-4 rounded-lg border", minTreasury < 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted/50")}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                {minTreasury < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                Point Bas
              </div>
              <div className={cn("text-2xl font-bold font-mono-numbers", minTreasury < 0 && "text-destructive")}>
                {formatCurrency(minTreasury, true)}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                Break-even
              </div>
              <div className="text-2xl font-bold font-mono-numbers">{breakEvenYear}</div>
              <div className="text-xs text-muted-foreground">Runway: {runway > 60 ? '60+' : runway} mois</div>
            </div>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${v}k€`} />
                <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                <Legend />
                <Bar dataKey="Cash Flow" fill="hsl(var(--accent))" />
                <Line type="monotone" dataKey="Trésorerie" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="year" />
                    <YAxis tickFormatter={(v) => `${v}k€`} />
                    <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
                    <Legend />
                    {clientDeckData.channelData.map(ch => (
                      <Bar key={ch.channel} dataKey={ch.channel} stackId="a" fill={channelColors[ch.channel]} />
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
                  { label: 'Masse Salariale', value: totalPayroll, icon: Users, color: 'hsl(var(--primary))' },
                  { label: 'COGS (Coût des ventes)', value: totalCogs, icon: Package, color: 'hsl(var(--chart-4))' },
                  { label: 'OPEX (Charges)', value: totalOpex, icon: Building2, color: 'hsl(var(--accent))' },
                  { label: 'CAPEX (R&D)', value: totalCapex, icon: Target, color: 'hsl(var(--chart-1))' },
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
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
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
                <div className="p-4 bg-muted/30 rounded-lg border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Besoin de Financement</span>
                    <Badge variant="secondary">Calculé</Badge>
                  </div>
                  <div className="text-2xl font-bold font-mono-numbers">{formatCurrency(totalNeed, true)}</div>
                  <p className="text-xs text-muted-foreground mt-1">Somme des cash-flows négatifs sur la période</p>
                </div>
                <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm">Montant Levé</span>
                    <Badge variant="default">{latestRound?.name || 'Round'}</Badge>
                  </div>
                  <div className="text-2xl font-bold font-mono-numbers text-primary">{formatCurrency(amountRaised, true)}</div>
                </div>
                <div className={cn(
                  "p-4 rounded-lg border-2",
                  surplus >= 0 ? "bg-chart-4/10 border-chart-4/30" : "bg-destructive/10 border-destructive/30"
                )}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{surplus >= 0 ? 'Marge de Sécurité' : 'Déficit'}</span>
                    <span className={cn("text-xl font-bold font-mono-numbers", surplus >= 0 ? "text-chart-4" : "text-destructive")}>
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
                        <td className={cn("py-2 px-3 text-right font-mono-numbers font-medium", row.netCashFlow >= 0 ? "text-chart-4" : "text-destructive")}>
                          {row.netCashFlow >= 0 ? '+' : ''}{formatCurrency(row.netCashFlow, true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </SectionCard>
      )}

      {/* =============== SECTION: MASSE SALARIALE =============== */}
      {visibleSections.payroll && (
        <SectionCard title="Masse Salariale & Embauches" id="payroll-detail">
          {(() => {
            const roles = state.roles || [];
            const deptColors: Record<string, string> = {
              'R&D': 'hsl(var(--chart-1))',
              'Production': 'hsl(var(--chart-4))',
              'Sales': 'hsl(var(--accent))',
              'Support': 'hsl(var(--chart-3))',
              'Admin': 'hsl(var(--primary))',
            };

            // Payroll by year and department
            const payrollByYearDept = years.map(year => {
              const activeRoles = roles.filter(r => r.startYear <= year);
              const byDept: Record<string, number> = {};
              activeRoles.forEach(r => {
                byDept[r.department] = (byDept[r.department] || 0) + r.annualCostLoaded;
              });
              return { year, total: activeRoles.reduce((s, r) => s + r.annualCostLoaded, 0), byDept, headcount: activeRoles.length };
            });

            // New hires by year
            const hiresByYear = years.map(year => ({
              year,
              hires: roles.filter(r => r.startYear === year),
            }));

            // Chart data
            const depts = [...new Set(roles.map(r => r.department))];
            const payrollChartData = payrollByYearDept.map(d => {
              const row: Record<string, any> = { year: d.year, Effectif: d.headcount };
              depts.forEach(dept => { row[dept] = (d.byDept[dept] || 0) / 1000; });
              return row;
            });

            return (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid md:grid-cols-4 gap-4">
                  <KPICard label="Effectif Final" value={payrollByYearDept[payrollByYearDept.length - 1]?.headcount || 0} subValue={`en ${lastYear}`} />
                  <KPICard label="Masse Sal. Finale" value={formatCurrency(payrollByYearDept[payrollByYearDept.length - 1]?.total || 0, true)} subValue={`/an en ${lastYear}`} />
                  <KPICard label="Coût Total Période" value={formatCurrency(totalPayroll, true)} subValue={`${startYear}–${lastYear}`} />
                  <KPICard label="Coût Moyen / ETP" value={roles.length > 0 ? formatCurrency(totalPayroll / durationYears / (roles.length || 1), true) : '—'} subValue="/an moyen" />
                </div>

                {/* Stacked bar chart payroll by dept */}
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={payrollChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis yAxisId="left" tickFormatter={(v) => `${v}k€`} />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip formatter={(value: number, name: string) => name === 'Effectif' ? value : `${value.toFixed(0)}k€`} />
                      <Legend />
                      {depts.map(dept => (
                        <Bar key={dept} yAxisId="left" dataKey={dept} stackId="a" fill={deptColors[dept] || 'hsl(var(--muted-foreground))'} />
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
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deptColors[role.department] || 'hsl(var(--muted-foreground))' }} />
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
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: deptColors[role.department] || 'hsl(var(--muted-foreground))' }} />
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
                    <td className={cn("py-3 px-3 text-right font-mono-numbers font-medium", row.ebitda >= 0 ? "text-chart-4" : "text-destructive")}>
                      {formatCurrency(row.ebitda, true)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">-</td>
                    <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">{formatCurrency(row.capex, true)}</td>
                    <td className={cn("py-3 px-3 text-right font-mono-numbers font-medium", row.netCashFlow >= 0 ? "text-chart-4" : "text-accent")}>
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

      {/* =============== SECTION: VALORISATION =============== */}
      {visibleSections.valuation && (
        <SectionCard title="Valorisation & Tours" id="valuation">
          <div className="grid md:grid-cols-4 gap-4 mb-6">
            <KPICard label="Pre-Money" value={formatCurrency(latestRound?.preMoneyValuation || 0, true)} subValue={latestRound?.name || '-'} />
            <KPICard label="Post-Money" value={formatCurrency(postMoney, true)} subValue="Après levée" />
            <KPICard label="Dilution" value={formatPercent(dilution)} subValue="Part cédée" trend={dilution > 0.25 ? 'down' : undefined} />
            <KPICard
              label="Multiple CA"
              value={totalRevenue > 0 ? `${(postMoney / (yearlyData[yearlyData.length - 1]?.revenue || 1)).toFixed(1)}x` : '-'}
              subValue={`sur CA ${lastYear}`}
            />
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {state.fundingRounds.map(round => (
              <div key={round.id} className="p-4 bg-muted/30 rounded-lg border">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h5 className="font-semibold">{round.name}</h5>
                    <Badge variant="outline" className="text-xs mt-1">{round.year}</Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold font-mono-numbers text-primary">{formatCurrency(round.amount, true)}</div>
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
