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

    // Lazy credit check
    const now = new Date();
    if ((now.getTime() - new Date(profile.last_reset_date).getTime()) / (1000 * 60 * 60 * 24) >= 7) {
      await supabase
        .from('profiles')
        .update({ weekly_credits: 5, last_reset_date: now.toISOString() })
        .eq('id', user_id);
      
      profile.weekly_credits = 5;
    }

    if (profile.weekly_credits + profile.purchased_credits <= 0) {
      return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deduct credit
    if (profile.weekly_credits > 0) {
      await supabase
        .from('profiles')
        .update({ weekly_credits: profile.weekly_credits - 1 })
        .eq('id', user_id);
    } else {
      await supabase
        .from('profiles')
        .update({ purchased_credits: profile.purchased_credits - 1 })
        .eq('id', user_id);
    }

    // OpenAI call
    const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.9,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an incredibly dramatic, overly empathetic, witty, and hilariously sarcastic pet whisperer and mood analyzer. Your goal is to make the user laugh out loud while perfectly capturing the "vibe" of the photo. Let your personality shine, use emojis playfully, and be extremely sympathetic yet funny. 
            
First, check if there is a pet (like a dog, cat, bird, reptile, etc.) in the image. Return ONLY a valid JSON object with the following keys and accurate types: is_pet (boolean), mood_title (string), confidence (number between 0 and 1), explanation (string), chaos_score (integer 0-100), energy_level (integer 0-100), sweetness_score (integer 0-100), judgment_level (integer 0-100), cuddle_o_meter (integer 0-100), derp_factor (integer 0-100). 
            
If there are NO pets in the image (e.g., it's a picture of sunglasses, a mug, or a landscape), set is_pet to false, and playfully roast the user in the 'mood_title' and 'explanation' for trying to trick you into analyzing an inanimate object's soul. Set all 6 score values to 0. The values for 'mood_title' and 'explanation' MUST be written in this ISO language code: ${language}.`
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: "Analyze this pet's vibe." },
              { type: 'image_url', image_url: { url: `data:image/webp;base64,${image_base64}` } }
            ]
          }
        ]
      })
    });

    const openAiData = await openAiResponse.json();
    
    if (!openAiResponse.ok) {
      console.error("OpenAI Error:", openAiData);
      throw new Error('Failed to resolve mood from OpenAI');
    }

    // Parse the JSON string from OpenAI
    const moodResult = JSON.parse(openAiData.choices[0].message.content);

    // Deduct credit
    if (profile.weekly_credits > 0) {
      await supabase
        .from('profiles')
        .update({ weekly_credits: profile.weekly_credits - 1 })
        .eq('id', user_id);
    } else {
      await supabase
        .from('profiles')
        .update({ purchased_credits: profile.purchased_credits - 1 })
        .eq('id', user_id);
    }

    // Save scan to database
    const { error: insertError } = await supabase.from('scans').insert([{
      user_id,
      mood_title: moodResult.mood_title,
      confidence: moodResult.confidence,
      chaos_score: moodResult.chaos_score,
      energy_level: moodResult.energy_level,
      sweetness_score: moodResult.sweetness_score,
      judgment_level: moodResult.judgment_level,
      cuddle_o_meter: moodResult.cuddle_o_meter,
      derp_factor: moodResult.derp_factor
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
