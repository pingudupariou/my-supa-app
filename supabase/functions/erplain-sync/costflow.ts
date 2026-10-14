// CostFlow ↔ Erplain read-only comparison preview. Never writes to Erplain nor to CostFlow tables.
// Erplain IDs are the keys; manual references are matched to Erplain components only by exact SKU = reference code.
import type { Gql } from "./erplain.ts";

const TIERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const COST = `unit_cost initial_cost last_cost last_purchased_price unit_manufacturing_cost`;
const n = (v: any) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const norm = (s: any) => String(s ?? "").trim().toLowerCase();

function costs(v: any) {
  return { unit_cost: n(v?.unit_cost), initial_cost: n(v?.initial_cost), last_cost: n(v?.last_cost), last_purchased_price: n(v?.last_purchased_price), unit_manufacturing_cost: n(v?.unit_manufacturing_cost) };
}
function pickBom(boms: any[]) {
  const live = (boms ?? []).filter((b) => b && b.active !== false);
  return live.find((b) => b.is_default) ?? (live.length === 1 ? live[0] : null);
}
const tierOf = (vol: number) => TIERS.reduce((p, c) => (Math.abs(c - vol) < Math.abs(p - vol) ? c : p));

async function variantDetail(gql: Gql, id: string) {
  const sub = `bill_of_materials { id label active is_default components { quantity component { id sku label type ${COST} } } }`;
  const full = `{ Variant(id: ${JSON.stringify(id)}) { id sku label type ${COST} product { id label }
    bill_of_materials { id label active is_default components { id quantity component { id sku label type ${COST} ${sub} } } } } }`;
  let r = await gql(`Variante ${id} + nomenclature`, full);
  let depth = 2;
  if (r.complexity || (r.errors.length && !r.data?.Variant)) {
    r = await gql(`Variante ${id} (niveau 1)`, full.replace(sub, "bill_of_materials { id is_default active }"));
    depth = 1;
  }
  if (r.errors.length && !r.data?.Variant) throw new Error(r.errors.join(" | "));
  return { v: r.data?.Variant ?? null, depth };
}

