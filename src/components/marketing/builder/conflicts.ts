// Pure conflict detection between a campaign draft and the latest Google Ads structure snapshot (read-only).
export type DraftLike = {
  campaign_type: string; countries: string[]; daily_budget: number | null;
  offerIds: string[]; keywords: string[]; labels: string[]; productTypes: string[];
};
export type Conflict = { level: 'bloquant' | 'attention' | 'info'; campaign?: string; message: string };

type Listing = { campaign_id: string; type?: string; negative?: boolean; dim: string | null; value: string | null };

const norm = (s: any) => String(s ?? '').trim().toLowerCase();

/** Returns what a campaign's listing tree targets: 'all' when no positive subdivision with a value exists. */
export function listingScope(listing: Listing[]) {
  const units = listing.filter((l) => !l.negative && l.dim && l.value != null && l.value !== '');
  if (!units.length) return 'all' as const;
  return units.map((u) => ({ dim: u.dim!, value: norm(u.value) }));
}

export function checkConflicts(d: DraftLike, snap: any, totalMonthly?: number): Conflict[] {
  const out: Conflict[] = [];
  const data = snap?.data ?? {};
  if (!snap) out.push({ level: 'attention', message: "Aucune lecture de structure Google Ads : relancez l'Audit avant de valider." });
  if (!d.countries.length) out.push({ level: 'bloquant', message: 'Aucun pays ciblé.' });
  if (!d.daily_budget || d.daily_budget <= 0) out.push({ level: 'bloquant', message: 'Budget quotidien manquant.' });
  if (d.campaign_type !== 'SEARCH' && !d.offerIds.length) out.push({ level: 'bloquant', message: 'Aucun produit Merchant éligible sélectionné.' });
  if (d.campaign_type === 'SEARCH' && !d.keywords.length) out.push({ level: 'bloquant', message: 'Aucun mot-clé.' });

  const camps = (data.campaigns ?? []).filter((c: any) => c.status === 'ENABLED');
  const locs = new Map<string, string[]>();
  const kws = new Map<string, Set<string>>();
  for (const c of data.criteria ?? []) {
    if (c.negative) continue;
    if (c.type === 'LOCATION') locs.set(c.campaign_id, [...(locs.get(c.campaign_id) ?? []), String(c.value)]);
    if (c.type === 'KEYWORD') { const s = kws.get(c.campaign_id) ?? new Set(); s.add(norm(c.value)); kws.set(c.campaign_id, s); }
  }
  for (const g of data.ad_group_keywords ?? []) { const s = kws.get(g.campaign_id) ?? new Set(); s.add(norm(g.text)); kws.set(g.campaign_id, s); }
  const listing = new Map<string, Listing[]>();
  for (const l of [...(data.listing_groups_pmax ?? []), ...(data.listing_groups_shopping ?? [])]) listing.set(l.campaign_id, [...(listing.get(l.campaign_id) ?? []), l]);
  const served = new Map<string, Set<string>>();
  for (const p of data.products_90d ?? []) { const s = served.get(p.campaign_id) ?? new Set(); s.add(norm(p.item_id)); served.set(p.campaign_id, s); }

  const myOffers = new Set(d.offerIds.map(norm));
  const myLabels = new Set(d.labels.map(norm));
  const myTypes = new Set(d.productTypes.map(norm));
  const myKw = new Set(d.keywords.map(norm));

  for (const c of camps) {
    const cl = locs.get(c.id) ?? [];
    // No location criterion = all countries.
    const shared = cl.length ? d.countries.filter((x) => cl.some((l) => l === x || l.endsWith(`(${x})`))) : d.countries;
    if (!shared.length) continue;
    const isProduct = c.type === 'SHOPPING' || c.type === 'PERFORMANCE_MAX';
    if (d.campaign_type !== 'SEARCH' && isProduct) {
      const scope = listingScope(listing.get(c.id) ?? []);
      let overlap = 0; let how = '';
      if (scope === 'all') { overlap = myOffers.size; how = 'tout le catalogue'; }
      else {
        const hits = new Set<string>();
        for (const u of scope) {
          if (u.dim === 'item_id' && myOffers.has(u.value)) hits.add(u.value);
          if (u.dim.startsWith('custom_label_') && myLabels.has(`${u.dim.slice(-1)}:${u.value}`)) hits.add(`${u.dim}:${u.value}`);
          if (u.dim === 'product_type' && myTypes.has(u.value)) hits.add(`type:${u.value}`);
        }
        overlap = hits.size; how = 'groupes de fiches communs';
      }
      const srv = served.get(c.id); const servedOverlap = srv ? [...myOffers].filter((o) => srv.has(o)).length : 0;
      if (overlap || servedOverlap) {
        const pmaxVsShopping = d.campaign_type !== c.type;
        const reason = pmaxVsShopping
          ? (d.campaign_type === 'PERFORMANCE_MAX'
            ? "Google donne la priorité à PMax sur Shopping pour un même produit et un même pays : la nouvelle PMax prendrait le trafic de cette campagne Shopping. Acceptable si c'est voulu (remplacement progressif) ; sinon excluez ces produits de l'une des deux."
            : "La PMax existante est prioritaire sur Shopping pour ces produits : la nouvelle campagne Shopping risque de très peu diffuser. Excluez ces produits de la PMax ou réservez la Shopping aux produits hors PMax.")
          : "Deux campagnes du même type sur les mêmes produits se font concurrence : Google choisit selon la priorité et l'enchère, ce qui rend les résultats difficiles à lire.";
        out.push({
          level: 'attention', campaign: c.name,
          message: `${c.type === 'PERFORMANCE_MAX' ? 'PMax' : 'Shopping'} active en ${shared.join(', ')} : ${how}${overlap && how !== 'tout le catalogue' ? ` (${overlap})` : ''}${servedOverlap ? ` · ${servedOverlap} produits du projet diffusés par elle sur 90 j` : ''}. ${reason}`,
        });
      }
    }
    if (d.campaign_type === 'SEARCH' && c.type === 'SEARCH') {
      const k = kws.get(c.id); const common = k ? [...myKw].filter((w) => k.has(w)) : [];
      if (common.length) out.push({ level: 'attention', campaign: c.name, message: `Mots-clés déjà présents (${shared.join(', ')}) : ${common.slice(0, 8).join(', ')}${common.length > 8 ? '…' : ''}.` });
    }
    if (d.campaign_type === 'SEARCH' && c.type === 'PERFORMANCE_MAX') out.push({ level: 'info', campaign: c.name, message: `PMax active en ${shared.join(', ')} : elle peut capter les mêmes recherches ; les mots-clés exacts Search restent prioritaires.` });
  }
  if (totalMonthly != null && d.daily_budget) {
    const current = camps.reduce((s: number, c: any) => s + (Number(c.budget) || 0), 0);
    out.push({ level: 'info', message: `Budget Google actuel ≈ ${Math.round(current * 30.4)} €/mois + projet ${Math.round(d.daily_budget * 30.4)} €/mois, pour une enveloppe Google+Meta de référence de ${Math.round(totalMonthly)} €/mois (indicatif, sans obligation de dépenser).` });
  }
  return out;
}
