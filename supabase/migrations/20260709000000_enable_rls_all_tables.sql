-- ==========================================================
-- Enable RLS and Configure Security Policies for PawVibe Tables
-- ==========================================================

-- 1. Enable RLS on all tables
ALTER TABLE public.iap_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 2. Define Policies for public.iap_transactions
DROP POLICY IF EXISTS "Admins can view all iap transactions" ON public.iap_transactions;
CREATE POLICY "Admins can view all iap transactions" 
    ON public.iap_transactions FOR SELECT 
    USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

-- 3. Define Policies for public.vaccinations
DROP POLICY IF EXISTS "Users can view own vaccinations" ON public.vaccinations;
CREATE POLICY "Users can view own vaccinations"
    ON public.vaccinations FOR SELECT
    USING ( auth.uid() = user_id OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

DROP POLICY IF EXISTS "Users can insert own vaccinations" ON public.vaccinations;
CREATE POLICY "Users can insert own vaccinations"
    ON public.vaccinations FOR INSERT
    WITH CHECK ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can update own vaccinations" ON public.vaccinations;
CREATE POLICY "Users can update own vaccinations"
    ON public.vaccinations FOR UPDATE
    USING ( auth.uid() = user_id );

DROP POLICY IF EXISTS "Users can delete own vaccinations" ON public.vaccinations;
CREATE POLICY "Users can delete own vaccinations"
    ON public.vaccinations FOR DELETE
    USING ( auth.uid() = user_id );

-- 4. Define Policies for public.recommendation_clicks
DROP POLICY IF EXISTS "Users can view own clicks" ON public.recommendation_clicks;
CREATE POLICY "Users can view own clicks"
    ON public.recommendation_clicks FOR SELECT
    USING ( auth.uid() = user_id OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

DROP POLICY IF EXISTS "Users can insert own clicks" ON public.recommendation_clicks;
CREATE POLICY "Users can insert own clicks"
    ON public.recommendation_clicks FOR INSERT
    WITH CHECK ( auth.uid() = user_id );

-- 5. Define Policies for public.pets
DROP POLICY IF EXISTS "Anyone authenticated can view pet profiles" ON public.pets;
CREATE POLICY "Anyone authenticated can view pet profiles"
    ON public.pets FOR SELECT
    USING ( auth.uid() IS NOT NULL OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

DROP POLICY IF EXISTS "Users can insert own pets" ON public.pets;
CREATE POLICY "Users can insert own pets"
    ON public.pets FOR INSERT
    WITH CHECK ( auth.uid() = owner_id );

DROP POLICY IF EXISTS "Users can update own pets" ON public.pets;
CREATE POLICY "Users can update own pets"
    ON public.pets FOR UPDATE
    USING ( auth.uid() = owner_id );

DROP POLICY IF EXISTS "Users can delete own pets" ON public.pets;
CREATE POLICY "Users can delete own pets"
    ON public.pets FOR DELETE
    USING ( auth.uid() = owner_id );

-- 6. Define Policies for public.matches
DROP POLICY IF EXISTS "Users can view own matches" ON public.matches;
CREATE POLICY "Users can view own matches"
    ON public.matches FOR SELECT
    USING (
        pet_from IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
        OR pet_to IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

DROP POLICY IF EXISTS "Users can insert own matches" ON public.matches;
CREATE POLICY "Users can insert own matches"
    ON public.matches FOR INSERT
    WITH CHECK ( pet_from IN (SELECT id FROM public.pets WHERE owner_id = auth.uid()) );

DROP POLICY IF EXISTS "Users can update own matches" ON public.matches;
CREATE POLICY "Users can update own matches"
    ON public.matches FOR UPDATE
    USING ( pet_from IN (SELECT id FROM public.pets WHERE owner_id = auth.uid()) );

DROP POLICY IF EXISTS "Users can delete own matches" ON public.matches;
CREATE POLICY "Users can delete own matches"
    ON public.matches FOR DELETE
    USING (
        pet_from IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
        OR pet_to IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
    );

-- 7. Define Policies for public.messages
DROP POLICY IF EXISTS "Users can view messages in own matches" ON public.messages;
CREATE POLICY "Users can view messages in own matches"
    ON public.messages FOR SELECT
    USING (
        match_id IN (
            SELECT id FROM public.matches 
            WHERE pet_from IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
            OR pet_to IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
        )
        OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    );

DROP POLICY IF EXISTS "Users can insert messages in own matches" ON public.messages;
CREATE POLICY "Users can insert messages in own matches"
    ON public.messages FOR INSERT
    WITH CHECK (
        match_id IN (
            SELECT id FROM public.matches 
            WHERE pet_from IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
            OR pet_to IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
        )
    );

DROP POLICY IF EXISTS "Users can update messages in own matches" ON public.messages;
CREATE POLICY "Users can update messages in own matches"
    ON public.messages FOR UPDATE
    USING (
        match_id IN (
            SELECT id FROM public.matches 
            WHERE pet_from IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
            OR pet_to IN (SELECT id FROM public.pets WHERE owner_id = auth.uid())
        )
    );
