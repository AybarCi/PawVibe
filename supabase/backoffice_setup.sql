-- ==========================================
-- PawVibe Backoffice - Safe Setup
-- ==========================================
-- This script ONLY adds new logging tables. 
-- It does NOT modify or delete any existing mobile app tables.

-- 1. Create Credit Logs table (For Admin actions audit trail)
CREATE TABLE IF NOT EXISTS public.credit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    admin_id UUID REFERENCES auth.users(id),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Admin Policies
-- Only users with { role: 'admin' } in their user_metadata can see these.
CREATE POLICY "Admins can view all credit logs" ON public.credit_logs
    USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );
