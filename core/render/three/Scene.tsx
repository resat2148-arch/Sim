/**
 * Sahne: yol + yaya geçidi + refüj, araç, crash-test dummy. Tüm pozlar
 * trajectory.json'dan okunur; burada fizik çalışmaz (CLAUDE.md, kural 2).
 */

import { useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import { DoubleSide, ExtrudeGeometry, Shape as ThreeShape } from "three";
import type { Shape } from "../../ragdoll/body.ts";
import type { Trajectory } from "../../ragdoll/simulate.ts";
import { poseAt, smoothedTorso } from "./sample.ts";

const DUMMY_YELLOW = "#f4c400";
const DUMMY_BLACK = "#141414";
const CAR_BODY = "#35507d";
const GLASS = "#1d2733";

function Road() {
  const stripes = Array.from({ length: 9 }, (_, i) => -4 + i);
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[120, 60]} />
        <meshStandardMaterial color="#8d8f86" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
        <planeGeometry args={[120, 11]} />
        <meshStandardMaterial color="#4b4d4f" />
      </mesh>
      {stripes.map((z) => (
        <mesh key={z} rotation-x={-Math.PI / 2} position={[1.2, 0.004, z]}>
          <planeGeometry args={[3, 0.5]} />
          <meshStandardMaterial color="#e9e9e4" />
        </mesh>
      ))}
      {/* Refüj: aracın üzerinden geçtiği orta şerit */}
      <mesh position={[-20, 0.08, -4.5]}>
        <boxGeometry args={[60, 0.16, 1.2]} />
        <meshStandardMaterial color="#6f8f4e" />
      </mesh>
    </group>
  );
}

function Car({ tr, x }: { tr: Trajectory; x: number }) {
  const { frontHull, rear, width } = tr.vehicle;
  const geometry = useMemo(() => {
    // Ön profil (son nokta: −2,4 / tampon) yerine arka köşeler eklenir.
    const pts = [...frontHull.slice(0, -1), [rear.to, rear.height - 0.25] as const, [rear.to, 0.25] as const];
    const shape = new ThreeShape();
    pts.forEach(([px, py], i) => (i === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py)));
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
    g.translate(0, 0, -width / 2);
    return g;
  }, [frontHull, rear, width]);
  // Ön cam: kaput arkasından tavana.
  const hoodRear = frontHull[frontHull.length - 4]!;
  const roofFront = frontHull[frontHull.length - 3]!;
  const dx = roofFront[0] - hoodRear[0];
  const dy = roofFront[1] - hoodRear[1];
  const wheels = [-0.85, rear.to + 0.9].flatMap((wx) => [-1, 1].map((s) => [wx, 0.33, s * (width / 2 - 0.12)] as const));
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={CAR_BODY} metalness={0.3} roughness={0.45} />
      </mesh>
      <mesh
        position={[(hoodRear[0] + roofFront[0]) / 2, (hoodRear[1] + roofFront[1]) / 2 + 0.03, 0]}
        rotation-z={Math.atan2(dy, dx)}
      >
        <boxGeometry args={[Math.hypot(dx, dy) * 0.92, 0.03, width * 0.86]} />
        <meshStandardMaterial color={GLASS} roughness={0.15} />
      </mesh>
      {wheels.map(([wx, wy, wz], i) => (
        <mesh key={i} position={[wx, wy, wz]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.33, 0.33, 0.24, 20]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
    </group>
  );
}

function PartMesh({ shape }: { shape: Shape }) {
  switch (shape.type) {
    case "box":
      return (
        <group>
          <mesh>
            <boxGeometry args={shape.halfExtents.map((h) => h * 2) as [number, number, number]} />
            <meshStandardMaterial color={DUMMY_YELLOW} roughness={0.6} />
          </mesh>
          {/* Göğüs bandı */}
          <mesh>
            <boxGeometry args={[shape.halfExtents[0] * 2.04, 0.035, shape.halfExtents[2] * 2.04]} />
            <meshStandardMaterial color={DUMMY_BLACK} />
          </mesh>
        </group>
      );
    case "capsule":
      return (
        <group>
          <mesh>
            <capsuleGeometry args={[shape.radius, shape.halfHeight * 2, 6, 14]} />
            <meshStandardMaterial color={DUMMY_YELLOW} roughness={0.6} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[shape.radius * 1.04, shape.radius * 1.04, 0.025, 14]} />
            <meshStandardMaterial color={DUMMY_BLACK} />
          </mesh>
        </group>
      );
    case "ball":
      return (
        <group>
          <mesh>
            <sphereGeometry args={[shape.radius, 24, 16]} />
            <meshStandardMaterial color={DUMMY_YELLOW} roughness={0.5} />
          </mesh>
          {/* Crash-test işareti: iki yanda siyah çeyrek daireler */}
          {[1, -1].map((side) =>
            [0, Math.PI].map((start) => (
              <mesh key={`${side}-${start}`} position={[0, 0, side * shape.radius * 1.001]} rotation-y={side < 0 ? Math.PI : 0}>
                <circleGeometry args={[shape.radius * 0.6, 16, start, Math.PI / 2]} />
                <meshStandardMaterial color={DUMMY_BLACK} side={DoubleSide} />
              </mesh>
            )),
          )}
        </group>
      );
  }
}

function Camera({ tr, t }: { tr: Trajectory; t: number }) {
  const camera = useThree((s) => s.camera);
  const torso = smoothedTorso(tr, t);
  const startZ = tr.frames[0]!.parts[tr.parts.findIndex((p) => p.name === "torso")]![2]!;
  useLayoutEffect(() => {
    // Yayanın arkasından, araca doğru bakan dikey kadraj: araç izleyiciye doğru gelir.
    // Dummy fırlarsa kamera geri çekilir ve yükselir; yana kaçışta yanal olarak hafifçe izler.
    const back = Math.max(9, torso.x + 8.5);
    const rise = Math.max(0, torso.y - 1.2) * 0.5;
    const side = startZ + (torso.z - startZ) * 0.5;
    camera.position.set(back, 2.7 + rise, side + 1.4);
    camera.lookAt(back - 12, 1.0 + rise * 0.6, side);
    camera.updateProjectionMatrix();
  });
  return null;
}

export function Scene({ tr, t }: { tr: Trajectory; t: number }) {
  const pose = poseAt(tr, t);
  return (
    <>
      <color attach="background" args={["#cfe0ee"]} />
      <hemisphereLight args={["#ffffff", "#7a7a70", 1.1]} />
      <directionalLight position={[8, 12, 6]} intensity={1.6} />
      <Camera tr={tr} t={t} />
      <Road />
      <Car tr={tr} x={pose.vehicleX} />
      {tr.parts.map((part, i) => (
        <group key={part.name} position={pose.parts[i]!.position} quaternion={pose.parts[i]!.quaternion}>
          <PartMesh shape={part.shape} />
        </group>
      ))}
    </>
  );
}
