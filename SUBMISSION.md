# Clutch — The Last-Minute Life Saver
### Vibe2Ship Submission Document · Problem Statement 1

> **One line:** Clutch turns a panicked brain-dump into a prioritized, time-blocked, self-correcting plan — an autonomous agent that defends your deadlines instead of just chatting about them.

| | |
|---|---|
| **Problem statement** | P1 — The Last-Minute Life Saver |
| **Builder** | Parthiv (solo) · amparthiv94@gmail.com |
| **Live application** | https://clutch-433410067334.asia-south1.run.app/ |
| **GitHub repository** | https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver- |
| **Primary dev platform** | Google AI Studio (Gemini) |

---

## 1. The Problem

Everyone has had the same 11 PM moment: three deadlines, a head full of half-remembered tasks, and no idea where to start. The bottleneck isn't a lack of to-do apps — it's the **decision paralysis** of converting chaos into a concrete next move.

Existing productivity tools are passive. A to-do list stores what you type; a calendar holds blocks you place yourself; a chatbot answers when asked. **None of them do the hardest part for you** — looking at everything on your plate, deciding what actually matters right now, and committing it to a realistic schedule. When you fall behind (which is the *normal* case under deadline pressure), they sit there frozen, still showing the plan that already failed.

People in a last-minute crunch don't need another place to write tasks down. They need something that **thinks and acts on their behalf**: reads the mess, makes the call, blocks the time, and re-plans the moment reality diverges.

## 2. The Solution

**Clutch is an autonomous deadline-defense agent.** You dump everything on your plate in plain language (or a photo of a whiteboard or handwritten list); Clutch reasons in multiple steps and then *takes action* — structuring tasks, breaking big goals into subtasks, ranking them by urgency × importance, and time-blocking your day around your real working hours and energy peaks. Every autonomous action streams into a live **Agent Activity** feed so you can see it think.

The defining moment is what happens **when things go wrong**. Activate **Clutch Mode** — the panic button — and the agent performs an emergency triage: it tells you the single first step to take *right now*, what to do next, what's safe to drop, and talks you through it out loud. This is the "life saver" promise made literal.

Crucially, Clutch is a **genuine agent, not a chatbot wrapper**: a single brain-dump triggers a multi-step Gemini function-calling loop where the model autonomously chooses and chains tools, the server executes them with real IDs, and results are fed back until the plan is complete and coherent.

## 3. What Makes It a Real Agent (Agentic Depth)

Clutch runs an **iterative function-calling loop** with Gemini. The model is given a toolset and decides, on its own, which tools to call and in what order. The server executes each call, assigns real UUIDs, and feeds the results back into the next turn — so one user action produces a full chain of autonomous reasoning and mutation.

| Tool | Autonomous action the agent takes |
|---|---|
| `create_tasks` | Parses a free-text, voice, or photo brain-dump into structured tasks — title, time estimate, deadline, importance (1–5), and **cognitive load** (deep / light / admin) |
| `breakdown_goal` | Splits a large goal into ordered, actionable subtasks |
| `prioritize` | Ranks every task into **NOW / NEXT / LATER**, each with a one-line justification |
| `replan` | When you fall behind or drop something, proposes an explicit **keep / move / drop** plan |
| `rescue_triage` | **Clutch Mode** emergency mode — returns the first physical step, a do-now shortlist, "if you have time" items, and what to abandon |

**Beyond the LLM loop, the agent acts deterministically too.** A local **priority-driven scheduler** (`buildSchedule`) converts the agent's NOW/NEXT/LATER ranking into a real, packed timeline — honoring fixed-time commitments ("gym 4–6 PM" stays pinned), deep-work-first ordering, planning windows that cross midnight, and automatic overlap de-confliction. This means the plan *always* reflects current priorities and re-derives instantly on every change, with no extra model round-trip. The agent doesn't just suggest — **it commits the schedule.**

This is the difference between answering and *acting*: Clutch reasons over multiple steps, uses tools, and autonomously changes your plan — repeatedly, and on its own initiative when you fall behind.

## 4. Key Features

**Autonomous planning**
- **Brain-dump to plan in seconds** — text, voice, or photo (Gemini Vision reads a handwritten or whiteboard list) becomes a prioritized, time-blocked day
- **Goal breakdown** — turn one big goal into ordered subtasks with a click
- **Proactive re-planning** — fall behind and Clutch reshuffles, recommending exactly what to keep, move, or cut
- **Live Agent Activity feed** — watch every autonomous action as it happens

**Three signature differentiators**
- **Clutch Mode (panic button)** — one tap runs an emergency triage: the *single* first step, a do-now shortlist, what to drop, plus **"Clutch speaks"** — the plan read aloud via Google Cloud Text-to-Speech so you can move while you listen
- **Energy-aware scheduling** — Clutch knows your peak-focus window and front-loads **deep-cognitive** work into it, pushing admin and light tasks to the troughs
- **Now focus companion** — a calm, single-task "do this next" view that removes the rest of the list from sight when you're heads-down

