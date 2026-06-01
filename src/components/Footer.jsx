export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">Soumil Malik</div>
          <div className="footer-tagline">
            CS undergraduate specializing in Agentic AI and LLMOps.
          </div>
        </div>
        <div>
          <div className="footer-col-title">Navigation</div>
          <a className="footer-link" href="#about">About</a>
          <a className="footer-link" href="#projects">Projects</a>
          <a className="footer-link" href="#stack">Stack</a>
          <a className="footer-link" href="#skills">Skills</a>
        </div>
        <div>
          <div className="footer-col-title">Contact</div>
          <span className="footer-link">+91 9650799486</span>
          <span className="footer-link">soumil4malik@gmail.com</span>
          <span className="footer-link">Delhi, India</span>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-copy">© 2026 Soumil Malik</div>
        <div className="footer-copy">Agentic AI &amp; LLMOps</div>
      </div>
    </footer>
  );
}
