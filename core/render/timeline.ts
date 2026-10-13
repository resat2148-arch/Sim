/**
 * Short iskeleti (kullanıcı onayladı): Hook → Denemeler → Skor tablosu →
 * Ders → Kapanış sorusu. 1080×1920, 30 fps. Saf fonksiyon; test edilir.
 */

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const FPS = 30;

export const DURATIONS = {
  hook: 2 * FPS, // 0–2 s: tehlike anı, görüntü donar, soru ekranda
  attemptIntro: 12, // ad + hareket etiketi
  attemptPlay: 96, // trajektori oynatma (~3,2 s)
  attemptOutcome: 18, // "Geschafft!" / "Erwischt!"
  scoreboard: 7 * FPS,
  lesson: 4 * FPS,
  closing: 3 * FPS,
} as const;

export const ATTEMPT_LENGTH = DURATIONS.attemptIntro + DURATIONS.attemptPlay + DURATIONS.attemptOutcome;

/** Trajektorinin oynatılmaya başladığı an (s): araç görünürken, dummy henüz tepki vermemişken. */
export const PLAY_FROM = 0.45;

export interface Section {
  readonly id: "hook" | `attempt-${number}` | "scoreboard" | "lesson" | "closing";
  readonly from: number;
  readonly duration: number;
}

export function buildTimeline(attemptCount: number): { sections: Section[]; total: number } {
  const sections: Section[] = [];
  let at = 0;
  const push = (id: Section["id"], duration: number) => {
    sections.push({ id, from: at, duration });
    at += duration;
  };
  push("hook", DURATIONS.hook);
  for (let i = 0; i < attemptCount; i++) push(`attempt-${i}`, ATTEMPT_LENGTH);
  push("scoreboard", DURATIONS.scoreboard);
  push("lesson", DURATIONS.lesson);
  push("closing", DURATIONS.closing);
  return { sections, total: at };
}

/** Deneme sahnesindeki kareden trajektori zamanına (s). Giriş ve sonuç karelerinde donar. */
export function attemptTime(frame: number, trajectoryDuration: number): number {
  const play = Math.min(Math.max(frame - DURATIONS.attemptIntro, 0), DURATIONS.attemptPlay);
  return Math.min(PLAY_FROM + play / FPS, trajectoryDuration);
}
