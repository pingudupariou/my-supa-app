import { assertEquals } from "jsr:@std/assert";
import { computePlan } from "./plan.ts";
const data = {
  lines: [{ line_id: 1, order_id: 1, order_status: "active", variant_id: 7, location_id: 1, quantity: 1, shipped_quantity: 0, reserved_quantity: 0 }],
  stocks: [{ variant_id: 7, location_id: 1, on_hand: 0, reserved: 0, available: 0 }, { variant_id: 7, location_id: 2, on_hand: 5, reserved: 0, available: 5 }],
  mos: [], boms: [], routings: [],
};
Deno.test("only checked locations count as stock", () => {
  const p = computePlan(data, { stockLocationIds: [1] }).proposals[0];
  assertEquals(p.to_build, 1);
  assertEquals(p.stock_elsewhere.length, 1);
});
Deno.test("checking another location uses its stock", () => {
  assertEquals(computePlan(data, { stockLocationIds: [1, 2] }).proposals[0].to_build, 0);
});
