-- Growth Assistant (Instagram Cockpit) Database Migration

-- 1. Target Hashtags Table
CREATE TABLE IF NOT EXISTS public.target_hashtags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Discovered Posts Table
CREATE TABLE IF NOT EXISTS public.discovered_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instagram_post_id VARCHAR(100) UNIQUE NOT NULL,
    post_url TEXT NOT NULL,
    thumbnail_url TEXT,
    author_username VARCHAR(100),
    caption TEXT,
    hashtag_source VARCHAR(100),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'POSTED', 'SKIPPED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    posted_at TIMESTAMPTZ
);

-- 3. Comment Variations Table
CREATE TABLE IF NOT EXISTS public.comment_variations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES public.discovered_posts(id) ON DELETE CASCADE,
    comment_text TEXT NOT NULL,
    tone_label VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.target_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discovered_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_variations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users / backoffice access
CREATE POLICY "Authenticated users can select target_hashtags" ON public.target_hashtags FOR SELECT USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can insert target_hashtags" ON public.target_hashtags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can update target_hashtags" ON public.target_hashtags FOR UPDATE USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can delete target_hashtags" ON public.target_hashtags FOR DELETE USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Authenticated users can select discovered_posts" ON public.discovered_posts FOR SELECT USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can insert discovered_posts" ON public.discovered_posts FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can update discovered_posts" ON public.discovered_posts FOR UPDATE USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can delete discovered_posts" ON public.discovered_posts FOR DELETE USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

CREATE POLICY "Authenticated users can select comment_variations" ON public.comment_variations FOR SELECT USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can insert comment_variations" ON public.comment_variations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can update comment_variations" ON public.comment_variations FOR UPDATE USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Authenticated users can delete comment_variations" ON public.comment_variations FOR DELETE USING (auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Seed Default Target Hashtags
INSERT INTO public.target_hashtags (tag, is_active) VALUES
('doglovers', true),
('kedisahiplenme', true),
('goldenretriever', true),
('catlovers', true)
ON CONFLICT (tag) DO NOTHING;
