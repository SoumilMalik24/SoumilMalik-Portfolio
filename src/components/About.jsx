export default function About() {
  return (
    <section id="about" className="section-outer">
      <div className="section-inner">
        <div className="section-label">Profile</div>
        <div className="profile-grid">
          <div className="profile-bio">
            <h2>Building AI that<br /><em>actually works</em> in prod.</h2>
            <p>
              I'm Soumil Malik — a CS undergraduate specializing in Agentic AI and LLMOps based in Delhi, India.
              I focus on building autonomous multi-agent systems, distributed AI backends, and production RAG pipelines.
            </p>
            <p>
              Proficient across the full GenAI stack, my work spans LangGraph, CrewAI, MCP, LangSmith, and async task queues. 
              I care deeply about creating AI that reasons, acts, and delivers structured outputs beyond simple chat.
            </p>
          </div>
          <div className="profile-info">
            {[
              { k: 'Location', v: 'Delhi, India' },
              { k: 'Phone',    v: '+91 9650799486' },
              { k: 'Focus',    v: 'Agentic AI · LLMOps' },
              { k: 'Email',    v: 'soumil4malik@gmail.com' },
              { k: 'Status',   v: 'Open to Work', green: true },
            ].map(({ k, v, green }) => (
              <div className="info-row" key={k}>
                <span className="info-key">{k}</span>
                <span className="info-val" style={green ? { color: '#8ab07a' } : {}}>
                  {v}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
