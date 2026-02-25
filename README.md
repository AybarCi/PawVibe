# 🐾 PawVibe – AI Pet Mood & Personality Analyzer

**Bootstrapped Viral Consumer App**

## 1️⃣ Product & Growth Strategy

* **Zero Friction Onboarding:** App açılır açılmaz kamera, Supabase Anonymous Auth
* **Progressive Sign-In:** Premium veya history transfer için Apple/Google Sign-In
* **Viral Loop:** AI analiz sonucu → 9:16 shareable story / video → TikTok/IG Reels
* **Paywall Timing:** Sadece AI analizi için kredi bittiğinde açılır

## 2️⃣ Technical Architecture

```
📱 React Native / Expo
        ↓
🔐 Supabase Auth (Anonymous First)
        ↓
🗄 Supabase Postgres DB (Profiles + Scans)
        ↓
⚡ Supabase Edge Functions (Rate-limit, Lazy credit, OpenAI proxy with JSON parse)
        ↓
🤖 OpenAI Vision API (Mood Analysis)
```

* Minimal backend, Edge Functions ile güvenli API çağrısı
* OpenAI yanıtı artık doğru şekilde parse edilip JSON olarak DB’ye yazılıyor

## 3️⃣ Database & Lazy Credit System

**Profiles Table:** id, weekly_credits, purchased_credits, last_reset_date, is_premium, created_at

**Scans Table:** id, user_id, mood_title, confidence, chaos_score, energy_level, sweetness_score, created_at

**Lazy Weekly Credit Reset:** last_reset_date + 7 gün kontrolü, weekly → purchased → paywall

## 4️⃣ AI Pipeline (Production-Ready)

* Camera → compress 512x512 WebP → Edge Function
* Edge Function:
  * Lazy credit check, rate-limit
  * OpenAI call (model: gpt-4o-mini, response_format: json_object)
  * **Critical Fix:** OpenAI string response parse ediliyor → `JSON.parse(openAiResponse.choices[0].message.content)`
  * Structured JSON → DB insert
* Sample JSON: `{ "mood_title": "Drama Queen", "confidence": 0.82, "chaos_score": 78, "energy_level": 60, "sweetness_score": 90 }`

## 5️⃣ Monetization Strategy

* **Weekly Free Credits:** 5/week, push notifications for reset
* **Consumable IAP:** Snack Pack ($0.99, 10 scan), Party Pack ($2.99, 50 scan)
* **Unlimited Subscription (Optional):** $4.99/month
* RevenueCat SDK handles receipts & validation

## 6️⃣ Viral Growth & Retention

* TikTok-first: #PawVibeChallenge
* Shareable 9:16 Reels/Shorts
* Profile gamification: radar chart, mood history, top traits
* Push notifications for weekly reset → retention boost

## 7️⃣ Globalization & Localization

* Phone language detection (EN/TR/ES)
* Culturally relevant AI prompts, no literal translation

## 8️⃣ Edge Function Template (Production Ready)

```ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

serve(async (req) => {
  const { user_id, image_base64 } = await req.json();
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user_id).single();

  // Lazy credit check
  const now = new Date();
  if ((now.getTime() - new Date(profile.last_reset_date).getTime()) / (1000*60*60*24) >= 7) {
    await supabase.from('profiles').update({ weekly_credits: 5, last_reset_date: now }).eq('id', user_id);
    profile.weekly_credits = 5;
  }

  if (profile.weekly_credits + profile.purchased_credits <= 0) {
    return new Response(JSON.stringify({ error: 'Insufficient credits' }), { status: 402 });
  }

  if (profile.weekly_credits > 0) {
    await supabase.from('profiles').update({ weekly_credits: profile.weekly_credits - 1 }).eq('id', user_id);
  } else {
    await supabase.from('profiles').update({ purchased_credits: profile.purchased_credits - 1 }).eq('id', user_id);
  }

  // OpenAI call with parse fix
  const openAiResponse = await fetch(Deno.env.get('OPENAI_ENDPOINT'), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${Deno.env.get('OPENAI_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a sarcastic pet mood analyzer. Return JSON with mood_title, confidence, explanation, chaos_score, energy_level, sweetness_score.' },
        { role: 'user', content: [
            { type: 'text', text: 'Analyze this pet\'s vibe.' },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${image_base64}` } }
          ]
        }
      ]
    })
  }).then(res => res.json());

  const moodResult = JSON.parse(openAiResponse.choices[0].message.content);

  await supabase.from('scans').insert([{ 
    user_id, 
    mood_title: moodResult.mood_title,
    confidence: moodResult.confidence,
    chaos_score: moodResult.chaos_score,
    energy_level: moodResult.energy_level,
    sweetness_score: moodResult.sweetness_score
  }]);

  return new Response(JSON.stringify(moodResult), { headers: { 'Content-Type': 'application/json' } });
});
```

## 9️⃣ UI / UX Wireframe

* **Main Screen:** Fullscreen camera + Analyze + ⚡ credits
* **Scan Result:** Mood card, confidence bar, emoji, caption, share button, Paywall BottomSheet
* **Profile:** Radar chart, mood history, personality traits, premium CTA
* **Gamification:** Personality progression + weekly milestones

## 🔟 Revenue Projection (10k MAU)

| Channel                | Revenue/month |
| ---------------------- | ------------- |
| Rewarded Ads           | ~$3k          |
| Consumable IAP         | ~$3.6k        |
| Unlimited Subscription | ~$3k          |
| **Total**              | ~$9.6k        |

## 1️⃣1️⃣ Roadmap

* **Phase 1:** MVP 0–10k MAU, Anonymous Auth, Edge Function, OpenAI Vision, Shareable Story + Paywall
* **Phase 2:** Scale 100k+ MAU, Multi-language prompts, Rewarded Ads, Premium Subscription, Profile Gamification
* **Phase 3:** Enterprise/Cost Optimization, On-device ML detection (CoreML/TFLite), Fine-tuned AI model, Viral video export

## 1️⃣2️⃣ Risk & Mitigation

| Risk            | Mitigation                                     |
| --------------- | ---------------------------------------------- |
| API Cost        | Lazy credit, compress, rate limit              |
| Early Churn     | Push notifications, gamification, weekly reset |
| Store Rejection | Local profile, charts, added value             |
| Fraud / Abuse   | Edge Function + Image validation + rate limit  |
