import { projects } from '../data';

export default function Projects() {
  return (
    <section id="projects" className="section-outer">
      <div className="section-inner">
        <div className="section-label">Selected Projects</div>
        <div className="projects-grid">
          {projects.map((p) => (
            <div className="proj-card" key={p.num}>
              <div className="proj-num">{p.num}</div>
              <div className="proj-name">{p.name}</div>
              <div className="proj-desc">{p.description}</div>
              <div className="proj-tags">
                {(Array.isArray(p.tags) ? p.tags : [p.tags]).map((t) => (
                  <span className="proj-tag" key={t}>{t}</span>
                ))}
              </div>
              <div className="proj-actions">
                {p.github && (
                  <a
                    className="proj-btn proj-btn--code"
                    href={p.github}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    Code
                  </a>
                )}
                {p.live && p.live !== '#' && p.live !== '' && (
                  <a
                    className="proj-btn proj-btn--live"
                    href={p.live}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15,3 21,3 21,9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    Live
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a
            href="https://github.com/SoumilMalik24"
            target="_blank"
            rel="noreferrer"
            className="cta-secondary"
            style={{ textDecoration: 'none', display: 'inline-block' }}
          >
            View all on GitHub ↗
          </a>
        </div>
      </div>
    </section>
  );
}
