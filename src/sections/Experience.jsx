import { useState, useEffect } from "react";
import SectionTag from "../components/SectionTag";
import { EXPERIENCE } from "../data/experience";

const STEP_MS = 160;

function ExperienceCard({ item, isOpenToWork }) {
  if (isOpenToWork) {
    return (
      <div className="exp-card" style={{ borderColor: "var(--a1)", background: "rgba(230,168,23,0.06)" }}>
        <div className="exp-role" style={{ color: "var(--a1)" }}>Open to Work</div>
        <div className="exp-desc" style={{ marginTop: 6 }}>
          Actively seeking roles as an AI/ML Engineer. Let's build something great.
        </div>
      </div>
    );
  }
  const { role, org, location, date, desc } = item;
  return (
    <div className="exp-card">
      <div className="exp-role">{role}</div>
      <div className="exp-org">{org} · {location}</div>
      <div className="exp-date">{date}</div>
      <div className="exp-desc">{desc}</div>
    </div>
  );
}

export default function Experience() {
  const [step, setStep] = useState(0);

  const hasCurrent = EXPERIENCE.some((e) => e.current);

  // Build display list: newest/open-to-work at TOP (index 0), oldest at BOTTOM (last index)
  // EXPERIENCE[0] = most recent, so we put it first, then append older ones.
  // If not currently employed, add "Open to Work" at the very top.
  const displayNodes = hasCurrent
    ? [...EXPERIENCE]
    : [{ _openToWork: true }, ...EXPERIENCE];

  const n = displayNodes.length;
  // Each node has 3 steps: dot, card, connecting-line-below (except last node has no line)
  const totalSteps = n * 3;

  useEffect(() => {
    if (step >= totalSteps) return;
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, totalSteps]);

  // Animation fires from bottom (oldest = last displayNode index) upward.
  // For displayNode at index i, the "animation order index" is (n - 1 - i),
  // meaning the last item (i = n-1) gets order 0 (animates first).
  const orderOf = (i) => n - 1 - i;

  return (
    <section aria-label="Experience">
      <SectionTag label="system / experience" />

      <div className="exp-flow">
        {displayNodes.map((item, i) => {
          const order = orderOf(i);
          const isLast = i === displayNodes.length - 1; // bottommost node

          // Steps for this node, based on its animation order
          const base = order * 3;
          const showDot  = step >= base + 1;
          const showCard = step >= base + 2;
          // Line goes DOWN from this node to the next (lower) node
          // Last node (bottom) has no line below
          const showLine = step >= base + 3 && !isLast;

          const isOpenToWork = !!item._openToWork;
          const isFilled = item.current || isOpenToWork;

          return (
            <div key={i} className="exp-node">
              {/* Timeline column: dot + line going down (natural flex fill) */}
              <div className="exp-timeline-col">
                {/* Dot */}
                <div
                  style={{
                    width: 15,
                    height: 15,
                    borderRadius: "50%",
                    flexShrink: 0,
                    marginTop: 4,
                    border: isFilled ? "none" : "2px solid var(--a1)",
                    background: isFilled ? "var(--a1)" : "rgba(230,168,23,0.12)",
                    opacity: showDot ? 1 : 0,
                    transform: showDot ? "scale(1)" : "scale(0)",
                    transition: "opacity 0.3s ease, transform 0.35s cubic-bezier(0.175,0.885,0.32,1.275)",
                  }}
                  aria-hidden="true"
                />
                {/* Connecting line downward — uses flex:1 to fill gap naturally */}
                {!isLast && (
                  <div
                    className="exp-vline"
                    style={{
                      opacity: showLine ? 1 : 0,
                      transition: "opacity 0.35s ease",
                    }}
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Card */}
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    opacity: showCard ? 1 : 0,
                    transform: showCard ? "translateX(0)" : "translateX(18px)",
                    transition: "opacity 0.35s ease, transform 0.35s ease",
                  }}
                >
                  <ExperienceCard item={item} isOpenToWork={isOpenToWork} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


