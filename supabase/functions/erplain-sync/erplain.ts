// Shared Erplain GraphQL client + read-only data sync. Only uses fields verified in the cached schema.
// The token is passed in and never logged or returned.

export type Gql = (label: string, query: string, variables?: Record<string, unknown>) => Promise<GqlResult>;
export type GqlResult = { data: any; errors: string[]; httpStatus: number | null; complexity: boolean; timeout: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function makeGql(token: string, endpoint: string, deadline: number, log: (s: any) => void): Gql {
  let lastCall = 0;
  let gap = 2000;
  return async (label, query, variables) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const wait = lastCall + gap - Date.now();
      if (wait > 0) await sleep(wait);
      if (Date.now() > deadline) return { data: null, errors: ["Délai d'exécution atteint"], httpStatus: null, complexity: false, timeout: true };
      const s = Date.now(); lastCall = s;
      try {
        const r = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(variables ? { query, variables } : { query }),
          signal: AbortSignal.timeout(25000),
        });
        const text = await r.text();
        if (r.status === 429) {
          const ra = Number(r.headers.get("Retry-After"));
          const delay = Number.isFinite(ra) && ra > 0 ? ra * 1000 : gap * 2;
          gap = Math.min(Math.max(gap * 1.5, 2000), 15000);
          log({ step: `${label} (429, attente ${Math.round(delay / 1000)} s)`, httpStatus: 429, ms: Date.now() - s, ok: false });
          if (Date.now() + delay > deadline) return { data: null, errors: ["Délai d'exécution atteint"], httpStatus: 429, complexity: false, timeout: true };
          await sleep(delay);
          continue;
        }
        let body: any = null; try { body = JSON.parse(text); } catch { /* */ }
        const errors: string[] = body ? (body.errors ?? []).map((e: any) => String(e?.message ?? "")).slice(0, 6) : [`Réponse non JSON (HTTP ${r.status})`];
        const ok = r.ok && !!body?.data && !errors.length;
        log({ step: label, httpStatus: r.status, ms: Date.now() - s, ok, errors: errors.length ? errors : undefined });
        return { data: body?.data ?? null, errors, httpStatus: r.status, complexity: errors.some((m) => /complex/i.test(m)) || r.status === 416, timeout: false };
      } catch (e) {
        const msg = String((e as Error).message).slice(0, 200);
        log({ step: label, httpStatus: null, ms: Date.now() - s, ok: false, errors: [msg] });
        return { data: null, errors: [msg], httpStatus: null, complexity: false, timeout: false };
      }
    }
    return { data: null, errors: ["429 persistant"], httpStatus: 429, complexity: false, timeout: false };
  };
}

const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
const PI = `paginatorInfo { hasMorePages currentPage lastPage total }`;
const V = `variant { id sku label }`;
const L = `location { id label }`;

export type Dataset = {
  key: string; table: string; root: string; size: number; idCol: string;
  args: (filter: string | null) => string;
  sel: string;
  rows: (item: any, runId: string) => any[];
};

