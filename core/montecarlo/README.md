# core/montecarlo

| Dosya | İçerik |
| --- | --- |
| `runner.ts` | `runTrials` (varsayılan 10.000, sabit seed) ve `compareStrategies`: her strateji i. denemede aynı rng yolunu alır (ortak rastgele sayılar) |
| `stats.ts` | `proportion` (Wilson %95), `tally`, `mean`, `quantile` |
| `escape.ts` | Zaman bütçesi kaçış modeli: araç yaklaşımı (opsiyonel fren), yana kaçış, kaputa sıçrama zamanlaması |

Zaman bütçesi: `çarpmaya kalan süre − tepki süresi = hareket süresi`.
Bu modül yalnızca temas olup olmadığını ve geometrisini (örtüşme, çarpma anındaki
kalça yüksekliği, çarpma hızı) hesaplar; yaralanma olasılığı `core/risk`'in işidir.

Güven aralıkları yalnızca örnekleme gürültüsünü gösterir; model belirsizliği
(`VARSAYIM` sabitleri) duyarlılık analiziyle ayrıca gösterilmelidir.
