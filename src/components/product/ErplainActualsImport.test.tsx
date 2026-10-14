import { useState } from 'react';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErplainActualsImport } from './ErplainActualsImport';
import { replacePlanCategory } from './planMembership';
import type { Product } from '@/engine/types';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(async () => ({ data: [
  { key: 'a', label: 'Galets rouges', channel: 'B2C', qty: 10, prod_ht: 1000, cov_ht: 1000, cogs: 300 },
  { key: 'b', label: 'Galets noirs', channel: 'B2C', qty: 20, prod_ht: 1000, cov_ht: 1000, cogs: 400 },
], error: null })) } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
afterEach(cleanup);
const year = new Date().getFullYear();
const product = (id: string, name = id, members?: string[]): Product => ({ id, name, erplainMembers: members,
  category: 'B2C', launchYear: year, devCost: 0, unitCost: 30, priceHT: 100, priceTTC_B2C: 120,
  priceHT_B2B: 80, priceHT_OEM: 70, vatRate: .2, coef_shop: 1.5, coef_dist: 1.3, coef_oem: 1.2, volumesByYear: { [year]: 10 } });

describe('Plan category uniqueness', () => {
  it('selects only filtered available members and preserves selections outside the filter', () => {
    const onApply = vi.fn();
    render(<ErplainActualsImport products={[
      product('erplain-a', 'Galets rouges'), product('erplain-b', 'Galets noirs'),
      product('erplain-c', 'Pédale'),
      { ...product('erplain-cat', 'Déjà groupé', ['d']), erplainMemberProducts: [product('erplain-d', 'Galets bleus')] },
    ]} years={[year]} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: 'Créer une catégorie' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom de la catégorie' }), { target: { value: 'Nouvelle' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inclure Pédale' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher dans les catégories' }), { target: { value: 'Galets' } });
    const all = screen.getByRole('checkbox', { name: 'Tout sélectionner dans les résultats' });
    fireEvent.click(all);
    expect(screen.getByRole('checkbox', { name: 'Inclure Galets rouges' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Inclure Galets noirs' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Inclure Galets bleus' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Inclure Galets bleus' })).not.toBeChecked();
    fireEvent.click(all);
    expect(screen.getByRole('checkbox', { name: 'Inclure Galets rouges' })).not.toBeChecked();
    fireEvent.click(all);
    fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher dans les catégories' }), { target: { value: 'Inexistant' } });
    expect(all).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Créer la catégorie' }));
    const category = onApply.mock.calls[0][0].find((p: Product) => p.name === 'Nouvelle');
    expect(category.erplainMembers.sort()).toEqual(['a', 'b', 'c']);
  });
  it('replaces individual rows and removes duplicate members', () => {
    const result = replacePlanCategory([product('erplain-a'), product('manual')], product('cat', 'Galets', ['a', 'a']));
    expect(result.map(p => p.id)).toEqual(['manual', 'cat']);
    expect(result[1].erplainMembers).toEqual(['a']);
  });
  it('blocks cross-category membership and duplicate names', () => {
    const existing = product('one', 'Céramique', ['a']);
    expect(() => replacePlanCategory([existing], product('two', 'Autre', ['a']))).toThrow('autre catégorie');
    expect(() => replacePlanCategory([existing], product('two', ' ceramique ', ['b']))).toThrow('ce nom');
  });
  it('creates a manual product, adds it to a saved category, keeps names after remount and removes individual products', async () => {
    let latest: Product[] = [];
    const red = product('erplain-a', 'Galets rouges');
    const initial = { ...product('erplain-cat-one', 'Galets', ['a']), erplainMemberProducts: [red] };
    function Harness({ initialProducts = [initial] }: { initialProducts?: Product[] }) {
      const [products, setProducts] = useState<Product[]>(initialProducts);
      latest = products;
      return <ErplainActualsImport products={products} years={[year, year + 1]} onApply={setProducts} />;
    }
    const rendered = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau produit manuel' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom du nouveau produit' }), { target: { value: 'Nouveau galet' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Prix B2C HT' }), { target: { value: '50' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Volume B2C initial' }), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: /^Créer le produit$/ }));
    expect(latest).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter des produits' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inclure Nouveau galet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(latest).toHaveLength(1);
    expect(latest[0].volumesByYear[year]).toBe(30);
    expect(latest[0].priceHT).toBe(66.67);
    const saved = JSON.parse(JSON.stringify(latest));
    rendered.unmount();
    render(<Harness initialProducts={[...saved, product('manual-other', 'À retirer')]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Produits de la catégorie' }));
    expect(screen.getByText('Galets rouges')).toBeInTheDocument();
    expect(screen.getByText('Nouveau galet')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retirer À retirer du plan' }));
    fireEvent.click(screen.getByRole('button', { name: /^Retirer du plan$/ }));
    expect(latest).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter des produits' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inclure Nouveau galet' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(latest[0].erplainMembers).toEqual(['a']);
    expect(latest[0].volumesByYear[year]).toBe(10);
  });
  it('creates, edits, removes members, and deletes a category without duplicate rows', async () => {
    let latest: Product[] = [];
    const save = vi.fn();
    function Harness() {
      const [products, setProducts] = useState([product('erplain-a')]);
      latest = products;
      return <ErplainActualsImport products={products} years={[year, year + 1]} onApply={setProducts} onSave={save} />;
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Charger les ventes' }));
    await screen.findByRole('checkbox', { name: 'Sélectionner Galets rouges' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Créer une catégorie' })[0]);
    fireEvent.change(screen.getByRole('textbox', { name: 'Nom de la catégorie' }), { target: { value: 'Galets' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inclure Galets rouges' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inclure Galets noirs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Créer la catégorie' }));
    await waitFor(() => expect(latest).toHaveLength(1));
    expect(latest[0].volumesByYear[year]).toBe(30);
    expect(latest[0].priceHT).toBe(66.67);
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Galets rouges' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Modifier Galets' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Inclure Galets noirs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer les modifications' }));
    expect(latest[0].erplainMembers).toEqual(['a']);
    expect(latest[0].volumesByYear[year]).toBe(10);
    expect(screen.getByRole('checkbox', { name: 'Sélectionner Galets noirs' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Sauvegarder le plan' }));
    expect(save).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Galets' }));
    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la catégorie' }));
    expect(latest).toEqual([]);
  });
});