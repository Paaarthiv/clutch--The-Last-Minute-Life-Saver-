import express from "express";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, FunctionDeclaration, Content } from "@google/genai";

// Load environment variables for local dev (.env.local first, then .env as fallback) so that
// GEMINI_API_KEY is available when running via `npm run dev`. In the AI Studio preview the key
// is injected automatically, so this is a no-op there.
dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error(
    "[Clutch] GEMINI_API_KEY is not set. Create a .env.local file with GEMINI_API_KEY=your_key"
  );
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

const createTasksDeclaration: FunctionDeclaration = {
  name: "create_tasks",
  description: "Create new tasks based on user input. Important: Estimate realistic minutes.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            estimated_minutes: { type: Type.NUMBER },
            deadline: { type: Type.STRING, description: "ISO string or human readable like 'Today 5pm'" },
            importance: { type: Type.NUMBER, description: "1-5 scale, 5 is most important" },
          },
          required: ["title", "estimated_minutes", "importance"],
        },
      },
    },
    required: ["tasks"],
  },
};

const breakdownGoalDeclaration: FunctionDeclaration = {
  name: "breakdown_goal",
  description: "Break a large existing goal into ordered subtasks. Always include the exact parentTaskId when provided.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      subtasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            estimated_minutes: { type: Type.NUMBER },
            order: { type: Type.NUMBER },
          },
          required: ["title", "estimated_minutes", "order"],
        },
      },
      goalTitle: { type: Type.STRING },
      parentTaskId: { type: Type.STRING, description: "The ID of the task being broken down if applicable" },
    },
    required: ["subtasks", "goalTitle", "parentTaskId"],
  },
};

const prioritizeDeclaration: FunctionDeclaration = {
  name: "prioritize",
  description: "Prioritize tasks ranked by urgency times importance. Returns ranked lists.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prioritizedTasks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            taskId: { type: Type.STRING },
            reason: { type: Type.STRING, description: "One-line italicized reasoning for this rank" },
            category: { type: Type.STRING, description: "'NOW', 'NEXT', or 'LATER'" },
          },
          required: ["taskId", "reason", "category"],
        },
      },
    },
    required: ["prioritizedTasks"],
  },
};

const scheduleBlocksDeclaration: FunctionDeclaration = {
  name: "schedule_blocks",
  description: "Schedule tasks into time blocks during the available hours.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      schedule: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            taskId: { type: Type.STRING },
            title: { type: Type.STRING },
            startTime: { type: Type.STRING, description: "HH:mm format (24h)" },
            endTime: { type: Type.STRING, description: "HH:mm format (24h)" },
          },
          required: ["taskId", "title", "startTime", "endTime"],
        },
      },
    },
    required: ["schedule"],
  },
};

const replanDeclaration: FunctionDeclaration = {
  name: "replan",
  description: "Re-plan schedule when user marks a task late. Decides what to keep, move to tomorrow, or drop.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      plan: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING, description: "Agent message to user, e.g. '3 hours left, dropping 1 task.'" },
          keep: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of taskIds to keep for today" },
          move: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of taskIds to delay to tomorrow" },
          drop: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of taskIds to drop completely" },
        },
        required: ["message", "keep", "move", "drop"],
      },
    },
    required: ["plan"],
  },
};

// Model is configurable via GEMINI_MODEL in .env.local (no code edit needed to switch).
// Default is a free-tier model; set GEMINI_MODEL=gemini-2.5-flash once billing is enabled
// for stronger, more reliable multi-step agent behavior.
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
const MAX_AGENT_TEXT_CHARS = Number(process.env.MAX_AGENT_TEXT_CHARS) || 6000;
const MAX_ACTION_TRIGGER_CHARS = 1000;
const MAX_CONTEXT_TASKS = Number(process.env.MAX_CONTEXT_TASKS) || 80;
const MAX_CONTEXT_SCHEDULE_BLOCKS = Number(process.env.MAX_CONTEXT_SCHEDULE_BLOCKS) || 120;
const AGENT_RATE_LIMIT_WINDOW_MS = 60_000;
const AGENT_RATE_LIMIT_MAX = Number(process.env.AGENT_RATE_LIMIT_PER_MINUTE) || 8;