**Persistence and sync**
- **Firestore-backed state** — your plan survives across devices and reloads
- **Google Calendar sync** — push the agent's time-blocks straight into your real calendar

**Experience**
- A premium light/teal interface with an ambient, cursor-reactive design language, a glassmorphic Clutch Mode button with a cursor-following light, a live "now" line on the timeline, and a responsive collapsible workspace

## 5. Google Technologies Utilized

Clutch is built **Google-first**, with Google AI Studio as the primary development platform.

| Google technology | How Clutch uses it |
|---|---|
| **Google AI Studio** | Primary platform — the agent was designed, prototyped, and iterated here |
| **Google Antigravity** | Google's agentic development platform — used to build, iterate, and engineer the application end to end |
| **Google Gemini API** (`@google/genai`, `gemini-2.5-flash`) | The reasoning core — drives the autonomous multi-step **function-calling loop** that powers all planning, prioritization, replanning, and rescue triage |
| **Gemini Vision (multimodal)** | Reads a **photo** of a handwritten or whiteboard task list and turns it into structured tasks |
| **Google Cloud Run** | Hosts the live, public, full-stack application (Node + Express) |
| **Google Cloud Build + Artifact Registry** | Container build and deploy pipeline for Cloud Run |
| **Google Cloud Secret Manager** | Stores the Gemini API key securely — never in code or the repo |
| **Google Cloud Text-to-Speech** (`en-US-Neural2-F`) | **"Clutch speaks"** — reads the rescue plan aloud during Clutch Mode |
| **Google Cloud Firestore** | Cross-device persistence of the user's tasks, plan, and settings |
| **Google Calendar API** | Pushes the agent's generated time-blocks into the user's real calendar |
| **Google Fonts** (Inter + Space Grotesk) | Typography |

## 6. Technical Implementation

- **Frontend:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion · lucide-react · date-fns
- **Backend:** Node.js + Express, `@google/genai` for the Gemini function-calling loop; esbuild server bundle
- **Architecture:** Client issues a brain-dump → Express `/api/agent` runs the iterative Gemini tool loop → server assigns real UUIDs and returns structured tasks → client's local `buildSchedule` deterministically derives the packed, conflict-free timeline from the agent's priorities
- **Resilience:** retry with exponential backoff on transient model errors, input validation, rate limiting, security headers, and friendly human-readable error classification
- **Endpoints:** `/api/agent` (agent loop + Vision), `/api/tts` (Cloud TTS), `/api/state/save` and `/api/state/load` (Firestore), `/api/config` (runtime Calendar client ID)
- **Deploy:** Google Cloud Run, Gemini key in Secret Manager, model configurable via `GEMINI_MODEL` env var

## 7. Demo Flow (for judging)

1. **Brain-dump** several tasks at once (include a deadline-heavy one like exam prep, and a fixed-time one like "gym 4–6 PM").
2. Watch Clutch **autonomously create structured tasks** in the Agent Activity feed.
3. Open **Priorities** — show NOW / NEXT / LATER, each with the agent's one-line reasoning.
4. Show the **time-blocked schedule** — note the fixed gym block landed correctly and deep work sits in the energy-peak window.
5. Try the **photo** input — capture a handwritten list and watch Gemini Vision turn it into tasks.
6. Click **Break down** on Exam prep to generate subtasks.
7. Activate **Clutch Mode** for the emergency triage and **"Clutch speaks"** reading it aloud.
8. **Drop** a task to show the replan keep/move/drop recommendation.
9. (Optional) **Add to Calendar** and show the blocks land in Google Calendar.

## 8. Why Clutch Wins on the Rubric

- **Problem Solving and Impact** — attacks the real bottleneck (decision paralysis under deadline pressure), not just task storage; Clutch Mode makes the impact visceral.
- **Agentic Depth** — a true multi-step function-calling loop with autonomous tool chaining *and* a deterministic scheduler that commits the plan; it acts, re-plans, and rescues on its own.
- **Innovation and Creativity** — Clutch Mode panic button, energy-aware deep-work scheduling, Now companion, and spoken rescue — features that go beyond any standard planner.
- **Google Technologies Usage** — eleven Google products across agentic development, AI, hosting, storage, voice, vision, and calendar, with AI Studio and Gemini at the core.
- **Product Experience and Design** — a polished, distinctive, cohesive interface that feels premium and calm under pressure.
- **Technical Implementation and Completeness** — deployed, persistent, resilient, and end-to-end functional.

---

*Built for **Vibe2Ship** (Coding Ninjas 10X Club × Google for Developers) — Problem Statement 1: The Last-Minute Life Saver.*
