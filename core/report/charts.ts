/**
 * Bağımlılıksız SVG grafik parçaları (rapor PNG'leri için, açık tema).
 * Mark kuralları: çubuk ≤ 24 px, uçta 4 px yuvarlak; çizgi 2 px; nokta r ≥ 4
 * ve 2 px yüzey halkası; ızgara 1 px düz; metin asla seri renginde değil.
 */

export const TOKENS = {
  surface: "#fcfcfb",
  page: "#f9f9f7",
  ink: "#0b0b0b",
  inkSecondary: "#52514e",
  muted: "#898781",
  grid: "#e1e0d9",
  axis: "#c3c2b7",
} as const;

/** Kategorik sıra (doğrulandı: 5 slot, açık tema). Renk karaktere bağlıdır, sıraya değil. */
export const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"] as const;

const FONT = "Inter, 'DejaVu Sans', sans-serif";

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 0,031 -> "3,1 %"; çok küçük değerler "<0,1 %". */
export function pct(x: number, digits = 1): string {
  if (x > 0 && x < 0.001) return "<0,1 %";
  return `${(x * 100).toFixed(digits).replace(".", ",")} %`;
}

/** Yuvarlak tik adımlı ölçek: en fazla 5 aralık, adım 1/2/5/10/20/25 %. */
export function niceScale(maxValue: number): { max: number; ticks: number[] } {
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.25];
  const step = steps.find((st) => maxValue / st <= 5) ?? 0.25;
  const max = Math.max(step, Math.ceil(maxValue / step - 1e-9) * step);
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
  return { max, ticks };
}

/** Uçta yuvarlak, tabanda düz yatay çubuk. */
function hBar(x0: number, y: number, len: number, h: number, color: string): string {
  if (len <= 0) return "";
  const r = Math.min(4, len, h / 2);
  return `<path d="M${x0},${y} H${x0 + len - r} Q${x0 + len},${y} ${x0 + len},${y + r} V${y + h - r} Q${x0 + len},${y + h} ${x0 + len - r},${y + h} H${x0} Z" fill="${color}"/>`;
}

export interface BarRow {
  readonly label: string;
  readonly value: number;
  readonly lo: number;
  readonly hi: number;
  /** Soluk çizilir (örn. videoda gösterilmeyen strateji). */
  readonly muted?: boolean;
}

export interface BarPanelOptions {
  readonly title: string;
  readonly subtitle?: string;
  readonly color: string;
  readonly rows: readonly BarRow[];
  /** Tüm paneller aynı ölçeği paylaşsın diye dışarıdan verilir. */
  readonly max: number;
  readonly width: number;
}

/** Tek karakter paneli: stratejiler yatay çubuk + belirsizlik bıyığı + uçta değer. */
export function barPanel(o: BarPanelOptions): string {
  const labelW = 330;
  const valueW = 120;
  const rowH = 46;
  const barH = 22;
  const top = o.subtitle ? 78 : 56;
  const plotW = o.width - labelW - valueW;
  const x = (v: number) => labelW + (Math.min(v, o.max) / o.max) * plotW;
  const height = top + o.rows.length * rowH + 34;
  const ticks = niceScale(o.max).ticks;

  const grid = ticks
    .map(
      (t) =>
        `<line x1="${x(t)}" x2="${x(t)}" y1="${top - 6}" y2="${top + o.rows.length * rowH}" stroke="${TOKENS.grid}" stroke-width="1"/>` +
        `<text x="${x(t)}" y="${top + o.rows.length * rowH + 26}" text-anchor="middle" font-size="20" fill="${TOKENS.muted}">${pct(t, 0)}</text>`,
    )
    .join("");

  const rows = o.rows
    .map((r, i) => {
      const y = top + i * rowH + (rowH - barH) / 2;
      const cy = y + barH / 2;
      const opacity = r.muted ? 0.35 : 1;
      return [
        `<text x="0" y="${cy + 8}" font-size="24" fill="${r.muted ? TOKENS.muted : TOKENS.ink}">${esc(r.label)}</text>`,
        `<g opacity="${opacity}">${hBar(labelW, y, x(r.value) - labelW, barH, o.color)}</g>`,
        `<line x1="${x(r.lo)}" x2="${x(r.hi)}" y1="${cy}" y2="${cy}" stroke="${TOKENS.inkSecondary}" stroke-width="2"/>`,
        `<line x1="${x(r.lo)}" x2="${x(r.lo)}" y1="${cy - 7}" y2="${cy + 7}" stroke="${TOKENS.inkSecondary}" stroke-width="2"/>`,
        `<line x1="${x(r.hi)}" x2="${x(r.hi)}" y1="${cy - 7}" y2="${cy + 7}" stroke="${TOKENS.inkSecondary}" stroke-width="2"/>`,
        `<text x="${o.width}" y="${cy + 8}" text-anchor="end" font-size="24" font-weight="600" fill="${r.muted ? TOKENS.muted : TOKENS.ink}">${pct(r.value)}</text>`,
      ].join("");
    })
    .join("");

  const head =
    `<circle cx="10" cy="22" r="9" fill="${o.color}"/>` +
    `<text x="30" y="31" font-size="30" font-weight="600" fill="${TOKENS.ink}">${esc(o.title)}</text>` +
    (o.subtitle ? `<text x="0" y="64" font-size="20" fill="${TOKENS.inkSecondary}">${esc(o.subtitle)}</text>` : "");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${height}" font-family="${FONT}">${head}${grid}${rows}</svg>`;
}

