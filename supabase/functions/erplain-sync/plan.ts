// Workshop plan calculation from synced erplain_* tables. Pure function, no Erplain call.
//
// Quantity semantics used (Erplain schema):
// - Order line: quantity = ordered, shipped_quantity = already shipped. Remaining to ship = quantity - shipped_quantity.
//   delivered_quantity is informative only (delivery happens after shipment, never subtracted again).
// - Order line reserved_quantity = stock already allocated to that line.
// - StockLevel: on_hand = physical, reserved = allocated to documents, available = on_hand - reserved (checked per row).
//   Usable assembled stock = available + reservations held by the lines counted in the need.
//   => the reserved part is counted once (as stock for its own line), never deducted twice.
// - Manufacturing order (not completed/cancelled): remaining_to_produce = finished units still to come.
// - MO component line: remaining_to_produce - reserved = components still to consume but not yet reserved;
//   they are removed from the component pool (reserved ones are already out of "available").

export const OPEN_ORDER = ["active"];
export const CLOSED_MO = ["completed", "cancelled"];

const key = (v: any, l: any) => `${v}|${l ?? "none"}`;
const n = (x: any): number | null => (x === null || x === undefined ? null : Number(x));
const sum = (a: (number | null)[]) => (a.some((x) => x === null) ? null : a.reduce((s: number, x) => s + (x as number), 0));

