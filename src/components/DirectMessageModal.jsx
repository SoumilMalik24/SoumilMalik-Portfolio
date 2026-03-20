import { useState } from "react";

const INITIAL = { email: "", subject: "", message: "" };

export default function DirectMessageModal({ onClose }) {
  const [form, setForm]     = useState(INITIAL);
  const [status, setStatus] = useState("idle"); // idle | loading | sent
  const [errorMsg, setErrorMsg] = useState("");

  const set = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (errorMsg) setErrorMsg("");
  };

  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    if (!form.email.trim() || !form.message.trim()) {
      setErrorMsg("Email and message are required.");
      return;
    }
    if (!validateEmail(form.email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Failed to send");
      setStatus("sent");
    } catch {
      setStatus("idle");
      alert("Failed to send. Please ensure the backend is running and try again.");
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
              type="email"
              placeholder="your email *"
              value={form.email}
              onChange={set("email")}
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
            {errorMsg && <div style={{ color: "#e64848", fontSize: "12px", marginBottom: "10px" }}>{errorMsg}</div>}
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
