import { describe, expect, it } from "vitest";
import { simulateRagdoll } from "../ragdoll/index.ts";
import { META, run, sampleForRagdoll, SHORT } from "../../scenarios/median-crossing/scenario.ts";
import { buildShortProps, DISCLAIMER_DE } from "./props.ts";
import { ATTEMPT_LENGTH, attemptTime, buildTimeline, DURATIONS, FPS, PLAY_FROM } from "./timeline.ts";

describe("timeline", () => {
  it("iskeletin beş bölümü sırayla, boşluksuz", () => {
    const { sections, total } = buildTimeline(3);
    expect(sections.map((s) => s.id)).toEqual(["hook", "attempt-0", "attempt-1", "attempt-2", "scoreboard", "lesson", "closing"]);
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i]!.from).toBe(sections[i - 1]!.from + sections[i - 1]!.duration);
    }
    expect(total).toBe(sections.at(-1)!.from + sections.at(-1)!.duration);
  });

  it("hook 2 s; Short 60 s'yi aşmaz", () => {
    expect(DURATIONS.hook).toBe(2 * FPS);
    expect(buildTimeline(5).total).toBeLessThanOrEqual(60 * FPS);
  });

  it("deneme zamanı girişte donar, sonra gerçek zamanlı akar, sonda kırpılır", () => {
    expect(attemptTime(0, 10)).toBe(PLAY_FROM);
    expect(attemptTime(DURATIONS.attemptIntro + FPS, 10)).toBeCloseTo(PLAY_FROM + 1);
    expect(attemptTime(ATTEMPT_LENGTH, 2)).toBe(2);
  });
});

describe("buildShortProps", async () => {
  const results = run({ trials: 200, sensitivityTrials: 10 });
  const trajectories = new Map();
  for (const a of SHORT.attempts) {
    const { plan, motion } = sampleForRagdoll({ characterId: a.characterId, strategy: a.strategyId as never });
    trajectories.set(`${a.characterId}/${a.strategyId}`, { ...(await simulateRagdoll(motion)), modelOutcome: { contact: plan.outcome.contact } });
  }
  const props = buildShortProps(META, results, SHORT, trajectories);

  it("uyarı notu ve meta metinler Almanca ve dolu", () => {
    expect(props.disclaimerDe).toBe(DISCLAIMER_DE);
    expect(props.hookQuestionDe).toBe("Springen oder ausweichen?");
    expect(props.lessonDe).toContain("Augen hoch");
  });

  it("skor tablosu en kötüden en iyiye sıralı; yana kaçış en iyi", () => {
    const c = props.scoreboard.map((r) => r.contact);
    expect([...c].sort((a, b) => b - a)).toEqual(c);
    expect(props.scoreboard.at(-1)!.strategyDe).toBe("Zur Seite");
  });

  it("videoda gösterilmeyen strateji Short'a giremez", () => {
    expect(() => buildShortProps(META, results, { ...SHORT, scoreboardStrategies: ["zurueck"] }, trajectories)).toThrow(/videoda gösterilmez/);
  });

  it("deneme sonucu modelden gelir (ragdoll'dan değil)", () => {
    expect(props.attempts.map((a) => a.escaped)).toEqual(
      SHORT.attempts.map((a) => !sampleForRagdoll({ characterId: a.characterId, strategy: a.strategyId as never }).plan.outcome.contact),
    );
  });
});