export function computePlan(data: { lines: any[]; stocks: any[]; mos: any[]; boms: any[]; routings: any[] }, opts: { includePending?: boolean; selectedLineIds?: number[] | null } = {}) {
  const statuses = opts.includePending ? [...OPEN_ORDER, "pending_validation"] : OPEN_ORDER;
  const selection = opts.selectedLineIds ? new Set(opts.selectedLineIds.map(Number)) : null;
  const stockBy = new Map<string, any>();
  const warnings: string[] = [];
  for (const s of data.stocks) {
    stockBy.set(key(s.variant_id, s.location_id), s);
    if (s.on_hand != null && s.reserved != null && s.available != null && Math.abs(s.on_hand - s.reserved - s.available) > 0.001)
      warnings.push(`Stock ${s.sku ?? s.variant_id} @ ${s.location_label ?? s.location_id} : disponible (${s.available}) ≠ réel (${s.on_hand}) − réservé (${s.reserved}).`);
  }
  const openMos = data.mos.filter((m) => !CLOSED_MO.includes(m.status));
  const linkedLine = new Map<number, any>();
  openMos.forEach((m) => (m.order_line_item_ids ?? []).forEach((id: number) => linkedLine.set(Number(id), m)));
  const routingById = new Map(data.routings.map((r) => [Number(r.id), r]));
  const bomsByVariant = new Map<number, any[]>();
  data.boms.filter((b) => b.active).forEach((b) => { const k = Number(b.variant_id); bomsByVariant.set(k, [...(bomsByVariant.get(k) ?? []), b]); });
  const dateOf = (l: any) => String(l.line_shipping_at ?? l.order_shipping_at ?? "9999");

  // All open lines (to ship), grouped by variant + location. Partial shipments: only the remainder.
  const groups = new Map<string, any>();
  const openLines: any[] = [];
  const excluded = { closedOrders: 0, fullyShipped: 0, noVariant: 0 };
  for (const li of data.lines) {
    if (!statuses.includes(li.order_status)) { excluded.closedOrders++; continue; }
    if (li.variant_id == null) { excluded.noVariant++; continue; }
    if (li.shipping_status === "shipped") { excluded.fullyShipped++; continue; }
    const remaining = li.quantity == null || li.shipped_quantity == null ? null : Math.max(0, li.quantity - li.shipped_quantity);
    if (remaining === 0) { excluded.fullyShipped++; continue; }
    const k = key(li.variant_id, li.location_id);
    if (!groups.has(k)) groups.set(k, { key: k, variant_id: li.variant_id, sku: li.sku, variant_label: li.variant_label, location_id: li.location_id, location_label: li.location_label, all: [] });
    const row = { ...li, remaining, linked_mo: linkedLine.get(Number(li.line_id))?.label ?? null, linked_mo_id: linkedLine.get(Number(li.line_id))?.id ?? null };
    groups.get(k).all.push(row);
    openLines.push(row);
  }
  const mapOpen = (l: any) => ({ line_id: l.line_id, order_id: l.order_id, customer_name: l.customer_name ?? null, variant_id: l.variant_id, location_id: l.location_id, order_label: l.order_label, order_status: l.order_status, shipping_status: l.shipping_status, shipping_at: l.line_shipping_at ?? l.order_shipping_at, order_created_at: l.order_created_at ?? null, order_dated_at: l.order_dated_at ?? null, sku: l.sku, variant_label: l.variant_label, location_label: l.location_label, quantity: l.quantity, shipped_quantity: l.shipped_quantity, remaining: l.remaining, reserved_quantity: l.reserved_quantity, linked_mo: l.linked_mo });
  // openLinesOnly: return only the lines to ship (for the selection table) without computing MO proposals.
  if (opts.openLinesOnly) return { proposals: [], warnings, excluded, statuses, openLines: openLines.map(mapOpen) };

  const proposals = [...groups.values()].map((g) => {
    const issues: string[] = [];
    g.all.sort((a: any, b: any) => dateOf(a).localeCompare(dateOf(b)));
    // Explicit allocations: own reservation, then MOs linked to specific lines (for every line, selected or not).
    for (const l of g.all) { l.own_reserved = l.remaining == null || l.reserved_quantity == null ? null : Math.min(Number(l.reserved_quantity), l.remaining); l.mo_alloc = 0; }
    const mos = openMos.filter((m) => key(m.variant_id, m.location_id) === g.key);
    let freeMo: number | null = 0;
    for (const m of mos) {
      let left = n(m.remaining_to_produce);
      if (left === null) { freeMo = null; continue; }
      for (const l of g.all.filter((x: any) => Number(x.linked_mo_id) === Number(m.id))) {
        // App-created MOs (no native link in Erplain): cap by the quantity the app recorded for this line.
        const cap = m.line_alloc ? Number(m.line_alloc[Number(l.line_id)] ?? 0) : Infinity;
        const take = Math.min(Math.max(0, l.remaining ?? 0), left, cap); l.mo_alloc += take; left -= take;
      }
      if (freeMo !== null) freeMo += left; // unlinked MO output: informative, not deducted
    }
    const lines = g.all.filter((l: any) => !selection || selection.has(Number(l.line_id)));
    const others = g.all.length - lines.length;
    const need = sum(lines.map((l: any) => l.remaining));
    if (need === null) issues.push("Quantité commandée ou expédiée manquante sur une ligne.");
    const reservedInScope = sum(lines.map((l: any) => l.own_reserved ?? 0));
    const st = stockBy.get(g.key);
    if (!st) issues.push("Aucun niveau de stock Erplain pour cette variante à cet emplacement.");
    else if (st.available == null || st.on_hand == null) issues.push("Stock disponible ou réel non renseigné par Erplain.");
    // Usable assembled stock = free stock + reservations held by selected lines (part of on_hand, not extra), capped by physical stock.
    let usable: number | null = null;
    let reservedUsed = 0;
    if (st && st.available != null && st.on_hand != null) {
      reservedUsed = Math.min(reservedInScope ?? 0, Math.max(0, Number(st.reserved ?? reservedInScope ?? 0)));
      usable = Math.max(0, Math.min(Number(st.on_hand), Math.max(0, Number(st.available)) + reservedUsed));
    }
    const linkedMo = lines.reduce((s: number, l: any) => s + l.mo_alloc, 0);
    const moRemaining = linkedMo;
    // Per line (earliest date first): open after linked MO, then usable stock; the rest is to build.
    let stockLeft = usable ?? 0;
    for (const l of lines) {
      if (l.remaining == null) { l.to_cover = null; continue; }
      const open = Math.max(0, l.remaining - l.mo_alloc);
      const fromStock = Math.min(open, stockLeft); stockLeft -= fromStock;
      l.stock_alloc = fromStock; l.to_cover = open - fromStock;
    }
    const toBuild = need !== null && usable !== null ? Math.max(0, need - usable - linkedMo) : null;
    const allCovered = lines.length > 0 && toBuild === 0;

    const cands = bomsByVariant.get(Number(g.variant_id)) ?? [];
    const bom = cands.find((b) => b.is_default) ?? cands[0] ?? null;
    if (!bom) issues.push("Aucune nomenclature active dans Erplain.");
    else if (cands.length > 1 && !cands.some((b) => b.is_default)) issues.push(`Plusieurs nomenclatures actives sans défaut ; « ${bom.label} » utilisée.`);
    const routingId = bom?.manufacturing_routing_id ?? null;
    const routing = routingId != null ? routingById.get(Number(routingId)) ?? null : null;
    if (routingId != null && !routing) issues.push("Gamme de la variante introuvable parmi les gammes actives.");

    const firstDate = lines.map((l: any) => l.line_shipping_at ?? l.order_shipping_at).filter(Boolean).sort()[0] ?? null;
    const uncovered = lines.filter((l: any) => (l.to_cover ?? 0) > 0).sort((a: any, b: any) => Number(a.line_id) - Number(b.line_id));
    const freeLineIds = uncovered.map((l: any) => Number(l.line_id));
    const coverage = lines.map((l: any) => ({ line_id: Number(l.line_id), order_label: l.order_label ?? l.order_id, remaining: l.remaining, reserved: l.own_reserved, mo_covered: l.mo_alloc, linked_mo: l.linked_mo, stock_covered: l.stock_alloc ?? 0, to_cover: l.to_cover }));
    return {
      key: g.key, variant_id: g.variant_id, sku: g.sku, variant_label: g.variant_label, location_id: g.location_id, location_label: g.location_label,
      first_shipping_at: firstDate, lines, other_open_lines: others,
      need, stock: st ? { on_hand: st.on_hand, available: st.available, reserved: st.reserved } : null, reserved_in_scope: reservedInScope, usable,
      mos: mos.map((m) => ({ id: m.id, label: m.label, status: m.status, quantity: m.quantity, remaining_to_produce: m.remaining_to_produce, linked: (m.order_line_item_ids ?? []).length > 0 })),
      mo_linked: linkedMo, mo_free: freeMo, reserved_used: reservedUsed, mo_remaining: moRemaining, to_build: allCovered ? 0 : toBuild, all_covered: allCovered, coverage,
      bom: bom ? { id: bom.id, label: bom.label } : null, routing: routing ? { id: routing.id, label: routing.label, steps: (routing.steps ?? []).length } : null,
      bom_components: bom?.components ?? [], free_line_ids: freeLineIds,
      components: [] as any[], buildable: null as number | null, status: "pending" as string, issues,
      idempotency_key: `v${g.variant_id}|l${g.location_id ?? "none"}|${uncovered.map((l: any) => `${l.line_id}:${l.to_cover}`).join(",")}`,
    };
  }).filter((p) => p.lines.length > 0);

  // Component pool per (component, location): available - unreserved needs of open MOs
  const pool = new Map<string, number | null>();
  const poolInit = (cid: any, loc: any) => {
    const k = key(cid, loc);
    if (pool.has(k)) return;
    const s = stockBy.get(k);
    if (!s || s.available == null) { pool.set(k, null); return; }
    let p = s.available;
    for (const m of openMos) if (key(0, m.location_id) === key(0, loc)) for (const l of m.lines ?? []) {
      if (Number(l.variant_id) !== Number(cid)) continue;
      if (l.remaining_to_produce == null) { pool.set(k, null); return; }
      p -= Math.max(0, l.remaining_to_produce - (l.reserved ?? 0));
    }
    pool.set(k, p);
  };

  proposals.sort((a, b) => String(a.first_shipping_at ?? "9999").localeCompare(String(b.first_shipping_at ?? "9999")));
  for (const p of proposals) {
    if (p.all_covered) { p.status = "covered"; continue; }
    if (p.to_build === null || p.issues.some((i) => !i.startsWith("Plusieurs"))) { p.status = "incomplete"; continue; }
    if (p.to_build === 0) { p.status = "covered"; continue; }
    if (!p.bom_components.length) { p.status = "incomplete"; p.issues.push("Nomenclature sans composant."); continue; }
    let buildable = p.to_build;
    for (const c of p.bom_components) {
      poolInit(c.component_id, p.location_id);
      const avail = pool.get(key(c.component_id, p.location_id));
      if (avail == null || c.quantity == null || c.quantity <= 0) { buildable = -1; p.issues.push(`Stock ou quantité inconnus pour le composant ${c.sku ?? c.component_id}.`); continue; }
      buildable = Math.min(buildable, Math.floor(Math.max(0, avail) / c.quantity));
    }
    if (buildable < 0) { p.status = "incomplete"; continue; }
    p.buildable = buildable;
    for (const c of p.bom_components) {
      const k = key(c.component_id, p.location_id);
      const before = pool.get(k) as number;
      const required = c.quantity * p.to_build;
      const allocated = c.quantity * buildable;
      pool.set(k, before - allocated);
      p.components.push({ component_id: c.component_id, sku: c.sku, label: c.label, per_unit: c.quantity, required, pool_before: before, allocated, missing: Math.max(0, required - Math.max(0, before)) });
    }
    p.status = buildable >= p.to_build ? "ready" : "shortage";
  }
  openLines.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  return { proposals, warnings, excluded, statuses, openLines: openLines.map(mapOpen) };
}

// No native order link: Erplain refuses MOs grouping lines of several sales orders.
// Line links and covered quantities are kept by the app (erplain_mo_submissions).
export function moPayload(p: any) {
  const input: Record<string, unknown> = {
    operation_type: "build",
    quantity: p.to_build,
    variant: { id: String(p.variant_id) },
    bill_of_material: { id: String(p.bom.id) },
  };
  if (p.location_id != null) input.location = { id: String(p.location_id) };
  if (p.routing) input.manufacturing_routing = { id: String(p.routing.id) };
  return input;
}
