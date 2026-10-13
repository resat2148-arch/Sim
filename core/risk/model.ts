/**
 * Çarpma sonucu risk fonksiyonları: çarpma hızı, yaş, araç önü ve temas
 * geometrisi -> ağır yaralanma ve ölüm olasılığı.
 *
 * Her olasılık bir merkez tahmin ve bir model belirsizliği aralığıyla gelir
 * (CLAUDE.md, kural 4). Ragdoll'dan hiçbir sayı gelmez (kural 1).
 */

import { inchToM, msToKmh, mphToMs } from "../units/index.ts";

export interface RiskEstimate {
  /** Merkez tahmin. */
  readonly p: number;
  /** Model belirsizliği aralığı (örnekleme gürültüsü değil). */
  readonly lo: number;
  readonly hi: number;
}

export type FrontShape = "sloped" | "blunt";

export interface VehicleFront {
  /** Kaputun ön kenar yüksekliği (m). */
  readonly hoodEdgeHeight: number;
  readonly shape: FrontShape;
}

export interface ImpactInput {
  /** Çarpma hızı (m/s). */
  readonly impactSpeed: number;
  readonly age: number;
  readonly front: VehicleFront;
  /** Çarpma anında kalça yüksekliği (m): ayakta kalça + sıçramayla yükselme. */
  readonly hipAtImpact: number;
  /** Gövdenin araç yolunda kalan kısmı: 1 = tam önden, küçük = sıyırma. */
  readonly bodyInPath: number;
}

export interface ImpactRisk {
  readonly severe: RiskEstimate;
  readonly fatal: RiskEstimate;
  /** Kalça kaput kenarının üstünde: yaya kaputa alınır. */
  readonly wrapped: boolean;
  /** Yaş düzeltmesinden sonraki eşdeğer hız (km/h). */
  readonly equivalentSpeedKmh: number;
  readonly frontFactor: number;
  readonly contactFactor: number;
}

// --- Hız -> ölüm (rosen2009) -----------------------------------------------
// P = 1 / (1 + exp(a − b·v)), v km/h. GIDAS, ≥15 yaş, binek aracın önü.
// Kontrol: %50 ≈ 77 km/h (makale: ~75 km/h, GA %26–68), %10 ≈ 52 km/h,
// 50 km/h'deki risk 40'takinin 2, 30'dakinin 5 katından fazla.
const FATAL_A = 6.9;
const FATAL_B = 0.09;
// rosen2009: 75 km/h'de %95 GA %26–68 -> logit ölçeğinde ≈ ±0,9.
// VARSAYIM: bu genişlik tüm hızlarda geçerli; duruş etkisi de bu bandın içinde.
const LOGIT_BAND = 0.9;

// --- Hız -> ağır yaralanma (tefft2013, AIS 4+) -----------------------------
// Tefft eğrisi: %10 @ 17,1 mph, %50 @ 33,0 mph, %90 @ 48,1 mph
// -> km/h'de v50 = 53,1, eğim ≈ 0,088.
// Tefft'in ölüm eğrisi (%50 @ 40,6 mph = 65,3 km/h) GIDAS eğrisinden
// (77 km/h) ~11,4 km/h düşük; eski ABD verisi riski yüksek gösterir
// (rosen2009). VARSAYIM: ağır yaralanma eğrisi de aynı miktarda kaydırılır.
const SEVERE_B = 0.088;
const TEFFT_FATAL_V50_KMH = msToKmh(mphToMs(40.6));
const SEVERE_V50_KMH = msToKmh(mphToMs(33.0)) + (FATAL_A / FATAL_B - TEFFT_FATAL_V50_KMH);

// --- Yaş (tefft2013) --------------------------------------------------------
// 70 yaşındaki yayanın riski, 11,8 mph daha hızlı çarpılan 30 yaşındakiyle
// aynı -> yılda ≈ 0,475 km/h eşdeğer hız.
const AGE_SPEED_SHIFT_KMH_PER_YEAR = msToKmh(mphToMs(11.8)) / 40;
// VARSAYIM: GIDAS örnekleminin tipik yaşı 45; etki tüm yaşlarda doğrusal.
const REFERENCE_AGE = 45;

