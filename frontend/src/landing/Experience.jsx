import { useEffect, useRef, useState } from 'react';
import { experience } from '../data';

/* Career timeline: paper index cards pinned on alternating sides of a dark board.
   A line snakes left-right between them and draws itself as you scroll, with a dot
   riding its tip; each card drops in when the line reaches it. */

/* Background: a dot-matrix "signal grid". Dots shimmer with slow interfering waves, and pale
   data packets run along the grid lines, turning at junctions and leaving fading trails.
   The canvas is viewport-sized and sticky (the section is very tall), and the grid is
   offset by scroll so it reads as fixed to the page. */
function SignalGrid() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const G = 30, DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let w = 0, h = 0, dpr = 1, raf = 0, visible = false, last = 0, packets = [], S = 0;

    const spawn = (p = {}) => {
      const d = DIRS[(Math.random() * 4) | 0];
      return Object.assign(p, {
        gx: (Math.random() * (w / G + 2)) | 0, gy: ((S / G) + Math.random() * (h / G + 2)) | 0,
        dx: d[0], dy: d[1], t: 0, sp: 0.0035 + Math.random() * 0.004, life: 6 + ((Math.random() * 10) | 0), trail: [],
      });
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      const n = Math.round(Math.min(18, Math.max(7, (w * h) / 80000)));
      packets = Array.from({ length: n }, () => spawn());
    };

    const draw = (now) => {
      const dt = Math.min(50, last ? now - last : 16); last = now;
      const t = now / 1000;
      /* how far the section has scrolled past the top: the sticky canvas stays put, so shift the grid by it */
      S = Math.max(0, -c.parentElement.getBoundingClientRect().top);
      const oy = S % G;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);

      for (let y = -oy - G; y < h + G; y += G) {
        for (let x = G / 2; x < w; x += G) {
          const v = Math.sin(x * 0.012 + t * 0.6) * Math.cos((y + oy) * 0.01 - t * 0.45) + Math.sin((x + y) * 0.006 + t * 0.3);
          const a = 0.07 + Math.max(0, v) * 0.2;
          ctx.fillStyle = `rgba(236,228,210,${(a * 0.8).toFixed(3)})`;
          ctx.fillRect(x - 1.25, y - 1.25, 2.5, 2.5);
        }
      }

      for (const p of packets) {
        if (!reduce) {
          p.t += p.sp * dt;
          if (p.t >= 1) {
            p.gx += p.dx; p.gy += p.dy; p.t = 0; p.life--;
            if (Math.random() < 0.35) { const d = DIRS[(Math.random() * 4) | 0]; if (d[0] !== -p.dx || d[1] !== -p.dy) { p.dx = d[0]; p.dy = d[1]; } }
            if (p.life <= 0) spawn(p);
          }
        }
        const px = G / 2 + (p.gx + p.dx * p.t) * G, py = (p.gy + p.dy * p.t) * G - S - G;
        if (py < -2 * G || py > h + 2 * G || px < -G || px > w + G) { spawn(p); continue; }
        p.trail.push(px, py + S); if (p.trail.length > 90) p.trail.splice(0, 2);
        for (let i = 2; i < p.trail.length; i += 2) {
          const k = i / p.trail.length;
          ctx.strokeStyle = `rgba(236,228,210,${(k * 0.4).toFixed(3)})`; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.trail[i - 2], p.trail[i - 1] - S); ctx.lineTo(p.trail[i], p.trail[i + 1] - S); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(244,238,224,.75)'; ctx.shadowColor = 'rgba(236,228,210,.5)'; ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
      }
      if (visible && !reduce) raf = requestAnimationFrame(draw);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) { last = 0; raf = requestAnimationFrame(draw); }
    });
    /* reduced motion: repaint once per scroll so the static grid stays aligned */
    const onScroll = () => { if (reduce && visible) requestAnimationFrame(draw); };
    let lastW = 0;
    const onResize = () => { if (Math.abs(c.clientWidth - lastW) < 1) return; lastW = c.clientWidth; resize(); };
    onResize(); io.observe(c.parentElement);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll); };
  }, []);
  return <div className="pipe-fx" aria-hidden="true"><canvas ref={ref} /></div>;
}

const ITEMS = experience;

const OPEN_AT = 0.2; // how far the line tip must be into a card (share of its height) before it drops in

