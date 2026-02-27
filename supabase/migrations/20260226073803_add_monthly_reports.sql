CREATE TABLE public.monthly_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    month_year TEXT NOT NULL,
    report JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, month_year)
);

ALTER TABLE public.monthly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" 
    ON public.monthly_reports 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports" 
    ON public.monthly_reports 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
