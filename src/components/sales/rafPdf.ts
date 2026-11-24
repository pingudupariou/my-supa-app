import { jsPDF } from 'jspdf';
import { MONTHS, SEG_LABEL, SEGMENTS, fmtAmount, yearShare, type Unit, buildGrid } from './rafReportModel';

export type RafPdfOptions = {
  title: string; comment: string; sections: string[]; // 'ALL' | segment | 'mix'
  tables: boolean; charts: boolean; budget: boolean; years: number[]; unit: Unit; modeLabel: string; asOf: string;
};
type Grid = ReturnType<typeof buildGrid>;
const PAL: [number, number, number][] = [[148, 163, 184], [16, 150, 110], [37, 99, 235], [234, 150, 20], [190, 60, 60]];

export function buildRafPdf(g: Grid, budget: Record<number, number>, o: RafPdfOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 12; let y = M;
  const cy = o.years[o.years.length - 1];
  const fmt = (v: number | null | undefined) => fmtAmount(v, o.unit, false).replace(/[\u202f\u00a0]/g, ' ');
  const footer = () => { doc.setFontSize(7); doc.setTextColor(120); doc.text(`${o.title} — ${o.modeLabel} — données arrêtées au ${o.asOf} — montants HT en ${o.unit === 'keur' ? 'k€' : '€'}`, M, H - 6); doc.text(`${doc.getNumberOfPages()}`, W - M, H - 6, { align: 'right' }); doc.setTextColor(0); };
  const newPage = () => { footer(); doc.addPage(); y = M; };
  const need = (h: number) => { if (y + h > H - 12) newPage(); };

  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(o.title, M, y + 6); y += 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  doc.text(`${o.modeLabel} · ${o.years.join(', ')} · arrêté au ${o.asOf} · édité le ${new Date().toLocaleDateString('fr-FR')}`, M, y + 3); y += 7; doc.setTextColor(0);
  if (o.comment.trim()) { const lines = doc.splitTextToSize(o.comment.trim(), W - 2 * M); doc.setFontSize(10); doc.text(lines, M, y + 4); y += lines.length * 4.6 + 4; }

  const table = (head: string[], rows: (string)[][], boldLast = true) => {
    const colW = (W - 2 * M) / head.length, rh = 5.2;
    need(rh * (rows.length + 1) + 2);
    doc.setFillColor(30, 41, 59); doc.rect(M, y, W - 2 * M, rh, 'F'); doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    head.forEach((h, i) => doc.text(h, i === 0 ? M + 2 : M + colW * (i + 1) - 2, y + 3.7, { align: i === 0 ? 'left' : 'right' }));
    y += rh; doc.setTextColor(0);
    rows.forEach((r, ri) => {
      const last = boldLast && ri === rows.length - 1;
      if (ri % 2 === 0 && !last) { doc.setFillColor(243, 245, 248); doc.rect(M, y, W - 2 * M, rh, 'F'); }
      if (last) { doc.setDrawColor(30, 41, 59); doc.line(M, y, W - M, y); }
      doc.setFont('helvetica', last ? 'bold' : 'normal');
      r.forEach((c, i) => { if (c.startsWith('-') && i > 0) doc.setTextColor(190, 40, 40); doc.text(c, i === 0 ? M + 2 : M + colW * (i + 1) - 2, y + 3.7, { align: i === 0 ? 'left' : 'right' }); doc.setTextColor(0); });
      y += rh;
    });
    y += 4;
  };

  const chart = (series: { name: string; values: (number | null)[] }[], kind: 'bar' | 'line', stacked = false) => {
    const h = 62; need(h + 12);
    const x0 = M + 14, x1 = W - M, y0 = y + 2, y1 = y + h;
    const all = stacked ? MONTHS.map((_, i) => series.reduce((s, se) => s + Math.max(0, se.values[i] ?? 0), 0)) : series.flatMap((s) => s.values.map((v) => v ?? 0));
    const max = Math.max(1, ...all) * 1.08;
    doc.setFontSize(6.5); doc.setDrawColor(225);
    for (let t = 0; t <= 4; t++) { const yy = y1 - ((y1 - y0) * t) / 4; doc.line(x0, yy, x1, yy); doc.setTextColor(120); doc.text(fmtAmount((max * t) / 4, 'keur').replace(/[\u202f\u00a0]/g, ' '), x0 - 1, yy + 1, { align: 'right' }); }
    const slot = (x1 - x0) / 12;
    const SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    MONTHS.forEach((m, i) => doc.text(SHORT[i], x0 + slot * i + slot / 2, y1 + 3.5, { align: 'center' }));
    doc.setTextColor(0);
    const Y = (v: number) => y1 - ((y1 - y0) * v) / max;
    if (kind === 'bar' && !stacked) {
      const bw = (slot * 0.8) / series.length;
      series.forEach((s, si) => { doc.setFillColor(...PAL[si % PAL.length]); s.values.forEach((v, i) => { if (v == null || v <= 0) return; doc.rect(x0 + slot * i + slot * 0.1 + bw * si, Y(v), bw - 0.3, y1 - Y(v), 'F'); }); });
    } else if (stacked) {
      MONTHS.forEach((_, i) => { let base = 0; series.forEach((s, si) => { const v = Math.max(0, s.values[i] ?? 0); if (!v) return; doc.setFillColor(...PAL[si % PAL.length]); doc.rect(x0 + slot * i + slot * 0.2, Y(base + v), slot * 0.6, Y(base) - Y(base + v), 'F'); base += v; }); });
    } else {
      series.forEach((s, si) => { doc.setDrawColor(...PAL[si % PAL.length]); doc.setLineWidth(0.6); let prev: [number, number] | null = null;
        s.values.forEach((v, i) => { if (v == null) { prev = null; return; } const p: [number, number] = [x0 + slot * i + slot / 2, Y(v)]; if (prev) doc.line(prev[0], prev[1], p[0], p[1]); doc.setFillColor(...PAL[si % PAL.length]); doc.circle(p[0], p[1], 0.7, 'F'); prev = p; }); });
      doc.setLineWidth(0.2);
    }
    let lx = x0; const ly = y1 + 8; doc.setFontSize(7.5);
    series.forEach((s, si) => { doc.setFillColor(...PAL[si % PAL.length]); doc.rect(lx, ly - 2.3, 3, 3, 'F'); doc.text(s.name, lx + 4, ly); lx += doc.getTextWidth(s.name) + 10; });
    y = ly + 5;
  };

  const heading = (t: string) => { need(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(t, M, y + 5); doc.setFont('helvetica', 'normal'); y += 8; };
  const sum = (yr: number, seg: string) => MONTHS.reduce((s, _, i) => s + (g[yr]?.[i + 1]?.[seg] ?? 0), 0);

  let first = true;
  for (const sec of o.sections) {
    if (!first) newPage(); first = false;
    if (sec === 'mix') {
      for (const yr of o.years) {
        heading(`Ventes ${yr} par type de client`);
        const share = yearShare(g, yr);
        if (o.tables) table(['Mois', ...SEGMENTS.map((s) => SEG_LABEL[s]), 'Total'], [
          ...MONTHS.map((m, i) => [m, ...SEGMENTS.map((s) => fmt(g[yr]?.[i + 1]?.[s])), fmt(g[yr]?.[i + 1]?.ALL)]),
          ['Total', ...SEGMENTS.map((s) => fmt(sum(yr, s))), fmt(sum(yr, 'ALL'))],
          ['Répartition', ...share.map((s) => `${s.pct.toFixed(0)} %`), '100 %'],
        ]);
        if (o.charts) chart(SEGMENTS.map((s) => ({ name: SEG_LABEL[s], values: MONTHS.map((_, i) => g[yr]?.[i + 1]?.[s] ?? null) })), 'bar', true);
        if (yr !== o.years[o.years.length - 1]) newPage();
      }
      continue;
    }
    const isAll = sec === 'ALL'; const withB = isAll && o.budget;
    heading(isAll ? 'CA facturé global — comparaison mois par mois' : `Ventes mensuelles ${SEG_LABEL[sec]}`);
    if (o.tables) table(['Mois', ...o.years.map(String), ...(withB ? [`Budget ${cy}`, 'Écart'] : []), ...(o.years.length > 1 ? [`Évol. ${cy}/${o.years[o.years.length - 2]}`] : [])], [
      ...MONTHS.map((m, i) => { const cur = g[cy]?.[i + 1]?.[sec]; const prev = o.years.length > 1 ? g[o.years[o.years.length - 2]]?.[i + 1]?.[sec] : null; const b = budget[i + 1];
        return [m, ...o.years.map((yr) => fmt(g[yr]?.[i + 1]?.[sec])), ...(withB ? [fmt(b), cur != null && b != null ? fmt(cur - b) : ''] : []), ...(o.years.length > 1 ? [cur != null && prev ? `${(((cur - prev) / prev) * 100).toFixed(0)} %` : ''] : [])]; }),
      ['Total', ...o.years.map((yr) => fmt(sum(yr, sec))), ...(withB ? [fmt(Object.values(budget).reduce((a, b) => a + b, 0)), ''] : []), ...(o.years.length > 1 ? [''] : [])],
    ]);
    if (o.charts) chart([...o.years.map((yr) => ({ name: String(yr), values: MONTHS.map((_, i) => g[yr]?.[i + 1]?.[sec] ?? null) })), ...(withB ? [{ name: 'Budget', values: MONTHS.map((_, i) => budget[i + 1] ?? null) }] : [])], isAll ? 'bar' : 'line');
  }
  footer();
  return doc;
}
