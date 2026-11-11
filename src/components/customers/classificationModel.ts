export type ClientChannel = 'B2C' | 'B2B' | 'OEM' | 'A_CLASSER';
export type ClassifiedCustomer = { customer_id: string; customer_name: string | null; channel: string; commercial_country: string | null };
export const CHANNEL_LABELS: Record<string, string> = { B2C: 'B2C', B2B: 'B2B', OEM: 'OEM', A_CLASSER: 'À classer (B2C par défaut)' };
export const effectiveChannel = (channel: string | null | undefined): 'B2C' | 'B2B' | 'OEM' => channel === 'B2B' || channel === 'OEM' ? channel : 'B2C';
export const CLASSIFICATION_EVENT = 'novaride:customer-classification';
export function notifyClassification() { window.dispatchEvent(new Event(CLASSIFICATION_EVENT)); }
export function crmChannel(client: { erplain_customer_id?: string | null; sales_channel?: string | null }, customers: ClassifiedCustomer[]) {
  if (client.erplain_customer_id) return effectiveChannel(customers.find(c => c.customer_id === client.erplain_customer_id)?.channel);
  return effectiveChannel(client.sales_channel ?? 'B2B');
}