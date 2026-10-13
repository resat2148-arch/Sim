# Notfall-Simulator — Proje Rehberi

Bu dosya, projenin her Claude Code oturumunda okunacak ana bağlamdır.

## Proje nedir?

Almanca bir YouTube Shorts serisi. Her bölümde bir acil durum simüle edilir. Örnek: karşı şeritten bir araba refüjü atlayıp yayaya doğru geliyor; zıplamak mı, yana kaçmak mı daha mantıklı? Farklı vücut tiplerindeki karakterler aynı anı farklı hareketlerle dener. Motor senaryoyu binlerce kez koşturur ve kurtulma olasılıklarını çıkarır.

- **Ton:** Ortam ve fizik gerçekçi. Komedi çarpışma test mankenlerinin (dummy) slapstick hareketlerinden gelir. Sonda ciddi ve gerçekten işe yarayan tek bir ders verilir.
- **Hedef:** Yüzlerce senaryo. Çekirdek bir kez yazılır; yeni senaryo eklemek saatler sürmeli.
- **Dil:** Kullanıcıyla Türkçe konuş. Videodaki tüm yazılar ve seslendirme **Almanca**. Seslendirme için Gemini TTS bir seçenek; kullanıcının erişimi var.

## Mimari: tek çekirdek + senaryo dosyaları + fizik modülleri

```
core/        Bir kez yazılır, tüm senaryolar kullanır
  dummies    Vücut profilleri: boy, kilo, yağ oranı, yaş, cinsiyet ->
             tepki süresi dağılımı, zıplama yüksekliği, koşu/yana adım hızı
  montecarlo Senaryoyu N kez (varsayılan 10.000) koşturur, sabit seed ile
  risk       Literatürden kalibre edilmiş risk fonksiyonları
             (çarpma hızı, yaş, araç önü, duruş -> ağır yaralanma / ölüm olasılığı)
  ragdoll    Görsel fizik (Rapier). SADECE gösterim içindir.
  render-hf  HyperFrames Short şablonu (1080x1920, 30 fps) — aktif
  render     Remotion Short şablonu (eski; HyperFrames doğrulanınca silinecek)
modules/     Yeni fizik türü gerektiğinde bir kez yazılır (su, yapı çökmesi, duman...)
scenarios/   Her tehlike bir dosya: ortam, tehlike, denenecek hareketler, veri, kaynaklar
```

### Temel kurallar

1. **Sayılar ragdoll'dan çıkmaz.** Ragdoll gerçek yaralanma hesaplayamaz. Olasılıklar, literatürden kalibre edilmiş modellerden ve Monte Carlo'dan gelir; ragdoll yalnızca bir örnek koşuyu görselleştirir.
2. **Önce simülasyon, sonra render.** HyperFrames her kareyi bağımsız olarak (`hf-seek`) çizer; fizik motoru render içinde canlı çalıştırılmaz. Akış şöyle:
   `scenario config -> sim (Node, deterministik) -> results.json + trajectory.json -> short-props.json -> HyperFrames oynatır -> mp4`
3. **Her senaryonun kaynakları** dosyanın içinde listelenir ve video açıklamasına girer.
4. **Sonuçlar "model tahmini" olarak sunulur**, mümkünse belirsizlik aralığıyla. Sahte kesinlik yok.

### Stack (öneri)

TypeScript, Node; Three.js + `@dimforge/rapier3d-compat` (ragdoll); HyperFrames (HTML + GSAP + düz three.js; kullanıcı onayladı, Apache 2.0). Telemetri kapalı tutulur (`hyperframes telemetry disable`). Gerekirse insan modeli için MuJoCo WASM'a geçilebilir.

## Shorts iskeleti (kullanıcı onayladı)

1. **Hook (0–2 sn):** Tehlike anı, görüntü donar, soru ekranda. Örnek: "Springen oder ausweichen?"
2. **Denemeler:** Dummy'ler aynı anı farklı hareketlerle dener. Başarısız olanlar slapstick şekilde uçar.
3. **Skor tablosu:** 10.000 simülasyonun sonucu, yüzdelerle. Sürpriz sonuç punchline olur.
4. **Tek cümlelik ders:** Gerçekten işe yarayan davranış, ciddi tonda.
5. **Kapanış sorusu:** "Was würdest du tun?" (yorum tetikleyici)

**Karakterler:** Sarı-siyah işaretli crash-test dummy'leri; gerçek insan değil. Her birinin kalıcı bir kişiliği ve Almanca bir adı olur (kullanıcıyla birlikte seçilecek). Vücut tipini aşağılayan isimlerden kaçın.

## İçerik güvenlik kuralları (kanalın sağlığı için şart)