type AgentErrorInfo = {
  status: number;
  code: string;
  message: string;
};

type RateLimitBucket = {
  resetAt: number;
  count: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

function toSafeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function coerceHour(value: unknown, fallback: number): number {
  return Math.trunc(clampNumber(value, fallback, 0, 23));
}

function normalizeContext(context: any) {
  const tasks = Array.isArray(context?.tasks) ? context.tasks.slice(0, MAX_CONTEXT_TASKS) : [];
  const schedule = Array.isArray(context?.schedule)
    ? context.schedule.slice(0, MAX_CONTEXT_SCHEDULE_BLOCKS)
    : [];

  return {
    tasks: tasks
      .map((task: any) => {
        const id = toSafeString(task?.id, 100);
        const title = toSafeString(task?.title, 180);
        if (!id || !title) return null;
        return {
          id,
          title,
          estimated_minutes: clampNumber(task?.estimated_minutes, 30, 1, 1440),
          deadline: toSafeString(task?.deadline, 120) || undefined,
          importance: Math.trunc(clampNumber(task?.importance, 3, 1, 5)),
          status: ["idle", "done", "dropped"].includes(task?.status) ? task.status : "idle",
          category: ["NOW", "NEXT", "LATER"].includes(task?.category) ? task.category : "LATER",
          reason: toSafeString(task?.reason, 240),
          createdAt: Number.isFinite(task?.createdAt) ? task.createdAt : Date.now(),
          parentId: toSafeString(task?.parentId, 100) || undefined,
        };
      })
      .filter(Boolean),
    schedule: schedule
      .map((block: any) => ({
        taskId: toSafeString(block?.taskId, 100),
        title: toSafeString(block?.title, 180),
        startTime: toSafeString(block?.startTime, 20),
        endTime: toSafeString(block?.endTime, 20),
      }))
      .filter((block: any) => block.taskId && block.title),
  };
}

function normalizeGeneratedTask(task: any) {
  return {
    title: toSafeString(task?.title, 180) || "Untitled task",
    estimated_minutes: clampNumber(task?.estimated_minutes, 30, 1, 1440),
    deadline: toSafeString(task?.deadline, 120) || undefined,
    importance: Math.trunc(clampNumber(task?.importance, 3, 1, 5)),
    id: crypto.randomUUID(),
    status: "idle",
    category: "LATER",
    reason: "",
    createdAt: Date.now(),
  };
}

function normalizeGeneratedSubtask(subtask: any, goalTitle: string, parentTaskId: string) {
  return {
    title: toSafeString(subtask?.title, 180) || "Untitled step",
    estimated_minutes: clampNumber(subtask?.estimated_minutes, 30, 1, 1440),
    order: clampNumber(subtask?.order, 0, 0, 1000),
    id: crypto.randomUUID(),
    status: "idle",
    category: "NEXT",
    reason: `Subtask of ${goalTitle}`,
    createdAt: Date.now(),
    parentId: parentTaskId || undefined,
  };
}

function getBreakdownTarget(text: string, tasks: any[]) {
  if (!/break\s*down|subtasks?|smaller\s+steps?/i.test(text)) return null;

  const idMatch = text.match(/parentTaskId\s*(?:IS|is|:)\s*([A-Za-z0-9_-]+)/);
  const parentTaskId = idMatch?.[1] || "";
  const task = tasks.find((t: any) => t.id === parentTaskId);
  if (task) {
    return {
      id: task.id,
      title: task.title,
      estimatedMinutes: task.estimated_minutes,
      importance: task.importance,
      deadline: task.deadline,
    };
  }

  const quotedTitle = text.match(/["“]([^"”]+)["”]/)?.[1];
  if (quotedTitle) {
    const title = quotedTitle.toLowerCase();
    const titleTask = tasks.find((t: any) => String(t.title || "").toLowerCase() === title);
    if (titleTask) {
      return {
        id: titleTask.id,
        title: titleTask.title,
        estimatedMinutes: titleTask.estimated_minutes,
        importance: titleTask.importance,
        deadline: titleTask.deadline,
      };
    }
  }

  return null;
}

function classifyAgentError(err: any): AgentErrorInfo {
  const status = Number(err?.status || err?.code || 500);
  const raw = String(err?.message || err);

  if (status === 429 && /prepay|prepayment|credits?\s+are\s+depleted|billing|depleted/i.test(raw)) {
    return {
      status: 429,
      code: "GEMINI_BILLING_CREDITS_DEPLETED",
      message: "Gemini billing credits are depleted for this API key's AI Studio project.",
    };
  }

  if (status === 429 || /quota|RESOURCE_EXHAUSTED/i.test(raw)) {
    return {
      status: 429,
      code: "GEMINI_RATE_LIMIT",
      message: "Gemini rate limit reached. Try again shortly or move this API key's project to a paid tier.",
    };
  }

  if (status === 401 || status === 403 || /api[_ ]?key|permission|unauthenticated|forbidden/i.test(raw)) {
    return {
      status: 502,
      code: "GEMINI_AUTH",
      message: "Gemini API key or project permissions need attention.",
    };
  }

  if (status === 503 || /UNAVAILABLE|overload|busy|high demand/i.test(raw)) {
    return {
      status: 503,
      code: "GEMINI_BUSY",
      message: "Gemini is busy right now. Please try again shortly.",
    };
  }

  return {
    status: status >= 400 && status < 600 ? status : 500,
    code: "AGENT_ERROR",
    message: "The agent hit an error. Please try again.",
  };
}

// Calls the Gemini API with automatic retry + exponential backoff on transient server errors.
// Quota and billing 429s fail fast because immediate retries only add latency.
async function generateWithRetry(params: any, maxRetries = 2): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastErr = err;
      const status = err?.status;
      // A per-DAY free-tier quota error won't recover by retrying — fail fast so the user
      // sees it immediately instead of waiting through backoff.
      const transient = status === 503 || status === 500;
      if (!transient || attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 8000) + Math.random() * 400;
      console.warn(
        `[Clutch] model busy (status ${status}); retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "256kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
    next();
  });

  app.use("/api/agent", (req, res, next) => {
    const now = Date.now();
    const clientId = req.ip || req.socket.remoteAddress || "unknown";
    const bucket = rateLimitBuckets.get(clientId);

    if (!bucket || bucket.resetAt <= now) {
      rateLimitBuckets.set(clientId, { count: 1, resetAt: now + AGENT_RATE_LIMIT_WINDOW_MS });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > AGENT_RATE_LIMIT_MAX) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "Too many planning requests. Please wait a moment.", code: "LOCAL_RATE_LIMIT" });
      return;
    }

    if (rateLimitBuckets.size > 10000) {
      for (const [key, value] of rateLimitBuckets) {
        if (value.resetAt <= now) rateLimitBuckets.delete(key);
      }
    }

    next();
  });

  // Agent Endpoint
  app.post("/api/agent", async (req, res) => {
    try {
      const { text, context, actionTrigger, now, workStart, workEnd } = req.body;
      const safeText = toSafeString(text, MAX_AGENT_TEXT_CHARS);
      const safeActionTrigger = toSafeString(actionTrigger, MAX_ACTION_TRIGGER_CHARS);

      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({ error: "Gemini API key is not configured.", code: "MISSING_GEMINI_API_KEY" });
        return;
      }

      if (text != null && typeof text !== "string") {
        res.status(400).json({ error: "Planning text must be a string.", code: "BAD_REQUEST" });
        return;
      }

      const safeContext = normalizeContext(context);
      let state = {
        tasks: [...safeContext.tasks],
        schedule: [...safeContext.schedule],
      };
      let activityLog: string[] = [];
      let replan = null;
      let finalMessage = "";
      const breakdownTarget = getBreakdownTarget(safeText || safeActionTrigger, state.tasks);

      // Real-time scheduling context. The plan must start from the user's actual current time
      // (never schedule blocks in the past) and stay within their configured working hours.
      const startH = coerceHour(workStart, 9);
      const endH = coerceHour(workEnd, 18);
      const pad = (n: number) => String(n).padStart(2, "0");
      const nowTime: string = typeof now === "string" && /^\d{1,2}:\d{2}$/.test(now)
        ? now
        : `${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
      const fmtH = (h: number) => `${pad(h)}:00`;

      let systemInstruction = `You are Clutch, a premium autonomous AI productivity agent. You help the user plan their day, break down goals, and beat deadlines.
You do NOT just generate text. You call tools to update the user's state directly.
When the user asks to break down an existing task, you MUST call breakdown_goal with 3-6 concrete, ordered subtasks. Do not ask the user for subtasks. Use the exact parentTaskId if one is provided.
When the user adds or changes tasks, in the SAME turn you MUST: (1) call create_tasks, then after you receive the created tasks with their ids, (2) call prioritize over ALL current tasks assigning each a category of NOW, NEXT, or LATER with a short one-line reason, then (3) call schedule_blocks to time-block EVERY task into the day, avoiding overlaps.
SCHEDULING TIME RULES (critical): Schedule ALL tasks — NOW first, then NEXT, then LATER — so every task gets a time block (none should be left off the plan). The user's current local time is ${nowTime}. Working hours are ${fmtH(startH)}–${fmtH(endH)}. Schedule the first block starting at the LATER of the current time (${nowTime}) or ${fmtH(startH)} — NEVER schedule a block earlier than the current time. Pack blocks back-to-back from there, in 24h HH:mm. Prefer to fit everything within working hours, but if the day runs out of time you may continue past ${fmtH(endH)} so that LATER tasks still appear on the plan.
Always use the EXACT task ids you were given. Only use replan when the user reports being late or drops a task.
Be efficient: call each tool AT MOST ONCE per request. Do not repeat a tool you have already called this turn.`;

      if (breakdownTarget) {
        systemInstruction += `\n\nBREAKDOWN REQUEST MODE: The user clicked Break down for this existing task: ${JSON.stringify(breakdownTarget)}. In this turn, call breakdown_goal exactly once. Use parentTaskId "${breakdownTarget.id}" and goalTitle "${breakdownTarget.title}". Create practical subtasks that add up roughly to the parent estimate when possible. Do not call create_tasks for this request and do not ask a follow-up question.`;
      }

      let contents: Content[] = [
        {
          role: "user",
          parts: [{ text: safeText || (safeActionTrigger ? `[System Trigger] ${safeActionTrigger}` : "Analyze my tasks.") }]
        }
      ];
      const calledTools = new Set<string>();

      for (let i = 0; i < 6; i++) {
        // Build dynamic system instruction with latest context
        const dynamicInstruction = systemInstruction + `\n\nCurrent State Context:\n${JSON.stringify({tasks: state.tasks, schedule: state.schedule}, null, 2)}`;

        const response = await generateWithRetry({
          model: MODEL,
          contents,
          config: {
            systemInstruction: dynamicInstruction,
            tools: [
              {
                functionDeclarations: [
                  createTasksDeclaration,
                  breakdownGoalDeclaration,
                  prioritizeDeclaration,
                  scheduleBlocksDeclaration,
                  replanDeclaration,
                ],
              },
            ],
            temperature: 0.2, // Low temperature for deterministic planning
          },
        });

        const functionCalls = response.functionCalls || [];
        const textResponse = response.text || "";
        if (textResponse) {
          finalMessage = textResponse;
        }

        if (functionCalls.length === 0) {
          break; // Stop loop if no function calls
        }

        // Add model's response part containing function calls to contents
        contents.push({
          role: "model",
          parts: [
            ...(textResponse ? [{ text: textResponse }] : []),
            ...functionCalls.map(fc => ({ functionCall: fc }))
          ]
        });

        // Execute function calls
        const functionResponses = [];
        for (const call of functionCalls) {
          const args = call.args as any;
          try {
            if (calledTools.has(call.name || "")) {
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { error: "Tool already called this turn. Use the current state and continue." }
                }
              });
              continue;
            }
            calledTools.add(call.name || "");

            if (call.name === "create_tasks") {
              const newTasksWithIds = (Array.isArray(args.tasks) ? args.tasks : [])
                .slice(0, 20)
                .map(normalizeGeneratedTask);
              state.tasks.push(...newTasksWithIds);
              activityLog.push(`Created ${newTasksWithIds.length} new task(s).`);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { createdTasks: newTasksWithIds }
                }
              });
            } else if (call.name === "breakdown_goal") {
              const goalTitle = toSafeString(args.goalTitle, 180) || breakdownTarget?.title || "goal";
              const parentTaskId = toSafeString(args.parentTaskId, 100) || breakdownTarget?.id || "";
              const newSubtasks = (Array.isArray(args.subtasks) ? args.subtasks : [])
                .slice(0, 20)
                .map((st: any) => normalizeGeneratedSubtask(st, goalTitle, parentTaskId));
              state.tasks.push(...newSubtasks);
              activityLog.push(`Broke down '${goalTitle}' into ${newSubtasks.length} steps.`);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { createdSubtasks: newSubtasks }
                }
              });
            } else if (call.name === "prioritize") {
              let updatedCount = 0;
              for (const p of (Array.isArray(args.prioritizedTasks) ? args.prioritizedTasks : []).slice(0, MAX_CONTEXT_TASKS)) {
                const category = ["NOW", "NEXT", "LATER"].includes(p.category) ? p.category : "LATER";
                const taskIndex = state.tasks.findIndex((t: any) => t.id === toSafeString(p.taskId, 100));
                if (taskIndex !== -1) {
                  state.tasks[taskIndex] = {
                    ...state.tasks[taskIndex],
                    category,
                    reason: toSafeString(p.reason, 240),
                  };
                  updatedCount++;
                }
              }
              activityLog.push(`Prioritized ${updatedCount} tasks.`);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { success: true, updatedCount }
                }
              });
            } else if (call.name === "schedule_blocks") {
              const taskIds = new Set(state.tasks.map((task: any) => task.id));
              state.schedule = (Array.isArray(args.schedule) ? args.schedule : [])
                .slice(0, MAX_CONTEXT_SCHEDULE_BLOCKS)
                .map((block: any) => ({
                  taskId: toSafeString(block.taskId, 100),
                  title: toSafeString(block.title, 180),
                  startTime: toSafeString(block.startTime, 20),
                  endTime: toSafeString(block.endTime, 20),
                }))
                .filter((block: any) => taskIds.has(block.taskId) && /^\d{1,2}:\d{2}$/.test(block.startTime) && /^\d{1,2}:\d{2}$/.test(block.endTime));
              activityLog.push(`Scheduled ${state.schedule.length} time blocks.`);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { success: true }
                }
              });
            } else if (call.name === "replan") {
              const knownIds = new Set(state.tasks.map((task: any) => task.id));
              const cleanIds = (ids: any) => (Array.isArray(ids) ? ids : [])
                .map((id: any) => toSafeString(id, 100))
                .filter((id: string) => knownIds.has(id));
              replan = {
                message: toSafeString(args.plan?.message, 240),
                keep: cleanIds(args.plan?.keep),
                move: cleanIds(args.plan?.move),
                drop: cleanIds(args.plan?.drop),
              };
              activityLog.push("Initiated re-plan protocol.");
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { success: true }
                }
              });
            }
          } catch (e) {
            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: { error: String(e) }
              }
            });
          }
        }

        // Add function responses back
        contents.push({
          role: "user",
          parts: functionResponses
        });
      }

      res.json({
        tasks: state.tasks,
        schedule: state.schedule,
        replan,
        activity: activityLog,
        message: finalMessage,
      });

    } catch (error: any) {
      console.error("[Clutch] /api/agent error:", error);
      const agentError = classifyAgentError(error);
      res.status(agentError.status).json({ error: agentError.message, code: agentError.code });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
