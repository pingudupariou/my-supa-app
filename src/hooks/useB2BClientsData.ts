import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface B2BClient {
  id: string;
  user_id: string;
  is_active: boolean;
  company_name: string;
  country: string | null;
  geographic_zone: string | null;
  contact_email: string | null;
  eer_date: number | null;
  last_purchase_date: number | null;
  client_type: string | null;
  pricing_rule: string | null;
  payment_terms: string | null;
  delivery_method: string | null;
  transport_rules: string | null;
  delivery_fee_rule: string | null;
  contract_exclusivity: boolean;
  contract_sign_date: string | null;
  termination_notice: string | null;
  moq: string | null;
  specific_advantages: string | null;
  notes: string | null;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface B2BClientProjection {
  id: string;
  client_id: string;
  year: number;
  projected_revenue: number;
  notes: string | null;
}

export interface B2BDeliveryFeeTier {
  id: string;
  label: string;
  fee_amount: number;
  min_pieces: number;
  max_pieces: number | null;
}

export interface B2BPaymentTermOption {
  id: string;
  label: string;
  description: string | null;
}

export interface B2BDeliveryMethod {
  id: string;
  label: string;
  description: string | null;
}

export interface B2BClientCategory {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

export function useB2BClientsData() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [clients, setClients] = useState<B2BClient[]>([]);
  const [projections, setProjections] = useState<B2BClientProjection[]>([]);
  const [deliveryFeeTiers, setDeliveryFeeTiers] = useState<B2BDeliveryFeeTier[]>([]);
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<B2BPaymentTermOption[]>([]);
  const [deliveryMethods, setDeliveryMethods] = useState<B2BDeliveryMethod[]>([]);
  const [categories, setCategories] = useState<B2BClientCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const [cRes, pRes, dfRes, ptRes, dmRes, catRes] = await Promise.all([
        supabase.from('b2b_clients').select('*').order('company_name'),
        supabase.from('b2b_client_projections').select('*'),
        supabase.from('b2b_delivery_fee_tiers').select('*').order('min_pieces'),
        supabase.from('b2b_payment_terms_options').select('*').order('label'),
        supabase.from('b2b_delivery_methods').select('*').order('label'),
        supabase.from('b2b_client_categories').select('*').order('sort_order'),
      ]);
      if (cRes.error) throw cRes.error;
      if (pRes.error) throw pRes.error;
      if (dfRes.error) throw dfRes.error;
      if (ptRes.error) throw ptRes.error;
      if (dmRes.error) throw dmRes.error;
      if (catRes.error) throw catRes.error;
      setClients(cRes.data as B2BClient[]);
      setProjections(pRes.data as B2BClientProjection[]);
      setDeliveryFeeTiers(dfRes.data as B2BDeliveryFeeTier[]);
      setPaymentTermsOptions(ptRes.data as B2BPaymentTermOption[]);
      setDeliveryMethods(dmRes.data as B2BDeliveryMethod[]);
      setCategories(catRes.data as B2BClientCategory[]);
    } catch (e: any) {
      console.error('B2B fetch error:', e);
      toast({ title: 'Erreur', description: 'Impossible de charger les données B2B', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const upsertClient = useCallback(async (data: Partial<B2BClient> & { company_name: string }) => {
    if (!user) return null;
    const payload = { ...data, user_id: user.id };
    if (data.id) {
      const { data: res, error } = await supabase.from('b2b_clients').update(payload).eq('id', data.id).select().single();
      if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return null; }
      await fetchAll();
      return res as B2BClient;
    } else {
      const { data: res, error } = await supabase.from('b2b_clients').insert(payload).select().single();
      if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return null; }
      await fetchAll();
      return res as B2BClient;
    }
  }, [user, toast, fetchAll]);

  const deleteClient = useCallback(async (id: string) => {
    const { error } = await supabase.from('b2b_clients').delete().eq('id', id);
    if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
    await fetchAll();
  }, [toast, fetchAll]);

  const upsertProjection = useCallback(async (clientId: string, year: number, revenue: number, notes?: string) => {
    if (!user) return;
    const existing = projections.find(p => p.client_id === clientId && p.year === year);
    if (existing) {
      await supabase.from('b2b_client_projections').update({ projected_revenue: revenue, notes: notes || null }).eq('id', existing.id);
    } else {
      await supabase.from('b2b_client_projections').insert({ client_id: clientId, year, projected_revenue: revenue, notes: notes || null, user_id: user.id });
    }
    await fetchAll();
  }, [user, projections, fetchAll]);

  const addCategory = useCallback(async (name: string, color?: string) => {
    if (!user) return;
    await supabase.from('b2b_client_categories').insert({ name, color: color || '#6366f1', user_id: user.id, sort_order: categories.length });
    await fetchAll();
  }, [user, categories.length, fetchAll]);

  const deleteCategory = useCallback(async (id: string) => {
    await supabase.from('b2b_client_categories').delete().eq('id', id);
    await fetchAll();
  }, [fetchAll]);

  const updateCategory = useCallback(async (id: string, data: Partial<B2BClientCategory>) => {
    await supabase.from('b2b_client_categories').update(data).eq('id', id);
    await fetchAll();
  }, [fetchAll]);

  const addDeliveryFeeTier = useCallback(async (label: string, fee: number, min: number, max: number | null) => {
    if (!user) return;
    await supabase.from('b2b_delivery_fee_tiers').insert({ label, fee_amount: fee, min_pieces: min, max_pieces: max, user_id: user.id });
    await fetchAll();
  }, [user, fetchAll]);

  const deleteDeliveryFeeTier = useCallback(async (id: string) => {
    await supabase.from('b2b_delivery_fee_tiers').delete().eq('id', id);
    await fetchAll();
  }, [fetchAll]);

  const addPaymentTerm = useCallback(async (label: string, description?: string) => {
    if (!user) return;
    await supabase.from('b2b_payment_terms_options').insert({ label, description: description || null, user_id: user.id });
    await fetchAll();
  }, [user, fetchAll]);

  const deletePaymentTerm = useCallback(async (id: string) => {
    await supabase.from('b2b_payment_terms_options').delete().eq('id', id);
    await fetchAll();
  }, [fetchAll]);

  const addDeliveryMethod = useCallback(async (label: string, description?: string) => {
    if (!user) return;
    await supabase.from('b2b_delivery_methods').insert({ label, description: description || null, user_id: user.id });
    await fetchAll();
  }, [user, fetchAll]);

  const deleteDeliveryMethod = useCallback(async (id: string) => {
    await supabase.from('b2b_delivery_methods').delete().eq('id', id);
    await fetchAll();
  }, [fetchAll]);

  const bulkImportClients = useCallback(async (rows: Partial<B2BClient>[]) => {
    if (!user) return 0;
    const payloads = rows.map(r => ({ ...r, user_id: user.id, company_name: r.company_name || 'Sans nom' }));
    const { data, error } = await supabase.from('b2b_clients').insert(payloads).select();
    if (error) { toast({ title: 'Erreur import', description: error.message, variant: 'destructive' }); return 0; }
    await fetchAll();
    return data?.length || 0;
  }, [user, toast, fetchAll]);

  const getClientProjections = useCallback((clientId: string) => {
    return projections.filter(p => p.client_id === clientId);
  }, [projections]);

  return {
    clients, projections, deliveryFeeTiers, paymentTermsOptions, deliveryMethods, categories,
    isLoading, refreshData: fetchAll,
    upsertClient, deleteClient, bulkImportClients,
    upsertProjection, getClientProjections,
    addDeliveryFeeTier, deleteDeliveryFeeTier,
    addPaymentTerm, deletePaymentTerm,
    addDeliveryMethod, deleteDeliveryMethod,
    addCategory, deleteCategory, updateCategory,
  };
}
