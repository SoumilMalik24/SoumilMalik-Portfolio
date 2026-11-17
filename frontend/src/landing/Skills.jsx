import { useEffect, useRef, useState } from 'react';
import { stack } from '../data';

/* Skills orb: every skill is a node on a rotating 3D sphere (canvas 2D, no deps),
   linked to its nearest neighbours. Picking a filter dims every node except that
   group's, which light up together with the links between them.
   Drag to rotate; click/tap a node to filter by its group. */

// Only skills with a documented use in Experience get a "used at" line.
const USED = {
  'Knowledge Distillation': 'Used at RegalRinse',
  n8n: 'Used at Wobot',
};

const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const GROUPS = stack.map((g) => ({
  name: g.group,
  tagline: g.tagline,
  pills: list(g.pills),
  featured: list(g.featured),
}));
const TOTAL = GROUPS.reduce((s, g) => s + g.pills.length, 0);
const MONO = 'ui-monospace,Consolas,monospace';

export default function Skills() {
  const [filter, setFilter] = useState('All');
  const filterRef = useRef(filter);
  const canvasRef = useRef(null);

  useEffect(() => { filterRef.current = filter; }, [filter]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return undefined;
    const ctx = cv.getContext('2d');
    const rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(cv);
    const FG = css.getPropertyValue('--fg').trim() || '#0f1115';
    const HOT = css.getPropertyValue('--hot').trim() || '#ff4a1c';

    // Nodes on a Fibonacci sphere. Ordered by group, so each group forms a band.
    const nodes = [];
    GROUPS.forEach((g) => g.pills.forEach((p) => nodes.push({
      label: p, group: g.name, hot: g.featured.includes(p), used: USED[p], a: 1,
    })));
    const N = nodes.length;
    const GA = Math.PI * (3 - Math.sqrt(5));
    nodes.forEach((n, i) => {
      const y = 1 - ((i + 0.5) / N) * 2;
      const r = Math.sqrt(1 - y * y);
      n.x = Math.cos(i * GA) * r; n.y = y; n.z = Math.sin(i * GA) * r;
    });

    // Graph edges: each node links to its 3 nearest neighbours.
    const seen = new Set();
    const edges = [];
    nodes.forEach((a, i) => {
      nodes
        .map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2])
        .filter(([j]) => j !== i)
        .sort((p, q) => p[1] - q[1])
        .slice(0, 3)
        .forEach(([j]) => {
          const k = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (!seen.has(k)) { seen.add(k); edges.push([nodes[i], nodes[j]]); }
        });
    });

    let W = 0, H = 0, raf = 0, inView = true;
    let ry = 0.4, rx = -0.3, vel = 0;
    let drag = null, hover = null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const tooltip = (n) => {
      const lines = [[n.label, `600 13px ${MONO}`], [n.group, `400 11.5px ${MONO}`]];
      if (n.used) lines.push([n.used, `400 11.5px ${MONO}`]);
      const pad = 10, lh = 17;
      let w = 0;
      lines.forEach(([t, f]) => { ctx.font = f; w = Math.max(w, ctx.measureText(t).width); });
      const bw = w + pad * 2, bh = lines.length * lh + pad * 2 - 4;
      const bx = clamp(n.px - bw / 2, 4, W - bw - 4);
      const by = n.py - bh - 16 < 4 ? n.py + 16 : n.py - bh - 16;
      ctx.globalAlpha = 1;
      ctx.fillStyle = FG;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(bx, by, bw, bh, 8); else ctx.rect(bx, by, bw, bh);
      ctx.fill();
      lines.forEach(([t, f], i) => {
        ctx.font = f;
        ctx.fillStyle = i === 2 ? HOT : i === 0 ? '#fff' : '#b4b4b4';
        ctx.fillText(t, bx + pad, by + pad + 10 + i * lh);
      });
    };

    const frame = () => {
      raf = 0;
      if (!drag) {
        if (!rm) ry += 0.0022;
        ry += vel; vel *= 0.94;
      }
      const f = filterRef.current;
      const all = f === 'All';
      const R = Math.min(W, H) * 0.36, cx = W / 2, cy = H / 2;
      const cyR = Math.cos(ry), syR = Math.sin(ry), cxR = Math.cos(rx), sxR = Math.sin(rx);

      nodes.forEach((n) => {
        const x1 = n.x * cyR - n.z * syR;
        const z1 = n.x * syR + n.z * cyR;
        const y1 = n.y * cxR - z1 * sxR;
        const z2 = n.y * sxR + z1 * cxR;
        const s = 3 / (3 - z2);
        n.px = cx + x1 * R * s; n.py = cy - y1 * R * s; n.pz = z2; n.s = s;
        n.on = all || n.group === f;
        n.a += ((n.on ? 1 : 0.1) - n.a) * (rm ? 1 : 0.12);
      });

      ctx.clearRect(0, 0, W, H);

      // soft body of the orb
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.15);
      g.addColorStop(0, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.15, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = FG; ctx.globalAlpha = 0.08; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, Math.PI * 2); ctx.stroke();

      // edges
      edges.forEach(([a, b]) => {
        const depth = ((a.pz + b.pz) / 2 + 1) / 2;
        const lit = !all && a.on && b.on;
        ctx.strokeStyle = lit ? HOT : FG;
        ctx.lineWidth = lit ? 1.4 : 1;
        ctx.globalAlpha = lit ? 0.25 + 0.55 * depth : (0.05 + 0.22 * depth) * Math.min(a.a, b.a);
        ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      });

      // nodes + labels, back to front
      [...nodes].sort((p, q) => p.pz - q.pz).forEach((n) => {
        const depth = (n.pz + 1) / 2;
        const alpha = n.a * (0.3 + 0.7 * depth);
        const r = (n.hot ? 4.6 : 3.2) * n.s * (n === hover ? 1.4 : 1);
        const col = (!all && n.on) || (all && n.hot) ? HOT : FG;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(n.px, n.py, r, 0, Math.PI * 2); ctx.fill();
        if (n.hot || (!all && n.on)) {
          ctx.strokeStyle = col; ctx.lineWidth = 1;
          ctx.globalAlpha = alpha * 0.45;
          ctx.beginPath(); ctx.arc(n.px, n.py, r + 4, 0, Math.PI * 2); ctx.stroke();
        }

        const la = n === hover ? 0
          : all ? clamp((n.pz - 0.05) * 2.5, 0, 1) * 0.85
          : n.on ? clamp((n.pz + 0.75) * 2, 0, 1) : 0;
        if (la > 0.02) {
          ctx.globalAlpha = la * n.a;
          ctx.fillStyle = FG;
          ctx.font = `${n.hot || (!all && n.on) ? 600 : 400} ${!all && n.on ? 13 : 11.5}px ${MONO}`;
          ctx.fillText(n.label, n.px + r + 7, n.py + 4);
        }
      });

      if (hover) tooltip(hover);
      ctx.globalAlpha = 1;

      if (inView && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const start = () => { if (!raf && inView && !document.hidden) raf = requestAnimationFrame(frame); };

    const hit = (e) => {
      const b = cv.getBoundingClientRect();
      const x = e.clientX - b.left, y = e.clientY - b.top;
      let best = null, bd = 18 * 18;
      nodes.forEach((n) => {
        if (n.pz < -0.25 || n.a < 0.35) return;
        const d = (n.px - x) ** 2 + (n.py - y) ** 2;
        if (d < bd) { bd = d; best = n; }
      });
      return best;
    };

    const onDown = (e) => {
      drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      hover = hit(e);
      vel = 0;
    };
    const onMove = (e) => {
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) {
          drag.moved = true; hover = null;
          try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        }
        if (drag.moved) {
          ry += dx * 0.006; rx = clamp(rx - dy * 0.006, -1.2, 1.2); vel = dx * 0.0008;
          drag.x = e.clientX; drag.y = e.clientY;
        }
        if (rm) start();
        return;
      }
      hover = hit(e);
      cv.style.cursor = hover ? 'pointer' : 'grab';
    };
    const onUp = () => {
      if (drag && !drag.moved && hover) {
        const grp = hover.group;
        setFilter((prev) => (prev === grp ? 'All' : grp));
      }
      drag = null;
    };
    const onLeave = () => { if (!drag) hover = null; };
    const onCancel = () => { drag = null; hover = null; };
    const onVis = () => start();

    resize();
    const ro = new ResizeObserver(() => { resize(); start(); });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; start(); }, { rootMargin: '100px' });
    io.observe(cv);
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointerleave', onLeave);
    cv.addEventListener('pointercancel', onCancel);
    document.addEventListener('visibilitychange', onVis);
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('pointercancel', onCancel);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const active = GROUPS.find((g) => g.name === filter);

  return (
    <section id="skills" className="sec sk-sec" aria-label="Skills">
      {/* the sheet's top edge: tilted, taped at the corners, lying over the end of the Experience board */}
      <div className="sk-edge" aria-hidden="true"><i /><i /></div>
      <h2 className="h2 rv"><span className="mask"><span>Skills</span></span></h2>

      <div className="sk-wrap">
        <div className="sk-side rv">
          <p className="sk-kick">// tool registry</p>
          <div className="sk-filters" role="group" aria-label="Filter skills">
            {['All', ...GROUPS.map((g) => g.name)].map((f) => (
              <button
                key={f}
                type="button"
                className="sk-filter"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
                <span className="sk-count">
                  {f === 'All' ? TOTAL : GROUPS.find((g) => g.name === f).pills.length}
                </span>
              </button>
            ))}
          </div>

          <div className="sk-info" aria-live="polite">
            <p className="sk-title">{active ? active.name : `${TOTAL} tools · ${GROUPS.length} domains`}</p>
            <p className="sk-desc">
              {active ? active.tagline : 'Drag the orb to spin it. Pick a domain, or click any node, to light up that part of the graph.'}
            </p>
            {active && (
              <ul className="sk-chips">
                {active.pills.map((p) => (
                  <li key={p} className={`sk-chip${active.featured.includes(p) ? ' hot' : ''}`}>{p}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="sk-legend"><i className="dot" />featured: the tools I reach for first</p>
        </div>

        <div className="sk-orb rv">
          <canvas ref={canvasRef} className="sk-cv" aria-hidden="true" />
        </div>
      </div>

      <ul className="sk-sr">
        {GROUPS.map((g) => <li key={g.name}>{g.name}: {g.pills.join(', ')}</li>)}
      </ul>
    </section>
  );
}
