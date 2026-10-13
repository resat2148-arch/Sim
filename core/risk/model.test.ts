import { describe, expect, it } from "vitest";
import { inchToM, kmhToMs, msToKmh, mphToMs } from "../units/index.ts";
import {
  ageEquivalentSpeedKmh,
  contactFactor,
  fatalRiskAtSpeed,
  frontFactor,
  impactRisk,
  severeRiskAtSpeed,
  type ImpactInput,
} from "./model.ts";

describe("ölüm riski (Rosén & Sander 2009)", () => {
  const p = (v: number) => fatalRiskAtSpeed(v).p;

  it("makalede bildirilen noktaları tutturur", () => {
    expect(p(75)).toBeGreaterThan(0.4);
    expect(p(75)).toBeLessThan(0.55);
    expect(p(52)).toBeCloseTo(0.1, 2);
  });

  it("50 km/h'de risk 40'takinin 2, 30'dakinin 5 katından fazla", () => {
    expect(p(50) / p(40)).toBeGreaterThan(2);
    expect(p(50) / p(30)).toBeGreaterThan(5);
  });

  it("75 km/h'deki aralık makaledeki %26–68 güven aralığına yakın", () => {
    const r = fatalRiskAtSpeed(75);
    expect(r.lo).toBeCloseTo(0.26, 1);
    expect(r.hi).toBeCloseTo(0.68, 1);
  });
});

describe("ağır yaralanma (Tefft 2013, GIDAS'a kaydırılmış)", () => {
  it("her hızda ölüm riskinden büyük ve hızla artar", () => {
    let prev = 0;
    for (let v = 10; v <= 100; v += 5) {
      const s = severeRiskAtSpeed(v).p;
      expect(s).toBeGreaterThan(fatalRiskAtSpeed(v).p);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });
});

describe("yaş (Tefft 2013)", () => {
  it("70 yaş @ v, 30 yaş @ v + 11,8 mph ile aynı riske sahip", () => {
    const shift = msToKmh(mphToMs(11.8));
    expect(ageEquivalentSpeedKmh(50, 70)).toBeCloseTo(ageEquivalentSpeedKmh(50 + shift, 30), 6);
  });

  it("eşdeğer hız negatif olmaz", () => {
    expect(ageEquivalentSpeedKmh(5, 18)).toBe(0);
  });
});

describe("araç önü (IIHS 2023)", () => {
  it("40 inç üstü kaput şekilden bağımsız ×1,45", () => {
    expect(frontFactor({ hoodEdgeHeight: inchToM(42), shape: "sloped" }, false)).toBe(1.45);
    expect(frontFactor({ hoodEdgeHeight: inchToM(42), shape: "blunt" }, false)).toBe(1.45);
  });

  it("30–40 inç: küt ×1,26, eğimli ×1", () => {
    expect(frontFactor({ hoodEdgeHeight: inchToM(35), shape: "blunt" }, false)).toBe(1.26);
    expect(frontFactor({ hoodEdgeHeight: inchToM(35), shape: "sloped" }, false)).toBe(1);
  });

  it("kaputa alınan yaya için ek risk yok", () => {
    expect(frontFactor({ hoodEdgeHeight: inchToM(42), shape: "blunt" }, true)).toBe(1);
  });
});

describe("impactRisk", () => {
  const sedan = { hoodEdgeHeight: 0.75, shape: "sloped" } as const;
  const suv = { hoodEdgeHeight: 1.05, shape: "blunt" } as const;
  const base: ImpactInput = { impactSpeed: kmhToMs(50), age: 45, front: sedan, hipAtImpact: 0.95, bodyInPath: 1 };

  it("referans yaş, sedan, tam önden: saf Rosén & Sander eğrisi", () => {
    const r = impactRisk(base);
    expect(r.wrapped).toBe(true);
    expect(r.fatal.p).toBeCloseTo(fatalRiskAtSpeed(50).p, 10);
    expect(r.fatal.lo).toBeLessThan(r.fatal.p);
    expect(r.fatal.hi).toBeGreaterThan(r.fatal.p);
  });

  it("yaşlı yaya için risk belirgin şekilde yüksek", () => {
    expect(impactRisk({ ...base, age: 72 }).fatal.p).toBeGreaterThan(2 * impactRisk({ ...base, age: 26 }).fatal.p);
  });

  it("SUV: kalça kenarın altındaysa ×1,45, kaputa çıkılırsa ek risk yok", () => {
    const under = impactRisk({ ...base, front: suv, hipAtImpact: 0.95 });
    const over = impactRisk({ ...base, front: suv, hipAtImpact: 1.1 });
    expect(under.wrapped).toBe(false);
    expect(under.fatal.p / over.fatal.p).toBeCloseTo(1.45, 6);
  });

  it("sıyırma riski düşürür ama sıfırlamaz", () => {
    const glancing = impactRisk({ ...base, bodyInPath: 0 });
    expect(glancing.fatal.p).toBeCloseTo(0.25 * impactRisk(base).fatal.p, 10);
    expect(contactFactor(0.5)).toBeCloseTo(0.625);
  });

  it("olasılıklar her durumda [0, 1] içinde ve ağır yaralanma ≥ ölüm", () => {
    for (const v of [0, 20, 50, 90, 150]) {
      for (const age of [18, 45, 95]) {
        const r = impactRisk({ ...base, impactSpeed: kmhToMs(v), age, front: suv, hipAtImpact: 0.8 });
        for (const e of [r.fatal, r.severe]) {
          expect(e.lo).toBeGreaterThanOrEqual(0);
          expect(e.hi).toBeLessThanOrEqual(1);
          expect(e.lo).toBeLessThanOrEqual(e.p);
          expect(e.p).toBeLessThanOrEqual(e.hi);
        }
        expect(r.severe.p).toBeGreaterThanOrEqual(r.fatal.p);
      }
    }
  });
});
