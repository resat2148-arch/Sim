/**
 * results.json -> telefonda okunacak rapor sayfaları (HTML). PNG'ye çevirme
 * scripts/report.ts'te. Senaryodan bağımsızdır; senaryo yalnızca hangi
 * taramanın nasıl çizileceğini ReportConfig ile söyler.
 */

import type { ScenarioMeta, ScenarioResults, ResultTable } from "../scenario/index.ts";
import { findCell } from "../scenario/index.ts";
import { barPanel, CATEGORICAL, esc, legend, lineChart, niceScale, pct, TOKENS } from "./charts.ts";

type Metric = "fatal" | "severe" | "contact";

export interface SweepConfig {
  /** Duyarlılık tablolarının id öneki, örn. "detection" (-> "detection:15"). */
  readonly prefix: string;
  /** x değerinin okunacağı parametre adı. */
  readonly param: string;
  readonly strategyId: string;
  readonly metric: Metric;
  readonly title: string;
  readonly subtitle: string;
  readonly xLabel: string;
  readonly xUnit: string;
  readonly marker?: { readonly x: number; readonly label: string };
}

export interface ReportConfig {
  /** Ana tabloların (results.tables) başlık altı açıklaması. */
  readonly describeTable: (table: ResultTable) => string;
  readonly sweeps: readonly SweepConfig[];
}

export interface ReportPage {
  readonly name: string;
  readonly html: string;
}

const WIDTH = 1080;
const PAD = 44;
const INNER = WIDTH - 2 * PAD;

function value(results: ScenarioResults, table: ResultTable, c: string, s: string, metric: Metric): number {
  const sum = findCell(table, c, s);
  return metric === "contact" ? sum.contact.p : sum[metric].p;
}

const BAR_NOTE = "Çubuk = ortalama; bıyık = model belirsizliği aralığı (örnekleme gürültüsü değil).";

