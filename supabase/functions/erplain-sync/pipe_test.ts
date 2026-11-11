import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readPipeOrders } from "./pipe.ts";
import type { GqlResult } from "./erplain.ts";

const result = (items: unknown[], more: boolean): GqlResult => ({ data: { Orders: { data: items, paginatorInfo: { hasMorePages: more, total: 60 } } }, errors: [], httpStatus: 200, complexity: false, timeout: false });

Deno.test("Pipe historical period includes the last day and excludes the next month", async () => {
  let query = "";
  await readPipeOrders(async (_label, q) => { query = q; return result([], false); }, "id", "2026-10-01", undefined, "2026-10-31");
  assertEquals(query.includes('operator: GTE, value: "2026-10-01"'), true);
  assertEquals(query.includes('operator: LT, value: "2026-11-01"'), true);
  assertEquals(query.includes('AND:'), true);
});

Deno.test("Pipe resumes every order without skipping pages", async () => {
  const queries: string[] = [];
  const gql = async (_label: string, query: string) => { queries.push(query); return result([{ id: queries.length }], queries.length < 6); };
  const first = await readPipeOrders(gql, "id", "2026-11-01");
  assertEquals(first.next, { page: 6, size: 10 });
  const last = await readPipeOrders(gql, "id", "2026-11-01", first.next ?? undefined);
  assertEquals([...first.orders, ...last.orders].map(o => o.id), [1, 2, 3, 4, 5, 6]);
  assertEquals(last.next, null);
  assertEquals(queries.every(q => q.includes('value: "2026-11-01"')), true);
});

Deno.test("Pipe reduces an oversized Erplain query before importing", async () => {
  const sizes: number[] = [];
  const data = await readPipeOrders(async (_label, query) => {
    const size = Number(query.match(/first: (\d+)/)?.[1]); sizes.push(size);
    return size > 2 ? { data: null, errors: ["Query complexity exceeded"], httpStatus: 416, complexity: true, timeout: false } : result([{ id: 1 }], false);
  }, "id", "2026-11-01");
  assertEquals(sizes, [10, 5, 2]);
  assertEquals(data.orders, [{ id: 1 }]);
});

Deno.test("Pipe reports API failures instead of successful empty orders", async () => {
  await assertRejects(() => readPipeOrders(async () => ({ data: null, errors: ["Unavailable"], httpStatus: 500, complexity: false, timeout: false }), "id", "2026-11-01"), Error, "Unavailable");
});