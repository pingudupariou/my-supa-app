// Statistiques commerciales: read-only import of Erplain invoices and credit notes (the only sales source).
// Every field is selected only after it is verified in the Erplain schema (cached), never guessed.
// One sale = one invoice line at the invoice date; credit notes are deducted at their own date.
// Drafts and cancelled documents are stored but not counted. Erplain is never written.
import type { Gql } from "./erplain.ts";

const unwrap = (t: any): any => (t?.ofType ? unwrap(t.ofType) : t);
const num = (v: any) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

async function typeDef(admin: any, gql: Gql, name: string): Promise<any> {
  const { data: c } = await admin.from("erplain_schema_cache").select("data").eq("type_name", name).maybeSingle();
  if (c?.data?.fields || c?.data?.enumValues || c?.data?.inputFields) return c.data;
  const r = await gql(`Définition ${name}`, `{ __type(name: ${JSON.stringify(name)}) { kind name fields { name type { kind name ofType { kind name ofType { kind name ofType { kind name } } } } } enumValues { name } inputFields { name type { kind name ofType { kind name ofType { kind name } } } } } }`);
  if (r.timeout) throw new Error("Délai atteint pendant la lecture du schéma Erplain");
  const t = r.data?.__type;
  if (!t) throw new Error(`Type Erplain ${name} introuvable : ${r.errors.join(" | ")}`);
  await admin.from("erplain_schema_cache").upsert({ type_name: name, data: t, fetched_at: new Date().toISOString() });
  return t;
}

type Spec = { scalars: string[]; objects?: Record<string, Spec> };
// Builds a selection using only fields that exist; returns the selection and the list of verified paths.
async function build(admin: any, gql: Gql, typeName: string, spec: Spec, depth = 0, path = ""): Promise<{ sel: string; used: string[] }> {
  const t = await typeDef(admin, gql, typeName);
  const fields = new Map<string, any>((t.fields ?? []).map((f: any) => [f.name, unwrap(f.type)]));
  const parts: string[] = []; const used: string[] = [];
  for (const s of spec.scalars) {
    const ft = fields.get(s);
    if (ft && (ft.kind === "SCALAR" || ft.kind === "ENUM")) { parts.push(s); used.push(path + s); }
  }
  if (depth < 2) for (const [name, sub] of Object.entries(spec.objects ?? {})) {
    const ft = fields.get(name);
    if (!ft || ft.kind !== "OBJECT") continue;
    const inner = await build(admin, gql, ft.name, sub, depth + 1, `${path}${name}.`);
    if (inner.sel) { parts.push(`${name} { ${inner.sel} }`); used.push(...inner.used); }
  }
  return { sel: parts.join(" "), used };
}

const NAME = ["id", "company_name", "display_name", "name", "label", "first_name", "last_name"];
const ADDRESS: Spec = { scalars: ["country_code", "country_iso", "country_iso_code", "country"], objects: { country: { scalars: ["code", "iso", "iso_code", "alpha2", "label", "name"] } } };
const DOC: Spec = {
  scalars: ["id", "label", "status", "dated_at", "created_at", "currency", "source", "external_reference", "integrations",
    "total_without_tax", "subtotal", "total", "total_taxes", "shipping_cost", "shipping_amount", "total_shipping", "shipping_price", "order_id"],
  objects: {
    customer: { scalars: NAME },
    order: { scalars: ["id", "label", "source", "integrations", "external_reference"] },
    shipping_address: ADDRESS, billing_address: ADDRESS,
    line_items: { scalars: ["id", "sku", "label", "type", "quantity", "price", "total", "total_without_tax", "tax_amount"], objects: { variant: { scalars: ["id", "sku", "label"] } } },
  },
};

const PHASES = [{ key: "invoices", root: "Invoices", type: "Invoice", docType: "invoice" }, { key: "credit_notes", root: "CreditNotes", type: "CreditNote", docType: "credit_note" }];
const PAGE = 20;

async function rootReturnType(admin: any, gql: Gql, root: string) {
  const q = await typeDef(admin, gql, "Query");
  const f = (q.fields ?? []).find((x: any) => x.name === root);
  if (!f) throw new Error(`Erplain ne propose pas ${root}`);
  const pag = await typeDef(admin, gql, unwrap(f.type).name);
  const data = (pag.fields ?? []).find((x: any) => x.name === "data");
  return unwrap(data?.type)?.name as string;
}

async function orderArg(admin: any, gql: Gql, root: string) {
  try {
    const e = await typeDef(admin, gql, `Query${root}OrderByColumn`);
    const vals = (e.enumValues ?? []).map((v: any) => v.name);
    return vals.includes("ID") ? `, orderBy: [{ column: ID, order: ASC }]` : "";
  } catch { return ""; }
}

