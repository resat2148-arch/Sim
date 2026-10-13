/**
 * Senaryo: karşı şeritten bir araba refüjü atlayıp yayaya doğru geliyor.
 * Zıplamak mı, yana kaçmak mı?
 *
 * Bu dosya yalnızca senaryoya özgü olanı tanımlar (ortam, araçlar,
 * hareketler, davranış karışımı); fizik ve risk core/'dan gelir.
 */

import { CAST, DUMMY_SOURCES, motorCapacity, sampleMotor, type DummyCharacter } from "../../core/dummies/index.ts";
import {
  approachTiming,
  bodyHalfWidth,
  bodyInPath,
  compareStrategies,
  DEFAULT_TRIALS,
  hipRiseAtImpact,
  lateralContact,
  lateralEscape,
  movementBudget,
  pursuit,
  type TrialContext,
} from "../../core/montecarlo/index.ts";
import { impactRisk, NO_CONTACT_RISK, RISK_SOURCES, type VehicleFront } from "../../core/risk/index.ts";
import {
  summarizeOutcomes,
  validateScenarioMeta,
  type ResultTable,
  type ScenarioMeta,
  type ScenarioResults,
  type TrialOutcome,
} from "../../core/scenario/index.ts";
import { kmhToMs } from "../../core/units/index.ts";
import type { ReportConfig } from "../../core/report/index.ts";

export const META: ScenarioMeta = {
  id: "median-crossing",
  titleDe: "Auto kommt über den Mittelstreifen",
  hookQuestionDe: "Springen oder ausweichen?",
  // Kullanıcı onayladı. Model bulgusu: zaman bütçesi hareketten daha belirleyici.
  lessonDe: "Am Straßenrand: Augen hoch statt aufs Handy – und im Notfall sofort zur Seite.",
  sources: [...Object.values(DUMMY_SOURCES), ...Object.values(RISK_SOURCES)],
};
validateScenarioMeta(META);

export const STRATEGIES = [
  { id: "stehen", labelDe: "Stehen bleiben", inVideo: true },
  { id: "ausweichen", labelDe: "Zur Seite", inVideo: true },
  // Kullanıcı kararı: raporda kalır, Short'ta gösterilmez (model iyimser olabilir).
  { id: "zurueck", labelDe: "Zurückweichen", inVideo: false },
  { id: "springen", labelDe: "Springen", inVideo: true },
  { id: "realitaet", labelDe: "Was Menschen wirklich tun", inVideo: true },
] as const;
export type StrategyId = (typeof STRATEGIES)[number]["id"];
type Move = Exclude<StrategyId, "realitaet">;

// VARSAYIM: tipik ön kenar yükseklikleri; IIHS 2023 sınıflarına denk gelecek şekilde.
export const VEHICLES = {
  limousine: { labelDe: "Limousine", front: { hoodEdgeHeight: 0.75, shape: "sloped" } },
  suv: { labelDe: "SUV", front: { hoodEdgeHeight: 1.05, shape: "blunt" } },
} as const satisfies Record<string, { labelDe: string; front: VehicleFront }>;
export type VehicleId = keyof typeof VEHICLES;

export interface Conditions {
  readonly speedKmh: number;
  readonly detectionDistance: number;
  /** Refüjü atlayan sürücü kontrolü kaybetmiştir: varsayılan fren yok. */
  readonly deceleration: number;
  readonly vehicle: VehicleId;
}

/** CLAUDE.md'deki hikâye: 50 km/h, 15 m'de fark ediliyor. */
export const BASE_CONDITIONS: Conditions = { speedKmh: 50, detectionDistance: 15, deceleration: 0, vehicle: "limousine" };

const VEHICLE_WIDTH = 1.8;
// VARSAYIM: geri çekilmede arkasını dönmenin ek süresi (180° dönüş, s).
export const TURN_TIME = 0.4;
// VARSAYIM: araç yayaya doğru gelir; orta hattı yayanın ±1,2 m'si içinde (düzgün).
const AIM_SPREAD = 1.2;

const dec = (x: number) => String(x).replace(".", ",");

