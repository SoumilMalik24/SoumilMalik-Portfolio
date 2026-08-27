import { experience, education } from '../data';

export default function Timeline() {
  return (
    <section id="timeline" className="section-wrap">
      <div className="site-container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              work_history
            </span>
            <span>Career &amp; Education</span>
          </div>
          <h2 className="section-heading">Experience &amp; Milestones</h2>
          <p className="section-description">
            Industry internships, knowledge distillation research, and academic background.
          </p>
        </div>

        {/* Experience Section */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--accent-indigo)', textTransform: 'uppercase', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="status-dot" />
            <span>Industrial Experience</span>
          </div>

          <div className="timeline-list">
            {experience.map((e, idx) => {
              const tags = Array.isArray(e.tags) ? e.tags : (e.tags ? [e.tags] : []);
              return (
                <div key={idx} className="card card-hover timeline-card">
                  <div className="timeline-pip" />

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {e.title}
                      </h3>
                      <span style={{ fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: 500 }}>
                        {e.company}
                      </span>
                    </div>
                    <span className="badge" style={{ fontSize: '11px' }}>
                      {e.duration}
                    </span>
                  </div>

                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '12px' }}>
                    {e.description}
                  </p>

                  {tags.length > 0 && (
                    <div className="proj-tags-row">
                      {tags.map((t) => (
                        <span key={t} className="proj-tag-pill">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Education Section */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="status-dot" style={{ background: 'var(--accent-cyan)', boxShadow: '0 0 8px var(--accent-cyan)' }} />
            <span>Academic Background</span>
          </div>

          <div className="timeline-list">
            {education.map((ed, idx) => (
              <div key={idx} className="card card-hover timeline-card">
                <div className="timeline-pip" style={{ borderColor: 'var(--accent-cyan)' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {ed.degree}
                    </h3>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {ed.institution}
                    </span>
                  </div>
                  {ed.year && (
                    <span className="badge" style={{ fontSize: '11px' }}>
                      {ed.year}
                    </span>
                  )}
                </div>

                {ed.grade && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-surface)', padding: '3px 8px', borderRadius: 'var(--radius-xs)', marginTop: '4px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                      Score / CGPA:
                    </span>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-primary)' }}>
                      {ed.grade}
                    </strong>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
