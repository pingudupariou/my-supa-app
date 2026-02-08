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
  created_at: string;
  updated_at: string;
}

export interface CustomerInteraction {
  id: string;
  customer_id: string;
  interaction_type: 'call' | 'email' | 'meeting' | 'note';
  subject: string;
  content: string | null;
  interaction_date: string;
  created_by: string | null;
  created_at: string;
}

export interface CustomerAppointment {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  appointment_date: string;
  duration_minutes: number | null;
  location: string | null;
  is_completed: boolean;
  assigned_to: string | null;
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

export function useCRMData() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      const [customersRes, ordersRes] = await Promise.all([
        supabase.from('customers').select('*').order('company_name'),
        supabase.from('customer_orders').select('*').order('order_date', { ascending: false }),
      ]);
      if (customersRes.data) setCustomers(customersRes.data as any);
      if (ordersRes.data) setOrders(ordersRes.data as any);
    } catch {
      // Tables may not be ready
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-save: create customer
  const createCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({ ...customer, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      const newCustomer = data as unknown as Customer;
      setCustomers(prev => [...prev, newCustomer].sort((a, b) => a.company_name.localeCompare(b.company_name)));
      toast({ title: 'Client créé', description: `${newCustomer.company_name} ajouté.` });
      return newCustomer;
    } catch (e) {
      console.error('Failed to create customer:', e);
      toast({ title: 'Erreur', description: 'Impossible de créer le client.', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  // Auto-save: update customer
  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    if (!user) return false;
    try {
      const { error } = await supabase
        .from('customers')
        .update(updates as any)
        .eq('id', id);
      if (error) throw error;
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates, updated_at: new Date().toISOString() } : c));
      toast({ title: 'Client mis à jour' });
      return true;
    } catch (e) {
      console.error('Failed to update customer:', e);
      toast({ title: 'Erreur', description: 'Impossible de mettre à jour le client.', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  // Delete customer
  const deleteCustomer = useCallback(async (id: string) => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
      setCustomers(prev => prev.filter(c => c.id !== id));
      toast({ title: 'Client supprimé' });
      return true;
    } catch (e) {
      console.error('Failed to delete customer:', e);
      toast({ title: 'Erreur', description: 'Impossible de supprimer le client.', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  // Create order
  const createOrder = useCallback(async (order: Omit<CustomerOrder, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('customer_orders')
        .insert({ ...order, user_id: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      const newOrder = data as unknown as CustomerOrder;
      setOrders(prev => [newOrder, ...prev]);
      toast({ title: 'Commande créée' });
      return newOrder;
    } catch (e) {
      console.error('Failed to create order:', e);
      toast({ title: 'Erreur', description: 'Impossible de créer la commande.', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  return {
    customers, interactions, appointments, orders, pricingTiers, isLoading,
    refreshData: fetchData,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    createOrder,
    getCustomerInteractions: (id: string) => interactions.filter(i => i.customer_id === id),
    getCustomerAppointments: (id: string) => appointments.filter(a => a.customer_id === id),
    getCustomerOrders: (id: string) => orders.filter(o => o.customer_id === id),
  };
}
