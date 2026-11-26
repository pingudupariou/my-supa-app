import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { toRows } from "./sales.ts";

Deno.test("An unpaid invoice linked to an order keeps its full Erplain HT total", () => {
  const { doc, lines } = toRows({
    id: 42,
    label: "FA-TEST",
    status: "unpaid",
    dated_at: "2026-11-26",
    total_without_tax: 108,
    total: 129.6,
    total_taxes: 21.6,
    customer: { id: 7, company_name: "Client test" },
    order: { id: 99, label: "BC-TEST" },
    line_items: [
      { id: 1, quantity: 2, total_without_tax: 100, variant: { id: 11, sku: "PRODUIT" } },
      { id: 2, type: "shipping", total_without_tax: 20, label: "Livraison" },
    ],
  }, "invoice", "00000000-0000-0000-0000-000000000000");

  assertEquals(doc.counted, true);
  assertEquals(doc.order_id, "99");
  assertEquals(doc.total_ht, 108);
  assertEquals(lines.reduce((sum: number, line: any) => sum + line.amount_ht, 0), 108);
});

Deno.test("A pending credit note is deducted and a cancelled invoice is excluded", () => {
  const credit = toRows({ id: 8, status: "pending", total_without_tax: 25, line_items: [{ id: 1, quantity: 1, total_without_tax: 25 }] }, "credit_note", "run");
  assertEquals(credit.doc.counted, true);
  assertEquals(credit.doc.total_ht, -25);
  assertEquals(credit.lines[0].amount_ht, -25);

  const cancelled = toRows({ id: 9, status: "cancelled", total_without_tax: 50, line_items: [] }, "invoice", "run");
  assertEquals(cancelled.doc.counted, false);
});
