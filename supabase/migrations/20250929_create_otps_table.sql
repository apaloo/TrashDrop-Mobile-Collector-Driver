-- Create OTPs table for storing one-time passwords
CREATE TABLE IF NOT EXISTS public.otps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Add indexes for faster lookups
  CONSTRAINT otps_phone_key UNIQUE (phone)
);

-- Add RLS policies for security
ALTER TABLE public.otps ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage OTPs
CREATE POLICY "Service role can manage OTPs" ON public.otps
  FOR ALL
  TO service_role
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE public.otps IS 'Stores one-time passwords for phone verification';
