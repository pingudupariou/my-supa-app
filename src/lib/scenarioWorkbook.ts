import * as XLSX from 'xlsx';
import { syncProductVolumes } from '@/engine/calculations';
import { CHS, scenarioClientVolume, scenarioCost, scenarioPrices, scenarioResults, scenarioVolumes, type ProductScenario } from '@/engine/productScenarios';
import type { Product, ProductCategory } from '@/engine/types';

type C = { v?: string | number; f?: string; z?: string; t?: 's' | 'n' };
const EUR = '#,##0.00 "€"';
const EUR0 = '#,##0 "€"';
const INT = '#,##0';
const PCT = '0.0%';
const col = (i: number) => XLSX.utils.encode_col(i);
const safeName = (s: string, used: Set<string>) => {
  let n = s.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Scénario';
  let k = 2; const base = n;
  while (used.has(n.toLowerCase())) n = `${base.slice(0, 25)} ${k++}`;
  used.add(n.toLowerCase());
  return n;
};
const ref = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;

export interface WorkbookVersion { name: string; scenario: ProductScenario | null }

/**
 * Classeur fonctionnel : une feuille par version (prix, coûts, volumes, clients B2B saisissables),
 * CA / coûts / marges / totaux en formules Excel, plus une feuille de comparaison liée.
 */
