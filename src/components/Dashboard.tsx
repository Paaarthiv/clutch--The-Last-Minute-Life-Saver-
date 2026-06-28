import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAgent } from "../AgentContext";
import { PrioritizedTask, ScheduledBlock } from "../types";
import { Mic, CheckCircle2, Circle, Clock, LayoutDashboard, BrainCircuit, Calendar, CheckSquare, Inbox, Folder, Archive, HelpCircle, LogOut, Plus, Minus, Maximize2, User, Loader2, Sparkles, BarChart3, Settings as SettingsIcon, RotateCcw, Trash2, ChevronsLeft, ChevronsRight, ChevronDown, Check, Zap, BatteryLow, ArrowRight, ImagePlus, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { format } from "date-fns";
import clsx from "clsx";

import { ClutchLogo } from "./ClutchLogo";
import { planSpeech, rescueSpeech, speakText } from "../lib/speak";

interface TaskCardProps {
  task: any;
  allTasks?: any[];
}

const LOAD_META: Record<string, { label: string; color: string; bg: string }> = {
  deep: { label: "Deep focus", color: "#C2410C", bg: "rgba(234,88,12,0.10)" },
  light: { label: "Light", color: "#1E7B86", bg: "rgba(32,128,141,0.10)" },
  admin: { label: "Admin", color: "#6B7B7D", bg: "rgba(107,123,125,0.12)" },
};

function LoadBadge({ load }: { load?: string }) {
  if (!load || !LOAD_META[load]) return null;
  const m = LOAD_META[load];
  return (
    <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: m.color, background: m.bg }}>
      {m.label}
    </span>
  );
}

// Google Calendar sync via Google Identity Services (client-side token flow — no server tokens).
const FALLBACK_GCAL_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;
const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
let runtimeConfigPromise: Promise<{ googleCalendarClientId?: string }> | null = null;

function loadRuntimeConfig() {
  runtimeConfigPromise ??= fetch("/api/config", { cache: "no-store" })
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));
  return runtimeConfigPromise;
}

function gcalGetToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const g = (window as any).google;
    if (!clientId) { reject(new Error("Calendar isn't configured.")); return; }
    if (!g?.accounts?.oauth2) { reject(new Error("Google sign-in is still loading — try again in a moment.")); return; }
    const client = g.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GCAL_SCOPE,
      callback: (resp: any) => (resp?.access_token ? resolve(resp.access_token) : reject(new Error("Calendar access was not granted."))),
      error_callback: (err: any) => reject(new Error(err?.message || "Calendar sign-in was cancelled.")),
    });
    client.requestAccessToken();
  });
}

async function addBlocksToCalendar(blocks: ScheduledBlock[], clientId: string): Promise<number> {
  const token = await gcalGetToken(clientId);
  const now = new Date();
  const y = now.getFullYear(), mo = now.getMonth() + 1, d = now.getDate();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = (hm: string, dayOffset = 0) => {
    const [h, mi] = hm.split(":");
    const dt = new Date(y, mo - 1, d + dayOffset, Number(h), Number(mi || 0), 0);
    return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
  };
  let ok = 0;
  for (const b of blocks) {
    const start = parseTimeStr(b.startTime);
    const end = parseTimeStr(b.endTime);
    const endDayOffset = end <= start ? 1 : 0;
    const event = {
      summary: b.title,
      description: "Planned by Clutch",
      colorId: "7",
      start: { dateTime: local(b.startTime), timeZone: tz },
      end: { dateTime: local(b.endTime, endDayOffset), timeZone: tz },
    };
    try {
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (res.ok) ok++;
    } catch { /* skip failed event */ }
  }
  return ok;
}

// A small "!" badge that reveals a detailed feature explanation on hover/focus (or tap).
function InfoHint({ title, tone, children }: { title: string; tone: "onDark" | "onLight"; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const W = 280;

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - W / 2), window.innerWidth - W - 8);
    setPos({ left, bottom: window.innerHeight - r.top + 8 });
  };
  const show = () => { place(); setOpen(true); };

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`About ${title}`}
        onMouseEnter={show}
        onMouseLeave={() => setOpen(false)}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : show(); }}
        className={clsx(
          "w-[18px] h-[18px] rounded-full text-[11px] font-extrabold leading-none flex items-center justify-center transition-transform hover:scale-110 shadow-[0_2px_6px_rgba(19,52,59,0.25)]",
          tone === "onDark" ? "bg-white/90 text-[#13565F]" : "bg-[#20808D] text-white"
        )}
      >
        !
      </button>
      {open && pos && createPortal(
        <div
          style={{ position: "fixed", left: pos.left, bottom: pos.bottom, width: W, zIndex: 100 }}
          className="rounded-xl bg-[#13343B] text-white/90 p-3.5 shadow-[0_18px_44px_rgba(19,52,59,0.32)] text-[12px] leading-relaxed pointer-events-none"
        >
          <div className="font-bold text-[#9FE1CB] mb-1.5">{title}</div>
          {children}
        </div>,
        document.body
      )}
    </>
  );
}

const TaskCard: React.FC<TaskCardProps> = ({ task, allTasks }) => {
  const { markTaskStatus, archiveTask, executeAgentAction, isThinking } = useAgent();
  const isDone = task.status === "done";
  const subtasks = allTasks ? allTasks.filter((t) => t.parentId === task.id) : [];
  
  const catColor = task.category === "NOW" ? "#20808D" : task.category === "NEXT" ? "#2AA7B5" : "#93C3C7";

  return (
    <div
      className={clsx("rounded-2xl border border-[#E6E3DC] bg-white p-4 relative group transition-colors hover:border-[#20808D]/30", isDone && "opacity-50")}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* meta row: duration + category + deadline */}
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest tabular-nums" style={{ color: catColor }}>{task.estimated_minutes}m</span>
            <span className="w-1 h-1 rounded-full bg-[#C2CACB]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9AA7A9]">{task.category}</span>
            <LoadBadge load={(task as any).cognitiveLoad} />
            {task.scheduledStartTime && task.scheduledEndTime && <span className="text-[10px] font-bold uppercase tracking-widest text-[#20808D] truncate">{task.scheduledStartTime}-{task.scheduledEndTime}</span>}
            {task.deadline && <span className="text-[10px] font-bold uppercase tracking-widest text-[#20808D] truncate">· Due {task.deadline}</span>}
          </div>
          <div className={clsx("text-sm font-semibold leading-tight", isDone && "line-through")}>{task.title}</div>
          {task.reason && <div className="text-[11px] text-[#9AA7A9] mt-1 leading-snug">{task.reason}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => markTaskStatus(task.id, isDone ? "idle" : "done")}
            title={isDone ? "Mark as not done" : "Mark as done"}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#13343B]/40 hover:text-[#13343B] hover:bg-black/[0.04] transition-colors"
          >
            {isDone ? <CheckCircle2 className="w-[18px] h-[18px] text-[#34D399]" /> : <Circle className="w-[18px] h-[18px]" />}
          </button>
          <button
            onClick={() => archiveTask(task.id)}
            title="Archive task"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#13343B]/35 hover:text-[#20808D] hover:bg-[#20808D]/10 transition-colors"
          >
            <Archive className="w-[17px] h-[17px]" />
          </button>
        </div>
      </div>

      {subtasks.length > 0 && (
        <div className="ml-1 space-y-2 mt-3 border-l px-3 py-1 border-[#E0DCD3]">
          {subtasks.map((st) => (
             <div key={st.id} className="flex items-center gap-2 group/sub">
                <button
                  onClick={() => markTaskStatus(st.id, st.status === "done" ? "idle" : "done")}
                  className="flex-shrink-0 text-[#13343B]/40 hover:text-[#13343B] transition-colors"
                >
                  {st.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" /> : <Circle className="w-3.5 h-3.5" />}
                </button>
                <span className={clsx("text-xs text-[#13343B]", st.status === "done" && "line-through opacity-50")}>{st.title}</span>
                <span className="text-[10px] text-[#9AA7A9] opacity-0 group-hover/sub:opacity-100 transition-opacity ml-auto">{st.estimated_minutes}m</span>
             </div>
          ))}
        </div>
      )}

      {task.estimated_minutes >= 60 && !isDone && subtasks.length === 0 && (
        <button
          onClick={() => executeAgentAction(`Break down this large goal into smaller subtasks: "${task.title}". The parentTaskId IS: ${task.id}`)}
          disabled={isThinking}
          className="mt-3 pill bg-[#20808D]/15 text-[#20808D] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer uppercase font-bold"
        >
          Break down
        </button>
      )}
    </div>
  );
}

// Quick-add task pills that live INSIDE the chat sphere. ox/oy are offsets from the sphere
// centre in units of its radius; rx/ry size each pill's repel field against the dots.
// Scattered "tap-to-add" task pills. Positions are percentages of the cloud area (centre points),
// so they spread across whatever space is available without scrolling. A couple are teal-accented.
type CloudPill = { label: string; top: string; left: string; size: number; accent?: boolean; rot: number; dur: number; delay: number; wx: number; wy: number };
// Two clusters — a TOP group (≤30%) and a BOTTOM group (≥70%) — leaving a clear band in the
// middle for the command bar + Clutch Mode / I'm wiped, so the wandering pills never collide.
const CLOUD_PILLS: CloudPill[] = [
  // top cluster
  { label: "Exam prep",    top: "7%",  left: "34%", size: 17, accent: true, rot: -7, dur: 18, delay: 0.0, wx: 22,  wy: -10 },
  { label: "Reply emails", top: "10%", left: "60%", size: 15, rot: 4,  dur: 19, delay: 2.2, wx: -22, wy: -8 },
  { label: "Gym",          top: "16%", left: "80%", size: 14, rot: 6,  dur: 20, delay: 1.6, wx: -18, wy: 10 },
  { label: "Dentist",      top: "24%", left: "16%", size: 13, rot: -3, dur: 22, delay: 0.8, wx: 20,  wy: -8 },
  { label: "Slide deck",   top: "27%", left: "62%", size: 14, rot: -6, dur: 21, delay: 1.4, wx: -16, wy: -10 },
  // bottom cluster
  { label: "Groceries",    top: "72%", left: "26%", size: 13, rot: 5,  dur: 23, delay: 2.8, wx: 20,  wy: 10 },
  { label: "Pay bills",    top: "75%", left: "80%", size: 13, rot: 3,  dur: 22, delay: 2.4, wx: -20, wy: 8 },
  { label: "Workout",      top: "82%", left: "58%", size: 16, accent: true, rot: -4, dur: 20, delay: 0.5, wx: 22,  wy: 10 },
  { label: "Call mom",     top: "87%", left: "18%", size: 13, rot: 7,  dur: 24, delay: 3.2, wx: 18,  wy: 8 },
  { label: "Read 30 min",  top: "92%", left: "48%", size: 14, rot: -5, dur: 21, delay: 1.0, wx: -18, wy: 8 },
];

