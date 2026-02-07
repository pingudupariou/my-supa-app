import { useFinancial } from '@/context/FinancialContext';
import { SectionCard } from '@/components/ui/KPICard';
import { formatCurrency, formatPercent } from '@/data/financialConfig';

const ALLOCATION_ITEMS = [
  { key: 'hiring', label: 'Recrutement', color: 'hsl(var(--primary))' },
  { key: 'rd', label: 'R&D', color: 'hsl(var(--accent))' },
  { key: 'marketing', label: 'Marketing', color: 'hsl(150, 60%, 40%)' },
  { key: 'inventory', label: 'Stock', color: 'hsl(38, 92%, 50%)' },
  { key: 'buffer', label: 'Buffer', color: 'hsl(0, 0%, 60%)' },
];

export function FundsAllocationDisplay() {
  const { state } = useFinancial();
  const round = state.fundingRounds[0];
  if (!round) return null;

  const total = round.amount;

  return (
    <SectionCard title="Allocation des Fonds">
      <div className="space-y-3">
        {ALLOCATION_ITEMS.map(item => {
          const pct = 1 / ALLOCATION_ITEMS.length;
          const amount = total * pct;
          return (
            <div key={item.key}>
              <div className="flex justify-between text-sm mb-1">
                <span>{item.label}</span>
                <span className="font-mono-numbers">{formatCurrency(amount, true)}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: item.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
