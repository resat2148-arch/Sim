/**
 * short-props.json -> HyperFrames projesi (out/<id>/hyperframes/): tam Short.
 * Hook → Denemeler → Skor tablosu → Ders → Kapanış sorusu.
 * Önce: npm run short:props. Sonra: npm run hf:check && npm run hf:render
 */

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";
import type { ShortProps } from "../core/render/props.ts";
import {
  attemptHtml,
  ATTEMPT_S,
  CLOSING_S,
  closingHtml,
  disclaimerHtml,
  HOOK_S,
  hookHtml,
  indexHtml,
  LESSON_S,
  lessonHtml,
  SCOREBOARD_S,
  scoreboardHtml,
  worldHtml,
  type Clip,
} from "../core/render-hf/templates.ts";
import type { WorldData } from "../core/render-hf/world.ts";

const dir = join("out", "median-crossing");
const out = join(dir, "hyperframes");
const props = JSON.parse(readFileSync(join(dir, "short-props.json"), "utf8")) as ShortProps;
if (props.attempts.length === 0) throw new Error("short-props.json içinde deneme yok");

// Bölümler sırayla (Remotion'daki buildTimeline ile aynı sıra ve süreler).
const clips: Clip[] = [];
let at = 0;
const push = (id: string, duration: number, track = 1, z = 1) => {
  clips.push({ id, start: at, duration, track, z });
  at += duration;
};
push("hook", HOOK_S);
props.attempts.forEach((_, i) => push(`attempt-${i}`, ATTEMPT_S));
const worldEnd = at;
push("scoreboard", SCOREBOARD_S);
push("lesson", LESSON_S);
push("closing", CLOSING_S);
const total = at;
clips.unshift({ id: "world", start: 0, duration: worldEnd, track: 0, z: 0 });
clips.push({ id: "disclaimer", start: 0, duration: total, track: 2, z: 2 });

rmSync(join(out, "compositions"), { recursive: true, force: true });
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
const worldData: WorldData = { trajectories: props.attempts.map((a) => a.trajectory), hookEnd: HOOK_S, attemptDuration: ATTEMPT_S };
writeFileSync(join(out, "assets", "world.js"), `window.__SHORT_WORLD=${JSON.stringify(worldData)};\n${bundle.outputFiles[0]!.text}`);

const files: Record<string, string> = {
  "index.html": indexHtml(props, clips, total),
  "compositions/world.html": worldHtml(worldEnd),
  "compositions/hook.html": hookHtml(props),
  "compositions/scoreboard.html": scoreboardHtml(props),
  "compositions/lesson.html": lessonHtml(props),
  "compositions/closing.html": closingHtml(props),
  "compositions/disclaimer.html": disclaimerHtml(props.disclaimerDe, total),
  "meta.json": JSON.stringify({ id: "median-crossing-short", name: props.titleDe }, null, 2),
  "hyperframes.json": JSON.stringify({ paths: { blocks: "compositions", assets: "assets" } }, null, 2),
};
props.attempts.forEach((a, i) => (files[`compositions/attempt-${i}.html`] = attemptHtml(`attempt-${i}`, a)));
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);
console.log(`${out}: ${clips.length} bölüm, ${total.toFixed(1)} s`);
