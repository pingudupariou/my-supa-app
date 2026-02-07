import { useFinancial } from '@/context/FinancialContext';
import { SectionCard } from '@/components/ui/KPICard';
import { formatCurrency } from '@/data/financialConfig';
import { cn } from '@/lib/utils';

export function MonthlyTreasuryPlan() {
  const { computed } = useFinancial();
  const { monthlyTreasuryProjection } = computed;

  if (!monthlyTreasuryProjection.months.length) {
    return (
      <SectionCard title="Plan de Trésorerie Mensuel">
        <p className="text-muted-foreground text-center py-8">Aucune donnée mensuelle disponible.</p>
      </SectionCard>
    );
  }

  // Group by year, show summary
  const years = [...new Set(monthlyTreasuryProjection.months.map(m => m.year))];

  return (
    <div className="space-y-6">
      {years.map(year => {
        const yearMonths = monthlyTreasuryProjection.months.filter(m => m.year === year);
        return (
          <SectionCard key={year} title={`Trésorerie ${year}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Mois</th>
                    <th className="text-right py-2 px-2">Entrées</th>
                    <th className="text-right py-2 px-2">Sorties</th>
                    <th className="text-right py-2 px-2">Solde</th>
                    <th className="text-right py-2 px-2">Trésorerie</th>
                  </tr>
                </thead>
                <tbody>
                  {yearMonths.map(m => (
                    <tr key={`${m.year}-${m.month}`} className={cn('border-b', m.treasuryEnd < 0 && 'bg-destructive/5')}>
                      <td className="py-1.5 px-2">{m.monthName}</td>
                      <td className="py-1.5 px-2 text-right font-mono-numbers">{formatCurrency(m.totalInflows, true)}</td>
                      <td className="py-1.5 px-2 text-right font-mono-numbers text-muted-foreground">{formatCurrency(m.totalOutflows, true)}</td>
                      <td className={cn('py-1.5 px-2 text-right font-mono-numbers', m.netCashFlow >= 0 ? 'text-[hsl(var(--positive))]' : 'text-destructive')}>
                        {m.netCashFlow >= 0 ? '+' : ''}{formatCurrency(m.netCashFlow, true)}
                      </td>
                      <td className={cn('py-1.5 px-2 text-right font-mono-numbers font-medium', m.treasuryEnd < 0 && 'text-destructive')}>
                        {formatCurrency(m.treasuryEnd, true)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}
