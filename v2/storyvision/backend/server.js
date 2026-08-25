import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const PORT = process.env.PORT || 8787;

const anthropicKey = (process.env.ANTHROPIC_API_KEY || '').trim();
const openaiKey = (process.env.OPENAI_API_KEY || '').trim();
const geminiKey = (process.env.GEMINI_API_KEY || '').trim();

const anthropic = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

// ---------------------------------------------------------------------------
// In-Memory Cache: normalized text -> { keywords, images, ts }
// ---------------------------------------------------------------------------
const cache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60; // 60 minutes

function normalize(text) {
  return (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
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
// Step 1: Extract 3 Distinct Visual Perspectives for the Current Paragraph
// ---------------------------------------------------------------------------
const MULTI_PERSPECTIVE_SYSTEM_PROMPT = `You are an expert cinematic storyboard artist and AI art director.
Your task is to analyze a prose paragraph and craft EXACTLY 3 distinct visual image generation prompts that illustrate different camera perspectives and aspects of the current scene.

The 3 perspectives MUST be:
1. "Establishing Wide Shot": A wide cinematic view focusing on the environment, landscape, architecture, weather, and lighting.
2. "Character & Action Focus": A medium shot focusing on the main characters, their actions, posture, expressions, and immediate interaction with the setting.
3. "Atmospheric Detail & Mood": A close-up or macro shot focusing on a key object, texture, dramatic lighting, or symbolic element mentioned in the paragraph.

Rules:
- Make each prompt vivid, descriptive, cinematic, and detailed (mention lighting style, camera angle, atmosphere, color palette).
- Do NOT use abstract phrases; make them concrete and visual for an image generation model.
- Use the previous paragraph ONLY to resolve pronouns or character context.
- Return ONLY valid minified JSON matching this schema:
{
  "main_subject": "string",
  "environment": "string",
  "objects": ["string"],
  "mood": "string",
  "prompts": [
    {
      "perspective": "Establishing Wide Shot",
      "title": "Scene & Environment",
      "prompt": "detailed cinematic prompt 1"
    },
    {
      "perspective": "Character & Action Focus",
      "title": "Subject & Action",
      "prompt": "detailed cinematic prompt 2"
    },
    {
      "perspective": "Atmospheric Detail & Mood",
      "title": "Atmosphere & Detail",
      "prompt": "detailed cinematic prompt 3"
    }
  ]
}`;

function fallbackSceneAndPrompts(text) {
  const cleaned = (text || '').replace(/[^\w\s.,!?-]/gi, ' ').trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length > 2);
  const coreTheme = words.slice(0, 10).join(' ') || 'atmospheric narrative scene';
  const mainSubject = words[0] || 'protagonist';

  return {
    main_subject: mainSubject,
    environment: 'cinematic setting',
    objects: words.slice(1, 4),
    mood: 'evocative and atmospheric',
    prompts: [
      {
        perspective: 'Establishing Wide Shot',
        title: 'Scene & Environment',
        prompt: `Cinematic wide-angle establishing shot of ${cleaned}, dramatic atmospheric lighting, photorealistic, highly detailed landscape, 8k resolution, masterpiece composition`,
      },
      {
        perspective: 'Character & Action Focus',
        title: 'Subject & Action',
        prompt: `Cinematic medium shot capturing ${cleaned}, focusing on characters and vivid motion, dynamic composition, cinematic color grading, depth of field, 8k`,
      },
      {
        perspective: 'Atmospheric Detail & Mood',
        title: 'Atmosphere & Detail',
        prompt: `Cinematic close-up detailed shot highlighting elements of ${cleaned}, intricate textures, volumetric soft lighting, rich bokeh, evocative mood, photorealistic`,
      },
    ],
  };
}

async function extractSceneAndPrompts(currentText, previousText) {
  if (!anthropic) {
    return fallbackSceneAndPrompts(currentText);
  }

  const userPrompt = previousText
    ? `Previous paragraph (context only):\n"""${previousText}"""\n\nCurrent paragraph (create 3 prompts for this):\n"""${currentText}"""`
    : `Current paragraph (create 3 prompts for this):\n"""${currentText}"""`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 800,
      system: MULTI_PERSPECTIVE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = response.content.find((b) => b.type === 'text')?.text?.trim() || '{}';
    const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed.prompts) || parsed.prompts.length !== 3) {
      return fallbackSceneAndPrompts(currentText);
    }
    return parsed;
  } catch (err) {
    console.warn('Anthropic API error, using fallback prompt generator:', err.message || err);
    return fallbackSceneAndPrompts(currentText);
  }
}

// ---------------------------------------------------------------------------
// Step 2: AI Image Generation Pipeline
// Supports:
// 1. Pollinations AI (Flux model) - Zero-setup, instant AI generation
// 2. OpenAI DALL-E (when OPENAI_API_KEY is configured)
// 3. Google Gemini/Imagen (when GEMINI_API_KEY is configured)
// ---------------------------------------------------------------------------

