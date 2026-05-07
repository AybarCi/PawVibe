-- Add is_pet and explanation columns to scans table
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS is_pet BOOLEAN DEFAULT TRUE;
ALTER TABLE public.scans ADD COLUMN IF NOT EXISTS explanation TEXT;
