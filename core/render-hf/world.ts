/**
 * HyperFrames için 3D sahne (tarayıcı girişi; esbuild ile tek dosyaya paketlenir).
 * Remotion'daki three/Scene.tsx'in düz three.js karşılığı. Poz ve zamanlama
 * mantığı Remotion sürümüyle ortak (sample.ts, timeline.ts).
 *
 * HyperFrames her karede `hf-seek` olayı gönderir; sahne yalnızca o anı çizer.
 * Duvar saati, requestAnimationFrame veya rastgelelik yok.
 */

import * as THREE from "three";
import type { Shape } from "../ragdoll/body.ts";
import type { Trajectory } from "../ragdoll/simulate.ts";
import { poseAt, smoothedTorso } from "../render/three/sample.ts";
import { attemptTime, FPS, HEIGHT, PLAY_FROM, WIDTH } from "../render/timeline.ts";

export interface WorldData {
  /** Denemeler sırayla; Hook ilk denemenin trajektorisini kullanır. */
  readonly trajectories: readonly Trajectory[];
  /** Hook'un bittiği, ilk denemenin başladığı saniye. */
  readonly hookEnd: number;
  /** Her denemenin süresi (s). */
  readonly attemptDuration: number;
}

declare global {
  interface Window {
    __SHORT_WORLD: WorldData;
    __hfThreeTime?: number;
    THREE?: unknown;
  }
}

const DUMMY_YELLOW = 0xf4c400;
const DUMMY_BLACK = 0x141414;

function std(color: number, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, ...extra });
}

function buildRoad(scene: THREE.Scene) {
  const plane = (w: number, h: number, color: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), std(color));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    scene.add(m);
  };
  plane(120, 60, 0x8d8f86, 0, 0, 0);
  plane(120, 11, 0x4b4d4f, 0, 0.002, 0);
  for (let i = 0; i < 9; i++) plane(3, 0.5, 0xe9e9e4, 1.2, 0.004, -4 + i);
  const median = new THREE.Mesh(new THREE.BoxGeometry(60, 0.16, 1.2), std(0x6f8f4e));
  median.position.set(-20, 0.08, -4.5);
  scene.add(median);
}

function buildCar(tr: Trajectory): THREE.Group {
  const { frontHull, rear, width } = tr.vehicle;
  const pts = [...frontHull.slice(0, -1), [rear.to, rear.height - 0.25] as const, [rear.to, 0.25] as const];
  const shape = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y)));
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 });
  body.translate(0, 0, -width / 2);

  const car = new THREE.Group();
  car.add(new THREE.Mesh(body, std(0x35507d, { metalness: 0.3, roughness: 0.45 })));

  const hoodRear = frontHull[frontHull.length - 4]!;
  const roofFront = frontHull[frontHull.length - 3]!;
  const dx = roofFront[0] - hoodRear[0];
  const dy = roofFront[1] - hoodRear[1];
  const glass = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dy) * 0.92, 0.03, width * 0.86), std(0x1d2733, { roughness: 0.15 }));
  glass.position.set((hoodRear[0] + roofFront[0]) / 2, (hoodRear[1] + roofFront[1]) / 2 + 0.03, 0);
  glass.rotation.z = Math.atan2(dy, dx);
  car.add(glass);

  for (const wx of [-0.85, rear.to + 0.9]) {
    for (const s of [-1, 1]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 20), std(0x1a1a1a));
      wheel.position.set(wx, 0.33, s * (width / 2 - 0.12));
      wheel.rotation.x = Math.PI / 2;
      car.add(wheel);
    }
  }
  return car;
}

function buildPart(shape: Shape): THREE.Group {
  const g = new THREE.Group();
  switch (shape.type) {
    case "box": {
      const [hx, hy, hz] = shape.halfExtents;
      g.add(new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), std(DUMMY_YELLOW, { roughness: 0.6 })));
      g.add(new THREE.Mesh(new THREE.BoxGeometry(hx * 2.04, 0.035, hz * 2.04), std(DUMMY_BLACK)));
      break;
    }
    case "capsule":
      g.add(new THREE.Mesh(new THREE.CapsuleGeometry(shape.radius, shape.halfHeight * 2, 6, 14), std(DUMMY_YELLOW, { roughness: 0.6 })));
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(shape.radius * 1.04, shape.radius * 1.04, 0.025, 14), std(DUMMY_BLACK)));
      break;
    case "ball": {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(shape.radius, 24, 16), std(DUMMY_YELLOW, { roughness: 0.5 })));
      // Crash-test işareti: iki yanda siyah çeyrek daireler
      for (const side of [1, -1]) {
        for (const start of [0, Math.PI]) {
          const q = new THREE.Mesh(new THREE.CircleGeometry(shape.radius * 0.6, 16, start, Math.PI / 2), std(DUMMY_BLACK, { side: THREE.DoubleSide }));
          q.position.z = side * shape.radius * 1.001;
          if (side < 0) q.rotation.y = Math.PI;
          g.add(q);
        }
      }
      break;
    }
  }
  return g;
}

/** Bileşim zamanı (s) -> hangi deneme ve trajektori zamanı (s). Remotion sürümüyle aynı eşleme. */
export function worldTime(time: number, data: WorldData): { index: number; t: number } {
  if (time < data.hookEnd) {
    // Hook: ilk 0,5 s sahne akar, sonra donar.
    return { index: 0, t: PLAY_FROM + Math.min(time, 0.5) };
  }
  const n = data.trajectories.length;
  const index = Math.min(n - 1, Math.floor((time - data.hookEnd) / data.attemptDuration + 1e-9));
  const frame = Math.round((time - data.hookEnd - index * data.attemptDuration) * FPS);
  return { index, t: attemptTime(frame, data.trajectories[index]!.duration) };
}

export function mountWorld(canvas: HTMLCanvasElement, data: WorldData): (time: number) => void {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xcfe0ee);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7a7a70, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(8, 12, 6);
  scene.add(sun);
  buildRoad(scene);

  // Her deneme kendi aracı ve kendi boyutlarındaki dummy'siyle; yalnızca o an oynayan görünür.
  const actors = data.trajectories.map((tr) => {
    const group = new THREE.Group();
    const car = buildCar(tr);
    group.add(car);
    const parts = tr.parts.map((p) => {
      const m = buildPart(p.shape);
      group.add(m);
      return m;
    });
    const torsoIdx = tr.parts.findIndex((p) => p.name === "torso");
    scene.add(group);
    return { tr, group, car, parts, startZ: tr.frames[0]!.parts[torsoIdx]![2]! };
  });

  const camera = new THREE.PerspectiveCamera(52, WIDTH / HEIGHT, 0.1, 200);

  return (time: number) => {
    const { index, t } = worldTime(time, data);
    actors.forEach((a, i) => (a.group.visible = i === index));
    const { tr, car, parts, startZ } = actors[index]!;
    const pose = poseAt(tr, t);
    car.position.x = pose.vehicleX;
    pose.parts.forEach((p, i) => {
      parts[i]!.position.copy(p.position);
      parts[i]!.quaternion.copy(p.quaternion);
    });
    // Kamera: Remotion sürümüyle aynı kural (yayanın arkasından araca doğru).
    const torso = smoothedTorso(tr, t);
    const back = Math.max(9, torso.x + 8.5);
    const rise = Math.max(0, torso.y - 1.2) * 0.5;
    const side = startZ + (torso.z - startZ) * 0.5;
    camera.position.set(back, 2.7 + rise, side + 1.4);
    camera.lookAt(back - 12, 1.0 + rise * 0.6, side);
    renderer.render(scene, camera);
  };
}

// Tarayıcıda: sahneyi kur, HyperFrames'in seek olaylarını dinle.
if (typeof window !== "undefined" && window.__SHORT_WORLD) {
  window.THREE = THREE; // Three adaptörünün yükleme yöneticisini bulabilmesi için
  const canvas = document.getElementById("world-canvas") as HTMLCanvasElement;
  const renderAt = mountWorld(canvas, window.__SHORT_WORLD);
  window.addEventListener("hf-seek", (e) => renderAt((e as CustomEvent<{ time: number }>).detail.time));
  renderAt(window.__hfThreeTime ?? 0);
}

