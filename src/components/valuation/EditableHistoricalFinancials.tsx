import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/data/financialConfig';

export interface HistoricalYearData {
  year: number;
  revenue: number;
  grossMargin: number;
  payroll: number;
  externalCosts: number;
  depreciation: number;
}

interface EditableHistoricalFinancialsProps {
  data: HistoricalYearData[];
  onChange: (data: HistoricalYearData[]) => void;
}

export function EditableHistoricalFinancials({ data, onChange }: EditableHistoricalFinancialsProps) {
  const handleChange = (index: number, field: keyof HistoricalYearData, value: number) => {
    const updated = [...data];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <SectionCard title="Données Historiques" id="valuation-historical">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3">Année</th>
              <th className="text-right py-2 px-3">CA</th>
              <th className="text-right py-2 px-3">Marge Brute %</th>
              <th className="text-right py-2 px-3">Masse Salariale</th>
              <th className="text-right py-2 px-3">Charges Ext.</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={row.year} className="border-b">
                <td className="py-2 px-3 font-medium">{row.year}</td>
                <td className="py-2 px-3 text-right">
                  <Input type="number" value={row.revenue} onChange={e => handleChange(i, 'revenue', Number(e.target.value))} className="h-8 w-28 text-right" />
                </td>
                <td className="py-2 px-3 text-right">
                  <Input type="number" value={(row.grossMargin * 100).toFixed(0)} onChange={e => handleChange(i, 'grossMargin', Number(e.target.value) / 100)} className="h-8 w-20 text-right" step="1" />
                </td>
                <td className="py-2 px-3 text-right">
                  <Input type="number" value={row.payroll} onChange={e => handleChange(i, 'payroll', Number(e.target.value))} className="h-8 w-28 text-right" />
                </td>
                <td className="py-2 px-3 text-right">
                  <Input type="number" value={row.externalCosts} onChange={e => handleChange(i, 'externalCosts', Number(e.target.value))} className="h-8 w-28 text-right" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
