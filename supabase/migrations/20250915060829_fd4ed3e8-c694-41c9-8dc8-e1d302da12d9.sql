-- Create trainings table
CREATE TABLE public.trainings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_name TEXT NOT NULL,
  batch TEXT NOT NULL,
  description TEXT,
  organized_by TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  mode TEXT CHECK (mode IN ('Online', 'Offline')) DEFAULT 'Online',
  status TEXT CHECK (status IN ('Upcoming', 'Ongoing', 'Completed')) DEFAULT 'Upcoming',
  progress_notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create training assignments table for many-to-many relationship
CREATE TABLE public.training_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id UUID NOT NULL,
  faculty_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (training_id) REFERENCES public.trainings(id) ON DELETE CASCADE,
  UNIQUE(training_id, faculty_id)
);

-- Enable Row Level Security
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trainings table
CREATE POLICY "CDC Directors can manage trainings" 
ON public.trainings 
FOR ALL 
USING (is_cdc_director(auth.uid()))
WITH CHECK (is_cdc_director(auth.uid()));

CREATE POLICY "Everyone can view trainings" 
ON public.trainings 
FOR SELECT 
USING (true);

CREATE POLICY "Faculty can update their assigned trainings status" 
ON public.trainings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.training_assignments 
    WHERE training_id = trainings.id 
    AND faculty_id = auth.uid()
  )
);

-- RLS Policies for training_assignments table
CREATE POLICY "CDC Directors can manage training assignments" 
ON public.training_assignments 
FOR ALL 
USING (is_cdc_director(auth.uid()))
WITH CHECK (is_cdc_director(auth.uid()));

CREATE POLICY "Everyone can view training assignments" 
ON public.training_assignments 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_trainings_updated_at
BEFORE UPDATE ON public.trainings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();