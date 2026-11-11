import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CLASSIFICATION_EVENT, type ClassifiedCustomer } from './classificationModel';

export async function readClassifiedCustomers() {
  const all: ClassifiedCustomer[] = [];
  for (let p = 0; ; p++) {
    const { data, error } = await supabase.from('erplain_sales_customers').select('customer_id,customer_name,channel,commercial_country').order('customer_id').range(p * 1000, p * 1000 + 999);
    if (error) throw error;
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) return all;
  }
}
export function useCustomerClassification() {
  const [customers, setCustomers] = useState<ClassifiedCustomer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setCustomers(await readClassifiedCustomers()); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void reload();
    const refresh = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener(CLASSIFICATION_EVENT, refresh); window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 30000);
    return () => { window.removeEventListener(CLASSIFICATION_EVENT, refresh); window.removeEventListener('focus', refresh); window.clearInterval(timer); };
  }, [reload]);
  return { customers, error, loading, reload };
}