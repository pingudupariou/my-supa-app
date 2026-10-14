/** Where-used ("cas d'emploi") from Erplain BOM edges [parentVariantId, componentVariantId, qty].
 * Only the retained BOM per parent is in the edges, so alternative BOMs never add up.
 * Finished products = parents that are not themselves a component of any BOM. */
export type Edge = [string, string, number];
export interface Usage {
  productId: string;
  quantity: number;            // cumulated quantity per 1 finished product, over all paths
  paths: { ids: string[]; quantity: number }[]; // ids: component → ... → finished product
  direct: boolean;
}

export function buildWhereUsed(edges: Edge[]) {
  const parentsOf = new Map<string, { parent: string; qty: number }[]>();
  const isComponent = new Set<string>();
  for (const [p, c, q] of edges) {
    isComponent.add(c);
    parentsOf.set(c, [...(parentsOf.get(c) ?? []), { parent: p, qty: q }]);
  }
  const cache = new Map<string, Usage[]>();
  const usagesOf = (id: string): Usage[] => {
    if (cache.has(id)) return cache.get(id)!;
    const byProduct = new Map<string, Usage>();
    const walk = (node: string, path: string[], qty: number) => {
      for (const { parent, qty: q } of parentsOf.get(node) ?? []) {
        if (path.includes(parent)) continue; // cycle guard
        const next = [...path, parent];
        const nq = qty * q;
        if (!isComponent.has(parent)) {
          const u = byProduct.get(parent) ?? { productId: parent, quantity: 0, paths: [], direct: false };
          u.quantity += nq; u.paths.push({ ids: next, quantity: nq });
          if (next.length === 2) u.direct = true;
          byProduct.set(parent, u);
        }
        if (path.length < 8) walk(parent, next, nq);
      }
    };
    walk(id, [id], 1);
    const res = [...byProduct.values()];
    cache.set(id, res);
    return res;
  };
  const directParents = (id: string) => [...new Set((parentsOf.get(id) ?? []).map((x) => x.parent))];
  return { usagesOf, directParents, isUsed: (id: string) => isComponent.has(id) };
}
