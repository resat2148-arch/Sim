# Notfall-Simulator

Almanca YouTube Shorts serisi için Monte Carlo acil durum simülatörü.
Proje rehberi ve kurallar: [CLAUDE.md](CLAUDE.md).

```
npm install
npm run check      # typecheck + testler
npm test           # yalnızca testler
```

## Yapı

| Klasör | İçerik |
| --- | --- |
| `core/random` | Seed'li deterministik RNG (sfc32) + dağılımlar, `fork()` ile alt akışlar |
| `core/units` | Birim dönüşümleri (çekirdek SI birimiyle çalışır) |
| `core/scenario` | Senaryo meta sözleşmesi; kaynaklar zorunlu |
| `core/dummies` | Vücut profilleri ve hareket kapasiteleri |
| `core/montecarlo` | N denemelik koşturucu + zaman bütçesi modeli |
| `core/risk` | Literatürden kalibre risk fonksiyonları |
| `core/ragdoll` | Rapier görsel fizik (yalnızca gösterim) |
| `core/render` | Remotion Short şablonu |
| `modules/` | Yeni fizik türleri |
| `scenarios/` | Her tehlike bir senaryo |
| `scripts/` | CLI giriş noktaları; çıktılar `out/` |

Akış: `scenario → sim (Node, deterministik) → results.json + trajectory.json → Remotion → mp4`
