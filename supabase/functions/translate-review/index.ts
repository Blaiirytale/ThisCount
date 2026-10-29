// Supabase Edge Function: translates one review with DeepL and saves the result.
// The DeepL key stays on the server (set it as the secret DEEPL_API_KEY).
//
// Request:  POST { "reviewId": 12, "target": "en" | "zh" }
// Response: { "text": "...", "sourceLang": "ZH", "cached": true }

import { createClient } from 'npm:@supabase/supabase-js@2';

const DEEPL_URL = 'https://api-free.deepl.com/v2/translate';

// DeepL language codes
const TARGETS: Record<string, string> = {
  en: 'EN-US',
  zh: 'ZH-HANT', // Traditional Chinese (Taiwan)
};

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);

  // 1. Check the input
  let reviewId: number;
  let target: string;
  try {
    const body = await req.json();
    reviewId = Number(body.reviewId);
    target = String(body.target);
  } catch {
    return reply({ error: 'bad_request' }, 400);
  }
  if (!Number.isInteger(reviewId) || reviewId <= 0 || !(target in TARGETS)) {
    return reply({ error: 'bad_request' }, 400);
  }

  // Server-side database access (these two values are provided by Supabase automatically)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 2. Already translated? Return the saved one (no DeepL usage)
  const saved = await db
    .from('review_translations')
    .select('translated_text, source_lang')
    .eq('review_id', reviewId)
    .eq('target_lang', target)
    .maybeSingle();
  if (saved.data) {
    return reply({ text: saved.data.translated_text, sourceLang: saved.data.source_lang, cached: true });
  }

  // 3. Only translate reviews that exist and are visible
  const review = await db.from('reviews').select('body, status').eq('id', reviewId).maybeSingle();
  if (!review.data || review.data.status !== 'visible' || !review.data.body) {
    return reply({ error: 'not_found' }, 404);
  }

  // 4. Ask DeepL
  const key = Deno.env.get('DEEPL_API_KEY');
  if (!key) return reply({ error: 'not_configured' }, 500);

  const deepl = await fetch(DEEPL_URL, {
    method: 'POST',
    headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: [review.data.body], target_lang: TARGETS[target] }),
  });
  if (deepl.status === 456) return reply({ error: 'quota_exceeded' }, 429); // monthly free limit used up
  if (!deepl.ok) {
    console.error('DeepL error', deepl.status, await deepl.text());
    return reply({ error: 'translate_failed' }, 502);
  }
  const result = await deepl.json();
  const text: string = result.translations?.[0]?.text ?? '';
  const sourceLang: string = result.translations?.[0]?.detected_source_language ?? '';

  // 5. Save it for next time
  await db
    .from('review_translations')
    .upsert({ review_id: reviewId, target_lang: target, translated_text: text, source_lang: sourceLang });

  return reply({ text, sourceLang, cached: false });
});
