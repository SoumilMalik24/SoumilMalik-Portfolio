export const fmtInt = (n) => Math.round(n).toLocaleString('en');

export function fmtDur(sec) {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export const fmtPct = (ratio) => `${(ratio * 100).toFixed(1)}%`;

export function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/* percent change vs the previous period; null when there is nothing to compare */
export const delta = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);
