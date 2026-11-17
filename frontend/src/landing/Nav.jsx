import { useEffect, useState } from 'react';
import Logo from './Logo';
import { contact, profile } from '../data';

const LINKS = [
  ['#about', 'About'],
  ['#projects', 'Projects'],
  ['#experience', 'Experience'],
  ['#skills', 'Skills'],
  ['#contact', 'Contact'],
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const mq = matchMedia('(min-width: 761px)');
    const onMq = () => { if (mq.matches) setOpen(false); };
    window.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => {
      root.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      mq.removeEventListener('change', onMq);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      {/* className stays static: useLandingFx toggles .dk on this element directly */}
      <nav className="nav" aria-label="Main" data-open={open ? 'true' : 'false'}>
        <a className="mark" href="#hero" aria-label={`${profile.name}, home`} onClick={close}><Logo /></a>
        <div className="links">{LINKS.map(([h, t]) => <a key={h} href={h}>{t}</a>)}</div>
        {/* data-cursor-label: the custom cursor ring shows this text on hover */}
        <a className="nav-cv" href={contact.resume} target="_blank" rel="noopener noreferrer"
          aria-label="Resume (PDF, opens in a new tab)" data-cursor-label="Resume">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M10.5 2H5a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 5 16h8a1.5 1.5 0 0 0 1.5-1.5V6m-4-4 4 4m-4-4v4h4M6.5 9.5h5m-5 3h5"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
        <button
          type="button"
          className="menu-btn"
          aria-expanded={open}
          aria-controls="nav-ov"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <span /><span />
        </button>
      </nav>
      <div id="nav-ov" className="nav-ov" data-open={open ? 'true' : 'false'} aria-hidden={!open} inert={!open}>
        <ul>
          {LINKS.map(([h, t], i) => (
            <li key={h} style={{ '--i': i }}><a href={h} onClick={close}>{t}</a></li>
          ))}
        </ul>
      </div>
    </>
  );
}
