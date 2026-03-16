import { useMemo } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { formatCurrency } from '@/data/financialConfig';
import type { HistoricalYearData } from './EditableHistoricalFinancials';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts';

interface Props {
  data: HistoricalYearData[];
}

// Reproduce calculation functions from EditableHistoricalFinancials
const totalRevenue = (d: HistoricalYearData) =>
  (d.salesB2B || 0) + (d.salesB2C || 0) + (d.salesOEM || 0) || d.revenue;

const totalCOGS = (d: HistoricalYearData) =>
  (d.stockVariation || 0) + (d.purchasesGoods || 0) + (d.transportCosts || 0);

const margeCommerciale = (d: HistoricalYearData) =>
  totalRevenue(d) - totalCOGS(d);

const productionBrute = (d: HistoricalYearData) =>
  (d.productionExercice || 0) - (d.rawMaterials || 0) - (d.subcontracting || 0);

const margeBruteGlobale = (d: HistoricalYearData) =>
  margeCommerciale(d) + productionBrute(d);

const valeurAjoutee = (d: HistoricalYearData) =>
  margeBruteGlobale(d) - (d.otherPurchases || d.externalCosts || 0);

const ebe = (d: HistoricalYearData) =>
  valeurAjoutee(d) + (d.operatingSubsidies || 0) - (d.taxesAndDuties || 0) - d.payroll;

const resultatExploitation = (d: HistoricalYearData) =>
  ebe(d) + (d.otherOperatingIncome || 0) - (d.otherOperatingExpenses || 0) - d.depreciation;

const resultatCourant = (d: HistoricalYearData) =>
  resultatExploitation(d) + (d.financialIncome || 0) - (d.financialExpenses || 0);

const resultatExceptionnel = (d: HistoricalYearData) =>
  (d.exceptionalIncome || 0) - (d.exceptionalExpenses || 0);

const resultatNet = (d: HistoricalYearData) =>
  resultatCourant(d) + resultatExceptionnel(d) - (d.employeeParticipation || 0) - (d.corporateTax || 0);

const COLORS = {
  ca: 'hsl(var(--primary))',
  margeBrute: 'hsl(150, 60%, 40%)',
  ebe: 'hsl(38, 92%, 50%)',
  rex: 'hsl(210, 70%, 50%)',
  resultatNet: 'hsl(280, 60%, 50%)',
};

export function HistoricalSummaryChart({ data }: Props) {
  const chartData = useMemo(() => {
    return data.map(d => {
      const ca = totalRevenue(d);
      return {
        year: d.year,
        ca: ca / 1000,
        margeBrute: margeBruteGlobale(d) / 1000,
        ebe: ebe(d) / 1000,
        rex: resultatExploitation(d) / 1000,
        resultatNet: resultatNet(d) / 1000,
        margeEBE: ca > 0 ? (ebe(d) / ca) * 100 : 0,
        margeNette: ca > 0 ? (resultatNet(d) / ca) * 100 : 0,
      };
    });
  }, [data]);

  const kpis = useMemo(() => {
    if (data.length === 0) return null;
    const last = data[data.length - 1];
    const prev = data.length > 1 ? data[data.length - 2] : null;
    const ca = totalRevenue(last);
    const prevCA = prev ? totalRevenue(prev) : 0;
    const growth = prevCA > 0 ? ((ca - prevCA) / prevCA) * 100 : 0;
    const ebeVal = ebe(last);
    const netVal = resultatNet(last);
    return {
      year: last.year,
      ca,
      growth,
      ebe: ebeVal,
      margeEBE: ca > 0 ? (ebeVal / ca) * 100 : 0,
      resultatNet: netVal,
      margeNette: ca > 0 ? (netVal / ca) * 100 : 0,
    };
  }, [data]);

  if (data.length === 0) return null;

  return (
    <SectionCard title="Synthèse Graphique — Historique Financier">
      {/* KPI summary cards */}
      {kpis && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CA {kpis.year}</p>
            <p className="text-lg font-bold font-mono-numbers">{formatCurrency(kpis.ca, true)}</p>
            {kpis.growth !== 0 && (
              <p className={`text-xs font-mono-numbers ${kpis.growth > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {kpis.growth > 0 ? '+' : ''}{kpis.growth.toFixed(1)}% vs N-1
              </p>
            )}
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">EBE {kpis.year}</p>
            <p className="text-lg font-bold font-mono-numbers">{formatCurrency(kpis.ebe, true)}</p>
            <p className="text-xs font-mono-numbers text-muted-foreground">Marge {kpis.margeEBE.toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Résultat Net {kpis.year}</p>
            <p className={`text-lg font-bold font-mono-numbers ${kpis.resultatNet < 0 ? 'text-destructive' : ''}`}>
              {formatCurrency(kpis.resultatNet, true)}
            </p>
            <p className="text-xs font-mono-numbers text-muted-foreground">Marge {kpis.margeNette.toFixed(1)}%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Exercices</p>
            <p className="text-lg font-bold">{data.length}</p>
            <p className="text-xs text-muted-foreground">{data[0].year}–{data[data.length - 1].year}</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Marge Brute {kpis.year}</p>
            <p className="text-lg font-bold font-mono-numbers">{formatCurrency(margeBruteGlobale(data[data.length - 1]), true)}</p>
            <p className="text-xs font-mono-numbers text-muted-foreground">
              {kpis.ca > 0 ? `${(margeBruteGlobale(data[data.length - 1]) / kpis.ca * 100).toFixed(1)}%` : '-'}
            </p>
          </div>
        </div>
      )}

      {/* Main chart: bars for CA + lines for margins */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="year" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `${v}k€`} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'Marge EBE %' || name === 'Marge Nette %') return `${value.toFixed(1)}%`;
                return `${value.toFixed(0)}k€`;
              }}
              contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid hsl(var(--border))' }}
            />
            <Legend wrapperStyle={{ fontSize: '11px' }} />
            <Bar dataKey="ca" name="CA" fill={COLORS.ca} radius={[4, 4, 0, 0]} opacity={0.25} />
            <Bar dataKey="margeBrute" name="Marge Brute" fill={COLORS.margeBrute} radius={[4, 4, 0, 0]} opacity={0.4} />
            <Line type="monotone" dataKey="ebe" name="EBE" stroke={COLORS.ebe} strokeWidth={2.5} dot={{ r: 4 }} />
            <Line type="monotone" dataKey="rex" name="REX" stroke={COLORS.rex} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" />
            <Line type="monotone" dataKey="resultatNet" name="Résultat Net" stroke={COLORS.resultatNet} strokeWidth={2.5} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue breakdown by channel (small stacked bar) */}
      {data.some(d => (d.salesB2B || 0) + (d.salesB2C || 0) + (d.salesOEM || 0) > 0) && (
        <div className="mt-6">
          <p className="text-sm font-medium mb-2 text-muted-foreground">Répartition CA par canal</p>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.map(d => ({
                year: d.year,
                B2C: (d.salesB2C || 0) / 1000,
                B2B: (d.salesB2B || 0) / 1000,
                OEM: (d.salesOEM || 0) / 1000,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${v}k€`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v.toFixed(0)}k€`} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="B2C" stackId="a" fill="hsl(0, 72%, 51%)" radius={[0, 0, 0, 0]} />
                <Bar dataKey="B2B" stackId="a" fill={COLORS.ca} />
                <Bar dataKey="OEM" stackId="a" fill={COLORS.ebe} radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
