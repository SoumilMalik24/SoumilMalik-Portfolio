import { useState } from "react";
import SectionTag from "../components/SectionTag";
import GlassCard from "../components/GlassCard";
import { PROJECTS, FILTERS } from "../data/projects";

function ProjectCard({ project, index }) {
  const { domain, title, stack, desc, github, hasDemo, demoLink } = project;

  const openLink = (url) => {
    if (url && url !== "#") window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div 
      style={{ 
        animation: "slideup 0.4s ease forwards", 
        animationDelay: `${index * 0.1}s`, 
        opacity: 0 
      }}
    >
      <GlassCard hoverable>
      <div className="proj-domain">[ {domain.join(" / ")} ]</div>
      <h3 className="proj-title">{title}</h3>
      <p className="proj-desc">{desc}</p>
      <div className="proj-footer">
        <div className="proj-tags">
          {stack.map((s) => (
            <span key={s} className="proj-tag">{s}</span>
          ))}
        </div>
        <div className="proj-links">
          {github && (
            <button className="proj-link" onClick={() => openLink(github)} aria-label={`${title} GitHub`}>
              GitHub
            </button>
          )}
          {hasDemo && (
            <button className="proj-link" onClick={() => openLink(demoLink)} aria-label={`${title} live demo`}>
              Demo ↗
            </button>
          )}
        </div>
      </div>
    </GlassCard>
    </div>
  );
}

export default function Projects() {
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered =
    activeFilter === "all"
      ? PROJECTS
      : PROJECTS.filter((p) => p.domain.includes(activeFilter));

  return (
    <section aria-label="Projects">
      <SectionTag label="system / projects" />

      {/* Filter bar */}
      <div className="filter-bar" role="group" aria-label="Filter projects by domain">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-pill${activeFilter === f ? " active" : ""}`}
            onClick={() => setActiveFilter(f)}
            aria-pressed={activeFilter === f}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="projects-grid">
        {filtered.length > 0 ? (
          filtered.map((p, i) => (
            <ProjectCard key={`${activeFilter}-${p.id}`} project={p} index={i} />
          ))
        ) : (
          <p className="no-projects">no projects in this domain yet — coming soon.</p>
        )}
      </div>
    </section>
  );
}
