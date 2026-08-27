const RESEARCH_TOPICS = [
  {
    title: 'Multi-Agent Orchestration & Shared Memory',
    desc: 'Coordinating specialized sub-agents with state machines, dynamic routing, and fault-tolerant DAG handoffs.',
    tag: 'LangGraph / CrewAI'
  },
  {
    title: 'FastMCP & Distributed Tool Mesh',
    desc: 'Designing isolated microservice servers using Model Context Protocol for secure, scalable agent tooling.',
    tag: 'FastMCP'
  },
  {
    title: 'Contextual RAG & Advanced Retrieval',
    desc: 'Engineering hybrid sparse/dense vector search, late chunking, and contextual compression to eliminate hallucinations.',
    tag: 'Pinecone / RAG'
  },
  {
    title: 'LLM Observability & Evaluation',
    desc: 'Benchmarking agent runs via LangSmith, creating deterministic eval harnesses, and optimizing token costs.',
    tag: 'LLMOps'
  }
];

export default function About() {
  return (
    <section id="about" className="section-wrap">
      <div className="site-container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              person
            </span>
            <span>Profile &amp; Engineering Philosophy</span>
          </div>
          <h2 className="section-heading">About Soumil Malik</h2>
          <p className="section-description">
            Passionate about building AI systems that go beyond basic prompts into autonomous execution.
          </p>
        </div>

        {/* Bio Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px', alignItems: 'start' }}>
          {/* Narrative */}
          <div className="card" style={{ padding: '28px' }}>
            <div className="badge badge-emerald" style={{ marginBottom: '16px' }}>
              <span className="status-dot" />
              <span>Based in Delhi, India · Available for Full-Time Roles</span>
            </div>

            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', lineHeight: 1.3 }}>
              Engineering production AI that <span className="text-gradient">reasons, executes</span>, and solves real problems.
            </h3>

            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '14px' }}>
              I&apos;m <strong>Soumil Malik</strong> — a Computer Science undergraduate specializing in Agentic AI and LLMOps. I build autonomous multi-agent systems, FastMCP microservices, distributed AI backends, and production RAG pipelines.
            </p>

            <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '22px' }}>
              My engineering stack centers on <strong>LangGraph, CrewAI, FastMCP, FastAPI, Celery, Redis, and Pinecone</strong>. I care deeply about creating deterministic tool routing, multi-step agent reasoning, structured outputs, and high-throughput async pipelines.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="#contact" className="btn-solid">
                <span>Get in Touch</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  send
                </span>
              </a>
              <a href="/resume.pdf" target="_blank" rel="noreferrer" className="btn-outline">
                <span>Resume (PDF) ↗</span>
              </a>
            </div>
          </div>

          {/* Research Frontiers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-indigo)', marginBottom: '4px' }}>
              Active Research &amp; Engineering Focus
            </div>

            {RESEARCH_TOPICS.map((item) => (
              <div key={item.title} className="card card-hover" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <strong style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--text-primary)' }}>
                    {item.title}
                  </strong>
                  <span className="badge" style={{ fontSize: '10px' }}>
                    {item.tag}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
