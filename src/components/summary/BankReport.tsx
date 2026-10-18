import { Bar, CartesianGrid, ComposedChart, LabelList, Legend, Line, XAxis, YAxis } from 'recharts';
import { NovarideLogo } from '@/components/ui/NovarideLogo';
import { formatCurrency } from '@/data/financialConfig';
import {
  BankYear, variation, formatDelta, formatPct,
  revenueComment, marginComment, treasuryComment, netResultComment,
} from './bankReportModel';
import { useBankReportSettings, pickComment } from './bankReportSettings';
import { useSummaryExport, selectedBankPages } from './summaryExportSettings';

interface BankReportProps {
  rows: BankYear[];
  scenarioLabel: string;
  startYear: number;
  lastYear: number;
  minTreasury: number;
  fundingNeed: number;
  amountRaised: number;
}

const CHART_W = 1000;
const CHART_H = 360;
const k = (v: number) => `${Math.round(v / 1000).toLocaleString('fr-FR')}\u00a0k€`;

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

function Comment({ children }: { children: React.ReactNode }) {
  const { options } = useSummaryExport('bank');
  if (!options.comments) return null;
  return <p className="bank-comment"><strong>Lecture : </strong>{children}</p>;
}

type Metric = { key: keyof BankYear; label: string };
const METRICS: Metric[] = [
  { key: 'revenue', label: "Chiffre d'affaires HT" },
  { key: 'grossMargin', label: 'Marge brute' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'netResult', label: 'Résultat net' },
  { key: 'treasuryEnd', label: 'Trésorerie fin d’exercice' },
];
const LOAN_METRICS: Metric[] = [
  { key: 'loanDisbursement', label: 'Déblocage prêts bancaires' },
  { key: 'loanPayments', label: 'Échéances de prêts' },
  { key: 'loanInterest', label: "dont intérêts d'emprunt" },
];

export function BankReport({ rows, scenarioLabel, startYear, lastYear, minTreasury, fundingNeed, amountRaised }: BankReportProps) {
  const settings = useBankReportSettings();
  const { options } = useSummaryExport('bank');
  const selectedPages = selectedBankPages(options);
  const c = settings.comments;
  const revenueText = pickComment(c.revenue, `${revenueComment(rows)} ${marginComment(rows)}`);
  const treasuryText = pickComment(c.treasury, treasuryComment(rows, minTreasury, fundingNeed, amountRaised));
  const netText = pickComment(c.netResult, netResultComment(rows));
  const last = rows[rows.length - 1];
  const sum = (key: keyof BankYear) => rows.reduce((s, r) => s + ((r[key] as number) || 0), 0);
  const hasLoans = rows.some(r => (r.loanDisbursement || 0) > 0 || (r.loanPayments || 0) > 0);
  const tableMetrics = (hasLoans ? [...METRICS, ...LOAN_METRICS] : METRICS).filter(m => options.metrics[m.key]);
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const chartData = rows.map(r => ({ ...r, grossMarginRate: r.revenue ? (r.grossMargin / r.revenue) * 100 : 0 }));

  const toc = selectedPages.map(([key, label], index) => ({ key, label, page: index + 1 })).filter(page => !['cover', 'toc'].includes(page.key));

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
      {options.sections.cover && <section className="bank-page bank-cover">
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

      <Page title="Sommaire">
        <ol className="bank-toc">
          {toc.map(({ key, label, page }, index) => (
            <li key={key}><span>{index + 1}. {label}</span><span className="bank-toc-dots" /><span>{page}</span></li>
          ))}
        </ol>
        <p className="bank-note">Montants HT en euros, issus des calculs du business plan (scénario {scenarioLabel}). Aucun retraitement n'est appliqué dans ce document.</p>
      </Page>

      <Page title="Résumé exécutif" number="1">
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
      </Page>

      <Page title="CA et rentabilité" number="2">
        <ComposedChart width={CHART_W} height={CHART_H} data={chartData} margin={{ top: 24, right: 50, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="year" tickLine={false} />
          <YAxis yAxisId="eur" tickFormatter={k} width={80} tickLine={false} />
          <YAxis yAxisId="pct" orientation="right" tickFormatter={v => `${v} %`} tickLine={false} />
          <Legend />
          <Bar yAxisId="eur" hide={!options.metrics.revenue} dataKey="revenue" name="CA HT" fill="hsl(var(--primary))" isAnimationActive={false} maxBarSize={56}>
            <LabelList dataKey="revenue" position="top" formatter={k} fontSize={11} fill="hsl(var(--foreground))" />
          </Bar>
          <Bar yAxisId="eur" hide={!options.metrics.grossMargin} dataKey="grossMargin" name="Marge brute" fill="hsl(var(--accent))" isAnimationActive={false} maxBarSize={56} />
          <Bar yAxisId="eur" hide={!options.metrics.ebitda} dataKey="ebitda" name="EBITDA" fill="hsl(var(--muted-foreground))" isAnimationActive={false} maxBarSize={56} />
          <Line yAxisId="pct" hide={!options.metrics.grossMarginRate} dataKey="grossMarginRate" name="Taux de marge brute (%)" stroke="hsl(var(--positive))" strokeWidth={2} isAnimationActive={false} />
        </ComposedChart>
        <Comment>{revenueText}</Comment>
      </Page>

      <Page title="Trésorerie et financement" number="3">
        <ComposedChart width={CHART_W} height={CHART_H} data={rows} margin={{ top: 24, right: 30, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="year" tickLine={false} />
          <YAxis tickFormatter={k} width={80} tickLine={false} />
          <Legend />
          <Bar hide={!options.metrics.netCashFlow} dataKey="netCashFlow" name="Flux de trésorerie net" fill="hsl(var(--muted-foreground))" isAnimationActive={false} maxBarSize={56} />
          <Line hide={!options.metrics.treasuryEnd} dataKey="treasuryEnd" name="Trésorerie fin d'exercice" stroke="hsl(var(--primary))" strokeWidth={3} isAnimationActive={false}>
            <LabelList dataKey="treasuryEnd" position="top" formatter={k} fontSize={11} fill="hsl(var(--foreground))" />
          </Line>
        </ComposedChart>
        <Comment>{treasuryText}</Comment>
      </Page>

      <Page title="Compte de résultat synthétique" number="4">
        <table className="bank-table">
          <thead><tr><th>En euros HT</th>{rows.map(r => <th key={r.year}>{r.year}</th>)}<th>Cumul</th></tr></thead>
          <tbody>
            {tableMetrics.map(m => (
              <tr key={m.key} className={m.key === 'netResult' ? 'bank-strong' : undefined}>
                <th>{m.label}</th>
                {rows.map(r => <td key={r.year}>{formatCurrency((r[m.key] as number) || 0)}</td>)}
                <td>{m.key === 'treasuryEnd' ? '—' : formatCurrency(sum(m.key))}</td>
              </tr>
            ))}
            {options.metrics.grossMarginRate && <tr>
              <th>Taux de marge brute</th>
              {rows.map(r => <td key={r.year}>{r.revenue ? `${((r.grossMargin / r.revenue) * 100).toFixed(1).replace('.', ',')} %` : 'n.s.'}</td>)}
              <td>—</td>
            </tr>}
          </tbody>
        </table>
        <Comment>{netText}</Comment>
      </Page>

      <Page title="Variations annuelles" number="5">
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
      </Page>
    </div>
  );
}
