import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 8787;

const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// ---------------------------------------------------------------------------
// Simple in-memory cache: normalized text -> { keywords, media, ts }
// Swap for Redis in production (see README).
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes

function normalize(text) {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCached(key, value) {
  cache.set(key, { value, ts: Date.now() });
}

// ---------------------------------------------------------------------------
// Step 1: extract visual search keywords from the current text using Claude
// ---------------------------------------------------------------------------
const KEYWORD_SYSTEM_PROMPT = `You extract visual search concepts from prose so an app can fetch matching stock photos and videos.

Prioritize, in order: location, people, key objects, action, atmosphere/mood.

Return ONLY minified JSON, no markdown fences, no commentary, matching exactly this shape:
{"main_subject":"","environment":"","objects":[],"mood":"","search":""}

Rules:
- "search" is ONE stock-photo-style query, maximum 8 words, concrete and visual (not abstract).
- If the sentence has no clear visual content (e.g. pure dialogue, internal thought), infer the most likely visual scene from context, or return an empty "search" string.
- Use the previous paragraph only to resolve pronouns/context (e.g. who "he" refers to) — do not describe it directly.`;

function fallbackKeywords(text) {
  const cleaned = (text || '').replace(/[^\w\s]/gi, ' ').trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  const searchQuery = words.slice(0, 6).join(' ');
  return {
    main_subject: words[0] || '',
    environment: '',
    objects: [],
    mood: '',
    search: searchQuery || text.slice(0, 60).trim(),
  };
}

async function extractKeywords(currentText, previousText) {
  if (!anthropic) {
    return fallbackKeywords(currentText);
  }

  const userPrompt = previousText
    ? `Previous paragraph (context only):\n"""${previousText}"""\n\nCurrent paragraph (extract from this one):\n"""${currentText}"""`
    : `Current paragraph:\n"""${currentText}"""`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      system: KEYWORD_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content.find((b) => b.type === 'text')?.text?.trim() || '{}';
    const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.search) {
      parsed.search = fallbackKeywords(currentText).search;
    }
    return parsed;
  } catch (err) {
    console.warn('Anthropic API error, using fallback keyword extraction:', err.message || err);
    return fallbackKeywords(currentText);
  }
}

// ---------------------------------------------------------------------------
// Step 2: search media providers in parallel, merge + normalize results
// ---------------------------------------------------------------------------
async function searchPexels(query) {
  const apiKey = (process.env.PEXELS_API_KEY || '').trim();
  if (!apiKey || !query) return { images: [], videos: [] };

  const headers = { Authorization: apiKey };
  const [imgRes, vidRes] = await Promise.all([
    fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=6`, { headers }),
    fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=3`, { headers }),
  ]);

  const [imgJson, vidJson] = await Promise.all([
    imgRes.ok ? imgRes.json() : { photos: [] },
    vidRes.ok ? vidRes.json() : { videos: [] },
  ]);

  return {
    images: (imgJson.photos || []).map((p) => ({
      id: `pexels-img-${p.id}`,
      provider: 'pexels',
      type: 'image',
      thumb: p.src.medium,
      full: p.src.large2x || p.src.large,
      alt: p.alt || query,
      pageUrl: p.url,
      credit: p.photographer,
    })),
    videos: (vidJson.videos || []).map((v) => ({
      id: `pexels-vid-${v.id}`,
      provider: 'pexels',
      type: 'video',
      thumb: v.image,
      full: v.video_files?.find((f) => f.quality === 'sd')?.link || v.video_files?.[0]?.link,
      alt: query,
      pageUrl: v.url,
      credit: v.user?.name,
    })),
  };
}

