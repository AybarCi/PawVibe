import { supabase } from './supabase';

export interface TargetHashtag {
  id: string;
  tag: string;
  is_active: boolean;
  created_at: string;
}

export interface CommentVariation {
  id: string;
  post_id?: string;
  comment_text: string;
  tone_label: 'Praise' | 'Curious' | 'Humorous' | string;
  created_at?: string;
}

export interface DiscoveredPost {
  id: string;
  instagram_post_id: string;
  post_url: string;
  thumbnail_url: string;
  author_username: string;
  caption: string;
  hashtag_source: string;
  status: 'PENDING' | 'POSTED' | 'SKIPPED';
  created_at: string;
  posted_at?: string | null;
  comment_variations: CommentVariation[];
}

// -------------------------------------------------------------
// Hashtag Management API
// -------------------------------------------------------------

export async function fetchTargetHashtags(): Promise<TargetHashtag[]> {
  const { data, error } = await supabase
    .from('target_hashtags')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching target hashtags:', error);
    return [
      { id: '1', tag: 'doglovers', is_active: true, created_at: new Date().toISOString() },
      { id: '2', tag: 'kedisahiplenme', is_active: true, created_at: new Date().toISOString() },
      { id: '3', tag: 'goldenretriever', is_active: true, created_at: new Date().toISOString() },
      { id: '4', tag: 'catlovers', is_active: true, created_at: new Date().toISOString() },
    ];
  }
  return data || [];
}

export async function addHashtag(tag: string): Promise<TargetHashtag | null> {
  const cleanTag = tag.trim().replace(/^#/, '').toLowerCase();
  if (!cleanTag) return null;

  const { data, error } = await supabase
    .from('target_hashtags')
    .insert({ tag: cleanTag, is_active: true })
    .select()
    .single();

  if (error) {
    console.error('Error adding hashtag:', error);
    throw error;
  }
  return data;
}

export async function toggleHashtag(id: string, is_active: boolean): Promise<void> {
  const { error } = await supabase
    .from('target_hashtags')
    .update({ is_active })
    .eq('id', id);

  if (error) {
    console.error('Error toggling hashtag:', error);
    throw error;
  }
}

export async function deleteHashtag(id: string): Promise<void> {
  const { error } = await supabase
    .from('target_hashtags')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting hashtag:', error);
    throw error;
  }
}

// -------------------------------------------------------------
// Discovered Posts API
// -------------------------------------------------------------

export async function fetchDiscoveredPosts(
  statusFilter: string = 'ALL',
  hashtagFilter: string = 'ALL'
): Promise<DiscoveredPost[]> {
  let query = supabase
    .from('discovered_posts')
    .select(`
      *,
      comment_variations (
        id,
        post_id,
        comment_text,
        tone_label,
        created_at
      )
    `)
    .order('created_at', { ascending: false });

  if (statusFilter !== 'ALL') {
    query = query.eq('status', statusFilter);
  }

  if (hashtagFilter !== 'ALL') {
    query = query.eq('hashtag_source', hashtagFilter);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching discovered posts:', error);
    return [];
  }

  return (data || []) as DiscoveredPost[];
}

