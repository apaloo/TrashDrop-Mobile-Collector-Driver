-- Create collectors table
CREATE TABLE IF NOT EXISTS public.collectors (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  phone_number TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Add index for phone number lookups
CREATE INDEX IF NOT EXISTS idx_collectors_phone_number ON public.collectors(phone_number);

-- Enable Row Level Security
ALTER TABLE public.collectors ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to view their own collector record
CREATE POLICY "Users can view their own collector record"
  ON public.collectors
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow admins to manage all collector records
CREATE POLICY "Admins can manage all collector records"
  ON public.collectors
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create a function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to update the updated_at column on each update
CREATE TRIGGER update_collectors_updated_at
BEFORE UPDATE ON public.collectors
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
