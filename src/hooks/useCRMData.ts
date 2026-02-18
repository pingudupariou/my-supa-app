import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';

export interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  status: 'prospect' | 'active' | 'inactive';
  pricing_tier: 'bronze' | 'silver' | 'gold';
  notes: string | null;
  priority: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_interaction_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInteraction {
  id: string;
  customer_id: string;
  user_id: string;
  interaction_type: 'call' | 'email' | 'meeting' | 'note';
  subject: string;
  content: string | null;
  interaction_date: string;
  created_at: string;
}

export interface CustomerOpportunity {
  id: string;
  user_id: string;
  customer_id: string;
  stage: string;
  contact_name: string | null;
  estimated_amount: number;
  probability: number;
  expected_close_date: string | null;
  responsible: string | null;
  priority: string;
  next_action: string | null;
  next_action_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerOrder {
  id: string;
  customer_id: string;
  order_reference: string;
  order_date: string;
  expected_delivery_date: string | null;
  total_amount: number;
  status: 'draft' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';
  product_category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PricingTier {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  discount_percentage: number;
  description: string | null;
}

export const PIPELINE_STAGES = [
  { key: 'prospect', label: 'Prospect', color: 'bg-muted' },
  { key: 'contacted', label: 'Contacté', color: 'bg-blue-500/10' },
  { key: 'discussion', label: 'En discussion', color: 'bg-amber-500/10' },
  { key: 'offer_sent', label: 'Offre envoyée', color: 'bg-purple-500/10' },
  { key: 'negotiation', label: 'Négociation', color: 'bg-orange-500/10' },
  { key: 'won', label: 'Gagné', color: 'bg-green-500/10' },
  { key: 'lost', label: 'Perdu', color: 'bg-destructive/10' },
];

export function useCRMData() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [opportunities, setOpportunities] = useState<CustomerOpportunity[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      const [customersRes, ordersRes, oppsRes, interactionsRes] = await Promise.all([
        supabase.from('customers').select('*').order('company_name'),
        supabase.from('customer_orders').select('*').order('order_date', { ascending: false }),
        supabase.from('customer_opportunities').select('*').order('sort_order'),
        supabase.from('customer_interactions').select('*').order('interaction_date', { ascending: false }),
      ]);
      if (customersRes.data) setCustomers(customersRes.data as any);
      if (ordersRes.data) setOrders(ordersRes.data as any);
      if (oppsRes.data) setOpportunities(oppsRes.data as any);
      if (interactionsRes.data) setInteractions(interactionsRes.data as any);
    } catch {
      // Tables may not be ready
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Customer CRUD
  const createCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({ ...customer, user_id: user.id } as any)
        .select().single();
      if (error) throw error;
      const c = data as unknown as Customer;
      setCustomers(prev => [...prev, c].sort((a, b) => a.company_name.localeCompare(b.company_name)));
      toast({ title: 'Client créé', description: `${c.company_name} ajouté.` });
      return c;
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de créer le client.', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('customers').update(updates as any).eq('id', id);
      if (error) throw error;
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
      return true;
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour.', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast({ title: 'Client supprimé' });
      return true;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  // Opportunity CRUD
  const createOpportunity = useCallback(async (opp: Partial<CustomerOpportunity> & { customer_id: string }) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('customer_opportunities')
        .insert({ ...opp, user_id: user.id } as any)
        .select().single();
      if (error) throw error;
      const newOpp = data as unknown as CustomerOpportunity;
      setOpportunities(prev => [...prev, newOpp]);
      toast({ title: 'Opportunité créée' });
      return newOpp;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  const updateOpportunity = useCallback(async (id: string, updates: Partial<CustomerOpportunity>) => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('customer_opportunities').update(updates as any).eq('id', id);
      if (error) throw error;
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
      return true;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  const deleteOpportunity = useCallback(async (id: string) => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('customer_opportunities').delete().eq('id', id);
      if (error) throw error;
      setOpportunities(prev => prev.filter(o => o.id !== id));
      return true;
    } catch {
      return false;
    }
  }, [user]);

  // Interaction CRUD
  const createInteraction = useCallback(async (interaction: { customer_id: string; interaction_type: string; subject: string; content?: string; interaction_date?: string }) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('customer_interactions')
        .insert({ ...interaction, user_id: user.id } as any)
        .select().single();
      if (error) throw error;
      const newInt = data as unknown as CustomerInteraction;
      setInteractions(prev => [newInt, ...prev]);
      // Update last_interaction_date on customer
      await supabase.from('customers').update({ last_interaction_date: newInt.interaction_date } as any).eq('id', interaction.customer_id);
      setCustomers(prev => prev.map(c => c.id === interaction.customer_id ? { ...c, last_interaction_date: newInt.interaction_date } : c));
      toast({ title: 'Interaction ajoutée' });
      return newInt;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  // Order CRUD
  const createOrder = useCallback(async (order: Omit<CustomerOrder, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .insert({ ...order, user_id: user.id } as any)
        .select().single();
      if (error) throw error;
      const newOrder = data as unknown as CustomerOrder;
      setOrders(prev => [newOrder, ...prev]);
      toast({ title: 'Commande créée' });
      return newOrder;
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  return {
    customers, interactions, appointments, orders, opportunities, pricingTiers, isLoading,
    refreshData: fetchData,
    createCustomer, updateCustomer, deleteCustomer,
    createOrder,
    createOpportunity, updateOpportunity, deleteOpportunity,
    createInteraction,
    getCustomerInteractions: (id: string) => interactions.filter(i => i.customer_id === id),
    getCustomerAppointments: (id: string) => appointments.filter((a: any) => a.customer_id === id),
    getCustomerOrders: (id: string) => orders.filter(o => o.customer_id === id),
    getCustomerOpportunities: (id: string) => opportunities.filter(o => o.customer_id === id),
  };
}
