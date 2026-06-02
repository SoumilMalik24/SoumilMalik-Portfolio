import { useState, useRef, useEffect } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const WELCOME = {
  role: 'assistant',
  content: "Hi! I'm Soumil's AI assistant. Ask me anything about his projects, experience, skills, or how to get in touch 👋"
};

export default function ChatbotWidget() {
  const [isOpen,   setIsOpen]   = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const bottomRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      // Send full conversation history (excluding the welcome message system note)
      const history = updated.filter(m => m.role !== 'system');

      const res = await fetch(`${BACKEND}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't connect to the server. Please try again." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        className="chatbot-fab"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Chat with Soumil's AI"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      <div className={`chatbot-window ${isOpen ? 'open' : 'closed'}`}>
        <div className="chat-header">
          <div>
            <div className="chat-title">S<em>M</em> Assistant</div>
            <div className="chat-subtitle">RAG-powered · Ask me anything</div>
          </div>
          <button className="chat-close" onClick={() => setIsOpen(false)}>×</button>
        </div>

        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`msg ${msg.role === 'user' ? 'user' : 'bot'}`}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="msg bot">
              <span className="chat-typing"><span/><span/><span/></span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form className="chat-input-row" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Ask about projects, skills..."
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="chat-send" disabled={loading || !input.trim()}>↑</button>
        </form>
      </div>
    </>
  );
}
