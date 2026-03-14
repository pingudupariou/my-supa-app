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
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSAVData() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SAVTicket[]>([]);
  const [trashedTickets, setTrashedTickets] = useState<SAVTicket[]>([]);
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
      const all = (data as any[]) || [];
      setTickets(all.filter(t => !t.deleted_at));
      setTrashedTickets(all.filter(t => !!t.deleted_at));
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

  const softDeleteTicket = async (id: string) => {
    const { error } = await supabase
      .from('sav_tickets' as any)
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression');
      console.error(error);
    } else {
      toast.success('Ticket déplacé dans la corbeille');
      fetchTickets();
    }
  };

  const restoreTicket = async (id: string) => {
    const { error } = await supabase
      .from('sav_tickets' as any)
      .update({ deleted_at: null } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erreur lors de la restauration');
      console.error(error);
    } else {
      toast.success('Ticket restauré');
      fetchTickets();
    }
  };

  const permanentDeleteTicket = async (id: string) => {
    const { error } = await supabase
      .from('sav_tickets' as any)
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression définitive');
      console.error(error);
    } else {
      toast.success('Ticket supprimé définitivement');
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

  return { tickets, trashedTickets, isLoading, createTicket, updateTicket, softDeleteTicket, restoreTicket, permanentDeleteTicket, fetchTickets, generateTicketNumber };
}
