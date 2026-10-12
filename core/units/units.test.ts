import { describe, expect, it } from "vitest";
import { inchToM, kmhToMs, mphToMs, msToKmh, msToS } from "./index.ts";

describe("birimler", () => {
  it("km/h <-> m/s", () => {
    expect(kmhToMs(36)).toBeCloseTo(10);
    expect(msToKmh(kmhToMs(50))).toBeCloseTo(50);
  });

  it("mph -> m/s (Tefft 2013: ~12 mph fark)", () => {
    expect(mphToMs(12)).toBeCloseTo(5.364, 3);
  });

  it("inç -> m (IIHS 2023: 40 inç kaput)", () => {
    expect(inchToM(40)).toBeCloseTo(1.016, 3);
  });

  it("ms -> s", () => {
    expect(msToS(501)).toBeCloseTo(0.501);
  });

  it("CLAUDE.md örneği: 15 m'de fark edilen 50 km/h araç ≈ 1,1 sn", () => {
    expect(15 / kmhToMs(50)).toBeCloseTo(1.08, 2);
  });
});
