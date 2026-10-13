/** Short kompozisyonu: bölümler ardışık Sequence'lar; uyarı notu her karede. */

import { AbsoluteFill, Sequence } from "remotion";
import type { ShortProps } from "./props.ts";
import { AttemptScene, Closing, Hook, Lesson, Scoreboard } from "./scenes.tsx";
import { buildTimeline } from "./timeline.ts";
import { Disclaimer } from "./ui.tsx";

export function Short(props: ShortProps) {
  const { sections } = buildTimeline(props.attempts.length);
  return (
    <AbsoluteFill style={{ background: "#cfe0ee" }}>
      {sections.map((s) => {
        const content =
          s.id === "hook" ? (
            <Hook props={props} />
          ) : s.id === "scoreboard" ? (
            <Scoreboard props={props} />
          ) : s.id === "lesson" ? (
            <Lesson props={props} />
          ) : s.id === "closing" ? (
            <Closing props={props} />
          ) : (
            <AttemptScene attempt={props.attempts[Number(s.id.split("-")[1])]!} />
          );
        return (
          <Sequence key={s.id} name={s.id} from={s.from} durationInFrames={s.duration}>
            {content}
          </Sequence>
        );
      })}
      <Disclaimer text={props.disclaimerDe} />
    </AbsoluteFill>
  );
}
