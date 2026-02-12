import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/data/financialConfig';
import { MonthlyTreasuryProjection, MonthlyData, aggregateByYear, YearlyAggregatedData } from '@/engine/monthlyTreasuryEngine';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface TreasuryDetailChartProps {
  projection: MonthlyTreasuryProjection;
  startYear: number;
  durationYears: number;
}

type ViewMode = 'annual' | 'full-period';

export function TreasuryDetailChart({ projection, startYear, durationYears }: TreasuryDetailChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('annual');
  const [selectedYear, setSelectedYear] = useState(startYear);

  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  // Annual aggregated data
  const annualData = useMemo(() => {
    const agg = aggregateByYear(projection.months);
    return years.map(year => {
      const d = agg.get(year);
      if (!d) return { label: year.toString(), ca: 0, cogs: 0, payroll: 0, opex: 0, capex: 0, loans: 0, tresorerie: 0, cashFlow: 0 };
      // Get capex from monthly data
      const yearMonths = projection.months.filter(m => m.year === year);
      const capex = yearMonths.reduce((s, m) => s + m.capexPayments, 0);
      const loans = d.loanPayments;
      return {
        label: year.toString(),
        ca: d.revenue / 1000,
        cogs: d.cogs / 1000,
        payroll: d.payroll / 1000,
        opex: d.opex / 1000,
        capex: capex / 1000,
        loans: loans / 1000,
        tresorerie: d.treasuryEnd / 1000,
        cashFlow: d.netCashFlow / 1000,
      };
    });
  }, [projection, years]);

  // Monthly data for selected year
  const monthlyData = useMemo(() => {
    return projection.months
      .filter(m => m.year === selectedYear)
      .map(m => ({
        label: m.monthName.slice(0, 3),
        ca: m.revenue / 1000,
        cogs: m.cogs / 1000,
        payroll: m.payroll / 1000,
        opex: m.opex / 1000,
        capex: m.capexPayments / 1000,
        loans: m.loanPayments / 1000,
        tresorerie: m.treasuryEnd / 1000,
        cashFlow: m.netCashFlow / 1000,
      }));
  }, [projection, selectedYear]);

  const chartData = viewMode === 'annual' ? monthlyData : annualData;

  return (
    <SectionCard
      title="Suivi de Trésorerie Détaillé"
      action={
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={v => setViewMode(v as ViewMode)}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full-period">Toute la période</SelectItem>
              <SelectItem value="annual">Vue annuelle</SelectItem>
            </SelectContent>
          </Select>
          {viewMode === 'annual' && (
            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-8 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      }
    >
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={v => `${v}k€`} />
            <RechartsTooltip formatter={(value: number) => `${value.toFixed(0)}k€`} />
            <Legend />
            <Bar dataKey="cogs" name="Achats matière" stackId="costs" fill="hsl(38, 92%, 50%)" />
            <Bar dataKey="payroll" name="Masse salariale" stackId="costs" fill="hsl(210, 70%, 50%)" />
            <Bar dataKey="opex" name="OPEX" stackId="costs" fill="hsl(280, 60%, 50%)" />
            <Bar dataKey="capex" name="CAPEX" stackId="costs" fill="hsl(0, 0%, 45%)" />
            <Bar dataKey="loans" name="Échéances prêts" stackId="costs" fill="hsl(0, 85%, 50%)" />
            <Line type="monotone" dataKey="tresorerie" name="Trésorerie" stroke="hsl(150, 60%, 40%)" strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
