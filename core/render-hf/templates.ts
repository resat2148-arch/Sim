/**
 * HyperFrames bileşimi: ShortProps -> HTML dosyaları. Remotion'daki
 * scenes.tsx / ui.tsx'in karşılığı. Her bölüm bir alt bileşim (<template>),
 * her biri kendi duraklatılmış GSAP zaman çizelgesiyle (yerel zamanda).
 *
 * Spring'ler GSAP ease'lerine çevrildi (back.out / power3.out); birebir aynı
 * eğri değil, görsel olarak eşdeğer.
 */

import type { Attempt, ScoreRow, ShortProps } from "../render/props.ts";
import { ATTEMPT_LENGTH, DURATIONS, FPS, HEIGHT, WIDTH } from "../render/timeline.ts";

const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const INK = "#0b0b0b";
const PAPER = "#fcfcfb";
const GOOD = "#0ca30c";
const CRITICAL = "#d03b3b";

export const HOOK_S = DURATIONS.hook / FPS;
export const ATTEMPT_S = ATTEMPT_LENGTH / FPS;
export const SCOREBOARD_S = DURATIONS.scoreboard / FPS;
export const LESSON_S = DURATIONS.lesson / FPS;
export const CLOSING_S = DURATIONS.closing / FPS;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Bir alt bileşim dosyası: <template> + kök + stil + içerik + zaman çizelgesi. */
function subComposition(id: string, duration: number, css: string, body: string, timeline: string): string {
  return `<template id="${id}-template">
  <div data-composition-id="${id}" data-width="${WIDTH}" data-height="${HEIGHT}" data-duration="${r3(duration)}">
    <style>
${css}
    </style>
${body}
    <script>
      (function () {
        const root = document.querySelector('[data-composition-id="${id}"]');
        const q = (sel) => root.querySelector(sel);
        const tl = gsap.timeline({ paused: true });
${timeline}
        window.__timelines = window.__timelines || {};
        window.__timelines["${id}"] = tl;
      })();
    </script>
  </div>
</template>
`;
}

export function worldHtml(duration: number): string {
  return subComposition(
    "world",
    duration,
    `      #world-canvas { position: absolute; inset: 0; width: ${WIDTH}px; height: ${HEIGHT}px; display: block; }`,
    `    <canvas id="world-canvas" width="${WIDTH}" height="${HEIGHT}" data-layout-allow-overflow></canvas>
    <script src="assets/world.js"></script>`,
    // Hook: 0,5 s'den sonra görüntü donar ve soluklaşır; deneme başında normale döner.
    `        tl.set(q("#world-canvas"), { filter: "none" }, 0);
        tl.set(q("#world-canvas"), { filter: "saturate(0.35) contrast(1.05)" }, 0.5);
        tl.set(q("#world-canvas"), { filter: "none" }, ${r3(HOOK_S)});`,
  );
}

export function hookHtml(p: ShortProps): string {
  return subComposition(
    "hook",
    HOOK_S,
    `      .hook { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding-top: 260px; font-family: ${FONT}; }
      .hook .title { font-size: 44px; color: ${INK}; background: ${PAPER}; padding: 10px 24px; border-radius: 14px; font-weight: 600; }
      .hook .question { margin-top: 40px; font-weight: 900; font-size: 112px; line-height: 1.05; color: ${PAPER}; text-align: center;
        text-shadow: 0 6px 0 #0b0b0b; background: rgba(11,11,11,0.62); border-radius: 40px; padding: 30px 56px; margin-left: 50px; margin-right: 50px;
        opacity: 0; transform: scale(0.6); }`,
    `    <div class="hook">
      <div class="title">${esc(p.titleDe)}</div>
      <div class="question">${esc(p.hookQuestionDe)}</div>
    </div>`,
    `        tl.to(q(".question"), { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, 0.5);`,
  );
}