export async function costflowPreview(gql: Gql, userClient: any, body: any) {
  const ids: string[] = (Array.isArray(body.productIds) ? body.productIds : []).map(String).slice(0, 3);
  const chosen: Record<string, string> = body.variantChoices && typeof body.variantChoices === "object" ? body.variantChoices : {};
  if (!ids.length) throw new Error("Choisissez 1 à 3 produits CostFlow.");

  const [{ data: products, error: pe }, { data: bom, error: be }, { data: refs, error: re }] = await Promise.all([
    userClient.from("costflow_products").select("id,name,family,coefficient,default_volume,cost_mode,manual_unit_cost").in("id", ids),
    userClient.from("costflow_bom").select("product_id,reference_id,quantity").in("product_id", ids),
    userClient.from("costflow_references").select("id,code,name,price_vol_50,price_vol_100,price_vol_200,price_vol_500,price_vol_1000,price_vol_2000,price_vol_5000,price_vol_10000,currency,deleted_at"),
  ]);
  if (pe || be || re) throw new Error((pe || be || re).message);
  const refById = new Map((refs ?? []).map((r: any) => [r.id, r]));
  const refsByCode = new Map<string, any[]>();
  for (const r of refs ?? []) { if (r.deleted_at || !norm(r.code)) continue; const k = norm(r.code); refsByCode.set(k, [...(refsByCode.get(k) ?? []), r]); }

  const out: any[] = [];
  for (const id of ids) {
    const p = (products ?? []).find((x: any) => x.id === id);
    if (!p) { out.push({ productId: id, error: "Produit introuvable ou non autorisé." }); continue; }
    const tier = tierOf(Number(p.default_volume) || 500);
    const priceOf = (r: any) => n(r?.[`price_vol_${tier}`]);
    const manualLines = (bom ?? []).filter((b: any) => b.product_id === id).map((b: any) => ({ ref: refById.get(b.reference_id), quantity: Number(b.quantity) || 0 }));

    // 1. Variant match: explicit choice (Erplain ID) or search by product name, exact label/SKU only.
    let candidates: any[] = [];
    let variantId: string | null = chosen[id] ? String(chosen[id]) : null;
    let matchStatus = variantId ? "chosen" : "none";
    if (!variantId) {
      const r = await gql(`Recherche « ${p.name} »`, `{ Variants(first: 10, search: ${JSON.stringify(p.name)}) { data { id sku label type product { label } } } }`);
      candidates = (r.data?.Variants?.data ?? []).map((v: any) => ({ id: String(v.id), sku: v.sku, label: v.label, type: v.type, product: v.product?.label ?? null }));
      const exact = candidates.filter((c) => norm(c.label) === norm(p.name) || norm(c.sku) === norm(p.name) || norm(c.product) === norm(p.name));
      if (exact.length === 1) { variantId = exact[0].id; matchStatus = "exact"; }
      else matchStatus = candidates.length ? "ambiguous" : "none";
    }
    const manualByLine = manualLines.map((m) => ({ code: m.ref?.code ?? null, name: m.ref?.name ?? "Référence supprimée", referenceId: m.ref?.id ?? null, quantity: m.quantity, unitPrice: priceOf(m.ref), currency: m.ref?.currency ?? "EUR" }));
    const manualTotal = manualByLine.reduce((s, l) => s + l.quantity * (l.unitPrice ?? 0), 0);
    const base = { productId: id, name: p.name, family: p.family, tier, coefficient: Number(p.coefficient) || 1, costMode: p.cost_mode, manualUnitCost: n(p.manual_unit_cost), manualTotal, matchStatus, candidates };
    if (!variantId) { out.push({ ...base, lines: manualByLine.map((l) => ({ status: "manual_only", manual: l, erplain: null })) }); continue; }

    const { v, depth } = await variantDetail(gql, variantId);
    if (!v) { out.push({ ...base, matchStatus: "not_found", lines: [] }); continue; }
    const boms = v.bill_of_materials ?? [];
    const b = pickBom(boms);
    const warnings: string[] = [];
    if (!b && boms.length > 1) warnings.push(`${boms.length} nomenclatures actives sans nomenclature par défaut : choix ambigu, aucune retenue.`);
    if (!b && !boms.length) warnings.push("Aucune nomenclature Erplain pour cette variante.");
    if (depth === 1) warnings.push("Sous-ensembles lus sur un seul niveau (limite de complexité Erplain).");

    const used = new Set<number>();
    const lines: any[] = [];
    let erplainCump = 0, erplainCumpMissing = 0;
    for (const c of b?.components ?? []) {
      const comp = c.component ?? {};
      const q = n(c.quantity) ?? 0;
      const cc = costs(comp);
      const subBom = comp.type === "assembly" || (comp.bill_of_materials ?? []).length ? pickBom(comp.bill_of_materials ?? []) : null;
      // Sub-assembly: expanded children are informative only; the parent total uses the sub-assembly's own unit cost once.
      const children = (subBom?.components ?? []).map((sc: any) => ({ id: String(sc.component?.id), sku: sc.component?.sku, label: sc.component?.label, quantity: n(sc.quantity), ...costs(sc.component) }));
      const childrenCump = children.length ? children.reduce((s: number, x: any) => s + (x.quantity ?? 0) * (x.unit_cost ?? 0), 0) : null;
      if (cc.unit_cost === null) erplainCumpMissing++; else erplainCump += q * cc.unit_cost;
      const erp = { id: String(comp.id), sku: comp.sku ?? null, label: comp.label ?? null, type: comp.type ?? null, quantity: q, ...cc, isSubAssembly: !!subBom || comp.type === "assembly", children, childrenCump };
      const matches = comp.sku ? refsByCode.get(norm(comp.sku)) ?? [] : [];
      const idx = manualLines.findIndex((m, i) => !used.has(i) && m.ref && norm(m.ref.code) === norm(comp.sku));
      if (idx >= 0) used.add(idx);
      const manual = idx >= 0 ? manualByLine[idx] : null;
      const status = matches.length > 1 ? "ambiguous" : manual ? "matched" : matches.length === 1 ? "ref_not_in_bom" : "erplain_only";
      lines.push({ status, erplain: erp, manual, ambiguousRefs: matches.length > 1 ? matches.map((r: any) => ({ id: r.id, code: r.code, name: r.name })) : undefined,
        qtyGap: manual ? q - manual.quantity : null, unitGap: manual && cc.unit_cost !== null && manual.unitPrice !== null ? cc.unit_cost - manual.unitPrice : null,
        missingCost: cc.unit_cost === null });
    }
    manualLines.forEach((_, i) => { if (!used.has(i)) lines.push({ status: "manual_only", manual: manualByLine[i], erplain: null }); });

    out.push({ ...base, variant: { id: String(v.id), sku: v.sku, label: v.label, type: v.type, product: v.product?.label ?? null, ...costs(v) },
      bom: b ? { id: String(b.id), label: b.label, is_default: !!b.is_default } : null, bomCount: boms.length, warnings, lines,
      totals: { manual: manualTotal, erplainComponentsCump: erplainCump, erplainCumpMissing, variantCump: n(v.unit_cost), manufacturing: n(v.unit_manufacturing_cost) } });
  }
  return out;
}

