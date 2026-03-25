import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS Headers for options requests from the browser/app
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Removed global supabase client, it will be instantiated per request with the auth header.

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;

    // 1. Create a client using the ANON key but supplying the user's Authorization header
    // so that RLS policies succeed. 
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // 2. Parse request JSON
    const { user_id, image_base64, language = 'en' } = await req.json();
    
    // Quick validation
    if (!user_id || !image_base64) {
      return new Response(JSON.stringify({ error: 'Missing user_id or image data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch the profile (this works now because the supabase client has the user's Auth header)
    // If the user tries to fetch someone else's profile, RLS will return 0 rows and this will throw.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error("Profile fetch error", profileError);
      throw new Error(`Profile not found or unauthorized for user ${user_id}`);
    }

    // Lazy credit check for non-premium users
    if (!profile.is_premium) {
      const now = new Date();
      if ((now.getTime() - new Date(profile.last_reset_date).getTime()) / (1000 * 60 * 60 * 24) >= 7) {
        await supabase
          .from('profiles')
          .update({ weekly_credits: 5, last_reset_date: now.toISOString() })
          .eq('id', user_id);
        
        profile.weekly_credits = 5;
      }

      const totalCredits = (profile.weekly_credits || 0) + (profile.purchased_credits || 0);
      if (totalCredits <= 0) {
        return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // OpenAI call - using a more robust prompt for consistent JSON output
    let moodResult;
    try {
      const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.7, // Slightly lower temperature for better consistency
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are a professional pet mood analyzer with a witty personality. 
              Output MUST be a single, valid JSON object. 
              Language for 'mood_title' and 'explanation': ${language}.
              
              Required keys: is_pet (bool), mood_title (string), confidence (float 0-1), explanation (string), chaos_score (int 0-100), energy_level (int 0-100), sweetness_score (int 0-100), judgment_level (int 0-100), cuddle_o_meter (int 0-100), derp_factor (int 0-100).
              
              If no pet is found, set is_pet to false, playfully roast the user, and set all 6 numeric scores to 0.`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: "Analyze pet vive." },
                { type: 'image_url', image_url: { url: `data:image/webp;base64,${image_base64}` } }
              ]
            }
          ]
        })
      });

      const openAiData = await openAiResponse.json();
      
      if (!openAiResponse.ok) {
        throw new Error(`OpenAI Error: ${JSON.stringify(openAiData)}`);
      }

      // Robust parsing
      const rawContent = openAiData.choices[0].message.content.trim();
      moodResult = JSON.parse(rawContent);

    } catch (parseError) {
      console.error("Critical AI Response Error:", parseError);
      throw new Error("AI returned an invalid format. Please try again.");
    }

    // Atomic credit deduction — prevents race condition where 2 concurrent requests
    // both pass the credit check and double-deduct, causing negative credits.
    if (!profile.is_premium) {
      if (profile.weekly_credits > 0) {
        // Atomic: decrement only if weekly_credits > 0
        const { data: updated, error: deductErr } = await supabase
          .from('profiles')
          .update({ weekly_credits: profile.weekly_credits - 1 })
          .eq('id', user_id)
          .gt('weekly_credits', 0)
          .select('weekly_credits')
          .maybeSingle();

        if (!updated && !deductErr) {
          // Race: another request already consumed this credit. Try purchased.
          const { data: updated2, error: deductErr2 } = await supabase
            .from('profiles')
            .update({ purchased_credits: profile.purchased_credits - 1 })
            .eq('id', user_id)
            .gt('purchased_credits', 0)
            .select('purchased_credits')
            .maybeSingle();

          if (!updated2 && !deductErr2) {
            return new Response(JSON.stringify({ error: 'Insufficient credits (race)' }), {
              status: 402,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } else {
        // Atomic: decrement purchased_credits only if > 0
        const { data: updated, error: deductErr } = await supabase
          .from('profiles')
          .update({ purchased_credits: profile.purchased_credits - 1 })
          .eq('id', user_id)
          .gt('purchased_credits', 0)
          .select('purchased_credits')
          .maybeSingle();

        if (!updated && !deductErr) {
          return new Response(JSON.stringify({ error: 'Insufficient credits (race)' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    }

    // Save scan to database
    const { error: insertError } = await supabase.from('scans').insert([{
      user_id,
      mood_title: moodResult.mood_title || 'Unknown Vibe',
      confidence: moodResult.confidence ?? 1.0,  // It might be omitted by AI for inanimate objects
      chaos_score: moodResult.chaos_score ?? 0,
      energy_level: moodResult.energy_level ?? 0,
      sweetness_score: moodResult.sweetness_score ?? 0,
      judgment_level: moodResult.judgment_level ?? 0,
      cuddle_o_meter: moodResult.cuddle_o_meter ?? 0,
      derp_factor: moodResult.derp_factor ?? 0
    }]);

    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      throw new Error('Failed to save scan results');
    }

    // Return the result to the client
    return new Response(JSON.stringify(moodResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
