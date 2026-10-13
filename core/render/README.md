# core/render

Remotion Short şablonu (1080×1920, 30 fps, ~29 s): **Hook → Denemeler → Skor tablosu → Ders → Kapanış sorusu**.
Fizik burada çalışmaz; sahne `trajectory.json`'u oynatır, sayılar `results.json`'dan gelir.
Her karede „Modellschätzung – Quellen in der Beschreibung“ notu bulunur.

| Dosya | İçerik |
| --- | --- |
| `props.ts` | `buildShortProps`: results + meta + trajektoriler → Short girdisi (saf, test edilir). `inVideo: false` stratejiler reddedilir |
| `timeline.ts` | Bölüm süreleri ve kare → trajektori zamanı (saf, test edilir) |
| `Short.tsx`, `scenes.tsx`, `ui.tsx` | Bölümler ve 2D katmanlar (tüm metinler Almanca) |
| `three/Scene.tsx` | Yol, yaya geçidi, refüj, araç, crash-test dummy, kamera |

## Komutlar

```
npm run scenario -- median-crossing     # results.json
npm run ragdoll                         # trajectory/*.json
npm run short:props                     # out/median-crossing/short-props.json
npm run short:studio                    # Remotion Studio (bilgisayarda, Faz 2)
npm run short:render                    # mp4 (Faz 2; düşük çözünürlük testi için --scale=0.5)
```

Tekil kare (bulut ortamında; yazılımsal WebGL ve headless shell gerekir):

```
npx remotion still core/render/index.ts Short out/x.png --props=out/median-crossing/short-props.json \
  --frame=100 --gl=swangle --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

Hangi dummy'nin hangi hareketi denediği senaryodaki `SHORT` ayarındadır.
