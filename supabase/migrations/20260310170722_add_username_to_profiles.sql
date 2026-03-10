-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Update the trigger function to automatically assign a GuestXXXX username
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    -- Generate a more compact 6-character random suffix
    -- e.g. Guest-X3F9A1
    random_suffix TEXT := upper(substr(md5(random()::text), 1, 6));
    new_username TEXT := 'Guest-' || random_suffix;
BEGIN
    INSERT INTO public.profiles (id, weekly_credits, purchased_credits, is_premium, last_reset_date, username)
    VALUES (new.id, 5, 0, false, now(), new_username);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing profiles that have no username
DO $$ 
DECLARE
    r RECORD;
    random_suffix TEXT;
BEGIN
    FOR r IN SELECT id FROM public.profiles WHERE username IS NULL LOOP
        random_suffix := upper(substr(md5(random()::text), 1, 6));
        UPDATE public.profiles SET username = 'Guest-' || random_suffix WHERE id = r.id;
    END LOOP;
END $$;
