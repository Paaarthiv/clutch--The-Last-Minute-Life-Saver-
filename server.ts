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
  description: "Break a large goal into ordered subtasks.",
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
    required: ["subtasks", "goalTitle"],
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

// Calls the Gemini API with automatic retry + exponential backoff on transient errors
// (503 overloaded, 429 rate-limit, 500 internal). This keeps the agent resilient during
// demos when the model is briefly busy.
async function generateWithRetry(params: any, maxRetries = 4): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      lastErr = err;
      const status = err?.status;
      // A per-DAY free-tier quota error won't recover by retrying — fail fast so the user
      // sees it immediately instead of waiting through backoff.
      const isDailyQuota = status === 429 && /per\s*day/i.test(String(err?.message || ""));
      const transient = (status === 503 || status === 429 || status === 500) && !isDailyQuota;
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
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Agent Endpoint
  app.post("/api/agent", async (req, res) => {
    try {
      const { text, context, actionTrigger } = req.body;
      
      let state = {
        tasks: [...(context?.tasks || [])],
        schedule: [...(context?.schedule || [])],
      };
      let activityLog: string[] = [];
      let replan = null;
      let finalMessage = "";

      let systemInstruction = `You are Clutch, a premium autonomous AI productivity agent. You help the user plan their day, break down goals, and beat deadlines.
You do NOT just generate text. You call tools to update the user's state directly.
When the user adds or changes tasks, in the SAME turn you MUST: (1) call create_tasks, then after you receive the created tasks with their ids, (2) call prioritize over ALL current tasks assigning each a category of NOW, NEXT, or LATER with a short one-line reason, then (3) call schedule_blocks to time-block the NOW and NEXT tasks across today's available hours (9 AM–6 PM), avoiding overlaps.
Always use the EXACT task ids you were given. Only use replan when the user reports being late or drops a task.
Be efficient: call each tool AT MOST ONCE per request. Do not repeat a tool you have already called this turn.`;

      let contents: Content[] = [
        {
          role: "user",
          parts: [{ text: text || (actionTrigger ? `[System Trigger] ${actionTrigger}` : "Analyze my tasks.") }]
        }
      ];

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
            if (call.name === "create_tasks") {
              const newTasksWithIds = args.tasks.map((t: any) => ({
                ...t,
                id: crypto.randomUUID(),
                status: "idle",
                category: "LATER",
                createdAt: Date.now(),
              }));
              state.tasks.push(...newTasksWithIds);
              activityLog.push(`Created ${newTasksWithIds.length} new task(s).`);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { createdTasks: newTasksWithIds }
                }
              });
            } else if (call.name === "breakdown_goal") {
              const newSubtasks = args.subtasks.map((st: any) => ({
                ...st,
                id: crypto.randomUUID(),
                status: "idle",
                category: "NEXT",
                reason: `Subtask of ${args.goalTitle}`,
                createdAt: Date.now(),
                parentId: args.parentTaskId,
              }));
              state.tasks.push(...newSubtasks);
              activityLog.push(`Broke down '${args.goalTitle}' into ${newSubtasks.length} steps.`);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { createdSubtasks: newSubtasks }
                }
              });
            } else if (call.name === "prioritize") {
              let updatedCount = 0;
              for (const p of args.prioritizedTasks) {
                const taskIndex = state.tasks.findIndex((t: any) => t.id === p.taskId);
                if (taskIndex !== -1) {
                  state.tasks[taskIndex] = { ...state.tasks[taskIndex], category: p.category, reason: p.reason };
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
              state.schedule = args.schedule;
              activityLog.push(`Scheduled ${args.schedule.length} time blocks.`);
              functionResponses.push({
                functionResponse: {
                  name: call.name,
                  response: { success: true }
                }
              });
            } else if (call.name === "replan") {
              replan = args.plan;
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
      res.status(500).json({ error: error?.message || String(error) });
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
