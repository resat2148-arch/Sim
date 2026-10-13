# core/render-hf — HyperFrames Short şablonu (aktif)

Remotion şablonunun (`core/render`) HyperFrames portu, tam Short: **Hook → 3 deneme → Skor tablosu → Ders → Kapanış** (28,6 s).
Kullanıcı geçişi onayladı; Remotion kodu tam Short burada doğrulanana kadar duruyor.
Aynı `short-props.json`'u okur; poz ve zamanlama kodu Remotion sürümüyle ortaktır (`render/three/sample.ts`, `render/timeline.ts`).

```
npm run short:props      # out/median-crossing/short-props.json
npm run hf:build         # out/median-crossing/hyperframes/ (HTML bileşim + world.js)
export HYPERFRAMES_BROWSER_PATH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell   # bulut ortamı
npm run hf:check         # lint + runtime + layout + contrast
npm run hf:render        # out/median-crossing/short.mp4
```

## Deneme sonuçları (bulut ortamı, yazılımsal GPU, 4 çekirdek)

Tam Short (858 kare, `--quality high`): 1 dk 40 s, 3,3 MB.


| | Remotion | HyperFrames |
| --- | --- | --- |
| 3D bölüm, 186 kare | 45 s | 33 s |
| Benzerlik (SSIM, aynı 186 kare) | referans | ort. 0,977, en düşük 0,922 |
| `hyperframes check` | – | geçti (2 uyarı) |

## Çeviri notları

- `spring()` → GSAP `back.out` / `power3.out`. Eğriler birebir aynı değil; en büyük fark "Erwischt!" damgasında (SSIM 0,92).
- `@react-three/fiber` → düz three.js (`world.ts`); `useMemo` bırakıldı (lint uyarısı).
- 3D sahne `hf-seek` olayıyla çizilir; tuval kasıtlı olarak kenardan kenara (`data-layout-allow-overflow`).
- Hook sorusuna yarı saydam koyu zemin eklendi (telefonda okunabilirlik); `check` kontrastı 25/25 geçiyor.
- three.js ve GSAP yerel dosyadan yüklenir (render sırasında ağ yok). Inter yazı tipini HyperFrames ilk çalıştırmada Google Fonts'tan alıp önbelleğe koyar.
- HyperFrames telemetrisi bu ortamda kapatıldı (`hyperframes telemetry disable`).
