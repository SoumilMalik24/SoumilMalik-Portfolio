import { useEffect, useRef, useState } from 'react';

/*
 * Box Showcase — projects as cards standing in an open 3D box (pure CSS 3D).
 * Hover lifts a card, click pulls it out and shows its details underneath.
 * The scene is built at a fixed design size and scaled to fit its container.
 */

const DESIGN_W = 860;
const DESIGN_H = 680;
const L = 700; // box length (x)
const D = 300; // box depth (z)
const H = 100; // wall height (y)
const CW = 260; // card width
const CH = 170; // card height

const MOBILE_Q = '(max-width: 640px)';

const HUES = [
  ['#ff7a45', '#e8421c'],
  ['#4aa8ff', '#1c5bff'],
  ['#ff5a5f', '#c41e3a'],
  ['#c27bff', '#6a3dff'],
  ['#2fd0a0', '#0e7f66'],
  ['#ffd25a', '#d98a00'],
];

export default function BoxShowcase({ items }) {
  const wrapRef = useRef(null);
  const sceneRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [hover, setHover] = useState(null);
  const [active, setActive] = useState(null);
  /* reduced motion: the box starts open and settled, no lid animation */
  const [reduce] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [open, setOpen] = useState(reduce);
  const [settled, setSettled] = useState(reduce);
  const trackRef = useRef(null);
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_Q).matches);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_Q);
    const f = () => setMobile(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || mobile || reduce) return undefined;
    let t;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setOpen(true);
      t = setTimeout(() => setSettled(true), 2200);
      io.disconnect();
    }, { threshold: 0.45 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [mobile, reduce]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || mobile) return undefined;
    const fit = () => setScale(Math.min(1, el.clientWidth / DESIGN_W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobile]);

  const onMove = (e) => {
    const s = sceneRef.current;
    if (!s || reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    s.style.setProperty('--ry', `${px * 12}deg`);
    s.style.setProperty('--rx', `${py * -8}deg`);
  };
  const onLeave = () => {
    const s = sceneRef.current;
    if (!s) return;
    s.style.setProperty('--ry', '0deg');
    s.style.setProperty('--rx', '0deg');
    setHover(null);
  };

  const n = items.length;
  const gap = Math.min(112, (L - 120) / Math.max(n - 1, 1));
  const x0 = -((n - 1) * gap) / 2;
  const sel = active != null ? items[active] : null;
  const toggle = (i) => setActive((a) => (a === i ? null : i));

  /* phones: swipeable card row instead of the 3D box; the centred card is the selected one */
  const cur = active ?? 0;
  const onTrackScroll = (e) => {
    const t = e.currentTarget;
    const cards = t.children;
    if (!cards.length) return;
    const inset = parseFloat(getComputedStyle(t).paddingLeft) || 0;
    let best = 0, bd = Infinity;
    for (let i = 0; i < cards.length; i++) {
      const d = Math.abs(cards[i].offsetLeft - inset - t.scrollLeft);
      if (d < bd) { bd = d; best = i; }
    }
    if (t.scrollLeft >= t.scrollWidth - t.clientWidth - 2) best = cards.length - 1;
    setActive((a) => (a === best ? a : best));
  };
  const goTo = (i) => {
    const t = trackRef.current;
    const c = t && t.children[i];
    if (!c) return;
    const inset = parseFloat(getComputedStyle(t).paddingLeft) || 0;
    t.scrollTo({ left: c.offsetLeft - inset, behavior: 'smooth' });
    setActive(i);
  };
  const detail = (it) => (
    <div className="bx-detail" key={it.name}>
      <h3>{it.name}</h3>
      <p>{it.description}</p>
      <div className="bx-tags">
        {it.tags.map((t) => <span key={t}>{t}</span>)}
      </div>
      <div className="bx-links">
        {it.github && <a href={it.github} target="_blank" rel="noopener noreferrer">Code ↗</a>}
        {it.live && it.live !== '#' && (
          <a href={it.live} target="_blank" rel="noopener noreferrer">Live ↗</a>
        )}
      </div>
    </div>
  );

  if (mobile) {
    return (
      <div className="bx bxm">
        <ul className="bxm-track" ref={trackRef} onScroll={onTrackScroll} aria-label="Projects">
          {items.map((it, i) => {
            const [c1, c2] = HUES[i % HUES.length];
            return (
              <li key={it.name}>
                <button
                  type="button"
                  className={`bxm-card${cur === i ? ' on' : ''}`}
                  style={{
                    background: it.image
                      ? `center/cover url(${it.image})`
                      : `linear-gradient(155deg, ${c1}, ${c2})`,
                  }}
                  aria-pressed={cur === i}
                  aria-label={`${it.name}, project ${i + 1} of ${n}`}
                  onClick={() => goTo(i)}
                >
                  <span className="bx-c-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="bx-c-name">{it.name}</span>
                  <span className="bx-c-tags">{it.tags.slice(0, 3).join(' · ')}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="bxm-dots" role="group" aria-label="Choose project">
          {items.map((it, i) => (
            <button
              type="button"
              key={it.name}
              className={cur === i ? 'on' : ''}
              aria-label={`Show ${it.name}`}
              aria-current={cur === i}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <div className="bx-panel" aria-live="polite">{items[cur] && detail(items[cur])}</div>
      </div>
    );
  }

  return (
    <div className="bx">
      <div
        ref={wrapRef}
        className="bx-stage"
        style={{ height: DESIGN_H * scale }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        <div
          className="bx-canvas"
          style={{ width: DESIGN_W, height: DESIGN_H, transform: `translateX(-50%) scale(${scale})` }}
        >
          <div className="bx-shadow" />
          <div
            ref={sceneRef}
            className={`bx-scene${open ? ' open' : ''}`}
            style={{ '--L': `${L}px`, '--D': `${D}px`, '--H': `${H}px` }}
          >
            <div className="bx-f bx-floor" />
            <div className="bx-f bx-back" />
            <div className="bx-f bx-right" />
            <div className="bx-f bx-lid"><span /></div>

            {items.map((it, i) => {
              const [c1, c2] = HUES[i % HUES.length];
              const isActive = active === i;
              const lift = !open ? -(CH - H + 15) : isActive ? 150 : hover === i ? 46 : 0;
              const y = H / 2 - CH / 2 - lift;
              const x = x0 + i * gap + (isActive ? -26 : 0);
              const lean = isActive ? 0 : 6;
              return (
                <button
                  type="button"
                  key={it.name}
                  className={`bx-card${isActive ? ' on' : ''}`}
                  style={{
                    width: CW,
                    height: CH,
                    marginLeft: -CW / 2,
                    marginTop: -CH / 2,
                    background: it.image
                      ? `center/cover url(${it.image})`
                      : `linear-gradient(155deg, ${c1}, ${c2})`,
                    clipPath: `inset(0 0 ${open ? 0 : CH - H + 15}px 0 round 12px)`,
                    transitionDelay: settled ? '0ms' : `${700 + i * 110}ms`,
                    transitionDuration: settled ? undefined : '.8s',
                    transitionTimingFunction: settled ? undefined : 'cubic-bezier(.3,1.5,.5,1)',
                    transform: `translate3d(${x}px, ${y}px, 0) rotateZ(${lean}deg) rotateY(-90deg)`,
                  }}
                  aria-pressed={isActive}
                  aria-label={`${it.name} — ${isActive ? 'close details' : 'show details'}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover((h) => (h === i ? null : h))}
                  onClick={() => toggle(i)}
                >
                  <span className="bx-c-n">{String(i + 1).padStart(2, '0')}</span>
                  <span className="bx-c-name">{it.name}</span>
                  <span className="bx-c-tags">{it.tags.slice(0, 3).join(' · ')}</span>
                </button>
              );
            })}

            <div className="bx-f bx-left" />
            <div className="bx-f bx-front"><span>Things I built</span></div>
          </div>
        </div>
      </div>

      <div className="bx-panel" aria-live="polite">
        {sel ? detail(sel) : (
          <p className="bx-hint">Pick a card from the box.</p>
        )}
      </div>

      <ul className="bx-list">
        {items.map((it, i) => (
          <li key={it.name}>
            <button
              type="button"
              className={active === i ? 'on' : ''}
              onClick={() => toggle(i)}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="n" style={{ color: HUES[i % HUES.length][0] }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <b>{it.name}</b>
              <small>{it.tags.slice(0, 2).join(' · ')}</small>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
