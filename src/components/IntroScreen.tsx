import React, { useState, useRef } from "react";
import { useAgent } from "../AgentContext";
import {
  Mic, ArrowRight, Sparkles, Check, Zap, CalendarClock, Brain,
  ListChecks, Layers, Volume2, CalendarDays, Cloud, Database, ShieldCheck,
  ScanLine, RefreshCw, Bell, PenLine, Github, ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";

import { ClutchLogo } from "./ClutchLogo";
import { ParticleSphere } from "./ParticleSphere";

const GITHUB_URL = "https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver-";

export function IntroScreen() {
  const { dismissIntro, executeAgentAction, isThinking } = useAgent();
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [geo, setGeo] = useState<{ cx: number; cy: number; r: number } | null>(null);
  const pageGlowRef = useRef<HTMLDivElement>(null);

  const onPageMove = (e: React.MouseEvent) => {
    const el = pageGlowRef.current;
    if (el) {
      el.style.transform = `translate(${e.clientX - 110}px, ${e.clientY - 110}px)`;
      el.style.opacity = "1";
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isThinking) return;
    executeAgentAction(input);
    dismissIntro();
  };

  // Run a canned prompt straight into the app (used by demo + suggestion chips).
  const runPrompt = (text: string) => {
    if (isThinking) return;
    setInput(text);
    executeAgentAction(text);
    dismissIntro();
  };

  // ox/oy are offsets from the sphere center in units of the sphere radius R (so they scale
  // with the sphere). rx/ry are the pill's half-width/height in px, used to size its repel field.
  const audienceNodes: { label: string; ox: number; oy: number; rx: number; ry: number; main?: boolean }[] = [
    { label: "Built for", ox: 0, oy: 0, rx: 58, ry: 20, main: true },
    { label: "Students", ox: -0.25, oy: -0.27, rx: 56, ry: 20 },
    { label: "Founders", ox: 0.25, oy: -0.27, rx: 54, ry: 20 },
    { label: "Freelancers", ox: 0.34, oy: -0.02, rx: 62, ry: 20 },
    { label: "Makers", ox: -0.34, oy: -0.02, rx: 50, ry: 20 },
    { label: "Anyone with a deadline", ox: 0.0, oy: 0.34, rx: 96, ry: 20 },
  ];

  const planRows = [
    { t: "Reply to recruiter email", m: "9:00", now: true },
    { t: "DBMS assignment", m: "9:15", now: false },
    { t: "Interview prep", m: "12:15", now: false },
  ];

  // From-chaos-to-plan loop.
  const steps = [
    { icon: PenLine, title: "Brain-dump", body: "Dump every task, deadline, and commitment in plain words — or just speak it." },
    { icon: Sparkles, title: "Gemini extracts", body: "Gemini reads the mess and turns it into structured tasks with estimates and deadlines." },
    { icon: ListChecks, title: "Prioritize", body: "Clutch ranks everything into NOW / NEXT / LATER, with a one-line reason for each." },
    { icon: CalendarClock, title: "Time-block", body: "It builds a real schedule around your hours and energy peaks, protecting fixed slots." },
    { icon: Layers, title: "Break down", body: "Big, scary goals get split into ordered, doable steps automatically." },
    { icon: RefreshCw, title: "Re-plan", body: "Fall behind and Clutch reshuffles — telling you exactly what to keep, move, or drop." },
  ];

  // Six product features.
  const features = [
    { icon: Brain, title: "AI task extraction", body: "Turn a messy brain-dump — text, voice, or even a photo of a list — into clean, structured tasks." },
    { icon: ListChecks, title: "NOW / NEXT / LATER", body: "Every task ranked by urgency and importance, each with a one-line reason you can trust." },
    { icon: CalendarClock, title: "Time-blocked plan", body: "A real daily timeline that respects your working hours, energy peaks, and fixed commitments." },
    { icon: Layers, title: "Goal breakdown", body: "Split big, intimidating goals into ordered, doable steps in a single click." },
    { icon: Zap, title: "Clutch Mode rescue", body: "A panic button that runs an emergency triage and tells you the one thing to do right now." },
    { icon: Volume2, title: "Calendar + voice", body: "Push your blocks to Google Calendar and let Clutch read your rescue plan aloud." },
  ];

  // Google technologies powering Clutch.
  const googleTech = [
    { icon: Sparkles, name: "Gemini API", body: "The reasoning core — a multi-step function-calling loop." },
    { icon: ScanLine, name: "Gemini Vision", body: "Reads a photo of a handwritten or whiteboard list." },
    { icon: Cloud, name: "Cloud Run", body: "Hosts the live, public, full-stack application." },
    { icon: Database, name: "Firestore", body: "Secure cross-device sync of your tasks and plan." },
    { icon: CalendarDays, name: "Calendar API", body: "Pushes your time-blocks into your real calendar." },
    { icon: Volume2, name: "Cloud Text-to-Speech", body: "Reads your Clutch Mode rescue plan aloud." },
  ];

  const agentVerbs = ["Interprets intent", "Prioritizes tasks", "Schedules your day", "Breaks down goals", "Re-plans on change"];

  return (
    <div onMouseMove={onPageMove} className="relative z-10 min-h-screen w-full bg-[#F0EEE7] text-[#13343B] overflow-x-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="pointer-events-none absolute -top-40 right-0 w-[620px] h-[620px] rounded-full" style={{ background: "radial-gradient(circle, rgba(32,128,141,0.10), transparent 70%)" }} />
      <div
        ref={pageGlowRef}
        className="pointer-events-none fixed top-0 left-0 w-[220px] h-[220px] rounded-full z-[1]"
        style={{ background: "radial-gradient(circle, rgba(32,128,141,0.10), transparent 65%)", opacity: 0, transition: "opacity 0.3s" }}
      />

      {/* NAV */}
      <nav className="relative z-20 max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="text-[#13343B]"><ClutchLogo className="h-7" /></div>
        <div className="flex items-center gap-5">
          <a href="#how" className="hidden sm:block text-sm font-medium text-[#5B6B6E] hover:text-[#13343B] transition-colors">How it works</a>
          <a href="#tech" className="hidden sm:block text-sm font-medium text-[#5B6B6E] hover:text-[#13343B] transition-colors">Google tech</a>
          <button onClick={dismissIntro} className="bg-[#13343B] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[#20808D] transition-colors">
            Open app
          </button>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-8 md:pt-14 pb-16 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-8 items-center">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <div className="inline-flex items-center gap-2 bg-[#E8F2F1] text-[#13565F] text-[13px] font-medium px-3.5 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" /> Your AI deadline agent
          </div>
          <h1 className="font-display text-[2.75rem] leading-[1.04] md:text-6xl md:leading-[1.02] font-bold tracking-tight text-[#13343B]">
            Beat every<br /><span className="text-[#20808D]">deadline.</span>
          </h1>
          <p className="mt-6 text-lg text-[#5B6B6E] max-w-md leading-relaxed">
            Reminders tell you what you forgot. <span className="text-[#13343B] font-medium">Clutch tells you what to do next</span> — turning a messy brain-dump into a prioritized, time-blocked plan that re-plans itself when life gets in the way.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 max-w-lg">
            <div className="flex items-center gap-2 bg-white border border-[#E6E3DC] rounded-2xl p-2 pl-3 shadow-[0_6px_24px_rgba(19,52,59,0.06)] focus-within:border-[#20808D]/60 transition-colors">
              <button type="button" onClick={startRecording} className={`p-2 rounded-lg transition-colors shrink-0 ${isRecording ? "text-[#20808D]" : "text-[#9AA7A9] hover:text-[#13343B]"}`}>
                <Mic className="w-5 h-5" />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Brain-dump your day…"
                className="flex-1 bg-transparent outline-none text-[15px] text-[#13343B] placeholder:text-[#9AA7A9]"
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                className="bg-[#20808D] hover:bg-[#13565F] text-white text-sm font-medium px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-40 shrink-0"
              >
                {isThinking ? "Planning…" : (<>Start planning <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>
          </form>
          <button onClick={dismissIntro} className="mt-3 text-sm text-[#5B6B6E] hover:text-[#20808D] transition-colors inline-flex items-center gap-1">
            or just open the dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Powered-by strip (honest trust signal — replaces the fake rating) */}
          <div className="mt-9">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9AA7A9] mb-3">Powered by Google</div>
            <div className="flex flex-wrap items-center gap-2">
              {["Gemini", "Cloud Run", "Firestore", "Calendar", "Text-to-Speech"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5 bg-white border border-[#E6E3DC] rounded-full px-3 py-1.5 text-[12px] font-medium text-[#13565F]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#20808D]" /> {t}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        {/* HERO VISUAL */}
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative">
          <div className="bg-white border border-[#E6E3DC] rounded-3xl p-5 pb-10 shadow-[0_24px_60px_rgba(19,52,59,0.10)]">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-semibold text-[#13343B]">Today's plan</div>
              <div className="text-[11px] text-[#13565F] font-semibold bg-[#E8F2F1] px-2 py-1 rounded-full">3 blocks</div>
            </div>
            {planRows.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 mb-2 border ${r.now ? "bg-[#E8F2F1] border-[#20808D]/20" : "bg-[#FAFAF7] border-[#EFEBE3]"}`}>
                <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${r.now ? "bg-[#20808D] border-[#20808D]" : "border-[#C9D4D4]"}`}>
                  {r.now && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0"><div className="text-[13px] font-medium text-[#13343B] truncate">{r.t}</div></div>
                <div className="text-[11px] text-[#5B6B6E] shrink-0">{r.m}</div>
              </div>
            ))}
          </div>

          <div className="absolute -top-6 left-6 bg-white border border-[#E6E3DC] rounded-2xl px-4 py-2.5 shadow-[0_10px_30px_rgba(19,52,59,0.10)] hidden sm:flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#20808D]" /> <span className="text-[13px] text-[#13343B]">What's due today?</span>
          </div>
          <div className="absolute right-2 top-full -mt-10 bg-[#13343B] text-white rounded-2xl px-5 py-4 shadow-[0_14px_40px_rgba(19,52,59,0.25)]">
            <div className="text-[11px] text-[#9FE1CB] uppercase tracking-widest font-semibold">From chaos</div>
            <div className="text-2xl font-display font-bold">to a clear plan</div>
            <div className="text-[12px] text-white/70">in seconds</div>
          </div>
        </motion.div>
      </section>

      {/* 3D SPHERE with the "Built for" constellation overlaid */}
      <section id="sphere" className="relative z-0 -mt-24 md:-mt-56 scroll-mt-20">
        <div className="relative h-[560px] md:h-[860px]">
          <div className="absolute inset-0">
            <ParticleSphere nodes={audienceNodes.map((n) => ({ ox: n.ox, oy: n.oy, rx: n.rx, ry: n.ry }))} onGeo={setGeo} />
          </div>

          {/* Overlay positioned in the sphere's own pixel geometry so pills sit over it */}
          {geo && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute w-[360px] h-[360px] rounded-full" style={{ left: geo.cx, top: geo.cy, transform: "translate(-50%, -50%)", background: "radial-gradient(circle, rgba(32,128,141,0.12), transparent 65%)" }} />
              <svg className="absolute inset-0 h-full w-full">
                {audienceNodes.filter((n) => !n.main).map((n, i) => (
                  <line key={i} x1={geo.cx} y1={geo.cy} x2={geo.cx + n.ox * geo.r} y2={geo.cy + n.oy * geo.r} stroke="#20808D" strokeOpacity="0.28" strokeWidth="1" />
                ))}
              </svg>
              {audienceNodes.map((n, i) => (
                <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: geo.cx + n.ox * geo.r, top: geo.cy + n.oy * geo.r }}>
                  {n.main ? (
                    <span className="px-4 py-1.5 rounded-full bg-[#13343B] text-white text-[13px] font-semibold shadow-[0_6px_18px_rgba(19,52,59,0.25)]">{n.label}</span>
                  ) : (
                    <span className="flex items-center gap-2 bg-white border border-[#E6E3DC] rounded-full px-3.5 py-1.5 shadow-[0_6px_18px_rgba(19,52,59,0.08)] whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#20808D] shrink-0" />
                      <span className="text-[13px] font-medium text-[#13343B]">{n.label}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* PROBLEM — passive reminders vs. action-focused agent */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 -mt-16 md:-mt-32 pb-20">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="text-[#20808D] text-[13px] font-semibold uppercase tracking-widest mb-3">The problem</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#13343B] tracking-tight">Reminders are passive. Clutch takes action.</h2>
          <p className="mt-4 text-[#5B6B6E] leading-relaxed">Students and professionals miss deadlines not because they forget — but because nothing turns the chaos in their head into a concrete next move. Clutch does.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-5 max-w-4xl mx-auto">
          <div className="bg-white border border-[#E6E3DC] rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#F3F1EA] flex items-center justify-center"><Bell className="w-[18px] h-[18px] text-[#9AA7A9]" /></div>
              <div className="font-display text-lg font-bold text-[#7A8688]">A normal reminder</div>
            </div>
            <ul className="space-y-2.5">
              {["Tells you what you forgot", "Buzzes once — then you swipe it away", "Leaves you guessing what to do first"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-[#7A8688]">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#C9D4D4] shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative bg-white border border-[#20808D]/30 rounded-2xl p-6 shadow-[0_16px_40px_rgba(32,128,141,0.10)]">
            <div className="absolute inset-x-0 -top-px h-1 rounded-t-2xl bg-gradient-to-r from-[#20808D] to-[#2AA7B5]" />
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[#E8F2F1] flex items-center justify-center"><Zap className="w-[18px] h-[18px] text-[#20808D]" /></div>
              <div className="font-display text-lg font-bold text-[#13343B]">Clutch</div>
            </div>
            <ul className="space-y-2.5">
              {["Tells you exactly what to do next", "Builds the actual time-blocked plan", "Re-plans the moment you fall behind"].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[14px] text-[#13343B]">
                  <Check className="mt-0.5 w-4 h-4 text-[#20808D] shrink-0" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS — from chaos to plan */}
      <section id="how" className="relative z-10 max-w-6xl mx-auto px-6 pb-20 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[#20808D] text-[13px] font-semibold uppercase tracking-widest mb-3">How it works</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#13343B] tracking-tight">From chaos to a plan, in one loop</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="relative bg-white border border-[#E6E3DC] rounded-2xl p-6 hover:border-[#20808D]/40 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-11 h-11 rounded-xl bg-[#E8F2F1] flex items-center justify-center"><Icon className="w-5 h-5 text-[#20808D]" /></div>
                  <span className="font-display text-2xl font-bold text-[#E1E8E7]">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <div className="font-display text-lg font-bold text-[#13343B] mb-2">{s.title}</div>
                <p className="text-[#5B6B6E] text-[14px] leading-relaxed">{s.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* AGENTIC DEPTH band */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-[#13343B] px-7 py-10 md:px-12 md:py-14 shadow-[0_24px_60px_rgba(19,52,59,0.18)]">
          <div className="pointer-events-none absolute -top-20 -right-10 w-[420px] h-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(42,167,181,0.22), transparent 65%)" }} />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#9FE1CB] text-[12px] font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-5">
              <Brain className="w-3.5 h-3.5" /> Agentic depth
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-white tracking-tight leading-[1.1]">
              This isn't a to-do list. It's an <span className="text-[#2AA7B5]">agent.</span>
            </h2>
            <p className="mt-5 text-[15px] md:text-base text-white/75 leading-relaxed">
              Clutch runs a real multi-step Gemini function-calling loop — it interprets your intent, prioritizes tasks, schedules your day, breaks down goals, and re-plans when reality changes. Every step is an autonomous action it takes for you, not a prompt you have to write.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {agentVerbs.map((v) => (
                <span key={v} className="inline-flex items-center gap-2 bg-white/[0.07] border border-white/10 rounded-full px-3.5 py-1.5 text-[13px] font-medium text-white/90">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2AA7B5]" /> {v}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE GRID — six features */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 pb-20 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[#20808D] text-[13px] font-semibold uppercase tracking-widest mb-3">Everything Clutch does</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#13343B] tracking-tight">An agent that actually does the planning</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="bg-white border border-[#E6E3DC] rounded-2xl p-6 hover:border-[#20808D]/40 hover:shadow-[0_16px_40px_rgba(19,52,59,0.08)] transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#E8F2F1] flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-[#20808D]" /></div>
                <div className="font-display text-lg font-bold text-[#13343B] mb-2">{f.title}</div>
                <p className="text-[#5B6B6E] text-[14px] leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* GOOGLE TECHNOLOGIES */}
      <section id="tech" className="relative z-10 max-w-6xl mx-auto px-6 pb-20 scroll-mt-24">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[#20808D] text-[13px] font-semibold uppercase tracking-widest mb-3">Built with Google</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#13343B] tracking-tight">Google-first, end to end</h2>
          <p className="mt-4 text-[#5B6B6E] leading-relaxed">From reasoning to hosting to voice — Clutch is built on the Google stack, with Gemini at its core.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {googleTech.map((g, i) => {
            const Icon = g.icon;
            return (
              <div key={i} className="flex items-start gap-4 bg-white border border-[#E6E3DC] rounded-2xl p-5 hover:border-[#20808D]/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-[#E8F2F1] flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-[#20808D]" /></div>
                <div>
                  <div className="font-display text-[15px] font-bold text-[#13343B] mb-1">{g.name}</div>
                  <p className="text-[#5B6B6E] text-[13px] leading-relaxed">{g.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* DEMO PROMPT — what judges should try */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-2 gap-6 items-center">
          <div>
            <div className="text-[#20808D] text-[13px] font-semibold uppercase tracking-widest mb-3">Try this demo</div>
            <h2 className="font-display text-3xl md:text-4xl font-bold text-[#13343B] tracking-tight">See it in 10 seconds</h2>
            <p className="mt-4 text-[#5B6B6E] leading-relaxed max-w-md">
              Drop in one messy line and watch Clutch create the tasks, protect your gym time, schedule study blocks, and break the big goals into steps.
            </p>
            <div className="mt-6 space-y-2.5">
              {[
                "Creates structured tasks from one sentence",
                "Protects your gym block at 6–8 PM",
                "Schedules study blocks around it",
                "Can break “learn Git” into ordered steps",
              ].map((t) => (
                <div key={t} className="flex items-start gap-2.5 text-[14px] text-[#13343B]">
                  <Check className="mt-0.5 w-4 h-4 text-[#20808D] shrink-0" /> {t}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-[#E6E3DC] rounded-3xl p-6 shadow-[0_24px_60px_rgba(19,52,59,0.10)]">
            <div className="flex items-center gap-1.5 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F0C0B8]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#F2DDB0]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#BFE3D0]" />
              <span className="ml-2 text-[12px] text-[#9AA7A9]">brain-dump</span>
            </div>
            <div className="rounded-2xl bg-[#FAFAF7] border border-[#EFEBE3] p-4 text-[14px] text-[#13343B] leading-relaxed">
              “I need to learn Git, Linux, and go to gym from 6 PM to 8 PM.”
            </div>
            <button
              onClick={() => runPrompt("I need to learn Git, Linux, and go to gym from 6 PM to 8 PM.")}
              disabled={isThinking}
              className="mt-4 w-full bg-[#20808D] hover:bg-[#13565F] text-white text-sm font-semibold px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
            >
              {isThinking ? "Planning…" : (<>Run this demo <ArrowRight className="w-4 h-4" /></>)}
            </button>
            <div className="mt-4 flex flex-wrap gap-2">
              {["Prep for tomorrow's interview", "Plan my DBMS assignment"].map((tip) => (
                <button
                  key={tip}
                  type="button"
                  onClick={() => runPrompt(tip)}
                  className="px-3.5 py-1.5 rounded-full border border-[#E6E3DC] bg-white hover:border-[#20808D]/50 hover:text-[#13565F] text-[#5B6B6E] text-[13px] transition-colors"
                >
                  {tip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST / PRIVACY */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="flex items-start gap-4 max-w-4xl mx-auto bg-[#E8F2F1] border border-[#20808D]/15 rounded-2xl p-6">
          <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-[#20808D]" /></div>
          <div>
            <div className="font-display text-lg font-bold text-[#13343B] mb-1.5">Your plan, kept private</div>
            <p className="text-[#3E5258] text-[14px] leading-relaxed">
              Your tasks stay tied to your browser session and sync securely through Firestore. Calendar access is requested only when you choose to add your plan — never before.
            </p>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-16">
        <div className="text-center bg-white border border-[#E6E3DC] rounded-3xl px-6 py-14 shadow-[0_16px_40px_rgba(19,52,59,0.06)]">
          <h2 className="font-display text-3xl md:text-5xl font-bold text-[#13343B] tracking-tight">Stop dreading deadlines.</h2>
          <p className="mt-4 text-[#5B6B6E] max-w-md mx-auto">Brain-dump your day and let Clutch build the plan — then rescue you when it all goes sideways.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button onClick={dismissIntro} className="bg-[#20808D] hover:bg-[#13565F] text-white text-sm font-semibold px-6 py-3 rounded-xl inline-flex items-center gap-2 transition-colors">
              Start planning <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => runPrompt("My exam is in 2 days and I haven't started. Help.")} disabled={isThinking} className="bg-[#13343B] hover:bg-[#0F2A30] text-white text-sm font-semibold px-6 py-3 rounded-xl inline-flex items-center gap-2 transition-colors disabled:opacity-40">
              <Zap className="w-4 h-4" /> Try Clutch Mode
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#EDEAE2] py-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
            <div className="max-w-xs">
              <div className="text-[#13343B] mb-3"><ClutchLogo className="h-7" /></div>
              <p className="text-[13px] text-[#5B6B6E] leading-relaxed">The Last-Minute Life Saver — an autonomous AI agent that plans, prioritizes, and rescues your day.</p>
            </div>
            <div className="flex flex-wrap gap-12">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9AA7A9] mb-3">Product</div>
                <ul className="space-y-2 text-[13px]">
                  <li><a href="#how" className="text-[#5B6B6E] hover:text-[#20808D] transition-colors">How it works</a></li>
                  <li><a href="#features" className="text-[#5B6B6E] hover:text-[#20808D] transition-colors">Features</a></li>
                  <li><a href="#tech" className="text-[#5B6B6E] hover:text-[#20808D] transition-colors">Google tech</a></li>
                </ul>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-widest text-[#9AA7A9] mb-3">Project</div>
                <ul className="space-y-2 text-[13px]">
                  <li><span className="text-[#5B6B6E]">Built for Vibe2Ship 2026</span></li>
                  <li><span className="text-[#5B6B6E]">Powered by Google Gemini &amp; Cloud</span></li>
                  <li>
                    <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[#5B6B6E] hover:text-[#20808D] transition-colors">
                      <Github className="w-3.5 h-3.5" /> GitHub repo
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-[#EDEAE2] flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px]">
            <div className="text-[#9AA7A9]">© 2026 Clutch — finishes what you start.</div>
            <button onClick={dismissIntro} className="inline-flex items-center gap-1 text-[#20808D] font-medium hover:text-[#13565F] transition-colors">
              Open app <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
