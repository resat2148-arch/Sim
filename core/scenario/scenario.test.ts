import { describe, expect, it } from "vitest";
import { formatSourcesDe, validateScenarioMeta, type ScenarioMeta } from "./index.ts";

const valid: ScenarioMeta = {
  id: "median-crossing",
  titleDe: "Auto über dem Mittelstreifen",
  hookQuestionDe: "Springen oder ausweichen?",
  lessonDe: "Platzhalter",
  sources: [
    {
      citation: "Rosén & Sander 2009",
      title: "Pedestrian fatality risk as a function of car impact speed",
      usedFor: "Risiko in Abhängigkeit der Aufprallgeschwindigkeit",
    },
  ],
};

describe("validateScenarioMeta", () => {
  it("geçerli meta veriyi kabul eder", () => {
    expect(() => validateScenarioMeta(valid)).not.toThrow();
  });

  it("kaynaksız senaryoyu reddeder", () => {
    expect(() => validateScenarioMeta({ ...valid, sources: [] })).toThrow(/en az bir kaynak/);
  });

  it("tüm sorunları birlikte listeler", () => {
    const bad = { ...valid, id: "Median Crossing", hookQuestionDe: " " };
    expect(() => validateScenarioMeta(bad)).toThrow(/kebab-case[\s\S]*hookQuestionDe boş/);
  });
});

describe("formatSourcesDe", () => {
  it("Almanca kaynak listesi üretir", () => {
    expect(formatSourcesDe(valid.sources)).toBe(
      "Quellen:\n• Rosén & Sander 2009: Pedestrian fatality risk as a function of car impact speed",
    );
  });
});
