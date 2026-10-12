/**
 * Vücut profili -> hareket kapasitesi.
 *
 * Her sabitin yanında ya bir kaynak anahtarı (sources.ts) ya da VARSAYIM
 * etiketi vardır. VARSAYIM'lar daha iyi veri bulunduğunda değiştirilecek
 * ilk adaylardır; sonuçlar "model tahmini" olarak sunulur.
 */

import type { Rng } from "../random/index.ts";

export type Sex = "female" | "male";

export interface BodyProfile {
  readonly age: number; // yıl
  readonly sex: Sex;
  readonly heightM: number;
  readonly massKg: number;
  /** Vücut yağ oranı, 0–1 (örn. 0.22 = %22). */
  readonly bodyFat: number;
}

/** Bir vücut tipinin popülasyon ortalaması düzeyindeki kapasiteleri. */
export interface MotorCapacity {
  /** Tehlikeyi görmekten harekete başlamaya kadar geçen süre (s), log-normal. */
  readonly reactionTime: { readonly mean: number; readonly sd: number };
  /** Dikey sıçrama yüksekliği (m), ağırlık merkezinin yükselmesi. */
  readonly jumpHeight: { readonly mean: number; readonly sd: number };
  /** Ayakta dururken kalça eklemi yüksekliği (m). */
  readonly hipHeight: number;
  /** Duruştan koşu: v(t) = vmax·(1 − e^(−t/τ)). */
  readonly sprint: {
    readonly vmax: { readonly mean: number; readonly sd: number };
    readonly tau: number;
  };
}

/** Tek bir Monte Carlo denemesi için çekilmiş somut değerler. */
export interface MotorSample {
  readonly reactionTime: number;
  readonly jumpHeight: number;
  readonly hipHeight: number;
  readonly vmax: number;
  readonly tau: number;
}

export const G = 9.81;

// --- Tepki süresi -----------------------------------------------------------
// soni2013: genç grup (18–30, orta nokta 24) 501 ms, yaşlı grup (60–75, orta
// nokta 67,5) 721 ms. Aradaki yaşlar doğrusal; 24 yaş altı 501 ms'de sabit.
const REACTION_YOUNG = { age: 24, mean: 0.501 };
const REACTION_OLD = { age: 67.5, mean: 0.721 };
// VARSAYIM: bireyler arası değişkenlik CV = 0,25 (makalenin özetinde SD yok).
const REACTION_CV = 0.25;

// --- Sıçrama ----------------------------------------------------------------
// Model: itme kuvveti yağsız kütleyle orantılı (alotaibi2024),
//   F = k(yaş) · yağsız kütle,   h = d · (F / (m·g) − 1)
// d = itme mesafesi (çömelmeden kalkışa kadar ağırlık merkezinin yolu).
// VARSAYIM: d = 0,22 · boy.
const PUSH_OFF_PER_HEIGHT = 0.22;
// chms2021 ile kalibre: 20–39 yaş erkek 46 cm, kadın 32 cm. Tipik vücutlarla
// (E: 178 cm / 84 kg / %22, K: 164 cm / 70 kg / %33) her iki cinsiyet için de
// k ≈ 27,5 N/kg çıkıyor; yani cinsiyet farkı vücut kompozisyonundan geliyor.
const SPECIFIC_FORCE_N_PER_KG = 27.5;
// chms2021: 40–59 ve 60–79 yaş grupları 30 yaşından sonra yılda ~%0,45'lik
// kuvvet kaybıyla tutturuluyor. Yaşla artan yağ oranı da bu katsayının içinde
// olduğundan, yağ oranı verilen yaşlı bir profilde düşüş biraz abartılıyor olabilir.
const FORCE_DECLINE_PER_YEAR = 0.0045;
// VARSAYIM: aynı vücut tipindeki kişiler arası değişkenlik CV = 0,12.
const JUMP_CV = 0.12;

// --- Kalça yüksekliği ---------------------------------------------------------
// winter2009: kalça eklemi ≈ 0,530 · boy.
const HIP_PER_HEIGHT = 0.53;

// --- Koşu -------------------------------------------------------------------
// VARSAYIM: antrenmansız, %22 yağlı 30 yaş referans yetişkin vmax = 7,5 m/s
// (100 m ≈ 14–15 s). Hız yağsız kütle oranıyla ölçeklenir.
const VMAX_REF = 7.5;
const VMAX_REF_BODY_FAT = 0.22;
// korhonen2003: maksimum sprint hızı on yılda ~%5–7 düşer (usta sporcular).
// Antrenmansız kişilerde düşüş muhtemelen daha hızlı; üst sınırı alıyoruz.
const SPEED_DECLINE_PER_YEAR = 0.007;
// samozino2016 modeli; VARSAYIM: antrenmansız kişiler için τ = 1,2 s.
const SPRINT_TAU = 1.2;
// VARSAYIM: kişiler arası değişkenlik CV = 0,10.
const VMAX_CV = 0.1;

