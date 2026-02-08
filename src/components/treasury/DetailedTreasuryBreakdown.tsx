import { useState, useMemo } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { MonthlyTreasuryProjection, aggregateByYear, MONTHS } from '@/engine/monthlyTreasuryEngine';

interface DetailedBreakdownProps {
  projection: MonthlyTreasuryProjection;
  startYear: number;
  durationYears: number;
}

type BreakdownView = 'annual' | 'monthly';

export function DetailedTreasuryBreakdown({ projection, startYear, durationYears }: DetailedBreakdownProps) {
  const [view, setView] = useState<BreakdownView>('annual');
  const [selectedYear, setSelectedYear] = useState(startYear);

  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  const annualAgg = useMemo(() => aggregateByYear(projection.months), [projection]);

  const monthlyForYear = useMemo(
    () => projection.months.filter(m => m.year === selectedYear),
    [projection, selectedYear]
  );

  const renderRow = (label: string, values: number[], className?: string, isNeg?: boolean) => (
    <TableRow className={className}>
      <TableCell className="sticky left-0 bg-background z-10 font-medium">{label}</TableCell>
      {values.map((v, i) => (
        <TableCell key={i} className={cn('text-right font-mono-numbers', isNeg && v > 0 && 'text-destructive')}>
          {isNeg && v > 0 ? `(${formatCurrency(v, true)})` : formatCurrency(v, true)}
        </TableCell>
      ))}
    </TableRow>
  );

  if (view === 'monthly') {
    const months = monthlyForYear;
    return (
      <SectionCard
        title="Détail Prévisionnel"
        action={
          <div className="flex gap-2">
            <Select value={view} onValueChange={v => setView(v as BreakdownView)}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="annual">Par année</SelectItem>
                <SelectItem value="monthly">Par mois</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">Poste</TableHead>
                {months.map(m => <TableHead key={m.month} className="text-right min-w-20">{MONTHS[m.month].slice(0, 3)}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {renderRow('CA (encaissements)', months.map(m => m.revenue), 'bg-muted/30')}
              {renderRow('Achats matière (COGS)', months.map(m => m.cogs), '', true)}
              {renderRow('Masse salariale', months.map(m => m.payroll), '', true)}
              {renderRow('OPEX', months.map(m => m.opex), '', true)}
              {renderRow('Charges variables', months.map(m => m.variableCharges), '', true)}
              {renderRow('Échéances prêts', months.map(m => m.loanPayments), '', true)}
              {renderRow('CAPEX produits', months.map(m => m.capexPayments), '', true)}
              <TableRow className="border-t-2">
                <TableCell className="sticky left-0 bg-background z-10 font-bold">Cash Flow Net</TableCell>
                {months.map((m, i) => (
                  <TableCell key={i} className={cn('text-right font-mono-numbers font-bold', m.netCashFlow < 0 ? 'text-destructive' : 'text-green-600')}>
                    {m.netCashFlow >= 0 ? '+' : ''}{formatCurrency(m.netCashFlow, true)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="bg-primary/5">
                <TableCell className="sticky left-0 bg-primary/5 z-10 font-bold">Trésorerie Fin</TableCell>
                {months.map((m, i) => (
                  <TableCell key={i} className={cn('text-right font-mono-numbers font-bold', m.treasuryEnd < 0 && 'text-destructive')}>
                    {formatCurrency(m.treasuryEnd, true)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    );
  }

  // Annual view
  return (
    <SectionCard
      title="Détail Prévisionnel"
      action={
        <Select value={view} onValueChange={v => setView(v as BreakdownView)}>
          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="annual">Par année</SelectItem>
            <SelectItem value="monthly">Par mois</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10">Poste</TableHead>
              {years.map(y => <TableHead key={y} className="text-right min-w-24">{y}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderRow('CA (encaissements)', years.map(y => annualAgg.get(y)?.revenue || 0), 'bg-muted/30')}
            {renderRow('Achats matière (COGS)', years.map(y => annualAgg.get(y)?.cogs || 0), '', true)}
            {renderRow('Masse salariale', years.map(y => annualAgg.get(y)?.payroll || 0), '', true)}
            {renderRow('OPEX', years.map(y => annualAgg.get(y)?.opex || 0), '', true)}
            {renderRow('Charges variables', years.map(y => annualAgg.get(y)?.variableCharges || 0), '', true)}
            {renderRow('Échéances prêts', years.map(y => annualAgg.get(y)?.loanPayments || 0), '', true)}
            {renderRow('CAPEX produits', years.map(y => {
              const ym = projection.months.filter(m => m.year === y);
              return ym.reduce((s, m) => s + m.capexPayments, 0);
            }), '', true)}
            {renderRow('Levées de fonds', years.map(y => annualAgg.get(y)?.fundingInjection || 0), 'bg-green-50 dark:bg-green-950/20')}
            <TableRow className="border-t-2">
              <TableCell className="sticky left-0 bg-background z-10 font-bold">Cash Flow Net</TableCell>
              {years.map(y => {
                const d = annualAgg.get(y);
                const cf = d?.netCashFlow || 0;
                return (
                  <TableCell key={y} className={cn('text-right font-mono-numbers font-bold', cf < 0 ? 'text-destructive' : 'text-green-600')}>
                    {cf >= 0 ? '+' : ''}{formatCurrency(cf, true)}
                  </TableCell>
                );
              })}
            </TableRow>
            <TableRow className="bg-primary/5">
              <TableCell className="sticky left-0 bg-primary/5 z-10 font-bold">Trésorerie Fin</TableCell>
              {years.map(y => {
                const d = annualAgg.get(y);
                const te = d?.treasuryEnd || 0;
                return (
                  <TableCell key={y} className={cn('text-right font-mono-numbers font-bold', te < 0 && 'text-destructive')}>
                    {formatCurrency(te, true)}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
