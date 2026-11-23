import * as XLSX from 'xlsx';
import { margin, type Row, type PivotRow } from '@/components/sales/salesStatsModel';

export type SalesSheet = { name: string; first: string; rows: Row[]; extra?: { header: string; value: (r: Row) => string | number | null }[] };
export type PivotSheet = { name: string; headers: string[]; rows: PivotRow[]; unit: string };

const EUR = '#,##0.00 "€"'; const PCT = '0.0%'; const INT = '#,##0.##';

function rowsSheet(s: SalesSheet): XLSX.WorkSheet {
  const extra = s.extra ?? [];
  const head = [s.first, ...extra.map((e) => e.header), 'CA HT net', 'Quantités', 'Coût vendu', 'Marge €', 'Marge %', 'Couverture coûts', 'Note'];
  const n = extra.length;
  const aoa: any[][] = [head];
  s.rows.forEach((r, i) => {
    const x = margin(r); const R = i + 2;
    const c = (k: number) => XLSX.utils.encode_col(n + k);
    aoa.push([r.label || r.key, ...extra.map((e) => e.value(r)), r.ca_ht, r.qty, r.cogs ?? null,
      x.m == null ? null : { f: `${r.cov_ht}-${c(3)}${R}`, v: x.m }, x.pct == null ? null : { f: `IF(${r.cov_ht}=0,"",${c(4)}${R}/${r.cov_ht})`, v: x.pct },
      x.coverage, [x.estimated ? 'marge estimée' : '', x.incomplete ? 'couverture incomplète' : ''].filter(Boolean).join(' ; ')]);
  });
  const L = s.rows.length + 1;
  if (L > 1) { const c = (k: number) => XLSX.utils.encode_col(n + k); aoa.push(['TOTAL', ...extra.map(() => ''), { f: `SUM(${c(1)}2:${c(1)}${L})` }, { f: `SUM(${c(2)}2:${c(2)}${L})` }, { f: `SUM(${c(3)}2:${c(3)}${L})` }, { f: `SUM(${c(4)}2:${c(4)}${L})` }]); }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let i = 1; i < aoa.length; i++) {
    [[1, EUR], [2, INT], [3, EUR], [4, EUR], [5, PCT], [6, PCT]].forEach(([k, z]) => { const a = XLSX.utils.encode_cell({ r: i, c: n + (k as number) }); if (ws[a]) ws[a].z = z as string; });
  }
  ws['!cols'] = [{ wch: 40 }, ...extra.map(() => ({ wch: 16 })), ...Array(7).fill({ wch: 14 })];
  ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(n + 7)}${Math.max(1, L)}` };
  return ws;
}

function pivotSheet(p: PivotSheet): XLSX.WorkSheet {
  const aoa: any[][] = [p.headers];
  p.rows.forEach((r) => aoa.push([r.label, ...r.cells, r.total]));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const z = p.unit === '€' ? EUR : p.unit === '%' ? '0.0' : INT;
  for (let i = 1; i < aoa.length; i++) for (let c = 1; c < p.headers.length; c++) { const a = XLSX.utils.encode_cell({ r: i, c }); if (ws[a]) ws[a].z = z; }
  ws['!cols'] = [{ wch: 40 }, ...p.headers.slice(1).map(() => ({ wch: 14 }))];
  return ws;
}

export function buildSalesWorkbook(info: [string, string][], sheets: SalesSheet[], pivot?: PivotSheet): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const wi = XLSX.utils.aoa_to_sheet([['Statistiques commerciales — source Erplain (factures − avoirs)'], [], ...info]);
  wi['!cols'] = [{ wch: 32 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wi, 'Infos');
  if (pivot) XLSX.utils.book_append_sheet(wb, pivotSheet(pivot), pivot.name.slice(0, 31));
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, rowsSheet(s), s.name.slice(0, 31));
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, file: string) { XLSX.writeFile(wb, file); }
