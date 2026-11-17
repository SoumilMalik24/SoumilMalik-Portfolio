# Portfolio frontend

Personal portfolio of Soumil Malik, AI Engineer. React 19 + Vite, plain CSS, no UI framework.

All page content (projects, skills, experience, About, contact links, SEO, Kirby's tour lines) is edited in the admin portal at `/admin` and published from there. Nothing about the content is hardcoded in the components.

## Run

```sh
npm install
cp .env.example .env   # set VITE_BACKEND_URL to the backend
npm run dev
```

`npm run dev` and `npm run build` first run `scripts/fetch-content.mjs`, which downloads the published content from `${VITE_BACKEND_URL}/api/content` into `src/data/content.json`. If the backend is unreachable (or the variable is empty) it falls back to the last download, then to the committed `src/data/content.snapshot.json`, so the site always builds. During `npm run build` it waits up to ~90 s for a sleeping server to wake.

`npm run lint` runs ESLint.

## How content reaches the site

1. Edit in `/admin` → Content, save the draft.
2. Admin → Publish. The backend re-indexes Kirby and calls the Vercel deploy hook.
3. Vercel rebuilds; the build fetches the new content, so visitors never wait on the API for page content.

Refresh the committed fallback occasionally: `curl $VITE_BACKEND_URL/api/content > src/data/content.snapshot.json`.

## Layout

| Path | What it is |
| --- | --- |
| `src/landing/` | The page, one file per section plus the nav, custom cursor and Kirby guide |
| `src/data/index.js` | Adapts the published content to what the components use |
| `src/data/content.snapshot.json` | Committed fallback copy of the content. `content.json` is generated and git-ignored |
| `scripts/fetch-content.mjs` | The pre-dev / pre-build content download |
| `vite.config.js` | Also fills the page title, description and Open Graph tags from the SEO section |
| `src/admin/` | `/admin`: sign-in, content editor, publish, Kirby tools, chats, inbox, settings, analytics. Loaded only on that route |
| `src/analytics/track.js` | Anonymous section-dwell tracking (off when `VITE_BACKEND_URL` is unset or Do Not Track is on) |
| `public/` | Default portrait, resume PDF, icons (used until you upload replacements in the admin) |

Kirby's chat answers come from the backend (`POST /api/agent`).

## Deploy

Vercel. `vercel.json` rewrites `/admin` to the SPA and caches hashed assets for a year. Set `VITE_BACKEND_URL` in the Vercel project, and create a Deploy Hook there; put its URL in the backend's `VERCEL_DEPLOY_HOOK_URL`.
