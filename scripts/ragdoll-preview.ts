/**
 * Trajektori teşhis şeridi (render değil): birkaç anı yandan (temas) veya
 * üstten (kaçış) basit çizgilerle gösterir. Telefonda hızlı kontrol için.
 * Kullanım: npx tsx scripts/ragdoll-preview.ts <trajectory.json> [...]
 * Çıktı: aynı adla .png
 */

import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";
import { TOKENS } from "../core/report/charts.ts";
import type { Trajectory } from "../core/ragdoll/index.ts";

type Saved = Trajectory & { characterId: string; strategyId: string; vehicleId: string; trial: number; modelOutcome: { contact: boolean } };

function rotate(q: number[], v: [number, number, number]): [number, number, number] {
  const [qx, qy, qz, qw] = q as [number, number, number, number];
  const [x, y, z] = v;
  const ix = qw * x + qy * z - qz * y;
  const iy = qw * y + qz * x - qx * z;
  const iz = qw * z + qx * y - qy * x;
  const iw = -qx * x - qy * y - qz * z;
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx];
}

function panel(tr: Saved, frameIndex: number, top: boolean, W: number, H: number): string {
  const f = tr.frames[frameIndex]!;
  const torso = f.parts[tr.parts.findIndex((p) => p.name === "torso")]!;
  const cx = torso[0]!;
  const scale = top ? 36 : 60;
  // Üstten: araç orta hattı (z = 0) ile dummy arası ortalanır.
  const zc = torso[2]! / 2;
  const X = (x: number) => W / 2 + (x - cx) * scale;
  const Y = (v: number) => (top ? H / 2 - (v - zc) * scale : H - 20 - v * scale);
  const pick = (p: [number, number, number]) => (top ? p[2] : p[1]);
  let svg = top ? "" : `<line x1="0" x2="${W}" y1="${Y(0)}" y2="${Y(0)}" stroke="${TOKENS.axis}"/>`;
  // Araç
  const vx = f.vehicleX;
  if (top) {
    const w = tr.vehicle.width / 2;
    svg += `<rect x="${X(vx + tr.vehicle.rear.to)}" y="${Y(w)}" width="${-tr.vehicle.rear.to * scale}" height="${2 * w * scale}" fill="#c3c2b7" rx="8"/>`;
  } else {
    const pts = [...tr.vehicle.frontHull, [tr.vehicle.rear.to, tr.vehicle.rear.height] as const, [tr.vehicle.rear.to, 0.25] as const];
    const hull = tr.vehicle.frontHull.map(([x, y]) => `${X(vx + x)},${Y(y)}`).join(" ");
    svg += `<polygon points="${hull}" fill="#c3c2b7"/>`;
    svg += `<rect x="${X(vx + tr.vehicle.rear.to)}" y="${Y(tr.vehicle.rear.height)}" width="${(tr.vehicle.rear.from - tr.vehicle.rear.to) * scale}" height="${(tr.vehicle.rear.height - 0.25) * scale}" fill="#c3c2b7"/>`;
    void pts;
  }
  // Dummy (sarı-siyah)
  tr.parts.forEach((part, i) => {
    const s = f.parts[i]!;
    const pos: [number, number, number] = [s[0]!, s[1]!, s[2]!];
    const q = s.slice(3);
    if (part.shape.type === "ball") {
      svg += `<circle cx="${X(pos[0])}" cy="${Y(pick(pos))}" r="${part.shape.radius * scale}" fill="#eda100" stroke="#0b0b0b" stroke-width="2"/>`;
      return;
    }
    const half = part.shape.type === "capsule" ? part.shape.halfHeight + part.shape.radius : part.shape.halfExtents[1];
    const width = part.shape.type === "capsule" ? part.shape.radius * 2 : part.shape.halfExtents[top ? 2 : 0] * 2;
    const a = rotate(q, [0, half, 0]);
    const p1: [number, number, number] = [pos[0] + a[0], pos[1] + a[1], pos[2] + a[2]];
    const p2: [number, number, number] = [pos[0] - a[0], pos[1] - a[1], pos[2] - a[2]];
    svg += `<line x1="${X(p1[0])}" y1="${Y(pick(p1))}" x2="${X(p2[0])}" y2="${Y(pick(p2))}" stroke="#0b0b0b" stroke-width="${width * scale + 3}" stroke-linecap="round"/>`;
    svg += `<line x1="${X(p1[0])}" y1="${Y(pick(p1))}" x2="${X(p2[0])}" y2="${Y(pick(p2))}" stroke="#eda100" stroke-width="${width * scale}" stroke-linecap="round"/>`;
  });
  svg += `<text x="10" y="26" font-size="20" fill="${TOKENS.inkSecondary}">t = ${f.t.toFixed(2).replace(".", ",")} s</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Inter, sans-serif" style="background:${TOKENS.surface};border-radius:12px">${svg}</svg>`;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
try {
  const tab = await browser.newPage({ viewport: { width: 1080, height: 800 } });
  for (const file of process.argv.slice(2)) {
    const tr = JSON.parse(readFileSync(file, "utf8")) as Saved;
    const top = tr.releaseTime === null;
    const torsoIdx = tr.parts.findIndex((p) => p.name === "torso");
    // Temas yoksa referans an: aracın ön yüzünün dummy'nin hizasına geldiği kare.
    const passFrame = tr.frames.findIndex((f) => f.vehicleX >= f.parts[torsoIdx]![0]!);
    const contactFrame = tr.releaseTime === null ? passFrame : Math.round(tr.releaseTime * tr.fps);
    const picks = (top ? [0.5, 0.8, 0.95, 1.05, 1.2, 1.5] : [0.55, 0.85, 1, 1.12, 1.35, 1.9]).map((k) => Math.min(tr.frames.length - 1, Math.round(contactFrame * k)));
    const panels = picks.map((i) => panel(tr, i, top, 496, 300)).join("");
    const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1080px;background:${TOKENS.page};font-family:Inter,sans-serif;padding:28px;box-sizing:border-box">
      <div style="font-size:22px;color:${TOKENS.inkSecondary}">Ragdoll-Diagnose · nur Darstellung, keine Zahlen</div>
      <div style="font-size:38px;font-weight:700;margin:4px 0 6px">${tr.characterId} · ${tr.strategyId} · ${tr.vehicleId}</div>
      <div style="font-size:22px;color:${TOKENS.inkSecondary};margin-bottom:18px">Deneme ${tr.trial} · model sonucu: ${tr.modelOutcome.contact ? "temas" : "kaçtı"} · ${top ? "üstten görünüm" : "yandan görünüm"}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">${panels}</div></body>`;
    await tab.setContent(html);
    const out = file.replace(/\.json$/, ".png");
    await tab.screenshot({ path: out, fullPage: true });
    console.log(out);
  }
} finally {
  await browser.close();
}
