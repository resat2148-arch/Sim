import { describe, expect, it } from "vitest";
import { compareStrategies, DEFAULT_TRIALS, runTrials } from "./runner.ts";

describe("runTrials", () => {
  it("varsayılan olarak 10.000 deneme koşturur", () => {
    expect(runTrials(1, () => 0)).toHaveLength(DEFAULT_TRIALS);
  });

  it("aynı seed ile tekrarlanabilir", () => {
    const draw = (seed: number) => runTrials(seed, ({ rng }) => rng.next(), 50);
    expect(draw(9)).toEqual(draw(9));
    expect(draw(9)).not.toEqual(draw(10));
  });

  it("geçersiz n'i reddeder", () => {
    expect(() => runTrials(1, () => 0, 0)).toThrow(RangeError);
  });
});

describe("compareStrategies", () => {
  it("her strateji i. denemede aynı rastgele değerleri görür", () => {
    const out = compareStrategies(
      7,
      {
        a: ({ rng }) => rng.fork("reaction").next(),
        b: ({ rng }) => {
          rng.next(); // strateji kendi ek çekişini yapsa bile
          return rng.fork("reaction").next();
        },
      },
      100,
    );
    expect(out.a).toEqual(out.b);
  });
});
