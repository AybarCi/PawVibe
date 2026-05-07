-- Create recommendations table
CREATE TABLE public.recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    affiliate_url TEXT NOT NULL,
    pet_type TEXT DEFAULT 'both' NOT NULL, -- 'cat', 'dog', 'both'
    min_energy INTEGER DEFAULT 0 NOT NULL,
    min_chaos INTEGER DEFAULT 0 NOT NULL,
    min_sweetness INTEGER DEFAULT 0 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Policies for recommendations
-- Everyone can view active recommendations (Mobile App & Public)
CREATE POLICY "Everyone can view active recommendations" 
    ON public.recommendations FOR SELECT 
    USING (is_active = true);

-- Note: No INSERT/UPDATE/DELETE policies are added.
-- These operations will be performed via Edge Functions using the service_role key, 
-- which bypasses RLS entirely for administrative tasks.

-- Insert sample products
INSERT INTO public.recommendations (name, description, image_url, affiliate_url, pet_type, min_energy, min_chaos)
VALUES 
('Cyber-Ball for Dogs', 'High energy interactive ball for hyper dogs.', 'https://images.unsplash.com/photo-1576201836106-db1758fd1c97', 'https://amazon.com', 'dog', 70, 0),
('Neon Cat Nibbles', 'Premium treats for sweet neon cats.', 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e', 'https://amazon.com', 'cat', 0, 0);
