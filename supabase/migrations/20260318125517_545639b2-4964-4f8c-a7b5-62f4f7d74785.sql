UPDATE public.crm_meetings
SET business_entity_id = '5c069c01-def9-40b7-9e75-665e23a8b9ae'
WHERE business_entity_id IS NULL;

UPDATE public.crm_reminders
SET business_entity_id = '5c069c01-def9-40b7-9e75-665e23a8b9ae'
WHERE business_entity_id IS NULL;

UPDATE public.customer_interactions
SET business_entity_id = '5c069c01-def9-40b7-9e75-665e23a8b9ae'
WHERE business_entity_id IS NULL;

UPDATE public.crm_business_entities
SET is_default = CASE WHEN id = '5c069c01-def9-40b7-9e75-665e23a8b9ae' THEN true ELSE false END
WHERE id IN ('5c069c01-def9-40b7-9e75-665e23a8b9ae','3c99a04f-f71a-4acf-aebf-c37834a7f2a4');