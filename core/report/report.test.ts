import { describe, expect, it } from "vitest";
import { META, REPORT, run } from "../../scenarios/median-crossing/scenario.ts";
import { niceScale, pct } from "./charts.ts";
import { buildReport } from "./index.ts";

describe("niceScale", () => {
  it("yuvarlak adımlar ve en fazla 5 aralık", () => {
    expect(niceScale(0.478)).toEqual({ max: 0.5, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5] });
    expect(niceScale(1).max).toBe(1);
    expect(niceScale(0.032).ticks).toHaveLength(5);
    expect(niceScale(0).max).toBeGreaterThan(0);
  });
});

describe("pct", () => {
  it("virgüllü ondalık, çok küçük değerler için <0,1 %", () => {
    expect(pct(0.031)).toBe("3,1 %");
    expect(pct(0.0004)).toBe("<0,1 %");
    expect(pct(0)).toBe("0,0 %");
  });
});

describe("buildReport", () => {
  const results = run({ trials: 50, sensitivityTrials: 20 });
  const pages = buildReport(META, results, REPORT);

  it("her ana tablo, her tarama ve özet için bir sayfa", () => {
    expect(pages).toHaveLength(results.tables.length + REPORT.sweeps.length + 1);
  });

  it("her sayfada 'Modellschätzung' notu var (CLAUDE.md güvenlik kuralı)", () => {
    for (const p of pages) expect(p.html).toContain("Modellschätzung – Quellen in der Beschreibung");
  });

  it("videoda gösterilmeyen strateji işaretli", () => {
    expect(pages[0]!.html).toContain("Zurückweichen *");
  });
});
