import { expect, it } from 'vitest';
import { applyCrmFilter, DEFAULT_CRM_FILTER } from './crmDisplayFilter';
const cs = [{ id: 'a', is_active: true, category_id: 'x', erplain_customer_id: '1', ch: 'B2B' }, { id: 'b', is_active: false, category_id: null, erplain_customer_id: null, ch: 'OEM' }];
const ch = (c: typeof cs[0]) => c.ch;
it('shows all by default', () => expect(applyCrmFilter(cs, DEFAULT_CRM_FILTER, ch)).toHaveLength(2));
it('filters by channel', () => expect(applyCrmFilter(cs, { ...DEFAULT_CRM_FILTER, channels: ['OEM'] }, ch).map(c => c.id)).toEqual(['b']));
it('filters active and linked', () => expect(applyCrmFilter(cs, { ...DEFAULT_CRM_FILTER, activity: 'active', link: 'linked' }, ch).map(c => c.id)).toEqual(['a']));
it('filters no category', () => expect(applyCrmFilter(cs, { ...DEFAULT_CRM_FILTER, categories: ['none'] }, ch).map(c => c.id)).toEqual(['b']));
