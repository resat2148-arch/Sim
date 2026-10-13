/**
 * Kullanım: npx tsx scripts/run-scenario.ts <senaryo-id> [--trials N] [--sensitivity-trials N] [--seed S]
 * Çıktı: out/<senaryo-id>/results.json (deterministik: aynı girdi, aynı dosya)
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { formatSourcesDe } from "../core/scenario/index.ts";
import { SCENARIOS } from "../scenarios/index.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    trials: { type: "string" },
    "sensitivity-trials": { type: "string" },
    seed: { type: "string" },
  },
});

const id = positionals[0];
const scenario = id ? SCENARIOS[id] : undefined;
if (!scenario) {
  console.error(`Kullanım: run-scenario <id>. Mevcut: ${Object.keys(SCENARIOS).join(", ")}`);
  process.exit(1);
}

const started = performance.now();
const results = scenario.run({
  ...(values.seed !== undefined && { seed: values.seed }),
  ...(values.trials !== undefined && { trials: Number(values.trials) }),
  ...(values["sensitivity-trials"] !== undefined && { sensitivityTrials: Number(values["sensitivity-trials"]) }),
});

const dir = join("out", scenario.META.id);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "results.json"), JSON.stringify(results, null, 2) + "\n");
writeFileSync(join(dir, "quellen.txt"), formatSourcesDe(scenario.META.sources) + "\n");
console.log(`${scenario.META.id}: ${((performance.now() - started) / 1000).toFixed(1)} s -> ${dir}/results.json`);
