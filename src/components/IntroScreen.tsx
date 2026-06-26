import React, { useState, useRef } from "react";
import { useAgent } from "../AgentContext";
import { Mic, ArrowRight, Sparkles, Star, Check, Zap, CalendarClock, Brain } from "lucide-react";
import { motion } from "motion/react";

import { ClutchLogo } from "./ClutchLogo";
import { ParticleSphere } from "./ParticleSphere";

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

  const features = [
    { icon: Brain, title: "Plans autonomously", body: "Brain-dump everything on your plate. Clutch parses it into tasks, prioritizes, and time-blocks your day in seconds." },
    { icon: CalendarClock, title: "Defends your deadlines", body: "It schedules around what's due first, so the urgent stuff never quietly slips past you again." },
    { icon: Sparkles, title: "Re-plans on the fly", body: "Falling behind? Clutch reshuffles your day and tells you exactly what to keep, move, or drop." },
  ];

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

  return (
    <div onMouseMove={onPageMove} className="relative z-10 min-h-screen w-full bg-[#F0EEE7] text-[#13343B] overflow-x-hidden" style={{ fontFamily: "Inter, sans-serif" }}>
      <div className="pointer-events-none absolute -top-40 right-0 w-[620px] h-[620px] rounded-full" style={{ background: "radial-gradient(circle, rgba(32,128,141,0.10), transparent 70%)" }} />
      <div
        ref={pageGlowRef}
        className="pointer-events-none fixed top-0 left-0 w-[220px] h-[220px] rounded-full z-[1]"
        style={{ background: "radial-gradient(circle, rgba(32,128,141,0.10), transparent 65%)", opacity: 0, transition: "opacity 0.3s" }}
      />

      {/* NAV */}
      <nav className="relative max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="text-[#13343B]"><ClutchLogo className="h-7" /></div>
        <button onClick={dismissIntro} className="bg-[#13343B] text-white text-sm font-medium px-5 py-2.5 rounded-full hover:bg-[#20808D] transition-colors">
          Open app
        </button>
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
            Clutch turns a messy brain-dump into a prioritized, time-blocked plan — and quietly re-plans itself when life gets in the way.
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
                {isThinking ? "Planning…" : (<>Plan my day <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>
          </form>
          <button onClick={dismissIntro} className="mt-3 text-sm text-[#5B6B6E] hover:text-[#20808D] transition-colors inline-flex items-center gap-1">
            or just open the dashboard <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <div className="mt-9 flex items-center gap-4">
            <div className="flex -space-x-2">
              {["#20808D", "#2AA7B5", "#13565F", "#7FB7BD"].map((c, i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-[#F0EEE7]" style={{ background: c }} />
              ))}
            </div>
            <div className="text-sm">
              <div className="flex items-center gap-1 text-[#13343B] font-medium"><Star className="w-3.5 h-3.5 fill-[#20808D] text-[#20808D]" /> 4.9 / 5</div>
              <div className="text-[#5B6B6E] text-[13px]">loved by deadline-beaters</div>
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
            <div className="text-[11px] text-[#9FE1CB] uppercase tracking-widest font-semibold">Up to</div>
            <div className="text-2xl font-display font-bold">60% more</div>
            <div className="text-[12px] text-white/70">done each week</div>
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

      {/* FEATURES */}
      <section id="features" className="relative z-10 max-w-6xl mx-auto px-6 pt-10 pb-20 -mt-16 md:-mt-32">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-[#20808D] text-[13px] font-semibold uppercase tracking-widest mb-3">How it works</div>
          <h2 className="font-display text-3xl md:text-4xl font-bold text-[#13343B] tracking-tight">An agent that actually does the planning</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <div key={i} className="bg-white border border-[#E6E3DC] rounded-2xl p-6 hover:border-[#20808D]/40 transition-colors">
                <div className="w-11 h-11 rounded-xl bg-[#E8F2F1] flex items-center justify-center mb-4"><Icon className="w-5 h-5 text-[#20808D]" /></div>
                <div className="font-display text-lg font-bold text-[#13343B] mb-2">{f.title}</div>
                <p className="text-[#5B6B6E] text-[14px] leading-relaxed">{f.body}</p>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-12">
          {["Plan my DBMS assignment", "Prep for tomorrow's interview", "Schedule a workout"].map((tip) => (
            <button
              key={tip}
              type="button"
              onClick={() => { setInput(tip); executeAgentAction(tip); dismissIntro(); }}
              className="px-4 py-2 rounded-full border border-[#E6E3DC] bg-white hover:border-[#20808D]/50 hover:text-[#13565F] text-[#5B6B6E] text-sm transition-colors"
            >
              {tip}
            </button>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#EDEAE2] py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-[13px] text-[#9AA7A9]">
          <div className="text-[#5B6B6E]">Clutch — finishes what you start.</div>
          <button onClick={dismissIntro} className="text-[#20808D] font-medium hover:text-[#13565F]">Open app →</button>
        </div>
      </footer>
    </div>
  );
}
