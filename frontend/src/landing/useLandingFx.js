import { useEffect } from 'react';

const GL = '01<>/\\|#%&@$*+=?!';

/* scroll reveal, text scramble, and the nav's light/dark tone over the dark section */
export default function useLandingFx() {
  useEffect(() => {
    const rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function scr(el, dur) {
      if (rm) return;
      let fin = el.getAttribute('data-t');
      if (!fin) { fin = el.textContent; el.setAttribute('data-t', fin); }
      cancelAnimationFrame(el._r);
      const t0 = performance.now();
      (function step() {
        const k = (performance.now() - t0) / dur;
        if (k >= 1) { el.textContent = fin; el.style.color = ''; return; }
        let o = '';
        for (let i = 0; i < fin.length; i++) o += (fin[i] === ' ' || i < k * fin.length) ? fin[i] : GL[(Math.random() * GL.length) | 0];
        el.textContent = o; el.style.color = 'var(--hot)'; el._r = requestAnimationFrame(step);
      })();
    }

    const io = ('IntersectionObserver' in window && !rm) ? new IntersectionObserver((es) => {
      es.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        const h = e.target.hasAttribute('data-scr') ? e.target : e.target.querySelector('[data-scr]');
        if (h) scr(h, 700);
        io.unobserve(e.target);
      });
    }, { threshold: 0.25 }) : null;
    document.querySelectorAll('.rv').forEach((el) => { if (io) io.observe(el); else el.classList.add('in'); });

    const navEl = document.querySelector('.nav'), dk = document.querySelector('.dark');
    function navTone() { const r = dk.getBoundingClientRect(); navEl.classList.toggle('dk', r.top <= 30 && r.bottom >= 30); }
    window.addEventListener('scroll', navTone, { passive: true });
    navTone();

    return () => {
      if (io) io.disconnect();
      window.removeEventListener('scroll', navTone);
    };
  }, []);
}
