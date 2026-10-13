import { Composition } from "remotion";
import { CLOSING_QUESTION_DE, DISCLAIMER_DE, type ShortProps } from "./props.ts";
import { Short } from "./Short.tsx";
import { buildTimeline, FPS, HEIGHT, WIDTH } from "./timeline.ts";

/** Studio'da açılabilsin diye boş yer tutucu; gerçek veri --props ile gelir. */
const PLACEHOLDER: ShortProps = {
  scenarioId: "placeholder",
  titleDe: "Titel",
  hookQuestionDe: "Springen oder ausweichen?",
  lessonDe: "Lektion",
  closingQuestionDe: CLOSING_QUESTION_DE,
  disclaimerDe: DISCLAIMER_DE,
  trials: 10_000,
  attempts: [],
  scoreboard: [],
};

export function RemotionRoot() {
  return (
    <Composition
      id="Short"
      component={Short}
      width={WIDTH}
      height={HEIGHT}
      fps={FPS}
      durationInFrames={buildTimeline(0).total}
      defaultProps={PLACEHOLDER}
      calculateMetadata={({ props }) => ({ durationInFrames: buildTimeline(props.attempts.length).total })}
    />
  );
}
