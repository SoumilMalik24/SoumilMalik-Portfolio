import { useState } from 'react';

const ARCHITECTURES = {
  researchSynth: {
    id: 'researchSynth',
    name: 'ResearchSynth',
    subtitle: 'LangGraph Multi-Agent Autonomous Research & Synthesis',
    nodes: [
      { name: 'Natural Language Ingress', role: 'Decomposes prompt into search queries and citation constraints', tag: 'FastAPI / Ingress' },
      { name: 'Search & Extraction Agent', role: 'Fetches relevant papers via Arxiv & Web scraping endpoints', tag: 'Arxiv Tool' },
      { name: 'Translation & Normalization', role: 'Normalizes cross-lingual terminology into structured schemas', tag: 'Transformer' },
      { name: 'Synthesis & Vector Reranker', role: 'Generates structured markdown report with Pinecone vector citations', tag: 'Pinecone / RAG' },
      { name: 'Critic & Fact Verifier', role: 'Audits factual consistency, evaluates claims & outputs final report', tag: 'LangSmith Eval' }
    ],
    systemPrompt: 'system: You are an autonomous research orchestrator. Decompose user queries into parallel search queries, enforce citation attribution, contextually compress retrieved chunks, and format final synthesis with zero hallucination.',
    tools: ['arxiv_search', 'pdf_parser', 'pinecone_vector_index', 'contextual_compressor', 'celery_worker', 'redis_broker'],
    memory: {
      type: 'Pinecone Serverless (1536-dim)',
      chunks: '4.2M Vector Embeddings',
      caching: 'Redis Async Memory Cache',
      latency: '24ms hybrid query'
    }
  },
  smartFinance: {
    id: 'smartFinance',
    name: 'Smart Finance AI',
    subtitle: 'Multi-Server FastMCP Tool Routing & Streaming Platform',
    nodes: [
      { name: 'FastMCP Gateway', role: 'Validates client schema & dynamically registers microservice tools', tag: 'FastMCP Hub' },
      { name: 'Financial Math Microservice', role: 'Isolated Python service calculating compound interest, annuities & yield', tag: 'NumPy Service' },
      { name: 'Market Simulator Worker', role: 'Stochastic Monte Carlo simulation engine across asset allocations', tag: 'Risk Engine' },
      { name: 'SSE Token Streamer', role: 'Streams real-time markdown tokens and inline Base64 chart visuals', tag: 'FastAPI / SSE' }
    ],
    systemPrompt: 'system: You are a FastMCP router managing isolated microservice servers. Route math and simulation queries to respective tools, capture structured responses, and stream real-time tokens to the React frontend.',
    tools: ['fastmcp_router', 'numpy_math_service', 'monte_carlo_engine', 'base64_chart_gen', 'sse_streamer'],
    memory: {
      type: 'LangChain Conversation Buffer',
      chunks: 'Session Memory Store',
      caching: 'Redis Stateful Session Cache',
      latency: '14ms tool dispatch'
    }
  },
  codeLens: {
    id: 'codeLens',
    name: 'CodeLens AI',
    subtitle: '6-Agent CrewAI Swarm for Automated Code & PR Review',
    nodes: [
      { name: 'AST Ingestion Agent', role: 'Parses GitHub PR diffs into Abstract Syntax Trees & symbols', tag: 'AST Parser' },
      { name: 'Bug & Security Sentinel', role: 'Identifies runtime edge cases, race conditions & OWASP vulnerabilities', tag: 'Security Bot' },
      { name: 'Performance Optimizer', role: 'Detects memory leaks, unindexed queries & redundant loops', tag: 'Perf Bot' },
      { name: 'Automated Patch Emitter', role: 'Generates verified git unified diff patches for detected flaws', tag: 'Patch Generator' },
      { name: 'Lead Architect Critic', role: 'Summarizes overall architectural risk & posts structured PR review', tag: 'Lead Reviewer' }
    ],
    systemPrompt: 'system: You coordinate 6 specialized CrewAI agents. Enforce strict lint rules, verify code security against OWASP benchmarks, generate precise patch diffs, and report traces via LangSmith.',
    tools: ['github_api_worker', 'ast_parser', 'owasp_eval_rules', 'git_patch_emitter', 'docker_sandbox', 'langsmith_tracer'],
    memory: {
      type: 'Tree-Sitter Syntax Index',
      chunks: '6.5M Code Embeddings',
      caching: 'Docker Execution Sandbox',
      latency: '38ms AST traversal'
    }
  }
};

export default function DagWorkflowStudio() {
  const [activeKey, setActiveKey] = useState('researchSynth');
  const current = ARCHITECTURES[activeKey];

  return (
    <section id="dag-studio" className="section-wrap">
      <div className="site-container">
        {/* Section Header */}
        <div className="section-head">
          <div className="section-eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>
              account_tree
            </span>
            <span>Architecture &amp; Agent Topologies</span>
          </div>
          <h2 className="section-heading">Multi-Agent Workflow Studio</h2>
          <p className="section-description">
            Inspect the internal node topologies, system prompt contracts, and tool registries powering Soumil&apos;s autonomous AI systems.
          </p>
        </div>

        {/* Studio Grid */}
        <div className="dag-grid">
          {/* Left Canvas / Flow Visualizer */}
          <div className="card dag-canvas">
            {/* Header / Tab Switcher */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                <div className="tabs-row" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                  {Object.values(ARCHITECTURES).map((arch) => (
                    <button
                      key={arch.id}
                      className={`tab-btn ${arch.id === activeKey ? 'active' : ''}`}
                      onClick={() => setActiveKey(arch.id)}
                    >
                      {arch.name}
                    </button>
                  ))}
                </div>

                <span className="badge badge-emerald">
                  <span className="status-dot" />
                  <span>Verified Pipeline</span>
                </span>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {current.subtitle}
              </div>
            </div>

            {/* Structured Step Flow */}
            <div className="node-flow">
              {current.nodes.map((node, index) => (
                <div key={node.name} className="flow-step-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent-indigo)', fontWeight: 600 }}>
                      0{index + 1}
                    </span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {node.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {node.role}
                      </div>
                    </div>
                  </div>

                  <span className="badge" style={{ fontSize: '11px' }}>
                    {node.tag}
                  </span>
                </div>
              ))}
            </div>

            {/* Bottom Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              <span>Topology: Directed Acyclic Graph (DAG)</span>
              <span style={{ color: 'var(--accent-indigo)' }}>Orchestrator: Active</span>
            </div>
          </div>

          {/* Right Inspector Panel */}
          <div className="card dag-inspector">
            <div>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-indigo)', marginBottom: '8px' }}>
                System Prompt Contract
              </div>
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px', fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {current.systemPrompt}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Registered Microservices &amp; Tools
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {current.tools.map((t) => (
                  <span key={t} className="badge badge-cyan" style={{ fontSize: '11px' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '8px' }}>
                Vector Memory &amp; State
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Vector Store</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{current.memory.type}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Knowledge Chunks</span>
                  <strong style={{ color: 'var(--accent-cyan)' }}>{current.memory.chunks}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-xs)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Retrieval Latency</span>
                  <strong style={{ color: 'var(--accent-emerald)' }}>{current.memory.latency}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
