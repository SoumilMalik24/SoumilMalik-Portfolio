export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-container">
        <div className="footer-row">
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
              Soumil Malik
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              CS Undergraduate · Agentic AI &amp; LLMOps Engineer · Delhi, India
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
            <a
              href="https://github.com/SoumilMalik24"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}
            >
              GitHub ↗
            </a>
            <a
              href="https://linkedin.com/in/soumilmalik24"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}
            >
              LinkedIn ↗
            </a>
            <a
              href="/resume.pdf"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}
            >
              Resume (PDF) ↗
            </a>
            <a
              href="mailto:soumil4malik@gmail.com"
              style={{ color: 'var(--text-secondary)', transition: 'color 0.2s' }}
            >
              Email ↗
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-tertiary)', flexWrap: 'wrap', gap: '8px' }}>
          <div>© {new Date().getFullYear()} Soumil Malik · All rights reserved</div>
          <div>Built with React 19 &amp; Vite · Minimalist High-Craft UI</div>
        </div>
      </div>
    </footer>
  );
}
