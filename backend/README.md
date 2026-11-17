# Portfolio Backend

FastAPI backend for the portfolio: every piece of site content lives in the database and is edited from the admin portal; publishing rebuilds the static frontend and re-indexes Kirby, the chatbot avatar, which answers from that same content.

The binding contract (tables, endpoints, status codes) is [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What it does

| Area | Summary |
|---|---|
| Admin auth | `admins` table (email, phone, scrypt hash). Login by email or phone, DB sessions (revocable, 2 h idle / 12 h max), account lockout, IP rate limit, password reset by email, audit log |
| Content | 9 sections (`profile`, `about`, `projects`, `experience`, `skills`, `contact`, `seo`, `kirby`, `knowledge`) with draft and published copies, optimistic locking, revisions, export/import |
| Publishing | `POST /api/admin/publish` → re-index Kirby → Vercel deploy hook (optional build-status polling) |
| Public content | `GET /api/content` serves published content only (hidden items and Kirby internals stripped), with ETag |
| Uploads | Images (png/jpeg/webp ≤ 5 MB) and resume PDF (≤ 10 MB), type checked by magic bytes; local disk or Cloudinary |
| Kirby | `POST /api/agent`: OpenRouter tool loop (search, navigate, set mood), knowledge index in `kb_chunks` (plain-Python cosine, no FAISS), rate limit + daily cap, unanswered-question tracking |
| Chats / inbox | Browse, search, star, archive, delete chats; grouped unanswered questions → one click to add an FAQ; contact form inbox |
| Analytics | `/api/track` and `/api/admin/metrics` (with Kirby and publish stats) |
| Maintenance | Retention purge of old analytics, archived chats, dead sessions and tokens |

## Setup

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements-dev.txt   # Windows; use .venv/bin/python elsewhere
cp .env.example .env                                         # then fill in the values you need
python -m app.cli migrate                                    # create / upgrade tables
python -m app.cli seed-content                               # load seed/content.seed.json (first run only)
python -m app.cli create-admin --email you@example.com --name "Your Name" --phone +91XXXXXXXXXX
python -m app.cli reindex                                    # build Kirby's knowledge index
uvicorn app.main:app --reload
```

Minimum `.env` for local work: nothing (SQLite, local media, Kirby off). For Kirby set `OPENROUTER_API_KEY` and `HUGGINGFACE_API_TOKEN`. In production `SECRET_KEY` is required.

## CLI

```bash
python -m app.cli migrate
python -m app.cli create-admin --email E --name N [--phone +91...] [--password-stdin]
python -m app.cli reset-password --email E [--password-stdin]
python -m app.cli list-admins
python -m app.cli set-active --email E --active true|false
python -m app.cli seed-content [--file seed/content.seed.json] [--force]
python -m app.cli reindex
python -m app.cli purge
```

Passwords: 12–128 characters, must not contain the email username, must not be a common password.

## Tests

```bash
.venv/Scripts/python -m pytest -q
```

Tests use a temporary SQLite database per test, the fake embedder, and mock every network call (OpenRouter, Hugging Face, Cloudinary, Vercel, SMTP).
