import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { scanId, language = 'en' } = await req.json()

        if (!scanId) {
            return new Response(JSON.stringify({ error: 'scanId is required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        const authHeader = req.headers.get('Authorization')!
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw new Error('Unauthorized')

        // 1. Verify User is actually Premium
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            });
        }

        if (!profile.is_premium) {
            return new Response(JSON.stringify({ error: 'Premium subscription required' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 403,
            });
        }

        // 2. Fetch the scan (RLS ensures user owns it)
        const { data: scan, error: scanError } = await supabase
            .from('scans')
            .select('*')
            .eq('id', scanId)
            .single()

        if (scanError || !scan) {
            console.error('Error fetching scan:', scanError)
            return new Response(JSON.stringify({ error: 'Scan not found or unauthorized' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            })
        }

        // Check if astrology is already generated
        if (scan.astrology) {
            return new Response(JSON.stringify({ data: scan.astrology }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 3. Setup Gemini Request
        const apiKey = Deno.env.get('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

        // 4. Prompt for Astrology
        const prompt = `IMPORTANT: YOU MUST RESPOND EXCLUSIVELY IN THIS LANGUAGE: ${language}.

You are a sophisticated and mystical "Pet Celestial Guide". 
I am providing you with the behavioral data of a pet from a recent vibe scan.
Behavioral Alignment Data:
- Predominant Mood: ${scan.mood_title}
- Chaos/Reactivity Score: ${scan.chaos_score}/100
- Energy/Activity Level: ${scan.energy_level}/100
- Socialization Score: ${scan.sweetness_score}/100
- Observation/Judgment Level: ${scan.judgment_level}/100
- Affection Level: ${scan.cuddle_o_meter}/100
- Unconventional Traits: ${scan.derp_factor}/100

Generate a deeply insightful and mystical "Pet Astrology Chart" in ${language}. 
- Interpret the behavioral scores as celestial alignments and cosmic archetypes.
- Use a wise, sophisticated, and revealing tone in ${language}. Avoid casual jokes or sarcasm.
- The chart should feel like a profound discovery of the pet's inner cosmic nature.

Return ONLY a valid JSON object with the following structure:
{
  "sun_sign": "String (A celestial archetype in ${language})",
  "moon_sign": "String (Representing inner emotional needs in ${language})",
  "rising_sign": "String (Representing energy projection in ${language})",
  "horoscope": "String (A sophisticated celestial reading in ${language})"
}
CRITICAL: ALL string values inside the JSON MUST be in ${language}.`

        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(geminiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    response_mime_type: 'application/json',
                    temperature: 0.8
                }
            })
        });

        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`Gemini error: ${errData}`);
        }

        const geminiData = await response.json();
        const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!content) {
            throw new Error('No content returned from Gemini');
        }

        let rawContent = content.trim();
        const firstBrace = rawContent.indexOf('{');
        const lastBrace = rawContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            rawContent = rawContent.substring(firstBrace, lastBrace + 1);
        }

        const astrologyJSON = JSON.parse(rawContent)

        // 5. Save to DB using Service Role Key to bypass RLS for updates
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { error: updateError } = await adminClient
            .from('scans')
            .update({ astrology: astrologyJSON })
            .eq('id', scanId)

        if (updateError) {
            console.error('Error updating DB with astrology cache:', updateError)
        }

        return new Response(JSON.stringify({ data: astrologyJSON }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('Function error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
