/** Senaryo kaydı: yeni senaryo eklemek = klasör + buraya bir satır. */

import type { ReportConfig } from "../core/report/index.ts";
import type { ScenarioMeta, ScenarioResults } from "../core/scenario/index.ts";
import * as medianCrossing from "./median-crossing/scenario.ts";

export interface ScenarioModule {
  readonly META: ScenarioMeta;
  /** Rapor (PNG) ayarı; yoksa senaryo rapor üretmez. */
  readonly REPORT?: ReportConfig;
  run(options?: { seed?: string; trials?: number; sensitivityTrials?: number }): ScenarioResults;
}

export const SCENARIOS: Readonly<Record<string, ScenarioModule>> = {
  [medianCrossing.META.id]: medianCrossing,
};
