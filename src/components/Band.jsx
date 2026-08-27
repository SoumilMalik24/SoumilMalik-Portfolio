const TICKER_ITEMS = [
  'LANGGRAPH MULTI-AGENT DAGs',
  'FASTMCP TOOL ROUTING MESH',
  'CREWAI 6-AGENT AUDIT SWARM',
  'KNOWLEDGE DISTILLATION & LoRA',
  'ASYNC FASTAPI + CELERY + REDIS',
  'PRODUCTION PINECONE RAG',
  'AWS CI/CD & MLOPS PIPELINES',
  'LANGSMITH EVALUATION & TRACING'
];

export default function Band() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div
      style={{
        width: '100%',
        overflow: 'hidden',
        background: 'rgba(13, 14, 19, 0.9)',
        borderTop: '1px solid var(--border-subtle)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '12px 0',
        position: 'relative',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          gap: '32px',
          animation: 'tickerScroll 30s linear infinite',
        }}
      >
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              color: idx % 2 === 0 ? 'var(--primary)' : 'var(--secondary)',
            }}
          >
            <span className="status-pip" style={{ width: '4px', height: '4px' }} />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes tickerScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