// ---- Clean Erplain-only catalog for CostFlow (no dependency on costflow_* manual tables). ----
async function readAll(admin: any, table: string, cols: string) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

// List of variants from the last Erplain sync: stock summed across locations + default/active BOM info.
export async function costflowCatalog(admin: any) {
  const [stocks, boms] = await Promise.all([
    readAll(admin, "erplain_stock_levels", "variant_id,sku,variant_label,location_label,on_hand,available,reserved,incoming,synced_at"),
    readAll(admin, "erplain_boms", "id,label,active,is_default,variant_id,sku,variant_label,components,synced_at"),
  ]);
  const map = new Map<string, any>();
  const get = (id: string, sku: any, label: any) => {
    if (!map.has(id)) map.set(id, { id, sku: sku ?? null, label: label ?? null, on_hand: 0, available: 0, reserved: 0, incoming: 0, locations: [], bomCount: 0, bom: null, usedIn: 0 });
    return map.get(id);
  };
  let syncedStock: string | null = null, syncedBom: string | null = null;
  for (const s of stocks) {
    if (!s.variant_id) continue;
    const v = get(String(s.variant_id), s.sku, s.variant_label);
    for (const k of ["on_hand", "available", "reserved", "incoming"]) v[k] += Number(s[k]) || 0;
    v.locations.push({ label: s.location_label, on_hand: n(s.on_hand), available: n(s.available), reserved: n(s.reserved), incoming: n(s.incoming) });
    if (!syncedStock || s.synced_at > syncedStock) syncedStock = s.synced_at;
  }
  const byVariant = new Map<string, any[]>();
  for (const b of boms) {
    if (!b.variant_id) continue;
    if (!syncedBom || b.synced_at > syncedBom) syncedBom = b.synced_at;
    const k = String(b.variant_id); byVariant.set(k, [...(byVariant.get(k) ?? []), b]);
    for (const c of b.active !== false ? b.components ?? [] : []) if (c.component_id) get(String(c.component_id), c.sku, c.label).usedIn++;
  }
  // Where-used edges: only the retained BOM of each parent (default, or the single active one) — alternatives never add up.
  const edges: [string, string, number][] = [];
  let ambiguousParents = 0;
  for (const [k, list] of byVariant) {
    const v = get(k, list[0].sku, list[0].variant_label);
    v.bomCount = list.filter((b) => b.active !== false).length;
    const b = pickBom(list);
    v.bom = b ? { id: String(b.id), label: b.label, components: (b.components ?? []).length } : null;
    if (!b && v.bomCount > 1) ambiguousParents++;
    for (const c of b?.components ?? []) if (c.component_id != null) edges.push([k, String(c.component_id), n(c.quantity) ?? 0]);
  }
  // BOM list is complete only if the last run that read BOMs (full or "bom" mode) finished — it then deleted stale rows.
  const { data: runs } = await admin.from("erplain_sync_runs").select("status,finished_at,cursor").in("status", ["completed", "failed", "running"])
    .order("started_at", { ascending: false }).limit(50);
  const bomRun = (runs ?? []).find((r: any) => !r.cursor?.quick && (!r.cursor?.mode || r.cursor?.mode === "bom")) ?? null;
  const bomStatus = { complete: bomRun?.status === "completed", runStatus: bomRun?.status ?? null, finishedAt: bomRun?.finished_at ?? null, ambiguousParents };
  return { variants: [...map.values()], syncedStock, syncedBom, edges, bomStatus, readAt: new Date().toISOString() };
}

