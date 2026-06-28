# Clutch - The Last-Minute Life Saver

## Vibe2Ship 2026 Submission Document

| Field | Details |
| --- | --- |
| Problem Statement Selected | Problem Statement 1 - The Last-Minute Life Saver |
| Project Name | Clutch |
| Builder | Parthiv A M |
| Live Application | https://clutch-433410067334.asia-south1.run.app/ |
| GitHub Repository | https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver- |

## 1. Problem Statement Selected

**Problem Statement 1: The Last-Minute Life Saver**

Students, professionals, and entrepreneurs frequently miss deadlines, assignments, meetings, bill payments, interviews, and important commitments. Existing productivity tools often rely on passive reminders that are easy to ignore and do little to help users actually complete their tasks.

The challenge is to build an AI-powered productivity companion that proactively assists users in planning, prioritizing, and completing tasks before deadlines are missed.

## 2. Solution Overview

Clutch is an autonomous AI productivity companion that turns a messy brain-dump into a prioritized, time-blocked, self-correcting plan.

Instead of acting like a passive to-do list, Clutch helps the user decide what to do next. The user can type tasks, speak tasks, or upload a photo of a handwritten or whiteboard task list. Clutch then uses Gemini to extract structured tasks, rank them by urgency and importance, break down large goals, and build a realistic daily timeline.

When the user falls behind, Clutch Mode acts like a panic button. It performs an emergency triage and tells the user the first physical step to take, what to keep, what to move, and what can be dropped. It can also speak the rescue plan aloud using Google Cloud Text-to-Speech.

The goal is simple: Clutch does not just remind users about deadlines. It helps them act before the deadline is missed.

## 3. Key Features

### Autonomous task planning

- Converts a plain-language brain-dump into structured tasks.
- Extracts time estimates, importance, urgency, deadlines, and cognitive load.
- Handles bulk planning and individual task additions.
- Supports fixed-time commitments such as "gym from 6 PM to 8 PM".

### Intelligent prioritization

- Ranks tasks into NOW / NEXT / LATER.
- Gives a short reason for prioritization.
- Keeps the prioritized plan visible on the main Today page.

### Time-blocked daily plan

- Builds a schedule around user-defined working hours.
- Respects peak-energy windows for deep work.
- Protects fixed commitments.
- Resolves overlaps and rebuilds the plan when tasks change.

### Goal breakdown

- Breaks large tasks such as "Exam prep" into ordered subtasks.
- Keeps breakdowns inside the existing planned time window instead of randomly changing the timeline.

### Clutch Mode rescue

- Provides an emergency first step when the user is overwhelmed.
- Suggests what to keep, move, or drop.
- Speaks the rescue plan aloud.

### Google Calendar integration

- Lets users add generated schedule blocks to Google Calendar.
- Uses Google OAuth and the Calendar API.

### Voice and image support

- Voice input for fast capture.
- Cloud Text-to-Speech for spoken agent responses.
- Gemini Vision support for reading task lists from images.

### Persistence

- Firestore stores tasks, settings, archive, and user state.
- The plan survives reloads and can restore across sessions.

### Product experience

- Polished landing page for judges.
- Calm dashboard interface for deadline pressure.
- Live Agent Activity feed that makes the agent's actions visible.

## 4. Agentic Depth

Clutch is designed as an agent, not just a chatbot.

The backend runs a Gemini function-calling loop. Gemini receives tool definitions, decides which tool to call, the server executes the tool, and the result is returned to Gemini for the next reasoning step. This allows one user action to trigger a multi-step autonomous workflow.

| Agent tool | What it does |
| --- | --- |
| `create_tasks` | Turns a text, voice, or image brain-dump into structured tasks. |
| `breakdown_goal` | Splits a large goal into actionable subtasks. |
| `prioritize` | Ranks tasks into NOW / NEXT / LATER. |
| `replan` | Suggests keep / move / drop changes when the plan changes. |
| `rescue_triage` | Powers Clutch Mode and creates an emergency rescue plan. |

