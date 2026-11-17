/**
 * Writes src/data/content.json before dev/build.
 *
 * Fetches published content from `${VITE_BACKEND_URL}/api/content`. If the backend is not set or
 * cannot be reached in time, it keeps the last fetched content.json, or falls back to the committed
 * content.snapshot.json. The site always builds.
 *
 *   node scripts/fetch-content.mjs            # dev: give up quickly
 *   node scripts/fetch-content.mjs --build    # build: wait up to ~90 s (a sleeping server may be waking up)
 */
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'src/data/content.json');
const SNAPSHOT = resolve(root, 'src/data/content.snapshot.json');
const build = process.argv.includes('--build');
const mode = build ? 'production' : 'development';
const env = { ...loadEnv(mode, root, 'VITE_'), ...process.env };
const base = (env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

const ATTEMPT_TIMEOUT_MS = build ? 20000 : 4000;
const DEADLINE_MS = build ? 90000 : 4000;

function valid(body) {
  return body && typeof body === 'object' && Number.isInteger(body.version) && body.sections
    && body.sections.profile && body.sections.projects;
}

async function fetchContent() {
  const started = Date.now();
  let lastError = 'not attempted';
  while (Date.now() - started < DEADLINE_MS) {
    try {
      const res = await fetch(`${base}/api/content`, { signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      if (!valid(body)) throw new Error('response is missing published sections');
      return body;
    } catch (err) {
      lastError = err.message || String(err);
      if (!build) break;
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  throw new Error(lastError);
}

function fallback(reason) {
  if (existsSync(OUT)) {
    console.warn(`[content] ${reason}; keeping existing src/data/content.json`);
    return;
  }
  copyFileSync(SNAPSHOT, OUT);
  console.warn(`[content] ${reason}; using content.snapshot.json`);
}

if (!base) {
  fallback('VITE_BACKEND_URL not set');
} else {
  try {
    const body = await fetchContent();
    const next = JSON.stringify(body, null, 2) + '\n';
    const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (next !== prev) writeFileSync(OUT, next);
    console.log(`[content] published content v${body.version} from ${base}`);
  } catch (err) {
    fallback(`could not fetch ${base}/api/content (${err.message})`);
  }
}
