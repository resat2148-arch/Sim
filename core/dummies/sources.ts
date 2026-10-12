import type { Source } from "../scenario/index.ts";

/**
 * core/dummies modelinin dayandığı kaynaklar. Bu modeli kullanan her senaryo
 * bunları kendi kaynak listesine ekler.
 */
export const DUMMY_SOURCES = {
  soni2013: {
    citation: "Soni et al. 2013",
    title:
      "Observations on Pedestrian Pre-Crash Reactions during Simulated Accidents (Stapp Car Crash Journal 57, SAE 2013-22-0006)",
    url: "https://saemobilus.sae.org/content/2013-22-0006",
    usedFor: "Reaktionszeit junger (501 ms) und älterer (721 ms) Fußgänger",
  },
  chms2021: {
    citation: "Statistics Canada 2021",
    title:
      "Canadian Health Measures Survey 2016–2019: Sprunghöhe (Jumping Mechanography) nach Alter und Geschlecht, The Daily, 27.10.2021",
    url: "https://www150.statcan.gc.ca/n1/daily-quotidien/211027/cg-c001-eng.htm",
    usedFor: "Kalibrierung der Sprunghöhe nach Alter und Geschlecht",
  },
  alotaibi2024: {
    citation: "Alotaibi et al. 2024",
    title:
      "Fat-free mass mediates the association between body mass and jump height in healthy young adults (J Sports Med Phys Fitness, doi:10.23736/S0022-4707.24.15465-5)",
    usedFor: "Fettfreie Masse statt Gesamtgewicht bestimmt die Sprunghöhe",
  },
  winter2009: {
    citation: "Winter 2009",
    title:
      "Biomechanics and Motor Control of Human Movement, 4th ed. (Segmentlängen nach Drillis & Contini 1966)",
    usedFor: "Hüfthöhe als Anteil der Körpergröße",
  },
  korhonen2003: {
    citation: "Korhonen et al. 2003",
    title:
      "Age-related differences in 100-m sprint performance in male and female master runners (Med Sci Sports Exerc 35(8):1419–1428)",
    usedFor: "Abnahme der Sprintgeschwindigkeit mit dem Alter",
  },
  samozino2016: {
    citation: "Samozino et al. 2016",
    title:
      "A simple method for measuring power, force, velocity properties, and mechanical effectiveness in sprint running (Scand J Med Sci Sports 26(6):648–658)",
    usedFor: "Beschleunigungsmodell v(t) = vmax·(1 − e^(−t/τ))",
  },
} as const satisfies Record<string, Source>;
