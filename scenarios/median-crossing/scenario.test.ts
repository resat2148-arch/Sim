import { describe, expect, it } from "vitest";
import { findCell, validateScenarioMeta } from "../../core/scenario/index.ts";
import { behaviorMix, META, run } from "./scenario.ts";

const results = run({ trials: 400, sensitivityTrials: 200 });
const sedan = results.tables.find((t) => t.id === "vehicle:limousine")!;
const suv = results.tables.find((t) => t.id === "vehicle:suv")!;
const fatal = (table = sedan, c: string, s: string) => findCell(table, c, s).fatal.p;
const ids = results.characters.map((c) => c.id);

describe("median-crossing", () => {
  it("meta veri geçerli ve kaynakları var", () => {
    expect(() => validateScenarioMeta(META)).not.toThrow();
    expect(META.sources.length).toBeGreaterThanOrEqual(5);
  });

  it("davranış karışımı her yaşta toplamı 1, Soni et al. 2013 uçlarını tutar", () => {
    for (const age of [18, 24, 45, 67.5, 90]) {
      const m = behaviorMix(age);
      expect(m.ausweichen + m.stehen + m.zurueck).toBeCloseTo(1, 10);
    }
    expect(behaviorMix(24).ausweichen).toBeCloseTo(0.6);
    expect(behaviorMix(67.5).stehen).toBeCloseTo(0.38);
  });

  it("deterministik: aynı seed aynı sonuç", () => {
    expect(run({ trials: 50, sensitivityTrials: 10 })).toEqual(run({ trials: 50, sensitivityTrials: 10 }));
  });

  it("sedanda zıplamak, kıpırdamamakla birebir aynı (kalça zaten kaput üstünde)", () => {
    for (const c of ids) expect(fatal(sedan, c, "springen")).toBe(fatal(sedan, c, "stehen"));
  });

  it("SUV'de zıplamak biraz yardımcı ama yana kaçışın gerisinde", () => {
    for (const c of ["kurt", "jonas"]) {
      expect(fatal(suv, c, "springen")).toBeLessThan(fatal(suv, c, "stehen"));
      expect(fatal(suv, c, "ausweichen")).toBeLessThan(fatal(suv, c, "springen"));
    }
  });

  it("yana kaçış herkes için kıpırdamamaktan iyi; gerçek davranış arada", () => {
    for (const c of ids) {
      expect(fatal(sedan, c, "ausweichen")).toBeLessThan(fatal(sedan, c, "stehen"));
      expect(fatal(sedan, c, "realitaet")).toBeLessThan(fatal(sedan, c, "stehen"));
    }
  });

  it("en yüksek risk Gerda'da", () => {
    for (const c of ids.filter((c) => c !== "gerda")) {
      expect(fatal(sedan, "gerda", "stehen")).toBeGreaterThan(fatal(sedan, c, "stehen"));
    }
  });

  it("zaman bütçesi: erken fark etmek yana kaçışı neredeyse kesin kurtuluşa çevirir", () => {
    const at = (d: number) => results.sensitivity.find((t) => t.id === `detection:${d}`)!;
    expect(findCell(at(8), "kurt", "ausweichen").contact.p).toBeGreaterThan(0.8);
    expect(findCell(at(25), "kurt", "ausweichen").contact.p).toBeLessThan(0.05);
  });

  it("tüm olasılıklar geçerli aralıkta", () => {
    for (const t of [...results.tables, ...results.sensitivity]) {
      for (const { summary: s } of t.cells) {
        for (const e of [s.fatal, s.severe]) {
          expect(e.lo).toBeLessThanOrEqual(e.p);
          expect(e.p).toBeLessThanOrEqual(e.hi);
          expect(e.hi).toBeLessThanOrEqual(1);
        }
        expect(s.severe.p).toBeGreaterThanOrEqual(s.fatal.p);
      }
    }
  });
});

describe("ragdoll örneği", () => {
  it("seçilen tipik deneme çoğunluk sonucunu paylaşır ve plan Monte Carlo ile aynı", async () => {
    const { planTrial, sampleForRagdoll, simulateTrial, BASE_CONDITIONS } = await import("./scenario.ts");
    const { trialRng } = await import("../../core/montecarlo/index.ts");
    const { getCharacter } = await import("../../core/dummies/index.ts");
    const kurtTable = findCell(sedan, "kurt", "ausweichen");
    const { trial, plan } = sampleForRagdoll({ characterId: "kurt", strategy: "ausweichen" });
    expect(plan.outcome.contact).toBe(kurtTable.contact.p >= 0.5);
    const ctx = { index: trial, rng: trialRng("median-crossing", trial) };
    const ctx2 = { index: trial, rng: trialRng("median-crossing", trial) };
    expect(planTrial(ctx, getCharacter("kurt"), "ausweichen", BASE_CONDITIONS).outcome).toEqual(
      simulateTrial(ctx2, getCharacter("kurt"), "ausweichen", BASE_CONDITIONS),
    );
  });
});
