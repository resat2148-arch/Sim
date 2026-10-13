/** Ortak 2D katmanlar: tipografi, uyarı notu, etiketler. Tüm metinler Almanca. */

import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill } from "remotion";

export const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
export const INK = "#0b0b0b";
export const PAPER = "#fcfcfb";
export const GOOD = "#0ca30c";
export const CRITICAL = "#d03b3b";

/** Her karede görünür eğitim bağlamı (YouTube: açıklamada değil, videoda olmalı). */
export function Disclaimer({ text }: { text: string }) {
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 150 }}>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 34,
          color: PAPER,
          background: "rgba(11,11,11,0.62)",
          padding: "12px 26px",
          borderRadius: 999,
          letterSpacing: 0.2,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        background: "rgba(252,252,251,0.94)",
        color: INK,
        borderRadius: 36,
        padding: "36px 44px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Dummy adı + renkli işaret (renk yalnızca işarette, metin mürekkep renginde). */
export function NameChip({ name, color, sub }: { name: string; color: string; sub: string }) {
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 28, padding: "28px 40px" }}>
      <div style={{ width: 44, height: 44, borderRadius: 22, background: color, border: `6px solid ${INK}` }} />
      <div>
        <div style={{ fontSize: 66, fontWeight: 800, lineHeight: 1 }}>{name}</div>
        <div style={{ fontSize: 44, fontWeight: 500, marginTop: 8, color: "#52514e" }}>{sub}</div>
      </div>
    </Card>
  );
}