function page(meta: ScenarioMeta, results: ScenarioResults, title: string, subtitle: string, body: string, note = ""): string {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${WIDTH}px; background: ${TOKENS.page}; font-family: Inter, 'DejaVu Sans', sans-serif; color: ${TOKENS.ink}; }
  .page { padding: ${PAD}px; }
  .kicker { font-size: 22px; color: ${TOKENS.inkSecondary}; letter-spacing: .02em; }
  h1 { font-size: 44px; line-height: 1.15; margin: 6px 0 10px; font-weight: 700; }
  .sub { font-size: 24px; color: ${TOKENS.inkSecondary}; line-height: 1.4; margin-bottom: 28px; }
  .card { background: ${TOKENS.surface}; border: 1px solid rgba(11,11,11,.10); border-radius: 16px; padding: 28px; margin-bottom: 22px; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px 26px; font-size: 22px; margin-bottom: 18px; }
  .legend i { display: inline-block; width: 22px; height: 6px; border-radius: 3px; margin-right: 10px; vertical-align: middle; }
  table { width: 100%; border-collapse: collapse; font-size: 20px; font-variant-numeric: tabular-nums; }
  th { text-align: right; font-weight: 600; color: ${TOKENS.inkSecondary}; padding: 8px 6px; border-bottom: 1px solid ${TOKENS.axis}; vertical-align: bottom; }
  th:first-child, td:first-child { text-align: left; }
  td { text-align: right; white-space: nowrap; padding: 10px 6px; border-bottom: 1px solid ${TOKENS.grid}; vertical-align: top; }
  td small { display: block; white-space: nowrap; color: ${TOKENS.muted}; font-size: 17px; }
  .muted { color: ${TOKENS.muted}; }
  h2 { font-size: 30px; margin-bottom: 14px; }
  ul { padding-left: 26px; font-size: 22px; line-height: 1.45; color: ${TOKENS.inkSecondary}; }
  li { margin-bottom: 8px; }
  .lesson { font-size: 30px; font-weight: 600; line-height: 1.35; }
  .foot { font-size: 19px; color: ${TOKENS.muted}; margin-top: 8px; line-height: 1.5; }
  </style></head><body><div class="page">
  <div class="kicker">${esc(meta.titleDe)} · Model tahmini</div>
  <h1>${esc(title)}</h1>
  <div class="sub">${esc(subtitle)}</div>
  ${body}
  <div class="foot">Modellschätzung – Quellen in der Beschreibung · N = ${results.trials.toLocaleString("de-DE")} deneme / hücre · seed „${esc(results.seed)}“${note ? `<br>${esc(note)}` : ""}</div>
  </div></body></html>`;
}

export function buildReport(meta: ScenarioMeta, results: ScenarioResults, config: ReportConfig): ReportPage[] {
  const colorOf = new Map(results.characters.map((c, i) => [c.id, CATEGORICAL[i % CATEGORICAL.length] as string]));
  const pages: ReportPage[] = [];

  // 1) Ana tablolar: karakter başına panel, tüm panellerde ortak ölçek.
  const maxHi = Math.max(...results.tables.flatMap((t) => t.cells.map((c) => c.summary.fatal.hi)));
  const { max } = niceScale(maxHi);
  results.tables.forEach((table, i) => {
    const panels = results.characters
      .map((c) => {
        const rows = results.strategies.map((s) => {
          const f = findCell(table, c.id, s.id).fatal;
          return { label: s.inVideo ? s.labelDe : `${s.labelDe} *`, value: f.p, lo: f.lo, hi: f.hi, muted: !s.inVideo };
        });
        return `<div class="card">${barPanel({ title: c.nameDe, color: colorOf.get(c.id)!, rows, max, width: INNER - 56 })}</div>`;
      })
      .join("");
    const note = results.strategies.some((s) => !s.inVideo)
      ? `<div class="foot">* Videoda gösterilmez.</div>`
      : "";
    pages.push({
      name: `${i + 1}-${table.id.replace(/[^a-z0-9]+/gi, "-")}`,
      html: page(meta, results, `Ölüm riski: ${table.labelDe}`, config.describeTable(table), panels + note, BAR_NOTE),
    });
  });

  // 2) Duyarlılık taramaları: karakter başına çizgi.
  config.sweeps.forEach((sw, i) => {
    const tables = results.sensitivity
      .filter((t) => t.id.startsWith(`${sw.prefix}:`))
      .sort((a, b) => Number(a.parameters[sw.param]) - Number(b.parameters[sw.param]));
    const series = results.characters.map((c) => ({
      name: c.nameDe,
      color: colorOf.get(c.id)!,
      points: tables.map((t) => ({ x: Number(t.parameters[sw.param]), y: value(results, t, c.id, sw.strategyId, sw.metric) })),
    }));
    // Seçici etiketleme: yalnızca en yüksek eğrinin ucu etiketlenir; gerisi lejantta.
    const top = series.reduce((a, b) => ((a.points.at(-1)?.y ?? 0) >= (b.points.at(-1)?.y ?? 0) ? a : b));
    const chart = lineChart({
      series: series.map((s) => ({ ...s, endLabel: s === top })),
      width: INNER - 56,
      height: 720,
      xLabel: sw.xLabel,
      xUnit: sw.xUnit,
      ...(sw.metric === "contact" && { yMax: 1 }),
      ...(sw.marker && { marker: sw.marker }),
    });
    const strategy = results.strategies.find((s) => s.id === sw.strategyId)?.labelDe ?? sw.strategyId;
    const rows = tables
      .map(
        (t) =>
          `<tr><td>${t.parameters[sw.param]} ${esc(sw.xUnit)}</td>${results.characters
            .map((c) => `<td>${pct(value(results, t, c.id, sw.strategyId, sw.metric))}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    const table = `<table><tr><th>${esc(sw.xLabel)}</th>${results.characters.map((c) => `<th>${esc(c.nameDe)}</th>`).join("")}</tr>${rows}</table>`;
    pages.push({
      name: `${results.tables.length + i + 1}-${sw.prefix}`,
      html: page(
        meta,
        results,
        sw.title,
        `${sw.subtitle} Hareket: „${strategy}“.`,
        `<div class="card">${legend(series)}${chart}</div><div class="card">${table}</div>`,
      ),
    });
  });

  // 3) Özet tablo + ders + varsayımlar.
  const summaryTables = results.tables
    .map((t) => {
      const head = results.strategies
        .map((s) => `<th class="${s.inVideo ? "" : "muted"}">${esc(s.labelDe)}${s.inVideo ? "" : " *"}</th>`)
        .join("");
      const rows = results.characters
        .map(
          (c) =>
            `<tr><td>${esc(c.nameDe)}</td>${results.strategies
              .map((s) => {
                const f = findCell(t, c.id, s.id).fatal;
                return `<td class="${s.inVideo ? "" : "muted"}">${pct(f.p)}<small>${pct(f.lo).replace(" %", "")}–${pct(f.hi)}</small></td>`;
              })
              .join("")}</tr>`,
        )
        .join("");
      return `<div class="card"><h2>${esc(t.labelDe)}</h2><table><tr><th></th>${head}</tr>${rows}</table></div>`;
    })
    .join("");
  const assumptions = `<div class="card"><h2>Varsayımlar</h2><ul>${results.assumptions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul></div>`;
  const lesson = `<div class="card"><h2>Ders (videonun sonu)</h2><div class="lesson">„${esc(meta.lessonDe)}“</div></div>`;
  pages.push({
    name: `${pages.length + 1}-ozet`,
    html: page(meta, results, "Özet tablo: ölüm riski", "Hücre: ortalama ve model belirsizliği aralığı. * Videoda gösterilmez.", summaryTables + lesson + assumptions),
  });

  return pages;
}
