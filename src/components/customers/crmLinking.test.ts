import { describe, it, expect } from 'vitest';
import { buildCrmLinkRows, linkConflict, normalizeName } from './crmLinking';

const cust = (id: string, name: string) => ({ customer_id: id, customer_name: name, channel: 'B2B', commercial_country: null });
const crm = (id: string, name: string, link: string | null = null) => ({ id, company_name: name, erplain_customer_id: link, sales_channel: 'B2B' });

describe('rapprochement CRM ↔ Erplain', () => {
  it('normalise accents et forme juridique', () => { expect(normalizeName('Vélo Shop SAS')).toBe('velo shop'); });
  it('propose le client Erplain de même nom sans le rattacher', () => {
    const [r] = buildCrmLinkRows([crm('a', 'Velo Shop')], [cust('1', 'Vélo Shop SARL')]);
    expect(r.status).toBe('suggested'); expect(r.suggestion?.customer_id).toBe('1'); expect(r.erplain_customer_id).toBeNull();
  });
  it('garde un client absent d Erplain comme nouveau', () => {
    expect(buildCrmLinkRows([crm('a', 'Prospect X')], [cust('1', 'Autre')])[0].status).toBe('new');
  });
  it('ne propose pas un client Erplain déjà rattaché', () => {
    const rows = buildCrmLinkRows([crm('a', 'Shop', '1'), crm('b', 'Shop')], [cust('1', 'Shop')]);
    expect(rows[1].status).toBe('new'); expect(rows[1].duplicateOf).toEqual(['a']);
  });
  it('bloque un second rattachement au même client Erplain', () => {
    expect(linkConflict([crm('a', 'Shop', '1'), crm('b', 'Autre')], 'b', '1')?.id).toBe('a');
    expect(linkConflict([crm('a', 'Shop', '1')], 'a', '1')).toBeUndefined();
  });
});
