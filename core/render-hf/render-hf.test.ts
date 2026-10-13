import { describe, expect, it } from "vitest";
import { attemptTime, FPS, PLAY_FROM } from "../render/timeline.ts";
import { worldTime } from "./world.ts";
import { attemptHtml, closingHtml, disclaimerHtml, hookHtml, indexHtml, lessonHtml, scoreboardHtml } from "./templates.ts";
import { DISCLAIMER_DE, type ShortProps } from "../render/props.ts";

const tr = { duration: 3.6 } as never;
const tr2 = { duration: 4.1 } as never;
const data = { trajectories: [tr, tr2], hookEnd: 2, attemptDuration: 4.2 };

describe("HyperFrames zaman eşlemesi", () => {
  it("Hook: 0,5 s akar sonra donar (Remotion ile aynı)", () => {
    expect(worldTime(0, data)).toEqual({ index: 0, t: PLAY_FROM });
    expect(worldTime(0.3, data).t).toBeCloseTo(PLAY_FROM + 0.3);
    expect(worldTime(1.9, data).t).toBeCloseTo(PLAY_FROM + 0.5);
  });

  it("Denemeler: Remotion'ın attemptTime'ı ile kare kare aynı, doğru deneme seçilir", () => {
    for (let f = 0; f < 126; f++) {
      expect(worldTime(2 + f / FPS, data)).toEqual({ index: 0, t: attemptTime(f, 3.6) });
      expect(worldTime(2 + 4.2 + f / FPS, data)).toEqual({ index: 1, t: attemptTime(f, 4.1) });
    }
  });
});

describe("HyperFrames şablonları", () => {
  const props = {
    titleDe: "Titel <x>",
    hookQuestionDe: "Springen oder ausweichen?",
    disclaimerDe: DISCLAIMER_DE,
    trials: 10_000,
    scoreboard: [
      { strategyDe: "Springen", contact: 0.94, severe: { p: 0.17, lo: 0.08, hi: 0.3 } },
      { strategyDe: "Zur Seite", contact: 0.53, severe: { p: 0.11, lo: 0.06, hi: 0.18 } },
    ],
  } as unknown as ShortProps;

  it("her alt bileşim duraklatılmış bir zaman çizelgesi kaydeder", () => {
    for (const [id, html] of [
      ["hook", hookHtml(props)],
      ["scoreboard", scoreboardHtml(props)],
      ["disclaimer", disclaimerHtml(DISCLAIMER_DE, 13.2)],
      ["lesson", lessonHtml({ ...props, lessonDe: "Augen hoch" } as ShortProps)],
      ["closing", closingHtml({ ...props, closingQuestionDe: "Was würdest du tun?" } as ShortProps)],
      ["attempt-0", attemptHtml("attempt-0", { nameDe: "Kurt", color: "#2a78d6", moveDe: "Springen", escaped: false, trajectory: tr })],
    ] as const) {
      expect(html).toContain(`data-composition-id="${id}"`);
      expect(html).toContain("gsap.timeline({ paused: true })");
      expect(html).toContain(`window.__timelines["${id}"] = tl`);
    }
  });

  it("metin kaçışlanır; uyarı notu yer alır; skor değerleri modelden", () => {
    expect(hookHtml(props)).toContain("Titel &lt;x&gt;");
    expect(disclaimerHtml(DISCLAIMER_DE, 1)).toContain("Modellschätzung – Quellen in der Beschreibung");
    expect(scoreboardHtml(props)).toContain('data-target="94"');
    expect(indexHtml(props, [], 13.2)).toContain('data-duration="13.2"');
  });
});
