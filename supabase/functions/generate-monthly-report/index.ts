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
        const targetMonth = currentMonthYear || new Date().toISOString().slice(0, 7)
        const { data: existingReport } = await supabase
            .from('monthly_reports')
            .select('*')
            .eq('user_id', user.id)
            .eq('month_year', targetMonth)
            .maybeSingle()

        // Cache logic: Compare requested language with report's language
        const reqLangCode = String(language || 'en').split('-')[0].toLowerCase();
        
        if (existingReport && existingReport.report) {
            const storedLangCode = existingReport.report.lang || 'en'; // Default to 'en' if missing
            
            if (storedLangCode === reqLangCode) {
                return new Response(JSON.stringify({ data: existingReport.report }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 200,
                });
            }
            // If languages differ (e.g., requested 'fr' but stored 'en'), fall through to regenerate
        }

        // 3. Fetch all scans for this user in the target month
        let startOfMonth, endOfMonth;
        try {
            startOfMonth = new Date(`${targetMonth}-01T00:00:00Z`).toISOString()
            const endOfMonthDate = new Date(`${targetMonth}-01T00:00:00Z`)
            endOfMonthDate.setMonth(endOfMonthDate.getMonth() + 1)
            endOfMonth = endOfMonthDate.toISOString()
        } catch (e) {
            console.error('Date parsing error for targetMonth:', targetMonth);
            throw new Error(`Invalid month format: ${targetMonth}`);
        }

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
        const moodTitles = scans.map(s => s.mood_title).filter(Boolean);
        const mostCommonMood = moodTitles.length > 0 
            ? moodTitles.sort((a, b) => moodTitles.filter(v => v === a).length - moodTitles.filter(v => v === b).length).pop() 
            : 'Unknown';

        // 4. Setup OpenAI Fetch Request
        const apiKey = Deno.env.get('OPENAI_API_KEY');
        if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

        // Normalize language for OpenAI safely
        const langMap: Record<string, string> = {
            'tr': 'Turkish',
            'en': 'English',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'pt': 'Portuguese',
            'ru': 'Russian'
        };
        const targetLang = langMap[reqLangCode] || 'English';

        // 5. Prompt for Monthly Report
        const prompt = `CRITICAL: ALL YOUR RESPONSES MUST BE IN ${targetLang.toUpperCase()}. 
DO NOT USE ENGLISH UNLESS ${targetLang.toUpperCase()} IS ENGLISH.

You are a Chief Veterinary Behaviorist for PawVibe. 
I am providing you with the aggregated behavioral data of a pet over the last 30 days. 
Total Scans Analyzed: ${scans.length}

Aggregated Monthly Data:
- Predominant Emotional State: ${mostCommonMood}
- Average Chaos/Reactivity Score: ${avgChaos.toFixed(1)}/100
- Average Energy/Activity Level: ${avgEnergy.toFixed(1)}/100
- Average Sweetness/Socialization Score: ${avgSweet.toFixed(1)}/100
- Average Judgment/Observation Level: ${avgJudge.toFixed(1)}/100
- Average Cuddle-o-Meter/Affection Level: ${avgCuddle.toFixed(1)}/100
- Average Derp Factor/Unconventional Behavior: ${avgDerp.toFixed(1)}/100

TASK: Generate a professional, analytical, and insightful "Monthly Behavioral Assessment Report" in ${targetLang}. 
- Tone: Authoritative, clinical, supportive (Veterinary Behavioral Specialist style).
- Content: Focus on trends and psychological well-being based on the scores.
- Language: USE ONLY ${targetLang}.

Return ONLY a valid JSON object with this structure:
{
  "lang": "${reqLangCode}",
  "title": "A professional diagnostic title in ${targetLang}",
  "executive_summary": "A professional 2-3 sentence overview in ${targetLang}",
  "behavioral_analysis": "An in-depth analysis in ${targetLang}",
  "recommendation_for_owner": "Expert behavioral advice in ${targetLang}"
}
FINAL CHECK: Is every single word in ${targetLang}? If not, translate it now. Include the "lang" field with value "${reqLangCode}".`

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.7,
                max_tokens: 600,
                response_format: { type: 'json_object' },
                messages: [
                    { 
                        role: 'system', 
                        content: `You are a Chief Veterinary Behaviorist. You must respond ONLY with a valid JSON object in ${targetLang}. No other text.` 
                    },
                    { 
                        role: 'user', 
                        content: prompt 
                    }
                ]
            })
        });

        if (!response.ok) {
             const errData = await response.text();
             throw new Error(`OpenAI error: ${errData}`);
        }
        
        const openAiData = await response.json();
        let content = openAiData.choices[0].message?.content;

        if (!content) {
            throw new Error('No content returned from OpenAI')
        }

        // Extremely robust JSON extraction: find the first { and the last }
        const firstBrace = content.indexOf('{');
        const lastBrace = content.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            content = content.substring(firstBrace, lastBrace + 1);
        }

        let reportJSON;
        try {
            reportJSON = JSON.parse(content);
        } catch (e) {
            console.error('JSON Parse Error. Content snippet:', content.substring(0, 100));
            throw new Error(`Failed to parse AI response as JSON. Content starts with: ${content.substring(0, 30)}`);
        }

        // 6. Save to DB using Service Role Key
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
            }, { onConflict: 'user_id,month_year' })

        if (insertError) {
            console.error('Error saving report to DB:', insertError);
            // We still return the report even if saving fails, to avoid 500
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
