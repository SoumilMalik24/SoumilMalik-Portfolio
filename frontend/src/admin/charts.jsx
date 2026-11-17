import { useEffect, useRef, useState } from 'react';
import { COLORS } from './colors';
import { fmtDate, fmtDur, fmtInt } from './format';


function useWidth(ref) {
  const [w, setW] = useState(600);
  useEffect(() => {
    const el = ref.current;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.floor(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/* sessions (area + line) and visitors (line) per day, with a crosshair tooltip */
export function DailyChart({ daily }) {
  const wrap = useRef(null);
  const w = useWidth(wrap);
  const [hover, setHover] = useState(null);
  const H = 250, m = { t: 12, r: 14, b: 28, l: 36 };
  const iw = w - m.l - m.r, ih = H - m.t - m.b;
  const max = niceMax(Math.max(1, ...daily.map((d) => Math.max(d.sessions, d.visitors))));
  const x = (i) => (daily.length < 2 ? iw / 2 : (i * iw) / (daily.length - 1));
  const y = (v) => ih - (v / max) * ih;
  const path = (key) => daily.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`).join('');
  const ticks = [0, max / 2, max].filter(Number.isInteger);
  const step = Math.max(1, Math.ceil(daily.length / 6));

  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left - m.l) / iw) * (daily.length - 1));
    setHover(Math.min(daily.length - 1, Math.max(0, i)));
  };
  const d = hover === null ? null : daily[hover];

  return (
    <div className="adm-chart" ref={wrap}>
      <svg width={w} height={H} role="img" aria-label="Sessions and visitors per day"
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <g transform={`translate(${m.l},${m.t})`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1="0" x2={iw} y1={y(t)} y2={y(t)} className="adm-grid" />
              <text x="-8" y={y(t) + 4} textAnchor="end" className="adm-axis">{t}</text>
            </g>
          ))}
          {daily.map((p, i) => (i % step === 0 ? (
            <text key={p.date} x={x(i)} y={ih + 18} textAnchor={i === daily.length - 1 && daily.length > 1 ? 'end' : i === 0 && daily.length > 1 ? 'start' : 'middle'} className="adm-axis">{fmtDate(p.date)}</text>
          ) : null))}
          <path d={`${path('sessions')}L${x(daily.length - 1)} ${ih}L0 ${ih}Z`} fill={COLORS.orange} opacity="0.16" />
          <path d={path('sessions')} fill="none" stroke={COLORS.orange} strokeWidth="2" strokeLinejoin="round" />
          <path d={path('visitors')} fill="none" stroke={COLORS.blue} strokeWidth="2" strokeLinejoin="round" />
          {d && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1="0" y2={ih} className="adm-cross" />
              <circle cx={x(hover)} cy={y(d.sessions)} r="4" fill={COLORS.orange} className="adm-ring" />
              <circle cx={x(hover)} cy={y(d.visitors)} r="4" fill={COLORS.blue} className="adm-ring" />
            </g>
          )}
        </g>
      </svg>
      {d && (
        <div className="adm-tip" style={{ left: m.l + x(hover), transform: `translateX(${hover > daily.length / 2 ? '-110%' : '10%'})` }}>
          <div className="adm-tip-h">{fmtDate(d.date)}</div>
          <div className="adm-tip-r"><i style={{ background: COLORS.orange }} /><b>{fmtInt(d.sessions)}</b><span>sessions</span></div>
          <div className="adm-tip-r"><i style={{ background: COLORS.blue }} /><b>{fmtInt(d.visitors)}</b><span>visitors</span></div>
        </div>
      )}
      <div className="adm-legend">
        <span><i style={{ background: COLORS.orange }} />Sessions</span>
        <span><i style={{ background: COLORS.blue }} />Visitors</span>
      </div>
    </div>
  );
}

/* how far down the page people get: reach bar, time spent, and where they leave */
export function SectionFunnel({ sections, best }) {
  return (
    <div className="adm-funnel" role="table" aria-label="Section engagement">
      <div className="adm-frow adm-fhead" role="row">
        <span role="columnheader">Section</span>
        <span role="columnheader">Reached</span>
        <span role="columnheader">Avg time</span>
        <span role="columnheader">Left here</span>
      </div>
      {sections.map((s) => {
        const top = s.name === best;
        return (
          <div className={'adm-frow' + (top ? ' is-best' : '')} role="row" key={s.name}>
            <span className="adm-fname" role="cell">
              {s.name}{top && <em>most engaging</em>}
            </span>
            <span className="adm-fbar" role="cell">
              <span className="adm-track">
                <span style={{ width: `${Math.max(0, Math.min(100, s.reached_pct))}%`, background: top ? COLORS.orange : COLORS.bar }} />
              </span>
              <b>{s.reached_pct.toFixed(0)}%</b>
            </span>
            <span role="cell">{fmtDur(s.avg_dwell_s)}</span>
            <span role="cell">{s.exit_pct.toFixed(0)}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* one stacked bar with direct labels, for parts of a whole */
export function SplitBar({ parts, label }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  if (!total) return <p className="adm-empty">No data yet</p>;
  return (
    <div className="adm-split" role="img" aria-label={label}>
      <div className="adm-splitbar">
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.name} style={{ flexGrow: p.value, background: p.color }} title={`${p.name}: ${fmtInt(p.value)}`} />
        ))}
      </div>
      <ul className="adm-splitkey">
        {parts.map((p) => (
          <li key={p.name}>
            <i style={{ background: p.color }} />
            <span>{p.name}</span>
            <b>{Math.round((p.value / total) * 100)}%</b>
            <small>{fmtInt(p.value)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
