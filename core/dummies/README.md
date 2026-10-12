# core/dummies

Vücut profili (yaş, cinsiyet, boy, kilo, yağ oranı) → hareket kapasitesi.

| Çıktı | Model | Kaynak |
| --- | --- | --- |
| Tepki süresi | Yaşla doğrusal, log-normal (CV 0,25) | Soni et al. 2013; CV varsayım |
| Sıçrama yüksekliği | `h = 0,22·boy · (k·yağsız kütle / (m·g) − 1)` | CHMS 2016–19 ile kalibre, Alotaibi et al. 2024 |
| Kalça yüksekliği | `0,53 · boy` | Winter 2009 |
| Koşu | `v(t) = vmax·(1 − e^(−t/τ))`, τ = 1,2 s | Samozino et al. 2016, Korhonen et al. 2003; vmax referansı varsayım |

- `motorCapacity(body)`: profilin ortalama kapasitesi.
- `sampleMotor(capacity, rng)`: bir Monte Carlo denemesi için somut değerler.
- `CAST`: Kurt, Heidi, Bernd, Jonas, Gerda (hepsi yetişkin; 18 yaş altı reddedilir).
- Her sabit `model.ts` içinde kaynağıyla ya da `VARSAYIM` etiketiyle belgelenmiştir.
