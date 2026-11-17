import { useState } from 'react';
import { contact, firstName, profile } from '../data';

/* Closing section: a dark footer card that sits behind the page (position: sticky) and is
   uncovered "curtain style" as Skills scrolls away. Content is a bento grid of rounded tiles. */

const EMAIL = contact.email;
const LINKS = {
  github: contact.github,
  linkedin: contact.linkedin,
  resume: contact.resume,
  mail: `mailto:${EMAIL}?subject=${encodeURIComponent(`Hello ${firstName}`)}`,
};

const Arrow = ({ d = 'up' }) => (
  <svg className={`ft-arr ft-arr--${d}`} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d={d === 'down' ? 'M9 3v11m0 0l-4.5-4.5M9 14l4.5-4.5' : 'M5 13L13 5m0 0H6.5M13 5v6.5'}
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Contact() {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(EMAIL);
    } catch {
      const t = document.createElement('textarea');
      t.value = EMAIL; t.setAttribute('readonly', '');
      t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <footer id="contact" className="ft" aria-label="Contact">
      <div className="ft-card">
        <div className="ft-grid">
          <div className="ft-tile ft-main">
            <h2 className="ft-h">Let’s build<br />something<span>.</span></h2>
            <div className="ft-mailrow">
              <a className="ft-pill ft-pill--solid" href={LINKS.mail}>{EMAIL}</a>
              <button type="button" className="ft-pill ft-copy" onClick={copy} aria-label="Copy email address">
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
              <span className="sr-only" role="status">{copied ? 'Email copied' : ''}</span>
            </div>
          </div>

          <a className="ft-tile ft-link ft-gh" href={LINKS.github} target="_blank" rel="noopener noreferrer">
            <span className="ft-lab">GitHub</span><Arrow />
          </a>
          <a className="ft-tile ft-link ft-li" href={LINKS.linkedin} target="_blank" rel="noopener noreferrer">
            <span className="ft-lab">LinkedIn</span><Arrow />
          </a>
          <a className="ft-tile ft-link ft-cv" href={LINKS.resume} target="_blank" rel="noopener noreferrer">
            <span className="ft-lab">Resume</span><Arrow d="down" />
          </a>
          <div className="ft-tile ft-loc">
            <span className="ft-sub">Based in</span>
            <span className="ft-lab">{profile.location}</span>
          </div>

          <a className="ft-tile ft-link ft-msg" href={LINKS.mail}>
            <span className="ft-lab">Send a message</span>
            <svg className="ft-arr ft-arr--right" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M4 11h14m0 0l-5-5m5 5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <div className="ft-bar">
          <span>© {new Date().getFullYear()} {profile.name}</span>
          <a href="#hero">Back to top ↑</a>
        </div>
        <svg className="ft-word" viewBox="0 0 1000 118" aria-hidden="true" focusable="false">
          <text x="10" y="150" fontSize="200" textLength="980" lengthAdjust="spacingAndGlyphs">{profile.name.toUpperCase()}</text>
        </svg>
      </div>
    </footer>
  );
}
