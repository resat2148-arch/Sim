import { describe, expect, it } from "vitest";
import { mean, proportion, quantile, tally } from "./stats.ts";

describe("proportion (Wilson)", () => {
  it("bilinen değerle uyumlu: 50/100", () => {
    const p = proportion(50, 100);
    expect(p.p).toBe(0.5);
    expect(p.lo).toBeCloseTo(0.4038, 3);
    expect(p.hi).toBeCloseTo(0.5962, 3);
  });

  it("0 ve n uçlarında [0, 1] içinde kalır ve sıfır genişlikte değildir", () => {
    const zero = proportion(0, 10_000);
    expect(zero.lo).toBe(0);
    expect(zero.hi).toBeGreaterThan(0);
    const all = proportion(10_000, 10_000);
    expect(all.hi).toBeCloseTo(1, 12);
    expect(all.lo).toBeLessThan(1);
  });

  it("geçersiz girdiyi reddeder", () => {
    expect(() => proportion(5, 0)).toThrow(RangeError);
    expect(() => proportion(11, 10)).toThrow(RangeError);
  });
});

describe("tally", () => {
  it("kategorileri sayar, görülmeyenleri 0 ile listeler", () => {
    const t = tally(["hit", "miss", "hit", "hit"] as const, ["hit", "miss", "hood"]);
    expect(t.hit.count).toBe(3);
    expect(t.hit.p).toBe(0.75);
    expect(t.hood.count).toBe(0);
    expect(Object.keys(t)).toEqual(["hit", "miss", "hood"]);
  });
});

describe("mean / quantile", () => {
  it("doğru değerleri verir", () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0)).toBe(1);
    expect(quantile([1, 2, 3, 4, 5], 1)).toBe(5);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });

  it("boş diziyi reddeder", () => {
    expect(() => mean([])).toThrow(RangeError);
    expect(() => quantile([], 0.5)).toThrow(RangeError);
  });
});
