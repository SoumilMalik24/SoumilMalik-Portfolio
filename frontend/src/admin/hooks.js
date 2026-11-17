import { useCallback, useEffect, useRef, useState } from 'react';
import { health } from './api';

const GIVE_UP_MS = 120000;

/**
 * Pings /health until the API answers.
 * state: 'checking' (first try) | 'waking' (still trying) | 'ready' | 'offline' (gave up after 2 min).
 * whenReady(): promise that resolves true once the server answers, or false if it never does.
 */
export function useServerStatus() {
  const [state, setState] = useState('checking');
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(0);
  const current = useRef('checking');
  const waiters = useRef([]);

  const update = useCallback((next) => {
    current.current = next;
    setState(next);
    if (next === 'ready' || next === 'offline') waiters.current.splice(0).forEach((resolve) => resolve(next === 'ready'));
  }, []);

  useEffect(() => {
    let alive = true;
    let timer;
    const ctrl = new AbortController();
    started.current = Date.now();

    const ping = async () => {
      try {
        await health(AbortSignal.any ? AbortSignal.any([ctrl.signal, AbortSignal.timeout(8000)]) : ctrl.signal);
        if (alive) update('ready');
      } catch {
        if (!alive) return;
        if (Date.now() - started.current > GIVE_UP_MS) { update('offline'); return; }
        update('waking');
        timer = setTimeout(ping, 3000);
      }
    };
    ping();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); clearInterval(tick); };
  }, [attempt, update]);

  const retry = useCallback(() => { update('checking'); setElapsed(0); setAttempt((n) => n + 1); }, [update]);
  const whenReady = useCallback(() => {
    if (current.current === 'ready') return Promise.resolve(true);
    return new Promise((resolve) => waiters.current.push(resolve));
  }, []);
  return { state, elapsed, retry, whenReady };
}

/** Load data with `fn(signal)`; re-runs when `deps` change. Returns {data, error, reload, setData}. */
export function useLoad(fn, deps) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fn(ctrl.signal)
      .then((d) => { if (!ctrl.signal.aborted) { setData(d); setError(null); } })
      .catch((e) => { if (!ctrl.signal.aborted && e.name !== 'AbortError') setError(e); });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);

  const reload = useCallback(() => setN((x) => x + 1), []);
  return { data, error, reload, setData };
}

export const when = (iso) => (iso ? new Date(iso).toLocaleString('en', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
}) : '—');
