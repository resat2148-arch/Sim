/**
 * Monte Carlo çıktısı için özet istatistikler.
 *
 * Not: Buradaki güven aralıkları yalnızca örnekleme gürültüsünü (N sonlu
 * olduğu için) yansıtır. Modelin kendi belirsizliği (VARSAYIM'lar, kaynak
 * aralıkları) ayrıca duyarlılık analiziyle gösterilmelidir.
 */

export interface Proportion {
  readonly count: number;
  readonly n: number;
  readonly p: number;
  /** Wilson skor aralığı alt sınırı. */
  readonly lo: number;
  /** Wilson skor aralığı üst sınırı. */
  readonly hi: number;
}

/** Oran ve Wilson %95 güven aralığı. */
export function proportion(count: number, n: number, z = 1.96): Proportion {
  if (!(n > 0) || count < 0 || count > n) throw new RangeError(`proportion: count=${count}, n=${n}`);
  const p = count / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  return { count, n, p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/**
 * Kategorik sonuçları sayar. `categories` verilirse hiç görülmeyen
 * kategoriler de 0 ile listelenir (skor tablosunda boş satır kalmaz).
 */
export function tally<C extends string>(
  outcomes: readonly C[],
  categories: readonly C[] = [],
): Record<C, Proportion> {
  const counts = new Map<C, number>(categories.map((c) => [c, 0]));
  for (const o of outcomes) counts.set(o, (counts.get(o) ?? 0) + 1);
  const result = {} as Record<C, Proportion>;
  for (const [c, count] of counts) result[c] = proportion(count, outcomes.length);
  return result;
}

export function mean(xs: readonly number[]): number {
  if (xs.length === 0) throw new RangeError("mean: boş dizi");
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

/** Doğrusal ara değerli kantil (q ∈ [0, 1]). */
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) throw new RangeError("quantile: boş dizi");
  if (!(q >= 0 && q <= 1)) throw new RangeError(`quantile: q=${q}`);
  const sorted = [...xs].sort((a, b) => a - b);
  const pos = q * (sorted.length - 1);
  const i = Math.floor(pos);
  const frac = pos - i;
  const a = sorted[i] as number;
  const b = sorted[Math.min(i + 1, sorted.length - 1)] as number;
  return a + frac * (b - a);
}