// Downscale + JPEG-compress a picked image so a phone photo fits comfortably in one request.
async function fileToCompressedImage(file: File): Promise<{ mimeType: string; data: string }> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });
  const maxDim = 1280;
  let { width, height } = img;
  if (Math.max(width, height) > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
  const out = canvas.toDataURL("image/jpeg", 0.72);
  return { mimeType: "image/jpeg", data: out.split(",")[1] };
}

function PrioritiesColumn({
  inputRef,
  activityCollapsed,
  toggleActivity,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  activityCollapsed: boolean;
  toggleActivity: () => void;
}) {
  const { tasks, isThinking, executeAgentAction, runRescue, settings } = useAgent();
  const hasTasks = tasks.some((t) => t.status === "idle");

  const lowEnergy = () => {
    if (isThinking || !hasTasks) return;
    executeAgentAction(
      "",
      undefined,
      "I'm low on energy right now. Re-prioritize so easy, low-effort tasks (admin/light cognitive_load) come first to build momentum, and push deep-focus tasks to later or my peak hours. Then reschedule everything. Do NOT create any new tasks."
    );
  };

  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(132, Math.max(24, el.scrollHeight))}px`;
  };

  useEffect(() => {
    resizeInput();
  }, [input]);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { alert("Speech recognition is not supported in this browser."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) setInput((prev) => prev + (prev ? " " : "") + finalTranscript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    executeAgentAction(input);
    setInput("");
  };

  const imgInputRef = useRef<HTMLInputElement>(null);
  const onImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file || isThinking) return;
    try {
      const image = await fileToCompressedImage(file);
      executeAgentAction("", undefined, undefined, { image });
    } catch { /* ignore decode errors */ }
  };

  // The ambient pills only look good with room to breathe — hide them when the column gets
  // narrow (e.g. when the sidebar is expanded) so they don't crowd/collide with the command bar.
  const columnRef = useRef<HTMLDivElement>(null);
  const [showPills, setShowPills] = useState(true);
  useEffect(() => {
    const el = columnRef.current;
    if (!el) return;
    const update = () => setShowPills(el.clientWidth >= 470);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={columnRef} className="w-full xl:flex-1 xl:min-w-[360px] xl:h-full min-h-[520px] relative flex flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Decorative task-pill cloud behind the command bar (hidden when the column is narrow). */}
      {showPills && (
      <div className="absolute inset-x-0 top-10 bottom-0 pointer-events-none select-none opacity-70">
        {CLOUD_PILLS.map((p, i) => (
          <div
            key={i}
            className="pill-wander absolute"
            style={{
              top: p.top,
              left: p.left,
              ["--wander-x" as any]: `${p.wx}px`,
              ["--wander-y" as any]: `${p.wy}px`,
              ["--wander-dur" as any]: `${p.dur}s`,
              ["--wander-delay" as any]: `${p.delay}s`,
            }}
          >
            <div
              aria-hidden="true"
              className={clsx(
                "pill-float inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium whitespace-nowrap border backdrop-blur-sm",
                p.accent
                  ? "bg-[#20808D]/15 text-[#13565F] border-[#20808D]/20 shadow-[0_8px_26px_rgba(32,128,141,0.12)]"
                  : "bg-white/55 text-[#5B6B6E] border-white/60 shadow-[0_5px_18px_rgba(19,52,59,0.06)]"
              )}
              style={{ fontSize: p.size, ["--rot" as any]: `${p.rot}deg`, ["--float-dur" as any]: `${Math.max(7, p.dur / 2)}s`, ["--float-delay" as any]: `${p.delay}s` }}
            >
              <Plus className="shrink-0 text-[#20808D]/55" style={{ width: p.size * 0.8, height: p.size * 0.8 }} />
              {p.label}
            </div>
          </div>
        ))}
      </div>
      )}

      <div className="relative z-10 w-full max-w-[560px] space-y-3">
      {/* Chat input */}
      <form onSubmit={handleSubmit} className="capture-glow w-full">
        <div className="glass-bar p-3 flex items-center gap-3 w-full shadow-[0_18px_44px_rgba(19,52,59,0.10)]">
          <input ref={imgInputRef} type="file" accept="image/*" capture="environment" onChange={onImagePick} className="hidden" />
          <button type="button" onClick={() => imgInputRef.current?.click()} disabled={isThinking} title="Snap or upload a photo of your to-do list" className="shrink-0 text-[#5B6B6E] hover:text-[#20808D] transition-colors disabled:opacity-40">
            <ImagePlus className="w-5 h-5" />
          </button>
          {settings.voiceEnabled && (
            <button type="button" onClick={startRecording} className={clsx("transition-colors relative shrink-0", isRecording ? "text-[#20808D]" : "text-[#5B6B6E] hover:text-[#13343B]")}>
              {isRecording && <span className="absolute inset-[-4px] bg-[#20808D]/20 rounded-full animate-ping" />}
              <Mic className="w-5 h-5 relative z-10" />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as any);
              }
            }}
            placeholder={isRecording ? "Listening..." : "What needs to get done?"}
            rows={1}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-[#9AA7A9] text-[#13343B] flex-1 resize-none leading-6 max-h-32 overflow-y-auto custom-scrollbar py-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="px-4 py-2 bg-[#20808D] text-white text-[11px] font-bold uppercase tracking-widest rounded-lg disabled:opacity-50 transition-all active:scale-95 hover:brightness-110 whitespace-nowrap flex items-center gap-1.5"
          >
            {isThinking ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Planning</>) : (<><Sparkles className="w-3.5 h-3.5" /> Plan</>)}
          </button>
        </div>
      </form>

      {/* Clutch Mode + low-energy quick actions */}
      {hasTasks && (
        <div className="w-full flex gap-2">
          <div className="relative flex-1">
            <button
              onClick={runRescue}
              disabled={isThinking}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
              className="clutch-glass w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              <span className="cursor-light" aria-hidden="true" />
              <span className="relative z-10 flex items-center gap-2"><Zap className="w-4 h-4" /> Clutch Mode</span>
            </button>
            <div className="absolute -top-2 -right-2 z-20">
              <InfoHint title="Clutch Mode — your panic button" tone="onDark">
                For when you're overwhelmed or out of time. Clutch triages everything down to the <span className="font-bold text-white">2–3 things that truly matter</span> before your deadline, says what to drop guilt-free, and gives you one tiny first step.
                <span className="block mt-1.5 text-white/70">Use it the night before a deadline, when your list feels impossible, or any "I don't know where to start" moment.</span>
              </InfoHint>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={lowEnergy}
              disabled={isThinking}
              className="flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#13565F] bg-white/90 border border-[#E6E3DC] hover:border-[#20808D]/50 active:scale-[0.98] transition disabled:opacity-50"
            >
              <BatteryLow className="w-4 h-4 text-[#20808D]" /> <span className="hidden sm:inline">I'm wiped</span>
            </button>
            <div className="absolute -top-2 -right-2 z-20">
              <InfoHint title="I'm wiped — low-energy mode" tone="onLight">
                Re-sorts your day so <span className="font-bold text-white">quick, low-effort tasks come first</span> to build momentum, and pushes deep-focus work to later or your peak hours.
                <span className="block mt-1.5 text-white/70">Use it when you're tired, distracted, or struggling to start — small wins first.</span>
              </InfoHint>
            </div>
          </div>
        </div>
      )}
      </div>
      <button
        type="button"
        onClick={toggleActivity}
        title={activityCollapsed ? "Show agent activity" : "Hide agent activity"}
        className="2xl:hidden absolute bottom-5 right-5 z-30 w-11 h-9 rounded-xl bg-white/90 border border-[#E6E3DC] text-[#5B6B6E] shadow-[0_10px_24px_rgba(19,52,59,0.10)] flex items-center justify-center hover:text-[#13343B] hover:border-[#20808D]/40 transition-colors"
      >
        {activityCollapsed ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
      </button>
    </div>
  );
}

// The Today board keeps chat + plan primary; activity only becomes a side column
// on very wide screens so expanding it cannot squeeze the plan on laptops.
function TodayBoard({ inputRef }: { inputRef: React.RefObject<HTMLTextAreaElement> }) {
  const [activityCollapsed, setActivityCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("clutch_activity_collapsed") === "true"; } catch (e) { return false; }
  });
  const toggleActivity = () => setActivityCollapsed((collapsed) => {
    const next = !collapsed;
    try { localStorage.setItem("clutch_activity_collapsed", String(next)); } catch (e) {}
    return next;
  });

  return (
    <div className="flex-1 flex flex-col xl:flex-row xl:flex-wrap 2xl:flex-nowrap gap-6 px-4 md:px-8 py-6 h-full overflow-y-auto 2xl:overflow-hidden custom-scrollbar">
      <PrioritiesColumn inputRef={inputRef} activityCollapsed={activityCollapsed} toggleActivity={toggleActivity} />
      <div className="w-full xl:flex-1 xl:min-w-[420px] 2xl:w-[560px] 2xl:flex-none flex flex-col min-h-0 xl:h-full">
        <TimelineColumn />
      </div>
      <AgentActivityFeed collapsed={activityCollapsed} toggleCollapsed={toggleActivity} />
    </div>
  );
}

const TL_START = 9;   // default day start used as a parse fallback

// Schedule times come back as 24h "HH:mm". Parse defensively (also tolerate am/pm strings).
function parseTimeStr(t: string): number {
  if (!t) return TL_START;
  const lower = t.toLowerCase();
  const parts = lower.replace(/[ap]m/, "").trim().split(":");
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return TL_START;
  if (lower.includes("pm") && h < 12) h += 12;
  if (lower.includes("am") && h === 12) h = 0;
  return h + (isNaN(m) ? 0 : m / 60);
}

function blockTimes(block: ScheduledBlock, windowStart = 0, windowEnd = 24) {
  let start = parseTimeStr(block.startTime);
  let end = parseTimeStr(block.endTime);
  if (end <= start) end += 24;
  if (windowEnd > 24 && start < windowStart) {
    start += 24;
    end += 24;
  }
  return { start, end: Math.max(start + 0.05, end) };
}

function displayWindow(settings: { workStart: number; workEnd: number }) {
  const start = settings.workStart;
  const end = settings.workEnd === start ? start + 1 : settings.workEnd <= start ? settings.workEnd + 24 : settings.workEnd;
  return { start, end };
}

// Pack blocks into side-by-side columns so overlapping ones never stack on top of each other.
// Returns each block with { col, cols } describing its lane and how wide its overlap cluster is.
function layoutBlocks(schedule: ScheduledBlock[], windowStart = 0, windowEnd = 24) {
  const blocks = schedule
    .map((b, idx) => ({ b, idx, ...blockTimes(b, windowStart, windowEnd) }))
    .sort((a, z) => a.start - z.start || a.end - z.end);

  const out: { b: ScheduledBlock; idx: number; start: number; end: number; col: number; cols: number }[] = [];
  let cluster: typeof out = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    cluster.forEach((c) => (c.cols = cols));
    out.push(...cluster);
    cluster = [];
  };

  for (const item of blocks) {
    if (item.start >= clusterEnd) flush();
    // first free lane in the current cluster
    const used = new Set(cluster.filter((c) => c.end > item.start).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ ...item, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return out;
}

// 13.5 -> "1:30 PM"
function fmt12(dec: number): string {
  const normalized = ((dec % 24) + 24) % 24;
  let h = Math.floor(normalized);
  const m = Math.round((normalized - h) * 60);
  const ap = h < 12 ? "AM" : "PM";
  let hh = h % 12; if (hh === 0) hh = 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
function fmtDur(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60), m = Math.round(mins % 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.max(1, Math.round(mins))}m`;
}

