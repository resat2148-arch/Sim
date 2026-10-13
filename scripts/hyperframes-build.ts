/**
 * Deneme: short-props.json -> HyperFrames projesi (out/<id>/hyperframes/).
 * Kapsam: Hook + ilk deneme + skor tablosu. Önce: npm run short:props
 * Sonra: cd out/median-crossing/hyperframes && npx hyperframes render
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import type { ShortProps } from "../core/render/props.ts";
import { attemptHtml, ATTEMPT_S, disclaimerHtml, HOOK_S, hookHtml, indexHtml, SCOREBOARD_S, scoreboardHtml, worldHtml, type Clip } from "../core/render-hf/templates.ts";

const dir = join("out", "median-crossing");
const out = join(dir, "hyperframes");
const props = JSON.parse(readFileSync(join(dir, "short-props.json"), "utf8")) as ShortProps;
const attempt = props.attempts[0];
if (!attempt) throw new Error("short-props.json içinde deneme yok");

const worldEnd = HOOK_S + ATTEMPT_S;
const total = worldEnd + SCOREBOARD_S;
const clips: Clip[] = [
  { id: "world", start: 0, duration: worldEnd, track: 0, z: 0 },
  { id: "hook", start: 0, duration: HOOK_S, track: 1, z: 1 },
  { id: "attempt-0", start: HOOK_S, duration: ATTEMPT_S, track: 1, z: 1 },
  { id: "scoreboard", start: worldEnd, duration: SCOREBOARD_S, track: 0, z: 1 },
  { id: "disclaimer", start: 0, duration: total, track: 2, z: 2 },
];

for (const d of ["compositions", "assets", "vendor"]) mkdirSync(join(out, d), { recursive: true });
copyFileSync("node_modules/gsap/dist/gsap.min.js", join(out, "vendor", "gsap.min.js"));

// 3D sahne: three.js + ortak poz/zamanlama kodu tek dosyaya; veri en başta.
const bundle = await build({
  entryPoints: ["core/render-hf/world.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  write: false,
});
const worldData = { trajectory: attempt.trajectory, attemptStart: HOOK_S };
writeFileSync(join(out, "assets", "world.js"), `window.__SHORT_WORLD=${JSON.stringify(worldData)};\n${bundle.outputFiles[0]!.text}`);

const files: Record<string, string> = {
  "index.html": indexHtml(props, clips, total),
  "compositions/world.html": worldHtml(worldEnd),
  "compositions/hook.html": hookHtml(props),
  "compositions/attempt-0.html": attemptHtml("attempt-0", attempt),
  "compositions/scoreboard.html": scoreboardHtml(props),
  "compositions/disclaimer.html": disclaimerHtml(props.disclaimerDe, total),
  "meta.json": JSON.stringify({ id: "median-crossing-short", name: props.titleDe }, null, 2),
  "hyperframes.json": JSON.stringify({ paths: { blocks: "compositions", assets: "assets" } }, null, 2),
};
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`${out}: ${clips.length} bölüm, ${total.toFixed(1)} s`);
