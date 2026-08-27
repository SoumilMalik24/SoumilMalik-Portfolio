import { useState } from 'react';

export default function Nav({ theme, onToggleTheme, onOpenCmd }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="nav-header">
      <div className="site-container nav-container">
        {/* Brand */}
        <a href="#hero" className="brand-link">
          <span>Soumil Malik</span>
          <span className="brand-chip">AI &amp; LLMOps</span>
        </a>

        {/* Desktop Menu */}
        <nav className="nav-menu">
          <a href="#hero" className="menu-link">Overview</a>
          <a href="#dag-studio" className="menu-link">Architecture</a>
          <a href="#projects" className="menu-link">Systems</a>
          <a href="#skills" className="menu-link">Stack</a>
          <a href="#about" className="menu-link">Bio</a>
          <a href="#timeline" className="menu-link">Experience</a>
          <a href="#contact" className="menu-link">Contact</a>
        </nav>

        {/* Right Actions */}
        <div className="nav-right-actions">
          <button
            className="icon-btn"
            onClick={onOpenCmd}
            title="Command Palette (Cmd+K)"
            aria-label="Open Command Palette"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
              search
            </span>
          </button>

          <button
            className="icon-btn"
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                light_mode
              </span>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>
                dark_mode
              </span>
            )}
          </button>

          <a href="/resume.pdf" target="_blank" rel="noreferrer" className="btn-outline" style={{ padding: '6px 14px', fontSize: '12px' }}>
            <span>Resume</span>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
              north_east
            </span>
          </a>

          {/* Mobile Hamburger */}
          <button
            className="icon-btn"
            style={{ display: 'none' }}
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle Navigation"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