export const ASSUMPTIONS = [
  `Geri çekilmede arkasını dönmek ${dec(TURN_TIME)} s ek süre alıyor; arkadan çarpılmanın duruş etkisi modellenmedi. Bu hareket videoda gösterilmez.`,
  "Araç frenlemiyor (sürücü kontrolü kaybetmiş); hız ve fark etme mesafesi her denemede sabit.",
  `Aracın orta hattı yayanın ±${dec(AIM_SPREAD)} m'si içinde, düzgün dağılımlı; araç ${dec(VEHICLE_WIDTH)} m genişliğinde.`,
  "Yana kaçışta doğru yönü seçme olasılığı: araç orta hattına göre ne kadar kenardaysa o kadar yüksek (ortada %50).",
  "Sedan ön kenarı 0,75 m (eğimli), SUV ön kenarı 1,05 m (küt).",
  "Gerçek davranış karışımı Soni et al. 2013'ten: gençler %60 kaçış; yaşlılar %40 kaçış, %38 donma, %22 geri çekilme. Gençlerde donma/geri çekilme 20/20 varsayıldı.",
  "Zıplama, kaputa çıkıldığında yüksek önün ek riskini kaldırır; araç altına girme ayrıca modellenmedi.",
] as const;

/** Soni et al. 2013 davranış dağılımı, yaşla doğrusal ara değer. */
export function behaviorMix(age: number): Record<"ausweichen" | "stehen" | "zurueck", number> {
  const young = { ausweichen: 0.6, stehen: 0.2, zurueck: 0.2 };
  const old = { ausweichen: 0.4, stehen: 0.38, zurueck: 0.22 };
  const w = Math.min(1, Math.max(0, (age - 24) / (67.5 - 24)));
  return {
    ausweichen: young.ausweichen + w * (old.ausweichen - young.ausweichen),
    stehen: young.stehen + w * (old.stehen - young.stehen),
    zurueck: young.zurueck + w * (old.zurueck - young.zurueck),
  };
}

function pickBehavior(age: number, u: number): Move {
  const mix = behaviorMix(age);
  if (u < mix.ausweichen) return "ausweichen";
  if (u < mix.ausweichen + mix.stehen) return "stehen";
  return "zurueck";
}

/** Tek deneme: aynı ctx tüm hareketlerde aynı dummy örneğini ve aynı araç yolunu verir. */
export function simulateTrial(ctx: TrialContext, character: DummyCharacter, strategy: StrategyId, cond: Conditions): TrialOutcome {
  const { body } = character;
  const motor = sampleMotor(motorCapacity(body), ctx.rng);
  const half = bodyHalfWidth(body.heightM);
  const front = VEHICLES[cond.vehicle].front;
  const offset = ctx.rng.fork("aim").uniform(-AIM_SPREAD, AIM_SPREAD);
  const approach = { speed: kmhToMs(cond.speedKmh), detectionDistance: cond.detectionDistance, deceleration: cond.deceleration };

  const move: Move =
    strategy === "realitaet" ? pickBehavior(body.age, ctx.rng.fork("behavior").next()) : strategy;

  const hit = (impactSpeed: number, contact: ReturnType<typeof lateralContact>, hipAtImpact: number): TrialOutcome => {
    if (!contact.contact) return { contact: false, ...NO_CONTACT_RISK };
    const risk = impactRisk({ impactSpeed, age: body.age, front, hipAtImpact, bodyInPath: bodyInPath(contact, half) });
    return { contact: true, severe: risk.severe, fatal: risk.fatal };
  };

  const standing = lateralContact(offset, VEHICLE_WIDTH, half);

  if (move === "zurueck") {
    const p = pursuit(approach, motor.reactionTime + TURN_TIME, motor);
    if (!p.impact) return { contact: false, ...NO_CONTACT_RISK };
    return hit(p.relativeSpeed, standing, motor.hipHeight);
  }

  const timing = approachTiming(approach);
  if (!timing.impact) return { contact: false, ...NO_CONTACT_RISK };
  const movementTime = movementBudget(timing.timeToImpact, motor.reactionTime);

  switch (move) {
    case "stehen":
      return hit(timing.impactSpeed, standing, motor.hipHeight);
    case "ausweichen": {
      const sideways = offset >= 0 ? 1 : -1;
      const pCorrect = 0.5 + 0.5 * Math.min(1, Math.abs(offset) / (VEHICLE_WIDTH / 2));
      const direction = ctx.rng.fork("direction").bernoulli(pCorrect) ? sideways : (-sideways as 1 | -1);
      const contact = lateralEscape({ offset, direction, movementTime, motor, vehicleWidth: VEHICLE_WIDTH, halfBody: half });
      return hit(timing.impactSpeed, contact, motor.hipHeight);
    }
    case "springen": {
      const rise = hipRiseAtImpact({ movementTime, jumpHeight: motor.jumpHeight, rng: ctx.rng.fork("jump-timing") });
      return hit(timing.impactSpeed, standing, motor.hipHeight + rise);
    }
  }
}