const country = (a: any) => {
  if (!a) return null;
  const c = a.country_code ?? a.country_iso ?? a.country_iso_code ?? (typeof a.country === "string" ? a.country : (a.country?.code ?? a.country?.iso ?? a.country?.iso_code ?? a.country?.alpha2 ?? a.country?.label ?? a.country?.name));
  return c ? String(c).trim().toUpperCase().slice(0, 40) : null;
};
const custName = (c: any) => c ? (c.company_name || c.display_name || c.name || c.label || [c.first_name, c.last_name].filter(Boolean).join(" ") || null) : null;
const SHIP_RX = /shipping|delivery|livraison|transport|\bport\b|frais de port/i;
const EXCL_RX = /draft|brouillon|cancel|annul|void/i;

function toRows(d: any, docType: string, runId: string) {
  const sign = docType === "credit_note" ? -1 : 1;
  const id = `${docType}:${d.id}`;
  const ttc = num(d.total), tax = num(d.total_taxes);
  let ht = num(d.total_without_tax) ?? (ttc !== null && tax !== null ? ttc - tax : null);
  const shopTxt = [d.source, d.order?.source, JSON.stringify(d.integrations ?? null), JSON.stringify(d.order?.integrations ?? null)].join(" ");
  const isShopify = /shopify/i.test(shopTxt);
  const status = d.status != null ? String(d.status) : null;
  const excluded = status && EXCL_RX.test(status) ? `Statut ${status}` : null;
  const lines = (d.line_items ?? []).filter((l: any) => l?.id != null).map((l: any) => {
    const raw = num(l.total_without_tax) ?? num(l.total) ?? ((num(l.quantity) ?? 0) * (num(l.price) ?? 0));
    const ship = SHIP_RX.test(String(l.type ?? "")) || (!l.variant?.id && SHIP_RX.test(String(l.label ?? "")));
    return { id: `${id}:${l.id}`, document_id: id, variant_id: l.variant?.id != null ? String(l.variant.id) : null, sku: l.sku ?? l.variant?.sku ?? null,
      label: l.label ?? l.variant?.label ?? null, line_type: l.type != null ? String(l.type) : null, is_shipping: ship,
      quantity: ship ? null : Math.abs(num(l.quantity) ?? 0) * sign, raw_total: raw };
  });
  const docShip = num(d.shipping_cost) ?? num(d.shipping_amount) ?? num(d.total_shipping) ?? num(d.shipping_price);
  if (docShip && !lines.some((l: any) => l.is_shipping)) lines.push({ id: `${id}:ship`, document_id: id, variant_id: null, sku: null, label: "Livraison facturée", line_type: "document_shipping", is_shipping: true, quantity: null, raw_total: docShip });
  const rawSum = lines.reduce((s: number, l: any) => s + (l.raw_total ?? 0), 0);
  // Lines are scaled so that their sum equals the document HT total (discounts and line taxes spread pro rata).
  const factor = ht !== null && rawSum ? Math.abs(ht) / Math.abs(rawSum) * (rawSum < 0 ? -1 : 1) : null;
  for (const l of lines as any[]) l.amount_ht = factor !== null ? r2((l.raw_total ?? 0) * factor * sign) : null;
  if (ht !== null) ht = r2(Math.abs(ht) * sign);
  const shipHt = lines.filter((l: any) => l.is_shipping).reduce((s: number, l: any) => s + (l.amount_ht ?? 0), 0);
  return {
    doc: { id, doc_type: docType, erplain_id: Number(d.id), label: d.label ?? null, status, dated_at: (d.dated_at ?? d.created_at ?? null)?.slice?.(0, 10) ?? null,
      customer_id: d.customer?.id != null ? String(d.customer.id) : null, customer_name: custName(d.customer),
      order_id: d.order?.id != null ? String(d.order.id) : (d.order_id != null ? String(d.order_id) : null), source: d.source ?? d.order?.source ?? null,
      is_shopify: isShopify, shopify_reason: isShopify ? "Source ou intégration Shopify sur le document ou sa commande" : null,
      shipping_country: country(d.shipping_address), billing_country: country(d.billing_address), currency: d.currency ?? null,
      total_ht: ht, total_ttc: ttc !== null ? r2(Math.abs(ttc) * sign) : null, total_tax: tax !== null ? r2(Math.abs(tax) * sign) : null,
      shipping_ht: r2(shipHt), lines_raw: r2(rawSum), counted: !excluded && ht !== null, excluded_reason: excluded ?? (ht === null ? "Total HT absent" : null),
      run_id: runId, synced_at: new Date().toISOString() },
    lines,
  };
}