export function attemptHtml(id: string, a: Attempt): string {
  const outcomeAt = (DURATIONS.attemptIntro + DURATIONS.attemptPlay - 20) / FPS;
  return subComposition(
    id,
    ATTEMPT_S,
    `      .chip-wrap { position: absolute; inset: 0; display: flex; justify-content: center; align-items: flex-start; padding-top: 200px; font-family: ${FONT}; }
      .chip { display: flex; align-items: center; gap: 28px; padding: 28px 40px; background: rgba(252,252,251,0.94); color: ${INK};
        border-radius: 36px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); transform: translateY(-200px); }
      .chip .dot { width: 44px; height: 44px; border-radius: 22px; background: ${a.color}; border: 6px solid ${INK}; }
      .chip .name { font-size: 66px; font-weight: 800; line-height: 1; }
      .chip .move { font-size: 44px; font-weight: 500; margin-top: 8px; color: #52514e; }
      .stamp-wrap { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; font-family: ${FONT}; }
      .stamp { font-weight: 900; font-size: 120px; color: ${PAPER}; background: ${a.escaped ? GOOD : CRITICAL}; padding: 18px 54px;
        border-radius: 28px; border: 10px solid ${PAPER}; transform: rotate(-7deg) scale(2.2); opacity: 0; }`,
    `    <div class="chip-wrap">
      <div class="chip"><div class="dot"></div><div><div class="name">${esc(a.nameDe)}</div><div class="move">${esc(a.moveDe)}</div></div></div>
    </div>
    <div class="stamp-wrap"><div class="stamp">${a.escaped ? "✓ Geschafft!" : "✗ Erwischt!"}</div></div>`,
    `        tl.to(q(".chip"), { y: 0, duration: 0.5, ease: "back.out(1.4)" }, 0);
        tl.to(q(".stamp"), { scale: 1, rotation: -7, opacity: 1, duration: 0.35, ease: "back.out(2.5)" }, ${r3(outcomeAt)});`,
  );
}

export function scoreboardHtml(p: ShortProps): string {
  const best = p.scoreboard.length - 1;
  const row = (r: ScoreRow, i: number) => `      <div class="row">
        <div class="head"><span>${i === best ? "★ " : ""}${esc(r.strategyDe)}</span><span class="val" data-target="${r3(r.contact * 100)}">0 %</span></div>
        <div class="track"><div class="bar${i === best ? " best" : ""}" data-target="${r3(r.contact * 100)}"></div></div>
        <div class="sub">Schwer verletzt: ${pct(r.severe.p)} (Spanne ${Math.round(r.severe.lo * 100)}–${pct(r.severe.hi)})</div>
      </div>`;
  return subComposition(
    "scoreboard",
    SCOREBOARD_S,
    `      .board { position: absolute; inset: 0; background: #e9edf1; display: flex; align-items: center; padding: 64px; font-family: ${FONT}; color: ${INK}; }
      .card { width: 100%; background: rgba(252,252,251,0.94); border-radius: 36px; padding: 56px 56px 20px; box-shadow: 0 12px 40px rgba(0,0,0,0.18); }
      .kicker { font-size: 46px; color: #52514e; font-weight: 600; }
      .headline { font-size: 74px; font-weight: 900; margin: 8px 0 56px; line-height: 1.05; }
      .row { margin-bottom: 54px; }
      .head { display: flex; justify-content: space-between; align-items: baseline; font-size: 54px; font-weight: 700; }
      .val { font-variant-numeric: tabular-nums; }
      .track { height: 46px; background: #e1e0d9; border-radius: 12px; margin-top: 14px; overflow: hidden; }
      .bar { width: 0%; height: 100%; background: #2a78d6; border-radius: 0 12px 12px 0; }
      .bar.best { background: ${GOOD}; }
      .sub { font-size: 34px; color: #52514e; margin-top: 12px; opacity: 0; }`,
    `    <div class="board"><div class="card">
      <div class="kicker">${p.trials.toLocaleString("de-DE")} Simulationen pro Dummy</div>
      <div class="headline">Vom Auto erfasst</div>
${p.scoreboard.map(row).join("\n")}
    </div></div>`,
    `        root.querySelectorAll(".row").forEach((row, i) => {
          const at = 0.667 + i * 0.467;
          const bar = row.querySelector(".bar");
          const val = row.querySelector(".val");
          const target = Number(bar.dataset.target);
          const counter = { v: 0 };
          tl.to(bar, { width: target + "%", duration: 0.8, ease: "power3.out" }, at);
          tl.to(counter, { v: target, duration: 0.8, ease: "power3.out",
            onUpdate: () => { val.textContent = Math.round(counter.v) + " %"; } }, at);
          tl.to(row.querySelector(".sub"), { opacity: 1, duration: 0.5 }, at + 0.3);
        });`,
  );
}

