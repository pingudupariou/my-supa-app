import { describe, expect, it } from 'vitest';
import { crmChannel, effectiveChannel } from './classificationModel';

describe('shared customer channel', () => {
  it('keeps one explicit B2C/B2B/OEM channel and defaults unassigned clients to B2C', () => {
    expect(['B2C','B2B','OEM','A_CLASSER',null].map(effectiveChannel)).toEqual(['B2C','B2B','OEM','B2C','B2C']);
  });
  it('uses the explicit Erplain link instead of the CRM fallback channel', () => {
    const customers = [{ customer_id: 'e1', customer_name: 'Client', channel: 'OEM', commercial_country: null }];
    expect(crmChannel({ erplain_customer_id: 'e1', sales_channel: 'B2B' }, customers)).toBe('OEM');
    expect(crmChannel({ sales_channel: 'B2B' }, customers)).toBe('B2B');
  });
});