import { useState } from 'react';
import { SectionCard } from '@/components/ui/KPICard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatPercent } from '@/data/financialConfig';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';

// ─── Structure détaillée du P&L historique (liasse fiscale FR) ─────────────
export interface HistoricalYearData {
  year: number;
  // --- Ancien format (rétrocompatibilité) ---
  revenue: number;
  grossMargin: number; // ratio, recalculé depuis les champs détaillés si disponibles
  payroll: number;
  externalCosts: number;
  depreciation: number;
  // --- P&L détaillé ---
  salesB2B?: number;
  salesB2C?: number;
  salesOEM?: number;
  // COGS
  stockVariation?: number;
  purchasesGoods?: number;
  transportCosts?: number;
  // Production
  productionExercice?: number;
  rawMaterials?: number;
  subcontracting?: number;
  // Charges
  otherPurchases?: number; // Autres achats & charges ext. (= externalCosts)
  operatingSubsidies?: number;
  taxesAndDuties?: number;
  // Résultat
  otherOperatingIncome?: number;
  otherOperatingExpenses?: number;
  financialIncome?: number;
  financialExpenses?: number;
  exceptionalIncome?: number;
  exceptionalExpenses?: number;
  employeeParticipation?: number;
  corporateTax?: number;
}

// ─── Définition des lignes du tableau P&L ──────────────────────────────────

type RowType = 'input' | 'calculated' | 'header' | 'separator';

interface PLRow {
  id: string;
  label: string;
  type: RowType;
  field?: keyof HistoricalYearData;
  calculate?: (d: HistoricalYearData) => number;
  indent?: number;
  bold?: boolean;
  highlight?: boolean; // fond coloré pour les totaux
  sign?: 'positive' | 'negative'; // pour la coloration
}

// Fonctions utilitaires de calcul
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

