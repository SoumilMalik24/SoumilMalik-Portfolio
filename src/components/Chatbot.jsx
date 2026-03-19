import { useEffect } from "react";
import { useChatbot } from "../hooks/useChatbot";

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e6a817" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function Chatbot({ activeSection }) {
  const { open, setOpen, messages, input, setInput, send, loading, messagesEndRef } = useChatbot();

  // Auto-open 2 seconds after the site loads
  useEffect(() => {
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, []);

  // Close whenever the user navigates to a different section
  useEffect(() => {
    setOpen(false);
  }, [activeSection]);

  return (
    <>
      <button
        className="chatbot-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI assistant"
        title="Ask about Soumil"
      >
        <ChatIcon />
      </button>

      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <span className="chatbot-title">ask_soumil.ai</span>
            <button className="chatbot-close" onClick={() => setOpen(false)} aria-label="Close chatbot">✕</button>
          </div>

          <div className="chatbot-messages">
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>{m.text}</div>
            ))}
            {loading && (
              <div className="chat-msg bot" style={{ opacity: 0.6 }}>...</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-row">
            <input
              className="chatbot-inp"
              placeholder="ask anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              aria-label="Chat input"
            />
            <button className="chatbot-send" onClick={send} disabled={loading}>
              send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

