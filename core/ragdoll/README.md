# core/ragdoll

Rapier ile headless görsel fizik. **Sadece gösterim içindir; hiçbir sayı buradan çıkmaz.**

```
npm run ragdoll                                   # 5 dummy × (stehen, ausweichen, springen), sedan
npm run ragdoll -- --character kurt --strategy springen --vehicle suv [--trial 17]
npm run ragdoll:preview -- out/median-crossing/trajectory/kurt-springen-limousine.json
```

- **Temasa kadar** dummy, Monte Carlo modelinin hesapladığı yolu kinematik olarak izler
  (`planTrial().rootAt`, `contactTime`): zamanlama, yön ve zıplama yüksekliği modelle birebir aynı.
- **Temastan 0,05 s önce** fiziğe bırakılır; araç (kinematik) onu iter. Slapstick buradan gelir.
- Örnek deneme: çoğunluk sonucunu paylaşan denemeler arasında ölüm riski ve tepki süresi medyana en yakın olan.
- Gövde: 10 parça, Winter 2009 segment oranları ve kütleleri; araç profili risk modelindeki ön kenar yüksekliğiyle aynı.
- Çıktı `trajectory.json`: 30 fps, parça başına konum + quaternion, aracın konumu, şekiller.
