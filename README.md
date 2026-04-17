# ⚡ QuizBeat — AI-Native Quiz Platform

> *Turn any textbook into a live multiplayer quiz in seconds — powered by LLMs, built AI-first.*

[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61dafb?logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Groq](https://img.shields.io/badge/AI-Groq%20%7C%20Llama%2070B-ff6b35)](https://groq.com)
[![Firebase](https://img.shields.io/badge/Auth%20%26%20DB-Firebase-FFCA28?logo=firebase)](https://firebase.google.com)

---

## 🤖 AI at the Core

QuizBeat is not just AI-assisted — it is **AI-native**. Every key user flow is driven by intelligence:

| Feature | How AI Powers It |
|---|---|
| **Instant Quiz Generation** | Upload any PDF/DOCX/TXT → Groq's Llama 70B extracts concepts and generates MCQs with distractors |
| **Smart Difficulty Scaling** | Choose Easy / Medium / Hard — the LLM adjusts question complexity accordingly |
| **Chapter-Aware Context** | Specify chapters; the AI narrows scope and stays contextually relevant |
| **Explanation Engine** | Every answer comes with an AI-generated explanation — not just a correct/wrong label |
| **MCP Auth Layer** | Custom **Model Context Protocol (MCP)** server handles AI-aware authentication flows |
| **Adaptive Quiz Editing** | Edit & regenerate individual questions from the AI output without re-uploading |

---

## 🎮 Platform Features

- **Real-time Multiplayer** — Host Kahoot-style competitions with live leaderboards via Firebase Realtime DB
- **Quiz Sharing** — Share quizzes via public links; anyone can take without an account
- **Google Sign-In** — Zero-friction onboarding with Firebase Auth
- **Personal Quiz Library** — Save, manage, and reuse all generated quizzes from your dashboard
- **Full Game Flow** — Lobby → Gameplay → Live scoring → Results — all synchronized in real-time
- **Deployed & Production-Ready** — Vercel (frontend) + Render (backend) with Docker support

---

## 🛠️ Tech Stack

```
Frontend  → React + Vite
Backend   → FastAPI (Python)
AI Engine → Groq API  (Llama-3 70B)
Auth/DB   → Firebase (Auth + Firestore + Realtime DB)
Protocol  → Custom MCP Server for AI context management
Deploy    → Vercel + Render + Docker
```

---

## 🤝 Built With AI-Native Dev Tools

This project was developed using a fully AI-assisted workflow:

- **[Antigravity](https://antigravity.dev)** — Agentic coding assistant for architecture, multi-file edits & planning
- **[Claude Code](https://claude.ai/code)** — Feature implementation, debugging & code review
- **[OpenAI Codex](https://openai.com/codex)** — Boilerplate generation & rapid prototyping

> The entire development cycle — from schema design to deployment config — was orchestrated with these AI tools, making this a true **AI-native engineering project**.

---

## 🚀 Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

> Requires: Node 18+, Python 3.9+, Firebase project, Groq API key. See `.env.example` files in each directory.

---

## 📝 License

MIT
