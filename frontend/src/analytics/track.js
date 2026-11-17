const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
const SECTIONS = ['hero', 'about', 'projects', 'experience', 'contact'];
const TICK_MS = 500, FLUSH_MS = 10000, FIRST_FLUSH_MS = 2500;

function randomId() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stored(storage, key) {
  try {
    let v = storage.getItem(key);
    if (!v) { v = randomId(); storage.setItem(key, v); }
    return v;
  } catch { return randomId(); }
}

function disabled() {
  try { if (localStorage.getItem('sm_notrack') === '1') return true; } catch { /* storage unavailable */ }
  return !BASE || navigator.doNotTrack === '1' || location.pathname.startsWith('/admin');
}

/* anonymous, first-party: which sections are in view and for how long. Sends cumulative snapshots, so a lost request loses nothing. */
export default function startTracking() {
  if (disabled()) return () => {};

  const visitor = stored(localStorage, 'sm_vid'), session = stored(sessionStorage, 'sm_sid');
  const dwell = Object.fromEntries(SECTIONS.map((s) => [s, 0]));
  let active = 0, maxScroll = 0, dirty = true, last = performance.now();

  const device = innerWidth < 768 ? 'mobile' : innerWidth < 1100 ? 'tablet' : 'desktop';

  function tick() {
    const now = performance.now(), dt = now - last; last = now;
    if (document.visibilityState !== 'visible') return;
    const vh = innerHeight;
    let best = null, bestRatio = 0;
    for (const name of SECTIONS) {
      const el = document.getElementById(name);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / Math.min(r.height || 1, vh);
      if (ratio > bestRatio) { best = name; bestRatio = ratio; }
    }
    if (best && bestRatio >= 0.5) { dwell[best] += dt; dirty = true; }
    active += dt;
    const doc = document.documentElement;
    maxScroll = Math.max(maxScroll, Math.min(100, ((scrollY + vh) / (doc.scrollHeight || 1)) * 100));
  }

  function snapshot() {
    const sections = {};
    for (const s of SECTIONS) if (dwell[s] > 0) sections[s] = Math.round(dwell[s]);
    return JSON.stringify({
      visitor_id: visitor, session_id: session, referrer: document.referrer, device,
      duration_ms: Math.round(active), max_scroll_pct: Math.round(maxScroll), sections,
    });
  }

  function flush(final) {
    tick();
    if (!dirty && !final) return;
    dirty = false;
    const body = snapshot(), url = BASE + '/api/track';
    /* text/plain keeps it a simple request, so there is no CORS preflight on page exit */
    if (final && navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
    fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'text/plain' }, keepalive: true }).catch(() => {});
  }

  const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
  const t1 = setInterval(tick, TICK_MS), t2 = setInterval(() => flush(false), FLUSH_MS), t3 = setTimeout(() => flush(false), FIRST_FLUSH_MS);
  document.addEventListener('visibilitychange', onHide);
  addEventListener('pagehide', onHide);

  return () => {
    clearInterval(t1); clearInterval(t2); clearTimeout(t3);
    document.removeEventListener('visibilitychange', onHide);
    removeEventListener('pagehide', onHide);
  };
}
