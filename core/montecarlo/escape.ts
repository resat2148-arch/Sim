/**
 * Zaman bütçesi kaçış modeli.
 *
 *   çarpmaya kalan süre − tepki süresi = hareket için kalan süre
 *
 * Geometri: araç x ekseni boyunca yayaya doğru gelir. `offset`, yaya
 * merkezinin araç orta hattına yanal uzaklığıdır (m, işaretli). Araç ~1,8 m
 * genişliğinde olduğundan üstünden aşmak mümkün değildir; hareketler yalnızca
 * yanal konumu (yana kaçış) veya çarpma anındaki kalça yüksekliğini
 * (kaputa sıçrama) değiştirir. Hangi sonucun ne kadar tehlikeli olduğu
 * core/risk'in işidir; burası yalnızca temas olup olmadığını ve temasın
 * geometrisini hesaplar.
 */

import type { Rng } from "../random/index.ts";
import { G, runDistance, type MotorSample } from "../dummies/model.ts";

export interface Approach {
  /** Fark edildiği andaki araç hızı (m/s). */
  readonly speed: number;
  /** Yayanın aracı fark ettiği andaki mesafe (m). */
  readonly detectionDistance: number;
  /** Frenleme yavaşlaması (m/s²); 0 = fren yok (refüjü atlayan araçta varsayılan). */
  readonly deceleration?: number;
}

export type ApproachTiming =
  | { readonly impact: true; readonly timeToImpact: number; readonly impactSpeed: number }
  | { readonly impact: false; readonly stopTime: number };

/** Aracın yayaya ulaşma süresi ve çarpma hızı. */
export function approachTiming({ speed, detectionDistance, deceleration = 0 }: Approach): ApproachTiming {
  if (!(speed > 0) || !(detectionDistance >= 0) || !(deceleration >= 0)) {
    throw new RangeError(`approachTiming: speed=${speed}, distance=${detectionDistance}, decel=${deceleration}`);
  }
  if (deceleration === 0) {
    return { impact: true, timeToImpact: detectionDistance / speed, impactSpeed: speed };
  }
  const stoppingDistance = (speed * speed) / (2 * deceleration);
  if (stoppingDistance <= detectionDistance) {
    return { impact: false, stopTime: speed / deceleration };
  }
  const impactSpeed = Math.sqrt(speed * speed - 2 * deceleration * detectionDistance);
  return { impact: true, timeToImpact: (speed - impactSpeed) / deceleration, impactSpeed };
}

/** Tepkiden sonra hareket için kalan süre (s); tepki çarpmadan sonraysa 0. */
export function movementBudget(timeToImpact: number, reactionTime: number): number {
  return Math.max(0, timeToImpact - reactionTime);
}

// --- Yana kaçış -------------------------------------------------------------

// VARSAYIM: yana hareket, ileri koşunun %80 verimiyle (dönüş + yan adım).
// Kontrol: genç bir dummy bununla 715 ms'de ~1,2 m yana gider; bu, Soni et
// al. 2013'teki iki adımlık reaktif yana kaçış hareketiyle tutarlı.
export const LATERAL_EFFICIENCY = 0.8;

// winter2009: omuz genişliği ≈ 0,259 · boy -> yarı genişlik ≈ 0,13 · boy.
export const BODY_HALF_WIDTH_PER_HEIGHT = 0.13;

export function bodyHalfWidth(heightM: number): number {
  return BODY_HALF_WIDTH_PER_HEIGHT * heightM;
}

/** t saniyede yana alınan yol (m). */
export function lateralDisplacement(motor: Pick<MotorSample, "vmax" | "tau">, t: number): number {
  return runDistance(motor.vmax * LATERAL_EFFICIENCY, motor.tau, t);
}

export interface LateralContact {
  /** Çarpma anında yaya merkezinin araç orta hattına uzaklığı (m, işaretli). */
  readonly finalOffset: number;
  /**
   * Gövde ile araç önünün yanal örtüşmesi (m). > 0 ise temas var;
   * küçük değerler sıyırma, büyük değerler tam önden çarpma demektir.
   */
  readonly overlap: number;
  readonly contact: boolean;
}

export function lateralContact(offset: number, vehicleWidth: number, halfBody: number): LateralContact {
  const overlap = vehicleWidth / 2 + halfBody - Math.abs(offset);
  return { finalOffset: offset, overlap, contact: overlap > 0 };
}

export interface LateralEscapeInput {
  readonly offset: number;
  /** +1 veya −1: hangi yöne kaçıldığı. Yanlış yön araca doğru koşmaktır. */
  readonly direction: 1 | -1;
  readonly movementTime: number;
  readonly motor: Pick<MotorSample, "vmax" | "tau">;
  readonly vehicleWidth: number;
  readonly halfBody: number;
}

