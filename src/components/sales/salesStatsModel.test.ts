import { describe, expect, it } from 'vitest';
import { detailTSV, margin } from './salesStatsModel';
import { copyTable, num, toTSV } from '@/lib/clipboard';

const r = (p: Partial<any>) => ({ key: 'v1', label: 'ECROU DISQUE', ca_ht: 1234.5, qty: 887, prod_ht: 1000, cogs: 400, cov_ht: 1000, est_ht: 0, ...p });

describe('copier vers Excel', () => {
  it('formats numbers with a comma so Excel reads them', () => {
    expect(num(1234.5)).toBe('1234,5');
    expect(num(887, 1)).toBe('887');
    expect(num(null)).toBe('');
    expect(toTSV(['Produit', 'CA HT'], [['ECROU', 1234.5]])).toBe('Produit\tCA HT\nECROU\t1234,5');
  });
  it('keeps the columns of the products table and drops tabs from names', () => {
    const { headers, body } = detailTSV('product', [r({ label: 'A\tB' })], {}, '', false);
    expect(headers).toEqual(['Produit', 'CA HT net', 'Quantités', 'Coût unit.', 'Coût vendu', 'Marge €', 'Marge %', 'Couverture coûts %', 'Note']);
    expect(body[0]).toEqual(['A B', '1234,5', '887', 'coût manquant', '400', '600', '60', '100', '']);
  });
  it('never turns a missing cost into zero and flags estimated margins', () => {
    const { body } = detailTSV('product', [r({ unit_cost: null, cogs: null as any, est_ht: 500, cov_ht: 0 })], {}, '', false);
    expect(body[0][3]).toBe('coût manquant');
    expect(body[0][4]).toBe('');
    expect(body[0][9]).toBe('marge estimée ; couverture incomplète');
  });
  it('copies only the rows matching the search, like the screen', () => {
    const rows = [r({}), r({ key: 'v2', label: 'VIS' })];
    expect(detailTSV('product', rows, {}, 'ecrou', false).body).toHaveLength(1);
    expect(detailTSV('product', rows, {}, '', false).body).toHaveLength(2);
  });
  it('shows the channel and country chosen in Statistiques commerciales', () => {
    const { body } = detailTSV('customer', [r({ channel: 'B2B' })], { v1: { channel: 'OEM', commercial_country: 'DE' } }, '', true);
    expect(body[0].slice(0, 3)).toEqual(['ECROU DISQUE', 'OEM', 'DE']);
    const b2c = detailTSV('customer', [r({ channel: 'B2C' })], { v1: { channel: 'OEM', commercial_country: 'DE' } }, '', true).body[0];
    expect(b2c.slice(0, 3)).toEqual(['ECROU DISQUE', 'B2C (Shopify)', 'DE']);
  });
  it('copies the customer country as "auto" when nothing was chosen', () => {
    const { body } = detailTSV('customer', [r({ channel: 'B2B' })], {}, '', false);
    expect(body[0][2]).toBe('auto');
  });
  it('reports no margin when no sale has a validated cost', () => {
    const x = margin({ prod_ht: 500, cogs: 0, cov_ht: 0 });
    expect(x.m).toBeNull();
    expect(x.coverage).toBe(0);
  });
  it('gives up quietly when the clipboard refuses', async () => {
    await expect(copyTable(['a'], [[1]])).resolves.toSatisfy((v: boolean) => typeof v === 'boolean');
  });
});
