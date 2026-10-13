import type { Source } from "../scenario/index.ts";

export const RISK_SOURCES = {
  rosen2009: {
    citation: "Rosén & Sander 2009",
    title:
      "Pedestrian fatality risk as a function of car impact speed (Accident Analysis & Prevention 41(3):536–542, doi:10.1016/j.aap.2009.02.002)",
    url: "https://doi.org/10.1016/j.aap.2009.02.002",
    usedFor: "Todesrisiko in Abhängigkeit der Aufprallgeschwindigkeit (GIDAS 1999–2007)",
  },
  tefft2013: {
    citation: "Tefft 2013",
    title:
      "Impact speed and a pedestrian's risk of severe injury or death (Accident Analysis & Prevention 50:871–878)",
    url: "https://pubmed.ncbi.nlm.nih.gov/22935347/",
    usedFor: "Alterseffekt und Risiko schwerer Verletzungen (AIS 4+)",
  },
  iihs2023: {
    citation: "IIHS 2023",
    title: "Vehicles with higher, more vertical front ends pose greater risk to pedestrians (14.11.2023)",
    url: "https://www.iihs.org/news/detail/vehicles-with-higher-more-vertical-front-ends-pose-greater-risk-to-pedestrians",
    usedFor: "Risikoaufschlag für hohe und stumpfe Fahrzeugfronten",
  },
} as const satisfies Record<string, Source>;
