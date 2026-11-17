import { useEffect, useRef, useState } from 'react';
import { facts, paragraphs, profile } from '../data';

const FACTS = facts;
const PARAS = paragraphs;

function DriftField() {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext('2d');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, visible = true, pts = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const r = c.getBoundingClientRect();
      w = r.width; h = r.height;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, Math.max(28, (w * h) / 16000)));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.4 + 0.6,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const D = 150;
      for (const p of pts) {
        if (!reduce) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0 || p.x > w) p.vx *= -1;
          if (p.y < 0 || p.y > h) p.vy *= -1;
        }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < D) {
            ctx.strokeStyle = `rgba(255,255,255,${(1 - d / D) * 0.16})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        ctx.fillStyle = i % 9 === 0 ? 'rgba(255,74,28,.85)' : 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 6.283); ctx.fill();
      }
      if (!reduce && visible) raf = requestAnimationFrame(draw);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) draw();
    });
    /* mobile address bars fire resize while scrolling: only reseed when the width really changes */
    let lastW = 0;
    const onResize = () => {
      const bw = c.getBoundingClientRect().width;
      if (Math.abs(bw - lastW) < 1) return;
      lastW = bw;
      resize();
    };
    onResize(); draw(); io.observe(c);
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener('resize', onResize); };
  }, []);
  return <canvas ref={ref} className="about-fx" aria-hidden="true" />;
}

const key = (k) => k.toLowerCase().replace(/s+/g, '_');
const handle = profile.name.toLowerCase();
const user = profile.name.split(' ')[0].toLowerCase() || 'me';
const SCRIPT = [
  { cmd: 'whoami' },
  { out: [['t-out', handle]] },
  { gap: true },
  { cmd: 'cat facts.json' },
  { out: [['', '{']] },
  ...FACTS.map(([k, v], i) => ({
    out: [['', '  '], ['t-key', `"${key(k)}"`], ['', ': '], ['t-str', `"${v}"`], ['', i < FACTS.length - 1 ? ',' : '']],
  })),
  { out: [['', '}']] },
  { gap: true },
  { cmd: '' },
];

function Terminal() {
  const ref = useRef(null);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [step, setStep] = useState(reduce ? SCRIPT.length - 1 : 0);
  const [typed, setTyped] = useState(0);
  const [started, setStarted] = useState(reduce);

  useEffect(() => {
    if (started) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStarted(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || reduce) return;
    const it = SCRIPT[step];
    if (!it || step >= SCRIPT.length - 1) return;
    let t;
    if (it.cmd !== undefined) {
      if (typed < it.cmd.length) t = setTimeout(() => setTyped(typed + 1), 28 + Math.random() * 32);
      else t = setTimeout(() => { setStep(step + 1); setTyped(0); }, 250);
    } else {
      t = setTimeout(() => setStep(step + 1), it.gap ? 60 : 45);
    }
    return () => clearTimeout(t);
  }, [started, step, typed, reduce]);

  const lines = [];
  SCRIPT.forEach((it, i) => {
    if (i > step) return;
    if (it.cmd !== undefined) {
      const txt = i < step ? it.cmd : it.cmd.slice(0, typed);
      lines.push(
        <div key={i}><span className="t-dim">$</span> {txt}{i === step && <span className="t-cur" />}</div>
      );
    } else if (it.out) {
      lines.push(<div key={i}>{it.out.map(([c, t], j) => <span key={j} className={c}>{t}</span>)}</div>);
    } else {
      lines.push(<div key={i} className="t-gap" />);
    }
  });

  return (
    <aside className="term rv" aria-label="Quick facts" ref={ref}>
      <div className="term-bar">
        <i /><i /><i />
        <span>{user}@portfolio: ~</span>
      </div>
      <div className="term-body" aria-live="off">
        <div className="term-live">{lines}</div>
        {/* reserve final height so the box doesn't grow while typing */}
        <div className="term-ghost" aria-hidden="true">
          {SCRIPT.map((it, i) => <div key={i} className={it.gap ? 't-gap' : ''}>{it.cmd !== undefined ? `$ ${it.cmd}` : it.out ? it.out.map((x) => x[1]).join('') : ''}&nbsp;</div>)}
        </div>
      </div>
    </aside>
  );
}

export default function About() {
  return (
    <section id="about" className="sec about" aria-label="About">
      <DriftField />
      <div className="about-in">
        <div className="about-text">
          <h2 className="about-h rv">About</h2>
          <div className="about-body">
            {PARAS.map((t, i) => <p className="rv" key={i}>{t}</p>)}
          </div>
        </div>
        <Terminal />
      </div>
    </section>
  );
}
