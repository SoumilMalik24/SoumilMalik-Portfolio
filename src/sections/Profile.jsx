import { useState, useEffect } from "react";
import SectionTag from "../components/SectionTag";

const STATS = [
  { val: "5+",       lbl: "Projects shipped" },
  { val: "8.39",     lbl: "B.Tech CGPA" },
  { val: "Intern",   lbl: "AI/ML Engineer" },
];

export default function Profile() {
  const [name, setName] = useState("");
  const fullName = "SOUMIL MALIK";

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setName(fullName.slice(0, i + 1));
      i++;
      if (i >= fullName.length) {
        clearInterval(interval);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  return (
    <section aria-label="Profile">
      <SectionTag label="system / profile" />

      <div aria-hidden="true" style={{ minHeight: "46px" }}>
        <h1 className="profile-name">
          {name}
          <span className="bar-cursor" />
        </h1>
      </div>
      <p className="profile-sub">B.Tech @ GGSIPU · AI/ML Engineer · GenAI & MLOps Specialist</p>

      <div className="profile-stats">
        {STATS.map(({ val, lbl }) => (
          <div key={lbl} className="stat-card">
            <div className="stat-val">{val}</div>
            <div className="stat-lbl">{lbl}</div>
          </div>
        ))}
      </div>

      <div className="profile-bio">
        <span className="bio-comment"># </span>Computer Science undergraduate specializing in Generative AI and MLOps.<br />
        <span className="bio-comment"># </span>Experience building RAG pipelines, MCP-based AI systems,<br />
        <span className="bio-comment"># </span>and fine-tuned diffusion models in production.<br />
        <span className="bio-comment"># </span>Stack: LangChain · PyTorch · Docker · AWS · FastAPI
      </div>
    </section>
  );
}
