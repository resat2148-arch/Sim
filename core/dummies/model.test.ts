import { describe, expect, it } from "vitest";
import { createRng } from "../random/index.ts";
import {
  BodyProfileError,
  meanJumpHeight,
  meanReactionTime,
  motorCapacity,
  runDistance,
  sampleMotor,
  timeToRun,
  type BodyProfile,
} from "./model.ts";

// chms2021 kalibrasyonu için kullanılan tipik vücutlar
const typicalMan = (age: number): BodyProfile => ({ age, sex: "male", heightM: 1.78, massKg: 84, bodyFat: 0.22 });
const typicalWoman = (age: number): BodyProfile => ({ age, sex: "female", heightM: 1.64, massKg: 70, bodyFat: 0.33 });

describe("tepki süresi (soni2013)", () => {
  it("genç ve yaşlı grup ortalamalarını tutturur", () => {
    expect(meanReactionTime(24)).toBeCloseTo(0.501, 3);
    expect(meanReactionTime(67.5)).toBeCloseTo(0.721, 3);
  });

  it("24 yaş altında sabit, sonra yaşla artar", () => {
    expect(meanReactionTime(18)).toBe(meanReactionTime(24));
    expect(meanReactionTime(50)).toBeGreaterThan(meanReactionTime(30));
  });
});

describe("sıçrama (chms2021 kalibrasyonu)", () => {
  const cases: [string, BodyProfile, number][] = [
    ["erkek 20–39", typicalMan(30), 0.46],
    ["kadın 20–39", typicalWoman(30), 0.32],
    ["erkek 40–59", typicalMan(50), 0.38],
    ["kadın 40–59", typicalWoman(50), 0.28],
    ["erkek 60–79", typicalMan(70), 0.29],
    ["kadın 60–79", typicalWoman(70), 0.21],
  ];
  it.each(cases)("%s ortalamasını ±3 cm içinde tutturur", (_label, body, expected) => {
    expect(Math.abs(meanJumpHeight(body) - expected)).toBeLessThan(0.03);
  });

  it("aynı kiloda daha fazla yağ, daha alçak sıçrama demektir", () => {
    const lean = { ...typicalMan(30), bodyFat: 0.15 };
    const fat = { ...typicalMan(30), bodyFat: 0.3 };
    expect(meanJumpHeight(lean)).toBeGreaterThan(meanJumpHeight(fat));
  });

  it("yalnızca yağ eklemek sıçramayı düşürür (belirleyici yağsız kütle)", () => {
    const base = typicalMan(30);
    const lean = base.massKg * (1 - base.bodyFat);
    const heavier = { ...base, massKg: base.massKg + 20, bodyFat: 1 - lean / (base.massKg + 20) };
    expect(meanJumpHeight(heavier)).toBeLessThan(meanJumpHeight(base));
  });

  it("kuvvet vücut ağırlığını aşamazsa sıçrama sıfırdır, negatif değil", () => {
    expect(meanJumpHeight({ age: 95, sex: "female", heightM: 1.5, massKg: 120, bodyFat: 0.6 })).toBe(0);
  });
});

describe("motorCapacity", () => {
  it("kalça yüksekliği boyun ~%53'ü", () => {
    expect(motorCapacity(typicalMan(30)).hipHeight).toBeCloseTo(0.943, 3);
  });

  it("yaşla koşu hızı düşer", () => {
    expect(motorCapacity(typicalMan(70)).sprint.vmax.mean).toBeLessThan(
      motorCapacity(typicalMan(30)).sprint.vmax.mean,
    );
  });

  it("reşit olmayan profili reddeder", () => {
    expect(() => motorCapacity({ ...typicalMan(30), age: 16 })).toThrow(BodyProfileError);
  });

  it("yağ oranını yüzde olarak girmeyi yakalar", () => {
    expect(() => motorCapacity({ ...typicalMan(30), bodyFat: 22 })).toThrow(/yağ oranı/);
  });
});

describe("sampleMotor", () => {
  const cap = motorCapacity(typicalWoman(40));

  it("aynı rng yolu aynı değerleri verir", () => {
    expect(sampleMotor(cap, createRng(1).fork("trial:5"))).toEqual(
      sampleMotor(cap, createRng(1).fork("trial:5")),
    );
  });

  it("örneklerin ortalaması kapasiteye yakındır", () => {
    const root = createRng("sample-mean");
    const samples = Array.from({ length: 20_000 }, (_, i) => sampleMotor(cap, root.fork(i)));
    const avg = (f: (s: (typeof samples)[number]) => number) =>
      samples.reduce((acc, s) => acc + f(s), 0) / samples.length;
    expect(avg((s) => s.reactionTime)).toBeCloseTo(cap.reactionTime.mean, 2);
    expect(avg((s) => s.jumpHeight)).toBeCloseTo(cap.jumpHeight.mean, 2);
    expect(Math.abs(avg((s) => s.vmax) - cap.sprint.vmax.mean)).toBeLessThan(0.02);
  });
});

describe("koşu kinematiği", () => {
  it("başlangıç ivmesi vmax/τ, uzun sürede hız vmax'a yaklaşır", () => {
    const dt = 1e-4;
    expect(runDistance(7.5, 1.2, dt) / (dt * dt / 2)).toBeCloseTo(7.5 / 1.2, 1);
    const late = (runDistance(7.5, 1.2, 20 + dt) - runDistance(7.5, 1.2, 20)) / dt;
    expect(late).toBeCloseTo(7.5, 3);
  });

  it("timeToRun, runDistance'ın tersidir", () => {
    for (const d of [0.3, 1, 2.5, 10]) {
      expect(runDistance(6, 1.2, timeToRun(6, 1.2, d))).toBeCloseTo(d, 6);
    }
    expect(timeToRun(6, 1.2, 0)).toBe(0);
    expect(runDistance(6, 1.2, -1)).toBe(0);
  });
});
