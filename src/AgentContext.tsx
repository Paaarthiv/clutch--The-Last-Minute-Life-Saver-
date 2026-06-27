import React, { createContext, useContext, useState, useEffect, useRef, useMemo, ReactNode } from "react";
import { PrioritizedTask, ScheduledBlock, AgentAction, ReplanState, RescueState } from "./types";

export interface Settings {
  workStart: number; // hour, 0-23
  workEnd: number;   // hour, 0-23
  peakStart: number; // peak-energy window start hour
  peakEnd: number;   // peak-energy window end hour
  voiceEnabled: boolean;
}
const DEFAULT_SETTINGS: Settings = { workStart: 9, workEnd: 18, peakStart: 9, peakEnd: 12, voiceEnabled: true };

interface AppState {
  tasks: PrioritizedTask[];
  schedule: ScheduledBlock[];
  activityFeed: AgentAction[];
  isThinking: boolean;
  replanState: ReplanState | null;
  rescueState: RescueState | null;
  hasSeenIntro: boolean;
  settings: Settings;
}

interface AgentContextType extends AppState {
  setTasks: React.Dispatch<React.SetStateAction<PrioritizedTask[]>>;
  setSchedule: React.Dispatch<React.SetStateAction<ScheduledBlock[]>>;
  executeAgentAction: (text: string, contextOverride?: any, actionTrigger?: string, opts?: { mode?: "rescue"; image?: { mimeType: string; data: string } }) => Promise<void>;
  markTaskStatus: (taskId: string, status: "idle" | "done" | "dropped" | "archived") => void;
  archiveTask: (id: string) => void;
  resolveReplan: (approved: boolean) => void;
  runRescue: () => void;
  applyRescue: (approved: boolean) => void;
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

function fmtHM(dec: number): string {
  const total = Math.round(dec * 60);
  const normalized = ((total % (24 * 60)) + (24 * 60)) % (24 * 60);
  const h = Math.floor(normalized / 60), m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function planningWindow(settings: Settings): { start: number; end: number } {
  const start = Math.trunc(Math.max(0, Math.min(23, settings.workStart)));
  const rawEnd = Math.trunc(Math.max(0, Math.min(23, settings.workEnd)));
  const end = rawEnd === start ? start + 1 : rawEnd <= start ? rawEnd + 24 : rawEnd;
  return { start, end };
}

// Deterministic local scheduler: the Today's Plan is always derived from the prioritized tasks,
// so it re-syncs the instant priorities change — no Gemini call needed. Orders NOW → NEXT → LATER,
// then by importance, then deep-focus first (light energy bias), and packs from the current time.
function buildSchedule(tasks: PrioritizedTask[], settings: Settings): ScheduledBlock[] {
  const active = (tasks || []).filter((t) => t && t.status === "idle");
  const activeIds = new Set(active.map((t) => t.id));
  // If a parent has active subtasks, schedule the subtasks instead of the parent.
  const parentsWithChild = new Set(
    active.filter((t) => t.parentId && activeIds.has(t.parentId)).map((t) => t.parentId as string)
  );
  const schedulable = active.filter((t) => !parentsWithChild.has(t.id));

  const catRank = (c: string) => (c === "NOW" ? 0 : c === "NEXT" ? 1 : 2);
  const loadRank = (l?: string) => (l === "deep" ? 0 : l === "light" ? 1 : 2);
  schedulable.sort((a, b) =>
    catRank(a.category) - catRank(b.category) ||
    (b.importance || 0) - (a.importance || 0) ||
    loadRank(a.cognitiveLoad) - loadRank(b.cognitiveLoad) ||
    (a.createdAt || 0) - (b.createdAt || 0)
  );

  const { start: startH, end: endH } = planningWindow(settings);
  const d = new Date();
  const nowDec = d.getHours() + d.getMinutes() / 60;
  const windowNow = endH > 24 && nowDec < startH ? nowDec + 24 : nowDec;
  if (windowNow >= endH) return [];
  let cursor = Math.max(startH, Math.ceil(windowNow * 12) / 12); // round up to the next 5 minutes

  const blocks: ScheduledBlock[] = [];
  for (const t of schedulable) {
    if (cursor >= endH) break;
    const dur = Math.max(5, t.estimated_minutes || 30) / 60;
    const end = Math.min(endH, cursor + dur);
    if (end <= cursor) break;
    blocks.push({ taskId: t.id, title: t.title, startTime: fmtHM(cursor), endTime: fmtHM(end) });
    cursor = end;
  }
  return blocks;
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
  const [rescueState, setRescueState] = useState<RescueState | null>(null);

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

  // ----- Firestore cloud sync (additive mirror; localStorage stays the live store) -----
  const clientId = useMemo(() => {
    try {
      let id = localStorage.getItem("clutch_client_id");
      if (!id) {
        id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("clutch_client_id", id);
      }
      return id;
    } catch { return "anon-client-0"; }
  }, []);
  const hydratedRef = useRef(false);

  // On first load, if there's nothing local, restore the snapshot from Firestore.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (tasks.length === 0) {
          const res = await fetch(`/api/state/load?clientId=${encodeURIComponent(clientId)}`);
          if (res.ok) {
            const { state } = await res.json();
            if (!cancelled && state && typeof state === "object") {
              if (Array.isArray(state.tasks)) setTasks(state.tasks);
              if (Array.isArray(state.schedule)) setSchedule(state.schedule);
              if (Array.isArray(state.activityFeed)) setActivityFeed(state.activityFeed);
              if (state.settings) setSettings((p) => ({ ...p, ...state.settings }));
            }
          }
        }
      } catch { /* offline / not configured — stay on localStorage */ }
      finally { if (!cancelled) hydratedRef.current = true; }
    })();
    return () => { cancelled = true; };
  }, []); // mount only

  // Mirror state to Firestore (debounced), once the initial restore has been attempted.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      fetch("/api/state/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, state: { tasks, schedule, settings, activityFeed } }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [tasks, schedule, settings, activityFeed, clientId]);

  const addActivity = (desc: string) => {
    setActivityFeed((prev) => [
      { id: Date.now().toString() + Math.random(), timestamp: Date.now(), description: desc },
      ...prev
    ].slice(0, 100));
  };

  const executeAgentAction = async (text: string, contextOverride?: any, actionTrigger?: string, opts?: { mode?: "rescue"; image?: { mimeType: string; data: string } }) => {
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
          peakStart: settings.peakStart,
          peakEnd: settings.peakEnd,
          mode: opts?.mode,
          image: opts?.image,
        }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        addActivity(friendlyAgentError(String(data.code ? `${data.code}: ${data.error}` : data.error ?? res.status)));
        return;
      }

      if (data.tasks) {
        setTasks(data.tasks);
        // The plan is always a local derivation of the latest priorities, so it stays in sync.
        setSchedule(buildSchedule(data.tasks, settings));
      }
      if (data.replan) {
        setReplanState(data.replan);
      }
      if (data.rescue) {
        setRescueState(data.rescue);
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
          return updated.slice(0, 100);
        });
      }
    } catch (e) {
      console.error(e);
      addActivity("Error connecting to agent backend.");
    } finally {
      setIsThinking(false);
    }
  };

  const markTaskStatus = (taskId: string, status: "idle" | "done" | "dropped" | "archived") => {
    const next = tasks.map((t) => (t.id === taskId ? { ...t, status } : t));
    setTasks(next);
    // Re-pack the plan from the remaining active tasks so it tightens up as you finish/drop.
    setSchedule(buildSchedule(next, settings));
    addActivity(status === "idle" ? "Restored a task to active." : `Moved a task to ${status}.`);
  };

  const resolveReplan = (approved: boolean) => {
    if (approved && replanState) {
       const next = tasks.map((t) => {
         if (replanState.drop.includes(t.id)) return { ...t, status: "dropped" as const };
         // move to tomorrow = category LATER for today
         if (replanState.move.includes(t.id)) return { ...t, category: "LATER" as const };
         return t;
       });
       setTasks(next);
       setSchedule(buildSchedule(next, settings));
       addActivity("Applied re-plan updates.");
    } else {
       addActivity("User rejected the re-plan.");
    }
    setReplanState(null);
  };

  // Clutch Mode — fire a rescue-triage request. The agent triages against the time left.
  const runRescue = () => {
    if (isThinking) return;
    executeAgentAction(
      "",
      undefined,
      "RESCUE: I'm overwhelmed and short on time. Triage my tasks — what must I do now, what can wait, what should I drop?",
      { mode: "rescue" }
    );
  };

  // Apply (or dismiss) the rescue plan: must-dos become NOW, "if time" become LATER,
  // dropped tasks are set to dropped and pulled off the schedule.
  const applyRescue = (approved: boolean) => {
    if (approved && rescueState) {
      const nowIds = new Set(rescueState.doNow.map((d) => d.taskId));
      const laterIds = new Set(rescueState.ifTime);
      const dropIds = new Set(rescueState.dropForNow);
      const next = tasks.map((t) => {
        if (nowIds.has(t.id)) return { ...t, status: "idle" as const, category: "NOW" as const };
        if (laterIds.has(t.id)) return { ...t, category: "LATER" as const };
        if (dropIds.has(t.id)) return { ...t, status: "dropped" as const };
        return t;
      });
      setTasks(next);
      setSchedule(buildSchedule(next, settings));
      addActivity("Applied Clutch Mode rescue plan.");
    }
    setRescueState(null);
  };

  const dismissIntro = () => setHasSeenIntro(true);

  // Return to the landing page.
  const goHome = () => setHasSeenIntro(false);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSchedule(buildSchedule(tasks, next));
  };

  const archiveTask = (id: string) => {
    const affectedIds = new Set(tasks.filter((t) => t.id === id || (t as any).parentId === id).map((t) => t.id));
    const next = tasks.map((t) => (
      affectedIds.has(t.id) ? { ...t, status: "archived" as const } : t
    ));
    setTasks(next);
    setSchedule((prev) => prev.filter((block) => !affectedIds.has(block.taskId)));
    addActivity("Archived a task.");
  };

  // Restore a done/dropped task back to active (local only — no Gemini).
  const restoreTask = (id: string) => {
    const next = tasks.map((t) => (
      t.id === id || (t as any).parentId === id ? { ...t, status: "idle" as const } : t
    ));
    setTasks(next);
    setSchedule(buildSchedule(next, settings));
    addActivity("Restored a task.");
  };

  // Permanently delete a task and any of its subtasks (local only).
  const deleteTask = (id: string) => {
    const affectedIds = new Set(tasks.filter((t) => t.id === id || (t as any).parentId === id).map((t) => t.id));
    const next = tasks.filter((t) => !affectedIds.has(t.id));
    setTasks(next);
    setSchedule((prev) => prev.filter((block) => !affectedIds.has(block.taskId)));
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
      isThinking, replanState, rescueState, hasSeenIntro, settings,
      executeAgentAction, markTaskStatus, resolveReplan, runRescue, applyRescue, dismissIntro,
      updateSettings, archiveTask, restoreTask, deleteTask, clearAllData, goHome
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
