import useInView from '../hooks/useInView';

export default function About() {
  const [ref, inView] = useInView();
  return (
    <section id="about" className={`section-outer ${inView ? 'in-view' : ''}`} ref={ref}>
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
            <div className="exploring-label">Currently Exploring</div>
            {[
              {
                topic: 'AI Scalability',
                note: 'Scaling LLM inference and agent workloads across distributed systems under production load',
                tag: 'Infra',
              },
              {
                topic: 'Backend Systems',
                note: 'Designing async task queues, event-driven APIs, and high-throughput data pipelines',
                tag: 'Backend',
              },
              {
                topic: 'Advanced RAG Concepts',
                note: 'Hybrid retrieval, re-ranking, late chunking, and contextual compression techniques',
                tag: 'RAG',
              },
              {
                topic: 'LLM Evaluation & Observability',
                note: 'Building eval harnesses, tracing agent runs, and detecting model drift in production',
                tag: 'LLMOps',
              },
              {
                topic: 'Multi-Agent Orchestration',
                note: 'Coordinating specialized sub-agents with shared memory and fault-tolerant handoffs',
                tag: 'Agents',
              },
            ].map(({ topic, note, tag }) => (
              <div className="explore-row" key={topic}>
                <div className="explore-top">
                  <span className="explore-topic">{topic}</span>
                  <span className="explore-tag">{tag}</span>
                </div>
                <p className="explore-note">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
