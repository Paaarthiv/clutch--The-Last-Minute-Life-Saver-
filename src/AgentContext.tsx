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

function parseHM(hm?: string): number | null {
  if (!hm || !/^\d{2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h + m / 60;
}

function planningWindow(settings: Settings): { start: number; end: number } {
  const start = Math.trunc(Math.max(0, Math.min(23, settings.workStart)));
  const rawEnd = Math.trunc(Math.max(0, Math.min(23, settings.workEnd)));
  const end = rawEnd === start ? start + 1 : rawEnd <= start ? rawEnd + 24 : rawEnd;
  return { start, end };
}

function scheduleSortValue(block: ScheduledBlock, windowStart = 0, windowEnd = 24): number {
  const start = parseHM(block.startTime) ?? 0;
  return windowEnd > 24 && start < windowStart ? start + 24 : start;
}

function blockRange(block: ScheduledBlock, windowStart = 0, windowEnd = 24) {
  let start = parseHM(block.startTime) ?? 0;
  let end = parseHM(block.endTime) ?? start + 0.5;
  if (end <= start) end += 24;
  if (windowEnd > 24 && start < windowStart) {
    start += 24;
    end += 24;
  }
  return { start, end: Math.max(start + 5 / 60, end) };
}

function deconflictSchedule(
  schedule: ScheduledBlock[],
  tasks: PrioritizedTask[],
  windowStart = 0,
  windowEnd = 24,
): ScheduledBlock[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const blocks = schedule
    .map((block, index) => {
      const range = blockRange(block, windowStart, windowEnd);
      const task = taskById.get(block.taskId);
      const fixed = Boolean(task?.scheduledStartTime);
      return { block, index, fixed, duration: range.end - range.start, ...range };
    })
    .sort((a, b) => Number(b.fixed) - Number(a.fixed) || a.start - b.start || a.index - b.index);

  const placed: { start: number; end: number }[] = [];
  const resolved = blocks.map((item) => {
    if (item.fixed) {
      placed.push({ start: item.start, end: item.end });
      return { sort: item.start, block: item.block };
    }

    let start = item.start;
    let moved = true;
    while (moved) {
      moved = false;
      for (const taken of placed.sort((a, b) => a.start - b.start)) {
        const end = start + item.duration;
        if (start < taken.end && end > taken.start) {
          start = taken.end;
          moved = true;
        }
      }
    }
    const end = start + item.duration;
    placed.push({ start, end });
    return {
      sort: start,
      block: { ...item.block, startTime: fmtHM(start), endTime: fmtHM(end) },
    };
  });

  return resolved
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.block);
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
  const canScheduleFlexible = windowNow < endH;
  let cursor = Math.max(startH, Math.ceil(windowNow * 12) / 12); // round up to the next 5 minutes

  const blocks: ScheduledBlock[] = [];
  const pinned = schedulable
    .map((t) => {
      const rawStart = parseHM(t.scheduledStartTime);
      if (rawStart == null) return null;
      // If only a start was captured, derive the end from the task's estimate.
      let rawEnd = parseHM(t.scheduledEndTime);
      if (rawEnd == null) rawEnd = rawStart + Math.max(5, t.estimated_minutes || 30) / 60;
      let start = rawStart;
      let end = rawEnd <= rawStart ? rawEnd + 24 : rawEnd;
      if (endH > 24 && start < startH) {
        start += 24;
        end += 24;
      }
      return { task: t, start, end };
    })
    .filter(Boolean) as { task: PrioritizedTask; start: number; end: number }[];

  for (const p of pinned) {
    blocks.push({ taskId: p.task.id, title: p.task.title, startTime: fmtHM(p.start), endTime: fmtHM(p.end) });
  }

  const pinnedIds = new Set(pinned.map((p) => p.task.id));
  const blockers = [...pinned].sort((a, b) => a.start - b.start || a.end - b.end);
  let blockerIndex = 0;

  for (const t of schedulable.filter((task) => !pinnedIds.has(task.id))) {
    if (!canScheduleFlexible) break;
    if (cursor >= endH) break;
    const dur = Math.max(5, t.estimated_minutes || 30) / 60;

    while (blockerIndex < blockers.length && blockers[blockerIndex].end <= cursor) blockerIndex++;
    const nextBlocker = blockers[blockerIndex];
    if (nextBlocker && cursor < nextBlocker.start && cursor + dur > nextBlocker.start) {
      cursor = nextBlocker.end;
      while (blockerIndex < blockers.length && blockers[blockerIndex].end <= cursor) blockerIndex++;
    } else if (nextBlocker && cursor >= nextBlocker.start && cursor < nextBlocker.end) {
      cursor = nextBlocker.end;
      while (blockerIndex < blockers.length && blockers[blockerIndex].end <= cursor) blockerIndex++;
    }

    if (cursor >= endH) break;
    const end = Math.min(endH, cursor + dur);
    if (end <= cursor) break;
    blocks.push({ taskId: t.id, title: t.title, startTime: fmtHM(cursor), endTime: fmtHM(end) });
    cursor = end;
  }
  return deconflictSchedule(blocks, schedulable, startH, endH);
}

function splitScheduleForBreakdown(
  previousSchedule: ScheduledBlock[],
  previousTasks: PrioritizedTask[],
  nextTasks: PrioritizedTask[],
): { tasks: PrioritizedTask[]; schedule: ScheduledBlock[] } | null {
  const previousIds = new Set(previousTasks.map((t) => t.id));
  const newSubtasks = nextTasks.filter((t) => t.parentId && !previousIds.has(t.id));
  if (!newSubtasks.length) return null;

  let changed = false;
  let updatedTasks = nextTasks;
  let updatedSchedule = [...previousSchedule];
  let sortWindowStart = 0;
  let sortWindowEnd = 24;

  for (const parentId of Array.from(new Set(newSubtasks.map((t) => t.parentId as string)))) {
    const parentBlock = updatedSchedule.find((b) => b.taskId === parentId);
    if (!parentBlock) continue;

    const parentStart = parseHM(parentBlock.startTime);
    const parentEndRaw = parseHM(parentBlock.endTime);
    if (parentStart == null || parentEndRaw == null) continue;
    const parentEnd = parentEndRaw <= parentStart ? parentEndRaw + 24 : parentEndRaw;
    sortWindowStart = parentStart;
    sortWindowEnd = parentEnd;
    const parentMinutes = Math.max(5, Math.round((parentEnd - parentStart) * 60));
    const subtasks = newSubtasks.filter((t) => t.parentId === parentId);
    const totalEstimate = Math.max(1, subtasks.reduce((sum, t) => sum + Math.max(1, t.estimated_minutes || 1), 0));

    let cursor = parentStart;
    const subBlocks: ScheduledBlock[] = [];
    const pinnedById = new Map<string, { start: string; end: string }>();
    subtasks.forEach((task, index) => {
      const isLast = index === subtasks.length - 1;
      const minutes = isLast
        ? Math.max(1, Math.round((parentEnd - cursor) * 60))
        : Math.max(5, Math.round(parentMinutes * Math.max(1, task.estimated_minutes || 1) / totalEstimate));
      const end = isLast ? parentEnd : Math.min(parentEnd, cursor + minutes / 60);
      const startTime = fmtHM(cursor);
      const endTime = fmtHM(end);
      pinnedById.set(task.id, { start: startTime, end: endTime });
      subBlocks.push({ taskId: task.id, title: task.title, startTime, endTime });
      cursor = end;
    });

    updatedTasks = updatedTasks.map((task) => {
      const pinned = pinnedById.get(task.id);
      return pinned ? { ...task, scheduledStartTime: pinned.start, scheduledEndTime: pinned.end } : task;
    });
    updatedSchedule = updatedSchedule.filter((b) => b.taskId !== parentId).concat(subBlocks);
    changed = true;
  }

  if (!changed) return null;
  return {
    tasks: updatedTasks,
    schedule: deconflictSchedule(updatedSchedule, updatedTasks, sortWindowStart, sortWindowEnd),
  };
}

function textIncludesExplicitTimeWindow(text?: string, actionTrigger?: string): boolean {
  const raw = `${text || ""} ${actionTrigger || ""}`.toLowerCase();
  if (!raw.trim()) return false;
  const clock = String.raw`(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(?:am|pm)?`;
  const ampm = String.raw`(?:1[0-2]|0?\d)(?::[0-5]\d)?\s*(?:am|pm)`;
  return new RegExp(`${clock}\\s*(?:-|to|until|through|till)\\s*${clock}`, "i").test(raw)
    || new RegExp(`from\\s+${clock}\\s*(?:-|to|until|through|till)\\s*${clock}`, "i").test(raw)
    || new RegExp(`\\b${ampm}\\s*(?:-|to|until|through|till)\\s*${ampm}\\b`, "i").test(raw);
}

function rangesOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && a.end > b.start;
}

