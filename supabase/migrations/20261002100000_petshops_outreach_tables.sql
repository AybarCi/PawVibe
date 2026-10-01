-- ==========================================================
-- Petshops & B2B Outreach Tables Migration
-- ==========================================================

-- 1. Petshops Table
CREATE TABLE IF NOT EXISTS public.petshops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    country TEXT NOT NULL CHECK (country IN ('TR', 'US')),
    city TEXT,
    website TEXT,
    phone TEXT,
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'ecommerce', 'retail', 'boutique', 'vet_clinic')),
    status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'contacted', 'replied', 'partner', 'unsubscribed')),
    notes TEXT,
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Email Outreach Logs Table
CREATE TABLE IF NOT EXISTS public.petshop_email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    petshop_id UUID REFERENCES public.petshops(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    language TEXT NOT NULL CHECK (language IN ('tr', 'en')),
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error_message TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_petshops_country ON public.petshops(country);
CREATE INDEX IF NOT EXISTS idx_petshops_status ON public.petshops(status);
CREATE INDEX IF NOT EXISTS idx_petshops_email ON public.petshops(email);
CREATE INDEX IF NOT EXISTS idx_petshop_email_logs_petshop_id ON public.petshop_email_logs(petshop_id);

-- 4. Enable RLS
ALTER TABLE public.petshops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.petshop_email_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (Admins have full access)
DROP POLICY IF EXISTS "Admins can manage petshops" ON public.petshops;
CREATE POLICY "Admins can manage petshops" 
    ON public.petshops FOR ALL 
    USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

DROP POLICY IF EXISTS "Admins can view petshop email logs" ON public.petshop_email_logs;
CREATE POLICY "Admins can view petshop email logs" 
    ON public.petshop_email_logs FOR ALL 
    USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );
