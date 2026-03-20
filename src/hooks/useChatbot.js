import { useState, useRef, useEffect } from "react";

const RESPONSES = {
  default:    "I can tell you about Soumil's projects, stack, experience, or how to reach him. What would you like to know?",
  project:    "Soumil has 5+ shipped projects — a BERT Sentiment API, Vision Classifier, RAG Pipeline — all deployed via FastAPI or HuggingFace Spaces.",
  skill:      "Core stack: PyTorch for modelling, FastAPI for serving, Docker for containerization, and MLflow for experiment tracking.",
  experience: "Currently an ML Engineering Intern and final-year B.Tech CS student focused on real-world ML deployment.",
  contact:    "Reach Soumil on GitHub at github.com/soumilmalik or use the contact form on this site.",
};

function getLocalResponse(query) {
  const q = query.toLowerCase();
  if (q.includes("project") || q.includes("build") || q.includes("deploy") || q.includes("work")) return RESPONSES.project;
  if (q.includes("skill") || q.includes("stack") || q.includes("tool") || q.includes("framework") || q.includes("tech")) return RESPONSES.skill;
  if (q.includes("experience") || q.includes("intern") || q.includes("job") || q.includes("hire")) return RESPONSES.experience;
  if (q.includes("contact") || q.includes("reach") || q.includes("email") || q.includes("linkedin")) return RESPONSES.contact;
  return RESPONSES.default;
}

export function useChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hey! I'm Soumil's AI assistant. Ask me anything — projects, stack, experience..." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      
      if (!res.ok) throw new Error("Failed to fetch");
      
      const data = await res.json();
      
      // Fallbacks in case the backend uses a different key name rather than "answer"
      const botText = data.reply || data.answer || data.response || data.message || data.output || data.text || JSON.stringify(data);
      
      setMessages((prev) => [...prev, { role: "bot", text: botText }]);
    } catch {
      setMessages((prev) => [...prev, { role: "bot", text: "Something went wrong. Make sure the backend is running." }]);
    } finally {
      setLoading(false);
    }
  };

  return { open, setOpen, messages, input, setInput, send, loading, messagesEndRef };
}
