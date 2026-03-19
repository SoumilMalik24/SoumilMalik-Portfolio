import SectionTag from "../components/SectionTag";
import GlassCard from "../components/GlassCard";
import { CERTIFICATIONS } from "../data/certifications";

function CertCard({ cert, index }) {
  const { title, issuer, date, link } = cert;

  const handleOpen = () => {
    if (link && link !== "#") window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ animation: "slideup 0.4s ease forwards", animationDelay: `${index * 0.1}s`, opacity: 0 }}>
      <GlassCard hoverable onClick={handleOpen} aria-label={`${title} certificate`}>
        <div className="cert-issuer">[ {issuer} ]</div>
        <div className="cert-title">{title}</div>
        <div className="cert-footer">
          <span className="cert-date">{date}</span>
          <button
            className="cert-link"
            onClick={(e) => { e.stopPropagation(); handleOpen(); }}
            aria-label={`View ${title} certificate`}
          >
            view ↗
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

export default function Certifications() {
  return (
    <section aria-label="Certifications">
      <SectionTag label="system / certifications" />

      <div className="certs-grid">
        {CERTIFICATIONS.map((cert, i) => (
          <CertCard key={i} cert={cert} index={i} />
        ))}
      </div>
    </section>
  );
}
