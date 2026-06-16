import { useState } from 'react';

export default function Nav({ theme, onToggleTheme }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <>
      <nav className="nav">
        <div className="nav-logo">Soumil Malik</div>

        {/* Desktop links */}
        <div className="nav-links">
          <a className="nav-link" href="#about"     onClick={close}>About</a>
          <a className="nav-link" href="#projects"  onClick={close}>Projects</a>
          <a className="nav-link" href="#timeline"  onClick={close}>Experience</a>
          <a className="nav-link" href="#education" onClick={close}>Education</a>
          <a className="nav-link" href="#stack"     onClick={close}>Stack</a>
          <a className="nav-link" href="#skills"    onClick={close}>Skills</a>
          <a className="nav-link" href="#contact"   onClick={close}>Contact</a>
        </div>

        <div className="nav-right">
          {/* Theme toggle */}
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label="Toggle dark mode"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              /* Sun icon */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              /* Moon icon */
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          <a className="nav-cta" href="#contact">Contact Me</a>
          {/* Hamburger — mobile only */}
          <div
            className={`nav-hamburger ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
            role="button"
          >
            <span />
            <span />
            <span />
          </div>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`mobile-menu ${menuOpen ? 'mobile-menu--open' : ''}`}>
        <a className="mobile-menu-link" href="#about"     onClick={close}>About</a>
        <a className="mobile-menu-link" href="#projects"  onClick={close}>Projects</a>
        <a className="mobile-menu-link" href="#timeline"  onClick={close}>Experience</a>
        <a className="mobile-menu-link" href="#education" onClick={close}>Education</a>
        <a className="mobile-menu-link" href="#stack"     onClick={close}>Stack</a>
        <a className="mobile-menu-link" href="#skills"    onClick={close}>Skills</a>
        <a className="mobile-menu-link mobile-menu-link--cta" href="#contact" onClick={close}>Contact</a>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div className="mobile-menu-backdrop" onClick={close} />
      )}
    </>
  );
}