// Live read of one variant: Erplain costs + BOM; sub-assemblies counted once at their own CUMP.
export async function costflowVariant(gql: Gql, id: string) {
  if (!id) throw new Error("Variante manquante.");
  const { v, depth } = await variantDetail(gql, String(id));
  if (!v) throw new Error("Variante introuvable dans Erplain.");
  const boms = v.bill_of_materials ?? [];
  const b = pickBom(boms);
  const warnings: string[] = [];
  if (!b && boms.length > 1) warnings.push(`${boms.length} nomenclatures sans nomenclature par défaut : aucune retenue.`);
  if (depth === 1) warnings.push("Sous-ensembles lus sur un seul niveau (limite de complexité Erplain).");
  let total = 0, missing = 0;
  const lines = (b?.components ?? []).map((c: any) => {
    const comp = c.component ?? {};
    const q = n(c.quantity) ?? 0; const cc = costs(comp);
    const sub = pickBom(comp.bill_of_materials ?? []);
    if (cc.unit_cost === null) missing++; else total += q * cc.unit_cost;
    return { id: String(comp.id), sku: comp.sku ?? null, label: comp.label ?? null, type: comp.type ?? null, quantity: q, ...cc,
      isSubAssembly: !!sub || comp.type === "assembly",
      children: (sub?.components ?? []).map((sc: any) => ({ id: String(sc.component?.id), sku: sc.component?.sku, label: sc.component?.label, quantity: n(sc.quantity), ...costs(sc.component) })) };
  });
  const vc = costs(v);
  const analysis = analyzeCosts(missing ? null : total, vc.unit_cost, vc.unit_manufacturing_cost);
  return { variant: { id: String(v.id), sku: v.sku, label: v.label, type: v.type, product: v.product?.label ?? null, ...vc },
    bom: b ? { id: String(b.id), label: b.label } : null, lines, warnings, totals: { componentsCump: missing ? null : total, partialCump: total, missing }, analysis,
    readAt: new Date().toISOString(), live: true, depth };
}

/** Empirical check (Erplain documents no field semantics): which combination does the finished product's CUMP match?
 *  tolerance 2 % (min 0.05 €). Full cost is defined only from verified pieces, never summing a cost twice. */
export function analyzeCosts(comp: number | null, cump: number | null, mfg: number | null) {
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(0.05, Math.abs(b) * 0.02);
  const m = mfg ?? 0;
  let mfgMeaning: "zero" | "labor_only" | "includes_components" | "unknown" = "unknown";
  if (mfg === null || mfg === 0) mfgMeaning = "zero";
  else if (comp !== null && (close(mfg, comp) || mfg > comp)) mfgMeaning = "includes_components";
  else if (comp !== null) mfgMeaning = "labor_only";
  let cumpMatch: "components" | "components_plus_mfg" | "mfg" | "none" | "unknown" = "unknown";
  if (cump !== null && comp !== null) {
    if (mfg && mfgMeaning === "labor_only" && close(cump, comp + m)) cumpMatch = "components_plus_mfg";
    else if (close(cump, comp)) cumpMatch = "components";
    else if (mfg && close(cump, mfg)) cumpMatch = "mfg";
    else cumpMatch = "none";
  }
  // Full cost: components + manufacturing only if manufacturing is a separate (labor) cost; otherwise the manufacturing figure alone.
  let full: number | null = null; let fullFormula = "";
  if (comp !== null) {
    if (mfgMeaning === "zero") { full = comp; fullFormula = "Coût composants (aucun coût de fabrication renseigné)"; }
    else if (mfgMeaning === "labor_only") { full = comp + m; fullFormula = "Coût composants + coût de fabrication (main d'œuvre/gamme, distinct des composants)"; }
    else if (mfgMeaning === "includes_components") { full = m; fullFormula = "Coût de fabrication seul (il contient déjà les composants : pas d'addition)"; }
  }
  return { mfgMeaning, cumpMatch, full, fullFormula, gapCump: cump !== null && comp !== null ? cump - comp : null,
    gapCumpFull: cump !== null && full !== null ? cump - full : null };
}