export async function fetchTodayCommentCount(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('discovered_posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'POSTED')
    .gte('posted_at', startOfDay.toISOString());

  if (error) {
    console.error('Error fetching today comment count:', error);
    return 0;
  }

  return count || 0;
}

export async function updatePostStatus(
  postId: string,
  status: 'POSTED' | 'SKIPPED' | 'PENDING'
): Promise<void> {
  const updateData: any = { status };
  if (status === 'POSTED') {
    updateData.posted_at = new Date().toISOString();
  } else if (status === 'PENDING') {
    updateData.posted_at = null;
  }

  const { error } = await supabase
    .from('discovered_posts')
    .update(updateData)
    .eq('id', postId);

  if (error) {
    console.error('Error updating post status:', error);
    throw error;
  }
}

// -------------------------------------------------------------
// Add Custom Instagram Post Link Directly
// -------------------------------------------------------------

export async function addCustomInstagramPost(
  postUrl: string,
  authorUsername: string,
  caption: string,
  hashtagSource: string = 'custom'
): Promise<DiscoveredPost | null> {
  const cleanUrl = postUrl.trim();
  if (!cleanUrl) return null;

  const cleanAuthor = authorUsername.trim().replace(/^@/, '') || 'instagram_user';
  const cleanCaption = caption.trim() || 'Awesome pet post!';
  const cleanTag = hashtagSource.trim().replace(/^#/, '') || 'custom';
  const uniqueIgPostId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Insert post into Supabase
  const { data: insertedPost, error: postErr } = await supabase
    .from('discovered_posts')
    .insert({
      instagram_post_id: uniqueIgPostId,
      post_url: cleanUrl,
      thumbnail_url: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&auto=format&fit=crop&q=80',
      author_username: cleanAuthor,
      caption: cleanCaption,
      hashtag_source: cleanTag,
      status: 'PENDING',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (postErr || !insertedPost) {
    console.error('Error adding custom post:', postErr);
    throw postErr;
  }

  // Generate 3 contextual comment variations matching exact post language
  const variations = generateAICommentVariations(cleanCaption, cleanAuthor);

  // Insert Comment Variations into Supabase
  const { data: insertedVariations, error: varErr } = await supabase
    .from('comment_variations')
    .insert(
      variations.map(v => ({
        post_id: insertedPost.id,
        comment_text: v.comment_text,
        tone_label: v.tone_label
      }))
    )
    .select();

  if (varErr) {
    console.error('Error inserting comment variations:', varErr);
  }

  return {
    ...insertedPost,
    comment_variations: insertedVariations || []
  };
}

// -------------------------------------------------------------
// Purge & Database Reset API
// -------------------------------------------------------------

export async function purgeAndResyncPosts(): Promise<{ newCount: number; message: string }> {
  try {
    // 1. Delete all comment variations
    await supabase.from('comment_variations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // 2. Delete all discovered posts
    await supabase.from('discovered_posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Re-run sync
    return await syncGrowthAssistantPosts(true);
  } catch (err: any) {
    console.error('Purge error:', err);
    throw err;
  }
}

// -------------------------------------------------------------
// Language Detection & AI Comment Variations Engine
// -------------------------------------------------------------

const SENSITIVE_KEYWORDS = [
  'kayıp', 'hasta', 'vefat', 'ölüm', 'vefat etti', 'kanser', 'kazada', 'kaza',
  'yardım', 'acil kan', 'kayboldu', 'bulunamadı', 'sad', 'rip', 'passed away',
  'sick', 'lost dog', 'lost cat', 'injured', 'trauma', 'emergency'
];

function isCaptionSensitive(caption: string): boolean {
  const lower = caption.toLowerCase();
  return SENSITIVE_KEYWORDS.some(kw => lower.includes(kw));
}

// Multi-language Detection Engine (Prevents Portuguese/Spanish words like 'de' or 'que' from triggering Turkish)
function detectLanguage(caption: string): 'tr' | 'pt' | 'es' | 'en' {
  // 1. Turkish check: Requires Turkish specific characters OR distinct Turkish pet terms
  const turkishChars = /[çğıöşüÇĞİÖŞÜ]/;
  const turkishWords = /\b(bir|çok|ile|için|gibi|patili|dostumuz|kedi|köpek|tatlı|harika|gün|sabah|mama|sevgisi|sahiplenme|evlat|mırıltı|barınak|yuva)\b/i;
  if (turkishChars.test(caption) || turkishWords.test(caption)) {
    return 'tr';
  }

  // 2. Portuguese check: Portuguese terms (muito, por, cada, filhote, fotos, além, com, para)
  const portugueseWords = /\b(muito|além|filhote|fotos|trás|cuidado|rotina|com|para|que|uma|nas|dos|das|esta)\b/i;
  if (portugueseWords.test(caption)) {
    return 'pt';
  }

  // 3. Spanish check: Spanish terms (mucho, todos, perros, gatos, amor, lindo, hermoso)
  const spanishWords = /\b(mucho|todos|perros|gatos|amor|bueno|lindo|hermoso|con|para)\b/i;
  if (spanishWords.test(caption)) {
    return 'es';
  }

  return 'en';
}

export function generateAICommentVariations(caption: string, username: string) {
  const lang = detectLanguage(caption);
  
  if (lang === 'tr') {
    return [
      {
        tone_label: 'Praise',
        comment_text: `@${username} harika bir paylaşım! 🐾 Enerjisi muhteşem. Tam @pawvibenow analizi yapmalık bir dost!`
      },
      {
        tone_label: 'Curious',
        comment_text: `Bu tatlılığın Vibe puanı kaç acaba? 😄 @pawvibenow ile karakter testini denediniz mi?`
      },
      {
        tone_label: 'Humorous',
        comment_text: `Şu bakışlardaki karizmaya bak! 😎 @pawvibenow yapay zekasına sorsak %99 patronluk çıkar!`
      }
    ];
  } else if (lang === 'pt') {
    return [
      {
        tone_label: 'Praise',
        comment_text: `Que fofura maravilhosa @${username}! 🐾 Energia incrível! Já testou a personalidade no @pawvibenow?`
      },
      {
        tone_label: 'Curious',
        comment_text: `Qual será a nota de Vibe dessa fofura? 😄 Já experimentou o teste de pet do @pawvibenow?`
      },
      {
        tone_label: 'Humorous',
        comment_text: `Olha essa pose de patrão! 😎 Na IA do @pawvibenow certeza que daria 99% chefão da casa!`
      }
    ];
  } else if (lang === 'es') {
    return [
      {
        tone_label: 'Praise',
        comment_text: `¡Qué hermosura @${username}! 🐾 ¡Tiene una energía increíble! ¿Ya probaron su personalidad en @pawvibenow?`
      },
      {
        tone_label: 'Curious',
        comment_text: `¿Cuál será el puntaje de Vibe de esta belleza? 😄 ¿Han probado el test de mascotas de @pawvibenow?`
      },
      {
        tone_label: 'Humorous',
        comment_text: `¡Mira esa pose de jefe! 😎 ¡En la IA de @pawvibenow seguro sale 99% el rey de la casa!`
      }
    ];
  } else {
    return [
      {
        tone_label: 'Praise',
        comment_text: `Absolutely adorable @${username}! 🐾 That vibe is infectious! Have you checked what @pawvibenow says about their pet personality?`
      },
      {
        tone_label: 'Curious',
        comment_text: `What a lovely furry buddy! Wonder what their Chaos vs Sweetness score is on @pawvibenow 🐶✨`
      },
      {
        tone_label: 'Humorous',
        comment_text: `100% running the household and they know it! 😎 Needs a full @pawvibenow vibe analysis asap!`
      }
    ];
  }
}

// -------------------------------------------------------------
// Live Apify Instagram Scraper Integration
// -------------------------------------------------------------

export function getApifyToken(): string {
  // 1. Check localStorage first
  const fromStorage = localStorage.getItem('APIFY_API_TOKEN') || localStorage.getItem('APIFY_TOKEN');
  if (fromStorage && fromStorage.trim()) return fromStorage.trim();

  // 2. Scan all import.meta.env properties for any key containing 'APIFY'
  const env = (import.meta.env || {}) as Record<string, any>;
  for (const key of Object.keys(env)) {
    if (key.toUpperCase().includes('APIFY')) {
      const val = env[key];
      if (typeof val === 'string' && val.trim()) {
        return val.trim();
      }
    }
  }

  // 3. Explicit fallback checks
  const explicit =
    env.VITE_APIFY_API_TOKEN ||
    env.APIFY_API_TOKEN ||
    env.VITE_APIFY_TOKEN ||
    env.APIFY_TOKEN ||
    env.VITE_APIFY_KEY ||
    env.APIFY_KEY;

  return (explicit as string || '').trim();
}

export function saveApifyToken(token: string): void {
  const clean = token.trim();
  if (clean) {
    localStorage.setItem('APIFY_API_TOKEN', clean);
  } else {
    localStorage.removeItem('APIFY_API_TOKEN');
  }
}

export async function fetchApifyInstagramPosts(tag: string): Promise<{ items: any[]; error?: string }> {
  const token = getApifyToken();
  if (!token) return { items: [], error: 'NO_TOKEN' };

  try {
    // 1. Try primary actor apify/instagram-hashtag-scraper
    let res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-hashtag-scraper/run-sync-get-dataset-items?token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hashtags: [tag],
        resultsType: 'top',      // Only fetch Top/Popular posts directly at Apify actor level
        resultsLimit: 5,         // Strictly limit to 5 top posts to minimize Apify API credit cost
        searchType: 'hashtag'
      })
    });

    // 2. Fallback to secondary actor apify/instagram-scraper if primary fails
    if (!res.ok) {
      const primaryErr = await res.text();
      console.warn(`[Apify] Primary actor failed (${res.status}): ${primaryErr}`);

      res = await fetch(`https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: tag,
          searchType: 'hashtag',
          resultsLimit: 5
        })
      });
    }

    if (!res.ok) {
      const finalErr = await res.text();
      console.error(`[Apify] All actors failed (${res.status}):`, finalErr);
      return { items: [], error: `Apify API Error (${res.status}): ${finalErr.slice(0, 100)}` };
    }

    const items = await res.json();
    if (!Array.isArray(items) || items.length === 0) {
      return { items: [], error: 'Apify returned 0 posts for this hashtag.' };
    }

    const validItems: any[] = [];

    for (const item of items) {
      // 1. Extract Real Direct Post Link (must contain /p/<shortcode>/)
      let postUrl = '';
      let code = item.shortCode || item.shortcode || item.short_code || item.code || '';

      if (typeof item.url === 'string' && item.url.includes('/p/')) {
        postUrl = item.url;
        if (!code) {
          const match = item.url.match(/\/p\/([^/]+)/);
          if (match) code = match[1];
        }
      } else if (code && typeof code === 'string' && code.length >= 5) {
        postUrl = `https://www.instagram.com/p/${code}/`;
      }

      // STRICT RULE: If no valid post URL could be determined, discard this item immediately
      if (!postUrl || !postUrl.includes('/p/')) {
        continue;
      }

      // 2. Extract Author Username
      const author = item.ownerUsername || item.owner?.username || item.username || item.owner_username || '';
      if (!author || author === 'instagram_user') {
        continue;
      }

      validItems.push({
        author,
        caption: item.caption || item.firstComment || item.text || `Post about #${tag}`,
        thumbnail: item.displayUrl || item.imageUrl || item.thumbnailUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600',
        hashtag: tag,
        postUrl,
        code,
        likesCount: item.likesCount ?? item.likes_count ?? 0
      });
    }

    if (validItems.length === 0) {
      return { items: [], error: 'Apify returned 0 valid post links for this hashtag.' };
    }

    const sortedItems = validItems.sort((a, b) => b.likesCount - a.likesCount);

    return { items: sortedItems.slice(0, 10) };
  } catch (err: any) {
    console.error('[Apify] Fetch exception:', err);
    return { items: [], error: err.message || 'FETCH_EXCEPTION' };
  }
}

// -------------------------------------------------------------
// Sync Growth Assistant Engine
// -------------------------------------------------------------

export async function syncGrowthAssistantPosts(forceReset = false): Promise<{ newCount: number; message: string }> {
  const hashtags = await fetchTargetHashtags();
  const activeTags = hashtags.filter(h => h.is_active).map(h => h.tag.toLowerCase());

  if (activeTags.length === 0) {
    return { newCount: 0, message: 'No active target hashtags configured.' };
  }

  const token = getApifyToken();
  const isApifyActive = !!token;
  let usedApify = false;
  let apifyError: string | null = null;
  let newPostsCount = 0;

  for (const tag of activeTags) {
    let matchingPosts: any[] = [];

    // Only real-time Apify API. NO FAKE SEED POOL!
    if (isApifyActive) {
      const apifyResult = await fetchApifyInstagramPosts(tag);
      if (apifyResult.items.length > 0) {
        matchingPosts = apifyResult.items;
        usedApify = true;
      } else if (apifyResult.error) {
        apifyError = apifyResult.error;
      }
    } else {
      apifyError = 'Apify API Token missing in environment';
    }

    for (const rawPost of matchingPosts) {
      if (isCaptionSensitive(rawPost.caption)) continue;

      const uniqueIgPostId = rawPost.code
        ? `ig_${rawPost.code}`
        : `${rawPost.author}_${rawPost.hashtag}_${Math.random().toString(36).slice(2, 7)}`;

      if (!forceReset) {
        const { data: existing } = await supabase
          .from('discovered_posts')
          .select('id')
          .eq('instagram_post_id', uniqueIgPostId)
          .maybeSingle();

        if (existing) continue;
      }

      // Exact live working link (Post URL or Profile)
      const postUrl = rawPost.postUrl;

      // Insert Discovered Post into Supabase
      const { data: insertedPost, error: postErr } = await supabase
        .from('discovered_posts')
        .insert({
          instagram_post_id: uniqueIgPostId,
          post_url: postUrl,
          thumbnail_url: rawPost.thumbnail,
          author_username: rawPost.author,
          caption: rawPost.caption,
          hashtag_source: tag,
          status: 'PENDING',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (postErr || !insertedPost) {
        console.error('Error inserting discovered post:', postErr);
        continue;
      }

      // Generate 3 contextual comment variations matching exact post language
      const variations = generateAICommentVariations(rawPost.caption, rawPost.author);

      // Insert Comment Variations into Supabase
      const { error: varErr } = await supabase
        .from('comment_variations')
        .insert(
          variations.map(v => ({
            post_id: insertedPost.id,
            comment_text: v.comment_text,
            tone_label: v.tone_label
          }))
        );

      if (varErr) {
        console.error('Error inserting comment variations:', varErr);
      } else {
        newPostsCount++;
      }
    }
  }

  const apifyStatusText = usedApify
    ? '(via Apify Live Scraper)'
    : apifyError
    ? `(Apify Error: ${apifyError})`
    : '(Apify API Token missing)';

  return {
    newCount: newPostsCount,
    message: newPostsCount > 0 
      ? `Successfully discovered and generated comments for ${newPostsCount} new Instagram posts! ${apifyStatusText}`
      : `All available posts for active target hashtags processed. ${apifyStatusText}`
  };
}
