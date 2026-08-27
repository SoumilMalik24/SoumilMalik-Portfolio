const CAPABILITY_DOMAINS = [
  {
    domain: 'Agentic AI & Orchestration',
    icon: 'smart_toy',
    skills: ['LangGraph', 'CrewAI', 'FastMCP', 'LangChain', 'Multi-Agent DAGs', 'Tool Routing', 'State Machines', 'Autonomous Loops']
  },
  {
    domain: 'LLMOps & Observability',
    icon: 'monitoring',
    skills: ['LangSmith', 'Prompt Engineering', 'Token Optimization', 'Cost Tracking', 'Eval Harnesses', 'n8n', 'Make.com']
  },
  {
    domain: 'Distributed Backend & Infra',
    icon: 'dns',
    skills: ['FastAPI', 'Celery Workers', 'Redis Queues', 'Docker Containers', 'PostgreSQL', 'AWS (EC2, S3, ECR)', 'GitHub Actions']
  },
  {
    domain: 'Deep Learning & Distillation',
    icon: 'psychology',
    skills: ['PyTorch', 'Knowledge Distillation', 'LoRA Adapters', 'Qwen-Image-Edit', 'Stable Diffusion 1.5', 'Hugging Face', 'MLflow']
  },
  {
    domain: 'Vector DBs & Advanced RAG',
    icon: 'database',
    skills: ['Pinecone Serverless', 'FAISS', 'Weaviate', 'MongoDB Atlas', 'Hybrid Search', 'Contextual Re-Ranking', 'Late Chunking']
  },
  {
    domain: 'Core Languages & Engineering',
    icon: 'terminal',
    skills: ['Python 3.12', 'SQL & Asyncpg', 'JavaScript (ESNext)', 'React 19', 'Linux / Bash', 'Git Workflows']
  }
];

export default function Skills() {
  return (
    <section id="skills" className="section-wrap">
      <div className="site-container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              memory
            </span>
            <span>Competencies &amp; Toolchains</span>
          </div>
          <h2 className="section-heading">Capability Matrix</h2>
          <p className="section-description">
            Full-spectrum proficiency across agentic framework design, LLMOps observability, deep learning distillation, and cloud infrastructure.
          </p>
        </div>

        {/* Capabilities Grid */}
        <div className="capabilities-grid">
          {CAPABILITY_DOMAINS.map((domain) => (
            <div key={domain.domain} className="card card-hover cap-card">
              <div className="cap-header">
                <span className="material-symbols-outlined cap-icon">
                  {domain.icon}
                </span>
                <h3 className="cap-title">{domain.domain}</h3>
              </div>

              <div className="cap-pills">
                {domain.skills.map((s) => (
                  <span key={s} className="cap-pill">
                    {s}
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
