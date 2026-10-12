import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "./index.ts";

function sample<T>(n: number, draw: () => T): T[] {
  return Array.from({ length: n }, draw);
}

function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

describe("createRng", () => {
  it("aynı seed aynı diziyi üretir", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect(sample(100, () => a.next())).toEqual(sample(100, () => b.next()));
  });

  it("farklı seed farklı dizi üretir", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(sample(10, () => a.next())).not.toEqual(sample(10, () => b.next()));
  });

  it("sayı ve string seed eşdeğerdir", () => {
    expect(createRng(7).next()).toBe(createRng("7").next());
  });

  it("next() [0, 1) aralığında kalır", () => {
    const rng = createRng("range");
    for (const x of sample(50_000, () => rng.next())) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("bilinen bir seed için çıktı sabit kalır (regresyon)", () => {
    // Bu değerler değişirse tüm eski Monte Carlo sonuçları değişir.
    const rng = createRng(42);
    const snapshot = sample(3, () => rng.next()).map((x) => x.toFixed(12));
    expect(snapshot).toMatchInlineSnapshot(`
      [
        "0.525846905308",
        "0.186688187066",
        "0.405023321742",
      ]
    `);
  });
});

describe("fork", () => {
  it("ebeveynin tüketiminden bağımsızdır", () => {
    const fresh = createRng(42).fork("trial:17");
    const used = createRng(42);
    sample(1000, () => used.next());
    const forked = used.fork("trial:17");
    expect(sample(20, () => forked.next())).toEqual(sample(20, () => fresh.next()));
  });

  it("farklı etiketler farklı akışlar verir", () => {
    const root = createRng(42);
    expect(root.fork("a").next()).not.toBe(root.fork("b").next());
  });

  it("yol iç içe forklarda birikir", () => {
    expect(createRng(42).fork("trial:3").fork("reaction").path).toBe("42/trial:3/reaction");
  });
});

describe("dağılımlar", () => {
  const N = 50_000;
  let rng: Rng;

  it("uniform ortalaması aralığın ortasıdır", () => {
    rng = createRng("uniform");
    const xs = sample(N, () => rng.uniform(2, 6));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(2);
    expect(Math.max(...xs)).toBeLessThan(6);
    expect(mean(xs)).toBeCloseTo(4, 1);
  });

  it("int sınırları dahil eder ve tüm değerleri üretir", () => {
    rng = createRng("int");
    const seen = new Set(sample(5000, () => rng.int(1, 6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("bernoulli oranı p'ye yakındır", () => {
    rng = createRng("bernoulli");
    const hits = sample(N, () => (rng.bernoulli(0.3) ? 1 : 0));
    expect(mean(hits)).toBeCloseTo(0.3, 2);
    expect(createRng(1).bernoulli(0)).toBe(false);
    expect(createRng(1).bernoulli(1)).toBe(true);
  });

  it("normal ortalama ve std sapmayı tutturur", () => {
    rng = createRng("normal");
    const xs = sample(N, () => rng.normal(501, 120));
    expect(Math.abs(mean(xs) - 501)).toBeLessThan(3);
    expect(Math.abs(sd(xs) - 120)).toBeLessThan(3);
  });

  it("truncatedNormal sınırların dışına çıkmaz", () => {
    rng = createRng("trunc");
    const xs = sample(N, () => rng.truncatedNormal(0.5, 0.3, 0.2, 1.5));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1.5);
  });

  it("truncatedNormal imkânsız aralıkta sessizce kırpmak yerine hata verir", () => {
    expect(() => createRng(1).truncatedNormal(0, 1, 50, 51)).toThrow(RangeError);
  });

  it("lognormal kendi ortalama ve std sapmasını tutturur, hep pozitiftir", () => {
    rng = createRng("lognormal");
    const xs = sample(N, () => rng.lognormal(0.72, 0.18));
    expect(Math.min(...xs)).toBeGreaterThan(0);
    expect(Math.abs(mean(xs) - 0.72)).toBeLessThan(0.005);
    expect(Math.abs(sd(xs) - 0.18)).toBeLessThan(0.005);
  });

  it("pick tüm elemanları seçebilir", () => {
    rng = createRng("pick");
    const seen = new Set(sample(1000, () => rng.pick(["springen", "ausweichen", "stehen"])));
    expect(seen.size).toBe(3);
  });

  it("geçersiz parametrelerde hata verir", () => {
    const r = createRng(1);
    expect(() => r.uniform(5, 1)).toThrow(RangeError);
    expect(() => r.int(1.5, 3)).toThrow(RangeError);
    expect(() => r.bernoulli(1.2)).toThrow(RangeError);
    expect(() => r.normal(0, -1)).toThrow(RangeError);
    expect(() => r.lognormal(0, 1)).toThrow(RangeError);
    expect(() => r.pick([])).toThrow(RangeError);
  });
});
