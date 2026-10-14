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
