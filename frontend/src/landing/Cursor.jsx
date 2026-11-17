import { useEffect, useRef, useState } from 'react';

const FINE = '(hover: hover) and (pointer: fine)';
const INTERACTIVE = 'a, button, label, input, [role="button"]';

/* dot follows the pointer exactly, ring trails it; both react to what is underneath.
   Elements with data-cursor-label get the label written inside the ring. */
export default function Cursor() {
  const [enabled] = useState(() => window.matchMedia && matchMedia(FINE).matches);
  const dot = useRef(null);
  const ring = useRef(null);
  const lab = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.documentElement;
    let x = -100, y = -100, rx = -100, ry = -100, raf = 0, seen = false;

    const setMode = (target) => {
      const el = target instanceof Element ? target : null;
      const labelled = el && el.closest('[data-cursor-label]');
      const mode = el && el.closest('[data-on="1"]') ? 'portrait'
        : labelled ? 'label'
        : el && el.closest(INTERACTIVE) ? 'link' : '';
      if (labelled) lab.current.textContent = labelled.getAttribute('data-cursor-label');
      if (root.dataset.cursor !== mode) root.dataset.cursor = mode;
    };

    /* runs only while the ring is still catching up, so an idle pointer costs nothing */
    const tick = () => {
      const k = rm ? 1 : 0.18;
      rx += (x - rx) * k; ry += (y - ry) * k;
      if (Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1) { rx = x; ry = y; }
      dot.current.style.transform = `translate3d(${x}px,${y}px,0)`;
      ring.current.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      raf = rx === x && ry === y ? 0 : requestAnimationFrame(tick);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const onMove = (e) => {
      x = e.clientX; y = e.clientY;
      if (!seen) { seen = true; rx = x; ry = y; root.classList.add('cur-on'); }
      setMode(e.target);
      wake();
    };
    const onLeave = () => { seen = false; root.classList.remove('cur-on'); };
    const onDown = () => root.classList.add('cur-down');
    const onUp = () => root.classList.remove('cur-down');

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      root.classList.remove('cur-on', 'cur-down');
      delete root.dataset.cursor;
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <div className="cur-ring" ref={ring} aria-hidden="true"><span className="cur-lab" ref={lab} /></div>
      <div className="cur-dot" ref={dot} aria-hidden="true"></div>
    </>
  );
}
