export default function TopBar() {
  return (
    <div className="top-status-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span className="status-dot pulse" />
        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
          Available for AI / ML Engineer Roles
        </span>
        <span style={{ color: 'var(--border-subtle)' }}>•</span>
        <span>Delhi, India (UTC+05:30)</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <span className="badge badge-emerald" style={{ fontSize: '10px', padding: '2px 8px' }}>
          Agentic AI &amp; LLMOps
        </span>
      </div>
    </div>
  );
}
