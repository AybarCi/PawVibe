-- 1. Update default weekly_credits to 2 for new users
ALTER TABLE public.profiles 
ALTER COLUMN weekly_credits SET DEFAULT 2;

-- 2. Update handle_new_user trigger function to set default weekly credits to 2
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, weekly_credits, purchased_credits, is_premium, last_reset_date)
    VALUES (new.id, 2, 0, false, now());
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
