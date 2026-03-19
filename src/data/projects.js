export const FILTERS = ["all", "nlp", "cv", "genai", "mlops", "api"];

export const PROJECTS = [
  {
    id: 1,
    domain: ["nlp", "genai", "api"],
    title: "Smart Finance AI",
    stack: ["FastAPI", "LangChain", "MCP", "SSE"],
    desc: "Multi-Server MCP microservices for financial intelligence. Real-time token streaming via Server-Sent Events (SSE).",
    github: "https://github.com/SoumilMalik24",
    hasDemo: false,
    demoLink: "",
  },
  {
    id: 2,
    domain: ["nlp", "genai", "api"],
    title: "DocuMind",
    stack: ["FastAPI", "LangChain", "FAISS", "OpenAI"],
    desc: "End-to-end RAG pipeline for PDF ingestion and natural language querying with semantic retrieval via FAISS.",
    github: "https://github.com/SoumilMalik24",
    hasDemo: false,
    demoLink: "",
  },
  {
    id: 3,
    domain: ["nlp", "api"],
    title: "SentimentFlow",
    stack: ["Python", "Transformers", "PostgreSQL", "Streamlit"],
    desc: "Autonomous ETL pipeline with Zero-Shot NLI sentiment attribution for tracking 100+ startups daily.",
    github: "https://github.com/SoumilMalik24",
    hasDemo: false,
    demoLink: "",
  },
  {
    id: 4,
    domain: ["mlops"],
    title: "Vehicle Insurance MLOps",
    stack: ["Scikit-learn", "MongoDB Atlas", "AWS", "Docker"],
    desc: "End-to-end MLOps pipeline for claim prediction, covering ingestion to AWS cloud deployment.",
    github: "https://github.com/SoumilMalik24",
    hasDemo: false,
    demoLink: "",
  },
];
