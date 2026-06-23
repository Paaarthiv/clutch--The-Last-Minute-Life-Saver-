import React, { useState, useRef, useEffect } from "react";
import { useAgent } from "../AgentContext";
import { Mic, CheckCircle2, Circle, Clock, LayoutDashboard, BrainCircuit, Calendar, CheckSquare, Inbox, Folder, Archive, HelpCircle, LogOut, Plus, User, Loader2, Sparkles, BarChart3, Settings as SettingsIcon, RotateCcw, Trash2, ChevronsLeft, ChevronsRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import clsx from "clsx";

import { ClutchLogo } from "./ClutchLogo";

function CaptureBar({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const { executeAgentAction, isThinking, settings } = useAgent();
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
       alert("Speech recognition is not supported in this browser.");
       return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }
      if (finalTranscript) {
        setInput((prev) => prev + (prev ? " " : "") + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    executeAgentAction(input);
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative mb-0 shrink-0">
       <div className="glass-bar p-4 flex items-center gap-4 w-full">
          {settings.voiceEnabled && (
            <button
              type="button"
              onClick={startRecording}
              className={clsx("transition-colors relative shrink-0", isRecording ? "text-[#20808D]" : "text-[#5B6B6E] hover:text-[#13343B]")}
            >
              {isRecording && <span className="absolute inset-[-4px] bg-[#20808D]/20 rounded-full animate-ping" />}
              <Mic className="w-5 h-5 relative z-10" />
            </button>
          )}
          <input 
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRecording ? "Listening..." : "What needs to get done?"}
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-[#9AA7A9] text-[#13343B] flex-1"
          />
          <button
            type="submit"
            disabled={!input.trim() || isThinking}
            className="px-4 py-2 bg-[#20808D] text-white text-[11px] font-bold uppercase tracking-widest rounded-lg disabled:opacity-50 transition-all active:scale-95 hover:brightness-110 whitespace-nowrap flex items-center gap-1.5"
          >
            {isThinking ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Planning</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Plan</>
            )}
          </button>
       </div>
    </form>
  );
}

interface TaskCardProps {
  task: any;
  allTasks?: any[];
}

const TaskCard: React.FC<TaskCardProps> = ({ task, allTasks }) => {
  const { markTaskStatus, executeAgentAction, isThinking } = useAgent();
  const isDone = task.status === "done";
  const subtasks = allTasks ? allTasks.filter((t) => t.parentId === task.id) : [];
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={clsx("glass-card p-4 relative overflow-hidden group", isDone && "opacity-50")}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-start gap-2">
          <button 
            onClick={() => markTaskStatus(task.id, isDone ? "idle" : "done")}
            className="flex-shrink-0 mt-0.5 text-[#13343B]/50 hover:text-[#13343B] transition-colors"
          >
            {isDone ? <CheckCircle2 className="w-4 h-4 text-[#34D399]" /> : <div className="w-4 h-4 border border-[#D6D1C7] rounded-sm" />}
          </button>
          <div>
            <span className={clsx("text-sm font-semibold block leading-tight", isDone && "line-through")}>{task.title}</span>
            {task.deadline && (
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#20808D] mt-1 block">Due {task.deadline}</span>
            )}
          </div>
        </div>
      </div>
      
      {subtasks.length > 0 && (
        <div className="ml-6 space-y-2 mb-3 mt-3 border-l px-3 py-1 border-[#E0DCD3]">
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

      <div className="flex gap-2 mt-4">
        <span className="pill bg-black/[0.04] text-[#5B6B6E]">{task.estimated_minutes}m</span>
        
        {task.estimated_minutes >= 60 && !isDone && (
          <button 
            onClick={() => executeAgentAction(`Break down this large goal into smaller subtasks: "${task.title}". The parentTaskId IS: ${task.id}`)}
            disabled={isThinking}
            className="pill bg-[#20808D]/20 text-[#20808D] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-left focus:opacity-100 uppercase font-bold"
          >
            Breakdown
          </button>
        )}
      </div>
      
      {task.reason && (
        <div className="text-[11px] italic text-[#9AA7A9] mt-3">✨ {task.reason}</div>
      )}
    </motion.div>
  );
}

function PrioritiesColumn({ inputRef }: { inputRef: React.RefObject<HTMLInputElement> }) {
  const { tasks, isThinking } = useAgent();
  const categories = ["NOW", "NEXT", "LATER"] as const;

  return (
    <div className="w-full xl:w-1/3 flex flex-col gap-6 xl:h-full shrink-0">
      <CaptureBar inputRef={inputRef} />
      <div className="xl:flex-1 xl:overflow-hidden flex flex-col gap-4">
        <div className="text-[11px] uppercase tracking-widest text-[#9AA7A9] font-bold">Priorities</div>
        <div className="space-y-3 xl:overflow-y-auto pr-2 pb-6 xl:pb-20">
          {isThinking && (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="glass-card p-4 space-y-3">
                  <div className="shimmer h-4 w-2/3" />
                  <div className="flex gap-2">
                    <div className="shimmer h-3 w-12" />
                    <div className="shimmer h-3 w-16" />
                  </div>
                  <div className="shimmer h-3 w-1/2" />
                </div>
              ))}
            </div>
          )}
          {categories.map(cat => {
            const catTasks = tasks.filter(t => t.category === cat && t.status !== "dropped" && !t.parentId);
            if (catTasks.length === 0) return null;
            
            return (
              <AnimatePresence key={cat}>
                {catTasks.map(t => (
                  <TaskCard key={t.id} task={t} allTasks={tasks} />
                ))}
              </AnimatePresence>
            );
          })}
          {tasks.length === 0 && !isThinking && (
            <div className="text-center p-8 border border-[#E6E3DC] rounded-2xl bg-black/[0.025]">
              <LayoutDashboard className="w-8 h-8 text-[#13343B]/20 mx-auto mb-3" />
              <p className="text-[#5B6B6E] text-sm">No priorities defined yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineColumn() {
  const { schedule } = useAgent();
  
  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17]; // 9 AM to 5 PM
  
  const parseTimeStr = (t: string) => {
    if (!t) return 0;
    const parts = t.split(':');
    let h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || "0", 10);
    if (isNaN(h)) return 0;
    if (h < 6) h += 12; // assume PM if very small number
    if (t.toLowerCase().includes('pm') && h < 12) h += 12;
    if (t.toLowerCase().includes('am') && h === 12) h -= 12;
    return h + (isNaN(m) ? 0 : m / 60);
  };

  const currentHour = new Date().getHours();
  const currentMinutes = new Date().getMinutes();
  const currentDecimal = currentHour + (currentMinutes / 60);

  return (
    <div className="w-full xl:flex-1 glass-card flex flex-col relative shrink-0 overflow-hidden min-h-[520px] xl:min-h-0">
      <div className="p-4 border-b border-[#E6E3DC] flex justify-between items-center bg-black/[0.025] shrink-0 z-10">
        <span className="text-[11px] uppercase tracking-widest text-[#5B6B6E] font-bold">Today's Plan</span>
        <span className="text-[10px] text-[#20808D] font-bold">
           {schedule.length} Block(s) Scheduled
        </span>
      </div>
      
      <div className="flex-1 relative overflow-y-auto w-full custom-scrollbar">
        <div className="h-[800px] w-full relative min-h-max shrink-0">
          {/* Hour Grid */}
          {hours.map((h, i) => (
             <div key={h} className="absolute w-full flex items-center" style={{ top: `${(h - 9) * 80 + 20}px` }}>
                <div className="w-16 text-right pr-4 text-[10px] text-[#9AA7A9] font-bold uppercase tracking-widest mt-[-1px]">
                  {h === 12 ? '12 PM' : h > 12 ? `${h-12} PM` : `${h} AM`}
                </div>
                <div className="flex-1 border-t border-[#E6E3DC]"></div>
             </div>
          ))}

          {/* Now Line */}
          {currentDecimal >= 9 && currentDecimal <= 17 && (
            <div 
              className="absolute left-16 right-4 flex items-center z-20 pointer-events-none"
              style={{ top: `${(currentDecimal - 9) * 80 + 20}px` }}
            >
              <div className="w-2 h-2 rounded-full bg-[#20808D] absolute -left-1 shadow-[0_0_8px_#20808D]" />
              <div className="h-[1px] w-full bg-[#20808D] opacity-80" />
            </div>
          )}

          {/* Blocks */}
          <div className="absolute top-0 left-16 right-4 bottom-0 pointer-events-none">
            <AnimatePresence>
              {schedule.map((block, i) => {
                const sTime = parseTimeStr(block.startTime);
                const eTime = parseTimeStr(block.endTime);
                
                const top = (sTime - 9) * 80 + 20;
                const height = Math.max(30, (eTime - sTime) * 80);
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    key={block.taskId + i} 
                    className="absolute left-0 right-0 p-3 rounded-xl ml-2 overflow-hidden pointer-events-auto"
                    style={{ top: `${top}px`, height: `${height}px` }}
                  >
                    <div className={clsx(
                      "absolute inset-0 rounded-xl border backdrop-blur-sm",
                      i === 0 ? "bg-[#20808D]/10 border-[#20808D]/30" : "bg-black/[0.03] border-[#E0DCD3]"
                    )} />
                    <div className="relative z-10">
                      <div className="text-sm font-semibold text-[#13343B]/90 truncate">{block.title}</div>
                      {height > 50 && (
                        <div className="text-[10px] flex items-center gap-1 uppercase tracking-widest text-[#20808D] mt-2 font-bold">
                           <Calendar className="w-3 h-3" />
                           Focus Block
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentActivityFeed() {
  const { activityFeed, isThinking } = useAgent();

  // Only resizable on wide (xl) layouts, where the feed is a side column.
  const [isWide, setIsWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches
  );
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem("clutch_activity_width"));
    return saved >= 240 && saved <= 640 ? saved : 300;
  });
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(width);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const onChange = () => setIsWide(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - e.clientX; // drag the handle left → wider panel
      setWidth(Math.min(640, Math.max(240, startW.current + delta)));
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

  return (
    <div className="w-full xl:flex-shrink-0 flex xl:gap-2" style={isWide ? { width } : undefined}>
      {/* Drag handle — grab to resize, double-click to reset */}
      {isWide && (
        <div
          onMouseDown={startDrag}
          onDoubleClick={() => setWidth(300)}
          title="Drag to resize • double-click to reset"
          className="group relative w-2 shrink-0 cursor-col-resize flex items-center justify-center"
        >
          <div className="w-px h-full bg-black/[0.06] group-hover:bg-[#20808D]/50 transition-colors" />
          <div className="absolute h-10 w-1 rounded-full bg-black/[0.08] group-hover:bg-[#20808D] transition-colors" />
        </div>
      )}

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 xl:h-full">
        <div className="text-[11px] uppercase tracking-widest text-[#9AA7A9] font-bold shrink-0">Agent Activity</div>

        <div className="xl:flex-1 text-[10px] space-y-4 overflow-y-auto overflow-x-hidden pr-2 pb-6 xl:pb-20 max-h-80 xl:max-h-none custom-scrollbar">
          <AnimatePresence>
            {isThinking && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex gap-3"
              >
                <div className="w-1 h-1 bg-[#20808D] rounded-full mt-1.5 shrink-0 animate-pulse" />
                <div className="min-w-0">
                  <div className="text-[#5B6B6E] mb-0.5">Analyzing...</div>
                  <div className="leading-relaxed opacity-70">Agent is thinking</div>
                </div>
              </motion.div>
            )}
            {activityFeed.map((action, i) => (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className={clsx("flex gap-3", i > 5 && "opacity-50")}
              >
                <div className={clsx("w-1 h-1 rounded-full mt-1.5 shrink-0", i === 0 ? "bg-[#20808D]" : "bg-[#C2CACB]")} />
                <div className="min-w-0">
                  <div className={clsx("mb-0.5 font-medium", i === 0 ? "text-[#5B6B6E]" : "text-[#9AA7A9]")}>
                    {format(action.timestamp, "h:mm a")}
                  </div>
                  <div className="leading-relaxed text-[#5B6B6E] break-words">{action.description}</div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="p-4 glass-bar bg-[#20808D]/5 border-[#20808D]/20 rounded-xl mt-auto shrink-0 mb-6">
          <div className="text-[#20808D] text-[11px] font-bold uppercase mb-1">Status</div>
          <div className="text-[11px] leading-snug text-[#5B6B6E]">{isThinking ? "Processing recent user input..." : "System stabilized. Awaiting input."}</div>
        </div>
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

      {/* New Task */}
      <div className={clsx("pb-5", collapsed ? "px-2" : "px-4")}>
        <button
          onClick={onNewTask}
          title="New Task"
          className="w-full bg-[#20808D] hover:bg-[#13565F] text-white rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(32,128,141,0.25)]">
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && "New Task"}
        </button>
      </div>

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
  const archivedTasks = tasks.filter(t => t.status === 'done' || t.status === 'dropped').sort((a, b) => b.createdAt - a.createdAt);

  return (
    <main className="flex-1 flex flex-col px-4 md:px-8 py-6 relative z-10 overflow-hidden">
      <div className="w-full max-w-4xl mx-auto flex flex-col h-full">
        <div className="flex-1 glass-card overflow-y-auto w-full custom-scrollbar p-6">
           {archivedTasks.length === 0 ? (
             <div className="text-center py-20 flex flex-col items-center justify-center h-full">
               <Archive className="w-12 h-12 text-[#13343B]/20 mb-4" />
               <p className="text-[#5B6B6E]">No archived tasks yet.</p>
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
                     <div className={clsx("text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded",
                       task.status === 'done' ? "bg-[#34D399]/20 text-[#34D399]" : "bg-[#FF4D4D]/20 text-[#FF4D4D]"
                     )}>
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

interface BubbleState { x: number; y: number; vx: number; vy: number; r: number; }

function FloatingBubbles({ tasks }: { tasks: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const elsRef = useRef<(HTMLDivElement | null)[]>([]);
  const stateRef = useRef<BubbleState[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const rafRef = useRef<number>(0);

  const items = tasks.slice(0, 14);
  const idsKey = items.map((t) => t.id + ":" + (t.estimated_minutes || 0)).join(",");

  const colorFor = (cat: string) => {
    if (cat === "NOW") return { c: "#20808D", tint: "#5FB8C2" };
    if (cat === "NEXT") return { c: "#2AA7B5", tint: "#8BD3DB" };
    return { c: "#93C3C7", tint: "#C6E4E6" };
  };
  const radiusFor = (min: number) => {
    const m = Math.max(15, Math.min(240, min || 30));
    return Math.round(34 + Math.sqrt(m) * 4.2);
  };

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont || items.length === 0) return;
    const W = cont.clientWidth || 480;
    const H = cont.clientHeight || 440;
    stateRef.current = items.map((t) => {
      const r = radiusFor(t.estimated_minutes);
      return {
        x: r + Math.random() * Math.max(1, W - 2 * r),
        y: r + Math.random() * Math.max(1, H - 2 * r),
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        r,
      };
    });

    const step = () => {
      const w = cont.clientWidth, h = cont.clientHeight;
      const cx = w / 2, cy = h / 2;
      const st = stateRef.current;
      const m = mouseRef.current;
      for (let i = 0; i < st.length; i++) {
        const b = st[i];
        b.vx += (Math.random() - 0.5) * 0.07;
        b.vy += (Math.random() - 0.5) * 0.07;
        b.vx += (cx - b.x) * 0.0002;
        b.vy += (cy - b.y) * 0.0002;
        if (m.active) {
          const dx = b.x - m.x, dy = b.y - m.y;
          const dist = Math.hypot(dx, dy);
          const influence = b.r + 90;
          if (dist < influence && dist > 0.01) {
            const force = (1 - dist / influence) * 1.8;
            b.vx += (dx / dist) * force;
            b.vy += (dy / dist) * force;
          }
        }
        b.vx *= 0.93; b.vy *= 0.93;
        const sp = Math.hypot(b.vx, b.vy), max = 2.6;
        if (sp > max) { b.vx = (b.vx / sp) * max; b.vy = (b.vy / sp) * max; }
        b.x += b.vx; b.y += b.vy;
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; }
        if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.6; }
        if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy) * 0.6; }
        const el = elsRef.current[i];
        if (el) el.style.transform = `translate(${b.x - b.r}px, ${b.y - b.r}px)`;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [idsKey]);

  const onMove = (e: React.MouseEvent) => {
    const cont = containerRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top, active: true };
  };
  const onLeave = () => { mouseRef.current.active = false; };

  if (items.length === 0) {
    return (
      <div className="h-[440px] flex items-center justify-center text-[#9AA7A9] text-sm border border-dashed border-[#E0DCD3] rounded-3xl">
        Plan some tasks and they'll float here.
      </div>
    );
  }

  return (
    <div ref={containerRef} onMouseMove={onMove} onMouseLeave={onLeave} className="relative h-[440px] w-full overflow-hidden select-none">
      {items.map((t, i) => {
        const { c, tint } = colorFor(t.category);
        const r = radiusFor(t.estimated_minutes);
        return (
          <div
            key={t.id}
            ref={(el) => { elsRef.current[i] = el; }}
            className="absolute top-0 left-0 rounded-full flex items-center justify-center text-center"
            style={{
              width: r * 2,
              height: r * 2,
              background: `radial-gradient(circle at 35% 30%, ${tint} 0%, ${c} 55%, transparent 74%)`,
              mixBlendMode: "multiply",
              willChange: "transform",
            }}
          >
            <span className="px-2 font-semibold leading-tight text-[#0E3B40]" style={{ fontSize: Math.max(10, Math.min(14, r / 5)) }}>
              {t.title}
            </span>
          </div>
        );
      })}
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
          <FloatingBubbles tasks={active} />
          <p className="text-[12px] text-[#9AA7A9] leading-relaxed mt-3 text-center max-w-md mx-auto">
            Each bubble is a task — size reflects estimated time, color its priority. Hover to nudge them around.
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
  const startH = Math.min(settings.workStart, settings.workEnd);
  const endH = Math.max(settings.workStart, settings.workEnd);
  const hours = Array.from({ length: Math.max(1, endH - startH) }, (_, i) => startH + i);
  const parse = (t: string) => {
    const [h, m] = (t || "").split(':').map(Number);
    return (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m / 60);
  };
  const hourLabel = (h: number) => (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);

  return (
    <main className="flex-1 overflow-auto custom-scrollbar px-4 md:px-8 py-6">
      <div className="min-w-[720px]">
        <div className="grid sticky top-0 z-10 bg-canvas-base pb-2" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
          <div />
          {days.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} className={clsx("text-center text-[11px] uppercase tracking-widest font-bold", isToday ? "text-[#20808D]" : "text-[#5B6B6E]")}>
                {format(d, "EEE")}
                <div className={clsx("text-lg font-display", isToday ? "text-[#13343B]" : "text-[#9AA7A9]")}>{format(d, "d")}</div>
              </div>
            );
          })}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `60px repeat(7, 1fr)` }}>
          {hours.map((h) => (
            <React.Fragment key={h}>
              <div className="text-right pr-3 text-[10px] text-[#9AA7A9] font-bold uppercase h-20 -mt-2">{hourLabel(h)}</div>
              {days.map((d, di) => {
                const isToday = d.toDateString() === today.toDateString();
                const blocks = isToday ? schedule.filter(b => { const s = parse(b.startTime); return s >= h && s < h + 1; }) : [];
                return (
                  <div key={di} className={clsx("border-t border-l border-[#ECE9E1] h-20 relative", isToday && "bg-[#20808D]/[0.03]")}>
                    {blocks.map((b, bi) => (
                      <div key={bi} className="absolute inset-x-1 top-1 bg-[#20808D]/15 border border-[#20808D]/40 rounded-md p-1.5 overflow-hidden">
                        <div className="text-[10px] text-[#13343B] truncate font-medium">{b.title}</div>
                        <div className="text-[9px] text-[#20808D]">{b.startTime}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div className="text-[11px] text-[#5B6B6E] mt-4">Clutch currently plans the current day — future days fill in as you plan them.</div>
      </div>
    </main>
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
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5B6B6E]">Start</label>
              <select value={settings.workStart} onChange={(e) => updateSettings({ workStart: Number(e.target.value) })}
                className="w-full mt-1 bg-black/[0.04] border border-[#E0DCD3] rounded-lg px-3 py-2 text-sm text-[#13343B] outline-none focus:border-[#20808D]/50">
                {hours.map(h => <option key={h} value={h} className="bg-[#FFFFFF]">{hourLabel(h)}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-widest text-[#5B6B6E]">End</label>
              <select value={settings.workEnd} onChange={(e) => updateSettings({ workEnd: Number(e.target.value) })}
                className="w-full mt-1 bg-black/[0.04] border border-[#E0DCD3] rounded-lg px-3 py-2 text-sm text-[#13343B] outline-none focus:border-[#20808D]/50">
                {hours.map(h => <option key={h} value={h} className="bg-[#FFFFFF]">{hourLabel(h)}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#13343B]">Voice input</div>
            <div className="text-[12px] text-[#5B6B6E]">Show the microphone for hands-free capture.</div>
          </div>
          <button onClick={() => updateSettings({ voiceEnabled: !settings.voiceEnabled })}
            className={clsx("w-12 h-6 rounded-full transition-colors relative shrink-0", settings.voiceEnabled ? "bg-[#20808D]" : "bg-black/[0.06]")}>
            <span className={clsx("absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all", settings.voiceEnabled ? "left-[26px]" : "left-0.5")} />
          </button>
        </div>

        <div className="glass-card p-6">
          <div className="text-sm font-semibold text-[#13343B] mb-1">Powered by Google Gemini</div>
          <div className="text-[12px] text-[#5B6B6E]">Clutch's planning agent runs on Google's Gemini models via Google AI Studio.</div>
        </div>

        <div className="glass-card p-6 border-[#FF4D4D]/20">
          <div className="text-sm font-semibold text-[#FF4D4D] mb-1">Danger zone</div>
          <div className="text-[12px] text-[#5B6B6E] mb-4">Permanently delete all tasks, schedule, and activity.</div>
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
  const inputRef = React.useRef<HTMLInputElement>(null);

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
          {activeView === 'today' && (
            <div className="flex-1 flex flex-col xl:flex-row gap-6 px-4 md:px-8 py-6 h-full overflow-y-auto xl:overflow-hidden custom-scrollbar">
              <PrioritiesColumn inputRef={inputRef} />
              <TimelineColumn />
              <AgentActivityFeed />
            </div>
          )}
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
    </div>
  );
}