export function lateralEscape(input: LateralEscapeInput): LateralContact {
  const moved = lateralDisplacement(input.motor, input.movementTime);
  return lateralContact(input.offset + input.direction * moved, input.vehicleWidth, input.halfBody);
}

// --- Kaputa sıçrama -----------------------------------------------------------

// VARSAYIM: reaktif sıçramada çömelme + itme süresi (harekete başlamadan kalkışa).
export const JUMP_PREP_TIME = 0.45;
// VARSAYIM: kalkış zamanlamasındaki hata (std sapma, s).
export const JUMP_TIMING_SD = 0.1;

export interface JumpInput {
  readonly movementTime: number;
  readonly jumpHeight: number;
  readonly rng: Rng;
  readonly timingSd?: number;
}

/**
 * Çarpma anında kalçanın ayakta duruşa göre ne kadar yükseldiği (m).
 *
 * Kişi zirveyi çarpma anına denk getirmeye çalışır ama fiziksel olarak
 * JUMP_PREP_TIME'dan önce kalkamaz. Çarpma kalkıştan önce ya da inişten
 * sonra olursa yükselme 0'dır (yüksek zaman bütçesinde erken zıplayıp
 * araca yere inmişken yakalanmak da mümkündür).
 */
export function hipRiseAtImpact({ movementTime, jumpHeight, rng, timingSd = JUMP_TIMING_SD }: JumpInput): number {
  if (jumpHeight <= 0 || movementTime < JUMP_PREP_TIME) return 0;
  const v0 = Math.sqrt(2 * G * jumpHeight);
  const tApex = v0 / G;
  const intended = movementTime - tApex + rng.normal(0, timingSd);
  const takeoff = Math.max(JUMP_PREP_TIME, intended);
  const s = movementTime - takeoff;
  if (s <= 0 || s >= 2 * tApex) return 0;
  return v0 * s - (G * s * s) / 2;
}

/** Gövdenin araç yolunda kalan oranı (0–1): örtüşme / gövde genişliği. */
export function bodyInPath(contact: LateralContact, halfBody: number): number {
  return Math.min(1, Math.max(0, contact.overlap / (2 * halfBody)));
}

// --- Yol boyunca kaçış (geri çekilme) ---------------------------------------

/** Aracın t anında aldığı yol (m); frenle durduktan sonra sabit kalır. */
export function vehiclePosition({ speed, deceleration = 0 }: Approach, t: number): number {
  if (deceleration === 0) return speed * t;
  const tStop = speed / deceleration;
  const s = Math.min(t, tStop);
  return speed * s - (deceleration * s * s) / 2;
}

export type PursuitResult =
  | { readonly impact: true; readonly timeToImpact: number; readonly relativeSpeed: number }
  | { readonly impact: false };

const PURSUIT_HORIZON = 10;

/**
 * Yaya aracın geliş doğrultusunda ondan uzağa kaçar (geri çekilir / koşar).
 * Araç yayaya yetişirse çarpma hızı, araç hızı ile yaya hızının farkıdır.
 * Yön değiştirme maliyeti yana kaçışla aynı kabul edilir (LATERAL_EFFICIENCY).
 */
export function pursuit(
  approach: Approach,
  reactionTime: number,
  motor: Pick<MotorSample, "vmax" | "tau">,
): PursuitResult {
  const { speed, detectionDistance, deceleration = 0 } = approach;
  const vmax = motor.vmax * LATERAL_EFFICIENCY;
  const gap = (t: number) =>
    detectionDistance + runDistance(vmax, motor.tau, t - reactionTime) - vehiclePosition(approach, t);
  const pedSpeed = (t: number) => (t <= reactionTime ? 0 : vmax * (1 - Math.exp(-(t - reactionTime) / motor.tau)));
  const carSpeed = (t: number) => Math.max(0, speed - deceleration * t);

  // Aralık kapanıyorsa ilk sıfır geçişini adım adım ara, sonra ikiye bölerek incelt.
  const dt = 0.01;
  let prev = 0;
  for (let t = dt; t <= PURSUIT_HORIZON; t += dt) {
    if (gap(t) <= 0) {
      let lo = prev;
      let hi = t;
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (gap(mid) > 0) lo = mid;
        else hi = mid;
      }
      return { impact: true, timeToImpact: hi, relativeSpeed: Math.max(0, carSpeed(hi) - pedSpeed(hi)) };
    }
    prev = t;
  }
  return { impact: false };
}
