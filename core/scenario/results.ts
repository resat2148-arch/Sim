/**
 * Tüm senaryoların ortak sonuç biçimi (results.json). Rapor (PNG) ve
 * Remotion şablonu yalnızca bu biçimi okur; senaryo içini bilmez.
 */

import { mean, proportion, type Proportion } from "../montecarlo/stats.ts";
import type { RiskEstimate } from "../risk/model.ts";

/** Tek bir denemenin sonucu. */
export interface TrialOutcome {
  readonly contact: boolean;
  readonly severe: RiskEstimate;
  readonly fatal: RiskEstimate;
}

export interface OutcomeSummary {
  /** Araçla temas oranı (Wilson %95: örnekleme gürültüsü). */
  readonly contact: Proportion;
  /** Ortalama risk; lo–hi model belirsizliği aralığıdır. */
  readonly severe: RiskEstimate;
  readonly fatal: RiskEstimate;
}

export interface ResultCell {
  readonly characterId: string;
  readonly strategyId: string;
  readonly summary: OutcomeSummary;
}

export interface ResultTable {
  readonly id: string;
  readonly labelDe: string;
  /** Bu tabloyu üreten sabit parametreler (hız, mesafe, araç...). */
  readonly parameters: Readonly<Record<string, number | string>>;
  readonly cells: readonly ResultCell[];
}

export interface ScenarioResults {
  readonly scenarioId: string;
  readonly seed: string;
  readonly trials: number;
  readonly characters: readonly { readonly id: string; readonly nameDe: string }[];
  readonly strategies: readonly { readonly id: string; readonly labelDe: string }[];
  /** Ana sonuçlar (örn. araç tipine göre). */
  readonly tables: readonly ResultTable[];
  /** Duyarlılık analizleri (örn. fark etme mesafesi taraması). */
  readonly sensitivity: readonly ResultTable[];
  /** Senaryo düzeyindeki varsayımlar, düz metin (kullanıcı raporuna girer). */
  readonly assumptions: readonly string[];
}

function meanEstimate(xs: readonly RiskEstimate[]): RiskEstimate {
  return { p: mean(xs.map((x) => x.p)), lo: mean(xs.map((x) => x.lo)), hi: mean(xs.map((x) => x.hi)) };
}

export function summarizeOutcomes(outcomes: readonly TrialOutcome[]): OutcomeSummary {
  return {
    contact: proportion(outcomes.filter((o) => o.contact).length, outcomes.length),
    severe: meanEstimate(outcomes.map((o) => o.severe)),
    fatal: meanEstimate(outcomes.map((o) => o.fatal)),
  };
}

export function findCell(table: ResultTable, characterId: string, strategyId: string): OutcomeSummary {
  const cell = table.cells.find((c) => c.characterId === characterId && c.strategyId === strategyId);
  if (!cell) throw new Error(`${table.id}: ${characterId}/${strategyId} hücresi yok`);
  return cell.summary;
}
