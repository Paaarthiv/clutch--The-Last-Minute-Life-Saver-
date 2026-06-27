<div align="center">

# Clutch

### The Last-Minute Life Saver

**An autonomous AI agent that turns a panicked brain-dump into a prioritized, time-blocked, self-correcting plan — and rescues you when you fall behind.**

[Live Application](https://clutch-433410067334.asia-south1.run.app/) · [Report an Issue](https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver-/issues)

Built for **Vibe2Ship** (Coding Ninjas 10X Club × Google for Developers) — Problem Statement 1

</div>

---

## Table of Contents

- [Overview](#overview)
- [Why It Is an Agent, Not a Chatbot](#why-it-is-an-agent-not-a-chatbot)
- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Google Technologies](#google-technologies)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Demo Flow](#demo-flow)
- [License](#license)

---

## Overview

Everyone has had the same 11 PM moment: three deadlines, a head full of half-remembered tasks, and no idea where to start. The bottleneck is not a lack of to-do apps — it is the decision paralysis of converting chaos into a concrete next move.

Clutch attacks that bottleneck directly. You dump everything on your plate in plain language — or a photo of a handwritten or whiteboard list — and Clutch reasons in multiple steps, then *takes action on your behalf*: it structures your tasks, breaks large goals into subtasks, ranks everything by urgency and importance, and time-blocks your day around your real working hours and energy peaks. When you inevitably fall behind, **Clutch Mode** performs an emergency triage and tells you exactly what to do right now, what to drop, and reads the plan aloud so you can move while you listen.

Every autonomous action streams into a live Agent Activity feed, so you can watch the agent think.

## Why It Is an Agent, Not a Chatbot

Clutch runs a genuine multi-step **function-calling loop** with Google Gemini. The model is given a toolset and decides, on its own, which tools to call and in what order. The server executes each call, assigns real identifiers, and feeds the results back into the next turn — so a single brain-dump produces a complete, coherent plan through a chain of autonomous reasoning and tool use.

| Tool | Autonomous action the agent takes |
|------|-----------------------------------|
| `create_tasks` | Parses a text, voice, or photo brain-dump into structured tasks — title, time estimate, deadline, importance (1–5), and cognitive load (deep / light / admin) |
| `breakdown_goal` | Splits a large goal into ordered, actionable subtasks |
| `prioritize` | Ranks every task into NOW / NEXT / LATER, each with a one-line justification |
| `replan` | When you fall behind or drop a task, proposes an explicit keep / move / drop plan |
| `rescue_triage` | Powers Clutch Mode — returns the first physical step, a do-now shortlist, optional items, and what to abandon |

Beyond the model loop, the agent acts deterministically as well. A local priority-driven scheduler (`buildSchedule`) converts the agent's NOW / NEXT / LATER ranking into a real, packed timeline — honoring fixed-time commitments, ordering deep work first, supporting planning windows that cross midnight, and automatically resolving overlaps. The plan always reflects current priorities and re-derives instantly on every change. The agent does not just suggest; it commits the schedule.

## Features

**Autonomous planning**

- Brain-dump to plan in seconds, from text, voice, or a photo read by Gemini Vision
- Goal breakdown into ordered subtasks with a single click
- Proactive re-planning that recommends exactly what to keep, move, or cut
- A live Agent Activity feed showing every autonomous action as it happens

**Signature differentiators**

- **Clutch Mode** — a panic button that runs an emergency triage and reads the rescue plan aloud via Google Cloud Text-to-Speech
- **Energy-aware scheduling** — front-loads deep-cognitive work into your peak-focus window and pushes lighter tasks to the troughs
- **Now focus companion** — a calm, single-task view that hides the rest of the list when you are heads-down

**Persistence and sync**

- Firestore-backed state that survives across devices and reloads
- Google Calendar sync to push the agent's time-blocks into your real calendar

**Experience**

- A premium light and teal interface with an ambient, cursor-reactive design language, a glassmorphic Clutch Mode control, and a live "now" line on the timeline

## How It Works

```
Brain-dump (text / voice / photo)
        │
        ▼
POST /api/agent  ──►  Gemini function-calling loop
        │                 │
        │                 ├─ create_tasks
        │                 ├─ breakdown_goal
        │                 ├─ prioritize
        │                 └─ replan
        │
        ▼
Server assigns real IDs, returns structured tasks
        │
        ▼
Client buildSchedule()  ──►  deterministic, conflict-free timeline
        │
        ▼
Dashboard: Priorities · Schedule · Agent Activity · Now · Clutch Mode
```

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion, lucide-react, date-fns |
| Backend | Node.js, Express, `@google/genai`, esbuild server bundle |
| AI | Google Gemini (`gemini-2.5-flash`) via a multi-step function-calling loop, plus Gemini Vision |
| Cloud | Google Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Cloud Text-to-Speech, Firestore, Calendar API |

## Google Technologies

Clutch is built Google-first, with Google AI Studio as the primary development platform.

| Technology | Role in Clutch |
|------------|----------------|
| Google AI Studio | Primary platform where the agent was designed and iterated |
| Google Antigravity | Google's agentic development platform, used to build and engineer the application end to end |
| Google Gemini API | The reasoning core driving the autonomous function-calling loop |
| Gemini Vision | Reads a photo of a handwritten or whiteboard list into structured tasks |
| Google Cloud Run | Hosts the live, public, full-stack application |
| Cloud Build and Artifact Registry | Container build and deploy pipeline |
| Secret Manager | Stores the Gemini API key securely |
| Cloud Text-to-Speech | Reads the Clutch Mode rescue plan aloud |
| Firestore | Cross-device persistence of tasks, plan, and settings |
| Google Calendar API | Pushes generated time-blocks into the user's calendar |
| Google Fonts | Typography (Inter and Space Grotesk) |

## Getting Started

**Prerequisites:** Node.js 18 or newer.

```bash
git clone https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver-.git
cd clutch--The-Last-Minute-Life-Saver-
npm install
# create .env.local (see below)
npm run dev
```

The app runs at `http://localhost:3000`.

## Environment Variables

Create a `.env.local` file in the project root:

```bash
GEMINI_API_KEY=your_gemini_api_key      # required
GEMINI_MODEL=gemini-2.5-flash           # optional, defaults to a sensible model
```

Get a Gemini API key from Google AI Studio. `.env.local` is git-ignored and must never be committed.

Optional runtime variables, used only if the corresponding feature is enabled:

```bash
GOOGLE_CALENDAR_CLIENT_ID=...           # enables Google Calendar sync
```

## Deployment

The application is Cloud Run-ready and currently deployed at the live link above.

```bash
gcloud run deploy clutch \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

The Gemini key is stored in Secret Manager rather than in code. See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full step-by-step guide.

## Project Structure

```
clutch_app/
├── server.ts              Express backend: Gemini agent loop, Vision, TTS, Firestore, config
├── src/
│   ├── AgentContext.tsx   Client agent state, local scheduler (buildSchedule), persistence
│   ├── components/
│   │   └── Dashboard.tsx   Priorities, Timeline, Now, Clutch Mode, Settings, capture
│   ├── types.ts           Shared task and state types
│   └── index.css          Theme and animations
├── SUBMISSION.md          Vibe2Ship submission document
├── DEPLOYMENT.md          Cloud Run deployment guide
└── package.json
```

## API Reference

| Endpoint | Purpose |
|----------|---------|
| `POST /api/agent` | Runs the Gemini function-calling loop; accepts text and optional image for Vision |
| `POST /api/tts` | Returns Cloud Text-to-Speech audio for the Clutch Mode rescue plan |
| `POST /api/state/save` | Persists client state to Firestore |
| `GET /api/state/load` | Restores client state from Firestore |
| `GET /api/config` | Serves runtime configuration such as the Calendar client ID |

## Demo Flow

1. Brain-dump several tasks at once, including a deadline-heavy one and a fixed-time one such as "gym 4–6 PM".
2. Watch Clutch autonomously create structured tasks in the Agent Activity feed.
3. Open Priorities to show NOW / NEXT / LATER with the agent's reasoning.
4. Review the time-blocked schedule and confirm the fixed block landed correctly.
5. Capture a handwritten list with the photo input and watch Gemini Vision parse it.
6. Break down a large goal into subtasks.
7. Activate Clutch Mode for the emergency triage and spoken rescue plan.
8. Drop a task to trigger the replan recommendation.

## License

Built for the Vibe2Ship hackathon. All rights reserved by the author.

---

<div align="center">

Made for <strong>Vibe2Ship</strong> — Problem Statement 1: The Last-Minute Life Saver

</div>
