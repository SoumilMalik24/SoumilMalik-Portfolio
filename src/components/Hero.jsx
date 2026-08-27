import { useState } from 'react';

const WORKFLOW_DEMOS = {
  researchSynth: {
    title: 'ResearchSynth · LangGraph Multi-Agent',
    steps: [
      { agent: 'Supervisor / Planner', desc: 'Decomposed prompt into query sub-goals & citation constraints', latency: '120ms', status: 'done' },
      { agent: 'Search Agent (Arxiv/Web)', desc: 'Extracted 14 academic papers; parsed semantic sections', latency: '340ms', status: 'done' },
      { agent: 'Synthesis & RAG Agent', desc: 'Embedded into Pinecone vector index; compressed context', latency: '410ms', status: 'done' },
      { agent: 'Critic & Fact-Checker', desc: 'Zero hallucination detected; generated verified report', latency: '95ms', status: 'done' }
    ]
  },
  smartFinance: {
    title: 'Smart Finance · FastMCP Microservices',
    steps: [
      { agent: 'FastMCP Ingress Router', desc: 'Validated user query schema; routed to tool registry', latency: '18ms', status: 'done' },
      { agent: 'Financial Math Worker', desc: 'Executed compound CAGR calculation via numpy microservice', latency: '32ms', status: 'done' },
      { agent: 'Monte Carlo Simulator', desc: 'Simulated 10,000 portfolio risk scenarios', latency: '140ms', status: 'done' },
      { agent: 'SSE Token Streamer', desc: 'Rendered Base64 distribution charts with token streaming', latency: '45ms', status: 'done' }
    ]
  },
  codeLens: {
    title: 'CodeLens · 6-Agent CrewAI Swarm',
    steps: [
      { agent: 'AST Parser Agent', desc: 'Ingested GitHub PR diff and constructed abstract syntax tree', latency: '85ms', status: 'done' },
      { agent: 'Security Sentinel', desc: 'Scanned OWASP Top 10 vulnerabilities & secret leaks', latency: '210ms', status: 'done' },
      { agent: 'Auto-Fix Generator', desc: 'Generated unified diff patches for lint & memory leaks', latency: '380ms', status: 'done' },
      { agent: 'Lead Architect Critic', desc: 'Benchmarked performance impact with LangSmith trace', latency: '110ms', status: 'done' }
    ]
  }
};

export default function Hero({ onOpenCmd }) {
  const [activeWorkflow, setActiveWorkflow] = useState('researchSynth');
  const [isRunning, setIsRunning] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(4);

  const current = WORKFLOW_DEMOS[activeWorkflow];

  const handleSimulate = () => {
    setIsRunning(true);
    setCompletedSteps(0);

    let step = 0;
    const timer = setInterval(() => {
      step++;
      setCompletedSteps(step);
      if (step >= 4) {
        clearInterval(timer);
        setIsRunning(false);
      }
    }, 450);
  };

  return (
    <section id="hero" className="section-wrap" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      <div className="site-container">
        <div className="hero-layout">
          {/* Left Column */}
          <div>
            <div className="badge badge-indigo" style={{ marginBottom: '18px' }}>
              <span className="status-dot" />
              <span>Agentic AI &amp; LLMOps Engineer</span>
            </div>

            <h1 className="hero-title">
              Building autonomous systems that <br />
              <span className="text-gradient">reason, execute &amp; scale.</span>
            </h1>

            <p className="hero-subtitle">
              CS undergraduate based in Delhi, India. I specialize in designing autonomous multi-agent architectures (LangGraph, CrewAI), FastMCP tool meshes, and production RAG pipelines with deterministic evaluation.
            </p>

            <div className="hero-actions-row">
              <a href="#projects" className="btn-solid">
                <span>View Systems Matrix</span>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  arrow_downward
                </span>
              </a>

              <a href="#dag-studio" className="btn-outline">
                <span>Architecture Studio</span>
              </a>

              <button onClick={onOpenCmd} className="btn-outline" title="Press Cmd+K">
                <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
                  search
                </span>
                <span>Command Menu (⌘K)</span>
              </button>
            </div>

            {/* Clean Telemetry Stats */}
            <div className="hero-stats-grid">
              <div className="stat-box">
                <span className="stat-num">8.62</span>
                <span className="stat-lbl">CGPA (B.Tech)</span>
              </div>
              <div className="stat-box">
                <span className="stat-num">4+</span>
                <span className="stat-lbl">Agent Systems</span>
              </div>
              <div className="stat-box">
                <span className="stat-num">50k+</span>
                <span className="stat-lbl">MLOps Records</span>
              </div>
              <div className="stat-box">
                <span className="stat-num">1</span>
                <span className="stat-lbl">Publication</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Workflow Inspector */}
          <div className="trace-console">
            {/* Header with Switchable Tabs */}
            <div className="console-header">
              <div className="console-dots">
                <span className="c-dot" />
                <span className="c-dot" />
                <span className="c-dot" />
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={() => { setActiveWorkflow('researchSynth'); setCompletedSteps(4); }}
                  className={`tab-btn ${activeWorkflow === 'researchSynth' ? 'active' : ''}`}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  ResearchSynth
                </button>
                <button
                  onClick={() => { setActiveWorkflow('smartFinance'); setCompletedSteps(4); }}
                  className={`tab-btn ${activeWorkflow === 'smartFinance' ? 'active' : ''}`}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  FastMCP
                </button>
                <button
                  onClick={() => { setActiveWorkflow('codeLens'); setCompletedSteps(4); }}
                  className={`tab-btn ${activeWorkflow === 'codeLens' ? 'active' : ''}`}
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                >
                  CodeLens
                </button>
              </div>

              <button
                onClick={handleSimulate}
                disabled={isRunning}
                className="badge badge-indigo"
                style={{ cursor: 'pointer', padding: '3px 8px', fontSize: '10px' }}
              >
                {isRunning ? 'Tracing...' : 'Run Trace ▶'}
              </button>
            </div>

            {/* Body */}
            <div className="console-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                  {current.title}
                </span>
                <span className="badge badge-emerald" style={{ fontSize: '10px', padding: '1px 6px' }}>
                  LangSmith Traced
                </span>
              </div>

              {current.steps.map((step, idx) => {
                const isVisible = idx < completedSteps;
                if (!isVisible && isRunning) {
                  return (
                    <div key={idx} style={{ opacity: 0.3, paddingLeft: '12px' }}>
                      <div className="trace-item-title" style={{ color: 'var(--text-disabled)' }}>
                        <span>○ {step.agent}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={idx} className="trace-item active">
                    <div className="trace-item-title" style={{ justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-primary)' }}>
                        ✓ {step.agent}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: 400 }}>
                        {step.latency}
                      </span>
                    </div>
                    <div className="trace-item-desc">{step.desc}</div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              <span>Total Latency: ~965ms</span>
              <span style={{ color: 'var(--accent-emerald)' }}>● Verified Execution</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
