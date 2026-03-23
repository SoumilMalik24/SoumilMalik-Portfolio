# 🚀 Soumil Malik - AI/ML Engineer Portfolio

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-B73BFE?style=for-the-badge&logo=vite&logoColor=FFD62E)](https://vitejs.dev/)
[![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/CSS)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com/)

A highly dynamic, developer-focused portfolio website for **Soumil Malik**, specializing in Generative AI, MLOps, and scalable backend infrastructure. 

The application is built entirely using **Vite + React** with pure custom **Vanilla CSS** (No bulky frameworks), aiming for a sleek, terminal-inspired, glassmorphic aesthetic.

## ✨ Features

- **Terminal-Style Skills Animation:** A fully custom, authentic "typing" terminal effect recreating a CLI experience (`list skills --group genai`), complete with intelligent cursor rendering and command parsing.
- **Dynamic Experience Flowchart:** A unique, bottom-to-top animated timeline flowchart mapping professional and academic history sequentially using dynamic CSS lines and nodes.
- **Live AI RAG Chatbot Integration:** An integrated floating chatbot connected to a Python backend via `fetch()`. The bot actively queries an AI agent loaded with my resume context to answer recruiter queries instantaneously.
- **Backend-Connected Direct Messaging:** A completely frictionless contact modal bypassing `mailto:` entirely, hooked to a custom SMTP/Telegram backend to deliver messages silently without user login walls.
- **Sequential Glassmorphic Modals:** Custom-built pop-up transition systems using staggered CSS delays to smoothly animate Projects, Certifications, and Contact grids on scroll.
- **Fully Responsive:** Custom mobile navigation and intelligent layout scaling down to 320px screens with zero horizontal scrolling.

## 🛠️ Built With
* **Frontend Component Architecture:** React (Functional Components + Hooks)
* **Build Tooling:** Vite (Lightning fast HMR)
* **Styling:** Custom Vanilla CSS (`var()` styling system, raw Keyframe Animations, Flexbox mastery)
* **Backend Communication:** Asynchronous generic `fetch` connected to FastAPI endpoints.

---

## ⚙️ Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your machine (v18+ recommended).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/SoumilMalik24/SoumilMalik-Portfolio.git
   cd SoumilMalik-Portfolio
   ```

2. Install NPM dependencies:
   ```bash
   npm install
   ```

3. Setup your Environment Variables (`.env`) at the root of the project:
   ```env
   # Your backend API that serves /api/chat and /api/contact
   VITE_API_URL=http://localhost:8000
   
   # Direct absolute URL to your hoster PDF Resume
   VITE_RESUME_URL=https://link-to-your-resume.com 
   ```

4. Spin up the development server:
   ```bash
   npm run dev
   ```

5. Visit `http://localhost:5173` in your browser.

---

## 🔗 Backend API Connections
This React frontend relies on a distinct generic backend (e.g., FastAPI) to properly execute two primary functions.

### 1. Direct Message (`/api/contact`)
**Request:**
```json
{
  "email": "visitor@example.com",
  "subject": "Job Offer",
  "message": "We would love to interview you."
}
```

### 2. Live Chatbot (`/api/chat`)
**Request:**
```json
{
  "message": "Tell me about Soumil's GenAI experience."
}
```
**Expected Response:**
```json
{
  "reply": "Soumil has built intelligent RAG pipelines and..."
}
```
*(Handles fallback keys like `answer`, `message`, `response`, or `text` automatically if the schema unexpectedly changes).*

---

## 📁 Source Architecture

```text
src/
├── components/          # Reusable UI (GlassCard, Sidebar, DirectMessageModal)
├── data/                # Hardcoded Portfolio Content (projects, experience, skills)
├── hooks/               # Custom React Hooks (useChatbot, useMobileDetect)
├── sections/            # Major vertical page chunks (Profile, Experience, Certifications)
├── styles/              # Raw vanilla CSS
├── Portfolio.jsx        # Master layout orchestrator
└── main.jsx             # React DOM root entry
```

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.
