import { useState } from 'react';

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  return (
    <>
      <nav className="nav">
        <div className="nav-logo">Soumil Malik</div>

        {/* Desktop links */}
        <div className="nav-links">
          <a className="nav-link" href="#about"    onClick={close}>About</a>
          <a className="nav-link" href="#projects" onClick={close}>Projects</a>
          <a className="nav-link" href="#timeline" onClick={close}>Experience</a>
          <a className="nav-link" href="#stack"    onClick={close}>Stack</a>
          <a className="nav-link" href="#skills"   onClick={close}>Skills</a>
          <a className="nav-link" href="#contact"  onClick={close}>Contact</a>
        </div>

        <div className="nav-right">
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
        <a className="mobile-menu-link" href="#about"    onClick={close}>About</a>
        <a className="mobile-menu-link" href="#projects" onClick={close}>Projects</a>
        <a className="mobile-menu-link" href="#timeline" onClick={close}>Experience</a>
        <a className="mobile-menu-link" href="#stack"    onClick={close}>Stack</a>
        <a className="mobile-menu-link" href="#skills"   onClick={close}>Skills</a>
        <a className="mobile-menu-link mobile-menu-link--cta" href="#contact" onClick={close}>Contact</a>
      </div>

      {/* Backdrop */}
      {menuOpen && (
        <div className="mobile-menu-backdrop" onClick={close} />
      )}
    </>
  );
}
