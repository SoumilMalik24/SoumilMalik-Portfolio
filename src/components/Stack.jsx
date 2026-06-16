import { stack } from '../data';
import useInView from '../hooks/useInView';

export default function Stack() {
  const [ref, inView] = useInView();
  return (
    <section id="stack" className={`section-outer ${inView ? 'in-view' : ''}`} ref={ref}>
      <div className="section-inner">
        <div className="section-label">Tech Stack</div>
        <div className="stack-grid">
          {stack.map((group) => (
            <div className="stack-group" key={group.group}>
              <div className="stack-group-label">{group.group}</div>
              <div className="stack-pills">
                {(Array.isArray(group.pills) ? group.pills : [group.pills]).map((pill) => (
                  <span
                    className="pill"
                    key={pill}
                    style={{ background: group.bg, color: group.text }}
                  >
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
