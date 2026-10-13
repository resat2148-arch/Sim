import { describe, expect, it } from "vitest";
import { createRng } from "../random/index.ts";
import { kmhToMs } from "../units/index.ts";
import { getCharacter, motorCapacity } from "../dummies/index.ts";
import {
  approachTiming,
  bodyHalfWidth,
  bodyInPath,
  hipRiseAtImpact,
  JUMP_PREP_TIME,
  lateralContact,
  lateralDisplacement,
  lateralEscape,
  movementBudget,
} from "./escape.ts";

describe("approachTiming", () => {
  it("CLAUDE.md örneği: 15 m, 50 km/h -> 1,08 s; 0,5 s tepkiden sonra ~0,6 s", () => {
    const t = approachTiming({ speed: kmhToMs(50), detectionDistance: 15 });
    expect(t.impact).toBe(true);
    if (!t.impact) return;
    expect(t.timeToImpact).toBeCloseTo(1.08, 2);
    expect(t.impactSpeed).toBeCloseTo(kmhToMs(50));
    expect(movementBudget(t.timeToImpact, 0.501)).toBeCloseTo(0.579, 2);
  });

  it("frenleme çarpma hızını düşürür", () => {
    const t = approachTiming({ speed: kmhToMs(50), detectionDistance: 15, deceleration: 5 });
    expect(t.impact).toBe(true);
    if (!t.impact) return;
    // v² = 13,89² − 2·5·15 -> ~6,5 m/s ≈ 24 km/h
    expect(t.impactSpeed).toBeCloseTo(6.55, 1);
    expect(t.timeToImpact).toBeGreaterThan(15 / kmhToMs(50));
  });

  it("araç yayaya ulaşmadan durabilir", () => {
    // 50 km/h, 7 m/s² -> durma mesafesi ~13,8 m < 15 m
    const t = approachTiming({ speed: kmhToMs(50), detectionDistance: 15, deceleration: 7 });
    expect(t.impact).toBe(false);
  });

  it("tepki çarpmadan sonraysa hareket süresi 0", () => {
    expect(movementBudget(0.4, 0.7)).toBe(0);
  });

  it("geçersiz girdiyi reddeder", () => {
    expect(() => approachTiming({ speed: 0, detectionDistance: 10 })).toThrow(RangeError);
  });
});

describe("yana kaçış", () => {
  const kurt = motorCapacity(getCharacter("kurt").body);
  const motor = { vmax: kurt.sprint.vmax.mean, tau: kurt.sprint.tau };

  it("genç bir dummy 715 ms'de ~1,2 m yana gider (Soni et al. 2013 kontrolü)", () => {
    expect(lateralDisplacement(motor, 0.715)).toBeGreaterThan(1.0);
    expect(lateralDisplacement(motor, 0.715)).toBeLessThan(1.4);
  });

  it("örtüşme: tam önden, sıyırma, ıskalama", () => {
    const half = bodyHalfWidth(1.8); // ~0,23 m
    expect(lateralContact(0, 1.8, half).overlap).toBeCloseTo(0.9 + half);
    expect(lateralContact(1.0, 1.8, half).contact).toBe(true); // sıyırma
    expect(lateralContact(-1.2, 1.8, half).contact).toBe(false);
  });

  it("bodyInPath: tam içeride 1, sıyırmada kesirli, dışarıda 0", () => {
    const half = 0.25;
    expect(bodyInPath(lateralContact(0, 1.8, half), half)).toBe(1);
    expect(bodyInPath(lateralContact(0.9, 1.8, half), half)).toBeCloseTo(0.5);
    expect(bodyInPath(lateralContact(2, 1.8, half), half)).toBe(0);
  });

  it("doğru yön kaçırır, yanlış yön araca doğru götürür", () => {
    const base = { offset: 0.6, movementTime: 0.6, motor, vehicleWidth: 1.8, halfBody: bodyHalfWidth(1.82) };
    const away = lateralEscape({ ...base, direction: 1 });
    const toward = lateralEscape({ ...base, direction: -1 });
    expect(away.contact).toBe(false);
    expect(toward.contact).toBe(true);
    expect(toward.overlap).toBeGreaterThan(lateralContact(0.6, 1.8, base.halfBody).overlap - 0.9);
  });
});

describe("kaputa sıçrama", () => {
  const rng = createRng("jump");

  it("bol zamanda ve hatasız zamanlamada zirve tam çarpma anına denk gelir", () => {
    expect(hipRiseAtImpact({ movementTime: 2, jumpHeight: 0.5, rng, timingSd: 0 })).toBeCloseTo(0.5, 6);
  });

  it("hazırlık süresi yetmezse yükselme yok", () => {
    expect(hipRiseAtImpact({ movementTime: JUMP_PREP_TIME - 0.01, jumpHeight: 0.6, rng })).toBe(0);
  });

  it("dar zamanda kişi henüz yükselirken yakalanır", () => {
    const rise = hipRiseAtImpact({ movementTime: 0.58, jumpHeight: 0.59, rng, timingSd: 0 });
    expect(rise).toBeGreaterThan(0.2);
    expect(rise).toBeLessThan(0.59);
  });

  it("zamanlama hatası ortalamada yükselmeyi düşürür, asla zirveyi aşmaz", () => {
    const root = createRng("timing");
    const rises = Array.from({ length: 5000 }, (_, i) =>
      hipRiseAtImpact({ movementTime: 2, jumpHeight: 0.4, rng: root.fork(i) }),
    );
    expect(Math.max(...rises)).toBeLessThanOrEqual(0.4 + 1e-9);
    expect(rises.reduce((a, b) => a + b, 0) / rises.length).toBeLessThan(0.4);
    expect(Math.min(...rises)).toBe(0); // bazıları erken inip yakalanır
  });

  it("sıçrayamayan kişi yükselmez", () => {
    expect(hipRiseAtImpact({ movementTime: 2, jumpHeight: 0, rng })).toBe(0);
  });
});