async function searchUnsplash(query) {
  const accessKey = (process.env.UNSPLASH_ACCESS_KEY || '').trim();
  if (!accessKey || !query) return { images: [], videos: [] };

  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=6`,
    { headers: { Authorization: `Client-ID ${accessKey}` } }
  );
  if (!res.ok) return { images: [], videos: [] };
  const json = await res.json();

  return {
    images: (json.results || []).map((p) => ({
      id: `unsplash-img-${p.id}`,
      provider: 'unsplash',
      type: 'image',
      thumb: p.urls.small,
      full: p.urls.regular,
      alt: p.alt_description || query,
      pageUrl: p.links.html,
      credit: p.user?.name,
    })),
    videos: [],
  };
}

async function searchPixabay(query) {
  const apiKey = (process.env.PIXABAY_API_KEY || '').trim();
  if (!apiKey || !query) return { images: [], videos: [] };

  const [imgRes, vidRes] = await Promise.all([
    fetch(`https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=6&safesearch=true`),
    fetch(`https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=3&safesearch=true`),
  ]);

  const [imgJson, vidJson] = await Promise.all([
    imgRes.ok ? imgRes.json() : { hits: [] },
    vidRes.ok ? vidRes.json() : { hits: [] },
  ]);

  return {
    images: (imgJson.hits || []).map((p) => ({
      id: `pixabay-img-${p.id}`,
      provider: 'pixabay',
      type: 'image',
      thumb: p.webformatURL,
      full: p.largeImageURL || p.webformatURL,
      alt: p.tags || query,
      pageUrl: p.pageURL,
      credit: p.user,
    })),
    videos: (vidJson.hits || []).map((v) => ({
      id: `pixabay-vid-${v.id}`,
      provider: 'pixabay',
      type: 'video',
      thumb: v.videos?.medium?.thumbnail,
      full: v.videos?.medium?.url,
      alt: v.tags || query,
      pageUrl: v.pageURL,
      credit: v.user,
    })),
  };
}

async function searchAllProviders(query) {
  const [pexels, unsplash, pixabay] = await Promise.all([
    searchPexels(query).catch(() => ({ images: [], videos: [] })),
    searchUnsplash(query).catch(() => ({ images: [], videos: [] })),
    searchPixabay(query).catch(() => ({ images: [], videos: [] })),
  ]);

  return {
    images: [...pexels.images, ...unsplash.images, ...pixabay.images],
    videos: [...pexels.videos, ...pixabay.videos],
  };
}

async function generateFallbackImage(prompt) {
  return null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Keyword extraction only.
app.post('/api/analyze', async (req, res) => {
  const { text, previousText } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  try {
    const keywords = await extractKeywords(text, previousText);
    res.json({ keywords });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Media search only, given a raw query string.
app.get('/api/search', async (req, res) => {
  const query = (req.query.q || '').toString();
  if (!query.trim()) return res.status(400).json({ error: 'q is required' });

  try {
    const media = await searchAllProviders(query);
    res.json({ media });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Combined endpoint the frontend actually uses: text in, keywords + media out.
app.post('/api/scene', async (req, res) => {
  const { text, previousText } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'text is required' });

  const cacheKey = normalize(`${previousText || ''}|${text}`);
  const cached = getCached(cacheKey);
  if (cached) return res.json({ ...cached, fromCache: true });

  try {
    const keywords = await extractKeywords(text, previousText);
    let media = { images: [], videos: [] };

    if (keywords && keywords.search) {
      media = await searchAllProviders(keywords.search);
    }

    let fallbackImage = null;
    if (media.images.length === 0 && media.videos.length === 0 && keywords.search) {
      fallbackImage = await generateFallbackImage(keywords.search);
    }

    const result = { keywords, media, fallbackImage };
    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Error processing scene:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    anthropicConfigured: Boolean(anthropicKey),
    providers: {
      pexels: Boolean((process.env.PEXELS_API_KEY || '').trim()),
      unsplash: Boolean((process.env.UNSPLASH_ACCESS_KEY || '').trim()),
      pixabay: Boolean((process.env.PIXABAY_API_KEY || '').trim()),
    },
    cacheSize: cache.size,
  });
});

app.listen(PORT, () => {
  console.log(`StoryVision backend running on http://localhost:${PORT}`);
});
