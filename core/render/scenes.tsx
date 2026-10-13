/** Short'un beş bölümü. Her bölüm kendi Sequence'ı içinde 0'dan sayar. */

import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Attempt, ScoreRow, ShortProps } from "./props.ts";
import { Scene } from "./three/Scene.tsx";
import { attemptTime, DURATIONS, HEIGHT, WIDTH } from "./timeline.ts";
import { Card, CRITICAL, FONT, GOOD, INK, NameChip, PAPER } from "./ui.tsx";

const pct = (x: number) => `${Math.round(x * 100)} %`;

function World({ attempt, t, frozen = false }: { attempt: Attempt; t: number; frozen?: boolean }) {
  return (
    <AbsoluteFill style={{ filter: frozen ? "saturate(0.35) contrast(1.05)" : undefined }}>
      <ThreeCanvas width={WIDTH} height={HEIGHT} camera={{ fov: 52, near: 0.1, far: 200 }}>
        <Scene tr={attempt.trajectory} t={t} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
}

/** 1) Hook: tehlike anı, görüntü donar, soru ekranda. */
export function Hook({ props }: { props: ShortProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const first = props.attempts[0];
  // İlk 0,5 s sahne akar, sonra donar.
  const t = 0.45 + Math.min(frame, fps * 0.5) / fps;
  const frozen = frame >= fps * 0.5;
  const pop = spring({ frame: frame - fps * 0.5, fps, config: { damping: 12 } });
  return (
    <AbsoluteFill style={{ background: "#cfe0ee" }}>
      {first && <World attempt={first} t={t} frozen={frozen} />}
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 260 }}>
        <div style={{ fontFamily: FONT, fontSize: 44, color: INK, background: PAPER, padding: "10px 24px", borderRadius: 14, fontWeight: 600 }}>
          {props.titleDe}
        </div>
        <div
          style={{
            marginTop: 40,
            transform: `scale(${0.6 + 0.4 * pop})`,
            opacity: frozen ? 1 : 0,
            fontFamily: FONT,
            fontWeight: 900,
            fontSize: 112,
            lineHeight: 1.05,
            color: PAPER,
            textAlign: "center",
            textShadow: "0 6px 0 #0b0b0b, 0 0 30px rgba(0,0,0,0.6)",
            padding: "0 60px",
          }}
        >
          {props.hookQuestionDe}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** 2) Deneme: ad + hareket, trajektori oynar, sonuç damgası. */
export function AttemptScene({ attempt }: { attempt: Attempt }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = attemptTime(frame, attempt.trajectory.duration);
  const outcomeStart = DURATIONS.attemptIntro + DURATIONS.attemptPlay - 20;
  const stamp = spring({ frame: frame - outcomeStart, fps, config: { damping: 9, stiffness: 160 } });
  const chipIn = spring({ frame, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <World attempt={attempt} t={t} />
      <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 200 }}>
        <div style={{ transform: `translateY(${(1 - chipIn) * -200}px)` }}>
          <NameChip name={attempt.nameDe} color={attempt.color} sub={attempt.moveDe} />
        </div>
      </AbsoluteFill>
      {frame >= outcomeStart && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 900,
              fontSize: 120,
              color: PAPER,
              background: attempt.escaped ? GOOD : CRITICAL,
              padding: "18px 54px",
              borderRadius: 28,
              border: `10px solid ${PAPER}`,
              transform: `rotate(-7deg) scale(${interpolate(stamp, [0, 1], [2.2, 1])})`,
              opacity: Math.min(1, stamp * 1.5),
            }}
          >
            {attempt.escaped ? "✓ Geschafft!" : "✗ Erwischt!"}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}

function ScoreBar({ row, index, best }: { row: ScoreRow; index: number; best: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const grow = spring({ frame: frame - 20 - index * 14, fps, config: { damping: 18 } });
  const value = row.contact * grow;
  return (
    <div style={{ marginBottom: 54 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 54, fontWeight: 700 }}>
        <span>
          {best ? "★ " : ""}
          {row.strategyDe}
        </span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{pct(value)}</span>
      </div>
      <div style={{ height: 46, background: "#e1e0d9", borderRadius: 12, marginTop: 14, overflow: "hidden" }}>
        <div style={{ width: `${value * 100}%`, height: "100%", background: best ? GOOD : "#2a78d6", borderRadius: "0 12px 12px 0" }} />
      </div>
      <div style={{ fontSize: 34, color: "#52514e", marginTop: 12, opacity: grow }}>
        Schwer verletzt: {pct(row.severe.p)} (Spanne {Math.round(row.severe.lo * 100)}–{pct(row.severe.hi)})
      </div>
    </div>
  );
}

/** 3) Skor tablosu: 10.000 simülasyonun sonucu. */
export function Scoreboard({ props }: { props: ShortProps }) {
  const best = props.scoreboard.length - 1;
  return (
    <AbsoluteFill style={{ background: "#e9edf1", justifyContent: "center", padding: 64 }}>
      <Card style={{ padding: "56px 56px 20px" }}>
        <div style={{ fontSize: 46, color: "#52514e", fontWeight: 600 }}>
          {props.trials.toLocaleString("de-DE")} Simulationen pro Dummy
        </div>
        <div style={{ fontSize: 74, fontWeight: 900, margin: "8px 0 56px", lineHeight: 1.05 }}>Vom Auto erfasst</div>
        {props.scoreboard.map((row, i) => (
          <ScoreBar key={row.strategyDe} row={row} index={i} best={i === best} />
        ))}
      </Card>
    </AbsoluteFill>
  );
}

/** 4) Ders: ciddi ton, tek cümle. */
export function Lesson({ props }: { props: ShortProps }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#14181d", justifyContent: "center", padding: 90 }}>
      <div style={{ opacity, fontFamily: FONT, color: PAPER }}>
        <div style={{ fontSize: 48, fontWeight: 600, color: "#c3c2b7", marginBottom: 36 }}>Was wirklich hilft</div>
        <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.15 }}>{props.lessonDe}</div>
      </div>
    </AbsoluteFill>
  );
}

/** 5) Kapanış sorusu: yorum tetikleyici. */
export function Closing({ props }: { props: ShortProps }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 10 } });
  return (
    <AbsoluteFill style={{ background: "#f4c400", justifyContent: "center", alignItems: "center", padding: 80 }}>
      <div style={{ fontFamily: FONT, textAlign: "center", color: INK, transform: `scale(${0.7 + 0.3 * pop})` }}>
        <div style={{ fontSize: 124, fontWeight: 900, lineHeight: 1.05 }}>{props.closingQuestionDe}</div>
        <div style={{ fontSize: 52, fontWeight: 600, marginTop: 40 }}>Schreib's in die Kommentare 👇</div>
      </div>
    </AbsoluteFill>
  );
}
