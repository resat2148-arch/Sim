import { createRng, type Rng, type Seed } from "../random/index.ts";

export const DEFAULT_TRIALS = 10_000;

export interface TrialContext {
  readonly index: number;
  /** Bu denemeye özel akış: createRng(seed).fork(`trial:${index}`). */
  readonly rng: Rng;
}

function trialRng(seed: Seed, index: number): Rng {
  return createRng(seed).fork(`trial:${index}`);
}

/** Bir denemeyi n kez, sabit seed ile koşturur. */
export function runTrials<T>(seed: Seed, trial: (ctx: TrialContext) => T, n = DEFAULT_TRIALS): T[] {
  if (!Number.isInteger(n) || n <= 0) throw new RangeError(`n=${n} pozitif tam sayı olmalı`);
  return Array.from({ length: n }, (_, index) => trial({ index, rng: trialRng(seed, index) }));
}

/**
 * Stratejileri ortak rastgele sayılarla karşılaştırır: i. denemede her
 * strateji aynı rng yolunu alır, yani aynı dummy örneği, aynı araç hızı, aynı
 * çarpma noktası. Stratejiler arasındaki fark yalnızca hareketten gelir.
 */
export function compareStrategies<K extends string, T>(
  seed: Seed,
  strategies: Readonly<Record<K, (ctx: TrialContext) => T>>,
  n = DEFAULT_TRIALS,
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const key of Object.keys(strategies) as K[]) {
    result[key] = runTrials(seed, strategies[key], n);
  }
  return result;
}
