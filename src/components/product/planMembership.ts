import type { Product } from '@/engine/types';

export const categoryNameKey = (name: string) => name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ');

export function memberOwners(products: Product[]): Map<string, Product> {
  const owners = new Map<string, Product>();
  for (const product of products) {
    for (const key of product.erplainMembers ?? []) {
      if (!owners.has(key)) owners.set(key, product);
    }
  }
  return owners;
}

/** A member belongs to one aggregate OR an individual row, never both. */
export function replacePlanCategory(products: Product[], category: Product): Product[] {
  const keys = [...new Set(category.erplainMembers ?? [])];
  if (!keys.length) throw new Error('Sélectionnez au moins un produit.');
  const owners = memberOwners(products.filter(p => p.id !== category.id));
  if (keys.some(key => owners.has(key))) throw new Error('Un produit appartient déjà à une autre catégorie.');
  if (products.some(p => p.id !== category.id && p.erplainMembers?.length && categoryNameKey(p.name) === categoryNameKey(category.name))) {
    throw new Error('Une catégorie porte déjà ce nom.');
  }
  const individualIds = new Set(keys.map(key => key.startsWith('manual:') ? key.slice(7) : `erplain-${key}`));
  const next = products.filter(p => p.id !== category.id && !individualIds.has(p.id));
  const index = products.findIndex(p => p.id === category.id);
  next.splice(index < 0 ? next.length : Math.min(index, next.length), 0, { ...category, erplainMembers: keys });
  return next;
}