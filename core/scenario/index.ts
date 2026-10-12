/**
 * Senaryo sözleşmesinin çekirdeği.
 *
 * Şimdilik yalnızca her senaryonun taşıması gereken meta veriyi tanımlar.
 * Ortam, tehlike ve hareket tanımları dummies/montecarlo/risk modülleri
 * yazıldıkça (Faz 1, adım 2–5) buraya eklenecek.
 */

export interface Source {
  /** Kısa atıf, örn. "Rosén & Sander 2009". */
  readonly citation: string;
  /** Tam başlık; video açıklamasına girer. */
  readonly title: string;
  readonly url?: string;
  /** Bu kaynağın modelde neyi kalibre ettiği. */
  readonly usedFor: string;
}

export interface ScenarioMeta {
  /** Dosya adıyla aynı kebab-case kimlik, örn. "median-crossing". */
  readonly id: string;
  /** Videodaki başlık (Almanca). */
  readonly titleDe: string;
  /** Hook sorusu (Almanca), örn. "Springen oder ausweichen?" */
  readonly hookQuestionDe: string;
  /** Kapanıştaki ciddi ders (Almanca, tek cümle). */
  readonly lessonDe: string;
  /** En az bir kaynak zorunlu (CLAUDE.md, kural 3). */
  readonly sources: readonly Source[];
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Meta veriyi doğrular; hatalıysa tüm sorunları tek mesajda listeler. */
export function validateScenarioMeta(meta: ScenarioMeta): void {
  const problems: string[] = [];
  if (!ID_PATTERN.test(meta.id)) problems.push(`id "${meta.id}" kebab-case değil`);
  for (const key of ["titleDe", "hookQuestionDe", "lessonDe"] as const) {
    if (meta[key].trim() === "") problems.push(`${key} boş`);
  }
  if (meta.sources.length === 0) problems.push("en az bir kaynak gerekli");
  meta.sources.forEach((s, i) => {
    if (s.citation.trim() === "") problems.push(`sources[${i}].citation boş`);
    if (s.title.trim() === "") problems.push(`sources[${i}].title boş`);
    if (s.usedFor.trim() === "") problems.push(`sources[${i}].usedFor boş`);
  });
  if (problems.length > 0) {
    throw new Error(`Geçersiz senaryo "${meta.id}":\n- ${problems.join("\n- ")}`);
  }
}

/** Video açıklaması için "Quellen" bölümünü üretir. */
export function formatSourcesDe(sources: readonly Source[]): string {
  const lines = sources.map((s) => `• ${s.citation}: ${s.title}${s.url ? ` – ${s.url}` : ""}`);
  return ["Quellen:", ...lines].join("\n");
}