const PL_ROWS: PLRow[] = [
  // Chiffre d'affaires
  { id: 'h_ca', label: 'CHIFFRE D\'AFFAIRE', type: 'calculated', calculate: totalRevenue, bold: true, highlight: true },
  { id: 'salesB2B', label: 'Dont Ventes B2B', type: 'input', field: 'salesB2B', indent: 2 },
  { id: 'salesB2C', label: 'Dont Ventes B2C', type: 'input', field: 'salesB2C', indent: 2 },
  { id: 'salesOEM', label: 'Dont Ventes OEM', type: 'input', field: 'salesOEM', indent: 2 },
  { id: 'sep1', label: '', type: 'separator' },

  // COGS
  { id: 'h_cogs', label: '- Coûts d\'achat des marchandises vendues', type: 'calculated', calculate: totalCOGS, bold: true, sign: 'negative' },
  { id: 'stockVariation', label: 'Variation de stock', type: 'input', field: 'stockVariation', indent: 2 },
  { id: 'purchasesGoods', label: 'Achat de marchandises', type: 'input', field: 'purchasesGoods', indent: 2 },
  { id: 'transportCosts', label: 'Transport de marchandises', type: 'input', field: 'transportCosts', indent: 2 },
  { id: 'sep2', label: '', type: 'separator' },

  // Marge commerciale
  { id: 'margeComm', label: 'MARGE COMMERCIALE', type: 'calculated', calculate: margeCommerciale, bold: true, highlight: true },
  { id: 'sep3', label: '', type: 'separator' },

  // Production
  { id: 'prodExercice', label: 'PRODUCTION DE L\'EXERCICE', type: 'input', field: 'productionExercice' },
  { id: 'rawMaterials', label: '- MP, appro. Consommés', type: 'input', field: 'rawMaterials', indent: 1 },
  { id: 'subcontracting', label: '- Sous-traitance directe', type: 'input', field: 'subcontracting', indent: 1 },
  { id: 'margeProd', label: 'MARGE BRUTE DE PRODUCTION', type: 'calculated', calculate: productionBrute, bold: true },
  { id: 'sep4', label: '', type: 'separator' },

  // Marge brute globale
  { id: 'margeBrute', label: 'MARGE (BRUTE GLOBALE) TOTALE', type: 'calculated', calculate: margeBruteGlobale, bold: true, highlight: true },
  { id: 'otherPurchases', label: '- Autres achats & Charges externes', type: 'input', field: 'otherPurchases', sign: 'negative' },
  { id: 'sep5', label: '', type: 'separator' },

  // Valeur Ajoutée
  { id: 'va', label: 'VALEUR AJOUTÉE', type: 'calculated', calculate: valeurAjoutee, bold: true, highlight: true },
  { id: 'operatingSubsidies', label: '+ Subventions d\'exploitation', type: 'input', field: 'operatingSubsidies', indent: 1 },
  { id: 'taxesAndDuties', label: '- Impôts, taxes et versements assimilés', type: 'input', field: 'taxesAndDuties', indent: 1, sign: 'negative' },
  { id: 'payroll', label: '- Charges de personnel', type: 'input', field: 'payroll', sign: 'negative' },
  { id: 'sep6', label: '', type: 'separator' },

  // EBE
  { id: 'ebe', label: 'EXCÉDENT BRUT D\'EXPLOITATION (EBE)', type: 'calculated', calculate: ebe, bold: true, highlight: true },
  { id: 'otherOpIncome', label: '+ Autres produits de gestion courante', type: 'input', field: 'otherOperatingIncome', indent: 1 },
  { id: 'depreciation', label: '- Dotations aux amortissements et aux provisions', type: 'input', field: 'depreciation', indent: 1, sign: 'negative' },
  { id: 'otherOpExpenses', label: '- Autres charges de gestion courante', type: 'input', field: 'otherOperatingExpenses', indent: 1, sign: 'negative' },
  { id: 'sep7', label: '', type: 'separator' },

  // Résultat d'exploitation
  { id: 'rex', label: 'RÉSULTAT D\'EXPLOITATION', type: 'calculated', calculate: resultatExploitation, bold: true, highlight: true },
  { id: 'financialIncome', label: '+ QP de résultat positif & Produits Financiers', type: 'input', field: 'financialIncome', indent: 1 },
  { id: 'financialExpenses', label: '- QP de résultat négatif & Charges Financières', type: 'input', field: 'financialExpenses', indent: 1, sign: 'negative' },
  { id: 'sep8', label: '', type: 'separator' },

  // Résultat courant
  { id: 'rcai', label: 'RÉSULTAT COURANT AVANT IMPÔTS', type: 'calculated', calculate: resultatCourant, bold: true, highlight: true },
  { id: 'exceptionalIncome', label: '+ Produits exceptionnels', type: 'input', field: 'exceptionalIncome', indent: 1 },
  { id: 'exceptionalExpenses', label: '- Charges exceptionnelles', type: 'input', field: 'exceptionalExpenses', indent: 1, sign: 'negative' },
  { id: 'sep9', label: '', type: 'separator' },

  // Résultat exceptionnel
  { id: 'rexcep', label: 'RÉSULTAT EXCEPTIONNEL', type: 'calculated', calculate: resultatExceptionnel, bold: true },
  { id: 'employeeParticipation', label: 'Participation des salariés', type: 'input', field: 'employeeParticipation', indent: 1 },
  { id: 'corporateTax', label: 'Impôts sur les bénéfices & CIR', type: 'input', field: 'corporateTax', indent: 1 },
  { id: 'sep10', label: '', type: 'separator' },

  // Résultat net
  { id: 'rnet', label: 'RÉSULTAT NET', type: 'calculated', calculate: resultatNet, bold: true, highlight: true },
];

// ─── Composant principal ───────────────────────────────────────────────────

interface EditableHistoricalFinancialsProps {
  data: HistoricalYearData[];
  onChange: (data: HistoricalYearData[]) => void;
}

function emptyYear(year: number): HistoricalYearData {
  return {
    year,
    revenue: 0,
    grossMargin: 0,
    payroll: 0,
    externalCosts: 0,
    depreciation: 0,
  };
}

