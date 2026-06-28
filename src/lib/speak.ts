import { PrioritizedTask, ReplanState, RescueState, ScheduledBlock } from "../types";

let clutchAudio: HTMLAudioElement | null = null;
let clutchAudioUrl: string | null = null;

export function stopSpeaking() {
  if (clutchAudio) {
    clutchAudio.pause();
    clutchAudio = null;
  }
  if (clutchAudioUrl) {
    URL.revokeObjectURL(clutchAudioUrl);
    clutchAudioUrl = null;
  }
  try { window.speechSynthesis?.cancel(); } catch {}
}

function fallbackSpeech(text: string) {
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis?.speak(utterance);
  } catch {}
}

// Clutch speaks: try Google Cloud TTS first, fall back to browser speech if autoplay blocks audio.
export async function speakText(text: string) {
  const safeText = text.trim();
  if (!safeText) return;

  stopSpeaking();

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: safeText }),
    });

    if (res.ok && (res.headers.get("content-type") || "").includes("audio")) {
      const url = URL.createObjectURL(await res.blob());
      const audio = new Audio(url);
      clutchAudio = audio;
      clutchAudioUrl = url;
      audio.onended = () => {
        if (clutchAudioUrl === url) URL.revokeObjectURL(url);
        if (clutchAudio === audio) {
          clutchAudio = null;
          clutchAudioUrl = null;
        }
      };
      audio.onerror = () => {
        if (clutchAudioUrl === url) URL.revokeObjectURL(url);
        if (clutchAudio === audio) {
          clutchAudio = null;
          clutchAudioUrl = null;
        }
        fallbackSpeech(safeText);
      };
      try {
        await audio.play();
        return;
      } catch {
        if (clutchAudioUrl === url) URL.revokeObjectURL(url);
        if (clutchAudio === audio) {
          clutchAudio = null;
          clutchAudioUrl = null;
        }
        fallbackSpeech(safeText);
        return;
      }
    }
  } catch {
    // Fall through to browser speech.
  }

  fallbackSpeech(safeText);
}

export function rescueSpeech(rescue: RescueState, titleOf: (id: string) => string): string {
  return [
    rescue.message,
    rescue.firstStep ? `First, ${rescue.firstStep}` : "",
    rescue.doNow.length ? `Do now: ${rescue.doNow.map((d) => titleOf(d.taskId)).join(", ")}.` : "",
    rescue.ifTime.length ? `If time allows: ${rescue.ifTime.map(titleOf).join(", ")}.` : "",
    rescue.dropForNow.length ? `Let go of for now: ${rescue.dropForNow.map(titleOf).join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}

export function replanSpeech(replan: ReplanState, titleOf?: (id: string) => string): string {
  if (!titleOf) return replan.message;
  return [
    replan.message,
    replan.keep?.length ? `Keep today: ${replan.keep.map(titleOf).join(", ")}.` : "",
    replan.move?.length ? `Move later: ${replan.move.map(titleOf).join(", ")}.` : "",
    replan.drop?.length ? `Drop for now: ${replan.drop.map(titleOf).join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}

function parseHM(hm?: string): number | null {
  if (!hm || !/^\d{2}:\d{2}$/.test(hm)) return null;
  const [h, m] = hm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h + m / 60;
}

function fmt12(hm?: string): string {
  const parsed = parseHM(hm);
  if (parsed == null) return hm || "";
  const normalized = ((parsed % 24) + 24) % 24;
  const h24 = Math.floor(normalized);
  const m = Math.round((normalized - h24) * 60);
  const ap = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

function sortedBlocks(schedule: ScheduledBlock[]): ScheduledBlock[] {
  return [...schedule].sort((a, b) => (parseHM(a.startTime) ?? 0) - (parseHM(b.startTime) ?? 0));
}

export function planSpeech(tasks: PrioritizedTask[], schedule: ScheduledBlock[] = []): string {
  const blocks = sortedBlocks(schedule);
  if (blocks.length) {
    const now = new Date();
    const nowDec = now.getHours() + now.getMinutes() / 60;
    const withRange = blocks.map((block) => {
      const start = parseHM(block.startTime) ?? 0;
      let end = parseHM(block.endTime) ?? start + 0.5;
      if (end <= start) end += 24;
      const comparableNow = end > 24 && nowDec < start ? nowDec + 24 : nowDec;
      return { block, start, end, comparableNow };
    });
    const current = withRange.find((item) => item.comparableNow >= item.start && item.comparableNow < item.end);
    const upcoming = withRange.find((item) => item.start > item.comparableNow) || withRange[0];
    const preview = (current ? [current, ...withRange.filter((item) => item.start > current.start)] : withRange).slice(0, 4);

    return [
      "Your today's plan is ready.",
      current
        ? `Right now, focus on ${current.block.title} until ${fmt12(current.block.endTime)}.`
        : upcoming
          ? `First up at ${fmt12(upcoming.block.startTime)}, ${upcoming.block.title}.`
          : "",
      preview.length
        ? `Your next blocks are ${preview.map((item) => `${fmt12(item.block.startTime)}, ${item.block.title}`).join("; ")}.`
        : "",
    ].filter(Boolean).join(" ");
  }

  const active = tasks.filter((task) => task.status === "idle");
  const now = active.filter((task) => task.category === "NOW" && !task.parentId);
  const next = active.filter((task) => task.category === "NEXT" && !task.parentId);
  const first = now[0] || active.find((task) => !task.parentId);
  const second = now[1] || next[0];

  if (!first) return "Your plan is ready.";
  return [
    "Your plan is ready.",
    `Right now, focus on ${first.title}.`,
    second && second.id !== first.id ? `Next, ${second.title}.` : "",
  ].filter(Boolean).join(" ");
}
