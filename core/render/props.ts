/**
 * Short'un tüm girdisi (Remotion --props). Senaryodan bağımsızdır: results.json,
 * senaryo meta verisi ve seçilen trajektorilerden saf bir fonksiyonla üretilir.
 * Remotion içinde hiçbir hesap yapılmaz; sayılar burada sabitlenir.
 */

import type { Trajectory } from "../ragdoll/simulate.ts";
import type { ScenarioMeta, ScenarioResults } from "../scenario/index.ts";
import { findCell } from "../scenario/index.ts";
import { CATEGORICAL } from "../report/charts.ts";

export const DISCLAIMER_DE = "Modellschätzung – Quellen in der Beschreibung";
export const CLOSING_QUESTION_DE = "Was würdest du tun?";

export interface AttemptConfig {
  readonly characterId: string;
  readonly strategyId: string;
}

/** Senaryonun Short ayarı. */
export interface ShortConfig {
  /** Skor tablosunun okunacağı ana tablo, örn. "vehicle:limousine". */
  readonly tableId: string;
  /** Denemeler bölümünde gösterilecek koşular (sırayla). */
  readonly attempts: readonly AttemptConfig[];
  /** Skor tablosu satırları (inVideo olmalı); boşsa tüm inVideo stratejiler. */
  readonly scoreboardStrategies?: readonly string[];
}

export interface Attempt {
  readonly nameDe: string;
  readonly color: string;
  readonly moveDe: string;
  readonly escaped: boolean;
  readonly trajectory: Trajectory;
}

export interface ScoreRow {
  readonly strategyDe: string;
  /** Araca temas oranı, tüm dummy'lerin ortalaması. */
  readonly contact: number;
  /** Ağır yaralanma riski, tüm dummy'lerin ortalaması ve model aralığı. */
  readonly severe: { readonly p: number; readonly lo: number; readonly hi: number };
}

export interface ShortProps {
  readonly scenarioId: string;
  readonly titleDe: string;
  readonly hookQuestionDe: string;
  readonly lessonDe: string;
  readonly closingQuestionDe: string;
  readonly disclaimerDe: string;
  readonly trials: number;
  readonly attempts: readonly Attempt[];
  /** En kötüden en iyiye sıralı. */
  readonly scoreboard: readonly ScoreRow[];
  [key: string]: unknown;
}

export function buildShortProps(
  meta: ScenarioMeta,
  results: ScenarioResults,
  config: ShortConfig,
  trajectories: ReadonlyMap<string, Trajectory & { readonly modelOutcome: { readonly contact: boolean } }>,
): ShortProps {
  const table = results.tables.find((t) => t.id === config.tableId);
  if (!table) throw new Error(`Tablo yok: ${config.tableId}`);
  const strategy = (id: string) => {
    const s = results.strategies.find((x) => x.id === id);
    if (!s) throw new Error(`Strateji yok: ${id}`);
    if (!s.inVideo) throw new Error(`"${s.labelDe}" videoda gösterilmez (inVideo: false)`);
    return s;
  };
  const colorOf = (id: string) => {
    const i = results.characters.findIndex((c) => c.id === id);
    if (i < 0) throw new Error(`Karakter yok: ${id}`);
    return { nameDe: results.characters[i]!.nameDe, color: CATEGORICAL[i % CATEGORICAL.length]! };
  };

  const attempts = config.attempts.map((a) => {
    const key = `${a.characterId}/${a.strategyId}`;
    const tr = trajectories.get(key);
    if (!tr) throw new Error(`Trajektori yok: ${key}`);
    const { nameDe, color } = colorOf(a.characterId);
    return { nameDe, color, moveDe: strategy(a.strategyId).labelDe, escaped: !tr.modelOutcome.contact, trajectory: tr };
  });

  const ids = config.scoreboardStrategies ?? results.strategies.filter((s) => s.inVideo).map((s) => s.id);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const scoreboard = ids
    .map((id) => {
      const cells = results.characters.map((c) => findCell(table, c.id, id));
      return {
        strategyDe: strategy(id).labelDe,
        contact: avg(cells.map((c) => c.contact.p)),
        severe: {
          p: avg(cells.map((c) => c.severe.p)),
          lo: avg(cells.map((c) => c.severe.lo)),
          hi: avg(cells.map((c) => c.severe.hi)),
        },
      };
    })
    .sort((a, b) => b.contact - a.contact);

  return {
    scenarioId: meta.id,
    titleDe: meta.titleDe,
    hookQuestionDe: meta.hookQuestionDe,
    lessonDe: meta.lessonDe,
    closingQuestionDe: CLOSING_QUESTION_DE,
    disclaimerDe: DISCLAIMER_DE,
    trials: results.trials,
    attempts,
    scoreboard,
  };
}
