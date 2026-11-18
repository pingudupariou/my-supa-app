import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyClassification } from './classificationModel';

/** Server-side: every non-manual customer takes the channel of its first matching rule; unmatched → À classer. */
export async function applyRulesNow(silent = false) {
  const { data, error } = await supabase.rpc('apply_customer_rules' as never);
  if (error) { toast.error(`Classement automatique impossible : ${error.message}`); return null; }
  const r = data as unknown as { classified: number; reset: number; docs_without_order_label: number };
  notifyClassification();
  if (!silent) toast.success(`Classement mis à jour : ${r.classified} client(s) reclassé(s), ${r.reset} remis « À classer »`);
  return r;
}