export function EditableHistoricalFinancials({ data, onChange }: EditableHistoricalFinancialsProps) {
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());

  const handleChange = (yearIndex: number, field: keyof HistoricalYearData, value: number) => {
    const updated = [...data];
    updated[yearIndex] = { ...updated[yearIndex], [field]: value };

    // Recalcule les champs legacy pour rétrocompatibilité
    const d = updated[yearIndex];
    const rev = totalRevenue(d);
    d.revenue = rev;
    const mb = margeBruteGlobale(d);
    d.grossMargin = rev > 0 ? mb / rev : 0;
    d.externalCosts = d.otherPurchases ?? d.externalCosts;

    onChange(updated);
  };

  const addYear = () => {
    if (data.some(d => d.year === newYear)) return;
    const updated = [...data, emptyYear(newYear)].sort((a, b) => a.year - b.year);
    onChange(updated);
  };

  const removeYear = (year: number) => {
    onChange(data.filter(d => d.year !== year));
  };

  // Années disponibles pour ajouter (pas déjà présentes)
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 10 }, (_, i) => currentYear - 9 + i).filter(
    y => !data.some(d => d.year === y)
  );

  return (
    <SectionCard title="Compte de Résultat Historique" id="valuation-historical">
      {/* Contrôles d'ajout d'année */}
      <div className="flex items-center gap-3 mb-6 p-3 bg-muted/30 rounded-lg border">
        <span className="text-sm font-medium">Ajouter une année :</span>
        <div className="flex gap-1 flex-wrap">
          {availableYears.map(y => (
            <Button
              key={y}
              size="sm"
              variant={newYear === y ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => {
                setNewYear(y);
                if (!data.some(d => d.year === y)) {
                  const updated = [...data, emptyYear(y)].sort((a, b) => a.year - b.year);
                  onChange(updated);
                }
              }}
            >
              {y}
            </Button>
          ))}
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Sélectionnez une année ci-dessus pour commencer la saisie.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="text-left py-2 px-3 min-w-[280px] sticky left-0 bg-background z-10">Poste</th>
                {data.map(d => (
                  <th key={d.year} className="text-center py-2 px-2 min-w-[140px]" colSpan={2}>
                    <div className="flex items-center justify-center gap-1">
                      <span className="font-bold">{d.year}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeYear(d.year)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </th>
                ))}
              </tr>
              <tr className="border-b text-xs text-muted-foreground">
                <th></th>
                {data.map(d => (
                  <th key={d.year} colSpan={2} className="text-center py-1 px-2">
                    <div className="flex">
                      <span className="flex-1 text-right pr-2">Montant</span>
                      <span className="w-14 text-right">% CA</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PL_ROWS.map(row => {
                if (row.type === 'separator') {
                  return (
                    <tr key={row.id}>
                      <td colSpan={1 + data.length * 2} className="h-1"></td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border/50",
                      row.highlight && "bg-muted/40",
                    )}
                  >
                    {/* Label */}
                    <td
                      className={cn(
                        "py-1.5 px-3 sticky left-0 bg-background z-10",
                        row.highlight && "bg-muted/40",
                        row.bold && "font-bold",
                        row.indent === 1 && "pl-6",
                        row.indent === 2 && "pl-10",
                        "text-xs"
                      )}
                    >
                      {row.label}
                    </td>

                    {/* Valeurs par année */}
                    {data.map((yearData, yi) => {
                      const rev = totalRevenue(yearData);

                      if (row.type === 'calculated' && row.calculate) {
                        const value = row.calculate(yearData);
                        const pctCA = rev > 0 ? value / rev : 0;
                        return (
                          <td key={yearData.year} colSpan={2} className={cn("py-1.5 px-2")}>
                            <div className="flex items-center">
                              <span className={cn(
                                "flex-1 text-right font-mono-numbers pr-2",
                                row.bold && "font-bold",
                                value < 0 && "text-destructive",
                                value > 0 && row.highlight && "text-accent",
                              )}>
                                {formatCurrency(value, true)}
                              </span>
                              <span className={cn(
                                "w-14 text-right text-xs font-mono-numbers",
                                pctCA < 0 ? "text-destructive" : "text-muted-foreground"
                              )}>
                                {rev > 0 ? `${(pctCA * 100).toFixed(0)}%` : '-'}
                              </span>
                            </div>
                          </td>
                        );
                      }

                      // Input field
                      const fieldValue = row.field ? (yearData[row.field] as number | undefined) ?? 0 : 0;
                      const pctCA = rev > 0 ? fieldValue / rev : 0;

                      return (
                        <td key={yearData.year} colSpan={2} className="py-1 px-2">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={fieldValue || ''}
                              placeholder="0"
                              onChange={e => {
                                if (row.field) {
                                  handleChange(yi, row.field, Number(e.target.value) || 0);
                                }
                              }}
                              className={cn(
                                "h-7 text-right font-mono-numbers text-xs flex-1",
                                "border-transparent bg-transparent hover:border-border focus:border-primary focus:bg-background",
                              )}
                            />
                            <span className={cn(
                              "w-14 text-right text-xs font-mono-numbers shrink-0",
                              pctCA < 0 ? "text-destructive" : "text-muted-foreground"
                            )}>
                              {rev > 0 && fieldValue !== 0 ? `${(pctCA * 100).toFixed(0)}%` : '-'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
