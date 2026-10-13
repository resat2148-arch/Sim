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
  jumpRise,
  LATERAL_EFFICIENCY,
  lateralContact,
  lateralDisplacement,
  lateralEscape,
  movementBudget,
  planJump,
  pursuit,
  trialRng,
  type LateralContact,
  type TrialContext,
} from "../../core/montecarlo/index.ts";
import { runDistance } from "../../core/dummies/index.ts";
import type { MotionPlan, Vec3 } from "../../core/ragdoll/types.ts";
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
import type { ShortConfig } from "../../core/render/props.ts";

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

/** Bir denemenin tam planı: hem Monte Carlo sonucu hem ragdoll'un oynatacağı hareket. */
export interface TrialPlan {
  readonly move: Move;
  readonly offset: number;
  readonly approach: { readonly speed: number; readonly detectionDistance: number; readonly deceleration: number };
  readonly reactionTime: number;
  /** Fark etme anından temasa kadar geçen süre (s); temas yoksa null. */
  readonly contactTime: number | null;
  readonly outcome: TrialOutcome;
  /** Yayanın başlangıç konumuna göre yer değiştirmesi (m): x araç yönü, y yukarı, z yan. */
  rootAt(t: number): Vec3;
}

const ZERO: Vec3 = { x: 0, y: 0, z: 0 };
// Görsel: kaçış hareketi çarpma anından bu kadar sonra durur (sonuca etkisi yok).
const SETTLE_TIME = 0.6;

/**
 * Tek denemenin planı. Aynı ctx tüm hareketlerde aynı dummy örneğini ve aynı
 * araç yolunu verir. Monte Carlo yalnızca `outcome`u kullanır; ragdoll aynı
 * planın `rootAt` ve `contactTime` değerlerini oynatır (kural 1: sayılar buradan).
 */
export function planTrial(ctx: TrialContext, character: DummyCharacter, strategy: StrategyId, cond: Conditions): TrialPlan {
  const { body } = character;
  const motor = sampleMotor(motorCapacity(body), ctx.rng);
  const half = bodyHalfWidth(body.heightM);
  const front = VEHICLES[cond.vehicle].front;
  const offset = ctx.rng.fork("aim").uniform(-AIM_SPREAD, AIM_SPREAD);
  const approach = { speed: kmhToMs(cond.speedKmh), detectionDistance: cond.detectionDistance, deceleration: cond.deceleration };
  const r = motor.reactionTime;

  const move: Move =
    strategy === "realitaet" ? pickBehavior(body.age, ctx.rng.fork("behavior").next()) : strategy;

  const plan = (contactTime: number | null, outcome: TrialOutcome, rootAt: (t: number) => Vec3): TrialPlan => ({
    move, offset, approach, reactionTime: r, contactTime, outcome, rootAt,
  });
  const miss: TrialOutcome = { contact: false, ...NO_CONTACT_RISK };
  const hit = (impactSpeed: number, contact: LateralContact, hipAtImpact: number): TrialOutcome => {
    if (!contact.contact) return miss;
    const risk = impactRisk({ impactSpeed, age: body.age, front, hipAtImpact, bodyInPath: bodyInPath(contact, half) });
    return { contact: true, severe: risk.severe, fatal: risk.fatal };
  };

  const standing = lateralContact(offset, VEHICLE_WIDTH, half);

  if (move === "zurueck") {
    const start = r + TURN_TIME;
    const away = (t: number): Vec3 => ({ x: runDistance(motor.vmax * LATERAL_EFFICIENCY, motor.tau, t - start), y: 0, z: 0 });
    const p = pursuit(approach, start, motor);
    if (!p.impact) return plan(null, miss, away);
    const outcome = hit(p.relativeSpeed, standing, motor.hipHeight);
    return plan(outcome.contact ? p.timeToImpact : null, outcome, away);
  }

  const timing = approachTiming(approach);
  if (!timing.impact) return plan(null, miss, () => ZERO);
  const movementTime = movementBudget(timing.timeToImpact, r);

  switch (move) {
    case "stehen": {
      const outcome = hit(timing.impactSpeed, standing, motor.hipHeight);
      return plan(outcome.contact ? timing.timeToImpact : null, outcome, () => ZERO);
    }
    case "ausweichen": {
      const sideways = offset >= 0 ? 1 : -1;
      const pCorrect = 0.5 + 0.5 * Math.min(1, Math.abs(offset) / (VEHICLE_WIDTH / 2));
      const direction = ctx.rng.fork("direction").bernoulli(pCorrect) ? sideways : (-sideways as 1 | -1);
      const contact = lateralEscape({ offset, direction, movementTime, motor, vehicleWidth: VEHICLE_WIDTH, halfBody: half });
      const outcome = hit(timing.impactSpeed, contact, motor.hipHeight);
      const stopAt = movementTime + SETTLE_TIME;
      return plan(outcome.contact ? timing.timeToImpact : null, outcome, (t) => ({
        x: 0,
        y: 0,
        z: direction * lateralDisplacement(motor, Math.min(Math.max(0, t - r), stopAt)),
      }));
    }
    case "springen": {
      const jump = planJump({ movementTime, jumpHeight: motor.jumpHeight, rng: ctx.rng.fork("jump-timing") });
      const outcome = hit(timing.impactSpeed, standing, motor.hipHeight + jumpRise(jump, movementTime));
      return plan(outcome.contact ? timing.timeToImpact : null, outcome, (t) => ({ x: 0, y: jumpRise(jump, t - r), z: 0 }));
    }
  }
}