function runTable(
  id: string,
  labelDe: string,
  cond: Conditions,
  seed: string,
  trials: number,
  characters: readonly DummyCharacter[],
  strategies: readonly StrategyId[],
): ResultTable {
  const cells = characters.flatMap((character) => {
    const runners = Object.fromEntries(
      strategies.map((s) => [s, (ctx: TrialContext) => simulateTrial(ctx, character, s, cond)]),
    ) as Record<StrategyId, (ctx: TrialContext) => TrialOutcome>;
    // Seed karaktere göre değil: aynı deneme numarası her karakterde aynı araç yolunu verir.
    const out = compareStrategies(seed, runners, trials);
    return strategies.map((s) => ({ characterId: character.id, strategyId: s, summary: summarizeOutcomes(out[s]) }));
  });
  return { id, labelDe, parameters: { ...cond, trials }, cells };
}

export interface RunOptions {
  readonly seed?: string;
  readonly trials?: number;
  /** Duyarlılık taramalarındaki deneme sayısı (varsayılan: trials). */
  readonly sensitivityTrials?: number;
  readonly characters?: readonly DummyCharacter[];
}

export const DETECTION_SWEEP = [8, 10, 15, 20, 25, 30] as const;
export const SPEED_SWEEP = [30, 40, 50, 60] as const;

export function run(options: RunOptions = {}): ScenarioResults {
  const seed = options.seed ?? META.id;
  const trials = options.trials ?? DEFAULT_TRIALS;
  const sTrials = options.sensitivityTrials ?? trials;
  const characters = options.characters ?? CAST;
  const all = STRATEGIES.map((s) => s.id);

  const tables = (Object.keys(VEHICLES) as VehicleId[]).map((vehicle) =>
    runTable(`vehicle:${vehicle}`, VEHICLES[vehicle].labelDe, { ...BASE_CONDITIONS, vehicle }, seed, trials, characters, all),
  );
  const sensitivity = [
    ...DETECTION_SWEEP.map((d) =>
      runTable(`detection:${d}`, `Bemerkt bei ${d} m`, { ...BASE_CONDITIONS, detectionDistance: d }, seed, sTrials, characters, all),
    ),
    ...SPEED_SWEEP.map((v) =>
      runTable(`speed:${v}`, `${v} km/h`, { ...BASE_CONDITIONS, speedKmh: v }, seed, sTrials, characters, all),
    ),
  ];

  return {
    scenarioId: META.id,
    seed,
    trials,
    characters: characters.map((c) => ({ id: c.id, nameDe: c.nameDe })),
    strategies: STRATEGIES.map((s) => ({ id: s.id, labelDe: s.labelDe, inVideo: s.inVideo })),
    tables,
    sensitivity,
    assumptions: [...ASSUMPTIONS],
  };
}

export const REPORT: ReportConfig = {
  describeTable: (t) =>
    `${t.parameters.speedKmh} km/h, ${t.parameters.detectionDistance} m mesafede fark ediliyor (≈ ${(
      Number(t.parameters.detectionDistance) / kmhToMs(Number(t.parameters.speedKmh))
    )
      .toFixed(1)
      .replace(".", ",")} s), fren yok. Dummy ve hareket başına ${Number(t.parameters.trials).toLocaleString("de-DE")} deneme.`,
  sweeps: [
    {
      prefix: "detection",
      param: "detectionDistance",
      strategyId: "ausweichen",
      metric: "contact",
      title: "Zaman her şey: araca temas oranı",
      subtitle: "50 km/h; aracın fark edildiği mesafe değişiyor. Erken fark etmek = hareket için daha çok zaman.",
      xLabel: "Fark etme mesafesi",
      xUnit: "m",
      marker: { x: BASE_CONDITIONS.detectionDistance, label: "Senaryo" },
    },
    {
      prefix: "detection",
      param: "detectionDistance",
      strategyId: "realitaet",
      metric: "fatal",
      title: "Erken fark etmek: gerçek davranışta ölüm riski",
      subtitle: "50 km/h; insanların gerçekte yaptığı karışım (Soni et al. 2013).",
      xLabel: "Fark etme mesafesi",
      xUnit: "m",
      marker: { x: BASE_CONDITIONS.detectionDistance, label: "Senaryo" },
    },
    {
      prefix: "speed",
      param: "speedKmh",
      strategyId: "realitaet",
      metric: "fatal",
      title: "Hızın etkisi: ölüm riski",
      subtitle: "15 m'de fark ediliyor; insanların gerçekte yaptığı karışım.",
      xLabel: "Araç hızı",
      xUnit: "km/h",
      marker: { x: BASE_CONDITIONS.speedKmh, label: "Senaryo" },
    },
  ],
};
