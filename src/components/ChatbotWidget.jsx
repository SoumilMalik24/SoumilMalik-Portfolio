import { useState, useRef, useEffect } from 'react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const WELCOME_MSG = {
  role: 'assistant',
  content: "Hi, I'm Soumil's AI Copilot. Ask me anything about his multi-agent architectures (LangGraph, CrewAI), FastMCP platforms, LoRA distillation research, or technical background!"
};

const SUGGESTIONS = [
  'Tell me about ResearchSynth',
  'How does Smart Finance use FastMCP?',
  'Explain CodeLens 6-Agent review',
  'What is Soumil\'s experience & CGPA?'
];

function getDeterministicAnswer(prompt) {
  const p = prompt.toLowerCase();

  if (p.includes('researchsynth') || p.includes('research')) {
    return "ResearchSynth is Soumil's autonomous multi-agent research platform built on LangGraph. It orchestrates Search, Translation, and Synthesis agents to generate structured markdown reports with verifiable citations from natural language queries. The distributed backend uses FastAPI, Celery, Redis, async SQLAlchemy, and Pinecone.";
  }

  if (p.includes('mcp') || p.includes('smart finance') || p.includes('finance')) {
    return "Smart Finance AI is a multi-server FastMCP platform with isolated microservices for quantitative financial math, stochastic Monte Carlo simulations, and real-time Base64 chart streaming over Server-Sent Events (SSE). It features dynamic tool routing, LangChain session memory, and OpenAI integration.";
  }

  if (p.includes('codelens') || p.includes('crewai') || p.includes('code review')) {
    return "CodeLens is a 6-agent CrewAI code auditor system with specialized agents for: 1) Bug Detection, 2) Security Vulnerability Scanning (OWASP), 3) Performance Optimization, 4) Best Practices, 5) Automated Patch Generation, and 6) Lead Architectural Review, with full LangSmith tracing.";
  }

  if (p.includes('experience') || p.includes('intern') || p.includes('regalrinse') || p.includes('lora') || p.includes('distill')) {
    return "Soumil interned as an AI/ML Engineer at RegalRinse (Nov 2025 – Jan 2026), where he engineered a teacher–student knowledge distillation pipeline transferring SOTA Qwen-Image-Edit reasoning into a Stable Diffusion 1.5 + LoRA adapter, and built a synthetic data factory with 4-bit quantized teacher models.";
  }

  if (p.includes('skills') || p.includes('stack') || p.includes('tools')) {
    return "Soumil's core engineering stack includes:\n• Agentic AI: LangGraph, CrewAI, FastMCP, LangChain\n• LLMOps: LangSmith, Eval Harnesses, Token Optimization\n• Backend & Infra: FastAPI, Celery, Redis, Docker, AWS (EC2, S3, ECR)\n• Deep Learning: PyTorch, LoRA, Knowledge Distillation\n• Vector Stores: Pinecone Serverless, FAISS, Weaviate, PostgreSQL";
  }

  if (p.includes('contact') || p.includes('email') || p.includes('phone') || p.includes('hire')) {
    return "You can reach Soumil directly via:\n• Email: soumil4malik@gmail.com\n• Phone: +91 9650799486\n• LinkedIn: linkedin.com/in/soumilmalik24\n• GitHub: github.com/SoumilMalik24\nOr submit a message via the contact form on this page!";
  }

  return "Soumil Malik is an Agentic AI & LLMOps engineer (CGPA 8.62 at GGSIPU Delhi) building production autonomous multi-agent systems, FastMCP tool routers, and distributed AI backends. Feel free to ask about specific projects like ResearchSynth, Smart Finance AI, or CodeLens!";
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MSG]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const history = updated.filter(m => m.role !== 'system');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${BACKEND}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        return;
      }
      throw new Error('Offline fallback');
    } catch {
      setTimeout(() => {
        const reply = getDeterministicAnswer(text);
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        setLoading(false);
      }, 400);
      return;
    } finally {
      setTimeout(() => setLoading(false), 450);
    }
  };

  return (
    <>
      <button
        className="copilot-launcher"
        onClick={() => setIsOpen(o => !o)}
        aria-label="Open AI Assistant"
        title="Chat with Soumil's AI Assistant"
      >
        <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>
          {isOpen ? 'close' : 'chat'}
        </span>
      </button>

      {isOpen && (
        <div className="copilot-modal">
          {/* Header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="status-dot pulse" />
              <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Soumil AI Copilot</strong>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ color: 'var(--text-secondary)' }}>
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{ flexGrow: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  maxWidth: '88%',
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  background: m.role === 'user' ? 'var(--accent-indigo)' : 'var(--bg-surface)',
                  color: m.role === 'user' ? '#ffffff' : 'var(--text-primary)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                  whiteSpace: 'pre-line'
                }}
              >
                {m.content}
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start', padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>Searching knowledge base...</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length < 3 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '0 14px 10px' }}>
              {SUGGESTIONS.slice(0, 2).map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="badge"
                  style={{ cursor: 'pointer', fontSize: '11px' }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{ padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', display: 'flex', gap: '8px' }}
          >
            <input
              type="text"
              placeholder="Ask about projects, stack, experience..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              style={{
                flexGrow: 1,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-xs)',
                padding: '8px 12px',
                fontSize: '12px',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              className="btn-accent"
              style={{ padding: '6px 12px', borderRadius: 'var(--radius-xs)' }}
              disabled={loading || !input.trim()}
            >
              ➔
            </button>
          </form>
        </div>
      )}
    </>
  );
}
