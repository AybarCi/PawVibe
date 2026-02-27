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

        // 3. Setup OpenAI Request
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

        // 4. Prompt for Astrology
        const prompt = `You are a mystical, sarcastic, and witty "Pet Astrologer" for a mobile app called PawVibe. 
I am providing you with the vibe scan results of a pet.
Scan Data:
- Mood: ${scan.mood_title}
- Chaos Score: ${scan.chaos_score}/100
- Energy Level: ${scan.energy_level}/100
- Sweetness Score: ${scan.sweetness_score}/100
- Judgment Level: ${scan.judgment_level}/100
- Cuddle-o-Meter: ${scan.cuddle_o_meter}/100
- Derp Factor: ${scan.derp_factor}/100

Generate a funny astrology profile for this pet. Return ONLY a valid JSON object with the following structure:
{
  "sun_sign": "String (e.g., 'Taurus with a chaotic twist', 'Aries', make it pet-themed or funny)",
  "moon_sign": "String",
  "rising_sign": "String",
  "horoscope": "String (A witty 3-4 sentence daily horoscope reading based on their current stats. Be funny and sarcastic.)"
}
CRITICAL: ALL string values inside the JSON MUST be localized and written in this ISO language code: ${language}.`

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.8,
                max_tokens: 300,
                response_format: { type: 'json_object' },
                messages: [{ role: 'user', content: prompt }]
            })
        });

        if (!response.ok) {
            const errData = await response.text();
            throw new Error(`OpenAI error: ${errData}`);
        }

        const openAiData = await response.json();
        const content = openAiData.choices[0].message?.content;

        if (!content) {
            throw new Error('No content returned from OpenAI')
        }

        const astrologyJSON = JSON.parse(content)

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
