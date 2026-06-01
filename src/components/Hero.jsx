export default function Hero() {
  return (
    <section className="hero">
      <div className="hero-left">
        <div className="hero-eyebrow">AI &amp; Machine Learning Engineer</div>
        <h1 className="hero-h1">
          Building<br />
          systems that<br />
          <em>think</em> and<br />
          last.
        </h1>
        <p className="hero-deck">
          CS undergraduate specializing in Agentic AI and LLMOps — building
          autonomous multi-agent systems, distributed AI backends, and
          production RAG pipelines.
        </p>
        <div className="hero-ctas">
          <a href="#projects" className="cta-primary" style={{ textDecoration: 'none', textAlign: 'center' }}>
            View Projects
          </a>
          <a href="/resume.pdf" target="_blank" rel="noreferrer" className="cta-secondary" style={{ textDecoration: 'none', textAlign: 'center' }}>
            Resume ↗
          </a>
        </div>
      </div>

      <div className="hero-stats">
        <div className="hero-stat-item">
          <div className="stat-number">8.62</div>
          <div className="stat-label">CGPA</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-number">7+</div>
          <div className="stat-label">Certifications</div>
        </div>
        <div className="hero-stat-item">
          <div className="stat-number">1</div>
          <div className="stat-label">Publication</div>
        </div>
      </div>
    </section>
  );
}
