/** Ragdoll'un girdi/çıktı tipleri. Koordinatlar: x araç yönü, y yukarı, z yan (m). */

import type { BodyProfile } from "../dummies/model.ts";
import type { VehicleFront } from "../risk/model.ts";

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Ragdoll'a verilen hareket planı; tüm zamanlar fark etme anından itibaren (s). */
export interface MotionPlan {
  readonly body: BodyProfile;
  readonly vehicle: {
    readonly front: VehicleFront;
    readonly width: number;
    readonly speed: number;
    readonly deceleration: number;
    /** t = 0'da aracın ön yüzünün yayaya mesafesi (m). */
    readonly detectionDistance: number;
  };
  /** Yayanın başlangıç konumu; araç orta hattı z = 0. */
  readonly start: Vec3;
  /** Kinematik fazda başlangıca göre yer değiştirme (modelden). */
  readonly rootAt: (t: number) => Vec3;
  /** Modelin temas anı; null ise dummy hiç fiziğe bırakılmaz. */
  readonly contactTime: number | null;
  readonly duration: number;
}