- Kan, yaralanma detayı veya gerçekçi insan bedeni yok. Sadece stilize dummy'ler.
- Eğitim bağlamı **videonun içinde** görünmeli: ekranda kısa bir "Modellschätzung – Quellen in der Beschreibung" notu. YouTube bu bağlamın açıklamada değil, videonun kendisinde olmasını istiyor.
- **Düşme senaryoları her zaman bir acil durum içinde kurulur** (örnek: yangında 3. katta mahsur kalmak). Mesaj hayatta kalma davranışıdır: yardım çağırmak, mesafeyi kısaltmak, ayak üstü inmek.
- Bağlamından kopuk "hangi yükseklik/kat öldürür" sıralamaları, tabloları veya başlıkları yapılmaz. Bunlar YouTube'un kendine zarar politikasına girer ve kırılgan izleyicilere zarar verebilir.
- Reşit olmayan karakterler tehlikeli durumlarda gösterilmez.

## İlk senaryo: refüjü atlayan araba (araştırma özeti)

- **Hız baskın faktör:** GIDAS verisine göre ölüm riski 50 km/h'de 40 km/h'dekinin 2 katından, 30 km/h'dekinin 5 katından fazla (Rosén & Sander 2009). Eski çalışmalar riski olduğundan yüksek gösterir; yeni veriyi kullan.
- **Yaş:** 70 yaşındaki bir yayanın riski, ~12 mph daha hızlı çarpılan 30 yaşındakiyle benzer (Tefft 2013).
- **Araç önü:** Kaput yüksekliği >40 inç (~1 m) olan araçlar, alçak ve eğimli önlülere göre ~%45 daha ölümcül. 30–40 inç arasında küt ön, riski ~%26 artırır (IIHS 2023). Eğimli ön yayayı kaputa alır, küt ön gövdeye ızgarayla vurur.
- **Tepki süresi:** Gençlerde ortalama ~501 ms, yaşlılarda ~721 ms (PEDPCREACT / Soni et al. 2013). Tepkisel iki adımlık yana kaçış hareketi ~715 ms sürer.
- **Gerçek davranış:** İnsanların çoğu koşar, geri adım atar ya da donar. Gerçek kaza videolarında yayaların ~%66'sı bir kaçınma hareketi yapmış.
- **Duruş:** Çarpma anındaki duruş, kafa darbesinin şiddetini %30'a kadar değiştirir (Simms & Wood).
- **Zıplama:** Dikey sıçrama yağ oranıyla negatif ilişkili; toplam kilo değil, yağsız kütle belirleyici. Arabanın üstünden aşmak fiziksel olarak mümkün değil (sedan tavanı ~1,45 m, ortalama sıçrama 30–50 cm). Zıplamanın işe yarayan tek kullanımı kaputa çıkmak; bunun için kalçanın kaput seviyesine ulaşması gerekir, yoksa araç altına girme riski var.
- **Modelin kalbi zaman bütçesi:** fark etme mesafesi / hız − tepki süresi = hareket için kalan süre. Örnek: 15 m'de fark edilen 50 km/h'lik araç ≈ 1,1 sn; tepkiden sonra ~0,6 sn kalır. Sonuç, aracın neresine denk geldiğine (araç ~1,8 m genişliğinde) ve kişinin hareket kapasitesine göre belirlenir.

## İlk kilometre taşı (MVP)

### Faz 1: Telefondan, bulut oturumunda (şimdi)

Kullanıcının bilgisayarı şu an arızalı. Bulut ortamında yazılımsal GPU ile tam video render edilebiliyor (30 sn'lik Short ≈ 1,5–2 dk); MP4 dosya olarak gönderilir.

1. Proje iskeleti, klasör yapısı, testler
2. `core/dummies`: vücut profilleri ve hareket kapasiteleri
3. `core/montecarlo` + zaman bütçesi kaçış modeli
4. `core/risk`: çarpma sonucu fonksiyonları (yukarıdaki veriler)
5. `scenarios/median-crossing`: ilk senaryo dosyası ve kaynakları
6. Sonuç raporu: Monte Carlo çıktısını grafik (PNG) ve kısa özet tablo olarak kullanıcıya gönder. Kullanıcı sonuçları telefondan değerlendirir.
7. `core/ragdoll`: bir örnek koşunun trajektorisini headless olarak JSON'a kaydet (render yok)
8. `core/render`: Remotion Short şablonunun kodu (iskeletteki 5 bölüm). Kod yazılır, render edilmez. En fazla birkaç tekil kare (still) PNG olarak gönderilebilir.

### Faz 2: Kullanıcı bilgisayara geçince

9. Test render'ı (düşük çözünürlük), ardından ilk final Short
10. Seslendirme (Almanca) ve ses efektleri

Kullanıcı telefondan çalışıyor: ara çıktıları (grafik, tablo, still kare) dosya olarak gönder; uzun log yapıştırma.
