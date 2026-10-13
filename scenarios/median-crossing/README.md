# median-crossing — Auto kommt über den Mittelstreifen

**Hook:** „Springen oder ausweichen?“
**Hikâye:** 50 km/h hızla gelen araç 15 m'de fark ediliyor (≈ 1,1 s; tepkiden sonra ~0,4–0,6 s kalıyor).

```
npm run scenario -- median-crossing          # out/median-crossing/results.json + quellen.txt
```

| Hareket | Model |
| --- | --- |
| Stehen bleiben | Yerinde kalır |
| Zur Seite | Kenara yana kaçış; doğru yönü seçme olasılığı konuma bağlı |
| Zurückweichen | Araçtan yol boyunca uzaklaşma; çarpma hızı göreli hıza düşer |
| Springen | Zirveyi çarpmaya denk getirmeye çalışır; kaputa çıkarsa yüksek ön cezası kalkar |
| Was Menschen wirklich tun | Soni et al. 2013 davranış karışımı (yaşa göre) |

Tablolar: araç tipi (sedan / SUV); duyarlılık: fark etme mesafesi 8–30 m, hız 30–60 km/h.
Varsayımlar `scenario.ts` içindeki `ASSUMPTIONS` listesinde ve results.json'da.
Kaynaklar: `META.sources` (core/dummies + core/risk kaynakları).
