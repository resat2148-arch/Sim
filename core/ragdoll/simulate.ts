/**
 * Rapier ile headless ragdoll: bir örnek denemenin hareketini trajectory.json
 * olarak kaydeder. SADECE gösterim içindir (CLAUDE.md, kural 1): hiçbir
 * olasılık buradan çıkmaz.
 *
 * Akış: temas anına kadar dummy modelin hesapladığı yolu kinematik olarak
 * izler (zamanlama ve konum Monte Carlo ile birebir aynı). Temastan hemen
 * önce fiziğe bırakılır ve araç onu iter; slapstick buradan gelir.
 */

import RAPIER from "@dimforge/rapier3d-compat";
import { buildDummy, vehicleProfile, type PartName, type Shape } from "./body.ts";
import type { MotionPlan, Vec3 } from "./types.ts";

export const FPS = 30;
const PHYSICS_HZ = 240;
// Temastan bu kadar önce dummy fiziğe bırakılır (araç gövdeye girmeden önce).
const RELEASE_LEAD = 0.05;
const AFTER_IMPACT = 2.5;

const GROUP_GROUND = 0x0001;
const GROUP_DUMMY = 0x0002;
const GROUP_CAR = 0x0004;
const groups = (member: number, filter: number) => (member << 16) | filter;

export interface Trajectory {
  readonly note: string;
  readonly fps: number;
  readonly duration: number;
  /** Dummy'nin fiziğe bırakıldığı an (s); null = hiç bırakılmadı. */
  readonly releaseTime: number | null;
  readonly parts: readonly { readonly name: PartName; readonly shape: Shape }[];
  readonly vehicle: {
    readonly width: number;
    readonly frontHull: readonly (readonly [number, number])[];
    readonly rear: { readonly from: number; readonly to: number; readonly height: number };
  };
  /** Her kare: t, aracın ön yüzünün x'i, parça başına [x, y, z, qx, qy, qz, qw]. */
  readonly frames: readonly {
    readonly t: number;
    readonly vehicleX: number;
    readonly parts: readonly (readonly number[])[];
  }[];
}

