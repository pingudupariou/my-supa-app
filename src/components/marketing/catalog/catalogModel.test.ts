import { describe, it, expect } from 'vitest';
import { buildCatalog, variantStatus } from './catalogModel';
const o = (name: string, offer_id: string, vid: number | null, feed: string, extra: any = {}) => ({ name, offer_id, feed_label: feed, content_language: 'fr', title: 'T', sku: 'S', color: 'Rouge', size: null, item_group_id: 'shopify_FR_1', product_type: 'Chapes', image_link: null, price: 1, currency: 'EUR', availability: 'IN_STOCK', custom_label_0: null, custom_label_1: null, custom_label_2: null, custom_label_3: null, custom_label_4: null, issues: [], shopify_variant_id: vid, shopify_product_id: vid ? 1 : null, match_method: null, ...extra });
describe('catalog', () => {
  it('groups feeds of the same variant, keeps unmatched apart', () => {
    const { variants, models } = buildCatalog([o('a', 'shopify_FR_1_10', 10, 'FR'), o('b', 'shopify_US_1_10', 10, 'US'), o('c', 'x', null, 'FR')] as any, new Map([[1, { title: 'M', product_type: null }]]), new Map(), new Map());
    expect(variants).toHaveLength(2);
    expect(variants.find((v) => v.key === 'v:10')!.offers).toHaveLength(2);
    expect(variants.find((v) => v.key === 'o:x')!.family).toBe('Non identifiées');
    expect(models).toHaveLength(2);
  });
  it('approved in any feed wins for a country', () => {
    const { variants } = buildCatalog([o('a', 'p', 10, 'FR'), o('b', 'q', 10, 'US')] as any, new Map(), new Map(), new Map());
    expect(variantStatus(variants[0], new Map([['a', 'disapproved'], ['b', 'approved']]))).toBe('approved');
    expect(variantStatus(variants[0], new Map([['a', 'disapproved']]))).toBe('disapproved');
  });
});
