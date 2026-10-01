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

    // AI Analysis call - Exclusively powered by Google Gemini (Gemini Flash Multimodal)
    let moodResult;
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment secret is not configured in Supabase.');
    }

    const currentDayName = new Date().toLocaleDateString('tr-TR', { weekday: 'long' });
    const currentDateStr = new Date().toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `IMPORTANT: YOU MUST RESPOND EXCLUSIVELY IN THIS LANGUAGE: ${language}.

CURRENT TEMPORAL CONTEXT:
Today is: ${currentDayName}, ${currentDateStr}.
CRITICAL RULE: DO NOT use cheap, lazy day-of-the-week internet clichés (such as "Pazartesi Sendromu" or "Cuma Yorgunluğu") unless today is literally that day and the visual evidence unmistakably justifies it. Focus 100% on the genuine, unique physical and behavioral evidence visible in the image!

You are a world-renowned Animal Ethologist, Pet Behaviorist, and Psychobiologist with an astute, sharp observational style.

Analyze the image according to one of the two modes below:

══════════════════════════════════════════════════════════════════
### MODE A: ANIMAL DETECTED (Any Animal Species)
══════════════════════════════════════════════════════════════════
- Subjects: Cats, dogs, farm animals (cows, calves, sheep, goats, horses, donkeys, pigs, chickens, ducks), reptiles & amphibians (turtles, tortoises, lizards, iguanas, chameleons, geckos, snakes, frogs), birds (parrots, budgies, cockatiels, canaries), aquatic pets (aquarium fish, betta, goldfish), rodents & small mammals (hamsters, guinea pigs, rabbits, ferrets), or wild animals.
- Tone: Professional, deeply observant, and empathetic behavioral psychologist, seasoned with a subtle, smart, smile-inducing touch of wit. Avoid slapstick or over-the-top silliness; keep the humor intelligent and grounded in real animal ethology.
- Ethological Focus: Posture, muscle tension, ear rotation/angle, eye contact/gaze (slow blink, side-eye, pupil state), rumination/chewing rhythm, breathing, feather fluffing, scale position, basking stillness, tail/fin dynamics.
- Mood Title: A clever, professional behavioral synthesis in ${language} (e.g. for a cow: "Zen Meditasyonu ve Sessiz Meracılık Kibri", for an iguana: "Prehistorik Güneşlenme Diplomasisi", for a cat: "Aristokratik Teftiş ve %15 Açlık").
- Explanation: 2-3 sentences of sharp behavioral breakdown in ${language}. Combine accurate biological insight with a charming, subtle witty observation.
- is_pet: true
- pet_type: 'cat' | 'dog' | 'farm_animal' | 'reptile' | 'bird' | 'fish' | 'rodent' | 'other'
- estimated_breed: Accurate breed or species in ${language} (e.g. "Holstein İneği", "Kırmızı Yanaklı Su Kaplumbağası", "Yeşil İguana", "Suriye Hamsterı", "Golden Retriever", "Betta Balığı", "Sultan Papağanı").
- breed_size: 'small' | 'medium' | 'large'
- life_stage: 'puppy' | 'adult' | 'senior' (use 'puppy' for baby/young animals of any species).
- detected_colors: Dominant visual colors as an array of lowercase strings (e.g. ["black", "white"]).
- Scores (0-100): Calibrate realistically according to observed body language.

══════════════════════════════════════════════════════════════════
### MODE B: NON-ANIMAL OBJECT / SCENE / HUMAN DETECTED
══════════════════════════════════════════════════════════════════
- Subjects: Inanimate objects, coffee cups, cars, shoes, tech gadgets, food, furniture, empty spaces, human selfies, etc.
- Goal: DO NOT return an error or reject the scan! Perform an amusing, high-humor "Mock Vibe Analysis" treating the object or person as an honorary companion or mysterious specimen.
- Tone: NOTICEABLY HIGHER HUMOR & WIT, playful roast, satire, mock-scientific classification. Look at the ACTUAL texture, remaining level, foam, cracks, posture.
- Mood Title: A hilarious, creative title in ${language} grounded in what is physically seen (e.g. for a half-drunk espresso: "Kritik Seviyede Azalmış Kafein Rezervi ve Masadaki Sessiz Direniş", for a shoe: "42 Numara Çamur Gazisi ve Yol Yorgunu", for a human: "Son E-postasını Bekleyen Ofis Primatı").
- Explanation: 2-3 sentences of funny, witty mock-behavioral breakdown in ${language} describing its physical state, posture, and "vibe".
- is_pet: false
- pet_type: 'other'
- estimated_breed: Creative mock-species name in ${language} (e.g. "Porselen Kafein Reaktörü", "Deri Yol Kaşifi", "Ergonomik Masa Primatı").
- breed_size: 'small' | 'medium' | 'large' (fitting the object).
- life_stage: 'puppy' | 'adult' | 'senior' (e.g. brand new = 'puppy', worn/vintage = 'senior').
- detected_colors: Dominant visual colors (e.g. ["brown", "white"]).
- Scores (0-100): DO NOT return 0! Assign fun, fitting scores based on the object's vibe (e.g. espresso: energy 95, chaos 40, sweetness 20, judgment 80, cuddle 10, derp 25).

══════════════════════════════════════════════════════════════════
Required JSON keys in output:
is_pet (boolean),
pet_type ('cat'|'dog'|'farm_animal'|'reptile'|'bird'|'fish'|'rodent'|'other'),
breed_size ('small'|'medium'|'large'),
life_stage ('puppy'|'adult'|'senior'),
estimated_breed (string),
detected_colors (array of strings),
mood_title (string),
confidence (float 0-1),
explanation (string),
chaos_score (int 0-100),
energy_level (int 0-100),
sweetness_score (int 0-100),
judgment_level (int 0-100),
cuddle_o_meter (int 0-100),
derp_factor (int 0-100).`;

    try {
      console.log('[analyze-pet-vibe] Using Google Gemini Multimodal Engine');
      const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;
      
      const geminiRes = await fetch(geminiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: systemPrompt },
                { text: "Analyze the subject's vibe and behavioral mood in the provided image." },
                {
                  inline_data: {
                    mime_type: 'image/webp',
                    data: image_base64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.7
          }
        })
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        console.error('[analyze-pet-vibe] Gemini API error:', errText);
        throw new Error(`Gemini Error: ${errText}`);
      }

      const geminiData = await geminiRes.json();
      let rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const firstBrace = rawContent.indexOf('{');
      const lastBrace = rawContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1) {
        rawContent = rawContent.substring(firstBrace, lastBrace + 1);
      }
      moodResult = JSON.parse(rawContent);

      // 4. Fetch Smart Product Recommendations (only for domestic cats & dogs)
      if (moodResult.is_pet && (moodResult.pet_type === 'cat' || moodResult.pet_type === 'dog')) {
        const petType = moodResult.pet_type.toLowerCase();
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
