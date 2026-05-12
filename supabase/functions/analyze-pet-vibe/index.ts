import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// CORS Headers for options requests from the browser/app
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Removed global supabase client, it will be instantiated per request with the auth header.

serve(async (req: Request) => {
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
          .update({ weekly_credits: 2, last_reset_date: now.toISOString() })
          .eq('id', user_id);
        
        profile.weekly_credits = 2;
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
              content: `IMPORTANT: YOU MUST RESPOND EXCLUSIVELY IN THIS LANGUAGE: ${language}.

              You are an expert Pet Behaviorist and Psychologist. Your task is to provide a highly accurate, insightful, and professional behavioral assessment of the pet in the image. 

              - Tone: Observant, expert, and empathetic. Avoid overly casual jokes. 
              - Analysis focus: Posture, facial expressions, ear position, and gaze.
              - Mood Title: Should sound like a professional behavioral summary in ${language}.
              - Explanation: Provide a brief but deep behavioral insight in ${language} based on what you see in the photo.
              - Output: MUST be a single, valid JSON object. 
              
              Required JSON keys: 
              is_pet (bool), 
              pet_type (string: 'cat'|'dog'|'other'), 
              breed_size (string: 'small'|'medium'|'large'),
              life_stage (string: 'puppy'|'adult'|'senior'),
               estimated_breed (string, if not sure use "Mixed / Unique"),
              detected_colors (array of strings),
              mood_title (string), 
              confidence (float 0-1), 
              explanation (string), 
              chaos_score (int 0-100), 
              energy_level (int 0-100), 
              sweetness_score (int 0-100), 
              judgment_level (int 0-100), 
              cuddle_o_meter (int 0-100), 
              derp_factor (int 0-100).
              
              If no pet is found:
              Set is_pet to false, pet_type to 'other', breed_size to 'medium', life_stage to 'adult', estimated_breed to 'none', detected_colors to [], and provide a professional explanation in ${language} that no clear animal subject was identified for assessment. All numeric scores must be 0.`
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: "Perform a professional behavioral analysis on this pet." },
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

      // 4. Fetch Smart Product Recommendations
      if (moodResult.is_pet) {
        const petType = (moodResult.pet_type || 'both').toLowerCase();
        const size = moodResult.breed_size || 'medium';
        const stage = moodResult.life_stage || 'adult';
        
        // Smarter query: matches specific type/size/stage OR 'both'/'all' fallbacks
        const { data: recs, error: recsError } = await supabase
          .from('recommendations')
          .select('id, name, description, image_url, affiliate_url')
          .eq('is_active', true)
          .or(`pet_type.eq.${petType},pet_type.eq.both`)
          .or(`target_size.eq.${size},target_size.eq.all`)
          .or(`target_stage.eq.${stage},target_stage.eq.all`)
          .limit(3);
        
        if (recsError) console.error("Recommendations Fetch Error:", recsError);
        moodResult.recommendations = recs || [];
      } else {
        moodResult.recommendations = [];
      }

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
    const { data: scanData, error: insertError } = await supabase.from('scans').insert([{
      user_id,
      mood_title: moodResult.mood_title || 'Unknown Vibe',
      confidence: moodResult.confidence ?? 1.0,
      is_pet: moodResult.is_pet ?? true,
      explanation: moodResult.explanation || null,
      chaos_score: moodResult.chaos_score ?? 0,
      energy_level: moodResult.energy_level ?? 0,
      sweetness_score: moodResult.sweetness_score ?? 0,
      judgment_level: moodResult.judgment_level ?? 0,
      cuddle_o_meter: moodResult.cuddle_o_meter ?? 0,
      derp_factor: moodResult.derp_factor ?? 0,
      breed_size: moodResult.breed_size,
      life_stage: moodResult.life_stage,
      estimated_breed: moodResult.estimated_breed,
      detected_colors: moodResult.detected_colors
    }]).select('id').single();

    if (insertError) {
      console.error("Supabase Insert Error:", insertError);
      throw new Error('Failed to save scan results');
    }

    // Return the result to the client
    return new Response(JSON.stringify({ ...moodResult, id: scanData?.id }), {
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
