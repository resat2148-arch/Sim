/** Trajektoriden t anındaki pozu ara değerle okur (konum doğrusal, dönüş slerp). */

import { Quaternion, Vector3 } from "three";
import type { Trajectory } from "../../ragdoll/simulate.ts";

export interface PartPose {
  readonly position: Vector3;
  readonly quaternion: Quaternion;
}

export interface Pose {
  readonly vehicleX: number;
  readonly parts: readonly PartPose[];
}

export function poseAt(tr: Trajectory, t: number): Pose {
  const last = tr.frames.length - 1;
  const f = Math.min(Math.max(t * tr.fps, 0), last);
  const i = Math.min(Math.floor(f), last - 1 < 0 ? 0 : last - 1);
  const k = last === 0 ? 0 : f - i;
  const a = tr.frames[i]!;
  const b = tr.frames[Math.min(i + 1, last)]!;
  return {
    vehicleX: a.vehicleX + (b.vehicleX - a.vehicleX) * k,
    parts: a.parts.map((pa, j) => {
      const pb = b.parts[j]!;
      const position = new Vector3(pa[0], pa[1], pa[2]).lerp(new Vector3(pb[0], pb[1], pb[2]), k);
      const quaternion = new Quaternion(pa[3], pa[4], pa[5], pa[6]).slerp(new Quaternion(pb[3], pb[4], pb[5], pb[6]), k);
      return { position, quaternion };
    }),
  };
}

/** Kamera için yumuşatılmış gövde konumu: son 0,3 s'nin ortalaması (kareye bağlı, durumsuz). */
export function smoothedTorso(tr: Trajectory, t: number): Vector3 {
  const torso = tr.parts.findIndex((p) => p.name === "torso");
  const out = new Vector3();
  const n = 6;
  for (let s = 0; s < n; s++) out.add(poseAt(tr, Math.max(0, t - (s * 0.3) / (n - 1))).parts[torso]!.position);
  return out.divideScalar(n);
}