/** 4) Ders: ciddi ton, tek cümle. */
export function lessonHtml(p: ShortProps): string {
  return subComposition(
    "lesson",
    LESSON_S,
    `      .lesson { position: absolute; inset: 0; background: #14181d; display: flex; align-items: center; padding: 90px; font-family: ${FONT}; color: ${PAPER}; }
      .lesson .inner { opacity: 0; }
      .lesson .kicker { font-size: 48px; font-weight: 600; color: #c3c2b7; margin-bottom: 36px; }
      .lesson .text { font-size: 88px; font-weight: 800; line-height: 1.15; }`,
    `    <div class="lesson"><div class="inner">
      <div class="kicker">Was wirklich hilft</div>
      <div class="text">${esc(p.lessonDe)}</div>
    </div></div>`,
    `        tl.to(q(".inner"), { opacity: 1, duration: 0.4, ease: "none" }, 0);`,
  );
}

/** 5) Kapanış sorusu: yorum tetikleyici. */
export function closingHtml(p: ShortProps): string {
  return subComposition(
    "closing",
    CLOSING_S,
    `      .closing { position: absolute; inset: 0; background: #f4c400; display: flex; justify-content: center; align-items: center; padding: 80px; font-family: ${FONT}; }
      .closing .inner { text-align: center; color: ${INK}; transform: scale(0.7); }
      .closing .q { font-size: 124px; font-weight: 900; line-height: 1.05; }
      .closing .cta { font-size: 52px; font-weight: 600; margin-top: 40px; }`,
    `    <div class="closing"><div class="inner">
      <div class="q">${esc(p.closingQuestionDe)}</div>
      <div class="cta">Schreib's in die Kommentare 👇</div>
    </div></div>`,
    `        tl.to(q(".inner"), { scale: 1, duration: 0.5, ease: "back.out(2)" }, 0);`,
  );
}

export function disclaimerHtml(text: string, duration: number): string {
  return subComposition(
    "disclaimer",
    duration,
    `      .pill-wrap { position: absolute; inset: 0; display: flex; justify-content: center; align-items: flex-end; padding-bottom: 150px; font-family: ${FONT}; }
      .pill { font-size: 34px; color: ${PAPER}; background: rgba(11,11,11,0.62); padding: 12px 26px; border-radius: 999px; letter-spacing: 0.2px; }`,
    `    <div class="pill-wrap"><div class="pill">${esc(text)}</div></div>`,
    ``,
  );
}

export interface Clip {
  readonly id: string;
  readonly start: number;
  readonly duration: number;
  readonly track: number;
  readonly z: number;
}

export function indexHtml(p: ShortProps, clips: readonly Clip[], total: number): string {
  const hosts = clips
    .map(
      (c) => `      <div id="${c.id}" class="clip" style="position:absolute;inset:0;z-index:${c.z}" data-composition-id="${c.id}"
        data-composition-src="compositions/${c.id}.html" data-start="${r3(c.start)}" data-duration="${r3(c.duration)}" data-track-index="${c.track}"></div>`,
    )
    .join("\n");
  return `<!doctype html>
<html lang="de">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${WIDTH}, height=${HEIGHT}" />
    <title>${esc(p.titleDe)}</title>
    <script src="vendor/gsap.min.js"></script>
    <style>
      html, body { margin: 0; padding: 0; width: ${WIDTH}px; height: ${HEIGHT}px; overflow: hidden; background: #cfe0ee; }
    </style>
  </head>
  <body>
    <div id="stage" data-composition-id="short" data-start="0" data-width="${WIDTH}" data-height="${HEIGHT}"
      data-duration="${r3(total)}" data-fps="${FPS}" style="position:relative;width:${WIDTH}px;height:${HEIGHT}px">
${hosts}
      <script>
        window.__timelines = window.__timelines || {};
        window.__timelines["short"] = gsap.timeline({ paused: true });
      </script>
    </div>
  </body>
</html>
`;
}
