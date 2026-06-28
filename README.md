<div align="center">

# Clutch

### The Last-Minute Life Saver

**An autonomous AI productivity agent that turns a messy brain-dump into a prioritized, time-blocked, self-correcting plan.**

[Live Application](https://clutch-433410067334.asia-south1.run.app/) · [GitHub Repository](https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver-)

Built for **Vibe2Ship 2026** by Coding Ninjas 10X Club x Google for Developers  
Problem Statement 1: **The Last-Minute Life Saver**

</div>

---

## Overview

Students, professionals, and entrepreneurs often miss deadlines not because they do not care, but because passive reminders do not help them decide what to do next. Clutch solves that problem by acting as an AI-powered deadline-defense companion.

Users can brain-dump tasks in plain language, speak them, or upload a photo of a handwritten or whiteboard task list. Clutch uses Gemini to structure the mess into tasks, prioritize them into NOW / NEXT / LATER, break down large goals, and create a realistic schedule around working hours, fixed commitments, and peak-focus windows.

When the user falls behind, Clutch Mode runs an emergency triage: it tells the user the first physical step to take, what to keep, what to move, what to drop, and can speak the rescue plan aloud.

## Why This Is an Agent

Clutch is not a chatbot wrapper. The backend runs an iterative Gemini function-calling loop. Gemini receives a toolset, decides which tool to call, the server executes that action, and the result is fed back into the next reasoning turn until the plan is complete.

| Tool | Autonomous action |
| --- | --- |
| `create_tasks` | Converts text, voice, or image brain-dumps into structured tasks with estimates, deadlines, importance, and cognitive load. |
| `breakdown_goal` | Splits a large task into ordered subtasks. |
| `prioritize` | Ranks tasks into NOW / NEXT / LATER with a short reason. |
| `replan` | Suggests keep / move / drop decisions when plans change. |
| `rescue_triage` | Powers Clutch Mode with an emergency first step and rescue shortlist. |

After the AI reasoning step, a deterministic scheduler builds the timeline. It respects fixed-time tasks, supports planning windows that cross midnight, prioritizes deep work during the peak-energy window, and resolves overlaps.

## Key Features

- Brain-dump to structured task plan using Gemini.
- Voice input for fast task capture.
- Gemini Vision support for handwritten or whiteboard task lists.
- NOW / NEXT / LATER prioritization with reasons.
- Goal breakdown into subtasks.
- Energy-aware time-blocked schedule.
- Fixed-time commitment handling, such as "gym 6 PM to 8 PM".
- Clutch Mode emergency rescue flow.
- Spoken rescue summaries using Google Cloud Text-to-Speech.
- Google Calendar sync for planned blocks.
- Firestore persistence for tasks, settings, archive, and state.
- Live Agent Activity feed showing what the agent is doing.
- Polished landing page and responsive dashboard experience.

## Google Technologies Used

| Google technology | Usage |
| --- | --- |
| Google AI Studio | Gemini API key, model experimentation, and primary AI development workflow. |
| Google Gemini API | Agent reasoning, prioritization, planning, replanning, and rescue triage. |
| Gemini Vision | Reads task lists from images. |
| Google Cloud Run | Hosts the deployed full-stack application. |
| Google Cloud Build | Builds the application from source for Cloud Run. |
| Artifact Registry | Stores built Cloud Run container images. |
| Secret Manager | Stores the Gemini API key securely. |
| Firestore | Persists user state and settings. |
| Cloud Text-to-Speech | Speaks Clutch Mode and agent summaries aloud. |
| Google Calendar API | Adds generated schedule blocks to the user's calendar. |
| Google Fonts | Typography for the landing page and app UI. |

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Motion, lucide-react, date-fns |
| Backend | Node.js, Express, TypeScript, esbuild |
| AI | `@google/genai`, Gemini 2.5 Flash |
| Google Cloud | Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firestore, Cloud Text-to-Speech, Calendar API |

## Local Setup

```bash
git clone https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver-.git
cd clutch--The-Last-Minute-Life-Saver-
npm install
```

Create `.env.local`:

```bash
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
GOOGLE_CALENDAR_CLIENT_ID=your_calendar_oauth_client_id
```

Run locally:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Deployment

The final deployable link must be hosted on Google Cloud. This project is Cloud Run-ready.

```bash
gcloud run deploy clutch \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --clear-base-image \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash,GOOGLE_CALENDAR_CLIENT_ID=YOUR_GOOGLE_CALENDAR_CLIENT_ID \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full Cloud Shell guide.

## Submission Demo Flow

1. Brain-dump multiple tasks at once, including one fixed-time commitment such as "gym 6 PM to 8 PM".
2. Show the Agent Activity feed creating and prioritizing tasks.
3. Show the main Today plan with NOW / NEXT / LATER and the timeline.
4. Break down a large task such as "Exam prep".
5. Add the plan to Google Calendar.
6. Trigger Clutch Mode and show the spoken rescue summary.
7. Drop or complete a task and show replanning.
8. Reload the page to show Firestore persistence.

## Repository Structure

```text
.
├── server.ts
├── src/
│   ├── AgentContext.tsx
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── IntroScreen.tsx
│   │   └── ParticleSphere.tsx
│   ├── lib/
│   └── types.ts
├── public/
├── DEPLOYMENT.md
├── SUBMISSION.md
├── Dockerfile
└── package.json
```

## Security Notes

- Gemini API key is loaded from environment variables or Secret Manager.
- `.env.local` is git-ignored.
- Cloud Run receives `GEMINI_API_KEY` through Secret Manager, not source code.
- Basic request size limits, rate limits, and security headers are implemented on the Express server.
- Calendar access uses Google OAuth in the browser and requests Calendar event scope only.

## License

Built for the Vibe2Ship 2026 hackathon. All rights reserved by the author.