// A clean agenda timeline. A list never overlaps, so dense back-to-back micro-blocks stay
// perfectly legible — unlike a proportional grid that has to squeeze 5-minute blocks.
// "Now" focus companion — kills time-blindness by always answering "what do I do this minute?"
function NowCard() {
  const { schedule, executeAgentAction, isThinking, settings } = useAgent();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const { start: windowStart, end: windowEnd } = displayWindow(settings);
  const now = new Date();
  const nowDec = now.getHours() + now.getMinutes() / 60;
  const windowNow = windowEnd > 24 && nowDec < windowStart ? nowDec + 24 : nowDec;
  const blocks = schedule
    .map((b) => ({ b, ...blockTimes(b, windowStart, windowEnd) }))
    .sort((a, z) => a.start - z.start);
  const current = blocks.find((x) => windowNow >= x.start && windowNow < x.end);
  const next = blocks.find((x) => x.start > windowNow);
  if (!current && !next) return null;

  const minsLeft = current ? Math.max(0, Math.round((current.end - windowNow) * 60)) : 0;
  const pct = current ? Math.min(100, Math.max(0, ((windowNow - current.start) / (current.end - current.start)) * 100)) : 0;
  const runningOver = () => {
    if (isThinking) return;
    executeAgentAction("", undefined, "I'm running over on my current task. Re-plan the rest of my day starting from the current time — keep what still fits, push or drop the rest. Do not create new tasks.");
  };

  return (
    <div className="mb-4 rounded-2xl border border-[#20808D]/30 bg-gradient-to-br from-[#E8F4F4] to-white p-4 shrink-0">
      {current ? (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#20808D] flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#20808D] animate-pulse" /> Now · until {fmt12(current.end)}</span>
            <span className="text-[11px] font-bold tabular-nums text-[#13565F]">{minsLeft}m left</span>
          </div>
          <div className="text-base font-semibold text-[#13343B] leading-tight">{current.b.title}</div>
          <div className="h-1.5 w-full bg-black/[0.06] rounded-full overflow-hidden mt-2.5">
            <div className="h-full bg-[#20808D] rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2.5 gap-2">
            <span className="text-[11px] text-[#5B6B6E] truncate">{next ? `Next · ${next.b.title}` : "Last block of the day"}</span>
            <button onClick={runningOver} disabled={isThinking} className="text-[11px] font-semibold text-[#C2410C] hover:text-[#9A330A] disabled:opacity-50 shrink-0">Running over?</button>
          </div>
        </>
      ) : next ? (
        <>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#9AA7A9] mb-1">Up next · {fmt12(next.start)}</div>
          <div className="text-base font-semibold text-[#13343B] leading-tight">{next.b.title}</div>
        </>
      ) : null}
    </div>
  );
}

