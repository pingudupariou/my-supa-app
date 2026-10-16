import { SectionCard } from '@/components/ui/KPICard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import {
  IncomeStatementConfig,
  IncomeStatementYearInput,
  computeIncomeStatement,
} from '@/engine/incomeStatementConfig';

interface IncomeStatementSectionProps {
  years: number[];
  yearlyData: IncomeStatementYearInput[];
  config: IncomeStatementConfig;
  onConfigChange?: (config: IncomeStatementConfig) => void;
  readOnly?: boolean;
  title?: string;
  id?: string;
}

const cellClass = 'text-right font-mono-numbers min-w-24';
const stickyLabelClass = 'sticky left-0 bg-background z-10';

export function IncomeStatementSection({
  years,
  yearlyData,
  config,
  onConfigChange,
  readOnly = false,
  title = 'Compte de Résultat',
  id = 'income-statement',
}: IncomeStatementSectionProps) {
  const canEdit = !readOnly && !!onConfigChange;
  const results = computeIncomeStatement(yearlyData, config);

  const updateLineValue = (lineId: string, year: number, value: number) => {
    if (!onConfigChange) return;
    onConfigChange({
      ...config,
      depreciationLines: config.depreciationLines.map(l =>
        l.id === lineId ? { ...l, valuesByYear: { ...l.valuesByYear, [year]: value } } : l
      ),
    });
  };

  const updateLineLabel = (lineId: string, label: string) => {
    if (!onConfigChange) return;
    onConfigChange({
      ...config,
      depreciationLines: config.depreciationLines.map(l => (l.id === lineId ? { ...l, label } : l)),
    });
  };

  const addLine = () => {
    if (!onConfigChange) return;
    onConfigChange({
      ...config,
      depreciationLines: [
        ...config.depreciationLines,
        { id: `dotation-${Date.now()}`, label: 'Nouvelle dotation', valuesByYear: {} },
      ],
    });
  };

  const removeLine = (lineId: string) => {
    if (!onConfigChange) return;
    onConfigChange({ ...config, depreciationLines: config.depreciationLines.filter(l => l.id !== lineId) });
  };

  const updateRecordValue = (
    field: 'financialIncome' | 'financialExpense' | 'exceptionalIncome' | 'exceptionalExpense',
    year: number,
    value: number
  ) => {
    if (!onConfigChange) return;
    onConfigChange({ ...config, [field]: { ...config[field], [year]: value } });
  };

  const updateTaxRate = (value: number) => {
    if (!onConfigChange) return;
    onConfigChange({ ...config, incomeTaxRate: value / 100 });
  };

  const renderEditableRow = (
    label: string,
    field: 'financialIncome' | 'financialExpense' | 'exceptionalIncome' | 'exceptionalExpense',
    negative = false
  ) => (
    <TableRow>
      <TableCell className={cn(stickyLabelClass, 'text-muted-foreground')}>{label}</TableCell>
      {years.map(year => (
        <TableCell key={year} className={cellClass}>
          {canEdit ? (
            <Input
              type="number"
              className="h-7 w-24 text-right ml-auto font-mono-numbers"
              value={config[field][year] ?? ''}
              placeholder="0"
              onChange={e => updateRecordValue(field, year, Number(e.target.value) || 0)}
            />
          ) : (
            <span className="text-muted-foreground">
              {negative && (config[field][year] || 0) > 0 ? '(' : ''}
              {formatCurrency(config[field][year] || 0, true)}
              {negative && (config[field][year] || 0) > 0 ? ')' : ''}
            </span>
          )}
        </TableCell>
      ))}
    </TableRow>
  );

  return (
    <SectionCard
      title={title}
      id={id}
      action={
        canEdit ? (
          <span className="text-xs text-muted-foreground">
            Taux IS : {' '}
            <Input
              type="number"
              className="inline-block h-7 w-16 text-right ml-1 font-mono-numbers"
              value={Math.round(config.incomeTaxRate * 100)}
              onChange={e => updateTaxRate(Number(e.target.value) || 0)}
            />
            %
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Taux IS : {formatPercent(config.incomeTaxRate)}</span>
        )
      }
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={stickyLabelClass}>Poste</TableHead>
              {years.map(year => (
                <TableHead key={year} className="text-right min-w-24">{year}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="bg-muted/30">
              <TableCell className={cn(stickyLabelClass, 'bg-muted/30 font-medium')}>Chiffre d'Affaires</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-medium')}>{formatCurrency(d.revenue, true)}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className={cn(stickyLabelClass, 'text-muted-foreground')}>- Coût des Ventes</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'text-muted-foreground')}>({formatCurrency(d.cogs, true)})</TableCell>
              ))}
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className={cn(stickyLabelClass, 'font-medium')}>= Marge Brute</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-medium')}>{formatCurrency(d.grossMargin, true)}</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className={cn(stickyLabelClass, 'text-muted-foreground')}>- Masse Salariale</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'text-muted-foreground')}>({formatCurrency(d.payroll, true)})</TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className={cn(stickyLabelClass, 'text-muted-foreground')}>- Charges Opérationnelles</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'text-muted-foreground')}>({formatCurrency(d.opex, true)})</TableCell>
              ))}
            </TableRow>
            <TableRow className="border-t-2 bg-muted/30">
              <TableCell className={cn(stickyLabelClass, 'bg-muted/30 font-medium')}>= EBITDA</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-medium', d.ebitda < 0 && 'text-destructive')}>
                  {formatCurrency(d.ebitda, true)}
                </TableCell>
              ))}
            </TableRow>

            {/* Dotations aux amortissements — saisie manuelle, ligne par ligne */}
            {config.depreciationLines.map(line => (
              <TableRow key={line.id}>
                <TableCell className={cn(stickyLabelClass, 'text-muted-foreground')}>
                  {canEdit ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={line.label}
                        onChange={e => updateLineLabel(line.id, e.target.value)}
                        className="h-7 text-xs w-44"
                      />
                      {config.depreciationLines.length > 1 && (
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => removeLine(line.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <>- {line.label}</>
                  )}
                </TableCell>
                {years.map(year => (
                  <TableCell key={year} className={cellClass}>
                    {canEdit ? (
                      <Input
                        type="number"
                        className="h-7 w-24 text-right ml-auto font-mono-numbers"
                        value={line.valuesByYear[year] ?? ''}
                        placeholder="0"
                        onChange={e => updateLineValue(line.id, year, Number(e.target.value) || 0)}
                      />
                    ) : (
                      <span className="text-muted-foreground">({formatCurrency(line.valuesByYear[year] || 0, true)})</span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {canEdit && (
              <TableRow>
                <TableCell className={stickyLabelClass} colSpan={1}>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addLine}>
                    <Plus className="h-3 w-3" /> Ajouter une ligne
                  </Button>
                </TableCell>
                {years.map(year => <TableCell key={year} />)}
              </TableRow>
            )}
            <TableRow className="border-t">
              <TableCell className={cn(stickyLabelClass, 'text-muted-foreground italic')}>= Total Dotations</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'text-muted-foreground italic')}>({formatCurrency(d.totalDepreciation, true)})</TableCell>
              ))}
            </TableRow>

            <TableRow className="border-t-2 bg-primary/5">
              <TableCell className={cn(stickyLabelClass, 'bg-primary/5 font-bold')}>= Résultat d'Exploitation</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-bold', d.operatingResult < 0 && 'text-destructive')}>
                  {formatCurrency(d.operatingResult, true)}
                </TableCell>
              ))}
            </TableRow>

            {renderEditableRow('+ Produits Financiers', 'financialIncome')}
            {renderEditableRow('- Charges Financières', 'financialExpense', true)}
            <TableRow className="border-t">
              <TableCell className={cn(stickyLabelClass, 'font-medium')}>= Résultat Financier</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-medium', d.financialResult < 0 && 'text-destructive')}>
                  {formatCurrency(d.financialResult, true)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow className="bg-muted/30">
              <TableCell className={cn(stickyLabelClass, 'bg-muted/30 font-medium')}>= Résultat Courant avant Impôts</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-medium', d.currentResultBeforeTax < 0 && 'text-destructive')}>
                  {formatCurrency(d.currentResultBeforeTax, true)}
                </TableCell>
              ))}
            </TableRow>

            {renderEditableRow('+ Produits Exceptionnels', 'exceptionalIncome')}
            {renderEditableRow('- Charges Exceptionnelles', 'exceptionalExpense', true)}
            <TableRow className="border-t">
              <TableCell className={cn(stickyLabelClass, 'font-medium')}>= Résultat Exceptionnel</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-medium', d.exceptionalResult < 0 && 'text-destructive')}>
                  {formatCurrency(d.exceptionalResult, true)}
                </TableCell>
              ))}
            </TableRow>

            <TableRow className="border-t-2">
              <TableCell className={cn(stickyLabelClass, 'font-medium')}>= Résultat avant Impôt</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-medium', d.resultBeforeTax < 0 && 'text-destructive')}>
                  {formatCurrency(d.resultBeforeTax, true)}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell className={cn(stickyLabelClass, 'text-muted-foreground')}>- Impôt sur les Sociétés</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'text-muted-foreground')}>({formatCurrency(d.incomeTax, true)})</TableCell>
              ))}
            </TableRow>

            <TableRow className="border-t-2 bg-primary/5">
              <TableCell className={cn(stickyLabelClass, 'bg-primary/5 font-bold')}>= Résultat Net</TableCell>
              {results.map((d, i) => (
                <TableCell key={i} className={cn(cellClass, 'font-bold', d.netResult < 0 && 'text-destructive')}>
                  {formatCurrency(d.netResult, true)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
      {canEdit && (
        <p className="text-[11px] text-muted-foreground mt-3">
          Les dotations aux amortissements, le résultat financier, le résultat exceptionnel et le taux d'IS sont saisis manuellement — ils ne sont pas recalculés automatiquement depuis le plan CAPEX.
        </p>
      )}
    </SectionCard>
  );
}