function removeConflictingNewTaskPins(
  previousSchedule: ScheduledBlock[],
  previousTasks: PrioritizedTask[],
  nextTasks: PrioritizedTask[],
  settings: Settings,
  text?: string,
  actionTrigger?: string,
): PrioritizedTask[] {
  if (textIncludesExplicitTimeWindow(text, actionTrigger)) return nextTasks;

  const previousIds = new Set(previousTasks.map((task) => task.id));
  const { start: windowStart, end: windowEnd } = planningWindow(settings);
  const occupied = previousSchedule.map((block) => blockRange(block, windowStart, windowEnd));

  return nextTasks.map((task) => {
    if (previousIds.has(task.id) || !task.scheduledStartTime || !task.scheduledEndTime) return task;

    const start = parseHM(task.scheduledStartTime);
    const rawEnd = parseHM(task.scheduledEndTime);
    if (start == null || rawEnd == null) return task;

    let normalizedStart = start;
    let normalizedEnd = rawEnd <= start ? rawEnd + 24 : rawEnd;
    if (windowEnd > 24 && normalizedStart < windowStart) {
      normalizedStart += 24;
      normalizedEnd += 24;
    }

    const conflicts = occupied.some((range) => rangesOverlap({ start: normalizedStart, end: normalizedEnd }, range));
    return conflicts ? { ...task, scheduledStartTime: undefined, scheduledEndTime: undefined } : task;
  });
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
  const [clientId, setClientId] = useState(() => {
    try {
      let id = localStorage.getItem("clutch_client_id");
      if (!id) {
        id = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`;
        localStorage.setItem("clutch_client_id", id);
      }
      return id;
    } catch { return "anon-client-0"; }
  });
  const hydratedRef = useRef(false);
  const skipNextCloudSaveRef = useRef(false);

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
    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return;
    }
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
      const previousTasks = tasks;
      const previousSchedule = schedule;
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
        const cleanedTasks = removeConflictingNewTaskPins(previousSchedule, previousTasks, data.tasks, settings, text, actionTrigger);
        const breakdownSchedule = splitScheduleForBreakdown(previousSchedule, previousTasks, cleanedTasks);
        const nextTasks = breakdownSchedule?.tasks || cleanedTasks;
        setTasks(nextTasks);
        setSchedule(breakdownSchedule?.schedule || buildSchedule(nextTasks, settings));
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
    const oldClientId = clientId;
    const nextClientId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `c${Date.now()}${Math.random().toString(36).slice(2)}`;
    skipNextCloudSaveRef.current = true;
    setTasks([]);
    setSchedule([]);
    setActivityFeed([]);
    setReplanState(null);
    setRescueState(null);
    setSettings(DEFAULT_SETTINGS);
    setClientId(nextClientId);
    try {
      localStorage.removeItem("clutch_tasks");
      localStorage.removeItem("clutch_schedule");
      localStorage.removeItem("clutch_activity");
      localStorage.removeItem("clutch_settings");
      localStorage.setItem("clutch_client_id", nextClientId);
    } catch (e) {}
    fetch("/api/state/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: oldClientId }),
    }).catch(() => {});
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
