/**
 * Kullanım: npx tsx scripts/report.ts <senaryo-id>
 * Girdi: out/<id>/results.json (önce run-scenario çalıştırılmalı)
 * Çıktı: out/<id>/report/*.html ve *.png (1080 px genişlik, telefonda okunur)
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import type { ScenarioResults } from "../core/scenario/index.ts";
import { buildReport } from "../core/report/index.ts";
import { SCENARIOS } from "../scenarios/index.ts";

// Bulut ortamında önceden kurulu Chromium; başka yerde CHROMIUM_PATH ile değiştirilebilir.
const CHROMIUM = process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

const id = process.argv[2];
const scenario = id ? SCENARIOS[id] : undefined;
if (!scenario?.REPORT) {
  console.error(`Kullanım: report <id>. Rapor ayarı olan senaryolar: ${Object.entries(SCENARIOS).filter(([, s]) => s.REPORT).map(([k]) => k).join(", ")}`);
  process.exit(1);
}

const dir = join("out", scenario.META.id);
const results = JSON.parse(readFileSync(join(dir, "results.json"), "utf8")) as ScenarioResults;
const pages = buildReport(scenario.META, results, scenario.REPORT);

const outDir = join(dir, "report");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const tab = await browser.newPage({ viewport: { width: 1080, height: 1080 } });
  for (const p of pages) {
    const html = join(outDir, `${p.name}.html`);
    writeFileSync(html, p.html);
    await tab.setContent(p.html, { waitUntil: "load" });
    await tab.evaluate("document.fonts.ready");
    await tab.screenshot({ path: join(outDir, `${p.name}.png`), fullPage: true });
    console.log(`${outDir}/${p.name}.png`);
  }
} finally {
  await browser.close();
}
