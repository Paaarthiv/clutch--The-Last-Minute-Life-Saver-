import { PrioritizedTask, ReplanState, RescueState } from "../types";

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

export function planSpeech(tasks: PrioritizedTask[]): string {
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