export interface LineSeries {
  readonly name: string;
  readonly color: string;
  readonly points: readonly { readonly x: number; readonly y: number }[];
  /** Çizginin sonunda ad etiketi gösterilsin mi (seçici etiketleme). */
  readonly endLabel?: boolean;
}

export interface LineChartOptions {
  readonly series: readonly LineSeries[];
  readonly width: number;
  readonly height: number;
  readonly xLabel: string;
  readonly xUnit: string;
  readonly yMax?: number;
  /** Senaryonun ana koşulunu işaretleyen dikey çizgi. */
  readonly marker?: { readonly x: number; readonly label: string };
}

/** Çok serili çizgi grafik; tek y ekseni, yüzde. */
export function lineChart(o: LineChartOptions): string {
  const left = 90;
  const right = 150;
  const top = 30;
  const bottom = 80;
  const xs = o.series.flatMap((s) => s.points.map((p) => p.x));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const scale = niceScale(o.yMax ?? Math.max(...o.series.flatMap((s) => s.points.map((p) => p.y))));
  const yMax = scale.max;
  const plotW = o.width - left - right;
  const plotH = o.height - top - bottom;
  const X = (v: number) => left + ((v - xMin) / (xMax - xMin)) * plotW;
  const Y = (v: number) => top + plotH - (v / yMax) * plotH;

  const yTicks = scale.ticks;
  const grid = yTicks
    .map(
      (t) =>
        `<line x1="${left}" x2="${left + plotW}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 ? TOKENS.axis : TOKENS.grid}" stroke-width="1"/>` +
        `<text x="${left - 14}" y="${Y(t) + 7}" text-anchor="end" font-size="20" fill="${TOKENS.muted}">${pct(t, 0)}</text>`,
    )
    .join("");
  const xTicks = [...new Set(xs)]
    .sort((a, b) => a - b)
    .map(
      (v) =>
        `<text x="${X(v)}" y="${top + plotH + 32}" text-anchor="middle" font-size="20" fill="${TOKENS.muted}">${v}</text>`,
    )
    .join("");
  const xTitle = `<text x="${left + plotW / 2}" y="${o.height - 10}" text-anchor="middle" font-size="22" fill="${TOKENS.inkSecondary}">${esc(o.xLabel)} (${esc(o.xUnit)})</text>`;

  const marker = o.marker
    ? `<line x1="${X(o.marker.x)}" x2="${X(o.marker.x)}" y1="${top}" y2="${top + plotH}" stroke="${TOKENS.axis}" stroke-width="1"/>` +
      `<text x="${X(o.marker.x) + 8}" y="${top + 20}" font-size="20" fill="${TOKENS.inkSecondary}">${esc(o.marker.label)}</text>`
    : "";

  const lines = o.series
    .map((s) => {
      const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${X(p.x)},${Y(p.y)}`).join(" ");
      const dots = s.points
        .map((p) => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="5" fill="${s.color}" stroke="${TOKENS.surface}" stroke-width="2"/>`)
        .join("");
      const last = s.points[s.points.length - 1];
      const label =
        s.endLabel && last
          ? `<text x="${X(last.x) + 14}" y="${Y(last.y) + 7}" font-size="22" font-weight="600" fill="${TOKENS.ink}">${esc(s.name)} ${pct(last.y, 0)}</text>`
          : "";
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${dots}${label}`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${o.width}" height="${o.height}" font-family="${FONT}">${grid}${xTicks}${xTitle}${marker}${lines}</svg>`;
}

/** Lejant: renkli işaret + mürekkep renginde ad (≥ 2 seri için her zaman). */
export function legend(items: readonly { name: string; color: string }[]): string {
  return `<div class="legend">${items
    .map((i) => `<span><i style="background:${i.color}"></i>${esc(i.name)}</span>`)
    .join("")}</div>`;
}
