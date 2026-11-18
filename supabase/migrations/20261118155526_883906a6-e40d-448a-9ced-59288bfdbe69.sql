CREATE TABLE public.customer_channel_labels (
  code text PRIMARY KEY CHECK (code IN ('B2C','B2B','OEM')),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 40),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.customer_channel_labels TO authenticated;
GRANT ALL ON public.customer_channel_labels TO service_role;
ALTER TABLE public.customer_channel_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read channel labels" ON public.customer_channel_labels FOR SELECT TO authenticated USING (public.current_user_classification_access() IN ('read','write'));
CREATE POLICY "Rename channel labels" ON public.customer_channel_labels FOR UPDATE TO authenticated USING (public.current_user_classification_access() = 'write') WITH CHECK (public.current_user_classification_access() = 'write');
INSERT INTO public.customer_channel_labels(code,label) VALUES ('B2C','B2C'),('B2B','B2B'),('OEM','OEM');
CREATE TRIGGER update_customer_channel_labels_updated_at BEFORE UPDATE ON public.customer_channel_labels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();