let ready: Promise<void> | undefined;
function init(): Promise<void> {
  ready ??= RAPIER.init();
  return ready;
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

function colliderFor(shape: Shape): RAPIER.ColliderDesc {
  switch (shape.type) {
    case "box":
      return RAPIER.ColliderDesc.cuboid(...shape.halfExtents);
    case "capsule":
      return RAPIER.ColliderDesc.capsule(shape.halfHeight, shape.radius);
    case "ball":
      return RAPIER.ColliderDesc.ball(shape.radius);
  }
}

export async function simulateRagdoll(plan: MotionPlan): Promise<Trajectory> {
  await init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / PHYSICS_HZ;

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(60, 0.1, 30)
      .setTranslation(0, -0.1, 0)
      .setFriction(0.8)
      .setCollisionGroups(groups(GROUP_GROUND, GROUP_DUMMY)),
  );

  // Araç: kinematik, ön yüzü t = 0'da x = −detectionDistance.
  const { vehicle } = plan;
  const profile = vehicleProfile(vehicle.front);
  const car = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicVelocityBased().setTranslation(-vehicle.detectionDistance, 0, 0),
  );
  const half = vehicle.width / 2;
  const hullPoints = new Float32Array(profile.frontHull.flatMap(([x, y]) => [x, y, -half, x, y, half]));
  const hull = RAPIER.ColliderDesc.convexHull(hullPoints);
  if (!hull) throw new Error("Araç profili dışbükey değil");
  const carGroups = groups(GROUP_CAR, GROUP_DUMMY);
  world.createCollider(hull.setFriction(0.4).setCollisionGroups(carGroups), car);
  const rearLen = profile.rear.from - profile.rear.to;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(rearLen / 2, (profile.rear.height - 0.25) / 2, half)
      .setTranslation(profile.rear.from - rearLen / 2, (profile.rear.height + 0.25) / 2, 0)
      .setFriction(0.4)
      .setCollisionGroups(carGroups),
    car,
  );

  // Dummy: başta kinematik; parçalar birbirine çarpmaz, yalnızca zemine ve araca.
  const dummy = buildDummy(plan.body);
  const bodies = new Map<PartName, RAPIER.RigidBody>();
  for (const part of dummy.parts) {
    const [x, y, z] = part.center;
    const rb = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(plan.start.x + x, plan.start.y + y, plan.start.z + z)
        .setCcdEnabled(true)
        .setAngularDamping(0.6)
        .setLinearDamping(0.05),
    );
    world.createCollider(
      colliderFor(part.shape)
        .setMass(part.mass)
        .setFriction(0.7)
        .setRestitution(0.1)
        .setCollisionGroups(groups(GROUP_DUMMY, GROUP_GROUND | GROUP_CAR)),
      rb,
    );
    bodies.set(part.name, rb);
  }
  const centerOf = new Map(dummy.parts.map((p) => [p.name, p.center]));
  for (const j of dummy.joints) {
    const pc = centerOf.get(j.parent)!;
    const cc = centerOf.get(j.child)!;
    const a1 = { x: j.at[0] - pc[0], y: j.at[1] - pc[1], z: j.at[2] - pc[2] };
    const a2 = { x: j.at[0] - cc[0], y: j.at[1] - cc[1], z: j.at[2] - cc[2] };
    const data =
      j.kind === "spherical"
        ? RAPIER.JointData.spherical(a1, a2)
        : RAPIER.JointData.revolute(a1, a2, { x: 0, y: 0, z: 1 });
    if (j.kind === "revolute") {
      data.limitsEnabled = true;
      data.limits = [-2.4, 2.4];
    }
    world.createImpulseJoint(data, bodies.get(j.parent)!, bodies.get(j.child)!, true);
  }

  const releaseTime = plan.contactTime === null ? null : Math.max(0, plan.contactTime - RELEASE_LEAD);
  const endTime = (plan.contactTime ?? plan.duration - AFTER_IMPACT) + AFTER_IMPACT;
  const duration = Math.min(plan.duration, endTime);
  const stepsPerFrame = PHYSICS_HZ / FPS;
  const dt = 1 / PHYSICS_HZ;

  const frames: Trajectory["frames"][number][] = [];
  const record = (t: number) => {
    frames.push({
      t: r4(t),
      vehicleX: r4(car.translation().x),
      parts: dummy.parts.map((p) => {
        const b = bodies.get(p.name)!;
        const q = b.rotation();
        const v = b.translation();
        return [v.x, v.y, v.z, q.x, q.y, q.z, q.w].map(r4);
      }),
    });
  };

  let released = false;
  const totalSteps = Math.round(duration * PHYSICS_HZ);
  record(0);
  for (let step = 1; step <= totalSteps; step++) {
    const t = step * dt;
    const carSpeed = Math.max(0, vehicle.speed - vehicle.deceleration * t);
    car.setLinvel({ x: carSpeed, y: 0, z: 0 }, true);

    if (!released && releaseTime !== null && t >= releaseTime) {
      // Modelin o anki hızını (sonlu fark) fiziğe devret.
      const a = plan.rootAt(t - dt);
      const b = plan.rootAt(t);
      const v: Vec3 = { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt, z: (b.z - a.z) / dt };
      for (const rb of bodies.values()) {
        rb.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
        rb.setLinvel(v, true);
      }
      released = true;
    }
    if (!released) {
      const d = plan.rootAt(t);
      for (const part of dummy.parts) {
        const [x, y, z] = part.center;
        bodies.get(part.name)!.setNextKinematicTranslation({
          x: plan.start.x + x + d.x,
          y: plan.start.y + y + d.y,
          z: plan.start.z + z + d.z,
        });
      }
    }
    world.step();
    if (step % stepsPerFrame === 0) record(t);
  }
  world.free();

  return {
    note: "Nur Darstellung: Ragdoll-Physik liefert keine Zahlen. Wahrscheinlichkeiten stammen aus dem Monte-Carlo-Modell.",
    fps: FPS,
    duration: r4(duration),
    releaseTime: releaseTime === null ? null : r4(releaseTime),
    parts: dummy.parts.map((p) => ({ name: p.name, shape: p.shape })),
    vehicle: { width: vehicle.width, frontHull: profile.frontHull, rear: profile.rear },
    frames,
  };
}
