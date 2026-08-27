import { useState } from 'react';
import { projects } from '../data';
import ProjectModal from './ProjectModal';

export default function Projects() {
  const [filter, setFilter] = useState('all');
  const [selectedProject, setSelectedProject] = useState(null);

  const enrichedProjects = projects.map((p, idx) => ({
    ...p,
    num: (idx + 1).toString().padStart(2, '0')
  }));

  const filtered = enrichedProjects.filter(p => {
    if (filter === 'all') return true;
    const str = (Array.isArray(p.tags) ? p.tags.join(' ') : p.tags) + ' ' + p.name + ' ' + p.description;
    if (filter === 'multi-agent') return str.includes('LangGraph') || str.includes('CrewAI');
    if (filter === 'mcp') return str.includes('MCP');
    if (filter === 'mlops') return str.includes('MLOps') || str.includes('AWS') || str.includes('Docker');
    return true;
  });

  return (
    <section id="projects" className="section-wrap">
      <div className="site-container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              terminal
            </span>
            <span>Production AI Architectures</span>
          </div>
          <h2 className="section-heading">Selected AI Systems &amp; Projects</h2>
          <p className="section-description">
            Production multi-agent swarms, FastMCP microservices, and distributed AI infrastructure engineered for reliability.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="projects-filter-bar">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Systems ({enrichedProjects.length})
          </button>
          <button
            className={`filter-btn ${filter === 'multi-agent' ? 'active' : ''}`}
            onClick={() => setFilter('multi-agent')}
          >
            Multi-Agent (LangGraph/CrewAI)
          </button>
          <button
            className={`filter-btn ${filter === 'mcp' ? 'active' : ''}`}
            onClick={() => setFilter('mcp')}
          >
            FastMCP Microservices
          </button>
          <button
            className={`filter-btn ${filter === 'mlops' ? 'active' : ''}`}
            onClick={() => setFilter('mlops')}
          >
            MLOps &amp; Infrastructure
          </button>
        </div>

        {/* Projects Grid */}
        <div className="projects-grid">
          {filtered.map((p) => {
            const tags = Array.isArray(p.tags) ? p.tags : [p.tags];
            return (
              <div
                key={p.name}
                className="card card-hover proj-card"
                onClick={() => setSelectedProject(p)}
                style={{ cursor: 'pointer' }}
              >
                <div className="proj-top">
                  <span className="proj-num">0{p.num}</span>
                  <span className="badge badge-emerald">
                    <span className="status-dot" />
                    <span>Production Ready</span>
                  </span>
                </div>

                <div>
                  <h3 className="proj-title">{p.name}</h3>
                  <p className="proj-desc" style={{ marginTop: '8px' }}>
                    {p.description}
                  </p>
                </div>

                <div className="proj-tags-row">
                  {tags.map((t) => (
                    <span key={t} className="proj-tag-pill">
                      {t}
                    </span>
                  ))}
                </div>

                <div className="proj-links-row" onClick={e => e.stopPropagation()}>
                  {p.github && (
                    <a
                      href={p.github}
                      target="_blank"
                      rel="noreferrer"
                      className="proj-link-btn"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                        code
                      </span>
                      <span>GitHub Code</span>
                    </a>
                  )}
                  {p.live && p.live !== '#' && p.live !== '' && (
                    <a
                      href={p.live}
                      target="_blank"
                      rel="noreferrer"
                      className="proj-link-btn"
                      style={{ color: 'var(--accent-cyan)' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                        open_in_new
                      </span>
                      <span>Live Deployment ↗</span>
                    </a>
                  )}
                  <button
                    onClick={() => setSelectedProject(p)}
                    className="proj-link-btn"
                    style={{ marginLeft: 'auto', color: 'var(--text-tertiary)' }}
                  >
                    <span>Inspect Details ➔</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* GitHub Direct Link Banner */}
        <div
          className="card"
          style={{
            marginTop: '28px',
            padding: '20px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
              Looking for more repositories and Jupyter experiments?
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Explore Soumil&apos;s full open-source portfolio, evaluation harnesses, and benchmarks on GitHub.
            </div>
          </div>

          <a
            href="https://github.com/SoumilMalik24"
            target="_blank"
            rel="noreferrer"
            className="btn-outline"
          >
            <span>GitHub Profile (@SoumilMalik24) ↗</span>
          </a>
        </div>
      </div>

      <ProjectModal
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </section>
  );
}
