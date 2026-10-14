export type Daily = { campaign_id: string | number; day: string; cost: number; conversions: number; conversions_value: number; clicks: number; synced_at?: string };
export type Campaign = { id: string | number; name: string; type?: string; budget?: number; target_roas?: number | null };
export type Snapshot = { taken_at: string; campaigns: Campaign[] | null };
export type Metric = 'cost' | 'roas' | 'cpa' | 'conversions' | 'clicks';
export const METRICS: Record<Metric, { label: string; unit: string }> = {
  cost: { label: 'Dépenses', unit: '€' }, roas: { label: 'ROAS attribué', unit: '×' },
  cpa: { label: 'Coût / conversion attribuée', unit: '€' }, conversions: { label: 'Conversions attribuées', unit: '' }, clicks: { label: 'Clics', unit: '' },
};
export function metricValue(rows: Daily[], metric: Metric): number | null {
  if (!rows.length) return null;
  const total = (key: keyof Daily) => rows.reduce((s, r) => s + Number(r[key] ?? 0), 0);
  const cost = total('cost'), conversions = total('conversions');
  if (metric === 'roas') return cost > 0 ? total('conversions_value') / cost : null;
  if (metric === 'cpa') return conversions > 0 ? cost / conversions : null;
  return total(metric);
}
export const shiftDay = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
export function decisionSeries(rows: Daily[], campaigns: Campaign[], id: string, days: number, metric: Metric, end: string) {
  const campaign = campaigns.find(c => String(c.id) === id);
  const peers = campaigns.filter(c => String(c.id) !== id && campaign?.type && c.type === campaign.type);
  const peerIds = new Set(peers.map(c => String(c.id)));
  const start = shiftDay(end, 1 - days), previousStart = shiftDay(start, -days);
  const current = rows.filter(r => r.day >= start && r.day <= end);
  const previous = rows.filter(r => r.day >= previousStart && r.day < start);
  const series = Array.from({ length: days }, (_, i) => {
    const day = shiftDay(start, i), daily = current.filter(r => r.day === day);
    const peerRows = daily.filter(r => peerIds.has(String(r.campaign_id)));
    const count = new Set(peerRows.map(r => String(r.campaign_id))).size;
    const peerValue = metricValue(peerRows, metric);
    return { day, campaign: metricValue(daily.filter(r => String(r.campaign_id) === id), metric),
      peers: peerValue == null ? null : ['cost', 'conversions', 'clicks'].includes(metric) ? peerValue / count : peerValue };
  });
  const comparison = [campaign, ...peers].filter((c): c is Campaign => !!c).map(c => {
    const own = current.filter(r => String(r.campaign_id) === String(c.id));
    const before = previous.filter(r => String(r.campaign_id) === String(c.id));
    const value = metricValue(own, metric), prior = metricValue(before, metric);
    return { id: String(c.id), name: c.name, value, prior, days: new Set(own.map(r => r.day)).size,
      delta: value != null && prior != null && prior !== 0 ? (value - prior) / prior * 100 : null };
  }).sort((a, b) => a.id === id ? -1 : b.id === id ? 1 : (b.value ?? -Infinity) - (a.value ?? -Infinity));
  return { series, comparison, start, previousStart, peerCount: peers.length };
}
export function parameterHistory(snapshots: Snapshot[], id: string, kind: string) {
  return [...snapshots].sort((a, b) => a.taken_at.localeCompare(b.taken_at)).map(s => {
    const c = s.campaigns?.find(c => String(c.id) === id);
    const raw = kind === 'budget' ? c?.budget : c?.target_roas;
    return { at: s.taken_at, value: typeof raw === 'number' && Number.isFinite(raw) ? raw * (kind === 'budget' ? 1 : 100) : null };
  });
}