/**
 * results.json + trajectory/*.json -> out/<id>/short-props.json (Remotion --props).
 * Önce: npm run scenario -- median-crossing && npm run ragdoll
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildShortProps } from "../core/render/props.ts";
import type { ScenarioResults } from "../core/scenario/index.ts";
import { META, SHORT } from "../scenarios/median-crossing/scenario.ts";

const dir = join("out", META.id);
const results = JSON.parse(readFileSync(join(dir, "results.json"), "utf8")) as ScenarioResults;
const vehicle = SHORT.tableId.split(":")[1];
const trajectories = new Map(
  SHORT.attempts.map((a) => [
    `${a.characterId}/${a.strategyId}`,
    JSON.parse(readFileSync(join(dir, "trajectory", `${a.characterId}-${a.strategyId}-${vehicle}.json`), "utf8")),
  ]),
);
const props = buildShortProps(META, results, SHORT, trajectories);
writeFileSync(join(dir, "short-props.json"), JSON.stringify(props));
console.log(`${dir}/short-props.json: ${props.attempts.length} deneme, ${props.scoreboard.length} skor satırı`);