The app also includes a deterministic scheduler. After Gemini creates and prioritizes tasks, the local scheduler builds a conflict-free timeline. It respects fixed-time tasks, working hours, peak-energy windows, and overlapping tasks.

This combination gives Clutch both reasoning depth and reliable execution.

## 5. Technologies Used

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS v4
- Motion
- lucide-react
- date-fns

### Backend

- Node.js
- Express
- TypeScript
- esbuild

### AI and cloud

- Google Gemini API
- Gemini Vision
- Google Cloud Run
- Google Cloud Build
- Artifact Registry
- Secret Manager
- Firestore
- Google Cloud Text-to-Speech
- Google Calendar API

## 6. Google Technologies Utilized

| Google technology | How it is used |
| --- | --- |
| Google AI Studio | Used for Gemini API setup, model experimentation, and AI development workflow. |
| Google Gemini API | Powers the agent reasoning loop, task extraction, prioritization, replanning, and rescue triage. |
| Gemini Vision | Reads photos of handwritten or whiteboard task lists. |
| Google Cloud Run | Hosts the final public deployable application. |
| Cloud Build | Builds and deploys the app from source. |
| Artifact Registry | Stores Cloud Run container images. |
| Secret Manager | Stores the Gemini API key securely. |
| Firestore | Persists task data, archive, plan state, and settings. |
| Cloud Text-to-Speech | Reads Clutch Mode and agent responses aloud. |
| Google Calendar API | Adds planned time blocks to the user's Google Calendar. |
| Google Fonts | Provides app typography. |

## 7. Evaluation Rubric Alignment

### Problem Solving and Impact

Clutch solves a real productivity pain: people do not only need reminders, they need help deciding what action to take before a deadline is missed.

### Agentic Depth

The app uses a multi-step Gemini function-calling loop, autonomous tools, deterministic scheduling, replanning, and rescue triage.

### Innovation and Creativity

Clutch Mode, spoken rescue plans, energy-aware scheduling, image-to-task capture, and calendar sync make the product more proactive than a normal task manager.

### Google Technologies

The solution uses Gemini, AI Studio, Cloud Run, Firestore, Cloud Text-to-Speech, Calendar API, Secret Manager, Cloud Build, and Artifact Registry.

### Product Experience and Design

The interface is designed to feel calm during deadline pressure. The landing page explains the product professionally, and the dashboard focuses on action.

### Technical Implementation

The project has a full React frontend, Express backend, Gemini tool-calling loop, Google Cloud deployment, Firestore persistence, Calendar integration, and Cloud TTS.

### Completeness and Usability

The app is deployed, functional, publicly accessible, and ready for demo.

## 8. Demo Script

1. Open the deployed Clutch link.
2. Enter a brain-dump such as: "I need to learn Git, learn Linux, buy groceries, and go to gym from 6 PM to 8 PM."
3. Show how Clutch creates structured tasks and fills the Agent Activity feed.
4. Show the Today plan with NOW / NEXT / LATER and the time-blocked schedule.
5. Click breakdown on a large task such as exam prep.
6. Add the generated blocks to Google Calendar.
7. Trigger Clutch Mode and play the spoken rescue response.
8. Drop or complete a task and show the replan behavior.
9. Reload the page to show Firestore persistence.

## 9. Submission Checklist

- Deployed Application Link: https://clutch-433410067334.asia-south1.run.app/
- GitHub Repository Link: https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver-
- Google Doc: make public with "Anyone with the link can view"
- Deployment platform: Google Cloud Run
- Problem Statement: Problem Statement 1 - The Last-Minute Life Saver

## 10. Final One-Line Pitch

Clutch is an AI deadline-defense agent that turns chaos into action: it plans your day, protects your deadlines, rescues you when you fall behind, and helps you actually finish the work.
