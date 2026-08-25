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
v2/
├── README.md
├── server.js               (Convenience root entrypoint)
├── App.jsx                 (Convenience root UI component)
├── package.json
└── storyvision/
    ├── README.md
    ├── backend/            (Express API: /api/scene, /api/generate-image, cache)
    └── frontend/           (React + Tiptap editor with 3-perspective visual panel)
```

---

## Getting Started

### 1. Backend

```bash
cd storyvision/backend
npm install
npm run dev        # starts on http://localhost:8787
```

### 2. Frontend

```bash
cd storyvision/frontend
npm install
npm run dev         # starts on http://localhost:5173
```

Open `http://localhost:5173`.
