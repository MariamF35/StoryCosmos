# StoryVision — Write with a live moodboard

An MVP writing app: type on the left, and relevant photos/videos from Pexels,
Unsplash, and Pixabay automatically appear on the right, based on what you're
currently writing. Falls back to AI image generation only if no good stock
media is found.

```
Editor → (debounced) → Extract sentence + context → LLM → search keywords
      → Media APIs (Pexels/Unsplash/Pixabay) → Cache → Visual panel
```

## Project layout

```
storyvision/
  backend/     Express API: /api/analyze (LLM keywords), /api/search (media), cache
  frontend/    React + Tiptap editor with a live visual panel
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
# fill in your keys in .env (see below)
npm run dev        # starts on http://localhost:8787
```

### Required keys (.env)

| Key | Where to get it | Required? |
|---|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com | Yes — used to extract visual keywords from text |
| `PEXELS_API_KEY` | https://www.pexels.com/api/ | Recommended — images + videos |
| `UNSPLASH_ACCESS_KEY` | https://unsplash.com/developers | Optional — images |
| `PIXABAY_API_KEY` | https://pixabay.com/api/docs/ | Optional — images + videos |

You only need `ANTHROPIC_API_KEY` plus at least one media key to get a working
demo. The backend gracefully skips any provider whose key is missing.

## 2. Frontend setup

```bash
cd frontend
npm install
npm run dev         # starts on http://localhost:5173
```

Open http://localhost:5173. Start typing a scene — after you pause for about
a second, the right panel updates with matching photos/videos.

## How it works

1. **Editor** (Tiptap) tracks the paragraph the cursor is currently in.
2. On a **1-second pause** in typing, the current paragraph (plus the previous
   one, for pronoun context like "he"/"she") is sent to `/api/analyze`.
3. The backend calls Claude with a tight prompt that returns structured JSON:
   `{ main_subject, environment, objects, mood, search }`.
4. The `search` phrase is sent to `/api/search`, which queries Pexels /
   Unsplash / Pixabay in parallel and merges the results.
5. Results are **cached** in-memory backend-side, keyed by the normalized
   sentence text, so returning to an already-analyzed paragraph costs nothing.
6. If media search comes back empty, the backend falls back to generating a
   single image via Claude/an image model (stubbed — see
   `backend/server.js`'s `generateFallbackImage`, wire up your preferred
   image API there).

## Extending it

- **Scene-change detection**: compare `environment` between consecutive
  analyses; only hard-refresh the panel when it changes (see Step 10 in the
  design doc). A hook for this is left in `frontend/src/App.jsx`
  (`lastEnvironmentRef`).
- **Character/location memory**: persist `main_subject` → visual profile in a
  small database (Postgres/SQLite) and reuse it whenever that character
  reappears.
- **Style filters**: append a style string (e.g. "anime", "oil painting") to
  the `search` query before calling `/api/search`.

## Notes

- This is a functional MVP, not a production system: the cache is in-memory
  (resets on server restart), there's no auth, and rate limiting is minimal.
- No API keys are embedded anywhere in this code — you provide your own via
  `.env`.
