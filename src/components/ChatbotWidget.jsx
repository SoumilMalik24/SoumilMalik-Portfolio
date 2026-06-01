import { useState } from 'react';

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', content: "Hi! I'm Soumil's AI assistant. Ask me anything about his experience, projects, or skills 👋" }
  ]);
  const [input, setInput] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'bot',
        content: `Great question! This is a demo — in production, I'd query Soumil's knowledge base (CV, projects, blog posts) via a RAG pipeline and give you a precise answer about "${userMsg}".`
      }]);
    }, 900);
  };

  return (
    <>
      <button className="chatbot-fab" onClick={() => setIsOpen(o => !o)} aria-label="Chat with Soumil's AI">
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
            <div key={idx} className={`msg ${msg.role}`}>{msg.content}</div>
          ))}
        </div>
        <form className="chat-input-row" onSubmit={handleSend}>
          <input
            type="text"
            placeholder="Ask about projects, skills..."
            value={input}
            onChange={e => setInput(e.target.value)}
          />
          <button type="submit" className="chat-send">↑</button>
        </form>
      </div>
    </>
  );
}
