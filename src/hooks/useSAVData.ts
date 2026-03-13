import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface SAVTicket {
  id: string;
  user_id: string;
  ticket_number: string;
  open_date: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_type: string;
  invoice_number: string | null;
  product_sku: string | null;
  is_under_warranty: boolean;
  media_received: boolean;
  problem_description: string | null;
  client_returned_product: boolean;
  parts_sent_for_repair: string | null;
  bl_reference: string | null;
  bl_send_date: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useSAVData() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SAVTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTickets = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('sav_tickets' as any)
      .select('*')
      .order('open_date', { ascending: false });

    if (error) {
      console.error('Error fetching SAV tickets:', error);
      toast.error('Erreur lors du chargement des tickets SAV');
    } else {
      setTickets((data as any[]) || []);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  const createTicket = async (ticket: Partial<SAVTicket>) => {
    if (!user) return;
    const { error } = await supabase
      .from('sav_tickets' as any)
      .insert({ ...ticket, user_id: user.id } as any);
    if (error) {
      toast.error('Erreur lors de la création du ticket');
      console.error(error);
    } else {
      toast.success('Ticket SAV créé');
      fetchTickets();
    }
  };

  const updateTicket = async (id: string, updates: Partial<SAVTicket>) => {
    const { error } = await supabase
      .from('sav_tickets' as any)
      .update(updates as any)
      .eq('id', id);
    if (error) {
      toast.error('Erreur lors de la mise à jour');
      console.error(error);
    } else {
      toast.success('Ticket mis à jour');
      fetchTickets();
    }
  };

  const deleteTicket = async (id: string) => {
    const { error } = await supabase
      .from('sav_tickets' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    } else {
      toast.success('Ticket supprimé');
      fetchTickets();
    }
  };

  const generateTicketNumber = () => {
    const now = new Date();
    const y = now.getFullYear().toString().slice(-2);
    const m = (now.getMonth() + 1).toString().padStart(2, '0');
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SAV-${y}${m}-${rand}`;
  };

  return { tickets, isLoading, createTicket, updateTicket, deleteTicket, fetchTickets, generateTicketNumber };
}
