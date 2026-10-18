import { useMemo } from 'react';
import { useFinancial } from '@/context/FinancialContext';
import { SectionCard } from '@/components/ui/KPICard';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LoanManager } from '@/components/treasury/LoanManager';
import { formatCurrency } from '@/data/financialConfig';
import { buildLoanSchedule } from './loanSchedule';

export function BankLoanSection() {
  const { state, computed, updateFinancingOptions, updateBankLoans } = useFinancial();
  const options = state.financingOptions ?? { equity: true, bankLoan: false };
  const bankLoans = state.bankLoans ?? [];
  const { startYear, durationYears } = state.scenarioSettings;
  const years = Array.from({ length: durationYears }, (_, i) => startYear + i);

  const schedule = useMemo(
    () => buildLoanSchedule(computed.monthlyTreasuryProjection.months, bankLoans.map(l => l.id), years),
    [computed.monthlyTreasuryProjection, bankLoans, years.join(',')],
  );
  const totals = schedule.reduce((t, r) => ({
    disbursed: t.disbursed + r.disbursed, principal: t.principal + r.principal, interest: t.interest + r.interest,
  }), { disbursed: 0, principal: 0, interest: 0 });

  return (
    <SectionCard title="Mode de financement">
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer">
          <div>
            <Label className="font-medium">Levée de fonds</Label>
            <p className="text-xs text-muted-foreground">Apport en capital des tours et du plan de financement</p>
          </div>
          <Switch checked={options.equity} onCheckedChange={v => updateFinancingOptions({ equity: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer">
          <div>
            <Label className="font-medium">Prêt bancaire</Label>
            <p className="text-xs text-muted-foreground">Capital encaissé au mois de début, échéances et intérêts selon durée et taux</p>
          </div>
          <Switch checked={options.bankLoan} onCheckedChange={v => updateFinancingOptions({ bankLoan: v })} />
        </label>
      </div>
      {!options.equity && !options.bankLoan && (
        <p className="text-sm text-muted-foreground mb-4">Aucun financement externe : la trésorerie ne repose que sur la trésorerie initiale et l'activité.</p>
      )}

      {options.bankLoan && (
        <div className="space-y-4">
          <LoanManager loans={bankLoans} onChange={updateBankLoans} startYear={startYear} durationYears={durationYears} />
          {bankLoans.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <caption className="text-left text-sm font-semibold p-3">Échéancier annuel des prêts bancaires (période du plan)</caption>
                <thead className="bg-muted/40">
                  <tr className="border-b">
                    <th className="text-left px-3 py-2">Année</th>
                    <th className="text-right px-3 py-2">Déblocage</th>
                    <th className="text-right px-3 py-2">Capital remboursé</th>
                    <th className="text-right px-3 py-2">Intérêts</th>
                    <th className="text-right px-3 py-2">Échéances totales</th>
                    <th className="text-right px-3 py-2">Capital restant dû</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map(r => (
                    <tr key={r.year} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{r.year}</td>
                      <td className="px-3 py-2 text-right font-mono-numbers">{r.disbursed ? `+${formatCurrency(r.disbursed)}` : '-'}</td>
                      <td className="px-3 py-2 text-right font-mono-numbers">{formatCurrency(r.principal)}</td>
                      <td className="px-3 py-2 text-right font-mono-numbers">{formatCurrency(r.interest)}</td>
                      <td className="px-3 py-2 text-right font-mono-numbers">{formatCurrency(r.principal + r.interest)}</td>
                      <td className="px-3 py-2 text-right font-mono-numbers font-semibold">{formatCurrency(r.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-muted/40 font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total période</td>
                    <td className="px-3 py-2 text-right font-mono-numbers">{formatCurrency(totals.disbursed)}</td>
                    <td className="px-3 py-2 text-right font-mono-numbers">{formatCurrency(totals.principal)}</td>
                    <td className="px-3 py-2 text-right font-mono-numbers">{formatCurrency(totals.interest)}</td>
                    <td className="px-3 py-2 text-right font-mono-numbers">{formatCurrency(totals.principal + totals.interest)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
              <p className="text-xs text-muted-foreground p-3">Les échéances sortent de la trésorerie ; les intérêts sont ajoutés aux charges financières du compte de résultat. Les échéances au-delà de {startYear + durationYears - 1} ne figurent pas dans le plan.</p>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}
