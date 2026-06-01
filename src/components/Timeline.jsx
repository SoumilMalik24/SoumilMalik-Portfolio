import { experience, education } from '../data';

export default function Timeline() {
  return (
    <section id="timeline" className="section-outer">
      <div className="section-inner">
        {/* Experience */}
        <div className="section-label">Experience</div>
        <div className="timeline">
          {experience.map((e, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-marker">
                <div className="tl-dot" />
                {i < experience.length - 1 && <div className="tl-line" />}
              </div>
              <div className="tl-body">
                <div className="tl-meta">
                  <span className="tl-type">{e.type}</span>
                  <span className="tl-duration">{e.duration}</span>
                </div>
                <div className="tl-title">{e.title}</div>
                <div className="tl-company">{e.company}</div>
                <div className="tl-desc">{e.description}</div>
                {e.tags?.length > 0 && (
                  <div className="proj-tags" style={{ marginTop: 10 }}>
                    {(Array.isArray(e.tags) ? e.tags : [e.tags]).map((t) => (
                      <span className="proj-tag" key={t}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Education */}
        <div className="section-label" style={{ marginTop: 56 }}>Education</div>
        <div className="timeline">
          {education.map((ed, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-marker">
                <div className="tl-dot tl-dot--edu" />
                {i < education.length - 1 && <div className="tl-line" />}
              </div>
              <div className="tl-body">
                <div className="tl-meta">
                  <span className="tl-type tl-type--edu">Education</span>
                  <span className="tl-duration">{ed.year}</span>
                </div>
                <div className="tl-title">{ed.degree}</div>
                <div className="tl-company">{ed.institution}</div>
                {ed.grade && <div className="tl-grade">{ed.grade}</div>}
                {ed.description && <div className="tl-desc">{ed.description}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
