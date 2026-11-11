const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const PIPE_PERIODS = [
  { key: 'month', label: 'Mois en cours' }, { key: 'previous', label: 'Mois précédent' },
  { key: 'pick_month', label: 'Choisir un mois' }, { key: 'custom', label: 'Période personnalisée' },
  { key: '3m', label: '3 derniers mois' }, { key: 'year', label: 'Année en cours' }, { key: '12m', label: '12 derniers mois' },
];
export function pipePeriod(key: string, month: string, from: string, to: string, now = new Date()) {
  const end = iso(now);
  if (key === 'custom') return { from, to };
  if (key === 'pick_month' && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    return { from: `${month}-01`, to: iso(new Date(y, m, 0)) };
  }
  if (key === 'previous') return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
  const start = key === 'year' ? new Date(now.getFullYear(), 0, 1) : key === '3m' ? new Date(now.getFullYear(), now.getMonth() - 2, 1) : key === '12m' ? new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) : new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(start), to: end };
}
export function validPeriod(from: string, to: string) {
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
  return valid(from) && valid(to) && from <= to;
}