CREATE POLICY "Anyone can read page images"
ON public.page_images FOR SELECT
TO anon
USING (true);