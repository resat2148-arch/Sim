/**
 * Kullanım:
 *   npx tsx scripts/ragdoll.ts                       # tüm dummy × (stehen, ausweichen, springen), sedan
 *   npx tsx scripts/ragdoll.ts --character kurt --strategy springen [--vehicle suv] [--trial 17]
 * Çıktı: out/median-crossing/trajectory/<karakter>-<hareket>-<araç>.json
 * Ragdoll yalnızca gösterimdir; dosyadaki modelOutcome Monte Carlo modelinden gelir.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { CAST } from "../core/dummies/index.ts";
import { simulateRagdoll } from "../core/ragdoll/index.ts";
import { META, sampleForRagdoll, type StrategyId, type VehicleId } from "../scenarios/median-crossing/scenario.ts";

const { values } = parseArgs({
  options: {
    character: { type: "string" },
    strategy: { type: "string" },
    vehicle: { type: "string" },
    trial: { type: "string" },
  },
});

const vehicle = (values.vehicle ?? "limousine") as VehicleId;
const jobs: { characterId: string; strategy: StrategyId }[] =
  values.character && values.strategy
    ? [{ characterId: values.character, strategy: values.strategy as StrategyId }]
    : CAST.flatMap((c) => (["stehen", "ausweichen", "springen"] as const).map((strategy) => ({ characterId: c.id, strategy })));

const dir = join("out", META.id, "trajectory");
mkdirSync(dir, { recursive: true });

for (const job of jobs) {
  const { trial, plan, motion } = sampleForRagdoll({
    ...job,
    vehicle,
    ...(values.trial !== undefined && { trial: Number(values.trial) }),
  });
  const trajectory = await simulateRagdoll(motion);
  const file = join(dir, `${job.characterId}-${job.strategy}-${vehicle}.json`);
  writeFileSync(
    file,
    JSON.stringify({
      scenarioId: META.id,
      characterId: job.characterId,
      strategyId: job.strategy,
      move: plan.move,
      vehicleId: vehicle,
      trial,
      modelOutcome: { contact: plan.outcome.contact, contactTime: plan.contactTime, reactionTime: plan.reactionTime, fatal: plan.outcome.fatal },
      ...trajectory,
    }) + "\n",
  );
  console.log(`${file}  deneme ${trial}, ${plan.outcome.contact ? "temas" : "kaçtı"}, ${trajectory.frames.length} kare`);
}
