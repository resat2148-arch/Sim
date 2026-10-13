import { describe, expect, it } from "vitest";
import { getCharacter } from "../dummies/index.ts";
import { buildDummy, vehicleProfile } from "./body.ts";
import { simulateRagdoll } from "./simulate.ts";
import type { MotionPlan } from "./types.ts";

const kurt = getCharacter("kurt").body;

describe("buildDummy", () => {
  const d = buildDummy(kurt);

  it("parça kütleleri toplam kiloya eşit (Dempster oranları)", () => {
    expect(d.parts.reduce((s, p) => s + p.mass, 0)).toBeCloseTo(kurt.massKg, 6);
  });

  it("baş üstü yaklaşık boy kadar yüksekte", () => {
    const head = d.parts.find((p) => p.name === "head")!;
    const top = head.center[1] + (head.shape.type === "ball" ? head.shape.radius : 0);
    expect(top).toBeCloseTo(kurt.heightM, 1);
  });

  it("her eklem iki farklı ve var olan parçayı bağlar", () => {
    const names = new Set(d.parts.map((p) => p.name));
    for (const j of d.joints) {
      expect(names.has(j.parent) && names.has(j.child)).toBe(true);
      expect(j.parent).not.toBe(j.child);
    }
    expect(d.joints).toHaveLength(d.parts.length - 1); // ağaç yapısı
  });
});

describe("vehicleProfile", () => {
  it("ön kenar yüksekliği risk modelindeki değerle aynı", () => {
    for (const front of [{ hoodEdgeHeight: 0.75, shape: "sloped" }, { hoodEdgeHeight: 1.05, shape: "blunt" }] as const) {
      const p = vehicleProfile(front);
      const edge = p.frontHull.filter(([x]) => x > -0.3).map(([, y]) => y);
      expect(Math.max(...edge)).toBeGreaterThanOrEqual(front.hoodEdgeHeight);
      expect(Math.max(...edge)).toBeLessThan(front.hoodEdgeHeight + 0.05);
    }
  });
});

describe("simulateRagdoll", () => {
  const base: MotionPlan = {
    body: kurt,
    vehicle: { front: { hoodEdgeHeight: 0.75, shape: "sloped" }, width: 1.8, speed: 13.9, deceleration: 0, detectionDistance: 15 },
    start: { x: 0, y: 0, z: 0.3 },
    rootAt: (t) => ({ x: 0, y: 0, z: Math.max(0, t - 0.5) }),
    contactTime: 15 / 13.9,
    duration: 4,
  };

  it("deterministik: aynı plan, aynı trajektori", async () => {
    expect(await simulateRagdoll(base)).toEqual(await simulateRagdoll(base));
  });

  it("temasa kadar dummy modelin yolunu birebir izler (sayılar ragdoll'dan çıkmaz)", async () => {
    const tr = await simulateRagdoll(base);
    const torso = tr.parts.findIndex((p) => p.name === "torso");
    const center = buildDummy(kurt).parts.find((p) => p.name === "torso")!.center;
    for (const f of tr.frames.filter((f) => f.t < tr.releaseTime!)) {
      const [x, y, z] = f.parts[torso]!;
      expect(x).toBeCloseTo(base.start.x + center[0], 3);
      expect(y).toBeCloseTo(base.start.y + center[1], 3);
      expect(z).toBeCloseTo(base.start.z + center[2] + base.rootAt(f.t).z, 3);
    }
  });

  it("temasta araç dummy'yi ileri iter; sonuçlar sonlu", async () => {
    const tr = await simulateRagdoll(base);
    const torso = tr.parts.findIndex((p) => p.name === "torso");
    const last = tr.frames.at(-1)!.parts[torso]!;
    expect(tr.frames.every((f) => f.parts.flat().every(Number.isFinite))).toBe(true);
    expect(last[0]).toBeGreaterThan(5);
  });

  it("temas yoksa dummy hiç fiziğe bırakılmaz", async () => {
    const tr = await simulateRagdoll({ ...base, start: { x: 0, y: 0, z: 3 }, contactTime: null });
    expect(tr.releaseTime).toBeNull();
    const torso = tr.parts.findIndex((p) => p.name === "torso");
    expect(tr.frames.at(-1)!.parts[torso]![0]).toBeCloseTo(0, 3);
  });
});