const AGE_DECLINE_START = 30;

export class BodyProfileError extends Error {}

/** Aralık dışı veya reşit olmayan profilleri reddeder (CLAUDE.md güvenlik kuralı). */
export function validateBody(body: BodyProfile): void {
  const problems: string[] = [];
  if (!(body.age >= 18)) problems.push(`yaş ${body.age}: reşit olmayan karakter kullanılamaz`);
  if (!(body.age <= 95)) problems.push(`yaş ${body.age}: model 95 yaş üstü için kalibre değil`);
  if (!(body.heightM >= 1.4 && body.heightM <= 2.2)) problems.push(`boy ${body.heightM} m aralık dışı`);
  if (!(body.massKg >= 35 && body.massKg <= 200)) problems.push(`kilo ${body.massKg} kg aralık dışı`);
  if (!(body.bodyFat >= 0.04 && body.bodyFat <= 0.6)) problems.push(`yağ oranı ${body.bodyFat} aralık dışı (0–1 kesir)`);
  if (problems.length > 0) throw new BodyProfileError(problems.join("; "));
}

export function leanMassKg(body: BodyProfile): number {
  return body.massKg * (1 - body.bodyFat);
}

function yearsPastPeak(age: number): number {
  return Math.max(0, age - AGE_DECLINE_START);
}

export function meanReactionTime(age: number): number {
  const slope = (REACTION_OLD.mean - REACTION_YOUNG.mean) / (REACTION_OLD.age - REACTION_YOUNG.age);
  return REACTION_YOUNG.mean + slope * Math.max(0, age - REACTION_YOUNG.age);
}

export function meanJumpHeight(body: BodyProfile): number {
  const k = SPECIFIC_FORCE_N_PER_KG * (1 - FORCE_DECLINE_PER_YEAR * yearsPastPeak(body.age));
  const relativeForce = (k * leanMassKg(body)) / (body.massKg * G);
  const pushOff = PUSH_OFF_PER_HEIGHT * body.heightM;
  // Kuvvet vücut ağırlığını aşamıyorsa sıçrama yok.
  return Math.max(0, pushOff * (relativeForce - 1));
}

export function meanVmax(body: BodyProfile): number {
  const composition = (1 - body.bodyFat) / (1 - VMAX_REF_BODY_FAT);
  const age = 1 - SPEED_DECLINE_PER_YEAR * yearsPastPeak(body.age);
  return VMAX_REF * composition * age;
}

export function motorCapacity(body: BodyProfile): MotorCapacity {
  validateBody(body);
  const reaction = meanReactionTime(body.age);
  const jump = meanJumpHeight(body);
  const vmax = meanVmax(body);
  return {
    reactionTime: { mean: reaction, sd: reaction * REACTION_CV },
    jumpHeight: { mean: jump, sd: jump * JUMP_CV },
    hipHeight: HIP_PER_HEIGHT * body.heightM,
    sprint: { vmax: { mean: vmax, sd: vmax * VMAX_CV }, tau: SPRINT_TAU },
  };
}

/**
 * Bir deneme için kapasite değerleri çeker. Her büyüklük kendi alt akışından
 * gelir; böylece birine dokunmak diğerlerinin değerlerini değiştirmez.
 */
export function sampleMotor(capacity: MotorCapacity, rng: Rng): MotorSample {
  const { reactionTime, jumpHeight, sprint } = capacity;
  return {
    reactionTime: rng.fork("reaction").lognormal(reactionTime.mean, reactionTime.sd),
    jumpHeight:
      jumpHeight.mean > 0 ? rng.fork("jump").lognormal(jumpHeight.mean, jumpHeight.sd) : 0,
    hipHeight: capacity.hipHeight,
    vmax: rng.fork("vmax").lognormal(sprint.vmax.mean, sprint.vmax.sd),
    tau: sprint.tau,
  };
}

/** Duruştan t saniyede koşulan mesafe (m). */
export function runDistance(vmax: number, tau: number, t: number): number {
  if (t <= 0) return 0;
  return vmax * (t - tau * (1 - Math.exp(-t / tau)));
}

/** Duruştan d metreyi koşmak için gereken süre (s); runDistance'ın tersi. */
export function timeToRun(vmax: number, tau: number, d: number): number {
  if (d <= 0) return 0;
  // runDistance(t) >= vmax·(t − τ) olduğundan kök [0, d/vmax + τ] içinde.
  let lo = 0;
  let hi = d / vmax + tau;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (runDistance(vmax, tau, mid) < d) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
