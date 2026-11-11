import type { Gql } from "./erplain.ts";

/** Read bounded batches; a cursor always resumes with the same page size. */
export async function readPipeOrders(gql: Gql, selection: string, from: string, cursor?: { page: number; size: number }, to?: string) {
  let page = cursor?.page ?? 1;
  let size = cursor?.size ?? 10;
  const orders: any[] = [];
  let total: number | null = null;
  for (let reads = 0; reads < 5; reads++) {
    // Use an exclusive next-day boundary so timestamps on the last day remain included.
    const nextDay = to ? new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10) : null;
    const where = nextDay ? `AND: [{ column: DATED_AT, operator: GTE, value: ${JSON.stringify(from)} }, { column: DATED_AT, operator: LT, value: ${JSON.stringify(nextDay)} }]` : `column: DATED_AT, operator: GTE, value: ${JSON.stringify(from)}`;
    const r = await gql(`Commandes page ${page}`, `{ Orders(first: ${size}, page: ${page}, where: { ${where} }) { paginatorInfo { hasMorePages total } data { ${selection} } } }`);
    if (r.complexity && page === 1 && !orders.length && size > 1) {
      size = Math.max(1, Math.floor(size / 2));
      reads--;
      continue;
    }
    if (r.errors.length || !Array.isArray(r.data?.Orders?.data)) {
      const message = r.errors.join(" | ") || "Réponse Erplain invalide";
      if (!orders.length) throw new Error(message);
      return { orders, total, next: { page, size }, message };
    }
    const batch = r.data.Orders;
    total = batch.paginatorInfo?.total ?? total;
    orders.push(...batch.data);
    if (!batch.paginatorInfo?.hasMorePages) return { orders, total, next: null };
    if (!batch.data.length) throw new Error("Erplain annonce une suite mais retourne une page vide.");
    page++;
  }
  return { orders, total, next: { page, size } };
}