/** Monte Carlo için yalnızca sonuç. */
export function simulateTrial(ctx: TrialContext, character: DummyCharacter, strategy: StrategyId, cond: Conditions): TrialOutcome {
  return planTrial(ctx, character, strategy, cond).outcome;
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

// --- Ragdoll örneği -----------------------------------------------------------

export interface SampleRequest {
  readonly characterId: string;
  readonly strategy: StrategyId;
  readonly vehicle?: VehicleId;
  /**
   * Verilmezse tipik deneme: ilk 1000 denemede çoğunluk sonucunu (temas / kaçış)
   * paylaşanlar arasından, ölüm riski ve tepki süresi medyana en yakın olan.
   */
  readonly trial?: number;
  readonly seed?: string;
}

/** Videoda gösterilecek tek denemeyi seçer ve ragdoll planına çevirir. */
export function sampleForRagdoll(req: SampleRequest): { trial: number; plan: TrialPlan; motion: MotionPlan } {
  const character = CAST.find((c) => c.id === req.characterId);
  if (!character) throw new Error(`Bilinmeyen karakter: ${req.characterId}`);
  const cond = { ...BASE_CONDITIONS, vehicle: req.vehicle ?? BASE_CONDITIONS.vehicle };
  const seed = req.seed ?? META.id;
  const at = (index: number) => planTrial({ index, rng: trialRng(seed, index) }, character, req.strategy, cond);

  let trial = req.trial;
  if (trial === undefined) {
    const first = Array.from({ length: 1000 }, (_, i) => ({ i, plan: at(i) }));
    const majority = first.filter((x) => x.plan.outcome.contact).length * 2 >= first.length;
    const pool = first.filter((x) => x.plan.outcome.contact === majority);
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    const mRisk = median(pool.map((x) => x.plan.outcome.fatal.p));
    const mReact = median(pool.map((x) => x.plan.reactionTime));
    // Önce risk (sonucun tipikliği), eşitlikte tepki süresi (hareketin tipikliği).
    const score = (x: (typeof pool)[number]) =>
      Math.abs(x.plan.outcome.fatal.p - mRisk) * 100 + Math.abs(x.plan.reactionTime - mReact);
    trial = pool.reduce((best, x) => (score(x) < score(best) ? x : best)).i;
  }
  const plan = at(trial);
  const motion: MotionPlan = {
    body: character.body,
    vehicle: {
      front: VEHICLES[cond.vehicle].front,
      width: VEHICLE_WIDTH,
      speed: plan.approach.speed,
      deceleration: plan.approach.deceleration,
      detectionDistance: plan.approach.detectionDistance,
    },
    start: { x: 0, y: 0, z: plan.offset },
    rootAt: plan.rootAt,
    contactTime: plan.contactTime,
    duration: plan.approach.detectionDistance / plan.approach.speed + 3,
  };
  return { trial, plan, motion };
}

// --- Short ------------------------------------------------------------------

/**
 * Denemeler bölümünün hikâyesi (kullanıcıyla değiştirilebilir):
 * kendinden emin Kurt zıplar, sakin Bernd yerinde kalır, sakar Jonas yana kaçar.
 */
export const SHORT: ShortConfig = {
  tableId: "vehicle:limousine",
  attempts: [
    { characterId: "kurt", strategyId: "springen" },
    { characterId: "bernd", strategyId: "stehen" },
    { characterId: "jonas", strategyId: "ausweichen" },
  ],
  scoreboardStrategies: ["springen", "stehen", "ausweichen"],
};
