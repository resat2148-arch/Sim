/**
 * Serinin kalıcı karakterleri (kullanıcı onayladı). Hepsi sarı-siyah
 * crash-test dummy'si; hepsi yetişkin. İsimler vücut tipine gönderme yapmaz.
 */

import type { BodyProfile } from "./model.ts";

export interface DummyCharacter {
  readonly id: string;
  readonly nameDe: string;
  /** Senaryo yazımı ve animasyon için kısa kişilik notu (Almanca). */
  readonly personalityDe: string;
  readonly body: BodyProfile;
}

export const KURT = {
  id: "kurt",
  nameDe: "Kurt",
  personalityDe: "Selbstbewusst bis übermütig; wählt immer die spektakulärste Bewegung und springt am liebsten.",
  body: { age: 26, sex: "male", heightM: 1.82, massKg: 78, bodyFat: 0.12 },
} as const satisfies DummyCharacter;

export const HEIDI = {
  id: "heidi",
  nameDe: "Heidi",
  personalityDe: "Gut organisiert und regeltreu; macht alles nach Vorschrift.",
  body: { age: 34, sex: "female", heightM: 1.58, massKg: 58, bodyFat: 0.26 },
} as const satisfies DummyCharacter;

export const BERND = {
  id: "bernd",
  nameDe: "Bernd",
  personalityDe: "Die Ruhe selbst, trockener Humor; hat es nie eilig.",
  body: { age: 47, sex: "male", heightM: 1.78, massKg: 104, bodyFat: 0.31 },
} as const satisfies DummyCharacter;

export const JONAS = {
  id: "jonas",
  nameDe: "Jonas",
  personalityDe: "Übereifrig und tollpatschig; stolpert gern über die eigenen Füße.",
  body: { age: 21, sex: "male", heightM: 1.96, massKg: 82, bodyFat: 0.15 },
} as const satisfies DummyCharacter;

export const GERDA = {
  id: "gerda",
  nameDe: "Gerda",
  personalityDe: "Weise und gelassen; macht meistens das Richtige – die ernste Stimme der Serie.",
  body: { age: 72, sex: "female", heightM: 1.63, massKg: 64, bodyFat: 0.32 },
} as const satisfies DummyCharacter;

export const CAST: readonly DummyCharacter[] = [KURT, HEIDI, BERND, JONAS, GERDA];

export function getCharacter(id: string): DummyCharacter {
  const found = CAST.find((c) => c.id === id);
  if (!found) throw new Error(`Bilinmeyen karakter "${id}". Mevcut: ${CAST.map((c) => c.id).join(", ")}`);
  return found;
}
