# StoryVision v2 — AI-Powered Live Storyboard

StoryVision v2 transforms your writing into a live AI storyboard: as you write narrative prose in the rich text editor, an AI image generation pipeline automatically synthesizes **3 distinct illustrations** capturing different cinematic perspectives of the paragraph you are currently typing.

```
Editor → (debounced) → Extract paragraph + context → Visual Angle Decomposition 
       → 3-Prompt Generation → AI Image Generation Model (Flux / DALL-E / Imagen) 
       → In-Memory Cache → Live Visual Storyboard
```

---

## What's New in v2 (vs v1)

| Feature | v1 | v2 |
|---|---|---|
| **Visual Source** | Stock media search APIs (Pexels, Unsplash, Pixabay) | **AI Image Generation Model** |
| **Output Count** | Variable stock photos/videos | **Exactly 3 cohesive AI illustrations per paragraph** |
| **Perspectives** | Generic keyword matching | **1. Establishing Wide Shot**<br>**2. Character & Action Focus**<br>**3. Atmospheric Detail & Mood** |
| **Inspection** | Basic thumbnail links | **Full Lightbox Modal, prompt reveal, copy prompt, re-roll** |
| **Setup Barrier** | Required multiple stock API keys | **Zero-config out of the box** (Flux AI engine) with optional DALL-E / Imagen |

---

## Project Layout

```
storyvision/
  backend/     Express API: /api/scene (3 AI images), /api/generate-image, cache
  frontend/    React + Tiptap editor with live 3-perspective visual panel & lightbox
```

---

## 1. Backend Setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev        # starts on http://localhost:8787
```

### Supported AI Keys (`.env`)

| Key | Description | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Used to decompose prose into 3 nuanced cinematic prompts | Optional (falls back to smart heuristic prompt generator) |
| `OPENAI_API_KEY` | Uses DALL-E 3 for image generation | Optional |
| `GEMINI_API_KEY` | Uses Google Imagen 3 for image generation | Optional |

> **Zero-Config Default**: If no API keys are provided, StoryVision v2 works immediately out-of-the-box using the high-performance Flux AI image generation model!

---

## 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev         # starts on http://localhost:5173
```

Open `http://localhost:5173`. Start writing a story paragraph — after you pause typing for 1 second, the right panel generates 3 AI illustrations for that specific scene.

---

## How It Works

1. **Editor tracking**: Tiptap tracks the active paragraph under the cursor.
2. **Debounce (1 second)**: On a brief pause, the paragraph (along with previous context) is dispatched to `/api/scene`.
3. **Multi-angle prompt synthesis**: The narrative is decomposed into 3 complementary visual angles:
   - **🌐 Establishing Wide Shot**: Environment, landscape, architecture, lighting.
   - **👤 Character & Action Focus**: Main characters in motion, interactions, postures.
   - **✨ Atmospheric Detail & Mood**: Close-up of symbolic elements, textures, atmospheric mood.
4. **AI Generation Engine**: Generates 3 illustrations in parallel.
5. **In-Memory Cache**: Cached by normalized paragraph text for instant loading when returning to earlier sections of your manuscript.
