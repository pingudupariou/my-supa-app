
-- Add soft delete column to costflow_products
ALTER TABLE public.costflow_products 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add soft delete column to costflow_references
ALTER TABLE public.costflow_references 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Index for performance on filtering
CREATE INDEX idx_costflow_products_deleted_at ON public.costflow_products(deleted_at);
CREATE INDEX idx_costflow_references_deleted_at ON public.costflow_references(deleted_at);
