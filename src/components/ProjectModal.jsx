import { useEffect } from 'react';

export default function ProjectModal({ project, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!project) return null;

  const tags = Array.isArray(project.tags) ? project.tags : [project.tags];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(9, 10, 15, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: '640px',
          width: '100%',
          padding: '28px',
          position: 'relative',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            color: 'var(--text-secondary)',
            fontSize: '18px',
          }}
          aria-label="Close modal"
        >
          ✕
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span className="badge badge-indigo">SYS_0{project.num}</span>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Production Architecture
          </span>
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
          {project.name}
        </h2>

        <div className="proj-tags-row" style={{ marginBottom: '18px' }}>
          {tags.map((t) => (
            <span key={t} className="badge badge-cyan" style={{ fontSize: '11px' }}>
              {t}
            </span>
          ))}
        </div>

        <div style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
            Architecture Breakdown
          </div>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            {project.description}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {project.github && (
            <a
              href={project.github}
              target="_blank"
              rel="noreferrer"
              className="btn-solid"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                code
              </span>
              <span>View GitHub Repository</span>
            </a>
          )}
          {project.live && project.live !== '#' && project.live !== '' && (
            <a
              href={project.live}
              target="_blank"
              rel="noreferrer"
              className="btn-outline"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                open_in_new
              </span>
              <span>Open Live Demo ↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
