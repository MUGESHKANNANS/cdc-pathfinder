-- Create storage bucket for event attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('event-attachments', 'event-attachments', false);

-- Add attachment_url column to events table
ALTER TABLE public.events ADD COLUMN attachment_url TEXT;

-- Create policies for event attachments storage
CREATE POLICY "CDC Directors can upload event attachments" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'event-attachments' AND auth.uid() IN (
  SELECT user_id FROM public.profiles WHERE role = 'cdc_director'
));

CREATE POLICY "Authenticated users can view event attachments" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'event-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "CDC Directors can update event attachments" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'event-attachments' AND auth.uid() IN (
  SELECT user_id FROM public.profiles WHERE role = 'cdc_director'
));

CREATE POLICY "CDC Directors can delete event attachments" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'event-attachments' AND auth.uid() IN (
  SELECT user_id FROM public.profiles WHERE role = 'cdc_director'
));