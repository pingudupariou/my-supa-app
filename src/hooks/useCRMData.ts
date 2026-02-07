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
      // Tables may not exist yet - silently handle errors
      const [customersRes, ordersRes] = await Promise.all([
        supabase.from('customers' as any).select('*').order('company_name'),
        supabase.from('customer_orders' as any).select('*').order('order_date', { ascending: false }),
      ]);
      if (customersRes.data) setCustomers(customersRes.data as any);
      if (ordersRes.data) setOrders(ordersRes.data as any);
    } catch {
      // Tables don't exist yet
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return {
    customers, interactions, appointments, orders, pricingTiers, isLoading,
    refreshData: fetchData,
    getCustomerInteractions: (id: string) => interactions.filter(i => i.customer_id === id),
    getCustomerAppointments: (id: string) => appointments.filter(a => a.customer_id === id),
    getCustomerOrders: (id: string) => orders.filter(o => o.customer_id === id),
  };
}
