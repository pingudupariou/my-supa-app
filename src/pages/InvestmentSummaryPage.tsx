import { useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { ExportPDFDialog } from '@/components/summary/ExportPDFDialog';
import { aggregateByYear } from '@/engine/monthlyTreasuryEngine';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Package,
  Building2,
  Target,
  PiggyBank,
  Calendar,
} from 'lucide-react';

const scenarioLabels = {
  conservative: 'Prudent',
  base: 'Base',
  ambitious: 'Ambitieux',
};

export function InvestmentSummaryPage() {
  const { state, computed } = useFinancial();

  // ======== SOURCE UNIQUE: monthlyTreasuryProjection (moteur mensuel unifié) ========
  const { monthlyTreasuryProjection } = computed;
  const { startYear, durationYears, initialCash } = state.scenarioSettings;
  const lastYear = startYear + durationYears - 1;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  // Agréger par année — MÊME source que Financement et Prévisionnel
  const yearlyData = useMemo(() => {
    const aggregated = aggregateByYear(monthlyTreasuryProjection.months);
    return years.map(year => {
      const data = aggregated.get(year);
      if (!data) return {
        year, revenue: 0, cogs: 0, grossMargin: 0, payroll: 0, opex: 0,
        variableCharges: 0, loanPayments: 0, fundingInjection: 0,
        netCashFlow: 0, treasuryStart: 0, treasuryEnd: 0, ebitda: 0,
        capex: 0,
      };
      // Calcul du CAPEX annuel depuis les données mensuelles
      const yearMonths = monthlyTreasuryProjection.months.filter(m => m.year === year);
      const capex = yearMonths.reduce((sum, m) => sum + m.capexPayments, 0);
      return { ...data, capex };
    });
  }, [monthlyTreasuryProjection, years]);

  // Montant levé — depuis le moteur unifié
  const amountRaised = monthlyTreasuryProjection.totalFundingRaised;
  const startingCash = initialCash + amountRaised;

  // KPIs clés depuis le moteur unifié
  const minTreasury = monthlyTreasuryProjection.minTreasury;
  const breakEvenYear = monthlyTreasuryProjection.breakEvenMonth?.year || 'N/A';
  const hasNegativeTreasury = minTreasury < 0;
  const criticalYear = yearlyData.find(t => t.treasuryEnd < 0)?.year;

  // Burn rate: max monthly outflow
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

  // Totaux cumulés sur la période
  const totalRevenue = yearlyData.reduce((sum, d) => sum + d.revenue, 0);
  const totalPayroll = yearlyData.reduce((sum, d) => sum + d.payroll, 0);
  const totalOpex = yearlyData.reduce((sum, d) => sum + d.opex, 0);
  const totalCapex = monthlyTreasuryProjection.totalCapexPayments;
  const totalCogs = yearlyData.reduce((sum, d) => sum + d.cogs, 0);
  const totalCosts = totalPayroll + totalOpex + totalCapex + totalCogs;

  // Besoin de financement = max(0, -trésorerie minimale)
  const totalNeed = Math.max(0, -minTreasury);
  const surplus = amountRaised - totalNeed;

  // Données pour le graphique
  const chartData = yearlyData.map(d => ({
    year: d.year,
    'Cash Flow': d.netCashFlow / 1000,
    'Trésorerie': d.treasuryEnd / 1000,
  }));

  // Dernier round
  const latestRound = state.fundingRounds[state.fundingRounds.length - 1];
  const postMoney = latestRound 
    ? latestRound.preMoneyValuation + latestRound.amount 
    : 0;
  const dilution = latestRound 
    ? latestRound.amount / postMoney 
    : 0;
  return (
    <div className="space-y-6">
      <HeroBanner
        image="ccd-evo"
        title="Synthèse Investisseur"
        subtitle="Vue consolidée du projet - Approche Cash"
        height="sm"
      />

      {/* Header avec contexte */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="default">
            {scenarioLabels[state.activeScenarioId]}
          </Badge>
          <Badge variant={state.revenueMode === 'by-product' ? 'outline' : 'secondary'} className="text-xs">
            CA: {state.revenueMode === 'by-product' ? 'Par Produit' : 'Global Canaux'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {startYear} → {lastYear} ({durationYears} ans)
          </Badge>
          <Badge variant="secondary" className="text-xs gap-1">
            <Calendar className="h-3 w-3" />
            {state.products.length} produits
          </Badge>
        </div>
        <ExportPDFDialog />
      </div>

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

      {/* =============== SECTION 1: APPROCHE CASH =============== */}
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
            <div className="text-xs text-muted-foreground">
              {state.fundingRounds.length} tour(s)
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              Tréso Départ
            </div>
            <div className="text-2xl font-bold font-mono-numbers">
              {formatCurrency(startingCash, true)}
            </div>
          </div>
          
          <div className={cn(
            "p-4 rounded-lg border",
            minTreasury < 0 ? "bg-destructive/10 border-destructive/30" : "bg-muted/50"
          )}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              {minTreasury < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              Point Bas
            </div>
            <div className={cn(
              "text-2xl font-bold font-mono-numbers",
              minTreasury < 0 && "text-destructive"
            )}>
              {formatCurrency(minTreasury, true)}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-muted/50 border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              Break-even
            </div>
            <div className="text-2xl font-bold font-mono-numbers">
              {breakEvenYear}
            </div>
            <div className="text-xs text-muted-foreground">
              Runway: {runway > 60 ? '60+' : runway} mois
            </div>
          </div>
        </div>

        {/* Graphique Cash Flow & Trésorerie */}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(v) => `${v}k€`} />
              <Tooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
              <Legend />
              <Bar 
                dataKey="Cash Flow" 
                fill="hsl(var(--accent))" 
              />
              <Line 
                type="monotone" 
                dataKey="Trésorerie" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      {/* =============== SECTION 2: JUSTIFICATION DES BESOINS =============== */}
      <SectionCard title="Justification des Besoins" id="needs-justification">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Gauche: Répartition des coûts */}
          <div>
            <h4 className="font-semibold mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Répartition des Coûts ({startYear}-{lastYear})
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
                      <div 
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
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

          {/* Droite: Besoin vs Financement */}
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
                <div className="text-2xl font-bold font-mono-numbers">
                  {formatCurrency(totalNeed, true)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Somme des cash-flows négatifs sur la période
                </p>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm">Montant Levé</span>
                  <Badge variant="default">{latestRound?.name || 'Round'}</Badge>
                </div>
                <div className="text-2xl font-bold font-mono-numbers text-primary">
                  {formatCurrency(amountRaised, true)}
                </div>
              </div>

              <div className={cn(
                "p-4 rounded-lg border-2",
                surplus >= 0 
                  ? "bg-chart-4/10 border-chart-4/30" 
                  : "bg-destructive/10 border-destructive/30"
              )}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {surplus >= 0 ? 'Marge de Sécurité' : 'Déficit'}
                  </span>
                  <span className={cn(
                    "text-xl font-bold font-mono-numbers",
                    surplus >= 0 ? "text-chart-4" : "text-destructive"
                  )}>
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
      </SectionCard>

      {/* =============== SECTION 3: TABLEAU DÉTAILLÉ =============== */}
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
                <tr key={row.year} className={cn(
                  "border-b hover:bg-muted/20",
                  row.treasuryEnd < 0 && "bg-destructive/5"
                )}>
                  <td className="py-3 px-3 font-semibold">{row.year}</td>
                  <td className="py-3 px-3 text-right font-mono-numbers">
                    {formatCurrency(row.revenue, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">
                    {formatCurrency(row.cogs, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers">
                    {formatCurrency(row.grossMargin, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">
                    {formatCurrency(row.payroll, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">
                    {formatCurrency(row.opex, true)}
                  </td>
                  <td className={cn(
                    "py-3 px-3 text-right font-mono-numbers font-medium",
                    row.ebitda >= 0 ? "text-chart-4" : "text-destructive"
                  )}>
                    {formatCurrency(row.ebitda, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">
                    -
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">
                    {formatCurrency(row.capex, true)}
                  </td>
                  <td className={cn(
                    "py-3 px-3 text-right font-mono-numbers font-medium",
                    row.netCashFlow >= 0 ? "text-chart-4" : "text-accent"
                  )}>
                    {row.netCashFlow >= 0 ? '+' : ''}{formatCurrency(row.netCashFlow, true)}
                  </td>
                  <td className={cn(
                    "py-3 px-3 text-right font-mono-numbers font-bold",
                    row.treasuryEnd < 0 && "text-destructive"
                  )}>
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

      {/* =============== SECTION 4: VALORISATION =============== */}
      <SectionCard title="Valorisation & Tours" id="valuation">
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <KPICard
            label="Pre-Money"
            value={formatCurrency(latestRound?.preMoneyValuation || 0, true)}
            subValue={latestRound?.name || '-'}
          />
          <KPICard
            label="Post-Money"
            value={formatCurrency(postMoney, true)}
            subValue="Après levée"
          />
          <KPICard
            label="Dilution"
            value={formatPercent(dilution)}
            subValue="Part cédée"
            trend={dilution > 0.25 ? 'down' : undefined}
          />
          <KPICard
            label="Multiple CA"
            value={totalRevenue > 0 ? `${(postMoney / (yearlyData[yearlyData.length - 1]?.revenue || 1)).toFixed(1)}x` : '-'}
            subValue={`sur CA ${lastYear}`}
          />
        </div>

        {/* Tours de table */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {state.fundingRounds.map(round => (
            <div key={round.id} className="p-4 bg-muted/30 rounded-lg border">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h5 className="font-semibold">{round.name}</h5>
                  <Badge variant="outline" className="text-xs mt-1">{round.year}</Badge>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold font-mono-numbers text-primary">
                    {formatCurrency(round.amount, true)}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <span>Pre-money:</span>
                  <span className="font-mono-numbers ml-1">{formatCurrency(round.preMoneyValuation, true)}</span>
                </div>
                <div className="text-right">
                  <span>Dilution:</span>
                  <span className="font-mono-numbers ml-1">
                    {formatPercent(round.amount / (round.preMoneyValuation + round.amount))}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}