import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
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

interface SeriesConfig {
  key: string;
  name: string;
  color: string;
  type: 'bar' | 'line';
  defaultVisible: boolean;
}

const SERIES: SeriesConfig[] = [
  { key: 'ca', name: 'CA', color: 'hsl(150, 60%, 40%)', type: 'bar', defaultVisible: false },
  { key: 'cogs', name: 'Achats matière', color: 'hsl(38, 92%, 50%)', type: 'bar', defaultVisible: true },
  { key: 'payroll', name: 'Masse salariale', color: 'hsl(210, 70%, 50%)', type: 'bar', defaultVisible: true },
  { key: 'opex', name: 'OPEX', color: 'hsl(280, 60%, 50%)', type: 'bar', defaultVisible: true },
  { key: 'capex', name: 'CAPEX', color: 'hsl(0, 0%, 45%)', type: 'bar', defaultVisible: true },
  { key: 'loans', name: 'Échéances prêts', color: 'hsl(0, 85%, 50%)', type: 'bar', defaultVisible: true },
  { key: 'tresorerie', name: 'Trésorerie', color: 'hsl(150, 60%, 40%)', type: 'line', defaultVisible: true },
  { key: 'cashFlow', name: 'Cash Flow', color: 'hsl(210, 90%, 55%)', type: 'line', defaultVisible: false },
];

export function TreasuryDetailChart({ projection, startYear, durationYears }: TreasuryDetailChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('annual');
  const [selectedYear, setSelectedYear] = useState(startYear);
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(() => {
    return new Set(SERIES.filter(s => s.defaultVisible).map(s => s.key));
  });

  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  const toggleSeries = (key: string) => {
    setVisibleSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Annual aggregated data
  const annualData = useMemo(() => {
    const agg = aggregateByYear(projection.months);
    return years.map(year => {
      const d = agg.get(year);
      if (!d) return { label: year.toString(), ca: 0, cogs: 0, payroll: 0, opex: 0, capex: 0, loans: 0, tresorerie: 0, cashFlow: 0 };
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

  const barSeries = SERIES.filter(s => s.type === 'bar' && visibleSeries.has(s.key));
  const lineSeries = SERIES.filter(s => s.type === 'line' && visibleSeries.has(s.key));

  return (
    <SectionCard
      title="Suivi de Trésorerie Détaillé"
      action={
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-3.5 w-3.5 mr-1" />
                Séries
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="end">
              <p className="text-xs font-medium mb-2">Séries affichées</p>
              <div className="space-y-2">
                {SERIES.map(s => (
                  <div key={s.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`series-${s.key}`}
                      checked={visibleSeries.has(s.key)}
                      onCheckedChange={() => toggleSeries(s.key)}
                    />
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <Label htmlFor={`series-${s.key}`} className="text-xs cursor-pointer">
                      {s.name}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
            {barSeries.map(s => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="costs" fill={s.color} />
            ))}
            {lineSeries.map(s => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={3} dot={{ r: 4 }} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
