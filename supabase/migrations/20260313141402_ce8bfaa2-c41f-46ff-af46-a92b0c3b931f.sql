
CREATE TABLE public.sav_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticket_number TEXT NOT NULL,
  open_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_type TEXT NOT NULL DEFAULT 'B2C',
  invoice_number TEXT,
  product_sku TEXT,
  is_under_warranty BOOLEAN DEFAULT false,
  media_received BOOLEAN DEFAULT false,
  problem_description TEXT,
  client_returned_product BOOLEAN DEFAULT false,
  parts_sent_for_repair TEXT,
  bl_reference TEXT,
  bl_send_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sav_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read all sav_tickets"
  ON public.sav_tickets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can manage their own sav_tickets"
  ON public.sav_tickets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
