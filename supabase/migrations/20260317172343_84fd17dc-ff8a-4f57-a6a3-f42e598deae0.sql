-- Allow all authenticated users to update b2b_clients (collaborative editing)
-- The app-level tab_permissions already controls who has write access
CREATE POLICY "Authenticated can update b2b_clients"
ON public.b2b_clients
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Same for INSERT (so write-permission users can create clients)
CREATE POLICY "Authenticated can insert b2b_clients"
ON public.b2b_clients
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Same for DELETE (soft-delete via update, but also for permanent delete)
CREATE POLICY "Authenticated can delete b2b_clients"
ON public.b2b_clients
FOR DELETE
TO authenticated
USING (true);
