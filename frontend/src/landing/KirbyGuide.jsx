import { useEffect, useRef, useState } from 'react';
import { createAvatar } from '@bible-strong/avatar-react';
import kirby from '../assets/kirby.avatar.json';
import askKirby from './kirbyAgent';
import { firstName, kirby as kirbyContent } from '../data';

const Kirby = createAvatar(kirby);
const NAME = kirbyContent.name;

/* Tour lines are plain text from the admin; `**x**` becomes bold. Never rendered as HTML. */
function markup(line) {
  return line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <b key={i}>{part.slice(2, -2)}</b> : part);
}

/* Per section: what Kirby does and the one-liners it says (cycled one at a time). Order = page order. */
const ORDER = ['hero', 'about', 'projects', 'experience', 'contact'];
const SECTIONS = Object.fromEntries(ORDER.map((id) => {
  const t = kirbyContent.tour[id] || {};
  return [id, { state: t.state || 'happy', face: t.face || undefined, lines: (t.lines || []).map(markup) }];
}));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/* Where Kirby perches in About (button centre, viewport px): on top of the terminal
   box on desktop, beside the "About" heading on phones. */
function perchPoint() {
  if (matchMedia('(max-width: 760px)').matches) {
    const h = document.querySelector('#about .about-h');
    if (!h) return null;
    const range = document.createRange();
    range.selectNodeContents(h);
    const r = range.getBoundingClientRect();
    return { x: Math.min(r.right + 44, innerWidth - 40), y: r.top + r.height / 2 };
  }
  const term = document.querySelector('#about .term');
  if (!term) return null;
  const r = term.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top - 30 };
}
const LINE_MS = 3200;

