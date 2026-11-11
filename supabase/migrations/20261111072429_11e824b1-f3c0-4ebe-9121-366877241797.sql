ALTER FUNCTION public.current_user_classification_access() SECURITY INVOKER;
ALTER FUNCTION public.customer_channel(text) SECURITY INVOKER;
ALTER FUNCTION public.assign_customer_channels(text[],text) SECURITY INVOKER;