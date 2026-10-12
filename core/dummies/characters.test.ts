import { describe, expect, it } from "vitest";
import { CAST, getCharacter } from "./characters.ts";
import { motorCapacity } from "./model.ts";

describe("karakterler", () => {
  it("her karakterin profili geçerli ve kimlikler benzersiz", () => {
    for (const c of CAST) expect(() => motorCapacity(c.body)).not.toThrow();
    expect(new Set(CAST.map((c) => c.id)).size).toBe(CAST.length);
  });

  it("getCharacter bilinmeyen kimlikte mevcut listeyi söyler", () => {
    expect(getCharacter("gerda").nameDe).toBe("Gerda");
    expect(() => getCharacter("hans")).toThrow(/kurt, heidi/);
  });

  it("kadro rolleri modelde beklenen sırada çıkar", () => {
    const cap = (id: string) => motorCapacity(getCharacter(id).body);
    // Gerda en yavaş tepki verir
    for (const id of ["kurt", "heidi", "bernd", "jonas"]) {
      expect(cap("gerda").reactionTime.mean).toBeGreaterThan(cap(id).reactionTime.mean);
    }
    // Bernd'in sıçraması Kurt'unkinden düşük
    expect(cap("bernd").jumpHeight.mean).toBeLessThan(cap("kurt").jumpHeight.mean);
    // Jonas'ın kalçası en yüksekte, Heidi'ninki en alçakta
    const hips = CAST.map((c) => cap(c.id).hipHeight);
    expect(cap("jonas").hipHeight).toBe(Math.max(...hips));
    expect(cap("heidi").hipHeight).toBe(Math.min(...hips));
  });
});