export default function Experience() {
  const wrapRef = useRef(null);
  const pathRef = useRef(null);
  const dotRef = useRef(null);
  const api = useRef(null);
  const [on, setOn] = useState(() => ITEMS.map(() => false));
  const [d, setD] = useState('');

  useEffect(() => {
    const wrap = wrapRef.current, path = pathRef.current, dot = dotRef.current;
    if (!wrap || !path) return undefined;
    const rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, total = 0, samples = [], cards = [], lastW = 0;

    /* build the snaking path from the real card positions: it passes each card on its open side */
    const build = () => {
      const W = wrap.clientWidth;
      lastW = W;
      /* offsets are layout values (unaffected by the cards' tilt/drop transforms), measured from the list */
      const list = wrap.querySelector('.exp-list'), base = list.offsetTop;
      cards = [...wrap.querySelectorAll('.exp-card')].map((el) => (
        { top: base + el.offsetTop, h: el.offsetHeight, left: el.parentElement.dataset.side === 'l' }
      ));
      const start = wrap.querySelector('.exp-start');
      const narrow = W < 760;
      const pts = [[W / 2, base + start.offsetTop + start.offsetHeight]];
      cards.forEach((c) => {
        const x = c.left ? W * (narrow ? 0.95 : 0.76) : W * (narrow ? 0.05 : 0.24);
        pts.push([x, c.top + c.h / 2]);
      });
      let s = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], m = (y1 - y0) / 2;
        s += ` C${x0} ${y0 + m} ${x1} ${y1 - m} ${x1} ${y1}`;
      }
      setD(s);
    };

    const update = () => {
      raf = 0;
      if (!samples.length) return;
      const y = rm ? Infinity : window.innerHeight * 0.62 - wrap.getBoundingClientRect().top;
      let k = 0;
      while (k < samples.length - 1 && samples[k + 1][1].y <= y) k++;
      const [len, pt] = samples[k];
      path.style.strokeDashoffset = `${total - len}`;
      dot.style.transform = `translate(${pt.x}px, ${pt.y}px)`;
      dot.style.opacity = len > 1 && len < total - 1 ? '1' : '0';
      const next = cards.map((c) => rm || y >= c.top + c.h * OPEN_AT);
      setOn((prev) => (prev.every((v, i) => v === next[i]) ? prev : next));
    };

    /* after React applies a new path, sample it so a scroll depth maps to a length along it */
    const measure = () => {
      total = path.getTotalLength();
      samples = [];
      const N = 300;
      for (let i = 0; i <= N; i++) { const l = (total * i) / N; samples.push([l, path.getPointAtLength(l)]); }
      path.style.strokeDasharray = `${total}`;
      update();
    };
    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };

    api.current = measure;
    build();
    const ro = new ResizeObserver(() => { if (Math.abs(wrap.clientWidth - lastW) >= 1) build(); });
    ro.observe(wrap);
    window.addEventListener('scroll', queue, { passive: true });
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('scroll', queue); api.current = null; };
  }, []);

  /* re-sample whenever the path changes */
  useEffect(() => { if (d && api.current) api.current(); }, [d]);

  return (
    <section id="experience" className="sec dark pipe-sec" aria-label="Experience">
      <SignalGrid />
      <h2 className="h2 rv"><span className="mask"><span>Experience</span></span></h2>
      <div className="exp" ref={wrapRef}>
        <svg className="exp-line" aria-hidden="true">
          <path className="exp-line-ghost" d={d} />
          <path className="exp-line-ink" ref={pathRef} d={d} />
        </svg>
        <span className="exp-dot" ref={dotRef} aria-hidden="true" />
        <ol className="exp-list">
          <li className="exp-start" aria-hidden="true"><span>2022 · start</span></li>
          {ITEMS.map((it, i) => (
            <li key={it.id} className={`exp-item${on[i] ? ' on' : ''}${it.next ? ' exp-next' : ''}`} data-side={i % 2 ? 'r' : 'l'}>
              <article className="exp-card">
                <header className="exp-top">
                  <span className="exp-kick">{it.kicker}</span>
                  {it.when && <span className="exp-when">{it.dur ? `${it.when} · ${it.dur}` : it.when}</span>}
                </header>
                <h3 className="exp-name">{it.name}</h3>
                <p className="exp-role">{it.role}</p>
                {it.pts && <ul className="exp-pts">{it.pts.map((p) => <li key={p}>{p}</li>)}</ul>}
                {it.tools && <p className="exp-tools">{it.tools.join(' / ')}</p>}
                {it.next && <a className="exp-cta" href="#contact">Get in touch →</a>}
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
