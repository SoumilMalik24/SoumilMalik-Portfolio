import { useState, useCallback } from "react";
import Shell from "./components/Shell";
import Sidebar from "./components/Sidebar";
import Profile from "./sections/Profile";
import Projects from "./sections/Projects";
import Skills from "./sections/Skills";
import Experience from "./sections/Experience";
import Certifications from "./sections/Certifications";
import Contact from "./sections/Contact";
import { MOBILE_NAV } from "./data/navigation";
import Chatbot from "./components/Chatbot";

const SECTION_MAP = {
  profile:        <Profile />,
  projects:       <Projects />,
  skills:         <Skills />,
  experience:     <Experience />,
  certifications: <Certifications />,
  contact:        <Contact />,
};

export default function Portfolio() {
  const [active, setActive]       = useState("profile");
  const [sidebarOpen, setSidebar] = useState(false);

  const navigate   = useCallback((key) => { setActive(key); setSidebar(false); }, []);
  const openMenu   = useCallback(() => setSidebar(true),  []);
  const closeMenu  = useCallback(() => setSidebar(false), []);

  return (
    <div className="app-wrapper">
      <Shell onMenuOpen={openMenu}>

        {/* Mobile overlay — closes sidebar when tapping outside */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay"
            onClick={closeMenu}
            role="presentation"
            aria-hidden="true"
          />
        )}

        <div className="layout-body">
          {/* Sidebar — on mobile it's a fixed drawer */}
          <Sidebar
            active={active}
            onNavigate={navigate}
            onClose={closeMenu}
            isOpen={sidebarOpen}
          />

          {/* Main content */}
          <main className="content-pane">
            <div className="content-glow" aria-hidden="true" />
            {SECTION_MAP[active]}
          </main>
        </div>
      </Shell>

      {/* Mobile bottom navigation bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {MOBILE_NAV.map(({ key, label, icon }) => (
          <button
            key={key}
            className={`mobile-nav-btn${active === key ? " active" : ""}`}
            onClick={() => navigate(key)}
            aria-label={label}
            aria-current={active === key ? "page" : undefined}
          >
            <span className="mobile-nav-icon" aria-hidden="true">{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      <Chatbot activeSection={active} />
    </div>
  );
}