export function buildScenarioWorkbook(rawProducts: Product[], versions: WorkbookVersion[], years: number[], planTransport: Record<number, number>, chName: (c: ProductCategory) => string) {
  const products = syncProductVolumes(rawProducts);
  const wb = XLSX.utils.book_new();
  const used = new Set<string>(['comparaison']);
  const firstY = 2, lastY = 2 + years.length - 1, totCol = lastY + 1;
  const yc = (i: number) => col(firstY + i);
  const totals: { sheet: string; name: string; rows: Record<string, number> }[] = [];

  versions.forEach(ver => {
    const sc = ver.scenario;
    const sheet = safeName(ver.name, used);
    const ws: XLSX.WorkSheet = {};
    let r = 0;
    const put = (row: number, c: number, cell: C) => { ws[XLSX.utils.encode_cell({ r: row, c })] = { t: cell.t ?? (cell.f || typeof cell.v === 'number' ? 'n' : 's'), v: cell.v ?? (cell.f ? 0 : ''), ...(cell.f ? { f: cell.f } : {}), ...(cell.z ? { z: cell.z } : {}) }; };
    const line = (product: string, label: string, cells: (C | null)[], total?: C) => {
      put(r, 0, { v: product }); put(r, 1, { v: label });
      cells.forEach((c, i) => c && put(r, firstY + i, c));
      if (total) put(r, totCol, total);
      return ++r; // numéro Excel de la ligne écrite
    };
    const sumRow = (row: number, z: string) => ({ f: `SUM(${yc(0)}${row}:${yc(years.length - 1)}${row})`, z });

    put(r, 0, { v: `Plan produit — ${ver.name}` }); r++;
    put(r, 0, { v: 'Prix, coûts et volumes = saisies modifiables. Unités, CA, coûts, marges et totaux = formules.' }); r += 2;
    put(r, 0, { v: 'Produit' }); put(r, 1, { v: 'Ligne' }); years.forEach((y, i) => put(r, firstY + i, { v: String(y) })); put(r, totCol, { v: 'Total' }); r++;

    const caRows: number[] = [], costRows: number[] = [], unitRows: number[] = [];
    products.forEach(p => {
      const pr = years.map(y => scenarioPrices(p, sc, y));
      const priceRow: Record<ProductCategory, number> = {} as never;
      CHS.forEach(ch => { priceRow[ch] = line(p.name, `Prix ${chName(ch)} HT (€)`, years.map((_, i) => ({ v: pr[i][ch], z: EUR }))); });
      const costRow = line(p.name, 'Coût de revient unitaire (€)', years.map(y => ({ v: scenarioCost(p, sc, y), z: EUR })));
      const vols = years.map(y => scenarioVolumes(p, sc, y));
      const volRow: Record<ProductCategory, number> = {} as never;
      volRow.B2C = line(p.name, `Volume ${chName('B2C')}`, vols.map(v => ({ v: v.B2C, z: INT })), sumRow(r + 1, INT));
      const clients = p.b2bClients?.enabled ? p.b2bClients.clients : [];
      const clientRows = clients.map(c => line(p.name, `  ↳ ${chName('B2B')} · ${c.name}`, years.map(y => ({ v: scenarioClientVolume(p, c.id, sc, y), z: INT })), sumRow(r + 1, INT)));
      volRow.B2B = line(p.name, `Volume ${chName('B2B')}${clients.length ? ' (somme clients)' : ''}`, years.map((y, i) => {
        const forced = sc?.products[p.id]?.volumes?.[y]?.B2B;
        return clientRows.length && forced === undefined
          ? { f: `SUM(${yc(i)}${clientRows[0]}:${yc(i)}${clientRows[clientRows.length - 1]})`, z: INT }
          : { v: vols[i].B2B, z: INT };
      }), sumRow(r + 1, INT));
      volRow.OEM = line(p.name, `Volume ${chName('OEM')}`, vols.map(v => ({ v: v.OEM, z: INT })), sumRow(r + 1, INT));
      const u = line(p.name, 'Unités totales', years.map((_, i) => ({ f: CHS.map(ch => `${yc(i)}${volRow[ch]}`).join('+'), z: INT })), sumRow(r + 1, INT));
      const ca = line(p.name, 'CA HT (€)', years.map((_, i) => ({ f: CHS.map(ch => `${yc(i)}${volRow[ch]}*${yc(i)}${priceRow[ch]}`).join('+'), z: EUR0 })), sumRow(r + 1, EUR0));
      const co = line(p.name, 'Coût de revient total (€)', years.map((_, i) => ({ f: `${yc(i)}${u}*${yc(i)}${costRow}`, z: EUR0 })), sumRow(r + 1, EUR0));
      const mg = line(p.name, 'Marge brute (€)', years.map((_, i) => ({ f: `${yc(i)}${ca}-${yc(i)}${co}`, z: EUR0 })), sumRow(r + 1, EUR0));
      line(p.name, 'Marge brute (%)', years.map((_, i) => ({ f: `IF(${yc(i)}${ca}=0,0,${yc(i)}${mg}/${yc(i)}${ca})`, z: PCT })), { f: `IF(${col(totCol)}${ca}=0,0,${col(totCol)}${mg}/${col(totCol)}${ca})`, z: PCT });
      unitRows.push(u); caRows.push(ca); costRows.push(co);
      r++;
    });

    const res = scenarioResults(rawProducts, sc, years, planTransport);
    put(r, 0, { v: 'TOTAL' }); r++;
    const sumOf = (rows: number[], i: number) => rows.length ? rows.map(x => `${yc(i)}${x}`).join('+') : '0';
    const tu = line('TOTAL', 'Unités totales', years.map((_, i) => ({ f: sumOf(unitRows, i), z: INT })), sumRow(r + 1, INT));
    const tca = line('TOTAL', 'CA HT (€)', years.map((_, i) => ({ f: sumOf(caRows, i), z: EUR0 })), sumRow(r + 1, EUR0));
    const tco = line('TOTAL', 'Coût de revient total (€)', years.map((_, i) => ({ f: sumOf(costRows, i), z: EUR0 })), sumRow(r + 1, EUR0));
    const tmb = line('TOTAL', 'Marge brute (€)', years.map((_, i) => ({ f: `${yc(i)}${tca}-${yc(i)}${tco}`, z: EUR0 })), sumRow(r + 1, EUR0));
    const ttr = line('TOTAL', 'Transport & expédition (€, saisie)', res.map(x => ({ v: Math.round(x.transport * 100) / 100, z: EUR0 })), sumRow(r + 1, EUR0));
    const tmn = line('TOTAL', 'Marge après transport (€)', years.map((_, i) => ({ f: `${yc(i)}${tmb}-${yc(i)}${ttr}`, z: EUR0 })), sumRow(r + 1, EUR0));
    const tpc = line('TOTAL', 'Marge après transport (%)', years.map((_, i) => ({ f: `IF(${yc(i)}${tca}=0,0,${yc(i)}${tmn}/${yc(i)}${tca})`, z: PCT })), { f: `IF(${col(totCol)}${tca}=0,0,${col(totCol)}${tmn}/${col(totCol)}${tca})`, z: PCT });
    totals.push({ sheet, name: ver.name, rows: { 'Unités': tu, 'CA HT (€)': tca, 'Marge brute (€)': tmb, 'Marge après transport (€)': tmn, 'Marge après transport (%)': tpc } });

    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: r, c: totCol } });
    ws['!cols'] = [{ wch: 34 }, { wch: 36 }, ...years.map(() => ({ wch: 13 })), { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws, sheet);
  });

  // Comparaison : formules liées aux totaux de chaque feuille.
  const cmp: XLSX.WorkSheet = {};
  let r = 0;
  const set = (row: number, c: number, cell: C) => { cmp[XLSX.utils.encode_cell({ r: row, c })] = { t: cell.f || typeof cell.v === 'number' ? 'n' : 's', v: cell.v ?? 0, ...(cell.f ? { f: cell.f } : {}), ...(cell.z ? { z: cell.z } : {}) }; };
  set(r++, 0, { v: 'Comparaison des versions (formules liées aux feuilles)' }); r++;
  set(r, 0, { v: 'Indicateur' }); set(r, 1, { v: 'Version' }); years.forEach((y, i) => set(r, firstY + i, { v: String(y) })); set(r, totCol, { v: 'Total' }); set(r, totCol + 1, { v: 'Écart vs 1ʳᵉ version' }); r++;
  const metrics = Object.keys(totals[0]?.rows ?? {});
  metrics.forEach(m => {
    const first = r + 1;
    totals.forEach(t => {
      const z = m.includes('%') ? PCT : m === 'Unités' ? INT : EUR0;
      set(r, 0, { v: m }); set(r, 1, { v: t.name });
      [...years.map((_, i) => yc(i)), col(totCol)].forEach((c, i) => set(r, firstY + i, { f: `${ref(t.sheet)}!${c}${t.rows[m]}`, z }));
      set(r, totCol + 1, { f: `${col(totCol)}${r + 1}-${col(totCol)}${first}`, z });
      r++;
    });
    r++;
  });
  cmp['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r, c: totCol + 1 } });
  cmp['!cols'] = [{ wch: 28 }, { wch: 28 }, ...years.map(() => ({ wch: 13 })), { wch: 15 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, cmp, 'Comparaison');
  wb.SheetNames = ['Comparaison', ...wb.SheetNames.filter(n => n !== 'Comparaison')];
  return wb;
}

export function downloadScenarioWorkbook(...args: Parameters<typeof buildScenarioWorkbook>) {
  const wb = buildScenarioWorkbook(...args);
  XLSX.writeFile(wb, `plan-produit-scenarios-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