export default function KirbyGuide() {
  const [section, setSection] = useState('hero');
  const [lineIdx, setLineIdx] = useState(0);
  const [quiet, setQuiet] = useState(false);
  // Chat with the agent.
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState(null); // { reply, mood }
  const history = useRef([]);
  const convId = useRef(null);
  const inputRef = useRef(null);
  const ref = useRef(null);
  const current = useRef('hero');
  const rootRef = useRef(null);
  const btnRef = useRef(null);
  const [arrived, setArrived] = useState(false);

  // Intro: fly from the nav logo down to the corner.
  useEffect(() => {
    const btn = btnRef.current;
    const logo = document.querySelector('.nav .mark');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!btn || !logo || reduce || !btn.animate) {
      const t = setTimeout(() => setArrived(true), 0);
      return () => clearTimeout(t);
    }
    const a = logo.getBoundingClientRect();
    const b = btn.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const anim = btn.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(.4) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${dx}px, ${dy}px) scale(.5) rotate(0deg)`, opacity: 1, offset: 0.08 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.15}px) scale(.85) rotate(240deg)`, offset: 0.55 },
        { transform: 'translate(0, -18px) scale(1.05) rotate(360deg)', offset: 0.85 },
        { transform: 'translate(0, 0) scale(1) rotate(360deg)', opacity: 1 },
      ],
      { duration: 1700, delay: 1000, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'backwards' },
    );
    anim.onfinish = () => {
      setArrived(true);
      ref.current?.poke('bounce');
    };
    return () => anim.cancel();
  }, []);

  // Perch in About; fly back to the corner when leaving, opening the chat,
  // or once the perch scrolls out of view. Runs on rAF so it follows scrolling.
  const dock = useRef({ t: 0, x: 0, y: 0, tx: 0, ty: 0, raf: 0, want: false });
  useEffect(() => {
    const d = dock.current;
    d.want = section === 'about' && arrived && !open;
    if (d.raf || (!d.want && d.t === 0)) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const root = rootRef.current;
      const btn = btnRef.current;
      if (!root || !btn) { d.raf = 0; return; }
      const p = perchPoint();
      if (p) { d.tx = p.x; d.ty = p.y; }
      const visible = p && p.y > 110 && p.y < innerHeight - 60;
      const goal = d.want && visible ? 1 : 0;
      if (reduce) d.t = goal;
      else d.t = goal > d.t ? Math.min(1, d.t + dt / 900) : Math.max(0, d.t - dt / 700);
      const r = btn.getBoundingClientRect();
      const hx = r.left + r.width / 2 - d.x;
      const hy = r.top + r.height / 2 - d.y;
      const e = ease(d.t);
      d.x = (d.tx - hx) * e;
      d.y = (d.ty - hy) * e;
      root.style.transform = d.t ? `translate(${d.x}px, ${d.y}px)` : '';
      root.classList.toggle('kirby--perched', d.t === 1);
      if (!d.want && d.t === 0) { d.x = 0; d.y = 0; d.raf = 0; return; }
      d.raf = requestAnimationFrame(tick);
    };
    d.raf = requestAnimationFrame(tick);
  }, [section, open, arrived]);
  useEffect(() => {
    const d = dock.current;
    return () => { cancelAnimationFrame(d.raf); d.raf = 0; };
  }, []);

  // While the page scrolls, fade the bubble so it never hides what is being read.
  useEffect(() => {
    let t;
    const onScroll = () => {
      rootRef.current?.classList.add('kirby--scrolling');
      clearTimeout(t);
      t = setTimeout(() => rootRef.current?.classList.remove('kirby--scrolling'), 450);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(t); };
  }, []);

  // Track which section is in the middle of the viewport.
  useEffect(() => {
    const els = ORDER.map((id) => document.getElementById(id)).filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (!hit) return;
        if (current.current === hit.target.id) return;
        current.current = hit.target.id;
        setSection(hit.target.id);
        setLineIdx(0);
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // New section: give a little bounce.
  useEffect(() => {
    ref.current?.poke(section === 'experience' ? 'nod' : 'bounce');
  }, [section]);

  // Cycle through the section's lines once, then hide the bubble (lineIdx past the end).
  const lines = SECTIONS[section].lines;
  useEffect(() => {
    if (!arrived || quiet || open || lineIdx >= lines.length) return;
    const t = setTimeout(() => setLineIdx((i) => i + 1), LINE_MS);
    return () => clearTimeout(t);
  }, [lineIdx, lines, quiet, open, arrived]);

  // Chat open: focus the input, Escape closes it.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = async (e) => {
    e.preventDefault();
    const q = input.trim().slice(0, 1000);
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    setAnswer(null);
    history.current = [...history.current, { role: 'user', content: q }].slice(-20);
    const res = await askKirby({ messages: history.current, conversationId: convId.current, currentSection: current.current });
    convId.current = res.conversation_id || convId.current;
    history.current = [...history.current, { role: 'assistant', content: res.reply }].slice(-20);
    setBusy(false);
    setAnswer({ reply: res.reply, mood: res.mood });
    if (res.section === 'contact') {
      // The footer is a sticky "curtain" pinned behind the page, so scrollIntoView does nothing for it: scroll to the page end.
      const end = document.documentElement.scrollHeight - window.innerHeight;
      if (end - window.scrollY > 8) window.scrollTo({ top: end, behavior: 'smooth' });
      else ref.current?.poke('nod');
    } else if (res.section && res.section !== current.current) {
      document.getElementById(res.section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      ref.current?.poke('nod');
    }
  };

  // Chat states win over the tour's.
  const tour = SECTIONS[section];
  let state = tour.state;
  let face = tour.face;
  if (busy) { state = 'thinking'; face = undefined; }
  else if (open && answer) { state = answer.mood || 'happy'; face = undefined; }
  else if (open) { state = 'listening'; face = undefined; }

  let say = quiet || !arrived ? null : lines[lineIdx] ?? null;
  if (open) say = busy ? 'Hmm, let me think…' : answer ? answer.reply : `Ask me anything about ${firstName}!`;

  const onClick = () => {
    setQuiet(false);
    setOpen((o) => !o);
    ref.current?.poke('spin');
  };

  return (
    <aside ref={rootRef} className={`kirby${open ? ' kirby--open' : ''}`} aria-label="Site guide">
      {/* screen readers hear chat answers only, not the rotating tour lines; this region stays mounted so updates are announced */}
      <p className="sr-only" role="status">{open && !busy && answer ? answer.reply : ''}</p>
      {say && (
        <p className="kirby-say" key={open ? `a-${busy}-${answer?.reply}` : `${section}-${lineIdx}`}>
          {say}
          {!open && <button className="kirby-x" onClick={() => setQuiet(true)} aria-label="Hide Kirby's messages">×</button>}
        </p>
      )}
      {open && (
        <form className="kirby-ask" onSubmit={ask}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={1000}
            placeholder={`Ask about ${firstName}…`}
            aria-label={`Ask ${NAME} about ${firstName}`}
            disabled={busy}
          />
          <button type="submit" disabled={busy || !input.trim()} aria-label="Send">↑</button>
        </form>
      )}
      <button
        ref={btnRef}
        className="kirby-btn"
        onClick={onClick}
        aria-expanded={open}
        aria-label={open ? `Close chat with ${NAME}` : `${NAME}, your guide. Click to ask about ${firstName}.`}
      >
        <Kirby ref={ref} state={state} face={face} emphasis={!open && section === 'experience'} followPointer size={64} ariaLabel={NAME} />
      </button>
    </aside>
  );
}
