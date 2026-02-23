import { useFinancial } from '@/context/FinancialContext';
import { HeroBanner } from '@/components/ui/HeroBanner';
import { SectionCard, KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { ExportPDFDialog } from '@/components/summary/ExportPDFDialog';
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

  // ======== SOURCE UNIQUE: treasuryProjection ========
  const { treasuryProjection } = computed;
  const { startYear, durationYears, initialCash } = state.scenarioSettings;
  const lastYear = startYear + durationYears - 1;

  // Montant levé
  const amountRaised = treasuryProjection.totalFundingRaised;
  const startingCash = initialCash + amountRaised;

  // Données directement depuis le moteur unifié
  const projectionData = treasuryProjection.years;

  // KPIs clés depuis le moteur unifié
  const minTreasury = treasuryProjection.minTreasury;
  const breakEvenYear = treasuryProjection.breakEvenYear || 'N/A';
  const hasNegativeTreasury = minTreasury < 0;
  const criticalYear = projectionData.find(t => t.treasuryEnd < 0)?.year;
  
  const avgMonthlyBurn = treasuryProjection.maxBurn / 12;
  const runway = treasuryProjection.runway;

  // Totaux cumulés sur la période (depuis le moteur)
  const totalRevenue = projectionData.reduce((sum, d) => sum + d.revenue, 0);
  const totalPayroll = projectionData.reduce((sum, d) => sum + d.payroll, 0);
  const totalOpex = projectionData.reduce((sum, d) => sum + d.opex, 0);
  const totalCapex = treasuryProjection.totalCapex;
  const totalCogs = projectionData.reduce((sum, d) => sum + d.cogs, 0);
  const totalDepreciation = treasuryProjection.totalDepreciation;
  const totalCosts = totalPayroll + totalOpex + totalCapex + totalCogs;

  // Besoin de financement = max(0, -trésorerie minimale) - PAS la somme des flux négatifs
  const totalNeed = treasuryProjection.fundingNeed;
  const surplus = amountRaised - totalNeed;

  // Données pour le graphique
  const chartData = projectionData.map(d => ({
    year: d.year,
    'Cash Flow': d.cashFlow / 1000,
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
            {state.products.length} produits • {projectionData[projectionData.length - 1]?.headcount || 0} ETP
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
              {projectionData.map((row) => (
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
                    {formatCurrency(row.depreciation, true)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-numbers text-muted-foreground">
                    {formatCurrency(row.capex, true)}
                  </td>
                  <td className={cn(
                    "py-3 px-3 text-right font-mono-numbers font-medium",
                    row.cashFlow >= 0 ? "text-chart-4" : "text-accent"
                  )}>
                    {row.cashFlow >= 0 ? '+' : ''}{formatCurrency(row.cashFlow, true)}
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
                <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalDepreciation, true)}</td>
                <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(totalCapex, true)}</td>
                <td className="py-3 px-3 text-right font-mono-numbers">-</td>
                <td className="py-3 px-3 text-right font-mono-numbers">{formatCurrency(projectionData[projectionData.length - 1]?.treasuryEnd || 0, true)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </SectionCard>

      {/* =============== SECTION 4: DÉTAIL CAPEX PRODUITS =============== */}
      <SectionCard title="Plan d'Investissement CAPEX — Détail par Produit" id="capex-detail">
        {(() => {
          const capexProducts = state.products.filter(p => p.devCost > 0);
          const capexPayments = state.monthlyTreasuryConfig?.capexPayments || [];
          const years = Array.from({ length: durationYears }, (_, i) => startYear + i);
          const MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

          if (capexProducts.length === 0) {
            return (
              <p className="text-center text-muted-foreground py-6">Aucun produit avec coût de développement (CAPEX R&D).</p>
            );
          }

          // Build timeline data per product
          const productTimelines = capexProducts.map(product => {
            const payments = capexPayments.filter(p => p.productId === product.id);
            const totalScheduled = payments.reduce((s, p) => s + p.amount, 0);
            const scheduledPercent = payments.reduce((s, p) => s + p.percentageOfTotal, 0);
            const unscheduled = product.devCost - totalScheduled;
            return { product, payments, totalScheduled, scheduledPercent, unscheduled };
          });

          const grandTotal = capexProducts.reduce((s, p) => s + p.devCost, 0);

          // Aggregate CAPEX by year
          const capexByYear = years.map(year => {
            let total = 0;
            productTimelines.forEach(({ product, payments }) => {
              const yearPayments = payments.filter(p => p.year === year);
              if (yearPayments.length > 0) {
                total += yearPayments.reduce((s, p) => s + p.amount, 0);
              } else if (payments.length === 0 && product.launchYear === year) {
                total += product.devCost;
              }
            });
            return { year, total };
          });

          return (
            <div className="space-y-6">
              {/* Summary bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-muted/50 border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Nb Projets</div>
                  <div className="text-2xl font-bold font-mono-numbers">{capexProducts.length}</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 text-center">
                  <div className="text-xs text-muted-foreground mb-1">Budget Total R&D</div>
                  <div className="text-2xl font-bold font-mono-numbers text-primary">{formatCurrency(grandTotal, true)}</div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Planifié</div>
                  <div className="text-2xl font-bold font-mono-numbers">
                    {formatCurrency(productTimelines.reduce((s, t) => s + t.totalScheduled, 0), true)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border text-center">
                  <div className="text-xs text-muted-foreground mb-1">Non planifié</div>
                  <div className="text-2xl font-bold font-mono-numbers text-muted-foreground">
                    {formatCurrency(productTimelines.reduce((s, t) => s + t.unscheduled, 0), true)}
                  </div>
                </div>
              </div>

              {/* Product detail cards */}
              <div className="space-y-4">
                {productTimelines.map(({ product, payments, totalScheduled, scheduledPercent, unscheduled }) => (
                  <div key={product.id} className="border rounded-lg overflow-hidden">
                    {/* Product header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="font-semibold">{product.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">Lancement {product.launchYear}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold font-mono-numbers">{formatCurrency(product.devCost, true)}</span>
                        <Badge variant={scheduledPercent >= 100 ? 'default' : 'secondary'} className="text-xs">
                          {scheduledPercent.toFixed(0)}% planifié
                        </Badge>
                      </div>
                    </div>

                    {/* Payment schedule */}
                    {payments.length > 0 ? (
                      <div className="px-4 py-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-muted-foreground border-b">
                              <th className="text-left py-2 font-medium">Échéance</th>
                              <th className="text-right py-2 font-medium">% du total</th>
                              <th className="text-right py-2 font-medium">Montant</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments
                              .sort((a, b) => a.year - b.year || a.month - b.month)
                              .map((p, i) => (
                              <tr key={p.id} className="border-b last:border-0">
                                <td className="py-2">
                                  <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    <span className="font-medium">{MONTH_LABELS[p.month]} {p.year}</span>
                                  </div>
                                </td>
                                <td className="py-2 text-right font-mono-numbers">{p.percentageOfTotal}%</td>
                                <td className="py-2 text-right font-mono-numbers font-medium">{formatCurrency(p.amount, true)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t font-semibold text-xs">
                              <td className="py-2">Total planifié</td>
                              <td className="py-2 text-right font-mono-numbers">{scheduledPercent.toFixed(0)}%</td>
                              <td className="py-2 text-right font-mono-numbers">{formatCurrency(totalScheduled, true)}</td>
                            </tr>
                          </tfoot>
                        </table>
                        {/* Progress bar */}
                        <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${Math.min(100, scheduledPercent)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-3 text-sm text-muted-foreground italic">
                        Pas de calendrier défini — CAPEX affecté à l'année de lancement ({product.launchYear})
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* CAPEX par année - tableau récapitulatif */}
              <div>
                <h4 className="font-semibold mb-3 text-sm">Répartition CAPEX par Année</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left py-2 px-3 font-semibold">Année</th>
                        {years.map(y => (
                          <th key={y} className="text-right py-2 px-3 font-semibold">{y}</th>
                        ))}
                        <th className="text-right py-2 px-3 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productTimelines.map(({ product, payments }) => (
                        <tr key={product.id} className="border-b">
                          <td className="py-2 px-3 font-medium">{product.name}</td>
                          {years.map(year => {
                            const yearPayments = payments.filter(p => p.year === year);
                            let amount = 0;
                            if (yearPayments.length > 0) {
                              amount = yearPayments.reduce((s, p) => s + p.amount, 0);
                            } else if (payments.length === 0 && product.launchYear === year) {
                              amount = product.devCost;
                            }
                            return (
                              <td key={year} className={cn(
                                "py-2 px-3 text-right font-mono-numbers",
                                amount > 0 ? "font-medium" : "text-muted-foreground"
                              )}>
                                {amount > 0 ? formatCurrency(amount, true) : '—'}
                              </td>
                            );
                          })}
                          <td className="py-2 px-3 text-right font-mono-numbers font-semibold">
                            {formatCurrency(product.devCost, true)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30 font-semibold">
                        <td className="py-2 px-3">TOTAL</td>
                        {capexByYear.map(({ year, total }) => (
                          <td key={year} className="py-2 px-3 text-right font-mono-numbers">
                            {total > 0 ? formatCurrency(total, true) : '—'}
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-mono-numbers text-primary">
                          {formatCurrency(grandTotal, true)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </SectionCard>

      {/* =============== SECTION 5: VALORISATION =============== */}
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
            value={totalRevenue > 0 ? `${(postMoney / (projectionData[projectionData.length - 1]?.revenue || 1)).toFixed(1)}x` : '-'}
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