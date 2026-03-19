import { useState } from "react";
import SectionTag from "../components/SectionTag";
import GlassCard from "../components/GlassCard";
import DirectMessageModal from "../components/DirectMessageModal";

const CONTACT_ITEMS = [
  { type: "github",   val: "github.com/SoumilMalik24",  href: "https://github.com/SoumilMalik24" },
  { type: "linkedin", val: "linkedin.com/in/soumilmalik24",  href: "https://www.linkedin.com/in/soumilmalik24" },
  { type: "phone",    val: "+91 96507 99486",         href: "tel:+919650799486" },
  { type: "location", val: "India · open to remote",  href: null },
];

function ContactCard({ type, val, href, index }) {
  const handleClick = () => {
    if (href) window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <div style={{ animation: "slideup 0.4s ease forwards", animationDelay: `${index * 0.08}s`, opacity: 0 }}>
      <GlassCard hoverable={!!href} onClick={handleClick}>
        <div className="cc-type">[ {type} ]</div>
        <div className="cc-val">{val}</div>
      </GlassCard>
    </div>
  );
}

function EmailCard({ onDMOpen, index }) {
  return (
    <div style={{ animation: "slideup 0.4s ease forwards", animationDelay: `${index * 0.08}s`, opacity: 0 }}>
      <GlassCard>
        <div className="cc-type">[ email ]</div>
        <div className="cc-val">soumilmalik@email.com</div>
        <button
          className="dm-btn"
          onClick={onDMOpen}
          aria-label="Send a direct message"
        >
          direct_message() ↗
        </button>
      </GlassCard>
    </div>
  );
}

export default function Contact() {
  const [dmOpen, setDmOpen] = useState(false);

  return (
    <section aria-label="Contact">
      <SectionTag label="system / contact" />

      <div className="contact-grid">
        {CONTACT_ITEMS.map((c, i) => (
          <ContactCard key={c.type} {...c} index={i} />
        ))}
        <EmailCard onDMOpen={() => setDmOpen(true)} index={CONTACT_ITEMS.length} />
      </div>

      {dmOpen && <DirectMessageModal onClose={() => setDmOpen(false)} />}
    </section>
  );
}
