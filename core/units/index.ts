/** Birim dönüşümleri. Çekirdek içinde her şey SI birimindedir (m, s, kg). */

export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

export function msToKmh(ms: number): number {
  return ms * 3.6;
}

export function mphToMs(mph: number): number {
  return (mph * 1609.344) / 3600;
}

export function inchToM(inch: number): number {
  return inch * 0.0254;
}

export function msToS(milliseconds: number): number {
  return milliseconds / 1000;
}
