-- ==========================================
-- PawVibe Database Schema & RLS Policies
-- ==========================================

-- 1. Create profiles table
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    weekly_credits INTEGER DEFAULT 5 NOT NULL,
    purchased_credits INTEGER DEFAULT 0 NOT NULL,
    last_reset_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_premium BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. Create scans table
CREATE TABLE public.scans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    mood_title TEXT NOT NULL,
    confidence REAL NOT NULL,
    chaos_score INTEGER NOT NULL,
    energy_level INTEGER NOT NULL,
    sweetness_score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ==========================================
-- Row Level Security (RLS)
-- ==========================================

-- Enable RLS on both tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
-- Users can read only their own profile
CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Scans Policies
-- Users can read only their own scans
CREATE POLICY "Users can view own scans" 
    ON public.scans FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can insert their own scans
-- (If your Edge Function uses a service_role key, it bypasses RLS, but this is good if the client inserts directly)
CREATE POLICY "Users can insert own scans" 
    ON public.scans FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- Triggers for Auth
-- ==========================================

-- Automatically create a profile when a new user signs up (Anonymous or standard)
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, weekly_credits, purchased_credits, is_premium, last_reset_date)
    VALUES (new.id, 5, 0, false, now());
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
