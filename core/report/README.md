# core/report

`results.json` → telefonda okunacak rapor sayfaları (1080 px genişlik PNG).

```
npm run scenario -- median-crossing
npm run report -- median-crossing      # out/median-crossing/report/*.png
```

- Senaryodan bağımsız: senaryo `REPORT` ile hangi taramanın hangi hareket ve
  metrikle çizileceğini söyler.
- Her karakter tüm grafiklerde aynı rengi taşır (doğrulanmış kategorik palet).
- Her sayfada "Modellschätzung – Quellen in der Beschreibung" notu bulunur.
- PNG'ye çevirme önceden kurulu Chromium ile (`CHROMIUM_PATH` ile değiştirilebilir).
