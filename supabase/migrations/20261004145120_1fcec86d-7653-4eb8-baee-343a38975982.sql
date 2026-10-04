CREATE TABLE public.erplain_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_by uuid
);
CREATE TABLE public.erplain_order_lines (
  line_id bigint PRIMARY KEY,
  order_id bigint NOT NULL,
  order_label text, order_status text, shipping_status text, delivery_status text, stock_allocation_status text,
  order_shipping_at text, line_shipping_at text,
  variant_id bigint, sku text, variant_label text, location_id bigint, location_label text,
  quantity numeric, shipped_quantity numeric, delivered_quantity numeric, reserved_quantity numeric, committed_quantity numeric,
  run_id uuid, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erplain_stock_levels (
  id bigint PRIMARY KEY,
  variant_id bigint, sku text, variant_label text, location_id bigint, location_label text,
  on_hand numeric, available numeric, reserved numeric, incoming numeric,
  run_id uuid, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erplain_manufacturing_orders (
  id bigint PRIMARY KEY,
  label text, status text, operation_type text,
  variant_id bigint, sku text, variant_label text, location_id bigint, location_label text,
  quantity numeric, remaining_to_produce numeric, actually_produced numeric, due_at text,
  bill_of_material_id bigint, manufacturing_routing_id bigint,
  order_line_item_ids bigint[] NOT NULL DEFAULT '{}',
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_id uuid, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erplain_boms (
  id bigint PRIMARY KEY,
  label text, active boolean, is_default boolean,
  variant_id bigint, sku text, variant_label text, manufacturing_routing_id bigint,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_id uuid, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erplain_routings (
  id bigint PRIMARY KEY,
  label text, active boolean,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_id uuid, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.erplain_mo_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  variant_id bigint NOT NULL, location_id bigint,
  quantity numeric NOT NULL,
  order_line_item_ids bigint[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'prepared',
  erplain_mo_id bigint,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.erplain_order_lines (variant_id, location_id);
CREATE INDEX ON public.erplain_stock_levels (variant_id, location_id);
CREATE INDEX ON public.erplain_manufacturing_orders (variant_id, location_id);
CREATE INDEX ON public.erplain_boms (variant_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['erplain_sync_runs','erplain_order_lines','erplain_stock_levels','erplain_manufacturing_orders','erplain_boms','erplain_routings','erplain_mo_submissions'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Admins can read %s" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;