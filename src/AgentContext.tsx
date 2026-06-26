import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PrioritizedTask, ScheduledBlock, AgentAction, ReplanState } from "./types";

export interface Settings {
  workStart: number; // hour, 0-23
  workEnd: number;   // hour, 0-23
  voiceEnabled: boolean;
}
const DEFAULT_SETTINGS: Settings = { workStart: 9, workEnd: 18, voiceEnabled: true };

interface AppState {
  tasks: PrioritizedTask[];
  schedule: ScheduledBlock[];
  activityFeed: AgentAction[];
  isThinking: boolean;
  replanState: ReplanState | null;
  hasSeenIntro: boolean;
  settings: Settings;
}

interface AgentContextType extends AppState {
  setTasks: React.Dispatch<React.SetStateAction<PrioritizedTask[]>>;
  setSchedule: React.Dispatch<React.SetStateAction<ScheduledBlock[]>>;
  executeAgentAction: (text: string, contextOverride?: any, actionTrigger?: string) => Promise<void>;
  markTaskStatus: (taskId: string, status: "done" | "dropped") => void;
  resolveReplan: (approved: boolean) => void;
  dismissIntro: () => void;
  updateSettings: (patch: Partial<Settings>) => void;
  restoreTask: (id: string) => void;
  deleteTask: (id: string) => void;
  clearAllData: () => void;
  goHome: () => void;
}

// Turns a raw backend/Gemini error into a short, human-readable line for the activity feed.
function friendlyAgentError(raw: string): string {
  if (/billing|credit|prepay|prepayment|depleted|GEMINI_BILLING/i.test(raw)) return "Gemini billing credits are depleted for this API key's AI Studio project.";
  if (/LOCAL_RATE_LIMIT|too many planning requests/i.test(raw)) return "Too many planning requests - please wait a moment.";
  if (/quota|RESOURCE_EXHAUSTED|\b429\b/i.test(raw)) return "Rate/usage limit reached — try again shortly (or enable billing).";
  if (/503|UNAVAILABLE|overload|high demand|busy/i.test(raw)) return "The model is busy right now — please try again.";
  if (/api[_ ]?key|invalid|permission|\b401\b|\b403\b/i.test(raw)) return "API key/permission issue — check your Gemini key.";
  return "The agent hit an error — please try again.";
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<PrioritizedTask[]>(() => {
    try {
      const saved = localStorage.getItem("clutch_tasks");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  
  const [schedule, setSchedule] = useState<ScheduledBlock[]>(() => {
    try {
      const saved = localStorage.getItem("clutch_schedule");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [activityFeed, setActivityFeed] = useState<AgentAction[]>(() => {
    try {
      const saved = localStorage.getItem("clutch_activity");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Intentionally in-memory (session) only: the landing page should greet the user on every
  // fresh visit, then they enter the app for that session. Persisting this made the link always
  // boot straight into the dashboard and skip the landing.
  const [hasSeenIntro, setHasSeenIntro] = useState<boolean>(false);

  const [isThinking, setIsThinking] = useState(false);
  const [replanState, setReplanState] = useState<ReplanState | null>(null);

  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const s = localStorage.getItem("clutch_settings");
      return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  useEffect(() => {
    try { localStorage.setItem("clutch_settings", JSON.stringify(settings)); } catch (e) {}
  }, [settings]);

  useEffect(() => {
    try { localStorage.setItem("clutch_tasks", JSON.stringify(tasks)); } catch (e) {}
  }, [tasks]);

  useEffect(() => {
    try { localStorage.setItem("clutch_schedule", JSON.stringify(schedule)); } catch (e) {}
  }, [schedule]);

  useEffect(() => {
    try { localStorage.setItem("clutch_activity", JSON.stringify(activityFeed)); } catch (e) {}
  }, [activityFeed]);

  const addActivity = (desc: string) => {
    setActivityFeed((prev) => [
      { id: Date.now().toString() + Math.random(), timestamp: Date.now(), description: desc },
      ...prev
    ]);
  };

  const executeAgentAction = async (text: string, contextOverride?: any, actionTrigger?: string) => {
    setIsThinking(true);
    try {
      const currentContext = contextOverride || { tasks, schedule };
      const d = new Date();
      const nowStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          context: currentContext,
          actionTrigger,
          now: nowStr,
          workStart: settings.workStart,
          workEnd: settings.workEnd,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        addActivity(friendlyAgentError(String(data.code ? `${data.code}: ${data.error}` : data.error ?? res.status)));
        return;
      }

      if (data.tasks) {
        setTasks(data.tasks);
      }
      if (data.schedule) {
        setSchedule(data.schedule);
      }
      if (data.replan) {
        setReplanState(data.replan);
      }
      if (data.activity && Array.isArray(data.activity)) {
        setActivityFeed((prev) => {
          let updated = [...prev];
          data.activity.forEach((desc: string, i: number) => {
            updated.unshift({
              id: Date.now().toString() + "_" + i + "_" + Math.random(),
              timestamp: Date.now(),
              description: desc
            });
          });
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
      addActivity("Error connecting to agent backend.");
    } finally {
      setIsThinking(false);
    }
  };

  const markTaskStatus = (taskId: string, status: "done" | "dropped") => {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
    addActivity(`Marked a task as ${status}.`);
    // Proactively replan if dropped or taking long...
    // For simplicity, we just trigger it if they drop something or mark it done.
    if (status === "dropped") {
      executeAgentAction("", undefined, `User dropped task ${taskId}. Do we need to replan?`);
    } else if (status === "done") {
        // Just let them be done, no replan unless requested.
    }
  };

  const resolveReplan = (approved: boolean) => {
    if (approved && replanState) {
       setTasks((prev) => {
         return prev.map(t => {
           if (replanState.drop.includes(t.id)) return { ...t, status: "dropped" };
           // move to tomorrow = category LATER or dropped for today
           if (replanState.move.includes(t.id)) return { ...t, category: "LATER" };
           return t;
         })
       });
       addActivity("Applied re-plan updates.");
    } else {
       addActivity("User rejected the re-plan.");
    }
    setReplanState(null);
  };

  const dismissIntro = () => setHasSeenIntro(true);

  // Return to the landing page.
  const goHome = () => setHasSeenIntro(false);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  // Restore a done/dropped task back to active (local only — no Gemini).
  const restoreTask = (id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: "idle" } : t)));
    addActivity("Restored a task.");
  };

  // Permanently delete a task and any of its subtasks (local only).
  const deleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id && (t as any).parentId !== id));
  };

  const clearAllData = () => {
    setTasks([]);
    setSchedule([]);
    setActivityFeed([]);
    try {
      localStorage.removeItem("clutch_tasks");
      localStorage.removeItem("clutch_schedule");
      localStorage.removeItem("clutch_activity");
    } catch (e) {}
  };

  return (
    <AgentContext.Provider value={{
      tasks, setTasks, schedule, setSchedule, activityFeed,
      isThinking, replanState, hasSeenIntro, settings,
      executeAgentAction, markTaskStatus, resolveReplan, dismissIntro,
      updateSettings, restoreTask, deleteTask, clearAllData, goHome
    }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error("useAgent must be used within AgentProvider");
  return ctx;
}
