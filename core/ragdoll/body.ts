/**
 * Crash-test dummy gövdesi: boy ve kiloya göre ölçeklenen 10 parça.
 * Oranlar: Winter 2009 (Drillis & Contini 1966 segment uzunlukları,
 * Dempster segment kütle oranları). Yalnızca görsel fizik için.
 */

import type { BodyProfile } from "../dummies/model.ts";

export type PartName =
  | "torso"
  | "head"
  | "upperArmL"
  | "upperArmR"
  | "forearmL"
  | "forearmR"
  | "thighL"
  | "thighR"
  | "shinL"
  | "shinR";

export type Shape =
  | { readonly type: "box"; readonly halfExtents: readonly [number, number, number] }
  | { readonly type: "capsule"; readonly halfHeight: number; readonly radius: number }
  | { readonly type: "ball"; readonly radius: number };

export interface Part {
  readonly name: PartName;
  readonly shape: Shape;
  readonly mass: number;
  /** Ayakta duruşta merkez konumu; ayakların ortası orijinde, yüz −x yönünde. */
  readonly center: readonly [number, number, number];
}

export type JointKind = "spherical" | "revolute";

export interface Joint {
  readonly kind: JointKind;
  readonly parent: PartName;
  readonly child: PartName;
  /** Eklemin dünya konumu (ayakta duruş). */
  readonly at: readonly [number, number, number];
}

// Winter 2009: boya oranla eklem yükseklikleri.
const KNEE = 0.285;
const HIP = 0.53;
const SHOULDER = 0.818;
const UPPER_ARM = 0.186;
const FOREARM_HAND = 0.146 + 0.06;
const SHOULDER_HALF_WIDTH = 0.129;
const HIP_HALF_WIDTH = 0.05;

// Dempster (Winter 2009 tablosu): segment kütlesi / toplam kütle.
const MASS = {
  head: 0.081,
  torso: 0.497,
  upperArm: 0.028,
  forearm: 0.022,
  thigh: 0.1,
  shin: 0.061,
} as const;

/** İki nokta arası dikey kapsül: yarı uzunluk ve merkez. */
function vertical(yTop: number, yBottom: number, radius: number) {
  const half = Math.max(0.01, (yTop - yBottom) / 2 - radius);
  return { halfHeight: half, centerY: (yTop + yBottom) / 2, radius };
}

export interface DummyBody {
  readonly parts: readonly Part[];
  readonly joints: readonly Joint[];
}

export function buildDummy(body: BodyProfile): DummyBody {
  const H = body.heightM;
  const M = body.massKg;
  // Kalın yapılı dummy biraz daha geniş görünsün: genişlik BMI ile hafifçe ölçeklenir.
  const girth = Math.min(1.35, Math.max(0.85, Math.sqrt(M / (H * H) / 22)));

  const knee = KNEE * H;
  const hip = HIP * H;
  const shoulder = SHOULDER * H;
  const headR = 0.065 * H;
  const headY = shoulder + 0.045 * H + headR;

  const shin = vertical(knee, 0, 0.026 * H);
  const thigh = vertical(hip, knee, 0.036 * H * girth);
  const upper = vertical(shoulder, shoulder - UPPER_ARM * H, 0.022 * H * girth);
  const fore = vertical(shoulder - UPPER_ARM * H, shoulder - (UPPER_ARM + FOREARM_HAND) * H, 0.019 * H);
  const armZ = SHOULDER_HALF_WIDTH * H + upper.radius * 0.6;

  const parts: Part[] = [
    {
      name: "torso",
      shape: { type: "box", halfExtents: [0.055 * H * girth, (shoulder - hip) / 2, 0.095 * H * girth] },
      mass: MASS.torso * M,
      center: [0, (shoulder + hip) / 2, 0],
    },
    { name: "head", shape: { type: "ball", radius: headR }, mass: MASS.head * M, center: [0, headY, 0] },
  ];
  for (const [side, sign] of [["L", -1], ["R", 1]] as const) {
    parts.push(
      { name: `upperArm${side}`, shape: { type: "capsule", halfHeight: upper.halfHeight, radius: upper.radius }, mass: MASS.upperArm * M, center: [0, upper.centerY, sign * armZ] },
      { name: `forearm${side}`, shape: { type: "capsule", halfHeight: fore.halfHeight, radius: fore.radius }, mass: MASS.forearm * M, center: [0, fore.centerY, sign * armZ] },
      { name: `thigh${side}`, shape: { type: "capsule", halfHeight: thigh.halfHeight, radius: thigh.radius }, mass: MASS.thigh * M, center: [0, thigh.centerY, sign * HIP_HALF_WIDTH * H * girth] },
      { name: `shin${side}`, shape: { type: "capsule", halfHeight: shin.halfHeight, radius: shin.radius }, mass: MASS.shin * M, center: [0, shin.centerY, sign * HIP_HALF_WIDTH * H * girth] },
    );
  }

  const joints: Joint[] = [{ kind: "spherical", parent: "torso", child: "head", at: [0, shoulder + 0.02 * H, 0] }];
  for (const [side, sign] of [["L", -1], ["R", 1]] as const) {
    const legZ = sign * HIP_HALF_WIDTH * H * girth;
    joints.push(
      { kind: "spherical", parent: "torso", child: `upperArm${side}`, at: [0, shoulder - upper.radius, sign * armZ] },
      { kind: "revolute", parent: `upperArm${side}`, child: `forearm${side}`, at: [0, shoulder - UPPER_ARM * H, sign * armZ] },
      { kind: "spherical", parent: "torso", child: `thigh${side}`, at: [0, hip, legZ] },
      { kind: "revolute", parent: `thigh${side}`, child: `shin${side}`, at: [0, knee, legZ] },
    );
  }
  return { parts, joints };
}

/** Araç profili (yandan, ön yüz x = 0'da, araç −x yönünde uzanır): [x, y] noktaları. */
export function vehicleProfile(front: { hoodEdgeHeight: number; shape: "sloped" | "blunt" }): {
  frontHull: [number, number][];
  rear: { from: number; to: number; height: number };
} {
  const h = front.hoodEdgeHeight;
  const roof = h + 0.7;
  const bumper = 0.25;
  const nose: [number, number][] =
    front.shape === "sloped" ? [[0, bumper], [0, h - 0.2], [-0.2, h]] : [[0, bumper], [0, h], [-0.08, h + 0.03]];
  const frontHull: [number, number][] = [...nose, [-1.3, h + 0.15], [-2.0, roof], [-2.4, roof], [-2.4, bumper]];
  return { frontHull, rear: { from: -2.4, to: -4.5, height: roof } };
}
