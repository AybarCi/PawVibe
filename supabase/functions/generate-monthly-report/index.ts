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
        const { currentMonthYear, language = 'en' } = await req.json() // e.g., '2026-02'

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

        // 2. Check if report already exists for this month
        const targetMonth = currentMonthYear || new Date().toISOString().slice(0, 7) // fallback to current YYYY-MM
        const { data: existingReport } = await supabase
            .from('monthly_reports')
            .select('*')
            .eq('user_id', user.id)
            .eq('month_year', targetMonth)
            .single()

        if (existingReport && existingReport.report) {
            return new Response(JSON.stringify({ data: existingReport.report }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        // 3. Fetch all scans for this user in the target month
        const startOfMonth = new Date(`${targetMonth}-01T00:00:00Z`).toISOString()
        const endOfMonthDate = new Date(`${targetMonth}-01T00:00:00Z`)
        endOfMonthDate.setMonth(endOfMonthDate.getMonth() + 1)
        const endOfMonth = endOfMonthDate.toISOString()

        const { data: scans, error: scansError } = await supabase
            .from('scans')
            .select('*')
            .eq('user_id', user.id)
            .gte('created_at', startOfMonth)
            .lt('created_at', endOfMonth)

        if (scansError) {
            throw scansError
        }

        if (!scans || scans.length === 0) {
            return new Response(JSON.stringify({ error: 'No scans found for this month to generate a report' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // Aggregate Data
        const avgChaos = scans.reduce((acc, s) => acc + (s.chaos_score || 0), 0) / scans.length;
        const avgEnergy = scans.reduce((acc, s) => acc + (s.energy_level || 0), 0) / scans.length;
        const avgSweet = scans.reduce((acc, s) => acc + (s.sweetness_score || 0), 0) / scans.length;
        const avgJudge = scans.reduce((acc, s) => acc + (s.judgment_level || 0), 0) / scans.length;
        const avgCuddle = scans.reduce((acc, s) => acc + (s.cuddle_o_meter || 0), 0) / scans.length;
        const avgDerp = scans.reduce((acc, s) => acc + (s.derp_factor || 0), 0) / scans.length;
        const mostCommonMood = scans.map(s => s.mood_title).sort((a, b) => 
            scans.filter(v => v.mood_title === a).length - scans.filter(v => v.mood_title === b).length
        ).pop()

        // 4. Setup OpenAI Fetch Request
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

        // 5. Prompt for Monthly Report
        const prompt = `You are a highly qualified, slightly eccentric "Pet Psychologist" for a mobile app called PawVibe. 
I am providing you with the aggregated vibe scan results of a pet over the last month.
Total Scans this month: ${scans.length}
Aggregated Data:
- Most Common Mood: ${mostCommonMood}
- Average Chaos Score: ${avgChaos.toFixed(1)}/100
- Average Energy Level: ${avgEnergy.toFixed(1)}/100
- Average Sweetness Score: ${avgSweet.toFixed(1)}/100
- Average Judgment Level: ${avgJudge.toFixed(1)}/100
- Average Cuddle-o-Meter: ${avgCuddle.toFixed(1)}/100
- Average Derp Factor: ${avgDerp.toFixed(1)}/100

Generate a funny, insightful, and slightly sarcastic "Monthly Psychologist Report" for the pet's owner. Return ONLY a valid JSON object with the following structure:
{
  "title": "String (e.g., 'The Month of Infinite Derp', 'A Period of High Judgment')",
  "executive_summary": "String (A witty 2-3 sentence overview of the month)",
  "behavioral_analysis": "String (A funny analysis of their highest and lowest averages)",
  "recommendation_for_owner": "String (Sarcastic advice on how the owner should adapt to their pet's needs next month)"
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
                max_tokens: 350,
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

        const reportJSON = JSON.parse(content)

        // 6. Save to DB using Service Role Key to bypass RLS for updates or upserts if needed
        // Monthly reports uses RLS with insert allowed, but using service role is safer for backend operations.
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { error: insertError } = await adminClient
            .from('monthly_reports')
            .upsert({ 
                user_id: user.id, 
                month_year: targetMonth, 
                report: reportJSON 
            })

        if (insertError) {
            console.error('Error saving report to DB:', insertError)
        }

        return new Response(JSON.stringify({ data: reportJSON }), {
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