async function generateSingleImageWithOpenAI(prompt, index) {
  if (!openaiKey) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: prompt.slice(0, 1000),
        n: 1,
        size: '1024x1024',
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`OpenAI DALL-E error: ${err}`);
      return null;
    }
    const data = await res.json();
    const url = data.data?.[0]?.url;
    if (url) {
      return {
        url,
        provider: 'OpenAI DALL-E 3',
      };
    }
  } catch (err) {
    console.warn('OpenAI generation error:', err.message);
  }
  return null;
}

async function generateSingleImageWithGemini(prompt, index) {
  if (!geminiKey) return null;
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${geminiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio: '16:9' },
      }),
    });
    if (!res.ok) {
      console.warn(`Gemini Imagen error: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    const base64Bytes = data.predictions?.[0]?.bytesBase64Encoded;
    if (base64Bytes) {
      return {
        url: `data:image/jpeg;base64,${base64Bytes}`,
        provider: 'Google Imagen 3',
      };
    }
  } catch (err) {
    console.warn('Gemini Imagen generation error:', err.message);
  }
  return null;
}

function generateWithPollinations(prompt, index, seed) {
  const cleanPrompt = encodeURIComponent(prompt.trim());
  const finalSeed = seed || Math.floor(Math.random() * 1000000) + (index * 1337);
  // Uses Flux model for high quality artistic narrative rendering
  const url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=768&height=512&seed=${finalSeed}&nologo=true&model=flux`;
  return {
    url,
    provider: 'Flux AI (Pollinations)',
    seed: finalSeed,
  };
}

async function generate3Images(prompts) {
  const timestamp = Date.now();
  const baseSeed = Math.floor(Math.random() * 900000) + 100000;

  const imagePromises = prompts.map(async (item, idx) => {
    const seed = baseSeed + idx * 7919;
    let generated = null;

    // Try OpenAI DALL-E if configured
    if (openaiKey) {
      generated = await generateSingleImageWithOpenAI(item.prompt, idx);
    }

    // Try Gemini Imagen if configured and OpenAI wasn't used/available
    if (!generated && geminiKey) {
      generated = await generateSingleImageWithGemini(item.prompt, idx);
    }

    // Default fast zero-config provider (Flux via Pollinations)
    if (!generated) {
      generated = generateWithPollinations(item.prompt, idx, seed);
    }

    return {
      id: `ai-img-${timestamp}-${idx + 1}`,
      perspective: item.perspective,
      title: item.title,
      prompt: item.prompt,
      url: generated.url,
      provider: generated.provider,
      seed: generated.seed || seed,
      createdAt: new Date().toISOString(),
    };
  });

  return await Promise.all(imagePromises);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// Main endpoint: Takes current paragraph (+ optional previous paragraph),
// extracts narrative keywords & 3 perspective prompts, and returns 3 AI-generated images.
app.post('/api/scene', async (req, res) => {
  const { text, previousText, regenerate } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  const cacheKey = normalize(`${previousText || ''}|${text}`);
  if (!regenerate) {
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }
  }

  try {
    const sceneData = await extractSceneAndPrompts(text, previousText);
    const images = await generate3Images(sceneData.prompts);

    const result = {
      keywords: {
        main_subject: sceneData.main_subject || '',
        environment: sceneData.environment || '',
        objects: sceneData.objects || [],
        mood: sceneData.mood || '',
      },
      prompts: sceneData.prompts,
      images,
      fromCache: false,
    };

    setCached(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Error processing scene for 3 AI images:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Single image generation / regeneration endpoint
app.post('/api/generate-image', async (req, res) => {
  const { prompt, perspective, title, seed } = req.body || {};
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    let generated = null;
    if (openaiKey) {
      generated = await generateSingleImageWithOpenAI(prompt, 0);
    }
    if (!generated && geminiKey) {
      generated = await generateSingleImageWithGemini(prompt, 0);
    }
    if (!generated) {
      generated = generateWithPollinations(prompt, 0, seed);
    }

    res.json({
      id: `ai-img-${Date.now()}-custom`,
      perspective: perspective || 'Custom Illustration',
      title: title || 'Custom Prompt',
      prompt,
      url: generated.url,
      provider: generated.provider,
      seed: generated.seed || seed,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error generating single image:', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: '2.0.0',
    mode: 'AI Image Generation (3 images per paragraph)',
    providers: {
      anthropicPromptEngine: Boolean(anthropicKey),
      openAiDallE: Boolean(openaiKey),
      geminiImagen: Boolean(geminiKey),
      pollinationsFlux: true, // Always available out of the box
    },
    cacheSize: cache.size,
  });
});

app.listen(PORT, () => {
  console.log(`StoryVision v2 (3-Image Generation) backend running on http://localhost:${PORT}`);
});
