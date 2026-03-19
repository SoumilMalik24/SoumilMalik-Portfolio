import Chatbot from "./Chatbot";

export default function Shell({ children, onMenuOpen }) {
  return (
    <div className="shell" role="main">
      <div className="shell-scan" aria-hidden="true" />


      {/* OS-style title bar */}
      <div className="titlebar">
        <div className="titlebar-dot" style={{ background: "#ff5f57" }} aria-hidden="true" />
        <div className="titlebar-dot" style={{ background: "#ffbd2e" }} aria-hidden="true" />
        <div className="titlebar-dot" style={{ background: "#28c840" }} aria-hidden="true" />
        <span className="titlebar-label">SOUMIL_MALIK.DEV — AI/ML PORTFOLIO</span>

        {/* Hamburger — only visible on mobile */}
        <button
          className="titlebar-menu-btn"
          onClick={onMenuOpen}
          aria-label="Open navigation menu"
        >
          ☰
        </button>
      </div>

      {children}
    </div>
  );
}
