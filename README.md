# Clutch — The Last-Minute Life Saver

> **Beat every deadline.** Clutch turns a messy brain-dump into a prioritized, time-blocked plan — and quietly re-plans itself when life gets in the way.

Clutch is an **autonomous AI productivity agent**. You dump everything on your plate (by text or voice); Clutch reasons in multiple steps, then *takes action on your behalf* — creating tasks, breaking big goals into subtasks, prioritizing by urgency × importance, and time-blocking your day. When you fall behind, it proactively re-plans and tells you exactly what to keep, move, or drop.

**🔗 Live demo:** https://clutch-the-last-minute-life-saver.onrender.com

---

## ✨ What makes it an *agent*, not a chatbot

Clutch runs a real multi-step **function-calling loop** with Gemini. The model doesn't just reply — it autonomously calls tools to mutate your plan, and every action is shown in a live **Agent Activity** feed:

| Tool | What the agent does |
|---|---|
| `create_tasks` | Parses your brain-dump into structured tasks (title, estimate, deadline, importance) |
| `breakdown_goal` | Splits a large goal into ordered subtasks |
| `prioritize` | Ranks tasks into **NOW / NEXT / LATER** with a one-line reason each |
| `schedule_blocks` | Time-blocks the day across your working hours, avoiding overlaps |
| `replan` | When you drop or miss a task, proposes a keep / move / drop plan |

The server runs an iterative loop (call → execute tools with real IDs → feed results back → repeat), so a single brain-dump produces a complete, coherent plan in one action.

---

## 🚀 Features

**Planning**
- 🧠 **Autonomous planning** — brain-dump (text or 🎤 voice) → prioritized, time-blocked day in seconds
- 🪓 **Goal breakdown** — turn a big goal into actionable subtasks
- 🔁 **Proactive re-planning** — fall behind and Clutch reshuffles, recommending what to cut
- 📡 **Live agent activity feed** — watch every autonomous action the agent takes

**Dashboard**
- ✅ **Today** — Priorities (NOW/NEXT/LATER with the agent's reasoning), a time-blocked schedule with a live "now" line, and a resizable Agent Activity panel
- 📊 **Insights** — completion rate, focus time, a **Focus Score**, priority mix, and an interactive **floating task-bubble** visualization (cursor-reactive physics; size = time, color = priority)
- 📅 **Calendar** — week view of your scheduled blocks
- 🗂 **Archive** — completed/dropped tasks with restore & delete
- ⚙️ **Settings** — working hours, voice toggle, clear-all-data
- ↔️ **Collapsible sidebar** with persisted state

**Landing**
- A premium light/teal landing with an **interactive 3D particle sphere** (slow rotation, a cursor-following light, and dots that repel — including a "Built for" constellation overlay)

**Engineering**
- Resilient agent calls with **retry + exponential backoff** on transient errors
- **Model configurable** via an environment variable (no code change to switch)
- State persisted in `localStorage`; friendly, human-readable error handling

---

## 🛠 Tech stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, lucide-react, date-fns, HTML5 Canvas (particle sphere + bubble physics)
- **Backend:** Node.js + Express, `@google/genai` (Gemini function calling), dotenv
- **AI:** **Google Gemini** (configurable model, e.g. `gemini-2.0-flash` / `gemini-2.5-flash`) driving the agentic function-calling loop
- **Typography:** **Google Fonts** (Inter + Space Grotesk)
- **Deploy:** Render (Node web service)

---

## 🏃 Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
# create .env.local with your key (see below)
npm run dev          # http://localhost:3000
```

### Environment variables (`.env.local`)
```bash
GEMINI_API_KEY=your_gemini_api_key      # required
GEMINI_MODEL=gemini-2.0-flash           # optional (defaults to a free-tier model)
```
> Get a Gemini API key from Google AI Studio. `.env.local` is git-ignored — never commit your key.

### Production build
```bash
npm run build        # builds the client (Vite) + bundles the server (esbuild)
npm start            # serves the built app on $PORT (default 3000)
```

---

## ☁️ Deployment

Deployed on **Render** as a Node web service:
- **Build:** `npm install; npm run build`
- **Start:** `npm run start`
- **Env:** `GEMINI_API_KEY`, `GEMINI_MODEL`

Auto-deploys on every push to `main`.

---

## 🙏 Built with

Clutch was prototyped in **Google AI Studio** and is powered by **Google Gemini** (via the Gemini API), with typography from **Google Fonts**. Voice capture uses the browser **Web Speech API**.

---

Made for **Vibe2Ship** — Problem Statement 1: *The Last-Minute Life Saver.*