// --- Araç önü (iihs2023) ----------------------------------------------------
// Kaput > 40 inç: şekilden bağımsız ~%45 daha ölümcül.
// 30–40 inç ve küt ön: ~%26 daha ölümcül. Referans: ≤ 30 inç, eğimli ön.
const TALL_HOOD = inchToM(40);
const MEDIUM_HOOD = inchToM(30);
const TALL_FACTOR = 1.45;
const MEDIUM_BLUNT_FACTOR = 1.26;

// --- Temas geometrisi -------------------------------------------------------
// VARSAYIM: gövdenin yalnızca bir kısmı araç yolundaysa (sıyırma) risk
// orantılı azalır, ama yere düşme nedeniyle tam önden riskin %25'inin altına inmez.
const GLANCING_MIN = 0.25;

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function band(logit: number): RiskEstimate {
  return { p: logistic(logit), lo: logistic(logit - LOGIT_BAND), hi: logistic(logit + LOGIT_BAND) };
}

/** Ortalama (GIDAS tipik yaşı) yetişkin için ölüm riski, v km/h. */
export function fatalRiskAtSpeed(vKmh: number): RiskEstimate {
  return band(FATAL_B * vKmh - FATAL_A);
}

/** Ortalama yetişkin için ağır yaralanma (AIS 4+) riski, v km/h. */
export function severeRiskAtSpeed(vKmh: number): RiskEstimate {
  return band(SEVERE_B * (vKmh - SEVERE_V50_KMH));
}

/** Yaşı hıza çevirir: yaşlı yaya, daha hızlı çarpılmış gibi. */
export function ageEquivalentSpeedKmh(vKmh: number, age: number): number {
  return Math.max(0, vKmh + AGE_SPEED_SHIFT_KMH_PER_YEAR * (age - REFERENCE_AGE));
}

/**
 * Araç önü risk çarpanı. VARSAYIM: kalça kaput kenarının üstündeyse yaya
 * kaputa alınır ve yüksek/küt önün ek riski (gövdeye ızgarayla vurma) oluşmaz.
 */
export function frontFactor(front: VehicleFront, wrapped: boolean): number {
  if (wrapped) return 1;
  if (front.hoodEdgeHeight > TALL_HOOD) return TALL_FACTOR;
  if (front.hoodEdgeHeight > MEDIUM_HOOD && front.shape === "blunt") return MEDIUM_BLUNT_FACTOR;
  return 1;
}

export function contactFactor(bodyInPath: number): number {
  const f = Math.min(1, Math.max(0, bodyInPath));
  return GLANCING_MIN + (1 - GLANCING_MIN) * f;
}

function scale(r: RiskEstimate, k: number): RiskEstimate {
  return { p: Math.min(1, r.p * k), lo: Math.min(1, r.lo * k), hi: Math.min(1, r.hi * k) };
}

function atLeast(r: RiskEstimate, floor: RiskEstimate): RiskEstimate {
  return { p: Math.max(r.p, floor.p), lo: Math.max(r.lo, floor.lo), hi: Math.max(r.hi, floor.hi) };
}

export function impactRisk(input: ImpactInput): ImpactRisk {
  if (!(input.impactSpeed >= 0)) throw new RangeError(`impactSpeed=${input.impactSpeed}`);
  const equivalentSpeedKmh = ageEquivalentSpeedKmh(msToKmh(input.impactSpeed), input.age);
  const wrapped = input.hipAtImpact >= input.front.hoodEdgeHeight;
  const ff = frontFactor(input.front, wrapped);
  const cf = contactFactor(input.bodyInPath);
  // IIHS çarpanı ölüm verisinden; VARSAYIM: ağır yaralanmaya da aynı oranda uygulanır.
  const fatal = scale(fatalRiskAtSpeed(equivalentSpeedKmh), ff * cf);
  // Ölüm, ağır yaralanmanın alt kümesidir; iki ayrı kaynağın eğrileri çakışmasın.
  const severe = atLeast(scale(severeRiskAtSpeed(equivalentSpeedKmh), ff * cf), fatal);
  return { severe, fatal, wrapped, equivalentSpeedKmh, frontFactor: ff, contactFactor: cf };
}

export const NO_CONTACT_RISK: Pick<ImpactRisk, "severe" | "fatal"> = {
  severe: { p: 0, lo: 0, hi: 0 },
  fatal: { p: 0, lo: 0, hi: 0 },
};
