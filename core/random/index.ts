/**
 * Deterministik, seed'li rastgele sayı üreteci.
 *
 * Monte Carlo sonuçlarının tekrarlanabilir olması için Math.random() hiçbir
 * yerde kullanılmaz; her rastgelelik bir Rng'den gelir.
 *
 * fork(label): Ebeveynin kaç sayı çektiğinden bağımsız, yalnızca seed yolu
 * ve etikete bağlı bir alt akış üretir. Böylece örneğin "deneme 17 / tepki
 * süresi" her hareket stratejisinde aynı değeri alır (ortak rastgele sayılar)
 * ve modele yeni bir rastgele değişken eklemek mevcut sonuçları kaydırmaz.
 */

export interface Rng {
  /** Seed yolu, örn. "42/trial:17/reaction". Hata ayıklama ve kayıt için. */
  readonly path: string;
  /** [0, 1) aralığında düzgün dağılımlı sayı. */
  next(): number;
  /** [min, max) aralığında düzgün dağılım. */
  uniform(min: number, max: number): number;
  /** [min, max] aralığında tam sayı. */
  int(min: number, max: number): number;
  /** p olasılıkla true. */
  bernoulli(p: number): boolean;
  /** Normal dağılım (Box–Muller). */
  normal(mean?: number, sd?: number): number;
  /** [min, max] ile kesilmiş normal dağılım (reddetme yöntemi). */
  truncatedNormal(mean: number, sd: number, min: number, max: number): number;
  /** Log-normal dağılım; parametreler dağılımın kendi ortalaması ve std sapması. */
  lognormal(mean: number, sd: number): number;
  /** Diziden eşit olasılıkla bir eleman. */
  pick<T>(items: readonly T[]): T;
  /** Bağımsız, deterministik alt akış. */
  fork(label: string | number): Rng;
}

export type Seed = number | string;

export function createRng(seed: Seed): Rng {
  return new Sfc32Rng(String(seed));
}

const TRUNCATED_NORMAL_MAX_TRIES = 10_000;

class Sfc32Rng implements Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(readonly path: string) {
    [this.a, this.b, this.c, this.d] = cyrb128(path);
    // İlk çıktılar seed'e fazla bağlı olabilir; durumu karıştır.
    for (let i = 0; i < 15; i++) this.nextUint32();
  }

  private nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  next(): number {
    return this.nextUint32() / 4294967296;
  }

  uniform(min: number, max: number): number {
    if (!(max >= min)) throw new RangeError(`uniform: max (${max}) < min (${min})`);
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`int: geçersiz aralık [${min}, ${max}]`);
    }
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bernoulli(p: number): boolean {
    if (!(p >= 0 && p <= 1)) throw new RangeError(`bernoulli: p=${p} [0,1] dışında`);
    return this.next() < p;
  }

  normal(mean = 0, sd = 1): number {
    if (!(sd >= 0)) throw new RangeError(`normal: sd=${sd} negatif`);
    // Box–Muller; ikinci değer bilerek saklanmaz, böylece her çağrı tam
    // olarak iki sayı tüketir ve akış tüketimi öngörülebilir kalır.
    const u1 = 1 - this.next(); // (0, 1]
    const u2 = this.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + sd * z;
  }

  truncatedNormal(mean: number, sd: number, min: number, max: number): number {
    if (!(max > min)) throw new RangeError(`truncatedNormal: max (${max}) <= min (${min})`);
    for (let i = 0; i < TRUNCATED_NORMAL_MAX_TRIES; i++) {
      const x = this.normal(mean, sd);
      if (x >= min && x <= max) return x;
    }
    // Sessizce kırpmak dağılımı bozardı; bu bir yapılandırma hatasıdır.
    throw new RangeError(
      `truncatedNormal: N(${mean}, ${sd}) için [${min}, ${max}] aralığı neredeyse imkânsız`,
    );
  }

  lognormal(mean: number, sd: number): number {
    if (!(mean > 0) || !(sd >= 0)) {
      throw new RangeError(`lognormal: mean=${mean} > 0 ve sd=${sd} >= 0 olmalı`);
    }
    const sigma2 = Math.log(1 + (sd * sd) / (mean * mean));
    const mu = Math.log(mean) - sigma2 / 2;
    return Math.exp(this.normal(mu, Math.sqrt(sigma2)));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError("pick: boş dizi");
    return items[this.int(0, items.length - 1)] as T;
  }

  fork(label: string | number): Rng {
    return new Sfc32Rng(`${this.path}/${label}`);
  }
}

/** Bir string'den 128 bitlik seed durumu üretir (cyrb128 hash). */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
