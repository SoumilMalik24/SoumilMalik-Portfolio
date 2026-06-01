const SKILLS = [
  { name: 'LLM Engineering',  pct: 95 },
  { name: 'RAG & Retrieval',  pct: 90 },
  { name: 'Agent Design',     pct: 87 },
  { name: 'Fine-tuning',      pct: 82 },
  { name: 'MLOps / Infra',   pct: 77 },
  { name: 'Python / Backend', pct: 92 },
];

export default function Skills() {
  return (
    <section id="skills" className="section-outer">
      <div className="section-inner">
        <div className="section-label">Proficiency</div>
        <div className="skills-grid">
          {SKILLS.map(({ name, pct }) => (
            <div className="bar-row" key={name}>
              <span className="bar-name">{name}</span>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="bar-val">{pct}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
