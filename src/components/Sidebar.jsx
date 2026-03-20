import { NAV_ITEMS } from "../data/navigation";


export default function Sidebar({ active, onNavigate, onClose, isOpen }) {
  const cls = `sidebar${isOpen ? " open" : ""}`;
  return (
    <aside className={cls} role="navigation" aria-label="Main navigation">
      {/* Mobile close row */}
      <div className="sidebar-close-row">
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", color: "rgba(230,168,23,0.4)", fontSize: "10px", cursor: "pointer", fontFamily: "var(--font)", display: "flex", alignItems: "center", gap: "6px" }}
          aria-label="Close navigation"
        >
          ✕ close
        </button>
      </div>

      <div className="sidebar-section-label">[ navigation ]</div>

      {NAV_ITEMS.map(({ key, label }) => (
        <div
          key={key}
          className={`nav-item${active === key ? " active" : ""}`}
          onClick={() => { onNavigate(key); onClose?.(); }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && (onNavigate(key), onClose?.())}
          aria-current={active === key ? "page" : undefined}
        >
          <span className="nav-sym">{active === key ? "▸" : "○"}</span>
          {label}
        </div>
      ))}

      <button
        className="resume-btn"
        onClick={() => {
          const url = import.meta.env.VITE_RESUME_URL;
          if (url && url !== "#") {
            window.open(url, "_blank");
          } else {
            alert("Resume link is still missing in your .env file!");
          }
        }}
        aria-label="Download resume PDF"
      >
        ↓ resume.pdf
      </button>

      <div className="sidebar-footer">
        <div className="sidebar-footer-label">[ status ]</div>
        <div className="status-badge">
          <span className="live-dot" aria-hidden="true" />
          open to work
        </div>
        <div className="status-badge" style={{ marginTop: "4px" }}>
          B.Tech · CS / AI
        </div>
      </div>
    </aside>
  );
}
