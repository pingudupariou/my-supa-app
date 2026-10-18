import { NovarideLogo } from '@/components/ui/NovarideLogo';
import { formatCurrency } from '@/data/financialConfig';
import {
  BankYear, variation, formatDelta, formatPct,
  revenueComment, marginComment, treasuryComment, netResultComment,
} from './bankReportModel';
import { useBankReportSettings } from './bankReportSettings';
import { useSummaryExport, selectedBankPages } from './summaryExportSettings';

interface BankReportProps {
  part: 'intro' | 'appendix';
  rows: BankYear[];
  scenarioLabel: string;
  startYear: number;
  lastYear: number;
  minTreasury: number;
  fundingNeed: number;
  amountRaised: number;
}


function Page({ children, title, number }: { children: React.ReactNode; title?: string; number?: string }) {
  const { options } = useSummaryExport('bank');
  const pages = selectedBankPages(options);
  if (!pages.some(([, label]) => label === title)) return null;
  const sectionNumber = pages.filter(([key]) => !['cover', 'toc'].includes(key)).findIndex(([, label]) => label === title) + 1;
  return (
    <section className="bank-page">
      {title && (
        <header className="bank-page-header">
          <span>{number && <span className="bank-num">{sectionNumber}</span>}{title}</span>
          <ReportLogo compact />
        </header>
      )}
      {children}
    </section>
  );
}

function ReportLogo({ compact }: { compact?: boolean }) {
  const { logoDataUrl } = useBankReportSettings();
  if (logoDataUrl) return <img src={logoDataUrl} alt="Logo" style={{ height: compact ? 28 : 72, maxWidth: compact ? 140 : 320, objectFit: 'contain' }} />;
  return <NovarideLogo variant={compact ? 'compact' : 'full'} />;
}

type Metric = { key: keyof BankYear; label: string };
const METRICS: Metric[] = [
  { key: 'revenue', label: "Chiffre d'affaires HT" },
  { key: 'grossMargin', label: 'Marge brute' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'netResult', label: 'Résultat net' },
  { key: 'treasuryEnd', label: 'Trésorerie fin d’exercice' },
];
export function BankReport({ rows, scenarioLabel, startYear, lastYear, minTreasury, fundingNeed, amountRaised, part }: BankReportProps) {
  const settings = useBankReportSettings();
  const { options } = useSummaryExport('bank');
  const selectedPages = selectedBankPages(options);
  const last = rows[rows.length - 1];
  const sum = (key: keyof BankYear) => rows.reduce((s, r) => s + ((r[key] as number) || 0), 0);
  const hasLoans = rows.some(r => (r.loanDisbursement || 0) > 0 || (r.loanPayments || 0) > 0);
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  const toc = selectedPages.map(([key, label], index) => ({ key, label: index + 1 })).filter(page => !['cover', 'toc'].includes(page.key));

  const kpis = [
    { label: `CA ${last?.year}`, value: last?.revenue ?? 0, sub: `Cumul ${formatCurrency(sum('revenue'))}` },
    { label: `Marge brute ${last?.year}`, value: last?.grossMargin ?? 0, sub: last?.revenue ? `${((last.grossMargin / last.revenue) * 100).toFixed(1).replace('.', ',')} % du CA` : '' },
    { label: `EBITDA ${last?.year}`, value: last?.ebitda ?? 0, sub: `Cumul ${formatCurrency(sum('ebitda'))}` },
    { label: `Résultat net ${last?.year}`, value: last?.netResult ?? 0, sub: `Cumul ${formatCurrency(sum('netResult'))}` },
    { label: 'Trésorerie fin de période', value: last?.treasuryEnd ?? 0, sub: `Point bas ${formatCurrency(minTreasury)}` },
    { label: 'Besoin de financement', value: fundingNeed, sub: `Fonds levés ${formatCurrency(amountRaised)}${hasLoans ? ` · Prêts ${formatCurrency(sum('loanDisbursement'))}` : ''}` },
  ];

  return (
    <div className="bank-report" aria-hidden="true" data-export-graphs={options.graphs} data-export-tables={options.tables} data-export-kpis={options.kpis} data-export-comments={options.comments} data-export-legend={options.legend} data-export-labels={options.labels}>
      {/* Couverture */}
      {part === 'intro' && options.sections.cover && <section className="bank-page bank-cover">
        <ReportLogo />
        <div>
          <p className="bank-cover-kicker">Dossier financier</p>
          <h1>{settings.projectName?.trim() || 'Novaride — Business plan'}</h1>
          <p className="bank-cover-sub">Synthèse investisseur · Période {startYear} – {lastYear}</p>
        </div>
        <dl className="bank-cover-meta">
          <div><dt>Scénario</dt><dd>{scenarioLabel}</dd></div>
          <div><dt>Période</dt><dd>{startYear} – {lastYear}</dd></div>
          <div><dt>Date d'édition</dt><dd>{today}</dd></div>
        </dl>
      </section>}

      {part === 'intro' && <Page title="Sommaire">
        <ol className="bank-toc">
          {toc.map(({ key, label }, index) => (
            <li key={key}><span>{index + 1}. {label}</span></li>
          ))}
        </ol>
        <p className="bank-note">Montants HT en euros, issus des calculs du business plan (scénario {scenarioLabel}). Aucun retraitement n'est appliqué dans ce document.</p>
      </Page>}

      {part === 'intro' && <Page title="Résumé exécutif" number="1">
        <div className="bank-kpis">
          {kpis.map(kp => (
            <div key={kp.label} className="bank-kpi">
              <div className="bank-kpi-label">{kp.label}</div>
              <div className="bank-kpi-value">{formatCurrency(kp.value)}</div>
              <div className="bank-kpi-sub">{kp.sub}</div>
            </div>
          ))}
        </div>
        <ul className="bank-bullets">
          <li>{revenueComment(rows)}</li>
          <li>{marginComment(rows)}</li>
          <li>{treasuryComment(rows, minTreasury, fundingNeed, amountRaised)}</li>
          <li>{netResultComment(rows)}</li>
        </ul>
      </Page>}

      {part === 'appendix' && <Page title="Variations annuelles" number="5">
        <table className="bank-table">
          <thead>
            <tr><th>Indicateur</th>{rows.slice(1).map(r => <th key={r.year}>{r.year - 1} → {r.year}</th>)}</tr>
          </thead>
          <tbody>
            {METRICS.filter(m => options.metrics[m.key]).map(m => (
              <tr key={m.key}>
                <th>{m.label}</th>
                {rows.slice(1).map((r, i) => {
                  const v = variation(r[m.key] as number, rows[i][m.key] as number);
                  return <td key={r.year}><div>{formatDelta(v.delta)}</div><div className="bank-muted">{formatPct(v.pct)}</div></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="bank-note">Variation en euros, puis en pourcentage de l'année précédente. « n.s. » : non significatif (année précédente nulle).</p>
      </Page>}
    </div>
  );
}