function TimelineColumn() {
  const { tasks, schedule, settings, markTaskStatus, archiveTask, executeAgentAction, isThinking } = useAgent();

  const [calState, setCalState] = useState<"idle" | "syncing" | "done" | "error">("idle");
  const [calMsg, setCalMsg] = useState("");
  const [calendarClientId, setCalendarClientId] = useState(() => FALLBACK_GCAL_CLIENT_ID || "");
  const activeCount = tasks.filter((t) => t.status === "idle" && !t.parentId).length;
  const taskById = new Map<string, PrioritizedTask>(tasks.map((task) => [task.id, task]));
  const hasTasks = tasks.some((t) => t.status === "idle");

  const reprioritize = () => {
    if (isThinking || !hasTasks) return;
    executeAgentAction(
      "",
      undefined,
      "Re-evaluate ALL of my existing tasks together and re-prioritize them now by urgency and importance - assign each NOW, NEXT, or LATER with a fresh one-line reason. Do NOT create any new tasks."
    );
  };

  useEffect(() => {
    let cancelled = false;
    loadRuntimeConfig().then((config) => {
      if (!cancelled) setCalendarClientId(config.googleCalendarClientId || FALLBACK_GCAL_CLIENT_ID || "");
    });
    return () => { cancelled = true; };
  }, []);

  const syncCal = async () => {
    if (!schedule.length || calState === "syncing" || !calendarClientId) return;
    setCalState("syncing");
    try {
      const n = await addBlocksToCalendar(schedule, calendarClientId);
      setCalMsg(String(n));
      setCalState("done");
      setTimeout(() => setCalState("idle"), 4000);
    } catch (err: any) {
      const raw = String(err?.message || "");
      setCalMsg(/invalid_client|client/i.test(raw) ? "Calendar OAuth client is invalid. Redeploy with the current Google OAuth Client ID." : raw || "Calendar sync failed.");
      setCalState("error");
      setTimeout(() => setCalState("idle"), 5000);
    }
  };

  const listenPlan = () => {
    if (!schedule.length) return;
    speakText(planSpeech(tasks, schedule));
  };

  const { start: windowStart, end: windowEnd } = displayWindow(settings);
  const blocks = schedule
    .map((b, idx) => ({ b, idx, ...blockTimes(b, windowStart, windowEnd) }))
    .sort((a, z) => a.start - z.start || a.end - z.end);

  const now = new Date();
  const nowDec = now.getHours() + now.getMinutes() / 60;
  const windowNow = windowEnd > 24 && nowDec < windowStart ? nowDec + 24 : nowDec;

  return (
    <div className="w-full xl:flex-1 glass-card flex flex-col relative shrink-0 overflow-hidden min-h-[420px] xl:min-h-0">
      <div className="p-4 border-b border-[#E6E3DC] bg-black/[0.025] shrink-0 z-10">
        <div className="flex flex-col gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <Calendar className="w-4 h-4 text-[#20808D] shrink-0" />
              <span className="text-[11px] uppercase tracking-widest text-[#5B6B6E] font-bold whitespace-nowrap">Today's Plan</span>
              {activeCount > 0 && <span className="text-[10px] font-bold text-[#20808D] bg-[#20808D]/10 rounded-full px-2 py-0.5">{activeCount}</span>}
            </div>
            <p className="text-[11px] text-[#9AA7A9] leading-relaxed mt-2 max-w-[46rem]">
              Timed by urgency: <span className="font-semibold text-[#5B6B6E]">NOW - NEXT - LATER</span>. Big blocks can break into smaller steps without losing their time slot.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasTasks && (
              <button onClick={reprioritize} disabled={isThinking} title="Re-evaluate and re-rank all tasks together" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg border border-[#20808D]/25 text-[#20808D] hover:bg-[#20808D]/5 disabled:opacity-50 transition-colors">
                <RotateCcw className={clsx("w-3.5 h-3.5", isThinking && "animate-spin")} />
                <span className="hidden sm:inline">Re-prioritize</span>
              </button>
            )}
            {schedule.length > 0 && (
              <button onClick={listenPlan} title="Read today's visible plan aloud" className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg border border-[#20808D]/25 text-[#20808D] hover:bg-[#20808D]/5 transition-colors">
                <Volume2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Listen</span>
              </button>
            )}
            <span className="text-[10px] text-[#20808D] font-bold whitespace-nowrap">{schedule.length} Block(s)</span>
            {calendarClientId && schedule.length > 0 && (
              <button
                onClick={syncCal}
                disabled={calState === "syncing"}
                title="Add today's plan to Google Calendar"
                className={clsx(
                  "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-60",
                  calState === "error" ? "text-[#C2410C] border-[#C2410C]/30 hover:bg-[#C2410C]/5" : "text-[#20808D] border-[#20808D]/30 hover:bg-[#20808D]/5"
                )}
              >
                <Calendar className={clsx("w-3.5 h-3.5", calState === "syncing" && "animate-pulse")} />
                {calState === "syncing" ? "Syncing…" : calState === "done" ? `Added ${calMsg} ✓` : calState === "error" ? "Calendar setup" : "Add to Calendar"}
              </button>
            )}
          </div>
        </div>
        {calState === "error" && calMsg && (
          <div className="mt-3 rounded-lg border border-[#C2410C]/20 bg-[#C2410C]/[0.06] px-3 py-2 text-[11px] leading-relaxed text-[#9A330A]">
            {calMsg}
          </div>
        )}
      </div>

      <div className="timeline-scroll flex-1 overflow-y-auto w-full custom-scrollbar p-4">
        <NowCard />
        {blocks.length === 0 ? (
          <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center">
            <Calendar className="w-8 h-8 text-[#13343B]/20 mb-3" />
            <p className="text-[#5B6B6E] text-sm">No blocks scheduled yet.</p>
            <p className="text-[#9AA7A9] text-xs mt-1">Plan some tasks and your timed day appears here.</p>
          </div>
        ) : (
          <>
            {blocks.map(({ b: block, idx, start, end }, i) => {
              const task = taskById.get(block.taskId);
              const subtasks = task ? tasks.filter((t) => t.parentId === task.id) : [];
              const isCurrent = windowNow >= start && windowNow < end;
              const isPast = windowNow >= end;
              const dur = (end - start) * 60;
              const category = task?.category || "NEXT";
              const catColor = category === "NOW" ? "#20808D" : category === "NEXT" ? "#2AA7B5" : "#93C3C7";
              const isDone = task?.status === "done";
              return (
                <div
                  key={block.taskId + idx}
                  className="timeline-row flex gap-3"
                >
                  {/* Time gutter */}
                  <div className="w-16 shrink-0 text-right pt-2.5">
                    <div className={clsx("text-[11px] font-bold tabular-nums leading-none", isPast ? "text-[#9AA7A9]" : "text-[#13343B]")}>{fmt12(start)}</div>
                    <div className="text-[10px] text-[#9AA7A9] tabular-nums mt-1 leading-none">{fmt12(end)}</div>
                  </div>
                  {/* Connector */}
                  <div className="flex flex-col items-center shrink-0 pt-3">
                    <div className={clsx("w-2.5 h-2.5 rounded-full ring-2 ring-white shrink-0", isCurrent ? "bg-[#20808D] shadow-[0_0_8px_#20808D]" : isPast ? "bg-[#C2CACB]" : "bg-[#20808D]/50")} />
                    {i < blocks.length - 1 && <div className="w-px flex-1 bg-[#E6E3DC] my-1" />}
                  </div>
                  {/* Card */}
                  <div className={clsx(
                    "group flex-1 min-w-0 mb-2 rounded-xl border p-3",
                    isCurrent ? "bg-[#20808D]/10 border-[#20808D]/35" : "bg-black/[0.02] border-[#E6E3DC]",
                    isPast && !isCurrent && "opacity-60"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-widest tabular-nums" style={{ color: catColor }}>{category}</span>
                          <LoadBadge load={task?.cognitiveLoad} />
                          {isCurrent && <span className="text-[10px] font-bold uppercase tracking-widest text-[#20808D] flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#20808D] animate-pulse" />Now</span>}
                        </div>
                        <div className={clsx("text-sm font-semibold leading-tight text-[#13343B]", (isDone || isPast) && "line-through")}>{task?.title || block.title}</div>
                        {task?.reason && <div className="text-[11px] text-[#9AA7A9] mt-1 leading-snug">{task.reason}</div>}
                      </div>
                      {task && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => markTaskStatus(task.id, isDone ? "idle" : "done")}
                            title={isDone ? "Mark as not done" : "Mark as done"}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#13343B]/40 hover:text-[#13343B] hover:bg-black/[0.04] transition-colors"
                          >
                            {isDone ? <CheckCircle2 className="w-[18px] h-[18px] text-[#34D399]" /> : <Circle className="w-[18px] h-[18px]" />}
                          </button>
                          <button
                            onClick={() => archiveTask(task.id)}
                            title="Archive task"
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#13343B]/35 hover:text-[#20808D] hover:bg-[#20808D]/10 transition-colors"
                          >
                            <Archive className="w-[17px] h-[17px]" />
                          </button>
                        </div>
                      )}
                    </div>
                    {subtasks.length > 0 && (
                      <div className="ml-1 space-y-2 mt-3 border-l px-3 py-1 border-[#E0DCD3]">
                        {subtasks.map((st) => (
                          <div key={st.id} className="flex items-center gap-2 group/sub">
                            <button
                              onClick={() => markTaskStatus(st.id, st.status === "done" ? "idle" : "done")}
                              className="flex-shrink-0 text-[#13343B]/40 hover:text-[#13343B] transition-colors"
                            >
                              {st.status === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" /> : <Circle className="w-3.5 h-3.5" />}
                            </button>
                            <span className={clsx("text-xs text-[#13343B]", st.status === "done" && "line-through opacity-50")}>{st.title}</span>
                            <span className="text-[10px] text-[#9AA7A9] opacity-0 group-hover/sub:opacity-100 transition-opacity ml-auto">{st.estimated_minutes}m</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="pill bg-black/[0.04] text-[#5B6B6E] normal-case tracking-normal">{fmtDur(dur)}</span>
                      {task?.estimated_minutes && <span className="pill bg-[#20808D]/10 text-[#20808D] normal-case tracking-normal">{task.estimated_minutes}m estimate</span>}
                      {task && task.estimated_minutes >= 60 && task.status !== "done" && subtasks.length === 0 && (
                        <button
                          onClick={() => executeAgentAction(`Break down this large goal into smaller subtasks: "${task.title}". The parentTaskId IS: ${task.id}`)}
                          disabled={isThinking}
                          className="pill bg-[#20808D]/15 text-[#20808D] normal-case tracking-normal hover:bg-[#20808D]/20 disabled:opacity-50"
                        >
                          Break down
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function AgentActivityFeed({ collapsed, toggleCollapsed }: { collapsed: boolean; toggleCollapsed: () => void }) {
  const { activityFeed, isThinking } = useAgent();

  // Only resizable on very wide layouts, where the feed is a true side column.
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1536px)").matches
  );
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem("clutch_activity_width"));
    return saved >= 240 && saved <= 380 ? saved : 300;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(width);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1536px)");
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX; // drag the handle left → wider panel
      setWidth(Math.min(380, Math.max(240, startW.current + delta)));
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try { localStorage.setItem("clutch_activity_width", String(widthRef.current)); } catch (e) {}
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = widthRef.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  // Collapsed + wide: render a slim rail with an expand button.
  if (isWide && collapsed) {
    return (
      <div className="2xl:flex-shrink-0 flex flex-col items-center gap-3 w-10 border-l border-[#EDEAE2] pl-2">
        <button
          onClick={toggleCollapsed}
          title="Expand activity"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5B6B6E] hover:text-[#13343B] hover:bg-[#F2F0EA] transition-colors"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <div className="[writing-mode:vertical-rl] rotate-180 text-[10px] uppercase tracking-widest text-[#9AA7A9] font-bold">Agent Activity</div>
        <div className={clsx("w-1.5 h-1.5 rounded-full mt-1", isThinking ? "bg-[#20808D] animate-pulse" : "bg-[#C2CACB]")} />
      </div>
    );
  }
  if (!isWide && collapsed) return null;

  return (
    <div className="w-full 2xl:flex-shrink-0 flex 2xl:pl-4 2xl:border-l 2xl:border-[#EDEAE2]" style={isWide && !collapsed ? { width } : undefined}>
      {/* Content column */}
      <div className="w-full max-w-[420px] 2xl:max-w-none flex-1 min-w-0 flex flex-col gap-4 2xl:h-full">
        <div className="flex items-center justify-between shrink-0">
          <div className="text-[11px] uppercase tracking-widest text-[#9AA7A9] font-bold">Agent Activity</div>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Show activity" : "Collapse activity"}
            className="hidden 2xl:flex w-7 h-7 -mr-1 rounded-lg items-center justify-center text-[#9AA7A9] hover:text-[#13343B] hover:bg-[#F2F0EA] transition-colors"
          >
            {collapsed ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
          </button>
        </div>

        {collapsed && (
          <div className="text-[11px] text-[#9AA7A9] shrink-0">Activity hidden — tap the arrow to show.</div>
        )}

        {!collapsed && (<>
        <div className="activity-scroll 2xl:flex-1 text-[10px] space-y-4 overflow-y-auto overflow-x-hidden pr-2 pb-6 2xl:pb-20 max-h-80 2xl:max-h-none custom-scrollbar">
            {isThinking && (
              <div className="flex gap-3">
                <div className="w-1 h-1 bg-[#20808D] rounded-full mt-1.5 shrink-0 animate-pulse" />
                <div className="min-w-0">
                  <div className="text-[#5B6B6E] mb-0.5">Analyzing...</div>
                  <div className="leading-relaxed opacity-70">Agent is thinking</div>
                </div>
              </div>
            )}
            {activityFeed.map((action, i) => (
              <div
                key={action.id}
                className={clsx("flex gap-3", i > 5 && "opacity-50")}
              >
                <div className={clsx("w-1 h-1 rounded-full mt-1.5 shrink-0", i === 0 ? "bg-[#20808D]" : "bg-[#C2CACB]")} />
                <div className="min-w-0">
                  <div className={clsx("mb-0.5 font-medium", i === 0 ? "text-[#5B6B6E]" : "text-[#9AA7A9]")}>
                    {format(action.timestamp, "h:mm a")}
                  </div>
                  <div className="leading-relaxed text-[#5B6B6E] break-words">{action.description}</div>
                </div>
              </div>
            ))}
        </div>

        <div className="p-4 glass-bar bg-[#20808D]/5 border-[#20808D]/20 rounded-xl mt-auto shrink-0 mb-6">
          <div className="text-[#20808D] text-[11px] font-bold uppercase mb-1">Status</div>
          <div className="text-[11px] leading-snug text-[#5B6B6E]">{isThinking ? "Processing recent user input..." : "System stabilized. Awaiting input."}</div>
        </div>
        </>)}
      </div>
    </div>
  );
}

function ReplanModal() {
  const { tasks, replanState, resolveReplan } = useAgent();
  
  if (!replanState) return null;

  const getTaskTitle = (id: string) => tasks.find((t: any) => t.id === id)?.title || "Unknown Task";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-lg p-6 border-[#E0DCD3]"
      >
        <div className="flex items-center gap-3 mb-6">
          <ClutchLogo className="h-6" />
          <h2 className="text-xl font-display font-medium uppercase tracking-tighter">Re-plan Protocol</h2>
        </div>
        
        <p className="text-[#13343B] mb-6 leading-relaxed">{replanState.message}</p>

        <div className="space-y-4 mb-8">
          {replanState.keep && replanState.keep.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#34D399] mb-2">Keep today</div>
              <ul className="space-y-1 text-sm text-[#13343B]/80">
                {replanState.keep.map((id: string) => <li key={id}>• {getTaskTitle(id)}</li>)}
              </ul>
            </div>
          )}
          {replanState.move && replanState.move.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#F5A623] mb-2">Move to tomorrow</div>
              <ul className="space-y-1 text-sm text-[#13343B]/80">
                {replanState.move.map((id: string) => <li key={id}>• {getTaskTitle(id)}</li>)}
              </ul>
            </div>
          )}
          {replanState.drop && replanState.drop.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#FF4D4D] mb-2">Drop</div>
              <ul className="space-y-1 text-sm text-[#FF4D4D]/70 line-through">
                {replanState.drop.map((id: string) => <li key={id}>• {getTaskTitle(id)}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button 
            onClick={() => resolveReplan(false)}
            className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-[#5B6B6E] hover:text-[#13343B] transition-colors border border-[#E6E3DC] bg-black/[0.04]"
          >
            Dismiss
          </button>
          <button 
            onClick={() => resolveReplan(true)}
            className="px-4 py-2 bg-[#20808D] text-white text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all active:scale-95"
          >
            Approve Plan
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function RescueModal() {
  const { tasks, rescueState, applyRescue } = useAgent();
  if (!rescueState) return null;
  const getTitle = (id: string) => tasks.find((t: any) => t.id === id)?.title || "Task";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#13343B]/55">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass-card w-full max-w-lg border-[#E0DCD3] max-h-[88vh] flex flex-col p-0 overflow-hidden"
      >
        <div className="p-6 pb-5 bg-gradient-to-br from-[#FFF3EC] to-white border-b border-[#F0E2D8] shrink-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#E0602C] to-[#C2410C] flex items-center justify-center shadow-[0_6px_16px_rgba(194,65,12,0.3)]">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-lg font-display font-bold text-[#13343B]">Clutch Mode</h2>
            </div>
            <button
              onClick={() => speakText(rescueSpeech(rescueState, getTitle))}
              title="Read this plan aloud"
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#C2410C] hover:text-[#9A330A] px-2.5 py-1.5 rounded-lg hover:bg-[#C2410C]/[0.06] transition-colors shrink-0"
            >
              <Volume2 className="w-4 h-4" /> Listen
            </button>
          </div>
          <p className="text-[15px] text-[#5B6B6E] leading-relaxed">{rescueState.message}</p>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar space-y-5">
          {rescueState.firstStep && (
            <div className="rounded-xl bg-[#20808D]/[0.08] border border-[#20808D]/25 p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#20808D] mb-1 flex items-center gap-1.5"><ArrowRight className="w-3.5 h-3.5" /> Start here, right now</div>
              <div className="text-sm font-semibold text-[#13343B]">{rescueState.firstStep}</div>
            </div>
          )}
          {rescueState.doNow.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#C2410C] mb-2">Do now · {rescueState.doNow.length}</div>
              <div className="space-y-2">
                {rescueState.doNow.map((d) => (
                  <div key={d.taskId} className="rounded-xl border border-[#E6E3DC] bg-white p-3">
                    <div className="text-sm font-semibold text-[#13343B]">{getTitle(d.taskId)}</div>
                    {d.reason && <div className="text-[11px] text-[#9AA7A9] mt-0.5">{d.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {rescueState.ifTime.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#9AA7A9] mb-2">If time allows</div>
              <ul className="space-y-1 text-sm text-[#5B6B6E]">{rescueState.ifTime.map((id) => <li key={id}>• {getTitle(id)}</li>)}</ul>
            </div>
          )}
          {rescueState.dropForNow.length > 0 && (
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#9AA7A9] mb-2">Let go of — for now</div>
              <ul className="space-y-1 text-sm text-[#9AA7A9] line-through">{rescueState.dropForNow.map((id) => <li key={id}>• {getTitle(id)}</li>)}</ul>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-[#EDEAE2] flex justify-end gap-3 shrink-0">
          <button onClick={() => applyRescue(false)} className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-[#5B6B6E] hover:text-[#13343B] border border-[#E6E3DC] bg-black/[0.03] transition-colors">Dismiss</button>
          <button onClick={() => applyRescue(true)} className="px-5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-white bg-gradient-to-r from-[#E0602C] to-[#C2410C] active:scale-95 shadow-[0_8px_20px_rgba(194,65,12,0.28)] transition">Apply this plan</button>
        </div>
      </motion.div>
    </div>
  );
}

type View = 'today' | 'insights' | 'calendar' | 'archive' | 'settings';

const NAV_ITEMS: { id: View; label: string; icon: React.ComponentType<any> }[] = [
  { id: 'today', label: 'Today', icon: LayoutDashboard },
  { id: 'insights', label: 'Insights', icon: BarChart3 },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'archive', label: 'Archive', icon: Archive },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function LeftSidebar({ activeView, setActiveView, onNewTask }: { activeView: View, setActiveView: (v: View) => void, onNewTask: () => void }) {
  const { goHome } = useAgent();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("clutch_sidebar_collapsed") === "true"; } catch (e) { return false; }
  });
  const toggle = () => setCollapsed((c) => {
    const v = !c;
    try { localStorage.setItem("clutch_sidebar_collapsed", String(v)); } catch (e) {}
    return v;
  });

  return (
    <div className={clsx("flex-shrink-0 border-r border-[#EDEAE2] h-full flex flex-col bg-white overflow-hidden transition-[width] duration-300 ease-in-out", collapsed ? "w-[76px]" : "w-64")}>
      {/* Brand + toggle (logo stays anchored at top) */}
      <div className={clsx("h-[72px] shrink-0 flex items-center", collapsed ? "justify-center px-2" : "px-5")}>
        <button onClick={goHome} title="Back to home" className="cursor-pointer group shrink-0">
          <ClutchLogo className={clsx("origin-center transition-all duration-300 group-hover:text-[#20808D]", collapsed ? "h-[18px]" : "h-7")} />
        </button>
      </div>

      <div className="pb-2" />

      {/* Nav */}
      <div className="px-4 pb-1 h-[22px] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9AA7A9] overflow-hidden whitespace-nowrap">{!collapsed && "Workspace"}</div>
      <div className={clsx("py-2 space-y-1 flex-1", collapsed ? "px-2" : "px-3")}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              title={item.label}
              className={clsx(
                "w-full flex items-center py-2.5 text-sm font-medium rounded-xl transition-colors",
                collapsed ? "justify-center" : "px-3.5 gap-3",
                active
                  ? "bg-[#13343B] text-white shadow-[0_6px_16px_rgba(19,52,59,0.18)]"
                  : "text-[#5B6B6E] hover:bg-[#F2F0EA] hover:text-[#13343B]"
              )}>
              <Icon className={clsx("w-[18px] h-[18px] shrink-0", active ? "text-white" : "text-[#9AA7A9]")} />
              {!collapsed && item.label}
            </button>
          );
        })}

        <button
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={clsx(
            "w-full flex items-center py-2.5 text-sm font-medium rounded-xl text-[#5B6B6E] hover:bg-[#F2F0EA] hover:text-[#13343B] transition-colors",
            collapsed ? "justify-center" : "px-3.5 gap-3"
          )}>
          {collapsed ? <ChevronsRight className="w-[18px] h-[18px] shrink-0" /> : (<><ChevronsLeft className="w-[18px] h-[18px] shrink-0" /> Collapse</>)}
        </button>
      </div>

      {/* Profile */}
      <div className={clsx("border-t border-[#EDEAE2]", collapsed ? "p-2" : "p-3")}>
        <div className={clsx("flex items-center rounded-xl transition-colors", collapsed ? "justify-center" : "gap-3 p-2 hover:bg-[#F2F0EA]")}>
          <div className="w-9 h-9 rounded-full bg-[#E8F2F1] flex items-center justify-center text-[#13565F] font-semibold text-sm shrink-0">P</div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#13343B] truncate">amparthiv94</div>
              <div className="text-[11px] text-[#9AA7A9]">Pro Plan</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ArchiveView() {
  const { tasks, restoreTask, deleteTask } = useAgent();
  const archivedTasks = tasks
    .filter(t => t.status === 'done' || t.status === 'dropped' || t.status === 'archived')
    .sort((a, b) => b.createdAt - a.createdAt);
  const statusClass = (status: string) => {
    if (status === "done") return "bg-[#34D399]/20 text-[#0F8A5F]";
    if (status === "dropped") return "bg-[#FF4D4D]/20 text-[#D93636]";
    return "bg-[#20808D]/12 text-[#20808D]";
  };

  return (
    <main className="flex-1 flex flex-col px-4 md:px-8 py-6 relative z-10 overflow-hidden">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
        <div className="flex-1 glass-card overflow-y-auto w-full custom-scrollbar p-6">
           {archivedTasks.length === 0 ? (
              <div className="text-center py-20 flex flex-col items-center justify-center h-full">
                <Archive className="w-12 h-12 text-[#13343B]/20 mb-4" />
                <p className="text-[#5B6B6E]">No archived tasks yet.</p>
                <p className="text-[#9AA7A9] text-xs mt-1">Archive or complete tasks from Priorities to build your history.</p>
              </div>
           ) : (
             <div className="space-y-2">
               {archivedTasks.map(task => (
                 <div key={task.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/[0.025] border border-[#E6E3DC] rounded-xl gap-4 group">
                   <div className="flex items-center gap-4 min-w-0">
                     <div className="text-[#9AA7A9] text-[10px] font-mono tracking-widest uppercase shrink-0 w-16">
                       {format(task.createdAt, "MMM d")}
                     </div>
                      <div className={clsx("text-sm font-semibold truncate", task.status === 'dropped' ? "text-[#5B6B6E] line-through" : "text-[#13343B]")}>
                        {task.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={clsx("text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded", statusClass(task.status))}>
                        {task.status}
                      </div>
                     <button onClick={() => restoreTask(task.id)} title="Restore to active" className="p-1.5 rounded-lg text-[#5B6B6E] hover:text-[#13343B] hover:bg-black/[0.05] transition-colors">
                       <RotateCcw className="w-4 h-4" />
                     </button>
                     <button onClick={() => deleteTask(task.id)} title="Delete permanently" className="p-1.5 rounded-lg text-[#5B6B6E] hover:text-[#FF4D4D] hover:bg-[#FF4D4D]/10 transition-colors">
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </main>
  );
}

interface GNode { id: string; title: string; cat: string; isSub: boolean; parentId?: string; r: number; }
interface GLink { a: string; b: string; }
interface Pos { x: number; y: number; vx: number; vy: number; }

const bubbleColor = (cat: string) => {
  if (cat === "NOW") return { c: "#20808D", tint: "#5FB8C2" };
  if (cat === "NEXT") return { c: "#2AA7B5", tint: "#8BD3DB" };
  return { c: "#93C3C7", tint: "#C6E4E6" };
};
const bubbleRadius = (min: number, isSub: boolean) => {
  const m = Math.max(10, Math.min(240, min || 30));
  const base = 30 + Math.sqrt(m) * 3.6;
  const r = isSub ? base * 0.7 : base;
  // Enforce a floor so even short-time tasks are big enough to hold their label.
  return Math.round(Math.max(isSub ? 36 : 46, r));
};

/**
 * An Obsidian/n8n-style task graph.
 * - Nodes are tasks; subtasks link back to their root task with a line.
 * - Real circle collision keeps bubbles touching, never overlapping.
 * - Drag a node to reposition it, scroll to zoom, drag empty canvas to pan.
 * - No cursor-repel; nodes drift gently when left alone.
 */
function FloatingBubbles({ tasks }: { tasks: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const lineRef = useRef<Record<string, SVGLineElement | null>>({});
  const posRef = useRef<Record<string, Pos>>({});
  const rafRef = useRef<number>(0);
  const dragIdRef = useRef<string | null>(null);
  const panRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const viewRef = useRef(view); viewRef.current = view;

  const items = tasks.slice(0, 24);
  const idsKey = items.map((t) => t.id + ":" + (t.estimated_minutes || 0) + ":" + t.category).join(",");

  // Stable graph structure derived from the current tasks.
  const graph = React.useMemo(() => {
    const ids = new Set(items.map((t) => t.id));
    const nodes: GNode[] = items.map((t) => {
      const isSub = !!t.parentId && ids.has(t.parentId);
      return { id: t.id, title: t.title, cat: t.category || "LATER", isSub, parentId: isSub ? t.parentId : undefined, r: bubbleRadius(t.estimated_minutes, isSub) };
    });
    const links: GLink[] = nodes.filter((n) => n.isSub && n.parentId).map((n) => ({ a: n.parentId!, b: n.id }));
    return { nodes, links };
  }, [idsKey]);

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont || graph.nodes.length === 0) return;
    const W = cont.clientWidth || 480;
    const H = cont.clientHeight || 460;
    const center = { x: W / 2, y: H / 2 };

    // Initialise positions for new nodes (keep positions of nodes that persisted).
    const prev = posRef.current;
    const next: Record<string, Pos> = {};
    graph.nodes.forEach((n, i) => {
      if (prev[n.id]) { next[n.id] = prev[n.id]; return; }
      const ang = (i / Math.max(1, graph.nodes.length)) * Math.PI * 2;
      const rad = Math.min(W, H) * 0.26;
      next[n.id] = { x: center.x + Math.cos(ang) * rad + (Math.random() - 0.5) * 24, y: center.y + Math.sin(ang) * rad + (Math.random() - 0.5) * 24, vx: 0, vy: 0 };
    });
    posRef.current = next;

    const nodes = graph.nodes;
    const links = graph.links;

    const step = () => {
      const pos = posRef.current;
      const dragId = dragIdRef.current;

      // gentle centering + float
      for (const n of nodes) {
        const p = pos[n.id]; if (!p || n.id === dragId) continue;
        p.vx += (center.x - p.x) * 0.0009;
        p.vy += (center.y - p.y) * 0.0009;
        p.vx += (Math.random() - 0.5) * 0.04;
        p.vy += (Math.random() - 0.5) * 0.04;
      }
      // pairwise repulsion (spacing)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = pos[nodes[i].id], b = pos[nodes[j].id]; if (!a || !b) continue;
          let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01;
          const rep = 5200 / (d * d);
          const fx = (dx / d) * rep, fy = (dy / d) * rep;
          if (nodes[i].id !== dragId) { a.vx -= fx; a.vy -= fy; }
          if (nodes[j].id !== dragId) { b.vx += fx; b.vy += fy; }
        }
      }
      // link springs (pull subtask toward its root)
      for (const l of links) {
        const a = pos[l.a], b = pos[l.b]; if (!a || !b) continue;
        const na = nodes.find((n) => n.id === l.a), nb = nodes.find((n) => n.id === l.b); if (!na || !nb) continue;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01;
        const rest = na.r + nb.r + 30;
        const f = (d - rest) * 0.012;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        if (l.a !== dragId) { a.vx += fx; a.vy += fy; }
        if (l.b !== dragId) { b.vx -= fx; b.vy -= fy; }
      }
      // integrate
      for (const n of nodes) {
        const p = pos[n.id]; if (!p) continue;
        if (n.id === dragId) { p.vx = 0; p.vy = 0; continue; }
        p.vx *= 0.86; p.vy *= 0.86;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 3.2) { p.vx = (p.vx / sp) * 3.2; p.vy = (p.vy / sp) * 3.2; }
        p.x += p.vx; p.y += p.vy;
      }
      // collision resolution — separate overlaps so circles touch, not overlap
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = pos[nodes[i].id], b = pos[nodes[j].id]; if (!a || !b) continue;
            let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01;
            const min = nodes[i].r + nodes[j].r + 3;
            if (d < min) {
              const ux = dx / d, uy = dy / d, overlap = min - d;
              const aFixed = nodes[i].id === dragId, bFixed = nodes[j].id === dragId;
              const aShift = aFixed ? 0 : (bFixed ? overlap : overlap / 2);
              const bShift = bFixed ? 0 : (aFixed ? overlap : overlap / 2);
              a.x -= ux * aShift; a.y -= uy * aShift;
              b.x += ux * bShift; b.y += uy * bShift;
            }
          }
        }
      }
      // write to DOM
      for (const n of nodes) {
        const p = pos[n.id], el = elsRef.current[n.id];
        if (p && el) el.style.transform = `translate(${p.x - n.r}px, ${p.y - n.r}px)`;
      }
      for (const l of links) {
        const a = pos[l.a], b = pos[l.b], ln = lineRef.current[l.a + ">" + l.b];
        if (a && b && ln) { ln.setAttribute("x1", String(a.x)); ln.setAttribute("y1", String(a.y)); ln.setAttribute("x2", String(b.x)); ln.setAttribute("y2", String(b.y)); }
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [graph]);

  // Non-passive wheel listener so we can zoom toward the cursor without scrolling the page.
  useEffect(() => {
    const cont = containerRef.current; if (!cont) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cont.getBoundingClientRect();
      const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(2.4, Math.max(0.4, v.k * (e.deltaY < 0 ? 1.1 : 0.9)));
        const wx = (sx - v.x) / v.k, wy = (sy - v.y) / v.k;
        return { k, x: sx - wx * k, y: sy - wy * k };
      });
    };
    cont.addEventListener("wheel", onWheel, { passive: false });
    return () => cont.removeEventListener("wheel", onWheel);
  }, []);

  const toWorld = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return { x: (clientX - rect.left - v.x) / v.k, y: (clientY - rect.top - v.y) / v.k };
  };

  const onNodeDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    dragIdRef.current = id;
  };
  const onCanvasDown = (e: React.PointerEvent) => {
    panRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragIdRef.current) {
      const w = toWorld(e.clientX, e.clientY);
      const p = posRef.current[dragIdRef.current];
      if (p) { p.x = w.x; p.y = w.y; p.vx = 0; p.vy = 0; }
    } else if (panRef.current.active) {
      const pr = panRef.current;
      setView((v) => ({ ...v, x: pr.ox + (e.clientX - pr.sx), y: pr.oy + (e.clientY - pr.sy) }));
    }
  };
  const endInteraction = () => { dragIdRef.current = null; panRef.current.active = false; };

  const zoomBy = (factor: number) => {
    const cont = containerRef.current; if (!cont) return;
    const sx = cont.clientWidth / 2, sy = cont.clientHeight / 2;
    setView((v) => {
      const k = Math.min(2.4, Math.max(0.4, v.k * factor));
      const wx = (sx - v.x) / v.k, wy = (sy - v.y) / v.k;
      return { k, x: sx - wx * k, y: sy - wy * k };
    });
  };
  const resetView = () => setView({ x: 0, y: 0, k: 1 });

  if (graph.nodes.length === 0) {
    return (
      <div className="h-[460px] flex items-center justify-center text-[#9AA7A9] text-sm border border-dashed border-[#E0DCD3] rounded-3xl node-canvas">
        Plan some tasks and they'll appear here as a graph.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={onCanvasDown}
      onPointerMove={onPointerMove}
      onPointerUp={endInteraction}
      onPointerLeave={endInteraction}
      className="relative h-[460px] w-full rounded-3xl overflow-hidden border border-[#E0DCD3] node-canvas select-none"
      style={{ touchAction: "none", cursor: panRef.current.active ? "grabbing" : "grab" }}
    >
      <div className="absolute top-0 left-0 will-change-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, transformOrigin: "0 0" }}>
        <svg className="absolute top-0 left-0 overflow-visible pointer-events-none" width="1" height="1">
          {graph.links.map((l) => (
            <line key={l.a + ">" + l.b} ref={(el) => { lineRef.current[l.a + ">" + l.b] = el; }} stroke="rgba(32,128,141,0.35)" strokeWidth={1.5} strokeLinecap="round" />
          ))}
        </svg>
        {graph.nodes.map((n) => {
          const { c, tint } = bubbleColor(n.cat);
          return (
            <div
              key={n.id}
              ref={(el) => { elsRef.current[n.id] = el; }}
              onPointerDown={(e) => onNodeDown(e, n.id)}
              className="absolute top-0 left-0 rounded-full flex items-center justify-center text-center cursor-grab active:cursor-grabbing"
              style={{
                width: n.r * 2,
                height: n.r * 2,
                background: `radial-gradient(circle at 35% 30%, ${tint} 0%, ${c} 58%, transparent 76%)`,
                willChange: "transform",
              }}
            >
              <span
                className="font-semibold text-[#0E3B40] pointer-events-none text-center"
                style={{
                  maxWidth: n.r * 1.7,
                  fontSize: Math.max(8, Math.min(12, n.r / 5)),
                  lineHeight: 1.1,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  wordBreak: "break-word",
                  padding: "0 4px",
                }}
              >
                {n.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        {[{ icon: Plus, fn: () => zoomBy(1.2), t: "Zoom in" }, { icon: Minus, fn: () => zoomBy(0.8), t: "Zoom out" }, { icon: Maximize2, fn: resetView, t: "Reset view" }].map(({ icon: Icon, fn, t }) => (
          <button key={t} onClick={fn} title={t} className="w-8 h-8 rounded-lg bg-white/90 border border-[#E0DCD3] flex items-center justify-center text-[#5B6B6E] hover:text-[#13343B] hover:border-[#20808D]/40 transition-colors shadow-sm">
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      {/* Hint */}
      <div className="absolute top-3 left-3 text-[10px] text-[#5B6B6E]/80 bg-white/70 rounded-full px-2.5 py-1 pointer-events-none">
        Drag nodes • scroll to zoom • drag canvas to pan
      </div>
    </div>
  );
}

function InsightsView() {
  const { tasks, schedule, activityFeed } = useAgent();
  const active = tasks.filter(t => t.status === 'idle');
  const done = tasks.filter(t => t.status === 'done');
  const total = tasks.length;
  const completionRate = total ? Math.round((done.length / total) * 100) : 0;
  const totalMinutes = active.reduce((a, t) => a + (t.estimated_minutes || 0), 0);
  const focusStr = totalMinutes >= 60 ? `${(totalMinutes / 60).toFixed(1)}h` : `${totalMinutes}m`;
  const catCount = (c: string) => active.filter(t => t.category === c).length;
  const nowCount = catCount('NOW');
  const biggest = [...active].sort((a, b) => (b.estimated_minutes || 0) - (a.estimated_minutes || 0))[0];
  const fmt = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`);

  const score = total ? Math.min(100, Math.round(completionRate * 0.7 + (schedule.length ? 30 : 0))) : 0;
  const scoreMsg = score >= 75 ? "You're on track — keep the momentum going."
    : score >= 40 ? "Solid start. Clear a NOW task to climb higher."
    : "Plan and finish a few tasks to build your score.";

  const insight1 = biggest
    ? `Your biggest task is "${biggest.title}" at ${fmt(biggest.estimated_minutes || 0)}. Break it into steps so it never blocks your day.`
    : "Brain-dump your day on the Today page and Clutch will map exactly where your time goes.";
  const insight2 = nowCount > 0
    ? `You have ${nowCount} task${nowCount > 1 ? 's' : ''} marked NOW — clear those first to protect your deadlines.`
    : "Nothing urgent right now — a great moment to get ahead on a NEXT task.";

  const labelCls = "text-[11px] uppercase tracking-[0.18em] text-[#9AA7A9] font-semibold";

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar px-5 md:px-10 py-8">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-x-8 gap-y-10">
        {/* Left column */}
        <div className="col-span-12 lg:col-span-3 space-y-9">
          <div>
            <div className={`${labelCls} mb-2`}>Focus time queued</div>
            <div className="font-display text-[2.75rem] leading-none text-[#13343B]">{focusStr}</div>
          </div>
          <div>
            <div className={`${labelCls} mb-3`}>Insights</div>
            <p className="text-[13px] text-[#5B6B6E] leading-relaxed mb-4">{insight1}</p>
            <p className="text-[13px] text-[#5B6B6E] leading-relaxed">{insight2}</p>
          </div>
        </div>

        {/* Center — floating bubbles */}
        <div className="col-span-12 lg:col-span-6 order-last lg:order-none">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#9AA7A9] font-semibold mb-3 text-center">Visual graph</div>
          <FloatingBubbles tasks={active} />
          <p className="text-[12px] text-[#9AA7A9] leading-relaxed mt-3 text-center max-w-md mx-auto">
            Each node is a task — size reflects estimated time, color its priority. Subtasks link to their root task; drag, pan, and zoom to explore.
          </p>
        </div>

        {/* Right column */}
        <div className="col-span-12 lg:col-span-3 space-y-9">
          <div>
            <div className={`${labelCls} mb-2`}>Focus score</div>
            <div className="font-display text-[2rem] leading-none text-[#13343B] mb-3">{score}<span className="text-[#9AA7A9] text-lg">/100</span></div>
            <div className="h-2 w-full bg-black/[0.06] rounded-full overflow-hidden">
              <div className="h-full bg-brand-gradient rounded-full transition-all duration-700" style={{ width: `${score}%` }} />
            </div>
            <p className="text-[12px] text-[#5B6B6E] leading-relaxed mt-2">{scoreMsg}</p>
          </div>

          <div>
            <div className={`${labelCls} mb-3`}>Recent activity</div>
            {activityFeed.length === 0 ? (
              <p className="text-[12px] text-[#9AA7A9]">No activity yet.</p>
            ) : (
              <div className="divide-y divide-[#E6E3DC]">
                {activityFeed.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="text-[13px] text-[#13343B] leading-snug">{a.description}</span>
                    <span className="text-[11px] text-[#9AA7A9] shrink-0 whitespace-nowrap">{format(a.timestamp, "h:mm a")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className={`${labelCls} mb-3`}>Priority mix</div>
            <div className="space-y-2.5">
              {([["NOW", "#20808D"], ["NEXT", "#2AA7B5"], ["LATER", "#93C3C7"]] as const).map(([c, col]) => {
                const n = catCount(c);
                const max = Math.max(1, active.length);
                return (
                  <div key={c} className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest text-[#5B6B6E] w-12 shrink-0">{c}</span>
                    <div className="flex-1 h-2 bg-black/[0.05] rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(n / max) * 100}%`, background: col }} />
                    </div>
                    <span className="text-[12px] text-[#13343B] font-medium w-4 text-right">{n}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function CalendarView() {
  const { schedule, settings } = useAgent();
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });
  let { start: startH, end: endH } = displayWindow(settings);
  for (const block of schedule) {
    const { start, end } = blockTimes(block, startH, endH);
    startH = Math.min(startH, Math.floor(start));
    endH = Math.max(endH, Math.ceil(end));
  }
  const hours = Array.from({ length: Math.max(1, Math.ceil(endH - startH)) }, (_, i) => startH + i);
  const hourLabel = (h: number) => {
    const normalized = ((h % 24) + 24) % 24;
    return normalized === 0 ? '12 AM' : normalized < 12 ? `${normalized} AM` : normalized === 12 ? '12 PM' : `${normalized - 12} PM`;
  };

  const HOURPX = 84;
  const bodyH = hours.length * HOURPX;
  const gridTpl = `56px repeat(7, minmax(0, 1fr))`;
  const laid = layoutBlocks(schedule, startH, endH); // packs true overlaps into columns

  return (
    <main className="flex-1 overflow-auto custom-scrollbar px-4 md:px-8 py-6">
      <div className="min-w-[760px] glass-card overflow-hidden">
        {/* Day header — sits flush above the grid (no gap) */}
        <div className="grid border-b border-[#ECE9E1]" style={{ gridTemplateColumns: gridTpl }}>
          <div className="bg-black/[0.015]" />
          {days.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} className={clsx("text-center py-2.5 border-l border-[#ECE9E1]", isToday && "bg-[#20808D]/[0.06]")}>
                <div className={clsx("text-[10px] uppercase tracking-widest font-bold", isToday ? "text-[#20808D]" : "text-[#9AA7A9]")}>{format(d, "EEE")}</div>
                <div className={clsx("text-lg font-display leading-none mt-1", isToday ? "text-[#13343B]" : "text-[#5B6B6E]")}>{format(d, "d")}</div>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="grid" style={{ gridTemplateColumns: gridTpl }}>
          {/* Time gutter */}
          <div className="relative bg-black/[0.015]" style={{ height: bodyH }}>
            {hours.map((h, hi) => (
              <div key={h} className="absolute right-2 text-[10px] text-[#9AA7A9] font-bold uppercase -translate-y-1/2" style={{ top: hi * HOURPX }}>{hourLabel(h)}</div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((d, di) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={di} className={clsx("relative border-l border-[#ECE9E1]", isToday && "bg-[#20808D]/[0.03]")} style={{ height: bodyH }}>
                {hours.map((h, hi) => (
                  <div key={h} className="absolute left-0 right-0 border-t border-[#ECE9E1]" style={{ top: hi * HOURPX }} />
                ))}
                {isToday && laid.filter(({ start, end }) => end > startH && start < endH).map(({ b, idx, start, end, col, cols }) => {
                  const visibleStart = Math.max(start, startH);
                  const visibleEnd = Math.min(end, endH);
                  const top = Math.max(0, (visibleStart - startH) * HOURPX);
                  // True proportional height (just a 1px gap) — no inflated minimum, so adjacent
                  // short blocks tile cleanly instead of overlapping the next one.
                  const height = Math.max(3, Math.min((visibleEnd - visibleStart) * HOURPX - 1, bodyH - top));
                  const gap = 3;
                  const inset = 4; // keep blocks clear of the column borders
                  const colW = `((100% - ${inset * 2}px - ${gap * (cols - 1)}px) / ${cols})`;
                  const w = `calc(${colW})`;
                  const left = `calc(${inset}px + ${colW} * ${col} + ${gap * col}px)`;
                  const tall = height > 22;
                  return (
                    <div
                      key={b.taskId + idx}
                      title={`${b.title} · ${b.startTime}–${b.endTime}`}
                      className={clsx("absolute rounded-md bg-[#20808D]/15 border border-[#20808D]/40 overflow-hidden", tall && "px-1.5 py-1")}
                      style={{ top, height, left, width: w }}
                    >
                      {tall && <div className="text-[10px] text-[#13343B] font-medium leading-tight line-clamp-2">{b.title}</div>}
                      {height > 44 && <div className="text-[9px] text-[#20808D] tabular-nums mt-0.5">{b.startTime}</div>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="text-[11px] text-[#5B6B6E] p-3 border-t border-[#ECE9E1]">Clutch plans the current day — future days fill in as you plan them.</div>
      </div>
    </main>
  );
}

// Themed dropdown. The option list is rendered in a portal so the parent card's overflow:hidden
// (and rounded corners) can't clip it.
function Dropdown({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: { value: number; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 6, left: r.left, width: r.width, maxH: Math.min(240, window.innerHeight - r.bottom - 16) });
  };
  const toggle = () => { if (!open) place(); setOpen((o) => !o); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    // Close when the PAGE scrolls (the anchor button moves), but ignore scrolling inside the menu itself.
    const onScroll = (e: Event) => {
      if (popRef.current && popRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div className="relative mt-1">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={clsx(
          "w-full flex items-center justify-between gap-2 bg-white border rounded-xl px-3.5 py-2.5 text-sm text-[#13343B] transition-colors",
          open ? "border-[#20808D]/60 shadow-[0_0_0_3px_rgba(32,128,141,0.10)]" : "border-[#E0DCD3] hover:border-[#20808D]/40"
        )}
      >
        <span className="font-medium">{selected?.label}</span>
        <ChevronDown className={clsx("w-4 h-4 text-[#9AA7A9] transition-transform duration-200 shrink-0", open && "rotate-180")} />
      </button>
      {open && pos && createPortal(
        <motion.div
          ref={popRef}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.13, ease: "easeOut" }}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxH, zIndex: 100 }}
          className="overflow-y-auto custom-scrollbar bg-white border border-[#E6E3DC] rounded-xl shadow-[0_18px_44px_rgba(19,52,59,0.16)] p-1.5"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={clsx(
                  "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2",
                  active ? "bg-[#20808D]/10 text-[#13565F] font-semibold" : "text-[#13343B] hover:bg-[#F2F0EA]"
                )}
              >
                {o.label}
                {active && <Check className="w-3.5 h-3.5 text-[#20808D] shrink-0" />}
              </button>
            );
          })}
        </motion.div>,
        document.body
      )}
    </div>
  );
}

function SettingsView() {
  const { settings, updateSettings, clearAllData } = useAgent();
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

  return (
    <main className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 py-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="glass-card p-6 space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-[#9AA7A9] font-bold">Working hours</div>
            <p className="text-[12px] text-[#5B6B6E] mt-1">The window Clutch uses when planning your calendar.</p>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5B6B6E]">Start</label>
              <Dropdown value={settings.workStart} onChange={(v) => updateSettings({ workStart: v })} options={hours.map((h) => ({ value: h, label: hourLabel(h) }))} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5B6B6E]">End</label>
              <Dropdown value={settings.workEnd} onChange={(v) => updateSettings({ workEnd: v })} options={hours.map((h) => ({ value: h, label: hourLabel(h) }))} />
            </div>
          </div>

          <div className="pt-2 border-t border-[#ECE9E1]">
            <div className="text-[11px] uppercase tracking-widest text-[#9AA7A9] font-bold">Peak energy window</div>
            <p className="text-[12px] text-[#5B6B6E] mt-1 mb-3">When you focus best. Clutch schedules deep-focus tasks here and busywork outside it.</p>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest text-[#5B6B6E]">Peak start</label>
                <Dropdown value={settings.peakStart} onChange={(v) => updateSettings({ peakStart: v })} options={hours.map((h) => ({ value: h, label: hourLabel(h) }))} />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-widest text-[#5B6B6E]">Peak end</label>
                <Dropdown value={settings.peakEnd} onChange={(v) => updateSettings({ peakEnd: v })} options={hours.map((h) => ({ value: h, label: hourLabel(h) }))} />
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#13343B]">Voice input — dictate your tasks</div>
            <div className="text-[12px] text-[#5B6B6E]">Show the microphone for hands-free capture.</div>
          </div>
          <button onClick={() => updateSettings({ voiceEnabled: !settings.voiceEnabled })}
            className={clsx("w-12 h-6 rounded-full transition-colors relative shrink-0", settings.voiceEnabled ? "bg-[#20808D]" : "bg-black/[0.06]")}>
            <span className={clsx("absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all", settings.voiceEnabled ? "left-[26px]" : "left-0.5")} />
          </button>
        </div>

        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#13343B]">Agent voice — speak responses aloud</div>
            <div className="text-[12px] text-[#5B6B6E]">Let Clutch read plan summaries, replans, and Clutch Mode out loud.</div>
          </div>
          <button onClick={() => updateSettings({ speakEnabled: !settings.speakEnabled })}
            className={clsx("w-12 h-6 rounded-full transition-colors relative shrink-0", settings.speakEnabled ? "bg-[#20808D]" : "bg-black/[0.06]")}>
            <span className={clsx("absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all", settings.speakEnabled ? "left-[26px]" : "left-0.5")} />
          </button>
        </div>

        <div className="glass-card p-6">
          <div className="text-sm font-semibold text-[#13343B] mb-1">Powered by Google Gemini</div>
          <div className="text-[12px] text-[#5B6B6E]">Clutch's planning agent runs on Google's Gemini models via Google AI Studio.</div>
        </div>

        <div className="glass-card p-6 border-[#FF4D4D]/20">
          <div className="text-sm font-semibold text-[#FF4D4D] mb-1">Danger zone</div>
          <div className="text-[12px] text-[#5B6B6E] mb-4">Permanently delete local and cloud-synced tasks, schedule, activity, and settings.</div>
          <button onClick={() => { if (window.confirm("Delete all Clutch data? This cannot be undone.")) clearAllData(); }}
            className="px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest text-[#FF4D4D] border border-[#FF4D4D]/30 hover:bg-[#FF4D4D]/10 transition-colors">
            Clear all data
          </button>
        </div>
      </div>
    </main>
  );
}

export function Dashboard() {
  const { isThinking } = useAgent();
  const [activeView, setActiveView] = useState<View>('today');
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const handleNewTask = () => {
    setActiveView('today');
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  return (
    <div className="h-screen w-screen relative z-10 flex overflow-hidden">
      <LeftSidebar activeView={activeView} setActiveView={setActiveView} onNewTask={handleNewTask} />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-8 py-6 z-10 border-b border-[#E6E3DC] shrink-0">
          <div className="text-xl font-display opacity-80 flex items-center gap-2 capitalize">
            {activeView === 'today' ? (
              <>Today <span className="opacity-40">•</span> <span className="text-[#5B6B6E] text-sm uppercase tracking-widest">{format(new Date(), "EEEE, MMM do")}</span></>
            ) : activeView}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-[10px] uppercase tracking-widest text-[#5B6B6E] hidden sm:block">
              Agent Status<br/>
              <span className={clsx("text-[#20808D]", isThinking && "animate-pulse")}>
                {isThinking ? "Thinking..." : "Monitoring Goals"}
              </span>
            </div>
            <div className={clsx("agent-orb", isThinking && "thinking")} title={isThinking ? "Agent is thinking" : "Agent online"} />
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col relative z-10">
          {activeView === 'today' && <TodayBoard inputRef={inputRef} />}
          {activeView !== 'today' && (
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {activeView === 'insights' && <InsightsView />}
              {activeView === 'calendar' && <CalendarView />}
              {activeView === 'archive' && <ArchiveView />}
              {activeView === 'settings' && <SettingsView />}
            </motion.div>
          )}
        </main>
      </div>

      <ReplanModal />
      <RescueModal />
    </div>
  );
}
