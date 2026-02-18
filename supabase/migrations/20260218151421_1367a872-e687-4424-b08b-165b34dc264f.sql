-- Storage bucket for page images
INSERT INTO storage.buckets (id, name, public) VALUES ('page-images', 'page-images', true);

-- RLS policies for the bucket
CREATE POLICY "Anyone can view page images"
ON storage.objects FOR SELECT
USING (bucket_id = 'page-images');

CREATE POLICY "Authenticated users can upload page images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'page-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update page images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'page-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete page images"
ON storage.objects FOR DELETE
USING (bucket_id = 'page-images' AND auth.uid() IS NOT NULL);

-- Table to track which images are used where
CREATE TABLE public.page_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key text NOT NULL,
  slot_key text NOT NULL,
  image_url text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE(page_key, slot_key)
);

ALTER TABLE public.page_images ENABLE ROW LEVEL SECURITY;

-- Everyone can read page images
CREATE POLICY "Anyone authenticated can read page images"
ON public.page_images FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Anyone authenticated can manage (write permission checked in app)
CREATE POLICY "Authenticated can manage page images"
ON public.page_images FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