export const DATASETS: Dataset[] = [
  {
    key: "orders", table: "erplain_order_lines", root: "Orders", size: 10, idCol: "line_id",
    args: (f) => (f ? `where: ${f}` : ""),
    sel: `id label status shipping_status delivery_status stock_allocation_status shipping_at
      line_items { id type parent_id kit_line_item_id variant_type shipping_at quantity shipped_quantity delivered_quantity reserved_quantity committed_quantity ${V} ${L} }`,
    rows: (o, run) => (o.line_items ?? []).filter((li: any) => li?.id != null).map((li: any) => ({
      line_id: li.id, order_id: o.id, order_label: o.label, order_status: o.status, shipping_status: o.shipping_status,
      delivery_status: o.delivery_status, stock_allocation_status: o.stock_allocation_status, order_shipping_at: o.shipping_at,
      line_shipping_at: li.shipping_at, line_type: li.type, parent_id: li.parent_id, kit_line_item_id: li.kit_line_item_id, variant_type: li.variant_type,
      variant_id: li.variant?.id ?? null, sku: li.variant?.sku ?? null, variant_label: li.variant?.label ?? null,
      location_id: li.location?.id ?? null, location_label: li.location?.label ?? null,
      quantity: num(li.quantity), shipped_quantity: num(li.shipped_quantity), delivered_quantity: num(li.delivered_quantity),
      reserved_quantity: num(li.reserved_quantity), committed_quantity: num(li.committed_quantity), run_id: run, synced_at: new Date().toISOString(),
    })),
  },
  {
    key: "stocks", table: "erplain_stock_levels", root: "StockLevels", size: 25, idCol: "id",
    args: () => "",
    sel: `id on_hand available reserved incoming ${V} ${L}`,
    rows: (s, run) => [{
      id: s.id, variant_id: s.variant?.id ?? null, sku: s.variant?.sku ?? null, variant_label: s.variant?.label ?? null,
      location_id: s.location?.id ?? null, location_label: s.location?.label ?? null,
      on_hand: num(s.on_hand), available: num(s.available), reserved: num(s.reserved), incoming: num(s.incoming), run_id: run, synced_at: new Date().toISOString(),
    }],
  },
  {
    key: "mos", table: "erplain_manufacturing_orders", root: "ManufacturingOrders", size: 10, idCol: "id",
    args: (f) => (f ? `where: ${f}` : ""),
    sel: `id label status operation_type quantity remaining_to_produce actually_produced due_at ${V} ${L}
      bill_of_material { id } manufacturing_routing { id } order_line_items { id }
      lines { id variant_id planned_quantity remaining_to_produce reserved }`,
    rows: (m, run) => [{
      id: m.id, label: m.label, status: m.status, operation_type: m.operation_type,
      variant_id: m.variant?.id ?? null, sku: m.variant?.sku ?? null, variant_label: m.variant?.label ?? null,
      location_id: m.location?.id ?? null, location_label: m.location?.label ?? null,
      quantity: num(m.quantity), remaining_to_produce: num(m.remaining_to_produce), actually_produced: num(m.actually_produced), due_at: m.due_at,
      bill_of_material_id: m.bill_of_material?.id ?? null, manufacturing_routing_id: m.manufacturing_routing?.id ?? null,
      order_line_item_ids: (m.order_line_items ?? []).map((x: any) => Number(x.id)).filter((x: number) => Number.isFinite(x)),
      lines: (m.lines ?? []).map((l: any) => ({ id: l.id, variant_id: l.variant_id, planned_quantity: num(l.planned_quantity), remaining_to_produce: num(l.remaining_to_produce), reserved: num(l.reserved) })),
      run_id: run, synced_at: new Date().toISOString(),
    }],
  },
  {
    key: "boms", table: "erplain_boms", root: "BillOfMaterials", size: 10, idCol: "id",
    args: () => "",
    sel: `id label active is_default variant_id variant { id sku label manufacturing_routing_id }
      components { id component_id quantity weight component { id sku label } }`,
    rows: (b, run) => [{
      id: b.id, label: b.label, active: b.active, is_default: b.is_default,
      variant_id: b.variant_id, sku: b.variant?.sku ?? null, variant_label: b.variant?.label ?? null, manufacturing_routing_id: b.variant?.manufacturing_routing_id ?? null,
      components: (b.components ?? []).map((c: any) => ({ id: c.id, component_id: c.component_id, quantity: num(c.quantity), weight: c.weight, sku: c.component?.sku ?? null, label: c.component?.label ?? null })),
      run_id: run, synced_at: new Date().toISOString(),
    }],
  },
  {
    key: "routings", table: "erplain_routings", root: "ManufacturingRoutings", size: 10, idCol: "id",
    args: () => "active: true",
    sel: `id label active steps { id label scope step_type is_required weight }`,
    rows: (r, run) => [{ id: r.id, label: r.label, active: r.active, steps: r.steps ?? [], run_id: run, synced_at: new Date().toISOString() }],
  },
];

// Read one "where column" enum (cached). Returns the enum values or null.
export async function whereColumns(admin: any, gql: Gql, typeName: string): Promise<string[] | null | "timeout"> {
  const { data: c } = await admin.from("erplain_schema_cache").select("data").eq("type_name", typeName).maybeSingle();
  if (c?.data?.enumValues) return c.data.enumValues.map((v: any) => v.name);
  const r = await gql(`Définition ${typeName}`, `{ __type(name: ${JSON.stringify(typeName)}) { kind name enumValues { name } } }`);
  if (r.timeout) return "timeout";
  const t = r.data?.__type;
  if (!t?.enumValues) return null;
  await admin.from("erplain_schema_cache").upsert({ type_name: typeName, data: t, fetched_at: new Date().toISOString() });
  return t.enumValues.map((v: any) => v.name);
}

// Status filters, only if the STATUS column really exists in the schema enum.
export const FILTER_TYPES: Record<string, { type: string; build: (cols: string[]) => string | null }> = {
  orders: { type: "QueryOrdersWhereColumn", build: (c) => (c.includes("STATUS") ? `{ column: STATUS, operator: IN, value: ["active", "pending_validation"] }` : null) },
  mos: { type: "QueryManufacturingOrdersWhereColumn", build: (c) => (c.includes("STATUS") ? `{ column: STATUS, operator: NOT_IN, value: ["completed", "cancelled"] }` : null) },
};

export function pageQuery(ds: Dataset, filter: string | null, first: number, page: number) {
  const extra = ds.args(filter);
  return `{ ${ds.root}(first: ${first}, page: ${page}${extra ? ", " + extra : ""}) { ${PI} data { ${ds.sel} } } }`;
}