export async function salesSync(admin: any, gql: Gql, userId: string, restart: boolean, deadline: number) {
  let { data: run } = await admin.from("erplain_sales_sync_runs").select("*").eq("status", "running").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (run && (restart || Date.now() - new Date(run.updated_at).getTime() > 6 * 3600e3)) {
    await admin.from("erplain_sales_sync_runs").update({ status: "error", message: "Remplacée par une nouvelle lecture", finished_at: new Date().toISOString() }).eq("id", run.id);
    run = null;
  }
  if (!run) {
    const { data, error } = await admin.from("erplain_sales_sync_runs").insert({ started_by: userId }).select().single();
    if (error) throw new Error(error.message);
    run = data;
  }
  const totals = run.totals ?? {}; const errors: any[] = run.errors ?? [];
  const schema: any = run.schema ?? {};
  let { phase, page } = run;
  const save = (extra: any = {}) => admin.from("erplain_sales_sync_runs").update({ phase, page, totals, errors: errors.slice(-30), schema, updated_at: new Date().toISOString(), ...extra }).eq("id", run.id);

  while (phase !== "done" && Date.now() < deadline - 25000) {
    const ph = PHASES.find((p) => p.key === phase)!;
    if (!schema[ph.key]) {
      const t = await rootReturnType(admin, gql, ph.root);
      const b = await build(admin, gql, t, DOC);
      schema[ph.key] = { type: t, sel: b.sel, used: b.used, order: await orderArg(admin, gql, ph.root) };
      if (!b.used.includes("id")) throw new Error(`${ph.root} : identifiant absent du schéma`);
    }
    const s = schema[ph.key];
    const r = await gql(`${ph.root} page ${page}`, `{ ${ph.root}(first: ${PAGE}, page: ${page}${s.order}) { paginatorInfo { hasMorePages lastPage total } data { ${s.sel} } } }`);
    if (r.timeout) break;
    if (r.errors.length || !r.data?.[ph.root]) throw new Error(`${ph.root} page ${page} : ${r.errors.join(" | ") || "réponse vide"}`);
    const pi = r.data[ph.root].paginatorInfo; const items = r.data[ph.root].data ?? [];
    totals[ph.docType] = { ...(totals[ph.docType] ?? {}), expected: pi.total, read: (totals[ph.docType]?.read ?? 0) + items.length };
    const conv = items.map((d: any) => toRows(d, ph.docType, run.id));
    if (conv.length) {
      const docs = conv.map((c: any) => c.doc);
      const e1 = await admin.from("erplain_sales_documents").upsert(docs);
      if (e1.error) throw new Error(`Enregistrement documents : ${e1.error.message}`);
      await admin.from("erplain_sales_lines").delete().in("document_id", docs.map((x: any) => x.id));
      const lines = conv.flatMap((c: any) => c.lines);
      for (let i = 0; i < lines.length; i += 500) {
        const e2 = await admin.from("erplain_sales_lines").upsert(lines.slice(i, i + 500));
        if (e2.error) throw new Error(`Enregistrement lignes : ${e2.error.message}`);
      }
      const custs = [...new Map(docs.filter((x: any) => x.customer_id && !x.is_shopify).map((x: any) => [x.customer_id, { customer_id: x.customer_id, customer_name: x.customer_name }])).values()];
      if (custs.length) await admin.from("erplain_sales_customers").upsert(custs, { onConflict: "customer_id", ignoreDuplicates: true });
      const noLines = docs.filter((x: any) => !conv.find((c: any) => c.doc.id === x.id).lines.length).length;
      if (noLines) totals[ph.docType].no_lines = (totals[ph.docType].no_lines ?? 0) + noLines;
    }
    if (pi.hasMorePages) page++;
    else {
      const { count } = await admin.from("erplain_sales_documents").select("id", { count: "exact", head: true }).eq("doc_type", ph.docType).eq("run_id", run.id);
      totals[ph.docType].stored = count ?? 0;
      // Remove documents gone from Erplain only after a complete read whose count matches Erplain's total.
      if (count === pi.total) {
        const { count: gone } = await admin.from("erplain_sales_documents").delete({ count: "exact" }).eq("doc_type", ph.docType).neq("run_id", run.id);
        totals[ph.docType].removed = gone ?? 0;
      } else errors.push({ code: "count", message: `${ph.root} : ${count} enregistrés pour ${pi.total} annoncés par Erplain — historique incomplet, aucune suppression.` });
      const i = PHASES.findIndex((p) => p.key === phase);
      phase = PHASES[i + 1]?.key ?? "done"; page = 1;
    }
    await save();
  }
  if (phase === "done") {
    const bad = errors.some((e) => e.code === "count");
    await save({ status: bad ? "warning" : "success", finished_at: new Date().toISOString(), message: bad ? "Lecture terminée avec écarts" : "Lecture complète" });
  }
  const { data: saved } = await admin.from("erplain_sales_sync_runs").select("*").eq("id", run.id).single();
  return saved;
}
