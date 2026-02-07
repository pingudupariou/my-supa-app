import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [interactions, setInteractions] = useState<CustomerInteraction[]>([]);
  const [appointments, setAppointments] = useState<CustomerAppointment[]>([]);
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const [customersRes, interactionsRes, appointmentsRes, ordersRes, tiersRes] = await Promise.all([
        supabase.from('customers').select('*').order('company_name'),
        supabase.from('customer_interactions').select('*').order('interaction_date', { ascending: false }),
        supabase.from('customer_appointments').select('*').order('appointment_date'),
        supabase.from('customer_orders').select('*').order('order_date', { ascending: false }),
        supabase.from('pricing_tier_discounts').select('*').order('discount_percentage'),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (interactionsRes.error) throw interactionsRes.error;
      if (appointmentsRes.error) throw appointmentsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (tiersRes.error) throw tiersRes.error;

      setCustomers(customersRes.data as Customer[]);
      setInteractions(interactionsRes.data as CustomerInteraction[]);
      setAppointments(appointmentsRes.data as CustomerAppointment[]);
      setOrders(ordersRes.data as CustomerOrder[]);
      setPricingTiers(tiersRes.data as PricingTier[]);
    } catch (error: any) {
      console.error('Error fetching CRM data:', error);
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données CRM',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const getCustomerInteractions = useCallback((customerId: string) => {
    return interactions.filter(i => i.customer_id === customerId);
  }, [interactions]);

  const getCustomerAppointments = useCallback((customerId: string) => {
    return appointments.filter(a => a.customer_id === customerId);
  }, [appointments]);

  const getCustomerOrders = useCallback((customerId: string) => {
    return orders.filter(o => o.customer_id === customerId);
  }, [orders]);

  return {
    customers,
    interactions,
    appointments,
    orders,
    pricingTiers,
    isLoading,
    refreshData,
    getCustomerInteractions,
    getCustomerAppointments,
    getCustomerOrders,
  };
}
