import { useState } from "react";

const INITIAL = { name: "", subject: "", message: "" };

export default function DirectMessageModal({ onClose }) {
  const [form, setForm]     = useState(INITIAL);
  const [status, setStatus] = useState("idle"); // idle | loading | sent

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.message.trim()) return;
    setStatus("loading");
    try {
      // ── Swap in your FastAPI endpoint ──
      // await fetch(`${import.meta.env.VITE_API_URL}/contact`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(form),
      // });
      await new Promise((r) => setTimeout(r, 1000));
      setStatus("sent");
    } catch {
      setStatus("idle");
      alert("Failed to send. Please try again.");
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        {status === "sent" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ color: "#28c840", fontSize: "26px", marginBottom: "10px" }}>✓</div>
            <div style={{ fontSize: "11px", color: "rgba(230,168,23,0.6)", lineHeight: 2 }}>
              message sent successfully<br />
              <span style={{ color: "rgba(230,168,23,0.35)" }}>Soumil will get back to you soon.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-title">[ direct_message → soumil ]</div>
            <input
              className="amber-input"
              placeholder="your name *"
              value={form.name}
              onChange={set("name")}
            />
            <input
              className="amber-input"
              placeholder="subject"
              value={form.subject}
              onChange={set("subject")}
            />
            <textarea
              className="amber-input amber-textarea"
              placeholder="your message *"
              value={form.message}
              onChange={set("message")}
            />
            <button
              className="amber-btn"
              onClick={handleSubmit}
              disabled={status === "loading"}
            >
              {status === "loading" ? "sending..." : "send_message()"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
