# core/risk

Çarpma hızı, yaş, araç önü ve temas geometrisi → ağır yaralanma (AIS 4+) ve
ölüm olasılığı. Her olasılık bir merkez tahmin ve model belirsizliği aralığıyla
(`lo`–`hi`) gelir.

| Etken | Model | Kaynak |
| --- | --- | --- |
| Hız → ölüm | `1 / (1 + e^(6,9 − 0,090·v))`, v km/h | Rosén & Sander 2009 (GIDAS) |
| Hız → ağır yaralanma | Tefft eğrisi, GIDAS düzeyine kaydırılmış | Tefft 2013; kaydırma varsayım |
| Yaş | 70 yaş @ v ≈ 30 yaş @ v + 11,8 mph | Tefft 2013 |
| Araç önü | > 40 inç ×1,45; 30–40 inç küt ×1,26 | IIHS 2023 |
| Kaputa alınma | Kalça kenarın üstündeyse yüksek ön cezası yok | Varsayım |
| Sıyırma | Yoldaki gövde oranıyla, en az %25 | Varsayım |
| Belirsizlik bandı | Logit ±0,9 (R&S'nin 75 km/h GA'sından); duruş etkisi bunun içinde | Rosén & Sander 2009 |
