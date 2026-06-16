import useInView from '../hooks/useInView';

const SKILLS = [
  { name: 'LLM Engineering',  pct: 85 },
  { name: 'RAG & Retrieval',  pct: 90 },
  { name: 'Agent Design',     pct: 89 },
  { name: 'MLOps / Infra',    pct: 80 },
  { name: 'Python / Backend', pct: 90 },
];

export default function Skills() {
  const [ref, inView] = useInView();
  return (
    <section id="skills" className={`section-outer ${inView ? 'in-view' : ''}`} ref={ref}>
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
